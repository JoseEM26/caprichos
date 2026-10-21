import re
import json
import os

bundle_path = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js"
output_dir = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ajustes-b/extracted"
os.makedirs(output_dir, exist_ok=True)

with open(bundle_path, "r", encoding="utf-8") as f:
    bundle = f.read()

# 1. Extract templates from $templateCache.put
print("Extracting $templateCache entries...")
template_pattern = re.compile(r'\$templateCache\.put\(["\']([^"\']+)["\'],\s*["\'](.*?)["\']\);', re.DOTALL)
# Note: bundle might have escaped strings
# Let's search for templateCache puts
templates = {}
matches = re.finditer(r'\$templateCache\.put\((["\'])(.*?)\1,\s*(["\'])(.*?)\3\)', bundle)
count = 0
for m in matches:
    tpl_name = m.group(2)
    tpl_content = m.group(4)
    # Check if relevant to ajustes-b
    relevant_terms = [
        "comprobante", "igv", "impuesto", "tarjeta", "moneda",
        "tipotransferencia", "categoriaanularventa", "formadepago",
        "formasdepago", "forma-pago", "ajustes"
    ]
    if any(t in tpl_name.lower() for t in relevant_terms):
        templates[tpl_name] = tpl_content.encode('utf-8').decode('unicode_escape', errors='ignore')
        count += 1

print(f"Found {count} relevant templates in $templateCache.")

# Save templates individually
for name, content in templates.items():
    safe_name = re.sub(r'[\\/:]', '__', name) + ".html"
    with open(os.path.join(output_dir, safe_name), "w", encoding="utf-8") as out:
        out.write(content)

# 2. Extract state definitions (ui-router $stateProvider)
print("Extracting state definitions...")
states = {}
state_pattern = re.compile(r'\.state\((["\'])(ajustes\.(comprobantes|impuestos|tarjetas|monedas|monedafacturacion|tipotransferencia|categoriaanularventa|formasdepago)[^"\']*)\1,\s*({.*?})\s*\)', re.DOTALL)
for m in state_pattern.finditer(bundle):
    state_name = m.group(2)
    state_body = m.group(4)
    states[state_name] = state_body

print(f"Found {len(states)} state definitions.")
with open(os.path.join(output_dir, "states.json"), "w", encoding="utf-8") as out:
    json.dump(states, out, indent=2, ensure_ascii=False)

# 3. Find controllers, resources, and services for these modules
print("Searching controllers & models...")
search_tokens = [
    "ComprobanteController", "ComprobanteListController", "ComprobanteResource", "Comprobantefolio",
    "ImpuestoController", "IgvController", "ImpuestoResource", "IgvResource",
    "TarjetaController", "TarjetaResource", "TarjetaglobalResource",
    "MonedaController", "MonedaResource", "MonedafacturacionController", "MonedafacturacionResource",
    "TipotransferenciaController", "TipotransferenciaResource",
    "CategoriaanularventaController", "CategoriaanularventaResource",
    "FormadepagoController", "FormadepagoResource"
]

code_snippets = {}
for token in search_tokens:
    pos = 0
    snippets = []
    while True:
        idx = bundle.find(token, pos)
        if idx == -1:
            break
        # Grab snippet around token
        start = max(0, idx - 150)
        end = min(len(bundle), idx + 2500)
        snippets.append(bundle[start:end])
        pos = idx + len(token) + 500
        if len(snippets) > 5:
            break
    if snippets:
        code_snippets[token] = snippets

with open(os.path.join(output_dir, "code_snippets.json"), "w", encoding="utf-8") as out:
    json.dump(code_snippets, out, indent=2, ensure_ascii=False)

print("Extraction completed successfully!")
