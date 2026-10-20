import re
import json

BUNDLE_PATH = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js"

with open(BUNDLE_PATH, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

controllers = [
    "opcionesSistemaCtrl",
    "configuracionposCtrl",
    "configuracionRegionalCtrl",
    "AjustesSucursalesCtrl",
    "AjustesProduccionCtrl",
    "AjustesSalonesCtrl",
    "AjustesCajasCtrl",
    "AjustesImpresorasCtrl",
    "ConfigurarImpresorasCtrl",
    "AjustesTurnosCtrl",
    "MarcaCtrl",
    "ImagenSelfServiceCtrl"
]

results = {}

for ctrl in controllers:
    # Look for .controller("CtrlName", ...
    m = re.search(r'\.controller\(["\']' + ctrl + r'["\']\s*,\s*(\[.*?\]|function\s*\(.*?\)\s*\{)', text)
    if not m:
        # Also check without quotes or with different spacing
        m = re.search(r'function\s+' + ctrl + r'\s*\(', text)
    
    if m:
        start = m.start()
        # grab roughly 15000 chars of controller implementation
        chunk = text[start:start+25000]
        
        # Extract endpoints called (e.g. $http, Restangular, resource, api endpoints)
        endpoints = re.findall(r'["\'](/restaurant/api/rest/[^"\']+|/m/rest/[^"\']+|/api/rest/[^"\']+|/api/[^"\']+)["\']', chunk)
        
        # Extract service methods (e.g. OpcionessistemaResource.get, etc.)
        service_calls = re.findall(r'([A-Za-z0-9_]+Resource\.[A-Za-z0-9_]+)', chunk)
        factory_calls = re.findall(r'([A-Za-z0-9_]+Factory\.[A-Za-z0-9_]+)', chunk)
        service_custom = re.findall(r'([A-Za-z0-9_]+Service\.[A-Za-z0-9_]+)', chunk)
        
        # Extract vm functions
        vm_funcs = re.findall(r'vm\.([A-Za-z0-9_]+)\s*=\s*function', chunk)
        scope_funcs = re.findall(r'\$scope\.([A-Za-z0-9_]+)\s*=\s*function', chunk)
        
        results[ctrl] = {
            "found": True,
            "endpoints": sorted(list(set(endpoints))),
            "resource_calls": sorted(list(set(service_calls + factory_calls + service_custom))),
            "functions": sorted(list(set(vm_funcs + scope_funcs)))
        }
    else:
        results[ctrl] = {"found": False}

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ajustes-a/controllers_analysis.json", "w", encoding="utf-8") as out:
    json.dump(results, out, indent=2, ensure_ascii=False)

print("Saved controller analysis.")
