import re
import json

with open('scripts.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

controllers = ['MiRestaurantCtrl', 'ProveedorfeCtrl', 'SeriemanualfeCtrl', 'IntegracionCtrl', 'PosCtrl', 'ConfigurarfacturacionelectronicaCtrl']

results = {}

for ctrl in controllers:
    # Pattern to find function definition: function Ctrl(...) { ... } or .controller('Ctrl', ...)
    pattern = rf'function\s+{ctrl}\s*\(([^)]*)\)\s*\{{'
    m = re.search(pattern, content)
    if m:
        start = m.start()
        # Find matching brace
        brace_count = 0
        end = start
        for i in range(m.end() - 1, min(len(content), m.end() + 100000)):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    end = i + 1
                    break
        ctrl_code = content[start:end]
        
        # Extract endpoints called (e.g., $http.get(...), Restangular, services, etc.)
        endpoints = re.findall(r'[\'\"`](https?://[^\'\"`]+|/[a-zA-Z0-9_/.-]+)[\'\"`]', ctrl_code)
        api_endpoints = [e for e in set(endpoints) if any(term in e for term in ['api', 'rest', 'm/rest', 'backend', 'billing', 'local', 'empresa', 'integracion', 'pos', 'serie', 'proveedorfe'])]
        
        # Extract methods on vm
        vm_methods = re.findall(r'vm\.([a-zA-Z0-9_]+)\s*=', ctrl_code)
        
        results[ctrl] = {
            "params": m.group(1),
            "code_length": len(ctrl_code),
            "vm_methods": sorted(set(vm_methods)),
            "api_endpoints": sorted(api_endpoints),
            "sample_code": ctrl_code[:3000]
        }
    else:
        results[ctrl] = "Not found with pattern"

with open('controllers_summary.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("Saved controllers_summary.json")
for k, v in results.items():
    if isinstance(v, dict):
        print(f"=== {k} ===")
        print(f"Params: {v['params']}")
        print(f"Code length: {v['code_length']}")
        print(f"VM methods ({len(v['vm_methods'])}): {v['vm_methods']}")
        print(f"Endpoints ({len(v['api_endpoints'])}): {v['api_endpoints']}")
