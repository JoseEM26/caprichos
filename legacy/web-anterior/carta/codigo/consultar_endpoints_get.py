#!/usr/bin/env python3
"""
consultar_endpoints_get.py
Consulta de forma segura y controlada (solo GET de lectura publica, 1 req cada 1.5s)
los endpoints publicos que usa la aplicacion para Caprichos:
Company ID: 5816bd90-2af9-11eb-83a6-91c28df3eedf
Host: caprichos-per.ola.click

Guarda las respuestas en /home/jose/JoseEM/caprichos/web-anterior/carta/codigo/api_respuestas/
"""

import os
import time
import json
import requests

API_BASE = "https://api.olaclick.app"
COMPANY_ID = "5816bd90-2af9-11eb-83a6-91c28df3eedf"
HOST = "caprichos-per.ola.click"

OUTPUT_DIR = "/home/jose/JoseEM/caprichos/web-anterior/carta/codigo/api_respuestas"
os.makedirs(OUTPUT_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Origin": "https://caprichos-per.ola.click",
    "Referer": "https://caprichos-per.ola.click/"
}

ENDPOINTS = [
    ("hosts", f"{API_BASE}/ms-companies/public/hosts/{HOST}"),
    ("company", f"{API_BASE}/ms-companies/public/companies/{COMPANY_ID}"),
    ("ecommerce_settings", f"{API_BASE}/ms-companies/public/companies/{COMPANY_ID}/ecommerce-settings"),
    ("payment_methods", f"{API_BASE}/ms-orders/public/companies/{COMPANY_ID}/payment-methods"),
    ("order_settings", f"{API_BASE}/ms-orders/public/companies/{COMPANY_ID}/order-settings"),
    ("coupons", f"{API_BASE}/ms-orders/public/companies/{COMPANY_ID}/coupons"),
    ("loyalty_settings", f"{API_BASE}/ms-clients/public/companies/{COMPANY_ID}/loyalty-settings"),
    ("categories", f"{API_BASE}/ms-products/public/companies/{COMPANY_ID}/categories"),
    ("gallery_images", f"{API_BASE}/ms-companies/public/companies/{COMPANY_ID}/gallery-images"),
    ("chat_orchestrator_health", f"{API_BASE}/ms-chat-orchestrator/public/health")
]

def main():
    print("Iniciando consultas GET publicas seguras (1.5s delay)...")
    summary = {}
    for name, url in ENDPOINTS:
        out_file = os.path.join(OUTPUT_DIR, f"{name}.json")
        print(f"[GET] {url} -> {name}.json")
        time.sleep(1.5)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            print(f"Status: {resp.status_code}")
            try:
                data = resp.json()
            except Exception:
                data = {"raw_text": resp.text}
            
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
            summary[name] = {
                "url": url,
                "status": resp.status_code,
                "file": f"api_respuestas/{name}.json",
                "keys": list(data.keys()) if isinstance(data, dict) else f"list({len(data)})"
            }
        except Exception as e:
            print(f"Error consultando {url}: {e}")
            summary[name] = {"url": url, "error": str(e)}

    with open(os.path.join(OUTPUT_DIR, "resumen_llamadas.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    print("Consultas GET completadas exitosamente.")

if __name__ == "__main__":
    main()
