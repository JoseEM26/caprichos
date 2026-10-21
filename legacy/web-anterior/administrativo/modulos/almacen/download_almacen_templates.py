import json
import urllib.request
import os
import time

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/almacen_states.json") as f:
    states = json.load(f)

base_url = "http://caprichos.restaurant.pe/restaurant/"
dest_dir = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/templates"
os.makedirs(dest_dir, exist_ok=True)

all_templates = set()
for sname, sdata in states.items():
    for t in sdata.get("templates", []):
        all_templates.add(t)

# Also add known modal templates or sub-templates for almacen
additional = [
    "scripts/restaurantpe/almacen/almacen.view.html",
    "scripts/restaurantpe/almacen/stock/stock.view.html",
    "scripts/restaurantpe/almacen/stock/stock-tabla.html",
    "scripts/restaurantpe/almacen/stock/breadcrumb-stock.html",
    "scripts/restaurantpe/almacen/movimientointerno/movimientointerno.html",
    "scripts/restaurantpe/almacen/requerimientov2/requerimientos.view.html",
    "scripts/restaurantpe/almacen/recepcion/recepcion.view.html",
    "scripts/restaurantpe/almacen/lista-procesos/lista-de-procesos.view.html",
    "scripts/restaurantpe/almacen/lista-procesos/proceso-detalle.view.html",
    "scripts/restaurantpe/almacen/lista-procesos/recepcion-detalle.view.html",
    "scripts/restaurantpe/almacen/lista-procesos/movimiento-detalle.view.html",
    "scripts/restaurantpe/almacen/movimientointerno/modal-agregar-insumo.html",
    "scripts/restaurantpe/almacen/movimientointerno/modal-ver-detalle.html",
    "scripts/restaurantpe/almacen/requerimientov2/modal-agregar-insumo.html",
    "scripts/restaurantpe/almacen/recepcion/modal-agregar-insumo.html",
    "scripts/restaurantpe/almacen/kardex/kardex.html",
    "scripts/restaurantpe/almacen/merma/merma.html",
    "scripts/restaurantpe/almacen/merma/merma-nuevo.html",
    "scripts/restaurantpe/almacen/regularstock/regularstock.html",
    "scripts/restaurantpe/almacen/procesarstock/procesarstock.html"
]

for a in additional:
    all_templates.add(a)

print(f"Downloading {len(all_templates)} templates...")
results = {}
for t in sorted(all_templates):
    url = base_url + t
    safe_name = t.replace("/", "_")
    target_path = os.path.join(dest_dir, safe_name)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read()
            with open(target_path, "wb") as f_out:
                f_out.write(content)
            results[t] = {"status": "ok", "size": len(content), "file": safe_name}
            print(f"[OK] {t} ({len(content)} bytes)")
    except Exception as e:
        results[t] = {"status": "error", "error": str(e)}
        print(f"[ERR] {t}: {e}")
    time.sleep(0.1)

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/downloaded_templates_result.json", "w", encoding="utf-8") as out:
    json.dump(results, out, indent=2, ensure_ascii=False)
