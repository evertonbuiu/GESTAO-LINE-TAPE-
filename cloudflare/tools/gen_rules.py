"""Gera as regras automáticas (gatilhos) do D1 e os ganchos do Worker.

Entrada : cloudflare/build/pg_model.json            (gatilhos das migrações)
          cloudflare/rules/active_triggers.json      (opcional: lista real do
                                                       banco atual; quando existe,
                                                       só esses gatilhos são criados)
          cloudflare/rules/functions.py              (tradução de cada função)
Saídas  : cloudflare/worker/migrations/0002_rules.sql
          cloudflare/worker/src/generated/hooks.js
          cloudflare/build/rules_report.txt
"""
import json
import os
import re
import sqlite3
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "cloudflare", "rules"))
from functions import FUNCS, WORKER, WORKER_UPDATED_AT_TOO  # noqa: E402

MODEL = json.load(open(os.path.join(ROOT, "cloudflare", "build", "pg_model.json"), encoding="utf-8"))
SCHEMA_SQL = os.path.join(ROOT, "cloudflare", "worker", "migrations", "0001_schema.sql")
OUT_SQL = os.path.join(ROOT, "cloudflare", "worker", "migrations", "0002_rules.sql")
OUT_JS = os.path.join(ROOT, "cloudflare", "worker", "src", "generated", "hooks.js")
REPORT = os.path.join(ROOT, "cloudflare", "build", "rules_report.txt")
ACTIVE = os.path.join(ROOT, "cloudflare", "rules", "active_triggers.json")

UID = "(SELECT v FROM _ctx WHERE k = 'uid')"
NOW = "strftime('%Y-%m-%dT%H:%M:%f+00:00','now')"
UNAME = f"(SELECT name FROM user_credentials WHERE id = {UID})"

report = []


def col_kind(pgtype):
    t = pgtype.lower()
    if t.endswith("[]"):
        return "json"
    if "json" in t:
        return "json"
    if "bool" in t:
        return "bool"
    return "plain"


def json_of(table, ref):
    # O D1 aceita no máximo 32 argumentos por função: o objeto é montado em
    # partes (json_object com até 15 colunas + json_insert encadeados).
    cols = MODEL["tables"][table]["columns"]
    pairs = []
    for c, info in cols.items():
        k = col_kind(info["type"])
        v = f'{ref}."{c}"'
        if k == "json":
            v = f"json({v})"
        elif k == "bool":
            v = f"CASE WHEN {v} IS NULL THEN NULL WHEN {v} THEN json('true') ELSE json('false') END"
        pairs.append((c, v))
    head, rest = pairs[:15], pairs[15:]
    expr = "json_object(" + ", ".join(f"'{c}', {v}" for c, v in head) + ")"
    while rest:
        chunk, rest = rest[:15], rest[15:]
        expr = "json_insert(" + expr + ", " + ", ".join(f"'$.{c}', {v}" for c, v in chunk) + ")"
    return expr


def jsonb_key_order(cols):
    # jsonb ordena chaves por tamanho e depois alfabeticamente
    return sorted(cols, key=lambda c: (len(c.encode()), c))


def changed_of(table):
    # Lista JSON das colunas alteradas, montada por concatenação (sem UNION
    # e sem funções com muitos argumentos, por causa dos limites do D1).
    cols = jsonb_key_order(MODEL["tables"][table]["columns"].keys())
    parts = " || ".join(f"CASE WHEN NEW.\"{c}\" IS NOT OLD.\"{c}\" THEN '\"{c}\",' ELSE '' END" for c in cols)
    return f"('[' || rtrim({parts}, ',') || ']')"


def any_changed(table):
    cols = MODEL["tables"][table]["columns"].keys()
    return "(" + " OR ".join(f'NEW."{c}" IS NOT OLD."{c}"' for c in cols) + ")"


