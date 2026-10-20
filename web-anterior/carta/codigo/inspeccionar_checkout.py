#!/usr/bin/env python3
"""
inspeccionar_checkout.py
Inspecciona detalladamente el flujo de checkout, validacion de formularios,
tipos de servicio, calculos y reglas de negocio.
"""

import os
import re

JS_DIR = "/home/jose/JoseEM/caprichos/web-anterior/carta/codigo/js"
core_path = os.path.join(JS_DIR, "Ch2y0kWI.js")

with open(core_path, "r", encoding="utf-8", errors="ignore") as f:
    core = f.read()

def find_definition(var_name):
    patterns = [
        rf'const\s+{var_name}\s*=\s*([^,;]+)',
        rf'let\s+{var_name}\s*=\s*([^,;]+)',
        rf'var\s+{var_name}\s*=\s*([^,;]+)',
        rf'{var_name}\s*=\s*"([^"]+)"',
        rf'{var_name}\s*=\s*\'([^\']+)\''
    ]
    for p in patterns:
        m = re.search(p, core)
        if m:
            return m.group(1).strip()
    return "NOT FOUND"

print("Mo:", find_definition("Mo"))
print("En:", find_definition("En"))
print("St:", find_definition("St"))
print("Sr:", find_definition("Sr"))

# Buscar constantes de service_type
service_types = re.findall(r'\"(DELIVERY|TAKEAWAY|ONSITE)\"', core)
print("Service types literals found:", set(service_types))

# Buscar pantallas de checkout / goToCheckoutScreen
print("\n--- Checkout Screens ---")
screens = re.findall(r'goToCheckoutScreen\(([^)]+)\)', core)
print("goToCheckoutScreen calls:", set(screens))
