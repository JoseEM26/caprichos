import re

# We can scan the JS bundle or use the API endpoints we already saw
print("Scanning API endpoints for Compras...")
# Let's inspect the endpoints used in Compras controllers
with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/compras/report_raw.json", "r") as f:
    import json
    raw = json.load(f)
    print("Endpoints from initial run:")
    for ep in raw.get("api_endpoints", []):
        if any(w in ep["url"].lower() for w in ["proveedor", "lote", "compra", "banco", "comprobante", "percepcion"]):
            print(ep["method"], ep["url"])
