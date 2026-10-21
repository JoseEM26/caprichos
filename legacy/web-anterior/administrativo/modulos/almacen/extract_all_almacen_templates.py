import re
import os
import json

BUNDLE_PATH = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js"
OUT_DIR = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/extracted_templates"

os.makedirs(OUT_DIR, exist_ok=True)

with open(BUNDLE_PATH, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

pos = 0
count = 0
templates = {}

# Match .put("scripts/...", or .put('scripts/...'
keywords = [
    "almacen", "stock", "requerimiento", "movimiento", "recepcion", 
    "proceso", "kardex", "merma", "porcionamiento", "ordenproduccion", 
    "preparacionreceta", "produccion", "insumo"
]

while True:
    m = re.search(r'\.put\(["\'](scripts/[^"\']+)["\'],\s*', text[pos:])
    if not m:
        break
    
    tpl_path = m.group(1)
    match_end = pos + m.end()
    
    if match_end >= len(text):
        break

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
            
    content = "".join(content_chars)
    pos = curr + 1
    
    # Filter by keywords
    if any(k in tpl_path.lower() for k in keywords):
        safe_name = tpl_path.replace("/", "__").replace("\\", "__")
        if not safe_name.endswith(".html"):
            safe_name += ".html"
        save_file = os.path.join(OUT_DIR, safe_name)
        with open(save_file, "w", encoding="utf-8") as out_f:
            out_f.write(content)
        templates[tpl_path] = {
            "file": safe_name,
            "size": len(content)
        }
        count += 1

print(f"Extracted {count} templates to {OUT_DIR}")
with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/extracted_templates_catalog.json", "w", encoding="utf-8") as cat_f:
    json.dump(templates, cat_f, indent=2, ensure_ascii=False)
