import re

with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ventas/frontend_bundle.js", "r", encoding="utf-8", errors="ignore") as f:
    js = f.read()

positions = [
    ("AlmacenResource", 4547310),
    ("MovimientoResource", 4753509),
    ("RequerimientomovimientoResource", 4920947)
]

for res, pos in positions:
    print(f"\n==================== {res} ====================")
    fn_start = js.rfind("function e(", 0, pos)
    fn_block = js[fn_start:pos]
    methods = re.findall(r'this\.([a-zA-Z0-9_]+)\s*=\s*function\(([^)]*)\)\s*\{([^}]+)\}', fn_block)
    for m_name, m_args, m_code in methods:
        clean = " ".join(m_code.split())
        print(f"  * {m_name}({m_args}) -> {clean[:130]}")
