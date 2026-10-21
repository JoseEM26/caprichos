import os
import re
import json

bundle_path = '/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js'
with open(bundle_path, 'r', encoding='utf-8') as f:
    js_text = f.read()

print(f"Total bundle size: {len(js_text)} chars")

out_dir = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/clientes/templates"
os.makedirs(out_dir, exist_ok=True)

# Find all occurrences of .put("scripts/restaurantpe/clientes/...
matches = re.finditer(r'([a-zA-Z0-9_\$]+)\.put\(["\'](scripts/restaurantpe/clientes/[^"\']+)["\'],\s*(["\'])', js_text)

templates = {}
for m in matches:
    key = m.group(2)
    quote = m.group(3)
    start_pos = m.end()
    
    # parse until unescaped quote
    content_chars = []
    c_pos = start_pos
    while c_pos < len(js_text):
        ch = js_text[c_pos]
        if ch == '\\':
            c_pos += 1
            if c_pos < len(js_text):
                content_chars.append(js_text[c_pos])
        elif ch == quote:
            break
        else:
            content_chars.append(ch)
        c_pos += 1
    content = "".join(content_chars)
    templates[key] = content
    print(f"Extracted: {key} ({len(content)} chars)")
    safe_name = key.replace("/", "_").replace("\\", "_")
    with open(os.path.join(out_dir, safe_name), "w", encoding="utf-8") as out_f:
        out_f.write(content)

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/clientes/client_templates.json", "w", encoding="utf-8") as f:
    json.dump(templates, f, indent=2, ensure_ascii=False)

print(f"Successfully extracted {len(templates)} templates!")
