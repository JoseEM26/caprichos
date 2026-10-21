import re
import json

BUNDLE_PATH = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js"

with open(BUNDLE_PATH, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Find modules: angular.module("restaurantpe....")
module_matches = re.findall(r'angular\.module\(["\'](restaurantpe\.[^"\']+|model\.[^"\']+)["\']', text)
print("Modules found in bundle:", set(module_matches))

# Look for factories/services matching our keywords
service_matches = re.finditer(r'\.(factory|service)\(["\']([^"\']+)["\']', text)
relevant_services = []
keywords = ['oferta', 'descuento', 'cupon', 'promocion', 'sorteo', 'vale']
for sm in service_matches:
    kind = sm.group(1)
    name = sm.group(2)
    if any(k in name.lower() for k in keywords):
        start = sm.start()
        relevant_services.append({
            "type": kind,
            "name": name,
            "code": text[start:start+3000]
        })

print(f"Found {len(relevant_services)} relevant services/factories:")
for s in relevant_services:
    print(f" - {s['type']}: {s['name']}")

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/promos/services_info.json", "w", encoding="utf-8") as f:
    json.dump(relevant_services, f, indent=2)
