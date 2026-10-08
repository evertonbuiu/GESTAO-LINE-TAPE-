"""Reexecuta (em memória) as migrações do Supabase para descobrir o esquema final.

Lê supabase/migrations/*.sql em ordem e aplica CREATE/ALTER/DROP de tabelas,
tipos enum, índices únicos, funções, gatilhos e políticas. O resultado é salvo
em cloudflare/build/pg_model.json e serve de base para gerar o esquema D1 e
para reescrever as regras automáticas.
"""
import json
import os
import re
import sys
from collections import OrderedDict

sys.path.insert(0, os.path.dirname(__file__))
from pgsplit import split_statements, split_top_level  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MIG = os.path.join(ROOT, "supabase", "migrations")
OUT = os.path.join(ROOT, "cloudflare", "build")

IDENT = r'(?:"[^"]+"|[A-Za-z_][A-Za-z_0-9]*)'
QNAME = rf"(?:{IDENT}\.)?{IDENT}"


def unq(name: str) -> str:
    name = name.strip()
    if "." in name and not name.startswith('"'):
        name = name.split(".")[-1]
    elif name.count('"') >= 4:
        name = name.split('".')[-1]
    return name.strip('"')


def schema_of(qname: str) -> str:
    q = qname.strip()
    if "." in q:
        return q.split(".")[0].strip('"').lower()
    return "public"


tables: "OrderedDict[str, dict]" = OrderedDict()
enums = {}
functions = {}
triggers = {}
policies = {}
indexes = {}
rls = {}
unhandled = []

TYPE_KEYWORDS = re.compile(
    r"\s+(NOT\s+NULL|NULL|DEFAULT|PRIMARY\s+KEY|UNIQUE|REFERENCES|CHECK|CONSTRAINT|GENERATED|COLLATE)\b",
    re.I,
)


def new_table(name):
    return {
        "name": name,
        "columns": OrderedDict(),
        "pk": [],
        "constraints": OrderedDict(),  # nome -> {kind, cols, ref_table, ref_cols, on_delete, expr}
    }


def find_top_keyword(s: str, start: int = 0):
    """Posição do próximo modificador de coluna no nível 0 de parênteses."""
    depth, i, n = 0, start, len(s)
    while i < n:
        c = s[i]
        if c == "'":
            j = i + 1
            while j < n:
                if s[j] == "'" and j + 1 < n and s[j + 1] == "'":
                    j += 2
                    continue
                if s[j] == "'":
                    break
                j += 1
            i = j + 1
            continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        elif depth == 0 and c.isspace():
            m = TYPE_KEYWORDS.match(s, i)
            if m:
                return i, m.group(1).upper()
        i += 1
    return -1, None


def parse_paren(s: str, i: int):
    """Retorna (conteúdo, índice_após) para o parêntese que começa em s[i]."""
    assert s[i] == "("
    depth, j = 0, i
    while j < len(s):
        if s[j] == "'":
            k = j + 1
            while k < len(s) and not (s[k] == "'" and (k + 1 >= len(s) or s[k + 1] != "'")):
                k += 2 if s[k] == "'" else 1
            j = k + 1
            continue
        if s[j] == "(":
            depth += 1
        elif s[j] == ")":
            depth -= 1
            if depth == 0:
                return s[i + 1 : j], j + 1
        j += 1
    raise ValueError("parêntese sem fechamento: " + s[i : i + 80])


def parse_column(table, text):
    text = text.strip()
    m = re.match(rf"({IDENT})\s+(.*)$", text, re.S)
    if not m:
        raise ValueError("coluna: " + text)
    name = unq(m.group(1))
    rest = m.group(2)
    pos, _ = find_top_keyword(rest)
    ctype = (rest if pos < 0 else rest[:pos]).strip()
    mods = "" if pos < 0 else rest[pos:]
    col = {"type": ctype, "notnull": False, "default": None, "generated": None}
    table["columns"][name] = col
    apply_modifiers(table, name, mods)
    return name


