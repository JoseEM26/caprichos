#!/usr/bin/env python3
"""
analizar_reglas.py
Busca y extrae la logica exacta de calculo de totales, cupones, delivery,
propinas, horarios, pedidos programados y feature flags.
"""

import os
import re

JS_DIR = "/home/jose/JoseEM/caprichos/web-anterior/carta/codigo/js"
core_path = os.path.join(JS_DIR, "Ch2y0kWI.js")

with open(core_path, "r", encoding="utf-8", errors="ignore") as f:
    core = f.read()

def search_text(pattern, max_results=3, context=300):
    print(f"=== SEARCH: {pattern} ===")
    matches = list(re.finditer(pattern, core))
    print(f"Total matches: {len(matches)}")
    for m in matches[:max_results]:
        start = max(0, m.start() - 100)
        end = min(len(core), m.end() + context)
        print(f"Match at {m.start()}:\n{core[start:end]}\n" + "-"*40)

# 1. Totales y calculos
search_text(r"orderTotal|totalPrice|calculateTotal|orderSummary", 3)

# 2. Descuentos y cupones
search_text(r"couponDiscount|applyDiscount|discountType", 3)

# 3. Delivery fees: distancia y poligonos
search_text(r"getDeliveryPrice|deliveryFee|calculateDelivery", 3)

# 4. Schedule orders
search_text(r"scheduledOrders|scheduled_delivery_date|isStoreOpen|attentionHours", 3)

# 5. Feature flags
search_text(r"featureFlags|feature_flags|isFeatureEnabled|flags\.", 3)
