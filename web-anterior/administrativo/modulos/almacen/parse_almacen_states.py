import re
import json

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/scripts.bundle.js", "r", encoding="utf-8", errors="ignore") as f:
    js = f.read()

# Find module configuration for almacen
# Look for state definitions starting with 'almacen'
states = {}

for m in re.finditer(r'\.state\(["\'](almacen[^"\']*)["\'],\s*({.*?})\)(?=\.state|\.run|\}\)|e\.\$inject)', js, re.DOTALL):
    sname = m.group(1)
    sbody = m.group(2)
    
    # extract url, templateUrl, controller, acl
    url_m = re.search(r'url:\s*["\']([^"\']+)["\']', sbody)
    ctrl_m = re.search(r'controller:\s*["\']([^"\']+)["\']', sbody)
    acl_m = re.search(r'acl:\s*["\']([^"\']+)["\']', sbody)
    tpl_matches = re.findall(r'templateUrl:\s*["\']([^"\']+)["\']', sbody)
    
    states[sname] = {
        "url": url_m.group(1) if url_m else None,
        "controller": ctrl_m.group(1) if ctrl_m else None,
        "acl": acl_m.group(1) if acl_m else None,
        "templates": tpl_matches,
        "raw": sbody[:500]
    }

print(f"Total states found: {len(states)}")
with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/almacen_states.json", "w", encoding="utf-8") as out:
    json.dump(states, out, indent=2, ensure_ascii=False)

for k, v in states.items():
    print(f"{k} -> url: {v['url']} | ctrl: {v['controller']} | acl: {v['acl']} | tpls: {v['templates']}")