def apply_modifiers(table, colname, mods):
    col = table["columns"][colname]
    s = mods
    i = 0
    cname = None
    while True:
        s = s[i:].lstrip()
        if not s:
            break
        up = s.upper()
        if up.startswith("CONSTRAINT"):
            m = re.match(rf"CONSTRAINT\s+({IDENT})", s, re.I)
            cname = unq(m.group(1))
            i = m.end()
            continue
        if up.startswith("NOT NULL") or re.match(r"NOT\s+NULL", s, re.I):
            col["notnull"] = True
            i = re.match(r"NOT\s+NULL", s, re.I).end()
            continue
        if re.match(r"NULL\b", s, re.I):
            i = 4
            continue
        if re.match(r"DEFAULT\b", s, re.I):
            body = s[7:]
            lead = len(body) - len(body.lstrip())
            body = body.lstrip()
            p, _ = find_top_keyword(body, 0)
            expr = body if p < 0 else body[:p]
            col["default"] = expr.strip()
            i = 7 + lead + len(expr)
            continue
        if re.match(r"PRIMARY\s+KEY", s, re.I):
            table["pk"] = [colname]
            col["notnull"] = True
            i = re.match(r"PRIMARY\s+KEY", s, re.I).end()
            continue
        if re.match(r"UNIQUE\b", s, re.I):
            nm = cname or f"{table['name']}_{colname}_key"
            table["constraints"][nm] = {"kind": "unique", "cols": [colname]}
            cname = None
            i = 6
            m = re.match(r"UNIQUE\s+NULLS\s+NOT\s+DISTINCT", s, re.I)
            if m:
                i = m.end()
            continue
        if re.match(r"REFERENCES\b", s, re.I):
            m = re.match(rf"REFERENCES\s+({QNAME})\s*(\(([^)]*)\))?", s, re.I)
            ref = m.group(1)
            refcols = [unq(c) for c in m.group(3).split(",")] if m.group(3) else ["id"]
            i = m.end()
            od = None
            while True:
                m2 = re.match(
                    r"\s*ON\s+(DELETE|UPDATE)\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)",
                    s[i:],
                    re.I,
                )
                if not m2:
                    break
                if m2.group(1).upper() == "DELETE":
                    od = re.sub(r"\s+", " ", m2.group(2).upper())
                i += m2.end()
            nm = cname or f"{table['name']}_{colname}_fkey"
            table["constraints"][nm] = {
                "kind": "fk",
                "cols": [colname],
                "ref_schema": schema_of(ref),
                "ref_table": unq(ref),
                "ref_cols": refcols,
                "on_delete": od,
            }
            cname = None
            continue
        if re.match(r"CHECK\b", s, re.I):
            j = s.index("(")
            body, end = parse_paren(s, j)
            nm = cname or f"{table['name']}_{colname}_check"
            table["constraints"][nm] = {"kind": "check", "cols": [colname], "expr": body.strip()}
            cname = None
            i = end
            continue
        if re.match(r"GENERATED\b", s, re.I):
            m = re.match(r"GENERATED\s+ALWAYS\s+AS\s*", s, re.I)
            if m:
                j = m.end()
                body, end = parse_paren(s, j)
                col["generated"] = body.strip()
                i = end
                m3 = re.match(r"\s*STORED", s[i:], re.I)
                if m3:
                    i += m3.end()
                continue
            m = re.match(r"GENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY(\s*\([^)]*\))?", s, re.I)
            col["default"] = "__identity__"
            i = m.end()
            continue
        if re.match(r"COLLATE\b", s, re.I):
            m = re.match(rf"COLLATE\s+{IDENT}", s, re.I)
            i = m.end()
            continue
        raise ValueError(f"modificador desconhecido em {table['name']}.{colname}: {s[:80]}")


