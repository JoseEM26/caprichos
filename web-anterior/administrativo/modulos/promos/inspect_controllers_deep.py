import json
import re

BUNDLE_PATH = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js"

with open(BUNDLE_PATH, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

controllers_to_find = [
    "ofertaCtrl",
    "nuevaOfertaCtrl",
    "asignarPrecioSucursalesCtrl",
    "descuentoCtrl",
    "registrardescuentoCtrl",
    "modificardescuentoCtrl",
    "AjustesCuponesCtrl",
    "nuevoCuponDescuentoCtrl",
    "promocionsorteoIndexCtrl",
    "promocionSorteoListarCtrl",
    "promocionsorteoNuevoCtrl",
    "PlanMensajeriaDetalleCtrl",
    "AjustesValeDePagoCtrl",
    "ModalCategoriadescuentoCtrl",
    "IngresocupondescuentoCtrl"
]

results = {}

for name in controllers_to_find:
    pattern = re.compile(r'\.controller\(["\']' + re.escape(name) + r'["\'],\s*([a-zA-Z0-9_$]+)\)', re.DOTALL)
    m = pattern.search(text)
    if m:
        fn_name = m.group(1)
        idx = m.end()
        # Find following function definition
        fn_pattern = re.compile(r'function\s+' + re.escape(fn_name) + r'\s*\((.*?)\)\s*\{', re.DOTALL)
        fn_match = fn_pattern.search(text, idx - 500 if idx > 500 else 0)
        if not fn_match:
            fn_match = fn_pattern.search(text, idx)
        
        if fn_match:
            f_start = fn_match.start()
            f_code = text[f_start:f_start+15000]
            params = fn_match.group(1)
            results[name] = {
                "params": params,
                "code": f_code[:12000]
            }
        else:
            # Fallback snippet
            results[name] = {"snippet": text[idx:idx+4000]}
    else:
        results[name] = {"found": False}

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/promos/controllers_deep.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print("Saved controllers_deep.json")
for k, v in results.items():
    print(k, "captured bytes:", len(v.get("code", v.get("snippet", ""))))
