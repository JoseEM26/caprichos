import re
import os
import json

BUNDLE_PATH = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js"
OUT_DIR = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/promos/templates"

os.makedirs(OUT_DIR, exist_ok=True)

with open(BUNDLE_PATH, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Pattern to find .put("template_path", 'html_content') or .put('template_path', "html_content")
# Let's parse carefully
pos = 0
found = 0
keywords = ['oferta', 'descuento', 'cupon', 'promocion', 'sorteo', 'vale']
templates_extracted = {}

while True:
    m = re.search(r'\.put\(["\'](scripts/[^"\']+)["\'],\s*', text[pos:])
    if not m:
        break
    
    tpl_path = m.group(1)
    match_end = pos + m.end()
    
    # What quote starts the HTML?
    q_char = text[match_end]
    if q_char not in ('"', "'"):
        pos = match_end
        continue
    
    curr = match_end + 1
    content_chars = []
    while curr < len(text):
        c = text[curr]
        if c == '\\':
            if curr + 1 < len(text):
                nxt = text[curr + 1]
                if nxt == q_char:
                    content_chars.append(q_char)
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
        elif c == q_char:
            break
        else:
            content_chars.append(c)
            curr += 1
            
    html_content = "".join(content_chars)
    pos = curr + 1
    
    if any(k in tpl_path.lower() for k in keywords):
        templates_extracted[tpl_path] = html_content
        found += 1
        safe_name = tpl_path.replace("/", "_").replace("\\", "_")
        if not safe_name.endswith(".html"):
            safe_name += ".html"
        with open(os.path.join(OUT_DIR, safe_name), "w", encoding="utf-8") as out:
            out.write(html_content)

print(f"Extracted {found} templates related to promos/ofertas/descuentos:")
for k in sorted(templates_extracted.keys()):
    print(f" - {k} ({len(templates_extracted[k])} bytes)")

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/promos/templates_index.json", "w", encoding="utf-8") as f:
    json.dump(list(templates_extracted.keys()), f, indent=2)
