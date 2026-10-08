"""Converte as políticas de acesso (RLS) do PostgreSQL em regras para o Worker.

Cada política vira um objeto { cmd, roles, using, check } em que using/check
são expressões simples:
  true / false
  {"anyRole": [...]}           -> usuário tem um dos papéis
  {"auth": true}               -> usuário logado
  {"owner": "coluna"}          -> coluna = usuário logado (filtro por linha)
  {"perm": [nome, tipo]}       -> has_permission(...)
  {"sql": "...", "uid": n}     -> filtro SQL por linha ($T = tabela, ? = usuário)
  {"and": [...]} / {"or": [...]}
Saída: cloudflare/worker/src/generated/policies.js
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pgsplit import split_top_level  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODEL = json.load(open(os.path.join(ROOT, "cloudflare", "build", "pg_model.json"), encoding="utf-8"))
OUT = os.path.join(ROOT, "cloudflare", "worker", "src", "generated", "policies.js")

# Políticas antigas "acesso público total" que continuaram no banco por
# esquecimento, mesmo depois das políticas restritas (uc_*, ur_*) serem
# criadas. Elas deixariam qualquer pessoa sem login ler/alterar usuários e
# papéis; na cópia elas NÃO são reproduzidas.
INSECURE = {
    "user_credentials.Allow public access to user_credentials",
    "user_roles.Allow public access to user_roles",
}

UID = "auth.uid()"


def strip_parens(e):
    e = e.strip()
    while e.startswith("(") and e.endswith(")"):
        depth = 0
        ok = True
        for i, c in enumerate(e):
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0 and i != len(e) - 1:
                    ok = False
                    break
        if not ok:
            break
        e = e[1:-1].strip()
    return e


def split_bool(e, op):
    """Divide por AND/OR no nível 0 de parênteses."""
    parts, buf, depth, i = [], "", 0, 0
    pat = re.compile(rf"\s+{op}\s+", re.I)
    while i < len(e):
        c = e[i]
        if c == "'":
            j = e.index("'", i + 1)
            buf += e[i : j + 1]
            i = j + 1
            continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        if depth == 0:
            m = pat.match(e, i)
            if m:
                parts.append(buf)
                buf = ""
                i = m.end()
                continue
        buf += c
        i += 1
    parts.append(buf)
    return [p.strip() for p in parts if p.strip()]


def roles_list(s):
    return re.findall(r"'([a-z_]+)'", s)


def compile_expr(e, table):
    e = strip_parens(re.sub(r"\s+", " ", e.strip()))
    ors = split_bool(e, "OR")
    if len(ors) > 1:
        return {"or": [compile_expr(x, table) for x in ors]}
    ands = split_bool(e, "AND")
    if len(ands) > 1:
        return {"and": [compile_expr(x, table) for x in ands]}
    low = e.lower()
    if low == "true":
        return True
    if low == "false":
        return False
    m = re.fullmatch(r"(?:public\.)?current_user_has_any_role\(\s*ARRAY\s*\[(.*)\]\s*(?:::\w+\[\])?\)", e, re.I)
    if m:
        return {"anyRole": roles_list(m.group(1))}
    m = re.fullmatch(r"(?:public\.)?current_user_has_role\(\s*'(\w+)'(?:::\w+)?\s*\)", e, re.I)
    if m:
        return {"anyRole": [m.group(1)]}
    m = re.fullmatch(r"(?:public\.)?has_role\(\s*auth\.uid\(\)\s*,\s*'(\w+)'(?:::\w+)?\s*\)", e, re.I)
    if m:
        return {"anyRole": [m.group(1)]}
    if re.fullmatch(r"(?:public\.)?is_current_user_admin\(\)", e, re.I):
        return {"anyRole": ["admin"]}
    if re.fullmatch(r"auth\.uid\(\) IS NOT NULL", e, re.I):
        return {"auth": True}
    if re.fullmatch(r"auth\.role\(\) = 'authenticated'(::text)?", e, re.I):
        return {"auth": True}
    m = re.fullmatch(r"(\w+) = auth\.uid\(\)", e, re.I) or re.fullmatch(r"auth\.uid\(\) = (\w+)", e, re.I)
    if m:
        return {"owner": m.group(1)}
    m = re.fullmatch(r"(?:public\.)?has_permission\(\s*auth\.uid\(\)\s*,\s*'(\w+)'\s*,\s*'(\w+)'\s*\)", e, re.I)
    if m:
        return {"perm": [m.group(1), m.group(2)]}
    m = re.fullmatch(
        r"EXISTS \( SELECT 1 FROM public\.user_roles ur WHERE ur\.user_id = auth\.uid\(\) AND ur\.role IN \((.*)\) \)",
        e,
        re.I,
    )
    if m:
        return {"anyRole": roles_list(m.group(1))}
    m = re.fullmatch(r"EXISTS \( SELECT 1 FROM public\.(\w+) (\w+) WHERE (.*) \)", e, re.I)
    if m:
        sub_t, alias, cond = m.group(1), m.group(2), m.group(3)
        cond = re.sub(rf"\b{table}\.", "$T.", cond)
        n = cond.count(UID)
        cond = cond.replace(UID, "?")
        return {"sql": f'EXISTS (SELECT 1 FROM "{sub_t}" {alias} WHERE {cond})', "uid": n}
    raise ValueError(f"expressão de política não reconhecida em {table}: {e}")


def balanced(s, i):
    """Conteúdo do parêntese que abre em s[i]."""
    depth = 0
    j = i
    while j < len(s):
        c = s[j]
        if c == "'":
            j = s.index("'", j + 1) + 1
            continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return s[i + 1 : j]
        j += 1
    raise ValueError("parêntese sem fechamento")


def parse_policy(table, stmt):
    s = re.sub(r"\s+", " ", stmt)
    restrictive = bool(re.search(r"\bAS RESTRICTIVE\b", s, re.I))
    m = re.search(r"\bFOR (ALL|SELECT|INSERT|UPDATE|DELETE)\b", s, re.I)
    cmd = m.group(1).upper() if m else "ALL"
    m = re.search(r"\bTO ([a-z_, ]+?) (USING|WITH CHECK)", s + " USING", re.I)
    roles = [r.strip().lower() for r in m.group(1).split(",")] if m else ["public"]
    using = check = None
    mu = re.search(r"\bUSING \(", s, re.I)
    if mu:
        using = compile_expr(balanced(s, mu.end() - 1), table)
    mc = re.search(r"\bWITH CHECK \(", s, re.I)
    if mc:
        check = compile_expr(balanced(s, mc.end() - 1), table)
    return {"cmd": cmd, "roles": roles, "using": using, "check": check, "restrictive": restrictive}


def main():
    out = {}
    errors = []
    for key, stmt in MODEL["policies"].items():
        parts = key.split(".")
        if len(parts) != 2:
            continue
        table, name = parts
        if table not in MODEL["tables"] or key in INSECURE:
            continue
        try:
            p = parse_policy(table, stmt)
            p["name"] = name
            out.setdefault(table, []).append(p)
        except Exception as e:  # noqa: BLE001
            errors.append(str(e))
    rls = {t: bool(MODEL["rls"].get(t)) for t in MODEL["tables"]}
    js = "// Gerado por cloudflare/tools/gen_policies.py — não edite à mão.\n"
    js += "export const RLS = " + json.dumps(rls) + ";\n"
    js += "export const POLICIES = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n"
    open(OUT, "w", encoding="utf-8").write(js)
    print(f"ok: {sum(len(v) for v in out.values())} políticas em {len(out)} tabelas; erros={len(errors)}")
    for e in errors:
        print("  -", e)


if __name__ == "__main__":
    main()
