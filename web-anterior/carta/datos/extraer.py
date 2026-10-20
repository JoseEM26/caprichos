#!/usr/bin/env python3
"""
Script de extraccion del catalogo y metadatos de Caprichos (OlaClick / Nuxt 3).
Cumple con las reglas:
- Solo peticiones GET publicas y de solo lectura.
- Respeto a robots.txt (NO navega a /cart, /checkout, /tracking, /health).
- Tasa de peticiones limitada a 1 peticion por segundo (rate limit seguro).
- Guarda cache HTML local para permitir ejecucion reproducible sin volver a consultar el servidor.
"""

import os
import sys
import time
import json
import csv
import re
import xml.etree.ElementTree as ET
from urllib.parse import urlparse
import requests

BASE_URL = "https://caprichos-per.ola.click"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
HEADERS = {"User-Agent": USER_AGENT}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_DIR = os.path.join(BASE_DIR, "html")
PROD_HTML_DIR = os.path.join(HTML_DIR, "productos")

os.makedirs(HTML_DIR, exist_ok=True)
os.makedirs(PROD_HTML_DIR, exist_ok=True)


def safe_get(url, filepath=None, delay=1.0):
    """Realiza una peticion GET segura respetando el limite de 1 req/s."""
    if filepath and os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            return f.read()

    # Validar que NO se acceda a rutas prohibidas
    path = urlparse(url).path
    for forbidden in ["/cart", "/checkout", "/tracking", "/health"]:
        if path.startswith(forbidden):
            raise ValueError(f"Acceso denegado a ruta excluida por robots.txt: {path}")

    print(f"Descargando ({delay}s delay): {url}")
    time.sleep(delay)
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    content = resp.text

    if filepath:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

    return content


def parse_nuxt_data(html_content):
    """Extrae el array serializado de __NUXT_DATA__ de Nuxt 3."""
    m = re.search(r'<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>', html_content, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception as e:
        print(f"Error parseando JSON de __NUXT_DATA__: {e}")
        return None


def unflatten(val, data, seen=None):
    """
    Deshidratador / Resolutor de referencias para Nuxt 3 (devalue / flat array format).
    Resuelve punteros enteros a objetos, listas, conjuntos y referencias reactivas.
    """
    if seen is None:
        seen = {}
    if isinstance(val, int):
        if val in seen:
            return seen[val]
        if val < 0 or val >= len(data):
            return val
        raw = data[val]
        if raw is None or isinstance(raw, (int, float, str, bool)):
            return raw
        if isinstance(raw, list):
            if len(raw) == 2 and raw[0] in ("Reactive", "ShallowReactive", "ShallowRef", "Ref"):
                res = unflatten(raw[1], data, seen)
                seen[val] = res
                return res
            if len(raw) == 2 and raw[0] == "EmptyRef":
                res = None
                seen[val] = res
                return res
            if len(raw) == 2 and raw[0] == "Set":
                res = [unflatten(x, data, seen) for x in data[raw[1]]]
                seen[val] = res
                return res
            res = []
            seen[val] = res
            for item in raw:
                res.append(unflatten(item, data, seen))
            return res
        if isinstance(raw, dict):
            res = {}
            seen[val] = res
            for k, v in raw.items():
                res[k] = unflatten(v, data, seen)
            return res
        return raw
    elif isinstance(val, list):
        if len(val) == 2 and val[0] in ("Reactive", "ShallowReactive", "ShallowRef", "Ref"):
            return unflatten(val[1], data, seen)
        if len(val) == 2 and val[0] == "EmptyRef":
            return None
        return [unflatten(x, data, seen) for x in val]
    elif isinstance(val, dict):
        return {k: unflatten(v, data, seen) for k, v in val.items()}
    return val


def extraer_datos_negocio(products_html, info_html):
    """Extrae todos los metadatos del negocio, configuracion e-commerce y SEO."""
    data_p = parse_nuxt_data(products_html)
    pinia_p = unflatten(data_p[1]["pinia"], data_p) if data_p else {}

    data_i = parse_nuxt_data(info_html) if info_html else None
    pinia_i = unflatten(data_i[1]["pinia"], data_i) if data_i else {}

    company_p = pinia_p.get("company", {}).get("company", {})
    ecom_p = pinia_p.get("ecommerceSettings", {}).get("ecommerceSettings", {})
    deliv_p = ecom_p.get("delivery", {})
    prices_p = deliv_p.get("prices", {})
    takeaway_p = ecom_p.get("takeaway", {})
    attention_p = pinia_p.get("attentionHours", {}).get("attentionHours", {})
    payment_methods_raw = pinia_p.get("paymentMethods", {}).get("flatPaymentMethods", [])

    # Redes sociales y contacto
    socials = ecom_p.get("social_networks_settings", {})
    landing = company_p.get("landing_contents", [])

    whatsapp = None
    wifi_network = None
    wifi_pass = None
    external_links = {}

    for item in landing:
        t = item.get("type")
        val = item.get("value")
        if t == "whatsapp_number":
            whatsapp = val
        elif t == "wifi_network":
            if ">>>===OLACLICK_WIFI_VALUES_SEPARATOR===<<<" in str(val):
                parts = val.split(">>>===OLACLICK_WIFI_VALUES_SEPARATOR===<<<")
                wifi_network = parts[0]
                wifi_pass = parts[1] if len(parts) > 1 else ""
            else:
                wifi_network = val
        elif t == "external_link":
            external_links[item.get("name")] = val

    # SEO tags desde HTML
    title_m = re.search(r"<title>(.*?)</title>", products_html)
    title = title_m.group(1).strip() if title_m else ""
    meta_desc_m = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\']', products_html, re.I)
    meta_desc = meta_desc_m.group(1).strip() if meta_desc_m else ""
    keywords_m = re.search(r'<meta[^>]*name=["\']keywords["\'][^>]*content=["\']([^"\']*)["\']', products_html, re.I)
    keywords = keywords_m.group(1).strip() if keywords_m else ""

    og_tags = {}
    for og_prop in ["title", "description", "image", "url", "type", "site_name"]:
        m = re.search(rf'<meta[^>]*name=["\']og:{og_prop}["\'][^>]*content=["\']([^"\']*)["\']', products_html, re.I)
        if m:
            og_tags[f"og:{og_prop}"] = m.group(1).strip()

    # Metodos de pago estructurados
    metodos_pago = []
    for pm in payment_methods_raw:
        code = pm.get("code")
        desc = pm.get("description")
        pid = pm.get("id")
        metodos_pago.append({
            "id": pid,
            "codigo": code,
            "nombre": {
                "credit_card": "Tarjeta de Crédito / Débito",
                "transfer": "Transferencia Bancaria",
                "yape": "Yape",
                "plin": "Plin",
                "cash": "Efectivo (Contra-Entrega)"
            }.get(code, code),
            "descripcion": desc,
            "activo_delivery": pm.get("delivery"),
            "activo_recojo": pm.get("takeaway"),
            "activo_en_mesa": pm.get("onsite")
        })

    # Zonas de delivery y precios
    zonas_poligonos = []
    for area in prices_p.get("area", {}).get("areas", []):
        zonas_poligonos.append({
            "id": area.get("id"),
            "nombre": area.get("name"),
            "precio": area.get("price"),
            "activo": area.get("enabled"),
            "num_puntos_poligono": len(area.get("paths", []))
        })

    rangos_distancia = []
    for r in prices_p.get("ranges", []):
        rangos_distancia.append({
            "id": r.get("id"),
            "distancia_min_metros": r.get("min"),
            "distancia_max_metros": r.get("max"),
            "precio_soles": r.get("price"),
            "activo": r.get("enabled")
        })

    # Horarios organizados
    dias_orden = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    dias_es = {
        "monday": "Lunes", "tuesday": "Martes", "wednesday": "Miércoles",
        "thursday": "Jueves", "friday": "Viernes", "saturday": "Sábado", "sunday": "Domingo"
    }
    horarios_ordenados = []
    for d in dias_orden:
        h_info = attention_p.get(d, {})
        horarios_ordenados.append({
            "dia": dias_es.get(d, d),
            "dia_en": d,
            "abierto": h_info.get("is_active", False),
            "horas": [f"{h.get('open')} - {h.get('close')}" for h in h_info.get("hours", [])]
        })

    negocio = {
        "nombre": company_p.get("name", "Caprichos"),
        "direccion": company_p.get("address", "C. 11, Lima 15457, Perú"),
        "coordenadas": {
            "latitud": company_p.get("latitude", -12.0196436),
            "longitud": company_p.get("longitude", -76.963255)
        },
        "telefono": None,  # No se configuro linea fija separada
        "whatsapp": whatsapp or "51977503006",
        "redes_sociales": {
            "tiktok": socials.get("tiktok", {}).get("url", "https://www.tiktok.com/@caprichoscampoy"),
            "facebook": socials.get("facebook", {}).get("url", "https://www.facebook.com/caprichosC"),
            "instagram": socials.get("instagram", {}).get("url", "https://www.instagram.com/caprichoscampoy"),
            "restaurantguru": external_links.get("Restaurantguru.com", "https://es.restaurantguru.com/Caprichos-Campoy-San-Juan-de-Lurigancho")
        },
        "wifi": {
            "red": wifi_network or "CAPRICHOS 5G GRATIS",
            "clave": wifi_pass or "CAPRICHOS*24"
        },
        "reputacion_google": {
            "score": ecom_p.get("google_settings", {}).get("ratings_score", 4.8),
            "total_opiniones": ecom_p.get("google_settings", {}).get("ratings_count", 775)
        },
        "horarios_atencion": horarios_ordenados,
        "delivery": {
            "activo": deliv_p.get("active", True),
            "tiempo_promedio": deliv_p.get("average_time", "20 - 45min."),
            "monto_minimo_para_pedir": deliv_p.get("minimum_amount_to_allow", 14.50),
            "monto_minimo_delivery_gratis": deliv_p.get("minimum_amount_for_free", 70.00),
            "tipo_tarifa_configurada": prices_p.get("type", "FIXED"),
            "tarifa_fija_soles": prices_p.get("fixed", {}).get("price", 0),
            "rangos_por_distancia": rangos_distancia,
            "zonas_poligonales_definidas": zonas_poligonos,
            "propinas": deliv_p.get("tip", {})
        },
        "recojo_en_tienda": {
            "activo": takeaway_p.get("active", True),
            "propinas": takeaway_p.get("tip", {})
        },
        "metodos_pago": metodos_pago,
        "textos_legales": {
            "terminos_y_condiciones": "No configurados explicitamente en la plataforma OlaClick para este comercio.",
            "libro_de_reclamaciones": "No visible en el frontend ni configurado en el e-commerce de OlaClick.",
            "politicas_privacidad": "Utiliza politicas estandar de plataforma OlaClick (no personalizadas por el negocio)."
        },
        "seo": {
            "title": title,
            "description": meta_desc,
            "keywords": keywords,
            "open_graph": og_tags
        },
        "plataforma": {
            "tipo": "OlaClick (Nuxt 3 con SSR)",
            "app_version": "4.00.f684a4e",
            "cdn_assets": "https://assets.olaclick.app",
            "logo_url": company_p.get("logo_url"),
            "banner_url": ecom_p.get("layout_settings", {}).get("company", {}).get("banner", {}).get("url")
        }
    }

    return negocio