def expand(sql, table):
    out = sql
    if "{NEWJSON}" in out:
        out = out.replace("{NEWJSON}", json_of(table, "NEW"))
    if "{OLDJSON}" in out:
        out = out.replace("{OLDJSON}", json_of(table, "OLD"))
    if "{CHANGED}" in out:
        out = out.replace("{CHANGED}", changed_of(table))
    if "{ANY_CHANGED}" in out:
        out = out.replace("{ANY_CHANGED}", any_changed(table))
    return out.replace("{UNAME}", UNAME).replace("{UID}", UID).replace("{NOW}", NOW).replace("{T}", table)


def parse_trigger(stmt):
    s = re.sub(r"\s+", " ", stmt)
    m = re.search(
        r"TRIGGER (\S+) (BEFORE|AFTER|INSTEAD OF) (.*?) ON (\S+) (.*?)EXECUTE (?:FUNCTION|PROCEDURE) (?:public\.)?(\w+)",
        s,
        re.I,
    )
    name = m.group(1).strip('"')
    timing = m.group(2).upper()
    events_txt = m.group(3)
    table = m.group(4).replace("public.", "").strip('"')
    fn = m.group(6)
    events = {}
    for part in re.split(r"\s+OR\s+", events_txt, flags=re.I):
        part = part.strip()
        mm = re.match(r"UPDATE OF (.*)", part, re.I)
        if mm:
            events["UPDATE"] = [c.strip().strip('"') for c in mm.group(1).split(",")]
        else:
            events[part.upper()] = None
    return {"name": name, "timing": timing, "events": events, "table": table, "fn": fn, "per_row": "FOR EACH ROW" in s.upper()}


def load_triggers():
    trigs = []
    for key, stmt in MODEL["triggers"].items():
        t = parse_trigger(stmt)
        if key.startswith("auth."):
            t["table"] = "auth.users"
        trigs.append(t)
    if os.path.exists(ACTIVE):
        active = json.load(open(ACTIVE, encoding="utf-8"))
        names = {(a["tabela"], a["nome"]) for a in active}
        before = len(trigs)
        trigs = [t for t in trigs if (t["table"].replace("auth.", ""), t["name"]) in names or (t["table"], t["name"]) in names]
        report.append(f"lista real do banco aplicada: {len(trigs)} de {before} gatilhos das migrações estão ativos")
        known = {(t["table"].replace("auth.", ""), t["name"]) for t in trigs}
        for a in active:
            if (a["tabela"], a["nome"]) not in known and a["tabela"] in MODEL["tables"]:
                report.append(f"ATENÇÃO: gatilho existe no banco real mas não nas migrações: {a['tabela']}.{a['nome']}")
    return trigs


def check_d1_limits(sql):
    """Limites do D1: até 32 argumentos por função e sem SELECT compostos longos."""
    for m in re.finditer(r"\b(\w+)\(", sql):
        i = m.end()
        depth, n, j = 1, 1, i
        if sql[i] == ")":
            continue
        while depth:
            ch = sql[j]
            if ch == "'":
                j = sql.index("'", j + 1)
            elif ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            elif ch == "," and depth == 1:
                n += 1
            j += 1
        if n > 32 and m.group(1).lower() not in ("in", "values", "insert", "into"):
            raise SystemExit(f"função {m.group(1)} com {n} argumentos (D1 aceita até 32)")