def parse_table_constraint(table, text, name=None):
    s = text.strip()
    m = re.match(rf"CONSTRAINT\s+({IDENT})\s+(.*)$", s, re.I | re.S)
    if m:
        name = unq(m.group(1))
        s = m.group(2).strip()
    up = s.upper()
    if up.startswith("PRIMARY KEY"):
        body, _ = parse_paren(s, s.index("("))
        table["pk"] = [unq(c) for c in body.split(",")]
        for c in table["pk"]:
            if c in table["columns"]:
                table["columns"][c]["notnull"] = True
        return
    if up.startswith("UNIQUE"):
        body, _ = parse_paren(s, s.index("("))
        cols = [unq(c) for c in body.split(",")]
        nm = name or f"{table['name']}_{'_'.join(cols)}_key"
        table["constraints"][nm] = {"kind": "unique", "cols": cols}
        return
    if up.startswith("FOREIGN KEY"):
        body, end = parse_paren(s, s.index("("))
        cols = [unq(c) for c in body.split(",")]
        rest = s[end:]
        m = re.match(rf"\s*REFERENCES\s+({QNAME})\s*(\(([^)]*)\))?", rest, re.I)
        ref = m.group(1)
        refcols = [unq(c) for c in m.group(3).split(",")] if m.group(3) else ["id"]
        od = None
        m2 = re.search(r"ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)", rest, re.I)
        if m2:
            od = re.sub(r"\s+", " ", m2.group(1).upper())
        nm = name or f"{table['name']}_{'_'.join(cols)}_fkey"
        table["constraints"][nm] = {
            "kind": "fk",
            "cols": cols,
            "ref_schema": schema_of(ref),
            "ref_table": unq(ref),
            "ref_cols": refcols,
            "on_delete": od,
        }
        return
    if up.startswith("CHECK"):
        body, _ = parse_paren(s, s.index("("))
        nm = name or f"{table['name']}_check_{len(table['constraints'])}"
        table["constraints"][nm] = {"kind": "check", "cols": [], "expr": body.strip()}
        return
    if up.startswith("EXCLUDE"):
        nm = name or f"{table['name']}_excl"
        table["constraints"][nm] = {"kind": "exclude", "expr": s}
        return
    raise ValueError("restrição de tabela: " + s[:100])


def is_table_constraint(text):
    return re.match(r"(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK|EXCLUDE)\b", text.strip(), re.I)


def do_create_table(stmt):
    m = re.match(rf"CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(IF\s+NOT\s+EXISTS\s+)?({QNAME})\s*\(", stmt, re.I)
    if schema_of(m.group(2)) != "public":
        return
    name = unq(m.group(2))
    if name in tables and m.group(1):
        return
    body, _ = parse_paren(stmt, m.end() - 1)
    t = new_table(name)
    tables[name] = t
    for part in split_top_level(body):
        if not part:
            continue
        if is_table_constraint(part):
            parse_table_constraint(t, part)
        elif re.match(r"LIKE\b", part, re.I):
            unhandled.append(("LIKE", stmt[:120]))
        else:
            parse_column(t, part)


def do_alter_table(stmt):
    m = re.match(rf"ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?(ONLY\s+)?({QNAME})\s+(.*)$", stmt, re.I | re.S)
    if not m or schema_of(m.group(3)) != "public":
        return
    name = unq(m.group(3))
    rest = m.group(4).strip()
    if name not in tables:
        if not m.group(1):
            unhandled.append(("ALTER desconhecida", stmt[:150]))
        return
    t = tables[name]
    mr = re.match(rf"RENAME\s+TO\s+({IDENT})$", rest, re.I)
    if mr:
        new = unq(mr.group(1))
        t["name"] = new
        tables[new] = tables.pop(name)
        return
    mr = re.match(rf"RENAME\s+(?:COLUMN\s+)?({IDENT})\s+TO\s+({IDENT})$", rest, re.I)
    if mr:
        old, new = unq(mr.group(1)), unq(mr.group(2))
        cols = OrderedDict()
        for k, v in t["columns"].items():
            cols[new if k == old else k] = v
        t["columns"] = cols
        t["pk"] = [new if c == old else c for c in t["pk"]]
        for c in t["constraints"].values():
            if "cols" in c:
                c["cols"] = [new if x == old else x for x in c["cols"]]
        return
    mr = re.match(rf"RENAME\s+CONSTRAINT\s+({IDENT})\s+TO\s+({IDENT})$", rest, re.I)
    if mr:
        old, new = unq(mr.group(1)), unq(mr.group(2))
        if old in t["constraints"]:
            t["constraints"][new] = t["constraints"].pop(old)
        return
    for action in split_top_level(rest):
        alter_action(t, action.strip(), stmt)


