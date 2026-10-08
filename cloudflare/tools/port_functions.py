"""Copia as funções do Supabase (supabase/functions) para o Worker.

O código das funções é mantido como está; só os imports que dependiam do
Deno/Supabase são trocados pelos equivalentes do Worker:
  deno.land/std .../server.ts      -> compat/deno.js (serve)
  esm.sh / npm: @supabase/supabase-js -> compat/supabase.js (createClient)
  esm.sh node-forge                 -> pacote npm node-forge
Arquivos de teste (*.test.ts) não são copiados.
Saída: cloudflare/worker/src/edge/<função>/...
"""
import os
import re
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "supabase", "functions")
DST = os.path.join(ROOT, "cloudflare", "worker", "src", "edge")

RULES = [
    # tipos do runtime do Supabase (só declarações de tipo): removidos
    (re.compile(r"""^import\s+["']jsr:@supabase/functions-js/edge-runtime\.d\.ts["'];?\s*$""", re.M), "// (import de tipos do Supabase Edge Runtime removido)"),
    (re.compile(r"""from\s+["']https://deno\.land/std@[^/]+/http/server\.ts["']"""), 'from "../../compat/deno.js"'),
    (re.compile(r"""from\s+["'](?:https://esm\.sh/|npm:)@supabase/supabase-js(?:@[\d.]+)?/cors["']"""), 'from "../../compat/cors.js"'),
    (re.compile(r"""from\s+["'](?:https://esm\.sh/|npm:)@supabase/supabase-js(?:@[\d.]+)?["']"""), 'from "../../compat/supabase.js"'),
    (re.compile(r"""import\(\s*["']https://esm\.sh/node-forge@[^"']*["']\s*\)"""), 'import("node-forge")'),
]


def main():
    if os.path.exists(DST):
        shutil.rmtree(DST)
    names = []
    for name in sorted(os.listdir(SRC)):
        d = os.path.join(SRC, name)
        if not os.path.isdir(d):
            continue
        os.makedirs(os.path.join(DST, name), exist_ok=True)
        for f in os.listdir(d):
            if not f.endswith(".ts") or f.endswith(".test.ts"):
                continue
            code = open(os.path.join(d, f), encoding="utf-8").read()
            for pat, rep in RULES:
                code = pat.sub(rep, code)
            left = re.findall(r"""(?:from\s+|import\(|import\s+)\s*["'](https?://[^"']+|npm:[^"']+|jsr:[^"']+)["']""", code)
            if left:
                raise SystemExit(f"{name}/{f}: import externo não tratado: {left}")
            header = (
                "// Copiado de supabase/functions/%s/%s por cloudflare/tools/port_functions.py\n"
                "// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.\n"
                % (name, f)
            )
            open(os.path.join(DST, name, f), "w", encoding="utf-8").write(header + code)
        names.append(name)
    print("funções copiadas:", ", ".join(names))


if __name__ == "__main__":
    main()
