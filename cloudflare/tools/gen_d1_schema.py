"""Gera o esquema do Cloudflare D1 (SQLite) a partir do modelo PostgreSQL.

Entrada : cloudflare/build/pg_model.json (replay_migrations.py)
          src/integrations/supabase/types.ts (colunas criadas fora das migrações)
Saídas  : cloudflare/worker/migrations/0001_schema.sql   (tabelas, índices)
          cloudflare/worker/src/generated/schema.js       (metadados p/ a API)
          cloudflare/build/schema_report.txt              (o que precisou adaptar)
"""
import json
import os
import re
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pgsplit import split_top_level  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODEL = json.load(open(os.path.join(ROOT, "cloudflare", "build", "pg_model.json"), encoding="utf-8"))
OUT_SQL = os.path.join(ROOT, "cloudflare", "worker", "migrations", "0001_schema.sql")
OUT_JS = os.path.join(ROOT, "cloudflare", "worker", "src", "generated", "schema.js")
REPORT = os.path.join(ROOT, "cloudflare", "build", "schema_report.txt")

report = []

UUID_SQL = (
    "(lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||"
    "substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',1+(abs(random())%4),1)||"
    "substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))"
)
NOW_SQL = "(strftime('%Y-%m-%dT%H:%M:%f+00:00','now'))"
TODAY_SQL = "(date('now'))"
TODAY_BR_SQL = "(date('now','-3 hours'))"


EXTRA_RELATIONS = {
    "recurring_expense_monthly_payments": [
        {"name": "recurring_expense_monthly_payments_recurring_expense_id_fkey",
         "cols": ["recurring_expense_id"], "ref": "recurring_expenses", "refCols": ["id"]},
    ],
}


def kind_of(pgtype: str, enums) -> str:
    t = re.sub(r"\s+", " ", pgtype.strip().lower())
    if t.endswith("[]"):
        return "array"
    base = re.sub(r"\(.*\)", "", t).strip()
    base = base.replace("public.", "")
    if base in enums:
        return "enum:" + base
    if base == "uuid":
        return "uuid"
    if base in ("text", "varchar", "character varying", "char", "character", "citext", "inet", "name"):
        return "text"
    if base in ("integer", "int", "int4", "bigint", "int8", "smallint", "int2", "serial", "bigserial"):
        return "int"
    if base in ("numeric", "decimal", "real", "double precision", "float8", "float4", "money"):
        return "num"
    if base in ("boolean", "bool"):
        return "bool"
    if base in ("json", "jsonb"):
        return "json"
    if base == "date":
        return "date"
    if base.startswith("timestamp"):
        return "ts" if ("with time zone" in base or base == "timestamptz") else "tsl"
    if base.startswith("time"):
        return "time"
    if base == "interval":
        return "text"
    report.append(f"tipo desconhecido {pgtype!r} -> TEXT")
    return "text"


def scale_of(pgtype: str):
    m = re.search(r"\(\s*\d+\s*,\s*(\d+)\s*\)", pgtype)
    return int(m.group(1)) if m else None


AFFINITY = {"int": "INTEGER", "num": "REAL", "bool": "INTEGER"}


def strip_casts(expr: str) -> str:
    return re.sub(r"::\s*(?:public\.)?[a-z_ ]+(?:\[\])?(?:\(\d+(?:,\d+)?\))?", "", expr, flags=re.I)


def translate_default(expr, kind, table, col):
    if expr is None:
        return None
    e = re.sub(r"\s+", " ", expr.strip())
    low = e.lower()
    if low in ("null",):
        return None
    if low in ("gen_random_uuid()", "uuid_generate_v4()", "extensions.uuid_generate_v4()"):
        return UUID_SQL
    if low in ("now()", "current_timestamp", "timezone('utc'::text, now())", "timezone('utc', now())", "transaction_timestamp()", "statement_timestamp()", "clock_timestamp()"):
        return NOW_SQL if kind in ("ts", "tsl", "text") else (TODAY_SQL if kind == "date" else NOW_SQL)
    if low == "current_date":
        return TODAY_SQL
    if low.startswith("(now() at time zone 'america/sao_paulo')::date"):
        return TODAY_BR_SQL
    if low == "(now() + '7 days'::interval)":
        return "(strftime('%Y-%m-%dT%H:%M:%f+00:00','now','+7 days'))"
    if low == "__identity__":
        return None
    if low in ("true", "false"):
        return "1" if low == "true" else "0"
    e2 = strip_casts(e)
    if kind in ("json",) and e2 in ("'{}'", "'[]'"):
        return e2
    if kind == "array" and e2 in ("'{}'", "ARRAY[]", "array[]"):
        return "'[]'"
    if re.fullmatch(r"-?\d+(\.\d+)?", e2):
        return e2
    if re.fullmatch(r"'(?:[^']|'')*'", e2):
        return e2
    if re.fullmatch(r"\(?-?\d+(\.\d+)?\)?", e2):
        return e2.strip("()")
    report.append(f"padrão não traduzido {table}.{col}: {expr}")
    return None


