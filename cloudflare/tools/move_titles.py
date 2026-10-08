"""Remove o título próprio de cada tela e leva os botões para o cabeçalho padrão.

Para cada tela, a partir da linha do <h1>/<h2> do título:
  - apaga o bloco do título (o <div> que contém o título e a descrição);
  - o <div> que envolvia título + botões vira <PageActions> (botões vão
    para o cabeçalho padrão da página); se só tinha o título, é removido.
Uso: python3 move_titles.py arquivo.tsx "Texto do título" [arquivo "título" ...]
"""
import re
import sys

OPEN = re.compile(r"<div\b")
CLOSE = re.compile(r"</div\s*>")


def tag_end(s, i):
    """Fim da tag que começa em s[i] (respeita {...} e strings)."""
    depth = 0
    j = i
    quote = None
    while j < len(s):
        c = s[j]
        if quote:
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif c == ">" and depth == 0:
            return j + 1
        j += 1
    raise ValueError("tag sem fim")


def find_open_before(s, pos):
    """<div ...> que contém pos (o mais interno)."""
    stack = []
    i = 0
    while i < pos:
        mo = OPEN.search(s, i)
        mc = CLOSE.search(s, i)
        nxt = min([m for m in (mo, mc) if m and m.start() < pos], key=lambda m: m.start(), default=None)
        if not nxt:
            break
        if nxt is mo:
            end = tag_end(s, mo.start())
            if s[end - 2] != "/":
                stack.append(mo.start())
            i = end
        else:
            stack.pop()
            i = mc.end()
    return stack


def matching_close(s, open_start):
    i = tag_end(s, open_start)
    depth = 1
    while True:
        mo = OPEN.search(s, i)
        mc = CLOSE.search(s, i)
        if mo and mo.start() < mc.start():
            end = tag_end(s, mo.start())
            if s[end - 2] != "/":
                depth += 1
            i = end
        else:
            depth -= 1
            if depth == 0:
                return mc.start(), mc.end()
            i = mc.end()


def process(path, title):
    s = open(path, encoding="utf-8").read()
    m = re.search(r"<h[12][^>]*>\s*(?:\{[^}]*\}\s*)?(?:<[A-Za-z][^>]*/>\s*)*" + re.escape(title), s)
    if not m:
        m = re.search(r"<h[12][^>]*>[^<]*" + re.escape(title), s)
    if not m:
        raise SystemExit(f"{path}: título '{title}' não encontrado")
    stack = find_open_before(s, m.start())
    if len(stack) < 2:
        raise SystemExit(f"{path}: estrutura inesperada")
    title_div = stack[-1]
    container = stack[-2]
    t_close_start, t_close_end = matching_close(s, title_div)
    c_close_start, c_close_end = matching_close(s, container)
    # o que sobra no container além do bloco do título?
    c_open_end = tag_end(s, container)
    rest = (s[c_open_end:title_div] + s[t_close_end:c_close_start]).strip()
    # bloco do título começa no início da linha
    line_start = s.rfind("\n", 0, title_div) + 1
    t_end_line = s.find("\n", t_close_end)
    container_tag = s[container:c_open_end]
    is_header_row = "justify-between" in container_tag or "justify-end" in container_tag
    if rest and not is_header_row:
        # o título estava solto no topo da página: só apaga o bloco do título
        t_line_start = s.rfind("\n", 0, title_div) + 1
        new = s[:t_line_start] + s[t_end_line + 1 :]
        open(path, "w", encoding="utf-8").write(new)
        print(f"ok {path}: título removido")
        return
    if rest:
        new = (
            s[:container]
            + "<PageActions>"
            + s[c_open_end:line_start]
            + s[t_end_line + 1 : c_close_start]
            + "</PageActions>"
            + s[c_close_end:]
        )
    else:
        cl_start = s.rfind("\n", 0, container) + 1
        cl_end = s.find("\n", c_close_end)
        new = s[:cl_start] + s[cl_end + 1 :]
    if rest and "PageActions" not in s:
        # import logo após o último import
        imports = list(re.finditer(r"^import .*?;\s*$", new, re.M | re.S))
        last = imports[-1]
        new = new[: last.end()] + '\nimport { PageActions } from "@/components/layout/PageHeader";' + new[last.end() :]
    open(path, "w", encoding="utf-8").write(new)
    print(f"ok {path}: {'botões no cabeçalho' if rest else 'título removido'}")


if __name__ == "__main__":
    args = sys.argv[1:]
    for i in range(0, len(args), 2):
        process(args[i], args[i + 1])
