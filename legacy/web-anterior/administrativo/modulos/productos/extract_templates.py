import urllib.request
import re
import os
import json

url = "http://caprichos.restaurant.pe/restaurant/scripts/scripts.426a6ac0.js"
print("Downloading scripts.426a6ac0.js...")
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as resp:
    js_text = resp.read().decode("utf-8", errors="ignore")

print(f"Total JS size: {len(js_text)} chars")

# Save js locally in scratch or templates
out_dir = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/productos/extracted_templates"
os.makedirs(out_dir, exist_ok=True)

# Pattern for $templateCache.put("...", "...")
# In minified AngularJS: $templateCache.put("template_path","<html>...</html>")
# Let's find occurrences of $templateCache.put(
pattern = re.compile(r'\$templateCache\.put\(["\']([^"\']+)["\'],\s*["\'](.*?)["\']\)(?:;|\n|\))', re.DOTALL)

# Because minified strings can have escaped quotes \", let's parse more cleanly
pos = 0
found = 0
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

    # Now find the start of the HTML content
    comma_idx = js_text.find(',', end_key)
    if comma_idx == -1:
        break
    # Next quote
    q2_idx = js_text.find(quote_char, comma_idx)
    if q2_idx == -1:
        break

    # Now find unescaped matching quote
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
            # End of string
            break
        else:
            content_chars.append(c)
            curr += 1

    tpl_content = "".join(content_chars)
    pos = curr + 1

    # Check if related to productos
    if any(k in tpl_name.lower() for k in ["producto", "plato", "categoria", "insumo", "combo", "modificador", "descartable", "receta"]):
        safe_filename = tpl_name.replace("/", "_").replace("\\", "_")
        if not safe_filename.endswith(".html"):
            safe_filename += ".html"
        with open(os.path.join(out_dir, safe_filename), "w", encoding="utf-8") as f:
            f.write(tpl_content)
        found += 1

print(f"Extracted {found} product-related templates to {out_dir}")