def translate_check(expr: str) -> str:
    e = re.sub(r"\s+", " ", expr.strip())
    # col = ANY (ARRAY['a'::text, 'b'::text])  ->  col IN ('a','b')
    def any_repl(m):
        items = strip_casts(m.group(2))
        return f"{m.group(1)} IN ({items})"

    e = re.sub(r"(\(?[a-z_0-9\"]+\)?(?:::[a-z ]+)?)\s*=\s*ANY\s*\(\s*\(?\s*ARRAY\s*\[(.*?)\]\s*\)?(?:::[a-z\[\] ]+)?\s*\)", any_repl, e, flags=re.I)
    e = re.sub(r"(\(?[a-z_0-9\"]+\)?)\s*<>\s*ALL\s*\(\s*\(?\s*ARRAY\s*\[(.*?)\]\s*\)?(?:::[a-z\[\] ]+)?\s*\)", lambda m: f"{m.group(1)} NOT IN ({strip_casts(m.group(2))})", e, flags=re.I)
    e = strip_casts(e)
    e = re.sub(r"\btrue\b", "1", e, flags=re.I)
    e = re.sub(r"\bfalse\b", "0", e, flags=re.I)
    e = re.sub(r"\bchar_length\(", "length(", e, flags=re.I)
    e = re.sub(r"\bbtrim\(", "trim(", e, flags=re.I)
    e = re.sub(r"\bcardinality\(([^)]*)\)", r"json_array_length(\1)", e, flags=re.I)
    if re.search(r"(~|\bSIMILAR\b|\bnow\(\)|::|\bCURRENT_DATE\b|\binterval\b|jsonb_|array_length)", e, re.I):
        raise ValueError("expressão sem equivalente: " + e)
    return e


def q(name):
    return '"' + name.replace('"', '""') + '"'


def ts_extra_columns():
    """Colunas presentes em types.ts mas ausentes das migrações (criadas no painel)."""
    src = open(os.path.join(ROOT, "src", "integrations", "supabase", "types.ts"), encoding="utf-8").read()
    part = src[src.index("    Tables: {") : src.index("    Views: {")]
    out = {}
    for mm in re.finditer(r"\n      ([a-z_0-9]+): \{\n        Row: \{\n(.*?)\n        \}", part, re.S):
        cols = {}
        for line in mm.group(2).split("\n"):
            line = line.strip()
            if not line:
                continue
            name, ty = line.split(":", 1)
            ty = ty.strip()
            base = ty.replace(" | null", "").strip()
            pg = {"string": "text", "number": "numeric", "boolean": "boolean", "Json": "jsonb"}.get(base, "text")
            if base.endswith("[]"):
                pg = "text[]"
            cols[name.rstrip("?")] = {"type": pg, "notnull": "| null" not in ty}
        out[mm.group(1)] = cols
    return out