def alter_action(t, a, stmt):
    up = a.upper()
    if re.match(r"(ENABLE|DISABLE|FORCE|NO\s+FORCE)\s+ROW\s+LEVEL\s+SECURITY", a, re.I):
        rls[t["name"]] = not up.startswith("DISABLE")
        return
    if re.match(r"REPLICA\s+IDENTITY|OWNER\s+TO|SET\s+\(|ENABLE\s+TRIGGER|DISABLE\s+TRIGGER", a, re.I):
        return
    m = re.match(rf"ADD\s+COLUMN\s+(IF\s+NOT\s+EXISTS\s+)?(.*)$", a, re.I | re.S)
    if m or (re.match(r"ADD\s+", a, re.I) and not re.match(r"ADD\s+(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE)", a, re.I)):
        if not m:
            m = re.match(r"ADD\s+(IF\s+NOT\s+EXISTS\s+)?(.*)$", a, re.I | re.S)
        colname = re.match(rf"({IDENT})", m.group(2).strip()).group(1)
        if unq(colname) in t["columns"] and (m.group(1) or in_guarded_do):
            return
        parse_column(t, m.group(2))
        return
    m = re.match(r"ADD\s+(.*)$", a, re.I | re.S)
    if m:
        txt = m.group(1)
        mm = re.match(rf"CONSTRAINT\s+({IDENT})", txt, re.I)
        if mm and unq(mm.group(1)) in t["constraints"]:
            return
        parse_table_constraint(t, txt)
        return
    m = re.match(rf"DROP\s+COLUMN\s+(IF\s+EXISTS\s+)?({IDENT})", a, re.I)
    if m:
        c = unq(m.group(2))
        t["columns"].pop(c, None)
        for k in [k for k, v in t["constraints"].items() if c in v.get("cols", [])]:
            t["constraints"].pop(k)
        return
    m = re.match(rf"DROP\s+CONSTRAINT\s+(IF\s+EXISTS\s+)?({IDENT})", a, re.I)
    if m:
        nm = unq(m.group(2))
        if nm in t["constraints"]:
            t["constraints"].pop(nm)
        elif nm == f"{t['name']}_pkey":
            t["pk"] = []
        elif not m.group(1):
            unhandled.append(("DROP CONSTRAINT desconhecida", t["name"] + "." + nm))
        return
    m = re.match(rf"ALTER\s+(?:COLUMN\s+)?({IDENT})\s+(.*)$", a, re.I | re.S)
    if m:
        c = unq(m.group(1))
        what = m.group(2).strip()
        col = t["columns"].get(c)
        if col is None:
            unhandled.append(("ALTER COLUMN desconhecida", t["name"] + "." + c))
            return
        if re.match(r"SET\s+DEFAULT\s+", what, re.I):
            col["default"] = re.sub(r"^SET\s+DEFAULT\s+", "", what, flags=re.I).strip()
        elif re.match(r"DROP\s+DEFAULT", what, re.I):
            col["default"] = None
        elif re.match(r"SET\s+NOT\s+NULL", what, re.I):
            col["notnull"] = True
        elif re.match(r"DROP\s+NOT\s+NULL", what, re.I):
            col["notnull"] = False
        elif re.match(r"(SET\s+DATA\s+)?TYPE\s+", what, re.I):
            ty = re.sub(r"^(SET\s+DATA\s+)?TYPE\s+", "", what, flags=re.I)
            ty = re.split(r"\s+USING\s+", ty, flags=re.I)[0].strip()
            col["type"] = ty
        elif re.match(r"(ADD|DROP)\s+(GENERATED|IDENTITY)|SET\s+STATISTICS|SET\s+STORAGE", what, re.I):
            pass
        else:
            unhandled.append(("ALTER COLUMN ação", a[:120]))
        return
    unhandled.append(("ALTER ação", t["name"] + ": " + a[:120]))


