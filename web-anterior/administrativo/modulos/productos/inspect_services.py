import urllib.request
import re
import json

url = "http://caprichos.restaurant.pe/restaurant/scripts/scripts.426a6ac0.js"
print("Reading JS bundle...")
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as resp:
    js = resp.read().decode("utf-8", errors="ignore")

services = re.findall(r'\.(?:service|factory)\(["\']([^"\']+)["\']', js)
prod_services = [s for s in services if any(k in s.lower() for k in ["plato", "producto", "categoria", "insumo", "modificador", "combo", "receta", "catalogo"])]
print("Product services / factories:", prod_services)

# For each service, let's find Restangular.all(...) or custom GET paths
service_endpoints = {}
for s in prod_services:
    idx = js.find(f'.service("{s}"')
    if idx == -1:
        idx = js.find(f".service('{s}'")
    if idx == -1:
        idx = js.find(f'.factory("{s}"')
    if idx == -1:
        idx = js.find(f".factory('{s}'")
    
    if idx != -1:
        snippet = js[idx:idx+4000]
        # find strings like 'producto/...', 'catalogo/...', 'insumo/...'
        calls = re.findall(r'["\']([a-zA-Z0-9_\-]+/(?:all|get|obtener|buscar|listar|por|categoria|receta|insumo|producto)[a-zA-Z0-9_/\-]*)["\']', snippet)
        service_endpoints[s] = list(set(calls))

print("\nService endpoints:")
for k, v in service_endpoints.items():
    if v:
        print(f"[{k}]: {v}")

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/productos/service_endpoints.json", "w", encoding="utf-8") as f:
    json.dump(service_endpoints, f, indent=2)
