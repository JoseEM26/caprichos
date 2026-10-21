import re
import os
import json

BUNDLE_PATH = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js"
OUT_DIR = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ajustes-a/extracted_templates"

os.makedirs(OUT_DIR, exist_ok=True)

with open(BUNDLE_PATH, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

pos = 0
count = 0
templates = {}

# Target keywords relevant to Ajustes Operativa
keywords = [
    "opcionessistema", "opciones-sistema", "configuracionpos", "configuracion-pos",
    "configuracionregional", "configuracion-regional", "locales", "local",
    "produccion", "almacen", "salon", "salones", "mesa", "mesas",
    "cajas", "caja", "impresora", "impresoras", "turno", "turnos",
    "marca", "marcas", "self-service", "self_service", "selfservice",
    "ajustes"
]

# Excluded keywords
excluded = [
    "usuario", "usuarios"
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
    
    tpl_lower = tpl_path.lower()
    
    # Filter by keywords and path containing 'ajustes' or specific operational items
    if "scripts/restaurantpe/ajustes" in tpl_lower:
        # Check if excluded (e.g. usuarios)
        if "usuario" in tpl_lower:
            continue
        
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
with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ajustes-a/extracted_templates_catalog.json", "w", encoding="utf-8") as cat_f:
    json.dump(templates, cat_f, indent=2, ensure_ascii=False)