def do_create_index(stmt):
    m = re.match(
        rf"CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?({IDENT})?\s*ON\s+(?:ONLY\s+)?({QNAME})\s*(?:USING\s+(\w+)\s*)?\(",
        stmt,
        re.I,
    )
    if not m:
        unhandled.append(("INDEX", stmt[:120]))
        return
    if schema_of(m.group(3)) != "public":
        return
    body, end = parse_paren(stmt, m.end() - 1)
    where = None
    mw = re.search(r"\bWHERE\s+(.*)$", stmt[end:], re.I | re.S)
    if mw:
        where = mw.group(1).strip()
    nm = unq(m.group(2)) if m.group(2) else f"idx_{len(indexes)}"
    indexes[nm] = {
        "table": unq(m.group(3)),
        "unique": bool(m.group(1)),
        "method": (m.group(4) or "btree").lower(),
        "exprs": [e.strip() for e in split_top_level(body)],
        "where": where,
    }


def do_function(stmt):
    m = re.match(rf"CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+({QNAME})\s*\(", stmt, re.I)
    if schema_of(m.group(2)) not in ("public",):
        return
    functions[unq(m.group(2))] = stmt


def do_trigger(stmt):
    m = re.match(
        rf"CREATE\s+(OR\s+REPLACE\s+)?(CONSTRAINT\s+)?TRIGGER\s+({IDENT})\s+(.*?)\s+ON\s+({QNAME})\s+(.*)$",
        stmt,
        re.I | re.S,
    )
    if not m:
        unhandled.append(("TRIGGER", stmt[:150]))
        return
    tbl = unq(m.group(5))
    if schema_of(m.group(5)) != "public":
        triggers[f"{schema_of(m.group(5))}.{tbl}.{unq(m.group(3))}"] = stmt
        return
    triggers[f"{tbl}.{unq(m.group(3))}"] = stmt


def do_drop(stmt):
    m = re.match(rf"DROP\s+(TABLE|FUNCTION|TRIGGER|POLICY|INDEX|TYPE|VIEW)\s+(IF\s+EXISTS\s+)?(.*)$", stmt, re.I | re.S)
    if not m:
        return False
    kind = m.group(1).upper()
    rest = m.group(3).strip()
    rest = re.sub(r"\s+(CASCADE|RESTRICT)\s*$", "", rest, flags=re.I)
    if kind == "TABLE":
        for nm in split_top_level(rest):
            tables.pop(unq(nm), None)
    elif kind == "FUNCTION":
        for nm in split_top_level(rest):
            functions.pop(unq(re.sub(r"\(.*$", "", nm, flags=re.S)), None)
    elif kind in ("TRIGGER", "POLICY"):
        mm = re.match(rf"({IDENT}|\"[^\"]+\")\s+ON\s+({QNAME})", rest, re.I | re.S)
        if mm:
            key = f"{unq(mm.group(2))}.{unq(mm.group(1))}"
            (triggers if kind == "TRIGGER" else policies).pop(key, None)
    elif kind == "INDEX":
        for nm in split_top_level(rest):
            indexes.pop(unq(nm), None)
    elif kind == "TYPE":
        for nm in split_top_level(rest):
            enums.pop(unq(nm), None)
    return True


