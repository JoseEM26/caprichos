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
        "reservas_screen": {},
        "dom_inspection": {},
        "network_calls": []
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

        async def on_request(req):
            if any(term in req.url.lower() for term in ["rest", "api"]):
                result["network_calls"].append({
                    "type": "REQUEST",
                    "method": req.method,
                    "url": req.url
                })

        async def on_response(resp):
            if any(term in resp.url.lower() for term in ["rest", "api"]):
                body_sample = ""
                try:
                    ct = resp.headers.get("content-type", "")
                    if "json" in ct or "text" in ct:
                        t = await resp.text()
                        body_sample = sanitize(t)[:300]
                except Exception:
                    body_sample = "[ERROR_READING_BODY]"

                result["network_calls"].append({
                    "type": "RESPONSE",
                    "method": resp.request.method,
                    "url": resp.url,
                    "status": resp.status,
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
            with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/reservas/inspection_result.json", "w") as f:
                json.dump(result, f, indent=2)
            return

        # Pausa de 2s antes de navegar
        await page.wait_for_timeout(2000)

        # Navegar a #!/reservas/principal
        reservas_url = "https://caprichos.restaurant.pe/restaurant/#!/reservas/principal"
        print(f"[RESERVAS] Navegando a {reservas_url}...")
        await page.goto(reservas_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)

        current_url = page.url
        print(f"[RESERVAS] URL actual tras navegación: {current_url}")
        result["reservas_screen"]["target_url"] = reservas_url
        result["reservas_screen"]["final_url"] = current_url

        # Check DOM contents
        dom_info = await page.evaluate("""() => {
            const info = {
                title: document.title,
                page_heading: '',
                breadcrumbs: [],
                tabs: [],
                buttons: [],
                modals: [],
                alerts: [],
                tables: [],
                forms: [],
                visible_text_sample: ''
            };

            const headingEl = document.querySelector('.page-heading, h1, h2');
            if (headingEl) info.page_heading = headingEl.innerText.trim();

            document.querySelectorAll('.breadcrumb li').forEach(li => {
                info.breadcrumbs.push(li.innerText.trim());
            });

            document.querySelectorAll('.nav-tabs li, .nav-pills li').forEach(tab => {
                info.tabs.push(tab.innerText.trim());
            });

            document.querySelectorAll('button, a.btn').forEach(btn => {
                if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
                    info.buttons.push({
                        text: btn.innerText.trim(),
                        class: btn.className,
                        id: btn.id || '',
                        ng_click: btn.getAttribute('ng-click') || ''
                    });
                }
            });

            document.querySelectorAll('.modal.in, .modal.show, .sweet-alert.showSweetAlert').forEach(m => {
                if (m.offsetWidth > 0) {
                    info.modals.push(m.innerText.trim());
                }
            });

            document.querySelectorAll('.alert, .toast-message, .toastr').forEach(a => {
                if (a.offsetWidth > 0) {
                    info.alerts.push(a.innerText.trim());
                }
            });

            document.querySelectorAll('table').forEach(t => {
                const headers = [];
                t.querySelectorAll('th').forEach(th => headers.push(th.innerText.trim()));
                info.tables.push({
                    headers: headers,
                    rowCount: t.querySelectorAll('tbody tr').length
                });
            });

            // Forms & inputs
            document.querySelectorAll('input, select, textarea').forEach(inp => {
                info.forms.push({
                    tag: inp.tagName.toLowerCase(),
                    type: inp.type || '',
                    name: inp.name || '',
                    placeholder: inp.placeholder || '',
                    ng_model: inp.getAttribute('ng-model') || '',
                    disabled: inp.disabled
                });
            });

            const mainContent = document.querySelector('[ui-view], #page-wrapper, .wrapper-content');
            if (mainContent) {
                // Sanitize and sample text
                info.visible_text_sample = mainContent.innerText.substring(0, 2000);
            }

            return info;
        }""")

        result["dom_inspection"] = dom_info
        print("[RESERVAS] DOM Info captured:")
        print("Page heading:", dom_info.get("page_heading"))
        print("Breadcrumbs:", dom_info.get("breadcrumbs"))
        print("Tabs:", dom_info.get("tabs"))
        print("Buttons count:", len(dom_info.get("buttons", [])))
        print("Modals count:", len(dom_info.get("modals", [])))
        print("Alerts count:", len(dom_info.get("alerts", [])))
        print("Tables count:", len(dom_info.get("tables", [])))
        if dom_info.get("modals"):
            print("Modal details:", dom_info["modals"])
        if dom_info.get("alerts"):
            print("Alert details:", dom_info["alerts"])

        # Safely logout at the end
        await page.wait_for_timeout(2000)
        print("[LOGOUT] Buscando botón de Cerrar sesión...")
        try:
            logout_btn = await page.evaluate("""() => {
                const links = Array.from(document.querySelectorAll('a, button'));
                const exitLink = links.find(el => {
                    const t = (el.innerText || '').toLowerCase();
                    return t.includes('cerrar sesión') || t.includes('salir') || t.includes('logout');
                });
                return exitLink ? true : false;
            }""")
            if logout_btn:
                await page.click('text="Cerrar sesión"', timeout=3000)
                print("[LOGOUT] Clic en Cerrar sesión realizado con éxito.")
                await page.wait_for_timeout(2000)
        except Exception as e:
            print(f"[LOGOUT] No se pudo cerrar sesión normalmente: {e}")

        await browser.close()

    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/reservas/inspection_result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print("[DONE] Resultados guardados en inspection_result.json")

if __name__ == "__main__":
    asyncio.run(inspect())
