import re
import json

BUNDLE_PATH = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js"

controllers = [
    "ofertaCtrl",
    "nuevaOfertaCtrl",
    "asignarPrecioSucursalesCtrl",
    "AsignarPrecioSucursalesCtrl",
    "descuentoCtrl",
    "registrardescuentoCtrl",
    "modificardescuentoCtrl",
    "AjustesCuponesCtrl",
    "nuevoCuponDescuentoCtrl",
    "promocionsorteoIndexCtrl",
    "promocionSorteoListarCtrl",
    "promocionsorteoNuevoCtrl",
    "PlanMensajeriaDetalleCtrl",
    "AjustesValeDePagoCtrl"
]

with open(BUNDLE_PATH, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

results = {}

for ctrl in controllers:
    # Pattern: .controller("ctrlName", [ ... function(...) { ... } ])
    # or .controller('ctrlName', ...)
    pattern = re.compile(r'\.controller\(["\']' + re.escape(ctrl) + r'["\']\s*,\s*(\[.*?\]|function\s*\(.*?\)\s*\{)', re.DOTALL)
    m = pattern.search(text)
    if m:
        start_idx = m.start()
        # Find next controller or 5000 chars
        snippet = text[start_idx:start_idx+12000]
        # find endpoints inside snippet
        endpoints = re.findall(r'["\'](/restaurant/api/[^"\']+|/api/[^"\']+|api/rest/[^"\']+|/m/rest/[^"\']+)["\']', snippet)
        
        # services injected
        injected = []
        inj_match = re.search(r'\[(.*?)function', snippet, re.DOTALL)
        if inj_match:
            injected = [s.strip().replace('"', '').replace("'", "") for s in inj_match.group(1).split(',') if s.strip()]

        results[ctrl] = {
            "found": True,
            "injected": injected,
            "endpoints": list(set(endpoints)),
            "snippet": snippet[:2500]
        }
    else:
        results[ctrl] = {"found": False}

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/promos/controllers_info.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print("Controllers analyzed:")
for k, v in results.items():
    print(f" - {k}: found={v.get('found')}, endpoints={v.get('endpoints', [])}")
