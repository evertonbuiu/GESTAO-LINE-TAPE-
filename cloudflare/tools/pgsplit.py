"""Divide arquivos SQL do PostgreSQL em comandos individuais.

Respeita strings ('...'), identificadores ("..."), comentários (-- e /* */)
e blocos com dollar-quote ($$ ... $$ / $tag$ ... $tag$), que são usados nas
funções PL/pgSQL das migrações do Supabase.
"""
import re

_DOLLAR = re.compile(r"\$([A-Za-z_][A-Za-z_0-9]*)?\$")


def strip_comments(sql: str) -> str:
    out = []
    i, n = 0, len(sql)
    while i < n:
        c = sql[i]
        if c == "-" and sql.startswith("--", i):
            j = sql.find("\n", i)
            i = n if j < 0 else j
            continue
        if c == "/" and sql.startswith("/*", i):
            j = sql.find("*/", i + 2)
            i = n if j < 0 else j + 2
            out.append(" ")
            continue
        if c == "'":
            j = i + 1
            while j < n:
                if sql[j] == "'" and j + 1 < n and sql[j + 1] == "'":
                    j += 2
                    continue
                if sql[j] == "'":
                    break
                j += 1
            out.append(sql[i : j + 1])
            i = j + 1
            continue
        if c == '"':
            j = sql.find('"', i + 1)
            j = n - 1 if j < 0 else j
            out.append(sql[i : j + 1])
            i = j + 1
            continue
        if c == "$":
            m = _DOLLAR.match(sql, i)
            if m:
                tag = m.group(0)
                j = sql.find(tag, m.end())
                j = n if j < 0 else j + len(tag)
                out.append(sql[i:j])
                i = j
                continue
        out.append(c)
        i += 1
    return "".join(out)


def split_statements(sql: str):
    sql = strip_comments(sql)
    stmts, buf = [], []
    i, n = 0, len(sql)
    depth = 0
    while i < n:
        c = sql[i]
        if c == "'":
            j = i + 1
            while j < n:
                if sql[j] == "'" and j + 1 < n and sql[j + 1] == "'":
                    j += 2
                    continue
                if sql[j] == "'":
                    break
                j += 1
            buf.append(sql[i : j + 1])
            i = j + 1
            continue
        if c == '"':
            j = sql.find('"', i + 1)
            j = n - 1 if j < 0 else j
            buf.append(sql[i : j + 1])
            i = j + 1
            continue
        if c == "$":
            m = _DOLLAR.match(sql, i)
            if m:
                tag = m.group(0)
                j = sql.find(tag, m.end())
                j = n if j < 0 else j + len(tag)
                buf.append(sql[i:j])
                i = j
                continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth = max(0, depth - 1)
        if c == ";" and depth == 0:
            s = "".join(buf).strip()
            if s:
                stmts.append(s)
            buf = []
            i += 1
            continue
        buf.append(c)
        i += 1
    s = "".join(buf).strip()
    if s:
        stmts.append(s)
    return stmts


def split_top_level(s: str, sep: str = ","):
    """Divide por vírgula no nível 0 de parênteses (fora de strings)."""
    parts, buf, depth = [], [], 0
    i, n = 0, len(s)
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
            buf.append(s[i : j + 1])
            i = j + 1
            continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        if c == sep and depth == 0:
            parts.append("".join(buf).strip())
            buf = []
            i += 1
            continue
        buf.append(c)
        i += 1
    if "".join(buf).strip():
        parts.append("".join(buf).strip())
    return parts
