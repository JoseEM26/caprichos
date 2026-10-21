import re
import json

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js", "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

# Let's find all controllers in restaurantpe.almacen or controllers used in almacen states
# From states earlier, we saw:
# movimientoCrtl as vm
# requeriemintoCrtl as vm
# RecepcionCtrl as vm
# listaprocesooCrtl as vm
# ProcesoRequerimientoDetalleCtrl as vm
# RecepcionDetalleCtrl as vm
# MovimientoInternoDetalleCtrl as vm
# ArqueoInventarioCtrl as vm
# PorcionamientoInsumoListaCtrl as vm
# PreparacionRecetaCtrl as vm
# OrdenProduccionCtrl as vm
# RequerimientomovimientoNuevoCtrl as vm
# etc.

# Let's search for API endpoints: e.g. /restaurant/api/rest/almacen/ or /restaurant/m/rest/ or similar
# Let's find all string literals containing rest/ or api/
endpoints = set()
for m in re.finditer(r'["\']((?:https?://[^"\']+|/restaurant)?/(?:m/rest|api/rest|rest)/[^"\']+)["\']', text):
    ep = m.group(1)
    if any(k in ep.lower() for k in ["almacen", "stock", "requerimiento", "movimiento", "recepcion", "proceso", "kardex", "merma", "receta", "porcion", "produccion", "insumo", "unidad"]):
        endpoints.add(ep)

print(f"Endpoints found related to warehouse/inventory: {len(endpoints)}")
for ep in sorted(endpoints):
    print(" ", ep)

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/endpoints_catalog.json", "w", encoding="utf-8") as ep_f:
    json.dump(sorted(list(endpoints)), ep_f, indent=2, ensure_ascii=False)