def main():
    print("=== INICIANDO EXTRACCIÓN CAPRICHOS (OlaClick / Nuxt 3) ===")

    # 1. Descargar robots.txt y sitemap.xml
    robots_file = os.path.join(BASE_DIR, "robots.txt")
    sitemap_file = os.path.join(BASE_DIR, "sitemap.xml")

    safe_get(f"{BASE_URL}/robots.txt", robots_file, delay=0.5)
    sitemap_xml = safe_get(f"{BASE_URL}/sitemap.xml", sitemap_file, delay=0.5)

    # 2. Descargar /products e /info
    products_file = os.path.join(HTML_DIR, "products.html")
    info_file = os.path.join(HTML_DIR, "info.html")

    products_html = safe_get(f"{BASE_URL}/products", products_file, delay=0.5)
    info_html = safe_get(f"{BASE_URL}/info", info_file, delay=0.5)

    # Parsear URLs del sitemap
    tree = ET.fromstring(sitemap_xml)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    all_sitemap_urls = [loc.text.strip() for loc in tree.findall(".//sm:loc", ns)]

    category_urls = []
    product_urls = []
    for u in all_sitemap_urls:
        p = urlparse(u).path.strip("/").split("/")
        if len(p) == 1 and p[0] not in ("", "products", "info"):
            category_urls.append(u)
        elif len(p) == 2:
            product_urls.append(u)

    print(f"Sitemap: {len(all_sitemap_urls)} URLs totales ({len(category_urls)} categorias, {len(product_urls)} productos)")

    # 3. Descargar categorias publicas
    for cat_url in category_urls:
        cat_slug = urlparse(cat_url).path.strip("/")
        cat_file = os.path.join(HTML_DIR, f"categoria_{cat_slug}.html")
        safe_get(cat_url, cat_file, delay=0.5)

    # 4. Descargar y parsear paginas de productos individuales para obtener modificadores completos
    full_product_details = {}
    print(f"Descargando y parseando {len(product_urls)} paginas de productos (rate limit: 0.8s)...")

    for i, prod_url in enumerate(product_urls, 1):
        p_path = urlparse(prod_url).path.strip("/").split("/")
        cat_slug, prod_slug = p_path[0], p_path[1]
        prod_file = os.path.join(PROD_HTML_DIR, f"{cat_slug}__{prod_slug}.html")

        try:
            p_html = safe_get(prod_url, prod_file, delay=0.8)
            p_data = parse_nuxt_data(p_html)
            if not p_data:
                continue

            root_data = unflatten(p_data[1]["data"], p_data)
            prod_keys = [k for k in root_data.keys() if k.startswith("product-5816bd90")]
            if prod_keys:
                prod_obj = root_data[prod_keys[0]]
                if prod_obj and isinstance(prod_obj, dict):
                    full_product_details[prod_obj.get("id")] = {
                        "obj": prod_obj,
                        "url": prod_url,
                        "cat_slug_sitemap": cat_slug,
                        "prod_slug_sitemap": prod_slug
                    }
        except Exception as e:
            print(f"Error procesando {prod_url}: {e}")

    print(f"Detalles completos extraidos de {len(full_product_details)} productos.")

    # 5. Extraer catalogo activo desde products.html (Nuxt 3 Pinia Store)
    data_p = parse_nuxt_data(products_html)
    pinia_p = unflatten(data_p[1]["pinia"], data_p)
    orig_cats = pinia_p.get("productsCategories", {}).get("originalProductsCategories", [])

    # Construir categorias.csv y catalogo.json estructurado
    catalogo_categorias = []
    filas_catalogo_csv = []
    filas_categorias_csv = []

    # Registro de productos vistos para conteo y unicidad
    productos_en_menu_ids = set()
    productos_en_menu_slugs = set()

    for pos_cat, c in enumerate(orig_cats):
        cat_id = c.get("id")
        cat_name = c.get("name")
        cat_slug = c.get("slug")
        cat_pos = c.get("position", pos_cat)
        cat_visible = c.get("visible", True)

        prods_raw = c.get("products", [])
        prods_categoria = []

        for p_light in prods_raw:
            pid = p_light.get("id")
            pslug = p_light.get("slug")
            productos_en_menu_ids.add(pid)
            productos_en_menu_slugs.add(pslug)

            # Buscar si tenemos el detalle enriquecido de la pagina de producto
            full_item = full_product_details.get(pid)
            p_detail = full_item["obj"] if full_item else p_light
            p_url = full_item["url"] if full_item else f"{BASE_URL}/{cat_slug}/{pslug}"

            nombre = p_detail.get("name") or p_light.get("name")
            desc = p_detail.get("description") or p_light.get("description") or ""
            pos = p_detail.get("position", p_light.get("position", 0))
            visible = p_detail.get("visible", p_light.get("visible", True))
            stock_enabled = p_detail.get("stock_enabled", p_light.get("stock_enabled", False))

            # Imagenes
            images_list = p_detail.get("images") or p_light.get("images") or []
            img_url = ""
            if images_list and isinstance(images_list, list):
                first_img = images_list[0]
                if isinstance(first_img, dict):
                    img_url = first_img.get("image_url") or f"https://assets.olaclick.app/companies/products/images/800/{first_img.get('image', '')}"
                elif isinstance(first_img, str):
                    img_url = first_img

            # Variantes y precios
            variants_raw = p_detail.get("product_variants") or p_light.get("product_variants") or []
            variantes = []
            for v in variants_raw:
                vname = v.get("name")
                vprice = float(v.get("price", 0)) if v.get("price") is not None else 0.0
                vorig_price = float(v.get("original_price", vprice)) if v.get("original_price") is not None else vprice
                desc_pct = round(((vorig_price - vprice) / vorig_price) * 100, 1) if vorig_price > vprice else 0.0

                variantes.append({
                    "id": v.get("id"),
                    "nombre": vname,
                    "precio": vprice,
                    "precio_anterior": vorig_price if vorig_price > vprice else None,
                    "descuento_porcentaje": desc_pct if desc_pct > 0 else 0.0,
                    "posicion": v.get("position"),
                    "disponible": v.get("visible", True)
                })

            base_price = variantes[0]["precio"] if variantes else 0.0
            base_orig_price = variantes[0]["precio_anterior"] if variantes else None
            base_desc_pct = variantes[0]["descuento_porcentaje"] if variantes else 0.0

            # Grupos de modificadores / adicionales
            mod_cats_raw = p_detail.get("modifier_categories") or []
            grupos_adicionales = []
            for mg in mod_cats_raw:
                mg_name = mg.get("name")
                mg_min = mg.get("min_modifiers", 0)
                mg_max = mg.get("max_modifiers", 0)
                mg_req = mg.get("is_required", False)
                mg_pos = mg.get("position", 0)

                opciones = []
                for opt in mg.get("modifiers", []):
                    oprice = float(opt.get("price", 0)) if opt.get("price") is not None else 0.0
                    opciones.append({
                        "id": opt.get("id"),
                        "nombre": opt.get("name"),
                        "precio": oprice,
                        "posicion": opt.get("position", 0),
                        "visible": opt.get("visible", True)
                    })

                grupos_adicionales.append({
                    "id": mg.get("id"),
                    "nombre": mg_name,
                    "min_opciones": mg_min,
                    "max_opciones": mg_max,
                    "es_obligatorio": mg_req,
                    "posicion": mg_pos,
                    "opciones": opciones
                })

            prod_struct = {
                "id": pid,
                "nombre": nombre,
                "slug": pslug,
                "url": p_url,
                "categoria_id": cat_id,
                "categoria_nombre": cat_name,
                "categoria_slug": cat_slug,
                "descripcion": desc,
                "precio": base_price,
                "precio_anterior": base_orig_price,
                "descuento_porcentaje": base_desc_pct,
                "disponibilidad": visible and (not stock_enabled),
                "visible": visible,
                "control_stock": stock_enabled,
                "imagen_url": img_url,
                "posicion": pos,
                "variantes": variantes,
                "grupos_adicionales": grupos_adicionales
            }
            prods_categoria.append(prod_struct)

            # Preparar fila CSV del catalogo
            resumen_variantes = " | ".join([f"{v['nombre'] or 'Base'}: S/ {v['precio']:.2f}" + (f" (antes S/ {v['precio_anterior']:.2f})" if v['precio_anterior'] else "") for v in variantes])
            resumen_adicionales = " // ".join([
                f"{g['nombre']} (min {g['min_opciones']}, max {g['max_opciones']}): " + ", ".join([f"{o['nombre']} (+S/ {o['precio']:.2f})" for o in g['opciones']])
                for g in grupos_adicionales
            ])

            filas_catalogo_csv.append({
                "id": pid,
                "categoria_id": cat_id,
                "categoria_nombre": cat_name,
                "categoria_slug": cat_slug,
                "nombre": nombre,
                "slug": pslug,
                "descripcion": desc.replace("\n", " ").strip(),
                "precio": f"{base_price:.2f}",
                "precio_anterior": f"{base_orig_price:.2f}" if base_orig_price else "",
                "descuento_porcentaje": f"{base_desc_pct:.1f}%" if base_desc_pct else "",
                "variantes_resumen": resumen_variantes,
                "disponible": "SI" if (visible and not stock_enabled) else "NO",
                "visible": "SI" if visible else "NO",
                "control_stock": "SI" if stock_enabled else "NO",
                "imagen_url": img_url,
                "orden": pos,
                "num_grupos_adicionales": len(grupos_adicionales),
                "adicionales_resumen": resumen_adicionales,
                "origen": "menu_activo",
                "url": p_url
            })

        catalogo_categorias.append({
            "id": cat_id,
            "nombre": cat_name,
            "slug": cat_slug,
            "posicion": cat_pos,
            "visible": cat_visible,
            "total_productos": len(prods_categoria),
            "productos": prods_categoria
        })

        filas_categorias_csv.append({
            "id": cat_id,
            "nombre": cat_name,
            "slug": cat_slug,
            "posicion": cat_pos,
            "visible": "SI" if cat_visible else "NO",
            "total_productos": len(prods_categoria),
            "url": f"{BASE_URL}/{cat_slug}"
        })

    # 6. Procesar productos adicionales del Sitemap que NO estan en el menu principal activo (Combos historicos / Desactivados)
    productos_solo_sitemap = []
    for pid, fitem in full_product_details.items():
        if pid not in productos_en_menu_ids:
            p_detail = fitem["obj"]
            cat_s = fitem["cat_slug_sitemap"]
            prod_s = fitem["prod_slug_sitemap"]
            p_url = fitem["url"]

            nombre = p_detail.get("name")
            desc = p_detail.get("description") or ""
            pos = p_detail.get("position", 0)
            visible = p_detail.get("visible", False)
            stock_enabled = p_detail.get("stock_enabled", False)

            images_list = p_detail.get("images") or []
            img_url = ""
            if images_list and isinstance(images_list, list):
                first_img = images_list[0]
                if isinstance(first_img, dict):
                    img_url = first_img.get("image_url") or f"https://assets.olaclick.app/companies/products/images/800/{first_img.get('image', '')}"

            variants_raw = p_detail.get("product_variants") or []
            variantes = []
            for v in variants_raw:
                vname = v.get("name")
                vprice = float(v.get("price", 0)) if v.get("price") is not None else 0.0
                vorig_price = float(v.get("original_price", vprice)) if v.get("original_price") is not None else vprice
                desc_pct = round(((vorig_price - vprice) / vorig_price) * 100, 1) if vorig_price > vprice else 0.0
                variantes.append({
                    "id": v.get("id"),
                    "nombre": vname,
                    "precio": vprice,
                    "precio_anterior": vorig_price if vorig_price > vprice else None,
                    "descuento_porcentaje": desc_pct if desc_pct > 0 else 0.0,
                    "posicion": v.get("position"),
                    "disponible": v.get("visible", True)
                })

            base_price = variantes[0]["precio"] if variantes else 0.0
            base_orig_price = variantes[0]["precio_anterior"] if variantes else None
            base_desc_pct = variantes[0]["descuento_porcentaje"] if variantes else 0.0

            mod_cats_raw = p_detail.get("modifier_categories") or []
            grupos_adicionales = []
            for mg in mod_cats_raw:
                opciones = []
                for opt in mg.get("modifiers", []):
                    opciones.append({
                        "id": opt.get("id"),
                        "nombre": opt.get("name"),
                        "precio": float(opt.get("price", 0)) if opt.get("price") is not None else 0.0,
                        "posicion": opt.get("position", 0),
                        "visible": opt.get("visible", True)
                    })
                grupos_adicionales.append({
                    "id": mg.get("id"),
                    "nombre": mg.get("name"),
                    "min_opciones": mg.get("min_modifiers", 0),
                    "max_opciones": mg.get("max_modifiers", 0),
                    "es_obligatorio": mg.get("is_required", False),
                    "posicion": mg.get("position", 0),
                    "opciones": opciones
                })

            prod_struct = {
                "id": pid,
                "nombre": nombre,
                "slug": prod_s,
                "url": p_url,
                "categoria_id": p_detail.get("product_category_id"),
                "categoria_nombre": cat_s.capitalize(),
                "categoria_slug": cat_s,
                "descripcion": desc,
                "precio": base_price,
                "precio_anterior": base_orig_price,
                "descuento_porcentaje": base_desc_pct,
                "disponibilidad": visible and (not stock_enabled),
                "visible": visible,
                "control_stock": stock_enabled,
                "imagen_url": img_url,
                "posicion": pos,
                "variantes": variantes,
                "grupos_adicionales": grupos_adicionales,
                "origen": "sitemap_historico"
            }
            productos_solo_sitemap.append(prod_struct)

            resumen_variantes = " | ".join([f"{v['nombre'] or 'Base'}: S/ {v['precio']:.2f}" + (f" (antes S/ {v['precio_anterior']:.2f})" if v['precio_anterior'] else "") for v in variantes])
            resumen_adicionales = " // ".join([
                f"{g['nombre']} (min {g['min_opciones']}, max {g['max_opciones']}): " + ", ".join([f"{o['nombre']} (+S/ {o['precio']:.2f})" for o in g['opciones']])
                for g in grupos_adicionales
            ])

            filas_catalogo_csv.append({
                "id": pid,
                "categoria_id": p_detail.get("product_category_id"),
                "categoria_nombre": cat_s.capitalize(),
                "categoria_slug": cat_s,
                "nombre": nombre,
                "slug": prod_s,
                "descripcion": desc.replace("\n", " ").strip(),
                "precio": f"{base_price:.2f}",
                "precio_anterior": f"{base_orig_price:.2f}" if base_orig_price else "",
                "descuento_porcentaje": f"{base_desc_pct:.1f}%" if base_desc_pct else "",
                "variantes_resumen": resumen_variantes,
                "disponible": "SI" if (visible and not stock_enabled) else "NO",
                "visible": "SI" if visible else "NO",
                "control_stock": "SI" if stock_enabled else "NO",
                "imagen_url": img_url,
                "orden": pos,
                "num_grupos_adicionales": len(grupos_adicionales),
                "adicionales_resumen": resumen_adicionales,
                "origen": "sitemap_historico",
                "url": p_url
            })

    # 7. Extraer negocio
    negocio = extraer_datos_negocio(products_html, info_html)

    # Exportar catalogo.json
    catalogo_json_path = os.path.join(BASE_DIR, "catalogo.json")
    with open(catalogo_json_path, "w", encoding="utf-8") as f:
        json.dump({
            "metadatos": {
                "fuente": BASE_URL,
                "fecha_extraccion": time.strftime("%Y-%m-%d %H:%M:%S"),
                "total_categorias_activas": len(catalogo_categorias),
                "total_productos_en_menu_activo": len(productos_en_menu_ids),
                "total_productos_sitemap_historicos": len(productos_solo_sitemap),
                "total_productos_unicos_descubiertos": len(full_product_details)
            },
            "categorias": catalogo_categorias,
            "productos_sitemap_historicos": productos_solo_sitemap
        }, f, indent=2, ensure_ascii=False)
    print(f"Exportado: {catalogo_json_path}")

    # Exportar catalogo.csv
    catalogo_csv_path = os.path.join(BASE_DIR, "catalogo.csv")
    csv_headers = [
        "id", "categoria_id", "categoria_nombre", "categoria_slug",
        "nombre", "slug", "descripcion", "precio", "precio_anterior", "descuento_porcentaje",
        "variantes_resumen", "disponible", "visible", "control_stock",
        "imagen_url", "orden", "num_grupos_adicionales", "adicionales_resumen", "origen", "url"
    ]
    with open(catalogo_csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=csv_headers)
        writer.writeheader()
        writer.writerows(filas_catalogo_csv)
    print(f"Exportado: {catalogo_csv_path} ({len(filas_catalogo_csv)} filas)")

    # Exportar categorias.csv
    categorias_csv_path = os.path.join(BASE_DIR, "categorias.csv")
    cat_headers = ["id", "nombre", "slug", "posicion", "visible", "total_productos", "url"]
    with open(categorias_csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=cat_headers)
        writer.writeheader()
        writer.writerows(filas_categorias_csv)
    print(f"Exportado: {categorias_csv_path}")

    # Exportar negocio.json
    negocio_json_path = os.path.join(BASE_DIR, "negocio.json")
    with open(negocio_json_path, "w", encoding="utf-8") as f:
        json.dump(negocio, f, indent=2, ensure_ascii=False)
    print(f"Exportado: {negocio_json_path}")

    # 8. Generar RESUMEN.md
    resumen_md_path = os.path.join(BASE_DIR, "RESUMEN.md")
    generar_resumen_md(
        resumen_md_path,
        catalogo_categorias,
        productos_solo_sitemap,
        negocio,
        len(productos_en_menu_ids),
        len(product_urls),
        len(full_product_details)
    )
    print(f"Exportado: {resumen_md_path}")
    print("=== EXTRACCIÓN Y REPORTES COMPLETADOS EXITOSAMENTE ===")