def do_policy(stmt):
    m = re.match(rf'CREATE\s+POLICY\s+({IDENT})\s+ON\s+({QNAME})\s+(.*)$', stmt, re.I | re.S)
    if not m:
        unhandled.append(("POLICY", stmt[:120]))
        return
    if schema_of(m.group(2)) != "public":
        policies[f"{schema_of(m.group(2))}.{unq(m.group(2))}.{unq(m.group(1))}"] = stmt
        return
    policies[f"{unq(m.group(2))}.{unq(m.group(1))}"] = stmt


def do_type(stmt):
    m = re.match(rf"CREATE\s+TYPE\s+({QNAME})\s+AS\s+ENUM\s*\((.*)\)\s*$", stmt, re.I | re.S)
    if m:
        enums[unq(m.group(1))] = [v.strip().strip("'") for v in split_top_level(m.group(2))]
        return
    m = re.match(rf"ALTER\s+TYPE\s+({QNAME})\s+ADD\s+VALUE\s+(IF\s+NOT\s+EXISTS\s+)?'([^']+)'", stmt, re.I)
    if m:
        lst = enums.setdefault(unq(m.group(1)), [])
        if m.group(3) not in lst:
            lst.append(m.group(3))
        return
    unhandled.append(("TYPE", stmt[:120]))


def handle_do_block(stmt):
    """Blocos DO $$ ... $$ que criam objetos dinamicamente (format/EXECUTE).

    São registrados para revisão manual — os gatilhos genéricos (auditoria,
    dono pessoal) são reescritos no Worker com base nesta lista.
    """
    do_blocks.append(stmt)
    if custom_do(stmt):
        return
    m = re.search(r"(\$[A-Za-z_0-9]*\$)(.*)\1", stmt, re.S)
    if not m:
        return
    body = m.group(2)
    dynamic = "EXECUTE" in body.upper()
    found = False
    for frag in split_statements(body):
        mm = re.search(
            r"\b(ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|CREATE\s+TABLE|CREATE\s+POLICY|CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER|CREATE\s+TYPE|ALTER\s+TYPE|DROP\s+(?:POLICY|TRIGGER|INDEX|TABLE))\b",
            frag,
            re.I,
        )
        if not mm:
            continue
        sub = frag[mm.start():].strip()
        sub = re.sub(r"\s+END\s+IF\s*$", "", sub, flags=re.I)
        if "%" in sub or "||" in sub:
            continue  # comando montado dinamicamente; tratado manualmente
        found = True
        global in_guarded_do
        in_guarded_do = True
        try:
            process(sub)
        except Exception as e:  # noqa: BLE001
            unhandled.append(("ERRO-DO", f"{e}: {sub[:120]}"))
        finally:
            in_guarded_do = False
    if dynamic or not found:
        unhandled.append(("DO", stmt[:300].replace("\n", " ")))



def policy_roles(stmt):
    m = re.search(r"\bTO\s+([a-z_, ]+?)\s+(USING|WITH\s+CHECK|$)", stmt, re.I | re.S)
    if not m:
        return ["public"]
    return [r.strip().lower() for r in m.group(1).split(",")]


def arrays_in(body):
    """Extrai as listas ARRAY['a','b'] declaradas no bloco, por nome de variável."""
    out = {}
    for m in re.finditer(r"(\w+)\s+(?:TEXT|text)\[\]\s*:=\s*ARRAY\s*\[(.*?)\]", body, re.S):
        out[m.group(1)] = re.findall(r"'([^']+)'", m.group(2))
    return out


def mk_policy(table, name, stmt_text):
    policies[f"{table}.{name}"] = stmt_text


