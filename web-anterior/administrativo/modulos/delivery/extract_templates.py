import re
import json

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/admin_scripts.js") as f:
    text = f.read()

template_names = [
    "scripts/restaurantpe/ventas-full/callcenter/index.html",
    "scripts/restaurantpe/ventas-full/callcenter/card-pedido.html",
    "scripts/restaurantpe/ventas-full/callcenter/cliente.html",
    "scripts/restaurantpe/ventas-full/callcenter/nuevocliente.html",
    "scripts/restaurantpe/ventas-full/callcenter/revision.html",
    "scripts/restaurantpe/ventas-full/callcenter/resumen.html",
    "scripts/restaurantpe/ventas-full/callcenter/modals/modal-agregardireccion.html",
    "scripts/restaurantpe/ventas-full/callcenter/modals/modal-crearPersonaJuridica.html",
    "scripts/restaurantpe/ajustes/callcenter/sucursal.html",
    "scripts/restaurantpe/ajustes/callcenter/nuevacoberturalocal.html",
    "scripts/restaurantpe/ajustes/callcenter/modals/modal-configuracionlocalcallcenter.html",
    "scripts/restaurantpe/delivery/motorizados/index.html",
    "scripts/restaurantpe/delivery/motorizados/editar.html",
    "scripts/restaurantpe/delivery/canaldelivery/index.html",
    "scripts/restaurantpe/delivery/canaldelivery/editar.html",
    "scripts/restaurantpe/delivery/movilidad/index.html",
    "scripts/restaurantpe/delivery/movilidad/editar.html",
    "scripts/restaurantpe/delivery/tiporeclamo/index.html",
    "scripts/restaurantpe/delivery/tiporeclamo/editar.html",
    "scripts/restaurantpe/delivery/tipoproblemadelivery/index.html",
    "scripts/restaurantpe/delivery/tipoproblemadelivery/editar.html",
    "scripts/restaurantpe/escritorio/resumen/delivery.view.html",
    "scripts/restaurantpe/informes/ventas/deliveryscobertura/deliverys.html",
    "scripts/restaurantpe/informes/ventas/deliverysfrecuenciacliente/deliverys.html",
    "scripts/restaurantpe/ventas-full/callcenter/reclamo.html"
]

results = {}

for name in template_names:
    pattern = re.escape(f'e.put("{name}"') + r",\s*[\x27\"](.*?)(?:[\x27\"]\s*\)\s*[,;]|(?:\$templateCache|e\.put))"
    # Or simpler: find index of e.put("name",
    idx = text.find(f'e.put("{name}"')
    if idx != -1:
        # find where it ends
        start = idx + len(f'e.put("{name}"') + 1
        # It begins with ' or "
        quote_char = text[start]
        # find matching end
        end = text.find(f"{quote_char})", start)
        if end != -1:
            content = text[start+1:end]
            # unescape
            results[name] = content
        else:
            results[name] = text[start+1:start+2500]
    else:
        results[name] = "NOT_FOUND"

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/extracted_templates.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"Extracted {len(results)} templates.")
for k, v in results.items():
    print(f"  {k}: {len(v)} chars")
