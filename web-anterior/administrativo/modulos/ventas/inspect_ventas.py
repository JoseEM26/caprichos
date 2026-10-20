import asyncio
import os
import json
import re
import sys
from playwright.async_api import async_playwright

async def inspect():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD environment variable not set.", file=sys.stderr)
        sys.exit(1)

    result = {
        "login": {},
        "screens": {}
    }

    def sanitize(text):
        if not text:
            return ""
        s = str(text)
        s = re.sub(r'("token"\s*:\s*)"[^"]+"', r'\1"[REDACTED]"', s, flags=re.IGNORECASE)
        s = re.sub(r'("usuario_clave"\s*:\s*)"[^"]+"', r'\1"[REDACTED]"', s, flags=re.IGNORECASE)
        s = re.sub(r'("password"\s*:\s*)"[^"]+"', r'\1"[REDACTED]"', s, flags=re.IGNORECASE)
        s = re.sub(r'("jwt"\s*:\s*)"[^"]+"', r'\1"[REDACTED]"', s, flags=re.IGNORECASE)
        s = re.sub(r'(Bearer\s+)[A-Za-z0-9_\-\.]+', r'\1[REDACTED]', s, flags=re.IGNORECASE)
        s = re.sub(r'(PHPSESSID=)[^;]+', r'\1[REDACTED]', s, flags=re.IGNORECASE)
        return s

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        http_calls = []

        async def on_request(req):
            if any(term in req.url.lower() for term in ["rest", "api"]):
                http_calls.append({
                    "type": "REQUEST",
                    "method": req.method,
                    "url": req.url,
                    "post_data": sanitize(req.post_data)[:200] if req.post_data else None
                })

        async def on_response(resp):
            if any(term in resp.url.lower() for term in ["rest", "api"]):
                body_sample = ""
                try:
                    # Only parse json or text if not binary
                    content_type = resp.headers.get("content-type", "")
                    if "json" in content_type or "text" in content_type:
                        text = await resp.text()
                        body_sample = sanitize(text)[:500]
                except Exception:
                    body_sample = "[ERROR_READING_BODY]"

                http_calls.append({
                    "type": "RESPONSE",
                    "method": resp.request.method,
                    "url": resp.url,
                    "status": resp.status,
                    "content_type": resp.headers.get("content-type", ""),
                    "preview": body_sample
                })

        page.on("request", on_request)
        page.on("response", on_response)

        target_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"[LOGIN] Navegando a {target_url}...")
        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        
        # Espera de 4s para estabilizar Angular y selects
        print("[LOGIN] Esperando 4s de estabilización...")
        await page.wait_for_timeout(4000)

        # Rellenar solo usuario y contraseña
        await page.locator('input[name="usuario_nick"]').fill(user)
        await page.wait_for_timeout(500)
        await page.locator('input[name="usuario_clave"]').fill(password)
        await page.wait_for_timeout(500)

        print("[LOGIN] Clic en Iniciar sesión...")
        await page.locator('button[type="submit"]').click()

        # Esperar cambio de URL hasta 15 s
        logged_in = False
        for sec in range(1, 16):
            await page.wait_for_timeout(1000)
            if "#!/login" not in page.url:
                print(f"[LOGIN] Exitoso en segundo {sec}: {page.url}")
                logged_in = True
                result["login"] = {"status": "SUCCESS", "second": sec, "url": page.url}
                break

        if not logged_in:
            print("[LOGIN] Falló o timeout de 15s. Abortando sin reintentar.")
            result["login"] = {"status": "FAILED", "url": page.url}
            await browser.close()
            with open("ventas_inspection_raw.json", "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            return

        # Pausa de 3s post login
        await page.wait_for_timeout(3000)

        # Helper para extraer datos de pantalla sin tocar nada que ejecute acciones
        async def inspect_screen(route_name, hash_url):
            print(f"\n==========================================")
            print(f"[SCREEN] Navegando a {route_name}: {hash_url}")
            http_calls.clear()
            full_target = f"https://caprichos.restaurant.pe/restaurant/{hash_url}"
            await page.goto(full_target, wait_until="domcontentloaded", timeout=60000)
            
            # Pausa de 3s para carga de datos por Angular
            await page.wait_for_timeout(3000)

            # Extraer info DOM
            dom_data = await page.evaluate("""() => {
                // Título de página o breadcrumbs
                const titleEl = document.querySelector('.page-heading h2, h1, h2, .breadcrumb');
                const title = titleEl ? titleEl.innerText.trim() : '';

                // Breadcrumbs
                const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb li')).map(li => li.innerText.trim());

                // Botones visibles (solo texto, clases, ng-click / href si existe)
                const buttons = Array.from(document.querySelectorAll('button, a.btn, input[type="button"], input[type="submit"]'))
                    .filter(b => b.offsetWidth > 0 && b.offsetHeight > 0)
                    .map(b => ({
                        text: b.innerText.trim() || b.value || b.getAttribute('title') || b.getAttribute('aria-label') || '',
                        tag: b.tagName.toLowerCase(),
                        classes: b.className,
                        ng_click: b.getAttribute('ng-click') || '',
                        ui_sref: b.getAttribute('ui-sref') || '',
                        href: b.getAttribute('href') || ''
                    }));

                // Pestañas / Tabs / Navegadores de salas o estados
                const tabs = Array.from(document.querySelectorAll('.nav-tabs li, .nav-pills li, .tab-content, [uib-tab]'))
                    .filter(t => t.offsetWidth > 0 && t.offsetHeight > 0)
                    .map(t => ({
                        text: t.innerText.trim(),
                        active: t.classList.contains('active')
                    }));

                // Tablas (cabeceras y columnas)
                const tables = Array.from(document.querySelectorAll('table')).map(tbl => {
                    const headers = Array.from(tbl.querySelectorAll('th')).map(th => th.innerText.trim());
                    const rowsCount = tbl.querySelectorAll('tbody tr').length;
                    return {
                        headers: headers,
                        rowCount: rowsCount,
                        classes: tbl.className
                    };
                });

                // Formularios y Campos de entrada (inputs, selects)
                const formFields = Array.from(document.querySelectorAll('input, select, textarea'))
                    .filter(f => f.type !== 'hidden' && f.offsetWidth > 0 && f.offsetHeight > 0)
                    .map(f => {
                        // Buscar label asociado
                        let labelText = '';
                        if (f.id) {
                            const lbl = document.querySelector(`label[for="${f.id}"]`);
                            if (lbl) labelText = lbl.innerText.trim();
                        }
                        if (!labelText) {
                            const parentLbl = f.closest('label');
                            if (parentLbl) labelText = parentLbl.innerText.trim();
                        }
                        if (!labelText) {
                            const formGroup = f.closest('.form-group');
                            if (formGroup) {
                                const groupLbl = formGroup.querySelector('label');
                                if (groupLbl) labelText = groupLbl.innerText.trim();
                            }
                        }

                        // Opciones si es select
                        let options = [];
                        if (f.tagName.toLowerCase() === 'select') {
                            options = Array.from(f.options).map(o => o.text.trim()).slice(0, 20);
                        }

                        return {
                            name: f.name || f.id || f.getAttribute('ng-model') || '',
                            label: labelText,
                            placeholder: f.placeholder || '',
                            tag: f.tagName.toLowerCase(),
                            type: f.type || '',
                            options: options,
                            required: f.required || f.getAttribute('required') !== null,
                            ng_model: f.getAttribute('ng-model') || ''
                        };
                    });

                // Elementos visuales clave (mesas, pedidos, comandas, tarjetas)
                const visualContainers = Array.from(document.querySelectorAll('.ibox, .panel, .widget, .card, .mesa, [ng-repeat]')).map(c => ({
                    tag: c.tagName.toLowerCase(),
                    classes: c.className,
                    text_sample: c.innerText.trim().substring(0, 100),
                    ng_repeat: c.getAttribute('ng-repeat') || ''
                })).filter(c => c.ng_repeat !== '');

                return {
                    title: title,
                    breadcrumbs: breadcrumbs,
                    buttons: buttons,
                    tabs: tabs,
                    tables: tables,
                    formFields: formFields,
                    repeater_directives: Array.from(new Set(visualContainers.map(v => v.ng_repeat))).slice(0, 30)
                };
            }""")

            # Guardar llamadas HTTP observadas (solo GET/POST endpoints, sin datos sensibles)
            observed_apis = []
            for h in http_calls:
                observed_apis.append({
                    "type": h["type"],
                    "method": h["method"],
                    "url": h["url"],
                    "status": h.get("status"),
                    "preview": h.get("preview", "")[:300]
                })

            result["screens"][route_name] = {
                "hash_url": hash_url,
                "current_url": page.url,
                "dom": dom_data,
                "apis": observed_apis
            }
            print(f"[SCREEN] {route_name} completado. APIS observadas: {len(observed_apis)}, Botones: {len(dom_data['buttons'])}, Campos: {len(dom_data['formFields'])}")
            
            # Pausa de 2 s entre pantallas para respetar el servidor
            await page.wait_for_timeout(2000)

        # 1. Pedidos en caja (salones)
        await inspect_screen("pedidos_caja_salones", "#!/ventas/hacer-pedidos/salones")

        # 2. Pedidos Multimozo
        await inspect_screen("pedidos_multimozo", "#!/ventas/multimozo")

        # 3. Pantalla de cocina
        await inspect_screen("pantalla_cocina", "#!/ventas/ver-pedidos/estado")

        # Cierre de sesión seguro y limpio
        print("\n[LOGOUT] Buscando enlace de Cerrar sesión...")
        try:
            # Buscar link de logout en menú superior o menú usuario
            # Usualmente en topnavbar o en dropdown usuario
            logout_btn = page.locator('a[href*="logout"], a:has-text("Cerrar sesión"), a:has-text("Cerrar sesion"), a:has-text("Salir")')
            count = await logout_btn.count()
            if count > 0:
                print("[LOGOUT] Encontrado enlace de logout. Pulsando...")
                await logout_btn.first.click()
                await page.wait_for_timeout(2000)
                print(f"[LOGOUT] URL post logout: {page.url}")
            else:
                print("[LOGOUT] No se ubicó enlace directo visible de logout.")
        except Exception as e:
            print(f"[LOGOUT] Error al intentar cerrar sesión: {e}")

        await browser.close()

    with open("ventas_inspection_raw.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print("\n[FIN] Inspección finalizada y guardada en ventas_inspection_raw.json")

if __name__ == "__main__":
    asyncio.run(inspect())
