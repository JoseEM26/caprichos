#!/usr/bin/env python3
"""
localizar_lineas.py
Encuentra los numeros de linea exactos en codigo/js/Ch2y0kWI.js y otros chunks
para cada regla de negocio, funcion y definicion del informe.
"""

import os
import re

JS_DIR = "/home/jose/JoseEM/caprichos/web-anterior/carta/codigo/js"

def find_in_file(fname, patterns):
    path = os.path.join(JS_DIR, fname)
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
    
    found = {}
    for label, pat in patterns.items():
        found[label] = []
        for line_no, line in enumerate(lines, 1):
            if re.search(pat, line):
                found[label].append(line_no)
    return found

rules = {
    "CheckoutSteps_Constants": r'CHECKOUT_STEP_CLIENT_INFO',
    "Checkout_StepTransitions_WS": r'function WS\(',
    "Checkout_StepTransitions_tj": r'function tj\(',
    "CheckoutScreen_ClientInfo": r'CheckoutScreenClientInfo',
    "CheckoutScreen_DeliveryAddressCreate": r'CheckoutScreenDeliveryAddressCreate',
    "CheckoutScreen_DeliveryAddressAutocomplete": r'CheckoutScreenDeliveryAddressAutocomplete',
    "DeliveryFee_Calculation_B2": r'function B2\(',
    "Tip_Calculation_Ld": r'function Ld\(',
    "Discount_Constants": r'Ys="coupon"',
    "OrderTotal_Formula_Cn": r'checkoutOrderTotal:w',
    "OrderCombosPrice_Sum": r'selectedProductPriceToPay\+y\.orderProduct\.selectedModifiersTotalPrice',
    "OrderTypes_Store_mr": r'mr=sn\("orderTypes"',
    "Store_Open_Calculation_mp": r'function mp\(',
    "CompanyReceiveOrders_Logic": r'companyReceiveOrders:f',
    "ScheduleSection_Component": r'ScheduleSection',
    "WhatsApp_Message_tTe": r'function tTe\(',
    "WhatsApp_Button": r'OrderSendWhatsappButton',
    "Service_Orders_Co": r'const Co=\{async getPaymentMethods',
    "Service_Companies_ig": r'const ig=\{async getCompanyIdFromHost',
    "Service_Clients_Il": r'Il=\{async getOrCreateClient',
    "Service_Products_Dk": r'Dk=\{async getProductsCategories',
    "Service_Payments_ni": r'ni=\{async createPaymentIntent',
    "Service_Reports_patchVisits": r'patchCompanyVisits',
    "Service_Chat_Health": r'Lwe=\{async getHealth'
}

print("Buscando lineas en Ch2y0kWI.js...")
res_core = find_in_file("Ch2y0kWI.js", rules)
for k, lines in res_core.items():
    print(f"- {k}: lineas {lines}")

print("\nBuscando en Dg8-skhv.js...")
res_entry = find_in_file("Dg8-skhv.js", {"patchCompanyVisits": r'patchCompanyVisits', "routes": r'name:"checkout"'})
for k, lines in res_entry.items():
    print(f"- {k}: lineas {lines}")
