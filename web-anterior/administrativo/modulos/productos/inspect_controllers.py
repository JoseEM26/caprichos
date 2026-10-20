import urllib.request
import re
import json

url = "http://caprichos.restaurant.pe/restaurant/scripts/scripts.426a6ac0.js"
print("Reading JS bundle...")
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as resp:
    js = resp.read().decode("utf-8", errors="ignore")

# Find controllers
ctrl_matches = re.findall(r'\.controller\(["\']([^"\']+)["\']', js)
prod_ctrls = [c for c in ctrl_matches if any(k in c.lower() for k in ["plato", "producto", "categoria", "insumo", "modificador", "combo", "receta", "descartable", "menu"])]
print("Controllers found:", prod_ctrls)

# For each controller, let's find snippets of code to see what endpoints they call
controller_apis = {}
for c in prod_ctrls:
    idx = js.find(f'.controller("{c}"')
    if idx == -1:
        idx = js.find(f".controller('{c}'")
    if idx != -1:
        snippet = js[idx:idx+6000]
        # find endpoints inside this snippet
        eps = re.findall(r'["\']([^"\'\s]+/(?:obtener|get|all|listar|buscar|categoria|producto|plato|insumo|receta|modificador|combo)[^"\'\s]*)["\']', snippet)
        controller_apis[c] = list(set(eps))

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/productos/controllers_api_mapping.json", "w", encoding="utf-8") as f:
    json.dump(controller_apis, f, indent=2)

print("\nSample Controller API mapping:")
for k, v in list(controller_apis.items())[:10]:
    print(f"[{k}]: {v}")
