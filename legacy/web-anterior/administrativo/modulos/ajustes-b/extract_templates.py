import os
import re

out_dir = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ajustes-b/extracted/templates"
os.makedirs(out_dir, exist_ok=True)

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js", "r", encoding="utf-8") as f:
    text = f.read()

prefix = '.put("'
pos = 0
count = 0

relevant_terms = [
    "comprobante", "impuesto", "igv", "tarjeta", "moneda",
    "tipotransferencia", "categoriaanularventa", "formadepago", "formasdepago"
]

while True:
    idx = text.find(prefix, pos)
    if idx == -1:
        break
    
    key_start = idx + len(prefix)
    key_end = text.find('"', key_start)
    if key_end == -1:
        break
    key = text[key_start:key_end]
    
    # Check relevance
    is_relevant = any(term in key.lower() for term in relevant_terms)
    
    if is_relevant:
        comma_idx = text.find(',', key_end)
        if comma_idx != -1 and comma_idx < key_end + 5:
            q_idx = comma_idx + 1
            while q_idx < len(text) and text[q_idx] in (' ', '\t', '\n'):
                q_idx += 1
            q_char = text[q_idx]
            if q_char in ("'", '"'):
                c_idx = q_idx + 1
                chars = []
                while c_idx < len(text):
                    ch = text[c_idx]
                    if ch == '\\':
                        if c_idx + 1 < len(text):
                            nxt = text[c_idx + 1]
                            if nxt == q_char:
                                chars.append(q_char)
                                c_idx += 2
                                continue
                            elif nxt == 'n':
                                chars.append('\n')
                                c_idx += 2
                                continue
                            elif nxt == 't':
                                chars.append('\t')
                                c_idx += 2
                                continue
                            elif nxt == '\\':
                                chars.append('\\')
                                c_idx += 2
                                continue
                            else:
                                chars.append(nxt)
                                c_idx += 2
                                continue
                    elif ch == q_char:
                        break
                    else:
                        chars.append(ch)
                    c_idx += 1
                
                content = "".join(chars)
                filename = key.replace("/", "__") + ("" if key.endswith(".html") else ".html")
                with open(os.path.join(out_dir, filename), "w", encoding="utf-8") as out_f:
                    out_f.write(content)
                count += 1
                pos = c_idx
                continue
    pos = key_end + 1

print(f"Extracted {count} templates to {out_dir}")
