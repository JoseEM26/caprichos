import re
import json

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js", "r", encoding="utf-8", errors="ignore") as f:
    js = f.read()

# Find resources
resources = {}
for m in re.finditer(r'angular\.module\(["\'](resource\.[^"\']+)["\'][^)]*\)\.service\(["\']([^"\']+)["\'],\s*([a-zA-Z0-9_]+)\)', js):
    mod = m.group(1)
    svc = m.group(2)
    fn_name = m.group(3)
    
    if any(k in mod.lower() for k in ["almacen", "stock", "movimiento", "requerimiento", "recepcion", "merma", "kardex", "receta", "porcion", "produccion"]):
        # Find fn_name definition
        fn_idx = js.find(f'function {fn_name}(')
        if fn_idx != -1:
            fn_body = js[fn_idx:fn_idx+3500]
            # Find methods: this.xxx = function
            methods = re.findall(r'this\.([a-zA-Z0-9_]+)\s*=\s*function\(([^)]*)\)', fn_body)
            # Find URLs called
            urls = re.findall(r'["\']([^"\']*(?:almacen|stock|movimiento|requerimiento|recepcion|merma|kardex|receta|porcion|produccion)[^"\']*)["\']', fn_body)
            resources[svc] = {
                "module": mod,
                "methods": [{"name": name, "args": args} for name, args in methods],
                "urls": list(set(urls))
            }

print(f"Total resource services analyzed: {len(resources)}")
for svc, data in resources.items():
    print(f"\n=== {svc} ({data['module']}) ===")
    for m in data['methods']:
        print(f"  * {m['name']}({m['args']})")
    print("  URLs:", data['urls'])

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/resources_and_apis.json", "w", encoding="utf-8") as out:
    json.dump(resources, out, indent=2, ensure_ascii=False)