def main():
    trigs = load_triggers()
    hooks = {}
    post_sync = set()
    ddl = [
        "-- Regras automáticas geradas por cloudflare/tools/gen_rules.py a partir",
        "-- das funções de gatilho do PostgreSQL (ver cloudflare/rules/functions.py).",
        "-- Não edite à mão.",
        "",
    ]
    # Ordem: o PostgreSQL dispara gatilhos do mesmo momento em ordem alfabética;
    # o SQLite dispara primeiro o criado por último. Por isso criamos em ordem
    # alfabética inversa.
    trigs.sort(key=lambda t: (t["table"], t["name"]), reverse=True)
    # No PostgreSQL o nome do gatilho vale por tabela; no SQLite, para o banco
    # todo. Nomes repetidos em tabelas diferentes ganham o nome da tabela.
    seen = {}
    for t in trigs:
        seen.setdefault(t["name"], set()).add(t["table"])
    for t in trigs:
        t["sqlname"] = f'{t["table"]}__{t["name"]}' if len(seen[t["name"]]) > 1 else t["name"]
    missing = set()
    for t in trigs:
        if not t["per_row"]:
            report.append(f"gatilho por comando ignorado: {t['table']}.{t['name']}")
            continue
        spec = FUNCS.get(t["fn"])
        if spec is None:
            missing.add(t["fn"])
            continue
        if t["fn"] in WORKER_UPDATED_AT_TOO:
            hooks.setdefault(t["table"], {})["updatedAt"] = True
        if spec == WORKER:
            h = hooks.setdefault(t["table"], {})
            if t["fn"] in ("update_updated_at_column", "touch_personal_updated_at", "update_whatsapp_expenses_updated_at", "update_bank_card_transactions_updated_at"):
                h["updatedAt"] = True
            elif t["fn"] == "force_personal_owner":
                h["personalOwner"] = True
            elif t["fn"] == "force_closing_actor":
                h["closingActor"] = True
            elif t["fn"] == "force_reconciliation_actor":
                h["reconciliationActor"] = True
            elif t["fn"].startswith("auto_sync") or t["fn"].startswith("sync_transactions_on"):
                post_sync.add(t["table"])
            elif t["fn"] == "handle_new_user":
                report.append("gatilho on_auth_user_created (auth.users) não reproduzido: no banco atual ele falharia "
                              "(user_roles.user_id exige user_credentials) e a criação de usuários já é feita pela função create-employee")
            continue
        if t["table"] == "contracts" and t["fn"] == "enforce_signed_contract_immutability":
            hooks.setdefault("contracts", {})["contractSign"] = True
        if t["fn"] == "force_reconciliation_actor":
            hooks.setdefault(t["table"], {})["reconciliationActor"] = True
        for op, cols in t["events"].items():
            body = spec.get(op)
            if body is None:
                report.append(f"{t['table']}.{t['name']}: função {t['fn']} não trata {op}")
                continue
            when = None
            if isinstance(body, dict):
                when = body.get("when")
                body = body["do"]
            of = f" OF {', '.join(chr(34) + c + chr(34) for c in cols)}" if cols else ""
            when_sql = f" WHEN {expand(when, t['table'])}" if when else ""
            stmts = ";\n  ".join(expand(s, t["table"]) for s in body)
            ddl.append(
                f'CREATE TRIGGER IF NOT EXISTS "{t["sqlname"]}__{op.lower()}" {t["timing"]} {op}{of} ON "{t["table"]}" '
                f"FOR EACH ROW{when_sql}\nBEGIN\n  {stmts};\nEND;"
            )
    if missing:
        raise SystemExit("funções sem tradução: " + ", ".join(sorted(missing)))

    sql = "\n".join(ddl) + "\n"
    check_d1_limits(sql)
    db = sqlite3.connect(":memory:")
    db.executescript(open(SCHEMA_SQL, encoding="utf-8").read())
    db.executescript(sql)
    n = db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name NOT LIKE '\\_rt\\_%' ESCAPE '\\'").fetchone()[0]
    open(OUT_SQL, "w", encoding="utf-8").write(sql)
    js = "// Gerado por cloudflare/tools/gen_rules.py — não edite à mão.\n"
    js += "export const HOOKS = " + json.dumps(hooks, indent=1, sort_keys=True) + ";\n"
    js += "export const POST_SYNC_TABLES = " + json.dumps(sorted(post_sync)) + ";\n"
    open(OUT_JS, "w", encoding="utf-8").write(js)
    open(REPORT, "w", encoding="utf-8").write("\n".join(report) + "\n")
    print(f"ok: {n} gatilhos SQLite; ganchos do Worker em {len(hooks)} tabelas; sincronização após gravar: {sorted(post_sync)}")
    for r in report:
        print("  -", r)


if __name__ == "__main__":
    main()
