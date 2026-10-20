#!/usr/bin/env python3
"""
generar_configuracion.py
Extrae de __NUXT_DATA__ de products.html e info.html TODA la configuracion
de la empresa y genera /home/jose/JoseEM/caprichos/web-anterior/carta/codigo/configuracion.json
con enmascaramiento estricto de claves, tokens y cuentas bancarias (dejando solo ultimos 3 digitos).
"""

import os
import sys
import json
import re

# Importar parse_nuxt_data y unflatten de datos/extraer.py
sys.path.append("/home/jose/JoseEM/caprichos/web-anterior/carta/datos")
from extraer import parse_nuxt_data, unflatten

BASE_DIR = "/home/jose/JoseEM/caprichos/web-anterior/carta"
DATOS_DIR = os.path.join(BASE_DIR, "datos")
CODIGO_DIR = os.path.join(BASE_DIR, "codigo")
CONFIG_OUT = os.path.join(CODIGO_DIR, "configuracion.json")

def mask_text(val, keep=3):
    """Enmascara cadenas sensibles dejando solo los ultimos `keep` caracteres."""
    if not val or not isinstance(val, str):
        return val
    val = val.strip()
    if len(val) <= keep:
        return "***"
    return f"***{val[-keep:]}"

def mask_bank_and_phones_in_desc(text):
    """Enmascara numeros de cuentas y telefonos en textos libres (ej. descripciones de pago)."""
    if not text or not isinstance(text, str):
        return text
    
    # Enmascarar numeros de 8 a 20 digitos (cuentas bancarias, telefonos)
    def repl_num(match):
        num_str = match.group(0)
        return f"***...{num_str[-3:]}"
        
    return re.sub(r'\b\d{8,20}\b', repl_num, text)

