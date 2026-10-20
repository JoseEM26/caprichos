#!/usr/bin/env python3
"""
inspeccionar_feature_flags.py
Extrae feature flags, variables de entorno de runtimeConfig y flags de la aplicacion.
"""

import os
import re

JS_DIR = "/home/jose/JoseEM/caprichos/web-anterior/carta/codigo/js"
core_path = os.path.join(JS_DIR, "Ch2y0kWI.js")

with open(core_path, "r", encoding="utf-8", errors="ignore") as f:
    core = f.read()

# 1. runtimeConfig / public
m_cfg = re.findall(r'public:\s*\{([^}]+)\}', core)
print("=== RUNTIME CONFIG PUBLIC ===")
for c in m_cfg[:5]:
    print(c)

# 2. Features en ecommerceSettings / company
features = [
    "scheduled_orders_enabled",
    "collect_client_info",
    "google_maps_validation",
    "enable_repeat_last_order",
    "enable_suggested_products",
    "order_here_enabled",
    "apply_payments",
    "loyalty_program",
    "scheduled_report_enabled",
    "onsite_qr_ordering"
]
print("\n=== ECOMMERCE FEATURE FLAGS USAGE ===")
for feat in features:
    count = len(re.findall(r'\b' + feat + r'\b', core))
    print(f"{feat}: {count} occurrences")

# 3. Posthog / Unleash / LaunchDarkly / custom flags
print("\n=== FLAG SYSTEMS ===")
for sys_flag in ["posthog", "unleash", "launchdarkly", "feature_flag", "featureFlag", "flags."]:
    count = len(re.findall(re.escape(sys_flag), core, re.I))
    print(f"{sys_flag}: {count}")
