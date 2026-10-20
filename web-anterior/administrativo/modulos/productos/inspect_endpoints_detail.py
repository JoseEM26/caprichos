import urllib.request
import re
import json

url = "http://caprichos.restaurant.pe/restaurant/scripts/scripts.426a6ac0.js"
print("Reading JS bundle...")
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req) as resp:
    js = resp.read().decode("utf-8", errors="ignore")

def analyze_ctrl(name):
    idx = js.find(name)
    if idx == -1:
        return []
    snippet = js[idx:idx+8000]
    return list(set(re.findall(r'["\']([a-zA-Z0-9_\-]+/(?:all|get|obtener|buscar|listar|por|categoria|receta|insumo|producto|catalogo|arbol)[a-zA-Z0-9_/\-]*)["\']', snippet)))

ctrls = ["PlabesCategoriasCtrl", "PlatosCtrl", "PlatosEditarCtrl", "InsumosListaCtrl", "ModificadoresListaCtrl", "CombosNuevoCtrl"]
results = {}
for c in ctrls:
    results[c] = analyze_ctrl(c)
    print(f"=== {c} ===")
    for ep in results[c]:
        print("  -", ep)

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/productos/detailed_endpoints.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)
