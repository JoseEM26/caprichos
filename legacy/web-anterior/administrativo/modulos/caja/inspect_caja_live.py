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

    # Target routes
    routes = [
        {"id": "cobrar_salones", "name": "Cobrar en Salones", "url": "https://caprichos.restaurant.pe/restaurant/#!/caja/cobrar/salones"},
        {"id": "apertura_cierre", "name": "Apertura y Cierre", "url": "https://caprichos.restaurant.pe/restaurant/#!/caja/apertura-cierre"},
        {"id": "cierre_caja_z", "name": "Cierre Caja Z", "url": "https://caprichos.restaurant.pe/restaurant/#!/caja/cierre-caja-z"},
        {"id": "movimientos", "name": "Cierres de Caja / Movimientos", "url": "https://caprichos.restaurant.pe/restaurant/#!/caja/movimientos"},
        {"id": "ingresos", "name": "Ingresos de Caja", "url": "https://caprichos.restaurant.pe/restaurant/#!/caja/ingresos"},
        {"id": "egresos", "name": "Egresos de Caja", "url": "https://caprichos.restaurant.pe/restaurant/#!/caja/egresos"},
        {"id": "notas_credito", "name": "Notas de Crédito", "url": "https://caprichos.restaurant.pe/restaurant/#!/caja/Notas-Credito"},
        {"id": "notas_debito", "name": "Notas de Débito", "url": "https://caprichos.restaurant.pe/restaurant/#!/caja/Notas-Debito"},
        {"id": "monitor_caja", "name": "Monitor de Ventas", "url": "https://caprichos.restaurant.pe/restaurant/#!/caja/monitorcaja"},
        {"id": "consulta_precios", "name": "Consulta de Precios", "url": "https://caprichos.restaurant.pe/restaurant/#!/informes/inventario/productos-con-precio"}
    ]

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        current_screen_network = []

        async def on_request(req):
            if any(term in req.url.lower() for term in ["rest", "api"]):
                # Clean URL: strip query parameters or sensitive IDs if needed, but endpoint path is safe
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

        # Pausa de estabilización inicial
        await page.wait_for_timeout(2000)

        # Navegar por cada ruta
        for r in routes:
            print(f"\n[NAVEGACION] Inspeccionando {r['name']} ({r['url']})...")
            current_screen_network.clear()

            # Navegar pasivamente
            await page.goto(r["url"], wait_until="domcontentloaded", timeout=30000)
            # Pausa de 2.5s para que renderice Angular y carguen tablas pasivamente
            await page.wait_for_timeout(2500)

            # Extraer estructura DOM
            dom_data = await page.evaluate("""() => {
                // Título y breadcrumb
                const titleEl = document.querySelector('.page-heading h2, h2.font-light, .page-title, h1, h2');
                const title = titleEl ? titleEl.innerText.trim() : '';

                const bcEls = document.querySelectorAll('.breadcrumb li, .breadcrumb a, .breadcrumb span');
                const breadcrumbs = Array.from(bcEls).map(el => el.innerText.trim()).filter(Boolean);

                // Botones visibles (solo nombres)
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
                        fields.push({ label: label || 'Selector', type: 'select', options_sample: opts.slice(0, 10) });
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

                // Alertas o cajas de estado
                const alerts = [];
                document.querySelectorAll('.alert, .label, .badge, .ibox-title').forEach(al => {
                    const txt = al.innerText.trim().replace(/\\s+/g, ' ');
                    if (txt && al.offsetWidth > 0 && al.offsetHeight > 0 && txt.length < 150) {
                        alerts.push(txt);
                    }
                });

                return {
                    title: title,
                    breadcrumbs: breadcrumbs,
                    tabs: tabs,
                    buttons: Array.from(new Set(buttons)),
                    tableHeaders: tableHeaders,
                    fields: fields.slice(0, 30),
                    alerts_sample: Array.from(new Set(alerts)).slice(0, 15)
                };
            }""")

            # Copiar endpoints detectados (sin duplicados)
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

            # Pausa de 2 segundos requerida entre pantallas
            await page.wait_for_timeout(2000)

        # Cerrar sesión pasivamente al final
        print("\n[LOGOUT] Cerrando sesión al finalizar la lectura pasiva...")
        try:
            logout_btn = page.locator('a:has-text("Cerrar sesión"), a:has-text("Cerrar Sesión"), a:has-text("Salir")').first
            if await logout_btn.count() > 0:
                await logout_btn.click()
                await page.wait_for_timeout(2000)
                print("[LOGOUT] Sesión cerrada con éxito.")
        except Exception as e:
            print(f"[LOGOUT] Nota al cerrar sesión: {e}")

        await browser.close()

    output_path = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/caja/caja_live_structure.json"
    with open(output_path, "w", encoding="utf-8") as out_f:
        json.dump(result, out_f, indent=2, ensure_ascii=False)
    print(f"\n[COMPLETO] Datos estructurales guardados en {output_path}")

if __name__ == "__main__":
    asyncio.run(run_inspection())
