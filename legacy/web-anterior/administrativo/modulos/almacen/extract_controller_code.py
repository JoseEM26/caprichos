import re
import json

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js", "r", encoding="utf-8", errors="ignore") as f:
    js = f.read()

controllers = [
    "movimientoCrtl",
    "requeriemintoCrtl",
    "RecepcionCtrl",
    "listaprocesooCrtl",
    "ProcesoRequerimientoDetalleCtrl",
    "RecepcionDetalleCtrl",
    "MovimientoInternoDetalleCtrl",
    "PreparacionRecetaCtrl",
    "PorcionamientoInsumoRegistroCtrl"
]

results = {}

for ctrl in controllers:
    # search function ctrl( or .controller("ctrl", ...
    idx = js.find(f'function {ctrl}(')
    if idx == -1:
        idx = js.find(f'{ctrl}=function(')
    if idx == -1:
        idx = js.find(f'"{ctrl}"')
    
    if idx != -1:
        snippet = js[idx:idx+3500]
        # extract calls to .all(, .one(, .customGET, .customPOST, $http, Restangular
        calls = re.findall(r'(?:Restangular|\$http|almacenService|movimientoService|[a-zA-Z0-9_]+)\.(?:all|one|customGET|customPOST|get|post)\(["\']([^"\']+)["\']', snippet)
        results[ctrl] = {
            "found_at": idx,
            "calls": list(set(calls)),
            "snippet": snippet[:1000]
        }
    else:
        results[ctrl] = {"found": False}

print(json.dumps({k: v.get("calls") for k, v in results.items()}, indent=2))
with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/controllers_endpoints.json", "w", encoding="utf-8") as out:
    json.dump(results, out, indent=2, ensure_ascii=False)
