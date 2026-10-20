import os
import re
import urllib.request
import json

base_url = "http://caprichos.restaurant.pe/restaurant/"
js_url = base_url + "scripts/scripts.9fdb592e.js"
bundle_path = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/scripts.bundle.js"

if not os.path.exists(bundle_path):
    print("Downloading scripts.9fdb592e.js...")
    req = urllib.request.Request(js_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        content = resp.read()
        with open(bundle_path, "wb") as f:
            f.write(content)
    print(f"Downloaded {len(content)} bytes to {bundle_path}")
else:
    print(f"Using cached bundle {bundle_path}")

with open(bundle_path, "r", encoding="utf-8", errors="ignore") as f:
    js_text = f.read()

# 1. Search for UI-Router states related to almacen
print("\n--- Searching for UI-Router states related to almacen / stock / requerimiento / movimiento ---")
# Look for .state("...", { ... })
state_pattern = re.compile(r'\.state\(["\']([^"\']+)["\'],\s*({[^;]+?})\)', re.DOTALL)
# Because nested braces can break simple regex, let's search for .state("...almacen..." or similar
all_states = {}
pos = 0
while True:
    idx = js_text.find('.state(', pos)
    if idx == -1:
        break
    q = js_text[idx+7]
    if q in ('"', "'"):
        end_q = js_text.find(q, idx+8)
        if end_q != -1:
            state_name = js_text[idx+8:end_q]
            # Find matching block up to next .state or similar
            # Look ahead 1500 chars
            snippet = js_text[end_q+1:end_q+2000]
            if any(k in state_name.lower() for k in ["almacen", "stock", "requerimiento", "movimiento", "recepcion", "proceso", "inventario", "kardex", "merma"]):
                all_states[state_name] = snippet[:800]
    pos = idx + 7

print(f"Found {len(all_states)} states related to warehouse/inventory:")
for s in all_states:
    print(f"  State: {s}")

# 2. Extract templates from $templateCache
print("\n--- Extracting $templateCache templates related to almacen ---")
tpl_dir = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/extracted_templates"
os.makedirs(tpl_dir, exist_ok=True)

pos = 0
count = 0
matched_templates = {}

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

    keywords = ["almacen", "requerimiento", "movimiento", "recepcion", "proceso", "stock", "kardex", "merma", "existencia", "insumo", "produccion"]
    if any(k in tpl_name.lower() for k in keywords):
        count += 1
        safe_name = tpl_name.replace("/", "_").replace("\\", "_")
        if not safe_name.endswith(".html"):
            safe_name += ".html"
        save_path = os.path.join(tpl_dir, safe_name)
        with open(save_path, "w", encoding="utf-8") as out:
            out.write(tpl_content)
        matched_templates[tpl_name] = {
            "file": safe_name,
            "length": len(tpl_content)
        }

print(f"Extracted {count} matching templates.")
with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/extracted_templates_index.json", "w", encoding="utf-8") as out_idx:
    json.dump({"states": all_states, "templates": matched_templates}, out_idx, indent=2, ensure_ascii=False)

print("Saved states and template index.")