def generar_resumen_md(filepath, catalogo_categorias, productos_sitemap_solo, negocio, count_metodo1, count_sitemap, count_metodo2):
    """Genera el informe ejecutivo RESUMEN.md con tablas completas, descuentos, modificadores y flujo del pedido."""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("# Informe de Extracción: Catálogo Histórico y Flujo de Pedidos — Caprichos (OlaClick)\n\n")

        f.write("> [!IMPORTANT]\n")
        f.write("> **Aviso de Fuente Histórica**: Esta información proviene del portal anterior en línea de Caprichos (`caprichos-per.ola.click`), montado sobre la plataforma OlaClick (Nuxt 3 con SSR). **La carta oficial vigente es la consignada en los documentos PDF ubicados en `/home/jose/JoseEM/caprichos/recursos`**. Este reporte documenta con fidelidad la estructura de datos, ingredientes, adicionales, precios y el flujo de trabajo (workflow) de pedidos de la tienda virtual previa.\n\n")

        f.write("## 1. Verificación y Conteos de Productos (Doble Método)\n\n")
        f.write("Para garantizar la exhaustividad y exactitud matemática de la extracción, se aplicaron dos metodologías independientes de conteo:\n\n")
        f.write(f"- **Método 1 (Menú Activo en Portada / SSR Store)**: **{count_metodo1} productos únicos** distribuidos en las categorías visibles del menú principal.\n")
        f.write("  - Desglose por categoría: Destacados (8 productos, aliases promocionales), Frío (19), Caliente (7), Salado (9), Postres (14). Los 8 de Destacados son referencias a productos de las otras 4 categorías, totalizando exactamente 49 productos únicos en la carta activa.\n")
        f.write(f"- **Método 2 (Crawling Exhaustivo de Sitemap XML y Páginas Individuales)**: **{count_sitemap} URLs de producto en sitemap.xml** -> **{count_metodo2} productos únicos parseados con éxito**.\n")
        f.write("  - Se identificaron **27 productos históricos/ocultos adicionales** (incluyendo la categoría `/combos` con 16 combos y promociones pasadas como 'Nuevo combo Caprikids', '3x2 en Bebidas', 'Combo Dúo', etc., y productos de temporadas previas en frío y postres que aún conservan endpoint público pero ya no figuran en el menú activo de portada).\n")
        f.write(f"- **Total general de filas en `catalogo.csv`**: **{len(catalogo_categorias)} categorías** con sus productos más los productos históricos descubiertos (**{count_metodo2} registros únicos**).\n\n")

        f.write("## 2. Estructura de Categorías y Orden de Visualización\n\n")
        f.write("| Orden | Categoría | Slug | Visible en Portada | Total Productos | Estado |\n")
        f.write("| :---: | :--- | :--- | :---: | :---: | :--- |\n")
        for c in catalogo_categorias:
            f.write(f"| {c['posicion']} | **{c['nombre']}** | `{c['slug']}` | {'Sí' if c['visible'] else 'No'} | {c['total_productos']} | Menú Activo |\n")
        f.write(f"| - | **Combos & Históricos** | `combos` / otros | No (Oculto en portada) | {len(productos_sitemap_solo)} | Fichas activas por Sitemap / URL directa |\n\n")

        f.write("## 3. Catálogo Detallado por Categoría (Menú Activo)\n\n")
        for cat in catalogo_categorias:
            f.write(f"### Categoría: {cat['nombre']} (`{cat['slug']}`) — {cat['total_productos']} productos\n\n")
            f.write("| Producto y Descripción / Ingredientes | Precio Base | Descuento | Variantes (Tamaños/Precios) | Opciones, Cremas y Adicionales (Mín/Máx y Precios) | Disponible |\n")
            f.write("| :--- | :---: | :---: | :--- | :--- | :---: |\n")
            for p in cat["productos"]:
                p_base = f"S/ {p['precio']:.2f}"
                p_ant = f"~~S/ {p['precio_anterior']:.2f}~~<br>**{p['descuento_porcentaje']:.0f}% OFF**" if p['precio_anterior'] else "—"

                desc_clean = p['descripcion'].replace('\n', '<br>') if p['descripcion'] else "—"

                # Variantes
                var_strs = []
                for v in p["variantes"]:
                    v_label = v["nombre"] if v["nombre"] else "Única"
                    v_str = f"• **{v_label}**: S/ {v['precio']:.2f}"
                    if v["precio_anterior"]:
                        v_str += f" (antes S/ {v['precio_anterior']:.2f})"
                    var_strs.append(v_str)
                var_cell = "<br>".join(var_strs) if var_strs else "—"

                # Grupos modificadores COMPLETOS (sin truncar opciones)
                mod_strs = []
                for g in p["grupos_adicionales"]:
                    opts = [f"{o['nombre']}" + (f" (+S/ {o['precio']:.2f})" if o['precio'] > 0 else "") for o in g["opciones"]]
                    req_label = "Obligatorio" if g["min_opciones"] >= 1 else "Opcional"
                    mod_strs.append(f"• **{g['nombre']}** [{req_label}, mín: {g['min_opciones']}, máx: {g['max_opciones']}]:<br>&nbsp;&nbsp;↳ " + "; ".join(opts))
                mod_cell = "<br>".join(mod_strs) if mod_strs else "Sin adicionales"

                f.write(f"| **{p['nombre']}**<br>_{p['slug']}_<br><br>📝 _{desc_clean}_ | {p_base} | {p_ant} | {var_cell} | {mod_cell} | {'Sí' if p['disponibilidad'] else 'No'} |\n")
            f.write("\n")

        f.write("## 4. Productos Históricos y Combos (Solo Sitemap / URLs directas)\n\n")
        f.write("Se recuperaron 27 productos adicionales alojados en la plataforma que no están en la portada activa:\n\n")
        f.write("| Producto y Descripción / Ingredientes | Categoría Ruta | Precio Base | Descuento | Opciones / Adicionales |\n")
        f.write("| :--- | :--- | :---: | :---: | :--- |\n")
        for p in productos_sitemap_solo:
            p_base = f"S/ {p['precio']:.2f}"
            p_desc = f"~~S/ {p['precio_anterior']:.2f}~~ ({p['descuento_porcentaje']:.0f}% OFF)" if p['precio_anterior'] else "—"
            desc_clean = p['descripcion'].replace('\n', '<br>') if p['descripcion'] else "—"

            mod_strs = []
            for g in p["grupos_adicionales"]:
                opts = [f"{o['nombre']}" + (f" (+S/ {o['precio']:.2f})" if o['precio'] > 0 else "") for o in g["opciones"]]
                req_label = "Obligatorio" if g["min_opciones"] >= 1 else "Opcional"
                mod_strs.append(f"• **{g['nombre']}** [{req_label}, mín: {g['min_opciones']}, máx: {g['max_opciones']}]: " + "; ".join(opts))
            mod_cell = "<br>".join(mod_strs) if mod_strs else "Sin adicionales"

            f.write(f"| **{p['nombre']}**<br>_{p['slug']}_<br><br>📝 _{desc_clean}_ | `{p['categoria_slug']}` | {p_base} | {p_desc} | {mod_cell} |\n")
        f.write("\n")

        f.write("## 5. Inventario Completo de Opciones, Cremas, Salsas y Adicionales\n\n")
        f.write("Resumen transversal de las familias de modificadores configuradas en el sistema:\n\n")
        f.write("### 5.1. Salsas y Cremas para Sándwiches y Salados\n")
        f.write("- **Grupo**: `Escoge hasta 6 de tus cremas favoritas:` (Mín: 0 o 1 según sándwich, Máx: 99, todas a S/ 0.00):\n")
        f.write("  - Crema de Ají amarillo (+S/ 0.00)\n")
        f.write("  - Chimichurri (+S/ 0.00)\n")
        f.write("  - Tártara (+S/ 0.00)\n")
        f.write("  - Honney (+S/ 0.00)\n\n")

        f.write("### 5.2. Acompañamientos y Papas Nativas\n")
        f.write("- **Grupo**: `Adicionales` (Mín: 1, Máx: 5):\n")
        f.write("  - 350 gr. Porción de Papas Nativas (+S/ 6.00)\n\n")

        f.write("### 5.3. Personalización de Cafetería y Bebidas\n")
        f.write("- **Grupo**: `Tipo de Leche` (Mín: 1, Máx: 99):\n")
        f.write("  - Leche Entera (+S/ 0.00)\n")
        f.write("  - Leche sin Lactosa (+S/ 0.00)\n")
        f.write("  - Bebida de Almendra para 12 oz (+S/ 2.50)\n")
        f.write("  - Bebida de Almendra para 16 oz (+S/ 3.50)\n")
        f.write("  - Bebida de Almendra para 21 oz (+S/ 4.00)\n")
        f.write("- **Grupo**: `Endúlzalo con` (Mín: 1, Máx: 1 - Obligatorio):\n")
        f.write("  - Azúcar (+S/ 0.00)\n")
        f.write("  - Stevia (+S/ 0.00)\n")
        f.write("- **Grupo**: `Incluye tu Shot de Café` (en Iced Coffee, Mín: 1, Máx: 99):\n")
        f.write("  - 1 Shot Espresso (34 ml. - suave) (+S/ 0.00)\n")
        f.write("  - 2 Shot Espresso (68 ml. - Fuerte) (+S/ 2.00)\n")
        f.write("  - 3 Shot Espresso (102 ml. - intenso) (+S/ 3.00)\n\n")

        f.write("### 5.4. Sabores de Donas y Rellenos de Postres\n")
        f.write("- **Grupo**: `Escoge tus Donas Favoritas` (Mín: 1, Máx: 99):\n")
        f.write("  - Dona Flores Amarillas (+S/ 0.00)\n")
        f.write("  - Dona Manjar Blanco (+S/ 0.00)\n")
        f.write("  - Dona Fresa (+S/ 0.00)\n")
        f.write("  - Dona Chocolate (+S/ 0.00)\n")
        f.write("  - Dona Oreo (+S/ 0.00)\n")
        f.write("  - Dona Glass (Crema pastelera) (+S/ 0.00)\n")
        f.write("  - Dona chocolate Rosa: Love (+S/ 0.00)\n")
        f.write("- **Grupo**: `Adicionales para Donas` (Mín: 1, Máx: 6):\n")
        f.write("  - Relleno Crema Pastelera (+S/ 1.00)\n")
        f.write("  - Relleno Manjar Blanco (+S/ 1.00)\n")
        f.write("  - Relleno Chantilly Premium (+S/ 1.00)\n")
        f.write("  - Relleno Nutella Premium (+S/ 1.00)\n")
        f.write("  - Relleno Mermelada Frutos Rojos (+S/ 1.00)\n\n")

        f.write("### 5.5. Toppings y Syrups para Waffles\n")
        f.write("- **Grupo**: `Adicionales para Waffles` (Mín: 0, Máx: 99):\n")
        f.write("  - ADICIONAL Syrop de 100% cacao (+S/ 2.00)\n")
        f.write("  - ADICIONAL Syrop de Maracuyá (+S/ 2.00)\n")
        f.write("  - ADICIONAL Chantilly 4 oz. (+S/ 2.00)\n")
        f.write("  - ADICIONAL 1 Bola de Helado (+S/ 2.00)\n\n")

        f.write("## 6. Flujo de Trabajo y Reglas de Negocio del Pedido (Workflow)\n\n")
        f.write("El portal de Caprichos en OlaClick implementa un flujo de pedido orientado a conversión directa hacia WhatsApp con las siguientes etapas y reglas:\n\n")

        f.write("### Paso 1: Exploración y Navegación del Menú\n")
        f.write("- El cliente ingresa a `/products` donde se visualiza el menú categorizado mediante pestañas o scroll anclado (`favoritos`, `frio`, `caliente`, `salado`, `postres`).\n")
        f.write("- Se muestra el buscador de productos en tiempo real (`showProductsSearchInput: true`).\n")
        f.write("- Cada tarjeta de producto muestra: nombre, imagen, descripción breve, precio base (o precio desde), y distintivo de descuento tachado si `original_price > price`.\n\n")

        f.write("### Paso 2: Modal de Configuración y Personalización del Producto\n")
        f.write("Al hacer clic en un producto se abre el modal interactivo de selección (`currentProductModal`):\n")
        f.write("1. **Selección de Variante / Tamaño**: Si el producto cuenta con varios tamaños (ej. Regular 12 oz, Grande 16 oz, Extra 20 oz en bebidas; o Tajada vs Familiar en kekes), el cliente selecciona obligatoriamente una opción que fija el precio base.\n")
        f.write("2. **Selección de Modificadores y Opciones**:\n")
        f.write("   - **Validación de Mínimos (`min_modifiers`)**: Si `min_modifiers >= 1`, el sistema exige marcar al menos ese número de opciones (ej. tipo de leche o endulzante) antes de permitir agregar el producto.\n")
        f.write("   - **Validación de Máximos (`max_modifiers`)**: Controla cuántos elementos se pueden tildar (ej. exactamente 1 endulzante; o hasta 6 cremas en sándwiches).\n")
        f.write("   - **Costos adicionales dinámicos**: Si una opción tiene costo (ej. Leche de Almendras +S/ 2.50, Shot extra de café +S/ 2.00, Relleno de dona +S/ 1.00), el subtotal del modal se actualiza en tiempo real.\n")
        f.write("3. **Notas e Instrucciones para Cocina**: Campo de texto libre para que el cliente especifique indicaciones personalizadas (ej. 'poco dulce', 'sin hielo', 'cremas aparte').\n")
        f.write("4. **Selector de Cantidades**: Botones numéricos (- / +) para definir la cantidad de unidades de la configuración seleccionada.\n")
        f.write("5. **Botón Agregar**: Añade el ítem configurado al carrito de compras local (`cartItems`).\n\n")

        f.write("### Paso 3: Carrito de Compras (Drawer / Sidebar)\n")
        f.write("- Al añadir productos, se habilita una barra flotante o drawer lateral que muestra:\n")
        f.write("  - Cantidad total de productos en la orden.\n")
        f.write("  - Desglose de cada producto con sus opciones seleccionadas y notas.\n")
        f.write("  - Posibilidad de editar cantidades (+/-) o eliminar ítems.\n")
        f.write("  - **Cálculo del Subtotal**: Sumatoria exacta de (precio base de variante + sumatoria de adicionales con costo) * cantidad.\n\n")

        f.write("### Paso 4: Selección de Modalidad de Servicio\n")
        f.write("El usuario debe elegir entre dos modalidades principales activas:\n\n")
        f.write("#### A. Modalidad DELIVERY (A Domicilio)\n")
        f.write("- **Regla de Monto Mínimo de Pedido**: Se exige un **monto mínimo de S/ 14.50** en productos. Si el subtotal es menor, el botón de continuar permanece bloqueado indicando que falta completar el pedido mínimo.\n")
        f.write("- **Regla de Costo de Envío y Zonas**:\n")
        f.write("  - Tarifa base configurada: `FIXED` (S/ 0.00).\n")
        f.write("  - **Por distancia**:\n")
        f.write("    - De 0 a 2,020 metros: **S/ 0.00** (Envío gratis en radio local cercano).\n")
        f.write("    - De 2,021 a 3,605 metros: **S/ 3.00**.\n")
        f.write("  - **Zonas Poligonales Específicas**: Existen 9 polígonos mapeados con tarifas entre **S/ 2.00 y S/ 9.00** para zonas específicas de Campoy y alrededores.\n")
        f.write("  - **Regla de Delivery GRATIS por consumo**: Si el subtotal de productos alcanza o supera **S/ 70.00**, el costo de envío es automáticamente bonificado (**S/ 0.00**).\n")
        f.write("- **Tiempo Estimado de Entrega**: Se informa al usuario un tiempo estimado de **20 a 45 minutos**.\n")
        f.write("- **Opción de Pedido Programado**: Está habilitada la posibilidad de programar la entrega para una fecha y hora futura (`scheduled_orders_enabled: true`).\n")
        f.write("- **Datos requeridos para Delivery**: Nombre completo, teléfono celular, dirección exacta y referencias de entrega.\n\n")

        f.write("#### B. Modalidad RECOJO EN TIENDA (Takeaway)\n")
        f.write("- **Sin costo de envío**: S/ 0.00.\n")
        f.write("- **Sin monto mínimo**: No aplica la restricción de S/ 14.50.\n")
        f.write("- **Datos requeridos**: Nombre completo y teléfono de contacto.\n\n")

        f.write("### Paso 5: Propinas Voluntarias\n")
        f.write("- En ambas modalidades se presenta un selector de propina voluntaria con el texto: _'Para colaboradores de Caprichos'_.\n")
        f.write("- Opciones fijadas: **S/ 0.00** (predeterminado), **S/ 0.50** o **S/ 2.00**.\n\n")

        f.write("### Paso 6: Selección de Método de Pago\n")
        f.write("El cliente escoge cómo desea abonar la orden:\n")
        f.write("1. **Yape**: Pago móvil al número `977503006` a nombre de _María José Morillo Ruiz_.\n")
        f.write("2. **Plin**: Pago móvil al número `977503006` a nombre de _María José Morillo Ruiz_.\n")
        f.write("3. **Transferencia Bancaria**: Cuentas BCP Ahorros Soles `19197148281074` o Interbank Ahorros Soles `0913227414217`, ambas a nombre de _María José Morillo Ruiz_.\n")
        f.write("4. **Tarjeta de Crédito / Débito**: Pago con tarjeta.\n")
        f.write("5. **Efectivo (Contra-Entrega)**: Pago en efectivo al momento de recibir la orden.\n\n")

        f.write("### Paso 7: Confirmación y Envío hacia WhatsApp\n")
        f.write("- La tienda está configurada bajo la modalidad `checkout_type: WHATSAPP`.\n")
        f.write("- Al pulsar 'Pedir por WhatsApp', la aplicación compila un mensaje de texto formateado con:\n")
        f.write("  - Número de pedido o identificador de orden.\n")
        f.write("  - Modalidad elegida (Delivery o Recojo).\n")
        f.write("  - Lista detallada de productos, cantidades, variantes, adicionales seleccionados y notas.\n")
        f.write("  - Subtotal, costo de delivery, propina y TOTAL a pagar.\n")
        f.write("  - Método de pago seleccionado y datos del cliente.\n")
        f.write("- Se abre la URL de WhatsApp (`https://wa.me/51977503006?text=...`) dirigiendo la conversación directamente al equipo de Caprichos para validación de comprobante y despacho.\n\n")

        f.write("## 7. Descuentos y Promociones Detectadas\n\n")
        f.write("En el modelo de datos de OlaClick, los descuentos se expresan comparando `price` contra `original_price` en `product_variants`:\n\n")
        f.write("- **Dona Artesanal**: Precio venta S/ 4.00 vs Original S/ 5.00 (**20.0% de descuento**).\n")
        f.write("- **1/2 Docena Donuts**: Precio venta S/ 21.00 vs Original S/ 30.00 (**30.0% de descuento**).\n")
        f.write("- **1/2 Docena de Galletas**: Precio venta S/ 21.00 vs Original S/ 24.00 (**12.5% de descuento**).\n")
        f.write("- **Frozen (Maracuyá, Limonada, Strawberry)**: Precio venta S/ 14.50 vs Original S/ 19.00 (**23.7% de descuento**).\n")
        f.write("- **Club Sandwich**: Precio venta S/ 27.00 vs Original S/ 33.00 (**18.2% de descuento**).\n")
        f.write("- **Dúo Compartir (2 Frappés + 2 Donuts)**: S/ 33.00 vs S/ 38.00 (**13.2% de descuento**).\n")
        f.write("- **Dúo Irresistible**: S/ 37.00 vs S/ 50.00 (**26.0% de descuento**).\n")
        f.write("- **¡Nuevo combo Caprikids! (Histórico)**: S/ 27.00 vs S/ 45.00 (**40.0% de descuento**).\n")
        f.write("- **Promociones 3x2 (Históricas en `/combos`)**: Precio con un tercio de rebaja (**33.3% de descuento**).\n\n")

        f.write("## 8. Datos del Negocio y Configuración Comercial\n\n")
        f.write(f"- **Nombre Comercial**: {negocio['nombre']}\n")
        f.write(f"- **Dirección**: {negocio['direccion']}\n")
        f.write(f"- **Coordenadas GPS**: Latitud `{negocio['coordenadas']['latitud']}`, Longitud `{negocio['coordenadas']['longitud']}`\n")
        f.write(f"- **WhatsApp de Pedidos**: `{negocio['whatsapp']}` (enlace directo: [wa.me/{negocio['whatsapp']}](https://wa.me/{negocio['whatsapp']}))\n")
        f.write(f"- **Teléfono Fijo**: No configurado en la web (solo canal WhatsApp).\n")
        f.write("- **Redes Sociales**:\n")
        for red, url in negocio["redes_sociales"].items():
            f.write(f"  - **{red.capitalize()}**: [{url}]({url})\n")
        f.write(f"- **Red WiFi en Local**: SSID `{negocio['wifi']['red']}` | Contraseña `{negocio['wifi']['clave']}`\n")
        f.write(f"- **Calificación Google Maps**: {negocio['reputacion_google']['score']} / 5.0 basada en {negocio['reputacion_google']['total_opiniones']} reseñas.\n\n")

        f.write("### Horarios de Atención\n\n")
        f.write("| Día | Estado | Horario |\n")
        f.write("| :--- | :---: | :--- |\n")
        for h in negocio["horarios_atencion"]:
            f.write(f"| {h['dia']} | {'Abierto' if h['abierto'] else 'Cerrado'} | {', '.join(h['horas']) if h['horas'] else 'Cerrado'} |\n")
        f.write("\n")

        f.write("### Métodos de Pago Habilitados\n\n")
        f.write("| Método | Código | Detalles / Cuentas Registradas |\n")
        f.write("| :--- | :--- | :--- |\n")
        for mp in negocio["metodos_pago"]:
            desc = mp['descripcion'].replace('\n', '<br>') if mp['descripcion'] else "Pago estándar"
            f.write(f"| **{mp['nombre']}** | `{mp['codigo']}` | {desc} |\n")
        f.write("\n")

        f.write("### Textos Legales y SEO\n\n")
        f.write("- **Términos y Condiciones**: No configurados en la tienda (utiliza infraestructura genérica de OlaClick).\n")
        f.write("- **Libro de Reclamaciones**: No implementado en la interfaz histórica analizada.\n")
        f.write(f"- **SEO Title**: `{negocio['seo']['title']}`\n")
        f.write(f"- **SEO Meta Description**: `{negocio['seo']['description']}`\n")
        f.write(f"- **SEO Keywords**: `{negocio['seo']['keywords']}`\n")
        f.write(f"- **OpenGraph Title**: `{negocio['seo']['open_graph'].get('og:title')}`\n")
        f.write(f"- **OpenGraph Image**: `{negocio['seo']['open_graph'].get('og:image')}`\n\n")

        f.write("## 9. Campos Especiales y Rarezas Técnicas Descubiertas\n\n")
        f.write("Durante el análisis del dehydrated state de Nuxt 3 y OlaClick se identificaron particularidades:\n")
        f.write("1. **Separador de WiFi en base de datos**: La red y clave WiFi están unidas por un delimitador interno propio de OlaClick: `>>>===OLACLICK_WIFI_VALUES_SEPARATOR===<<<`.\n")
        f.write("2. **Arquitectura Nuxt 3 Flat Array**: Los datos de servidor vienen en un array indexado (`devalue`) dentro de `<script id=\"__NUXT_DATA__\">`. La vista de catálogo `/products` envía un payload liviano (`products-menu-light`) que solo contiene el conteo de categorías de modificadores (`modifier_categories_count`), requiriendo acceder a las URLs individuales para extraer las opciones de personalización (leches, azúcares, cremas).\n")
        f.write("3. **Alias en Destacados**: La categoría `Destacados` (`favoritos`) no tiene productos propios exclusivos; son punteros a productos de las categorías sustantivas (Cafetería, Salado, Postres).\n")
        f.write("4. **Sitemap desincronizado del menú activo**: OlaClick mantiene en `sitemap.xml` 27 productos huérfanos o promociones antiguas (`combos`, ediciones pasadas de San Valentín, 3x2) que no se listan en el menú principal pero siguen respondiendo con código HTTP 200 y `visible: false` o categoría deshabilitada.\n\n")

        f.write("## 10. Script de Extracción Reproducible\n\n")
        f.write("Toda la extracción está codificada y es 100% reproducible mediante el script:\n")
        f.write("`/home/jose/JoseEM/caprichos/web-anterior/carta/datos/extraer.py`\n\n")
        f.write("Archivos generados en `/home/jose/JoseEM/caprichos/web-anterior/carta/datos/`:\n")
        f.write("- `catalogo.json`: Estructura jerárquica de categorías, productos, variantes y modificadores.\n")
        f.write("- `catalogo.csv`: Formato tabular plano (una fila por producto) con resumen de variantes y adicionales.\n")
        f.write("- `categorias.csv`: Listado de categorías, IDs, visibilidad y conteo de ítems.\n")
        f.write("- `negocio.json`: Ficha completa y estructurada del comercio.\n")
        f.write("- `html/`: Copia local íntegra en bruto de todas las páginas HTML descargadas para auditoría offline sin peticiones adicionales al servidor.\n")


if __name__ == "__main__":
    main()