def custom_do(stmt):
    """Emula os blocos DO que mudam políticas/gatilhos de forma dinâmica."""
    body = stmt
    if "Drop all policies with role 'public' or 'anon'" in body:
        lst = re.findall(r"'([a-z_]+)'", body.split("tablename IN", 1)[1])
        for key in [k for k in policies if k.count(".") == 1]:
            t, nm = key.split(".")
            if t in lst and ("public" in policy_roles(policies[key]) or "anon" in policy_roles(policies[key])):
                policies.pop(key)
        return True
    if 'CREATE POLICY "Authenticated full access"' in body and "tables TEXT[]" in body:
        for t in arrays_in(body)["tables"]:
            mk_policy(t, "Authenticated full access", f'CREATE POLICY "Authenticated full access" ON public.{t} FOR ALL TO authenticated USING (true) WITH CHECK (true)')
        return True
    if "fin_tables" in body and "commercial_tables" in body:
        arr = arrays_in(body)
        allt = sum(arr.values(), [])
        for t in allt:
            policies.pop(f"{t}.Authenticated full access", None)
        groups = [
            ("fin_tables", [("Financeiro full access", "ALL", "['admin','financeiro']")]),
            ("commercial_tables", [("Comercial write", "ALL", "['admin','financeiro']"), ("Comercial read", "SELECT", "['admin','financeiro','funcionario','deposito']")]),
            ("equipment_tables", [("Equip write", "ALL", "['admin','funcionario','deposito']"), ("Equip read", "SELECT", "['admin','financeiro','funcionario','deposito']")]),
            ("people_tables", [("People write", "ALL", "['admin','financeiro']"), ("People read", "SELECT", "['admin','financeiro','funcionario','deposito']")]),
            ("whatsapp_tables", [("Whats write", "ALL", "['admin']"), ("Whats read", "SELECT", "['admin','financeiro','funcionario']")]),
            ("signatures_tables", [("Signatures access", "ALL", "['admin','financeiro']")]),
        ]
        for var, pols in groups:
            for t in arr.get(var, []):
                for nm, cmd, roles in pols:
                    cond = f"public.current_user_has_any_role(ARRAY{roles})"
                    chk = f" WITH CHECK ({cond})" if cmd == "ALL" else ""
                    mk_policy(t, nm, f'CREATE POLICY "{nm}" ON public.{t} FOR {cmd} TO authenticated USING ({cond}){chk}')
        for t in arr.get("personal_tables", []):
            mk_policy(t, "Own preferences", f'CREATE POLICY "Own preferences" ON public.{t} FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())')
        return True
    if "policyname <> 'Financeiro full access'" in body:
        lst = re.findall(r"'([a-z_]+)'", body.split("ANY (ARRAY[", 1)[1].split("]", 1)[0])
        for key in [k for k in policies if k.count(".") == 1]:
            t, nm = key.split(".")
            if t in lst and nm != "Financeiro full access":
                policies.pop(key)
        return True
    if "_select_own" in body and "personal_accounts" in body:
        lst = re.findall(r"'([a-z_]+)'", body.split("ARRAY[", 1)[1].split("]", 1)[0])
        for t in lst:
            mk_policy(t, f"{t}_select_own", f'CREATE POLICY "{t}_select_own" ON public.{t} FOR SELECT TO authenticated USING (owner_id = auth.uid())')
            mk_policy(t, f"{t}_insert_own", f'CREATE POLICY "{t}_insert_own" ON public.{t} FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid())')
            mk_policy(t, f"{t}_update_own", f'CREATE POLICY "{t}_update_own" ON public.{t} FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())')
            policies.pop(f"{t}.{t}_delete_own", None)
        return True
    if "trg_audit_%1$s" in body:
        for t in arrays_in(body.replace("text[]", "TEXT[]"))["tables"]:
            if t in tables:
                triggers[f"{t}.trg_audit_{t}"] = f"CREATE TRIGGER trg_audit_{t} AFTER INSERT OR UPDATE OR DELETE ON public.{t} FOR EACH ROW EXECUTE FUNCTION public.record_audit_log()"
        return True
    if "personal_recurrences_category_owner_fk" in body:
        for tbl, cname, col, ref in re.findall(r"\('([a-z_]+)','([a-z_]+)','([a-z_]+)','([a-z_]+)'\)", body):
            if tbl in tables and cname not in tables[tbl]["constraints"]:
                tables[tbl]["constraints"][cname] = {
                    "kind": "fk", "cols": [col, "owner_id"], "ref_schema": "public",
                    "ref_table": ref, "ref_cols": ["id", "owner_id"], "on_delete": "RESTRICT",
                }
        return True
    if "REPLICA IDENTITY FULL" in body or "GRANT " in body.upper() and "EXECUTE format('GRANT" in body:
        return True
    if "trg_%s_owner" in body:
        lst = re.findall(r"'([a-z_]+)'", body.split("ARRAY[", 1)[1].split("]", 1)[0])
        for t in lst:
            triggers[f"{t}.trg_{t}_owner"] = f"CREATE TRIGGER trg_{t}_owner BEFORE INSERT OR UPDATE ON public.{t} FOR EACH ROW EXECUTE FUNCTION public.force_personal_owner()"
            triggers[f"{t}.trg_{t}_touch"] = f"CREATE TRIGGER trg_{t}_touch BEFORE UPDATE ON public.{t} FOR EACH ROW EXECUTE FUNCTION public.touch_personal_updated_at()"
        return True
    return False

