import asyncio
import os
import json
import re
import sys
from playwright.async_api import async_playwright

async def run_inspection():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD env variable missing", file=sys.stderr)
        sys.exit(1)

    result = {
        "login": {},
        "screens": {}
    }

    # Modulo Creditos routes
    routes = [
        {
            "id": "ventacreditos",
            "name": "Cobro de ventas (Ventas al Crédito)",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/creditos/ventacreditos"
        },
        {
            "id": "compracreditos",
            "name": "Pago de compras (Compras al Crédito)",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/creditos/compracreditos"
        }
    ]

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        current_screen_network = []

        async def on_request(req):
            if any(term in req.url.lower() for term in ["rest", "api"]):
                url_clean = req.url.split("?")[0]
                current_screen_network.append({
                    "type": "REQUEST",
                    "method": req.method,
                    "url_endpoint": url_clean
                })

        async def on_response(resp):
            if any(term in resp.url.lower() for term in ["rest", "api"]):
                url_clean = resp.url.split("?")[0]
                current_screen_network.append({
                    "type": "RESPONSE",
                    "method": resp.request.method,
                    "url_endpoint": url_clean,
                    "status": resp.status
                })

        page.on("request", on_request)
        page.on("response", on_response)

        login_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"[LOGIN] Navegando a {login_url}...")
        await page.goto(login_url, wait_until="domcontentloaded", timeout=60000)

        # Esperar 4 segundos obligatorios
        print("[LOGIN] Esperando 4 segundos a que carguen desplegables...")
        await page.wait_for_timeout(4000)

        # Rellenar solo usuario y contraseña
        print("[LOGIN] Ingresando credenciales...")
        await page.locator('input[name="usuario_nick"]').fill(user)
        await page.wait_for_timeout(500)
        await page.locator('input[name="usuario_clave"]').fill(password)
        await page.wait_for_timeout(500)

        # Pulsar una sola vez Iniciar sesión
        print("[LOGIN] Pulsando Iniciar sesión...")
        await page.locator('button[type="submit"]').click()

        # Esperar cambio de URL hasta 15 segundos
        logged_in = False
        for sec in range(1, 16):
            await page.wait_for_timeout(1000)
            if "#!/login" not in page.url:
                print(f"[LOGIN] Éxito en segundo {sec}: {page.url}")
                logged_in = True
                result["login"] = {"status": "SUCCESS", "second": sec, "url": page.url}
                break

        if not logged_in:
            print("[LOGIN] No se completó el inicio de sesión en 15s. Deteniendo.")
            result["login"] = {"status": "FAILED", "url": page.url}
            await browser.close()
            return

        # Pausa de 2 segundos requerida
        await page.wait_for_timeout(2000)

        # Navegar por las pantallas de Créditos
        for r in routes:
            print(f"\n[NAVEGACION] Inspeccionando {r['name']} ({r['url']})...")
            current_screen_network.clear()

            await page.goto(r["url"], wait_until="domcontentloaded", timeout=30000)
            # Pausa de 3 segundos para que renderice Angular y carguen tablas
            await page.wait_for_timeout(3000)

            # Extraer estructura DOM limpia (sin datos personales ni montos reales)
            dom_data = await page.evaluate("""() => {
                const titleEl = document.querySelector('.page-heading h2, h2.font-light, .page-title, h1, h2');
                const title = titleEl ? titleEl.innerText.trim() : '';

                const bcEls = document.querySelectorAll('.breadcrumb li, .breadcrumb a, .breadcrumb span');
                const breadcrumbs = Array.from(bcEls).map(el => el.innerText.trim()).filter(Boolean);

                // Botones visibles (solo nombres y clases estructurales)
                const btnEls = document.querySelectorAll('button, a.btn, input[type="button"], input[type="submit"]');
                const buttons = [];
                btnEls.forEach(b => {
                    const txt = b.innerText ? b.innerText.trim() : (b.value || '');
                    if (txt && b.offsetWidth > 0 && b.offsetHeight > 0) {
                        buttons.push(txt.replace(/\\s+/g, ' '));
                    }
                });

                // Cabeceras de tabla
                const tableHeaders = [];
                document.querySelectorAll('table').forEach((t, tIdx) => {
                    const headers = [];
                    t.querySelectorAll('th').forEach(th => {
                        const hTxt = th.innerText.trim().replace(/\\s+/g, ' ');
                        if (hTxt) headers.push(hTxt);
                    });
                    if (headers.length > 0) {
                        tableHeaders.push({ tableIndex: tIdx, headers: headers });
                    }
                });

                // Filtros y campos visibles
                const fields = [];
                document.querySelectorAll('label, .form-group').forEach(fg => {
                    const label = fg.querySelector('label') ? fg.querySelector('label').innerText.trim().replace(/\\s+/g, ' ') : '';
                    const select = fg.querySelector('select');
                    const input = fg.querySelector('input');
                    if (select) {
                        const opts = Array.from(select.options).map(o => o.text.trim()).filter(Boolean);
                        fields.push({ label: label || 'Selector', type: 'select', options_sample: opts.slice(0, 15) });
                    } else if (input) {
                        fields.push({ label: label || input.placeholder || 'Input', type: input.type || 'text', placeholder: input.placeholder || '' });
                    }
                });

                // Tabs / Pestañas
                const tabs = [];
                document.querySelectorAll('.nav-tabs li, tabset li, .nav-pills li').forEach(tab => {
                    const txt = tab.innerText.trim().replace(/\\s+/g, ' ');
                    if (txt) tabs.push(txt);
                });

                // Badges / etiquetas de resumen / totales estructurales
                const summaries = [];
                document.querySelectorAll('.ibox-title h5, .label, .badge, .panel-heading, .widget').forEach(el => {
                    const txt = el.innerText.trim().replace(/\\s+/g, ' ');
                    if (txt && el.offsetWidth > 0 && el.offsetHeight > 0 && txt.length < 100) {
                        // Sanitizar si contiene números o montos específicos reemplazándolos
                        const cleanSummary = txt.replace(/S\\/\\.\\s*[\\d,.]+/g, 'S/. [MONTO]').replace(/\\b\\d{4,}\\b/g, '[NUMERO]');
                        summaries.push(cleanSummary);
                    }
                });

                return {
                    title: title,
                    breadcrumbs: breadcrumbs,
                    tabs: tabs,
                    buttons: Array.from(new Set(buttons)),
                    tableHeaders: tableHeaders,
                    fields: fields.slice(0, 30),
                    summaries: Array.from(new Set(summaries)).slice(0, 20)
                };
            }""")

            endpoints_seen = []
            for item in current_screen_network:
                ep = f"{item['method']} {item['url_endpoint']}"
                if ep not in endpoints_seen:
                    endpoints_seen.append(ep)

            result["screens"][r["id"]] = {
                "id": r["id"],
                "name": r["name"],
                "url": r["url"],
                "dom_structure": dom_data,
                "endpoints_called": endpoints_seen
            }

            # Pausa de 2 segundos entre pantallas requerida
            await page.wait_for_timeout(2000)

        # Cerrar sesión al final
        print("\n[LOGOUT] Cerrando sesión de forma limpia...")
        try:
            logout_btn = page.locator('a:has-text("Cerrar sesión"), a:has-text("Cerrar Sesión"), a:has-text("Salir")').first
            if await logout_btn.count() > 0:
                await logout_btn.click()
                await page.wait_for_timeout(2000)
                print("[LOGOUT] Sesión cerrada exitosamente.")
        except Exception as e:
            print(f"[LOGOUT] Nota al cerrar sesión: {e}")

        await browser.close()

    output_path = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/creditos/creditos_live_data.json"
    with open(output_path, "w", encoding="utf-8") as out_f:
        json.dump(result, out_f, indent=2, ensure_ascii=False)
    print(f"\n[FINALIZADO] Inspección completada. Datos guardados en {output_path}")

if __name__ == "__main__":
    asyncio.run(run_inspection())
