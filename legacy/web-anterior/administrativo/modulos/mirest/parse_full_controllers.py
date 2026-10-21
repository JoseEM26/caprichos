import re
import json

with open('scripts.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

targets = [
    ('MiRestaurantCtrl', r'\.controller\("MiRestaurantCtrl"'),
    ('proveedorFECtrl', r'\.controller\("proveedorFECtrl"'),
    ('SeriemanualfeCtrl', r'\.controller\("SeriemanualfeCtrl"'),
    ('integracionCtrl', r'\.controller\("integracionCtrl"'),
    ('PosCtrl', r'\.controller\("PosCtrl"')
]

controllers_data = {}

for name, pattern in targets:
    m = re.search(pattern, content)
    if not m:
        print(f"Pattern for {name} not found")
        continue
    
    reg_idx = m.start()
    # Search backwards for function e( or similar
    fn_start = content.rfind('function e(', max(0, reg_idx - 30000), reg_idx)
    if fn_start == -1:
        fn_start = content.rfind('function(', max(0, reg_idx - 30000), reg_idx)
    
    # Grab the function code up to registration
    fn_code = content[fn_start:reg_idx]
    
    # Extract endpoint strings
    # Search for api/rest, m/rest, etc.
    endpoints = re.findall(r'[\'\"`]([^\'\"`]*(?:api/rest|m/rest|public/rest|billing|microservices)[^\'\"`]*)[\'\"`]', fn_code)
    
    # Extract methods assigned to vm or this
    # e.g., vm.foo = function(...) or S.foo = function(...)
    # Let's see what variable is used for this: var S=this, or var vm=this
    this_var = 'vm'
    m_this = re.search(r'var\s+([a-zA-Z0-9_$]+)\s*=\s*this', fn_code)
    if m_this:
        this_var = m_this.group(1)
    
    methods = re.findall(rf'{re.escape(this_var)}\.([a-zA-Z0-9_$]+)\s*=', fn_code)
    
    controllers_data[name] = {
        "function_start": fn_start,
        "registration_pos": reg_idx,
        "this_variable": this_var,
        "methods": sorted(set(methods)),
        "endpoints": sorted(set(endpoints)),
        "length": len(fn_code),
        "code_snippet": fn_code[:4000]
    }
    
    # Save individual controller code file
    with open(f"controller_{name}.js", "w", encoding="utf-8") as out:
        out.write(fn_code)

with open('parsed_controllers.json', 'w', encoding='utf-8') as f:
    json.dump(controllers_data, f, indent=2, ensure_ascii=False)

print("Parsed controllers:")
for k, v in controllers_data.items():
    print(f"\n=== {k} ===")
    print(f"This var: {v['this_variable']}")
    print(f"Length: {v['length']}")
    print(f"Methods ({len(v['methods'])}): {v['methods'][:15]}...")
    print(f"Endpoints ({len(v['endpoints'])}): {v['endpoints']}")