def main():
    with open(os.path.join(DATOS_DIR, "products.html"), "r", encoding="utf-8") as f:
        html_products = f.read()
    with open(os.path.join(DATOS_DIR, "info.html"), "r", encoding="utf-8") as f:
        html_info = f.read()

    p_raw = parse_nuxt_data(html_products)
    i_raw = parse_nuxt_data(html_info)

    p_data = unflatten(0, p_raw)
    i_data = unflatten(0, i_raw)

    pinia_p = p_data.get("pinia", {})
    pinia_i = i_data.get("pinia", {})

    company_raw = pinia_p.get("company", {}).get("company", {})
    ecom_raw = pinia_p.get("ecommerceSettings", {}).get("ecommerceSettings", {})
    attention_raw = pinia_p.get("attentionHours", {}).get("attentionHours", {})
    current_date = pinia_p.get("attentionHours", {}).get("currentDate", [None, ""])[1]
    payments_raw = pinia_p.get("paymentMethods", {}).get("flatPaymentMethods", [])
    loyalty_raw = pinia_p.get("loyaltySettings", {}).get("loyaltySettings", {})

    # WiFi extraer y enmascarar
    wifi_data = {"ssid": None, "password_masked": None}
    for item in company_raw.get("landing_contents", []):
        if item.get("type") == "wifi_network" and ">>>===OLACLICK_WIFI_VALUES_SEPARATOR===<<<" in item.get("value", ""):
            parts = item.get("value", "").split(">>>===OLACLICK_WIFI_VALUES_SEPARATOR===<<<")
            wifi_data["ssid"] = parts[0]
            wifi_data["password_masked"] = mask_text(parts[1], keep=3)

    # Metodos de pago enmascarados
    payment_methods_clean = []
    for pm in payments_raw:
        clean_pm = {
            "id": pm.get("id"),
            "code": pm.get("code"),
            "delivery": pm.get("delivery", False),
            "onsite": pm.get("onsite", False),
            "takeaway": pm.get("takeaway", False),
            "payment_method_fee": pm.get("payment_method_fee"),
            "description_masked": mask_bank_and_phones_in_desc(pm.get("description"))
        }
        payment_methods_clean.append(clean_pm)

    # Runtime config extraido de HTML
    m_env = re.search(r'appEnv:"([^"]+)"', html_products)
    m_ver = re.search(r'appVersion:"([^"]+)"', html_products)
    m_api = re.search(r'apiBaseUrl:"([^"]+)"', html_products)
    m_s3 = re.search(r'awsS3BaseUrl:"([^"]+)"', html_products)
    m_ws = re.search(r'websocketHost:"([^"]+)"', html_products)
    m_fb_token = re.search(r'content="([a-zA-Z0-9]+)"', ecom_raw.get("facebook_domain_validation", ""))

    config_output = {
        "_metadata": {
            "extract_source": "products.html & info.html (__NUXT_DATA__ Pinia Stores)",
            "company_token": company_raw.get("token"),
            "platform": "OlaClick / Nuxt 3",
            "security": "Claves, tokens, cuentas bancarias y telefonos enmascarados dejando solo los ultimos 3 digitos"
        },
        "empresa": {
            "id": company_raw.get("id"),
            "token": company_raw.get("token"),
            "nombre": company_raw.get("name"),
            "industria": company_raw.get("industry"),
            "direccion": company_raw.get("address"),
            "direccion_habilitada": company_raw.get("address_enabled"),
            "coordenadas": {
                "latitud": company_raw.get("latitude"),
                "longitud": company_raw.get("longitude")
            },
            "ciudad": company_raw.get("city"),
            "pais": company_raw.get("country"),
            "zona_horaria": company_raw.get("timezone"),
            "moneda": company_raw.get("currency"),
            "whatsapp_masked": mask_text(company_raw.get("whatsapp"), keep=3),
            "url_publica": company_raw.get("public_url"),
            "logo_url": company_raw.get("logo_url"),
            "logo_thumbnail_url": company_raw.get("logo_thumbnail_url"),
            "plan_suscripcion": {
                "highest_plan": company_raw.get("highest_plan"),
                "highest_value": company_raw.get("highest_value"),
                "current_subscriptions": company_raw.get("current_subscriptions"),
                "active_subscriptions": company_raw.get("active_subscriptions"),
                "order_limit_usage_count": company_raw.get("order_limit_usage_count")
            },
            "wifi": wifi_data
        },
        "ecommerce_settings": {
            "checkout_type": ecom_raw.get("checkout_type"),
            "default_inbound_order_status": ecom_raw.get("default_inbound_order_status"),
            "enable_repeat_last_order": ecom_raw.get("enable_repeat_last_order"),
            "enable_suggested_products": ecom_raw.get("enable_suggested_products"),
            "order_here_enabled": ecom_raw.get("order_here_enabled"),
            "account_setup_steps": ecom_raw.get("account_setup_steps")
        },
        "tipos_de_pedido": {
            "delivery": {
                "active": ecom_raw.get("delivery", {}).get("active"),
                "tiempo_promedio": ecom_raw.get("delivery", {}).get("average_time"),
                "monto_minimo_para_permitir": ecom_raw.get("delivery", {}).get("minimum_amount_to_allow"),
                "monto_minimo_para_gratis": ecom_raw.get("delivery", {}).get("minimum_amount_for_free"),
                "pedidos_programados_habilitados": ecom_raw.get("delivery", {}).get("scheduled_orders_enabled"),
                "recolectar_info_cliente": ecom_raw.get("delivery", {}).get("collect_client_info"),
                "validacion_google_maps": ecom_raw.get("delivery", {}).get("google_maps_validation"),
                "permitir_fuera_de_cobertura": ecom_raw.get("delivery", {}).get("prices", {}).get("area", {}).get("enable_out_of_area"),
                "tarifas_envio": {
                    "tipo": ecom_raw.get("delivery", {}).get("prices", {}).get("type"),
                    "precio_fijo": ecom_raw.get("delivery", {}).get("prices", {}).get("fixed"),
                    "reglas_por_distancia": ecom_raw.get("delivery", {}).get("prices", {}).get("distance"),
                    "rangos_distancia_metros": ecom_raw.get("delivery", {}).get("prices", {}).get("ranges"),
                    "poligonos": [
                        {
                            "id": p.get("id"),
                            "name": p.get("name"),
                            "enabled": p.get("enabled"),
                            "price": p.get("price"),
                            "total_vertices": len(p.get("coordinates", [])),
                            "coordenadas": p.get("coordinates")
                        }
                        for p in ecom_raw.get("delivery", {}).get("prices", {}).get("polygons", [])
                    ]
                },
                "disabled_until": ecom_raw.get("delivery", {}).get("disabled_until")
            },
            "takeaway": {
                "active": ecom_raw.get("takeaway", {}).get("active"),
                "pedidos_programados_habilitados": ecom_raw.get("takeaway", {}).get("scheduled_orders_enabled"),
                "recolectar_info_cliente": ecom_raw.get("takeaway", {}).get("collect_client_info"),
                "propina": ecom_raw.get("takeaway", {}).get("tip"),
                "additional_input": ecom_raw.get("takeaway", {}).get("additional_input"),
                "disabled_until": ecom_raw.get("takeaway", {}).get("disabled_until")
            },
            "onsite": {
                "active": ecom_raw.get("onsite", {}).get("active"),
                "pedidos_programados_habilitados": ecom_raw.get("onsite", {}).get("scheduled_orders_enabled"),
                "recolectar_info_cliente": ecom_raw.get("onsite", {}).get("collect_client_info"),
                "onsite_qr_ordering": ecom_raw.get("onsite", {}).get("onsite_qr_ordering"),
                "propina": ecom_raw.get("onsite", {}).get("tip"),
                "additional_input": ecom_raw.get("onsite", {}).get("additional_input"),
                "disabled_until": ecom_raw.get("onsite", {}).get("disabled_until")
            },
            "table": {
                "active": ecom_raw.get("table", {}).get("active"),
                "propina": ecom_raw.get("table", {}).get("tip")
            }
        },
        "metodos_de_pago": payment_methods_clean,
        "horarios_de_atencion": {
            "fecha_servidor": current_date,
            "dias": attention_raw
        },
        "fidelizacion_loyalty": loyalty_raw,
        "redes_sociales": ecom_raw.get("social_networks_settings"),
        "tema_y_diseno_visual": ecom_raw.get("layout_settings"),
        "menu_pdf_settings": ecom_raw.get("menu_pdf_settings"),
        "reportes_programados": {
            "habilitado": ecom_raw.get("report_settings", {}).get("scheduled_report_enabled"),
            "tipo_reporte": ecom_raw.get("report_settings", {}).get("scheduled_report", {}).get("report_type"),
            "telefonos_notificacion_masked": [
                mask_text(p, keep=3)
                for p in ecom_raw.get("report_settings", {}).get("scheduled_report", {}).get("phone_numbers", [])
            ],
            "dias_envio_local": ecom_raw.get("report_settings", {}).get("scheduled_report", {}).get("send_days_local"),
            "hora_envio_local": ecom_raw.get("report_settings", {}).get("scheduled_report", {}).get("send_hour_local")
        },
        "google_settings": ecom_raw.get("google_settings"),
        "analytics_y_terceros_enmascarados": {
            "facebook_pixel_masked": mask_text(ecom_raw.get("analytics_settings", {}).get("facebook_pixel"), keep=3),
            "google_analytics_masked": mask_text(ecom_raw.get("analytics_settings", {}).get("google_analytics"), keep=3),
            "google_tag_manager_masked": mask_text(ecom_raw.get("analytics_settings", {}).get("google_tag_manager"), keep=3),
            "facebook_domain_verification_token_masked": mask_text(m_fb_token.group(1) if m_fb_token else "", keep=3)
        },
        "runtime_config_public": {
            "appEnv": m_env.group(1) if m_env else None,
            "appVersion": m_ver.group(1) if m_ver else None,
            "apiBaseUrl": m_api.group(1) if m_api else None,
            "awsS3BaseUrl": m_s3.group(1) if m_s3 else None,
            "websocketHost": m_ws.group(1) if m_ws else None
        }
    }

    with open(CONFIG_OUT, "w", encoding="utf-8") as f:
        json.dump(config_output, f, indent=2, ensure_ascii=False)

    print(f"Configuracion guardada exitosamente en {CONFIG_OUT} ({os.path.getsize(CONFIG_OUT)} bytes)")

if __name__ == "__main__":
    main()
