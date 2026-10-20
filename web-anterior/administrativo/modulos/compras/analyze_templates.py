import json
import re

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/compras/states_and_templates.json", "r", encoding="utf-8") as f:
    data = json.load(f)

states = data.get("all_states", [])
compras_states = [s for s in states if "compra" in s.get("name", "").lower() or "lote" in s.get("name", "").lower() or "proveed" in s.get("name", "").lower()]

print(f"=== COMPRAS STATES ({len(compras_states)}) ===")
for s in compras_states:
    print(f"Name: {s.get('name')} | URL: {s.get('url')} | Controller: {s.get('controller')} | Template: {s.get('templateUrl')}")

templates = data.get("templates", {})

def analyze_template(name, content):
    print(f"\n==========================================")
    print(f"ANALYZING: {name}")
    print(f"==========================================")
    if not content or content.startswith("HTTP_"):
        print("Template content unavailable or error:", content)
        return

    # Forms, inputs, selects
    labels = re.findall(r'<label[^>]*>(.*?)</label>', content, re.DOTALL | re.IGNORECASE)
    clean_labels = [re.sub(r'<[^>]+>', '', l).strip() for l in labels if re.sub(r'<[^>]+>', '', l).strip()]
    
    inputs = re.findall(r'<input[^>]+>', content, re.IGNORECASE)
    selects = re.findall(r'<select[^>]+>.*?</select>', content, re.DOTALL | re.IGNORECASE)
    buttons = re.findall(r'<button[^>]*>(.*?)</button>', content, re.DOTALL | re.IGNORECASE)
    a_buttons = re.findall(r'<a[^>]*class="[^"]*btn[^"]*"[^>]*>(.*?)</a>', content, re.DOTALL | re.IGNORECASE)
    th_headers = re.findall(r'<th[^>]*>(.*?)</th>', content, re.DOTALL | re.IGNORECASE)
    
    clean_buttons = [re.sub(r'<[^>]+>', '', b).strip() for b in buttons + a_buttons if re.sub(r'<[^>]+>', '', b).strip()]
    clean_headers = [re.sub(r'<[^>]+>', '', th).strip() for th in th_headers if re.sub(r'<[^>]+>', '', th).strip()]

    print("Labels found:", list(dict.fromkeys(clean_labels))[:25])
    print("Table Headers found:", list(dict.fromkeys(clean_headers))[:20])
    print("Buttons found:", list(dict.fromkeys(clean_buttons))[:15])

    # Extract ng-models
    models = list(dict.fromkeys(re.findall(r'ng-model="([^"]+)"', content)))
    print("ng-models:", models[:25])

    # Check for REST endpoints or services
    endpoints = list(dict.fromkeys(re.findall(r'(/restaurant/(?:api|m)/rest/[a-zA-Z0-9_/]+)', content)))
    if endpoints:
        print("Direct endpoints in template:", endpoints)

# Analyze key templates
keys_to_analyze = [
    "scripts/restaurantpe/compras/proveedor/proveedor-lista.html",
    "scripts/restaurantpe/compras/proveedor/proveedor-editar.html",
    "scripts/restaurantpe/compras/lotecompra/lotecompra-lista.html",
    "scripts/restaurantpe/compras/lotecompra/lotecompra-editar.html",
    "scripts/restaurantpe/compras/lotecompra/lotecompra-pagar.html",
    "scripts/restaurantpe/compras/ajustes/ajustesselector.html",
    "scripts/restaurantpe/creditos/banco/index.html",
    "scripts/restaurantpe/creditos/banco/editar.html",
    "scripts/restaurantpe/creditos/cuentabancaria/index.html",
    "scripts/restaurantpe/creditos/cuentabancaria/editar.html",
    "scripts/restaurantpe/compras/comprobantecompra/index.html",
    "scripts/restaurantpe/compras/comprobantecompra/editar.html",
    "scripts/restaurantpe/compras/percepcion/index.html",
    "scripts/restaurantpe/compras/percepcion/editar.html",
    "scripts/restaurantpe/ajustes/transportistas/index.html",
    "scripts/restaurantpe/ajustes/transportistas/editar.html",
    "scripts/restaurantpe/compras/serviciocompra/index.html",
    "scripts/restaurantpe/compras/serviciocompra/editar.html",
    "scripts/restaurantpe/compras/compra/compra-lista.html",
    "scripts/restaurantpe/compras/compra/compra-editar.html"
]

for k in keys_to_analyze:
    if k in templates:
        analyze_template(k, templates[k])
    else:
        print(f"NOT FOUND: {k}")
