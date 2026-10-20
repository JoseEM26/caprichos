#!/usr/bin/env python3
"""
inspeccionar_stores.py
Inspecciona los stores de Pinia en Ch2y0kWI.js:
- checkout store
- order store
- cart store
- payment store
- coupon store
- delivery calculation
"""

import os
import re

JS_DIR = "/home/jose/JoseEM/caprichos/web-anterior/carta/codigo/js"
core_path = os.path.join(JS_DIR, "Ch2y0kWI.js")

with open(core_path, "r", encoding="utf-8", errors="ignore") as f:
    core = f.read()

# 1. Checkout store
idx = core.find('rt=sn("checkout"')
if idx != -1:
    print("=== CHECKOUT STORE (rt) ===")
    print(core[idx:idx+2000])
    print("\n" + "="*50 + "\n")

# 2. Order store
m = re.search(r'(\w+)=sn\(["\']order["\']', core)
if m:
    idx2 = m.start()
    var_name = m.group(1)
    print(f"=== ORDER STORE ({var_name}) ===")
    print(core[idx2:idx2+2000])
    print("\n" + "="*50 + "\n")

# 3. Cart store / totals calculation
m_cart = re.search(r'(\w+)=sn\(["\']cart["\']', core)
if m_cart:
    idx3 = m_cart.start()
    print(f"=== CART STORE ({m_cart.group(1)}) ===")
    print(core[idx3:idx3+2000])
    print("\n" + "="*50 + "\n")

# 4. Total calculation helper / orderTotal
m_tot = re.search(r'orderTotal|calculateOrderTotal', core)
if m_tot:
    idx4 = m_tot.start()
    print("=== ORDER TOTAL CALCULATION ===")
    print(core[max(0, idx4-200):min(len(core), idx4+1500)])
