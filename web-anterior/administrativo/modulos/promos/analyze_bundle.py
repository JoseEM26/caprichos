import json
import re
import os

BUNDLE_PATH = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js"
OUT_DIR = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/promos"

print(f"Reading {BUNDLE_PATH}...")
with open(BUNDLE_PATH, "r", encoding="utf-8", errors="ignore") as f:
    js_text = f.read()

print(f"Total bundle length: {len(js_text)}")

# 1. Search for states matching our targets
# Target routes:
# #!/ofertas
# #!/descuentos
# #!/ajustes/cupondescuento
# #!/promocionsorteo
# #!/ajustes/valedepago

keywords = ["oferta", "descuento", "cupon", "promocion", "sorteo", "valedepago", "vale"]

# Find all ui-router state definitions: .state("...", { ... })
# Often defined as $stateProvider.state('stateName', { url: '...', templateUrl: '...', controller: '...' })
state_matches = []
for m in re.finditer(r'\.state\(\s*["\']([^"\']+)["\']\s*,\s*(\{.*?\})\s*\)', js_text):
    s_name = m.group(1)
    s_def = m.group(2)
    if any(k in s_name.lower() or k in s_def.lower() for k in keywords):
        state_matches.append({
            "name": s_name,
            "raw": s_def[:1000]
        })

print(f"Found {len(state_matches)} relevant states.")

# Also let's extract all templateCache keys matching our keywords
pos = 0
templates = {}
while True:
    idx = js_text.find('$templateCache.put("', pos)
    if idx == -1:
        idx = js_text.find("$templateCache.put('", pos)
        if idx == -1:
            break
        quote_char = "'"
        start_key = idx + len("$templateCache.put('")
    else:
        quote_char = '"'
        start_key = idx + len('$templateCache.put("')

    end_key = js_text.find(quote_char, start_key)
    if end_key == -1:
        break
    tpl_name = js_text[start_key:end_key]

    comma_idx = js_text.find(',', end_key)
    if comma_idx == -1:
        break
    q2_idx = js_text.find(quote_char, comma_idx)
    if q2_idx == -1:
        break

    curr = q2_idx + 1
    content_chars = []
    while curr < len(js_text):
        c = js_text[curr]
        if c == '\\':
            if curr + 1 < len(js_text):
                nxt = js_text[curr + 1]
                if nxt == quote_char:
                    content_chars.append(quote_char)
                    curr += 2
                    continue
                elif nxt == 'n':
                    content_chars.append('\n')
                    curr += 2
                    continue
                elif nxt == 't':
                    content_chars.append('\t')
                    curr += 2
                    continue
                elif nxt == 'r':
                    content_chars.append('\r')
                    curr += 2
                    continue
                elif nxt == '\\':
                    content_chars.append('\\')
                    curr += 2
                    continue
                else:
                    content_chars.append(c)
                    curr += 1
                    continue
            else:
                break
        elif c == quote_char:
            break
        else:
            content_chars.append(c)
            curr += 1

    tpl_content = "".join(content_chars)
    pos = curr + 1

    if any(k in tpl_name.lower() for k in keywords):
        templates[tpl_name] = tpl_content

print(f"Found {len(templates)} matching templates in $templateCache:")
for t in templates.keys():
    print(" -", t)

os.makedirs(f"{OUT_DIR}/extracted_templates", exist_ok=True)
for t, content in templates.items():
    filename = t.replace("/", "_").replace("\\", "_")
    if not filename.endswith(".html"):
        filename += ".html"
    with open(f"{OUT_DIR}/extracted_templates/{filename}", "w", encoding="utf-8") as f:
        f.write(content)

with open(f"{OUT_DIR}/states_found.json", "w", encoding="utf-8") as f:
    json.dump(state_matches, f, indent=2, ensure_ascii=False)

print("Saved states and templates successfully.")
