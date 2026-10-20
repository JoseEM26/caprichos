import re

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js", "r", encoding="utf-8", errors="ignore") as f:
    js = f.read()

resources = [
    "AlmacenResource", "MovimientoResource", "RequerimientomovimientoResource", 
    "MovimientoalmaceninsumoResource", "MermaResource", "OrdenproduccionResource"
]

for res in resources:
    print(f"\n==================== {res} ====================")
    pattern = r'\.service\(["\']' + res + r'["\'],\s*([a-zA-Z0-9_]+)\)'
    m = re.search(pattern, js)
    if m:
        fn_name = m.group(1)
        # Find where function fn_name is defined before or after
        fn_idx = js.rfind(f"function {fn_name}(", 0, m.start())
        if fn_idx == -1:
            fn_idx = js.find(f"function {fn_name}(")
        if fn_idx != -1:
            fn_body = js[fn_idx:fn_idx+5000]
            # find all this.xxx = function ...
            methods = re.findall(r'this\.([a-zA-Z0-9_]+)\s*=\s*function\(([^)]*)\)\s*\{([^}]+)\}', fn_body)
            for m_name, m_args, m_code in methods:
                # clean whitespace
                m_code_clean = " ".join(m_code.split())
                print(f"  * {m_name}({m_args}) -> {m_code_clean[:140]}")