def main():
    enums = MODEL["enums"]
    tables = MODEL["tables"]
    extra = ts_extra_columns()
    for tname, cols in extra.items():
        if tname not in tables:
            report.append(f"tabela só existe em types.ts: {tname}")
            continue
        for c, info in cols.items():
            if c not in tables[tname]["columns"]:
                tables[tname]["columns"][c] = {"type": info["type"], "notnull": False, "default": None, "generated": None}
                report.append(f"coluna criada fora das migrações: {tname}.{c} ({info['type']})")

    ddl = [
        "-- Esquema gerado automaticamente por cloudflare/tools/gen_d1_schema.py",
        "-- a partir das migrações do Supabase. Não edite à mão.",
        "PRAGMA foreign_keys = ON;",
        "",
        "-- Usuários (substitui auth.users do Supabase)",
        "CREATE TABLE IF NOT EXISTS auth_users (",
        "  id TEXT PRIMARY KEY,",
        "  email TEXT NOT NULL UNIQUE,",
        "  password_hash TEXT NOT NULL,",
        "  raw_user_meta_data TEXT NOT NULL DEFAULT '{}',",
        "  banned INTEGER NOT NULL DEFAULT 0,",
        f"  created_at TEXT NOT NULL DEFAULT {NOW_SQL},",
        f"  updated_at TEXT NOT NULL DEFAULT {NOW_SQL},",
        "  last_sign_in_at TEXT",
        ");",
        "CREATE TABLE IF NOT EXISTS auth_refresh_tokens (",
        "  token TEXT PRIMARY KEY,",
        "  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,",
        f"  created_at TEXT NOT NULL DEFAULT {NOW_SQL},",
        "  expires_at TEXT NOT NULL,",
        "  revoked INTEGER NOT NULL DEFAULT 0",
        ");",
        "-- Contexto da requisição (usuário atual) lido pelas regras automáticas",
        "CREATE TABLE IF NOT EXISTS _ctx (k TEXT PRIMARY KEY, v TEXT);",
        "-- Controle de alterações para atualização automática das telas",
        "-- Sequências (antes: CREATE SEQUENCE no PostgreSQL)",
        "CREATE TABLE IF NOT EXISTS _sequences (name TEXT PRIMARY KEY, value INTEGER NOT NULL);",
        "CREATE TABLE IF NOT EXISTS _changes (tbl TEXT PRIMARY KEY, version INTEGER NOT NULL, changed_at TEXT NOT NULL);",
        "CREATE TABLE IF NOT EXISTS storage_objects (",
        "  bucket_id TEXT NOT NULL,",
        "  name TEXT NOT NULL,",
        "  content_type TEXT,",
        "  size INTEGER,",
        "  owner TEXT,",
        f"  created_at TEXT NOT NULL DEFAULT {NOW_SQL},",
        f"  updated_at TEXT NOT NULL DEFAULT {NOW_SQL},",
        "  PRIMARY KEY (bucket_id, name)",
        ");",
        "",
    ]
    meta = {}

    probe = sqlite3.connect(":memory:")
    for tname, t in tables.items():
        cols_sql = []
        cmeta = {}
        for cname, c in t["columns"].items():
            kind = kind_of(c["type"], enums)
            if c.get("generated"):
                report.append(f"coluna gerada {tname}.{cname} = {c['generated']} (calculada no Worker)")
            aff = AFFINITY.get(kind, "TEXT")
            parts = [q(cname), aff]
            is_pk_single = t["pk"] == [cname]
            identity = c.get("default") == "__identity__" or re.search(r"serial", c["type"], re.I) or (c.get("default") or "").lower().startswith("nextval(")
            if is_pk_single and kind == "int" and identity:
                parts = [q(cname), "INTEGER PRIMARY KEY AUTOINCREMENT"]
            else:
                if c["notnull"] or cname in t["pk"]:
                    parts.append("NOT NULL")
                d = translate_default(c.get("default"), kind, tname, cname)
                if d is not None:
                    parts.append(f"DEFAULT {d}")
                if is_pk_single:
                    parts.append("PRIMARY KEY")
            if kind.startswith("enum:"):
                vals = ",".join("'" + v + "'" for v in enums[kind[5:]])
                parts.append(f"CHECK ({q(cname)} IS NULL OR {q(cname)} IN ({vals}))")
            cols_sql.append("  " + " ".join(parts))
            cm = {"t": kind.split(":")[0] if not kind.startswith("enum") else "text"}
            if c["notnull"]:
                cm["nn"] = 1
            if c.get("default") is not None or identity:
                cm["d"] = 1
            sc = scale_of(c["type"])
            if kind == "num" and sc is not None:
                cm["s"] = sc
            if kind == "array":
                cm["et"] = kind_of(c["type"][:-2], enums)
            if c.get("generated"):
                cm["g"] = c["generated"]
            cmeta[cname] = cm
        if len(t["pk"]) > 1:
            cols_sql.append(f"  PRIMARY KEY ({', '.join(q(c) for c in t['pk'])})")
        fks = []
        for cnm, k in t["constraints"].items():
            if k["kind"] == "unique":
                cols_sql.append(f"  CONSTRAINT {q(cnm)} UNIQUE ({', '.join(q(c) for c in k['cols'])})")
            elif k["kind"] == "fk":
                ref = k["ref_table"]
                if k["ref_schema"] == "auth" and ref == "users":
                    ref = "auth_users"
                elif k["ref_schema"] != "public":
                    report.append(f"FK para esquema externo ignorada: {tname}.{k['cols']} -> {k['ref_schema']}.{ref}")
                    continue
                elif ref not in tables:
                    report.append(f"FK para tabela inexistente ignorada: {tname} -> {ref}")
                    continue
                od = f" ON DELETE {k['on_delete']}" if k.get("on_delete") else ""
                cols_sql.append(
                    f"  CONSTRAINT {q(cnm)} FOREIGN KEY ({', '.join(q(c) for c in k['cols'])}) REFERENCES {q(ref)} ({', '.join(q(c) for c in k['ref_cols'])}){od}"
                )
                fks.append({"name": cnm, "cols": k["cols"], "ref": ref, "refCols": k["ref_cols"]})
            elif k["kind"] == "check":
                try:
                    ex = translate_check(k["expr"])
                    probe.execute(f"SELECT CASE WHEN ({ex}) THEN 1 END FROM (SELECT {', '.join('NULL AS ' + q(c) for c in t['columns'])})")
                    cols_sql.append(f"  CONSTRAINT {q(cnm)} CHECK ({ex})")
                except Exception as e:  # noqa: BLE001
                    report.append(f"CHECK verificado no Worker (sem equivalente SQLite) {tname}.{cnm}: {k['expr']} [{e}]")
                    meta.setdefault("__checks", []).append({"table": tname, "name": cnm, "expr": k["expr"]})
            elif k["kind"] == "exclude":
                report.append(f"EXCLUDE ignorada {tname}.{cnm}: {k['expr']}")
        ddl.append(f"CREATE TABLE IF NOT EXISTS {q(tname)} (")
        ddl.append(",\n".join(cols_sql))
        ddl.append(");")
        ddl.append("")
        # Relações que as telas usam mas que o banco original não declarou:
        # entram só no mapa de relações (sem restrição no banco).
        for extra in EXTRA_RELATIONS.get(tname, []):
            if not any(f["cols"] == extra["cols"] for f in fks):
                fks.append(extra)
        meta[tname] = {"pk": t["pk"], "cols": cmeta, "fks": fks}

    # índices
    for iname, ix in MODEL["indexes"].items():
        if ix["table"] not in tables:
            continue
        if ix["method"] not in ("btree",):
            report.append(f"índice {ix['method']} ignorado: {iname}")
            continue
        exprs = []
        ok = True
        for e in ix["exprs"]:
            e2 = strip_casts(re.sub(r"\s+(ASC|DESC|NULLS\s+(FIRST|LAST))\b", "", e, flags=re.I)).strip()
            e2 = re.sub(r"\bbtrim\(", "trim(", e2, flags=re.I)
            if re.fullmatch(r'"?[a-z_0-9]+"?', e2, re.I):
                exprs.append(q(e2.strip('"')))
            elif re.fullmatch(r"(lower|upper|trim)\(\s*\"?[a-z_0-9]+\"?\s*\)", e2, re.I):
                exprs.append(e2)
            else:
                ok = False
        where = ""
        if ix.get("where"):
            try:
                where = " WHERE " + translate_check(ix["where"])
            except Exception:  # noqa: BLE001
                ok = False
        if not ok:
            report.append(f"índice não traduzido {iname}: {ix['exprs']} where={ix.get('where')}")
            continue
        u = "UNIQUE " if ix["unique"] else ""
        ddl.append(f"CREATE {u}INDEX IF NOT EXISTS {q(iname)} ON {q(ix['table'])} ({', '.join(exprs)}){where};")
        if ix["unique"]:
            meta[ix["table"]].setdefault("uniques", []).append([e.strip('"') for e in exprs])

    for tname, t in tables.items():
        for k in t["constraints"].values():
            if k["kind"] == "unique":
                meta[tname].setdefault("uniques", []).append(k["cols"])
        if t["pk"]:
            meta[tname].setdefault("uniques", []).insert(0, t["pk"])

    ddl.append("")
    ddl.append("-- Registro de alterações por tabela (substitui o Supabase Realtime)")
    for tname in tables:
        for ev in ("INSERT", "UPDATE", "DELETE"):
            ddl.append(
                f"CREATE TRIGGER IF NOT EXISTS {q('_rt_' + tname + '_' + ev.lower())} AFTER {ev} ON {q(tname)} "
                f"BEGIN INSERT INTO _changes (tbl, version, changed_at) VALUES ('{tname}', "
                f"(SELECT COALESCE(MAX(version), 0) + 1 FROM _changes), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')) "
                f"ON CONFLICT (tbl) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at; END;"
            )
    sql = "\n".join(ddl) + "\n"
    # valida no SQLite real
    db = sqlite3.connect(":memory:")
    db.executescript(sql)
    n = db.execute("select count(*) from sqlite_master where type='table'").fetchone()[0]

    os.makedirs(os.path.dirname(OUT_SQL), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    open(OUT_SQL, "w", encoding="utf-8").write(sql)
    js = "// Gerado por cloudflare/tools/gen_d1_schema.py — não edite à mão.\n"
    js += "export const ENUMS = " + json.dumps(enums, ensure_ascii=False) + ";\n"
    checks = meta.pop("__checks", [])
    js += "export const SOFT_CHECKS = " + json.dumps(checks, ensure_ascii=False) + ";\n"
    js += "export const SCHEMA = " + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ";\n"
    open(OUT_JS, "w", encoding="utf-8").write(js)
    open(REPORT, "w", encoding="utf-8").write("\n".join(report) + "\n")
    print(f"ok: {n} tabelas criadas no SQLite; {len(report)} observações em schema_report.txt")


if __name__ == "__main__":
    main()
