#!/usr/bin/env python3
"""
descargar_js.py
Descarga recursiva y segura de chunks JavaScript de la plataforma OlaClick
para Caprichos (https://caprichos-per.ola.click).
Reglas:
- Solo peticiones GET publicas de lectura.
- Maximo 1 peticion por segundo (rate limit >= 1.1s entre llamadas).
- Descarga inicial de chunks referenciados en HTMLs locales.
- Descubrimiento recursivo de chunks importados/lazy-loaded por Vite/Nuxt.
- Guarda en /home/jose/JoseEM/caprichos/web-anterior/carta/codigo/js/
"""

import os
import re
import sys
import time
import requests

BASE_URL = "https://caprichos-per.ola.click"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "*/*",
    "Referer": "https://caprichos-per.ola.click/"
}

BASE_DIR = "/home/jose/JoseEM/caprichos/web-anterior/carta"
DATOS_DIR = os.path.join(BASE_DIR, "datos")
CODIGO_DIR = os.path.join(BASE_DIR, "codigo")
JS_DIR = os.path.join(CODIGO_DIR, "js")

os.makedirs(JS_DIR, exist_ok=True)

def find_initial_chunks():
    chunks = set()
    # Recorrer todos los archivos html en datos
    for root, dirs, files in os.walk(DATOS_DIR):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        matches = re.findall(r'/_nuxt/([a-zA-Z0-9_\-]+\.js)', content)
                        for m in matches:
                            chunks.add(m)
                except Exception as e:
                    print(f"Error leyendo {path}: {e}")
    return sorted(list(chunks))

def extract_imported_chunks(js_content):
    """
    Busca referencias a otros chunks en codigo JS de Vite/Nuxt:
    - import ... from "./foo.js"
    - import("./foo.js")
    - "/_nuxt/foo.js"
    - "foo.js" en arrays de vite preload
    """
    found = set()
    
    # 1. Rutas explicitas /_nuxt/xxx.js
    for m in re.findall(r'/_nuxt/([a-zA-Z0-9_\-]+\.js)', js_content):
        found.add(m)
        
    # 2. Imports relativos "./xxx.js"
    for m in re.findall(r'["\'](?:\./)?([a-zA-Z0-9_\-]+\.js)["\']', js_content):
        # Filtrar si parece un chunk de Nuxt/Vite (ej. CsOqdhwp.js, etc.)
        # O nombres tipicos de librerias minificadas
        if re.match(r'^[a-zA-Z0-9_\-]{4,30}\.js$', m):
            # descartar librerias externas obvias si no estan en _nuxt
            if m not in ("radar.min.js", "gtm.js", "fbevents.js"):
                found.add(m)
                
    return found

def download_chunk(chunk_name):
    target_path = os.path.join(JS_DIR, chunk_name)
    if os.path.exists(target_path) and os.path.getsize(target_path) > 0:
        print(f"[CACHE] {chunk_name} ya existe ({os.path.getsize(target_path)} bytes)")
        with open(target_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    url = f"{BASE_URL}/_nuxt/{chunk_name}"
    print(f"[GET] Descargando {url} (pausa 1.1s)...")
    time.sleep(1.1)  # Estricto rate-limit <= 1 req/s
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        if resp.status_code == 200:
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(resp.text)
            print(f"[OK] {chunk_name} guardado ({len(resp.text)} bytes)")
            return resp.text
        else:
            print(f"[WARN] Status {resp.status_code} para {url}")
            return None
    except Exception as e:
        print(f"[ERROR] Fallo al descargar {url}: {e}")
        return None

def main():
    initial = find_initial_chunks()
    print(f"Chunks iniciales encontrados en HTML: {initial}")
    
    queue = list(initial)
    processed = set()
    all_downloaded = set()
    
    while queue:
        chunk = queue.pop(0)
        if chunk in processed:
            continue
        processed.add(chunk)
        
        content = download_chunk(chunk)
        if content:
            all_downloaded.add(chunk)
            discovered = extract_imported_chunks(content)
            for d in discovered:
                if d not in processed and d not in queue:
                    # Comprobamos si tiene pinta de ser un chunk de vite
                    queue.append(d)
                    print(f"  -> Nuevo chunk descubierto: {d}")

    print(f"\nDescarga finalizada. Total chunks descargados: {len(all_downloaded)}")
    print("Lista de chunks:")
    for c in sorted(all_downloaded):
        size = os.path.getsize(os.path.join(JS_DIR, c))
        print(f" - {c}: {size} bytes")

if __name__ == "__main__":
    main()
