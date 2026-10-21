import urllib.request
import re
import json

url = "http://caprichos.restaurant.pe/restaurant/scripts/scripts.426a6ac0.js"
print("Reading JS bundle...")
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as resp:
    js = resp.read().decode("utf-8", errors="ignore")

# Find patterns like .all("..."), .one("..."), .customGET("..."), $http.get("...")
endpoints = set()

patterns = [
    r'\.all\(["\']([^"\']+)["\']\)',
    r'\.one\(["\']([^"\']+)["\']\)',
    r'\.customGET\(["\']([^"\']+)["\']\)',
    r'\.customPOST\(["\']([^"\']+)["\']\)',
    r'\$http\.get\(["\']([^"\']+)["\']\)',
    r'url\s*:\s*["\']([^"\']+)["\']'
]

for p in patterns:
    for m in re.finditer(p, js):
        val = m.group(1).strip()
        if any(k in val.lower() for k in ["producto", "plato", "categoria", "insumo", "modificador", "receta", "combo", "descartable", "carta", "catalogo", "porcion"]):
            endpoints.add(val)

# Also search for "rest/..." or similar
for m in re.finditer(r'["\']([^"\']*(?:rest|api)/[^"\']+)["\']', js):
    val = m.group(1).strip()
    if any(k in val.lower() for k in ["producto", "plato", "categoria", "insumo", "modificador", "receta", "combo", "descartable", "carta", "catalogo", "porcion"]):
        endpoints.add(val)

sorted_eps = sorted(list(endpoints))
print(f"Total relevant endpoints/services found: {len(sorted_eps)}")
with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/productos/apis_found.json", "w", encoding="utf-8") as f:
    json.dump(sorted_eps, f, indent=2)

for ep in sorted_eps[:50]:
    print(" -", ep)
