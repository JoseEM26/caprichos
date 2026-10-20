#!/usr/bin/env python3
"""
analizar_endpoints.py
Escanea los chunks JS en busca de endpoints de microservicios y llamadas a APIs de OlaClick.
"""

import os
import re

JS_DIR = "/home/jose/JoseEM/caprichos/web-anterior/carta/codigo/js"

def search_endpoints():
    patterns = [
        r'(https?://[a-zA-Z0-9_\-\.]*olaclick[a-zA-Z0-9_\-\./:]*)',
        r'(ms-[a-zA-Z0-9_\-]+/[a-zA-Z0-9_\-/\${}:]+)',
        r'([a-zA-Z0-9_\-]+Service\.[a-zA-Z0-9_]+)',
        r'(\$fetch\([^)]+\))',
        r'(axios\.[a-zA-Z0-9_]+\([^)]+\))',
        r'(\.(?:get|post|put|patch|delete)\([`"\'][^`"\']+[`"\'])'
    ]
    
    results = {}
    for fname in sorted(os.listdir(JS_DIR)):
        if not fname.endswith(".js"):
            continue
        path = os.path.join(JS_DIR, fname)
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            for line_no, line in enumerate(content.splitlines(), 1):
                # ms- routes
                ms_matches = re.findall(r'(ms-[a-zA-Z0-9_\-]+(?:/[a-zA-Z0-9_\-/\${}:?=&]+)?)', line)
                if ms_matches:
                    for m in ms_matches:
                        results.setdefault(m, []).append((fname, line_no))
                        
                # api.olaclick.app routes
                api_matches = re.findall(r'(https?://[a-zA-Z0-9_\-\.]*olaclick[a-zA-Z0-9_\-/\${}:?=&]*)', line)
                if api_matches:
                    for m in api_matches:
                        results.setdefault(m, []).append((fname, line_no))

    print(f"Total endpoints/URLs unicos encontrados: {len(results)}")
    for k in sorted(results.keys()):
        files = ", ".join([f"{f}:{l}" for f, l in results[k][:3]])
        print(f"{k}  --> [{files}]")

if __name__ == "__main__":
    search_endpoints()
