import re
import json

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js", "r", encoding="utf-8", errors="ignore") as f:
    js = f.read()

endpoints = set()
patterns = [
    r'\.all\(["\']([^"\']+)["\']\)',
    r'\.one\(["\']([^"\']+)["\']\)',
    r'\.customGET\(["\']([^"\']+)["\']\)',
    r'\.customPOST\(["\']([^"\']+)["\']\)',
    r'\$http\.get\(["\']([^"\']+)["\']\)',
    r'\$http\.post\(["\']([^"\']+)["\']\)',
    r'url\s*:\s*["\']([^"\']+)["\']'
]

keywords = [
    "almacen", "stock", "requerimiento", "movimiento", "recepcion", 
    "proceso", "kardex", "merma", "porcion", "produccion", "insumo", 
    "receta", "guiaremision", "arqueo"
]

for p in patterns:
    for m in re.finditer(p, js):
        val = m.group(1).strip()
        if any(k in val.lower() for k in keywords):
            endpoints.add(val)

for m in re.finditer(r'["\']([^"\']*(?:rest|api)/[^"\']+)["\']', js):
    val = m.group(1).strip()
    if any(k in val.lower() for k in keywords):
        endpoints.add(val)

sorted_eps = sorted(list(endpoints))
print(f"Total relevant endpoints/services found: {len(sorted_eps)}")
with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/apis_found.json", "w", encoding="utf-8") as f:
    json.dump(sorted_eps, f, indent=2, ensure_ascii=False)

for ep in sorted_eps:
    print(" -", ep)