do_blocks = []
in_guarded_do = False


def process(stmt):
    s = stmt.strip()
    head = re.sub(r"\s+", " ", s[:60]).upper()
    if head.startswith("CREATE TABLE") or head.startswith("CREATE UNLOGGED TABLE"):
        do_create_table(s)
    elif head.startswith("ALTER TABLE"):
        do_alter_table(s)
    elif re.match(r"CREATE (UNIQUE )?INDEX", head):
        do_create_index(s)
    elif re.match(r"CREATE (OR REPLACE )?FUNCTION", head):
        do_function(s)
    elif re.match(r"CREATE (OR REPLACE )?(CONSTRAINT )?TRIGGER", head):
        do_trigger(s)
    elif head.startswith("CREATE POLICY"):
        do_policy(s)
    elif head.startswith("CREATE TYPE") or head.startswith("ALTER TYPE"):
        do_type(s)
    elif head.startswith("DROP "):
        do_drop(s)
    elif head.startswith("DO "):
        handle_do_block(s)
    elif re.match(r"(INSERT|UPDATE|DELETE|SELECT|GRANT|REVOKE|COMMENT|ALTER PUBLICATION|ALTER FUNCTION|ALTER POLICY|CREATE EXTENSION|ALTER DEFAULT|NOTIFY|SET |CREATE SCHEMA|ALTER DATABASE|CREATE OR REPLACE VIEW|CREATE VIEW|BEGIN|COMMIT|ANALYZE|REFRESH|CREATE SEQUENCE|ALTER SEQUENCE)", head):
        data_statements.append(s)
    else:
        unhandled.append(("?", s[:150]))


data_statements = []


def main():
    files = sorted(f for f in os.listdir(MIG) if f.endswith(".sql"))
    for f in files:
        with open(os.path.join(MIG, f), encoding="utf-8") as fh:
            sql = fh.read()
        for st in split_statements(sql):
            try:
                process(st)
            except Exception as e:  # noqa: BLE001
                unhandled.append(("ERRO", f"{f}: {e}"))
    os.makedirs(OUT, exist_ok=True)
    model = {
        "tables": tables,
        "enums": enums,
        "indexes": indexes,
        "rls": rls,
        "functions": functions,
        "triggers": triggers,
        "policies": policies,
        "do_blocks": do_blocks,
        "data_statements": data_statements,
        "unhandled": unhandled,
    }
    with open(os.path.join(OUT, "pg_model.json"), "w", encoding="utf-8") as fh:
        json.dump(model, fh, ensure_ascii=False, indent=1)
    print(
        f"tabelas={len(tables)} enums={len(enums)} indices={len(indexes)} funcoes={len(functions)} "
        f"gatilhos={len(triggers)} politicas={len(policies)} blocos_DO={len(do_blocks)} "
        f"dados={len(data_statements)} pendencias={len(unhandled)}"
    )


if __name__ == "__main__":
    main()
