import os
import glob
import re
import json

TPL_DIR = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ajustes-a/extracted_templates"

files = glob.glob(os.path.join(TPL_DIR, "*.html"))
print(f"Total template files: {len(files)}")

analysis = {}

for fpath in files:
    fname = os.path.basename(fpath)
    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Extract forms, inputs, tables, buttons, ng-models
    inputs = re.findall(r'<input[^>]*>', content, re.IGNORECASE)
    selects = re.findall(r'<select[^>]*>.*?</select>', content, re.DOTALL | re.IGNORECASE)
    textareas = re.findall(r'<textarea[^>]*>', content, re.IGNORECASE)
    buttons = re.findall(r'<button[^>]*>(.*?)</button>', content, re.DOTALL | re.IGNORECASE)
    links_btn = re.findall(r'<a[^>]*class="[^"]*btn[^"]*"[^>]*>(.*?)</a>', content, re.DOTALL | re.IGNORECASE)
    tables = re.findall(r'<table[^>]*>.*?</table>', content, re.DOTALL | re.IGNORECASE)
    ng_models = re.findall(r'ng-model=["\']([^"\']+)["\']', content)
    ng_clicks = re.findall(r'ng-click=["\']([^"\']+)["\']', content)

    # Clean button names
    btn_labels = []
    for b in buttons + links_btn:
        clean = re.sub(r'<[^>]+>', '', b).strip()
        clean = re.sub(r'\s+', ' ', clean)
        if clean and len(clean) < 50:
            btn_labels.append(clean)

    # Table headers
    th_list = re.findall(r'<th[^>]*>(.*?)</th>', content, re.DOTALL | re.IGNORECASE)
    clean_ths = []
    for th in th_list:
        clean = re.sub(r'<[^>]+>', '', th).strip()
        clean = re.sub(r'\s+', ' ', clean)
        if clean and len(clean) < 60:
            clean_ths.append(clean)

    analysis[fname] = {
        "file": fname,
        "size": len(content),
        "ng_models": sorted(list(set(ng_models))),
        "ng_clicks_sample": sorted(list(set(ng_clicks)))[:15],
        "buttons": sorted(list(set(btn_labels))),
        "table_headers": clean_ths,
        "input_count": len(inputs),
        "select_count": len(selects),
        "textarea_count": len(textareas),
        "table_count": len(tables)
    }

out_analysis = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ajustes-a/template_analysis.json"
with open(out_analysis, "w", encoding="utf-8") as out:
    json.dump(analysis, out, indent=2, ensure_ascii=False)

print(f"Saved template analysis to {out_analysis}")
