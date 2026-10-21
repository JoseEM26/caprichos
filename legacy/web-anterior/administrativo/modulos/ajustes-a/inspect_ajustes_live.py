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

    # Target routes according to instructions
    routes = [
        {
            "id": "opcionessistema",
            "name": "Opciones sistema",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/opcionessistema"
        },
        {
            "id": "configuracionpos",
            "name": "Opciones de APP Quipu",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/configuracionpos"
        },
        {
            "id": "configuracionregional",
            "name": "Configuracion regional",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/configuracionregional"
        },
        {
            "id": "locales",
            "name": "Locales",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/locales"
        },
        {
            "id": "produccion",
            "name": "Almacenes y Produccion",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/produccion"
        },
        {
            "id": "salones",
            "name": "Salones y Mesas",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/salones"
        },
        {
            "id": "cajas",
            "name": "Cajas",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/cajas"
        },
        {
            "id": "impresoras",
            "name": "Impresoras",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/impresoras"
        },
        {
            "id": "turnos",
            "name": "Turnos",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/turnos"
        },
        {
            "id": "marca",
            "name": "Gestion de marcas",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/marca"
        },
        {
            "id": "imagen_self_service",
            "name": "Imagenes self service",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/imagen-self-service"
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

        # 1. Esperar 4 segundos obligatorios para estabilizar selects
        print("[LOGIN] Esperando 4 segundos a que carguen desplegables...")
        await page.wait_for_timeout(4000)

        # 2. Rellenar SOLO usuario y contrasena
        print("[LOGIN] Ingresando credenciales...")
        await page.locator('input[name="usuario_nick"]').fill(user)
        await page.wait_for_timeout(500)
        await page.locator('input[name="usuario_clave"]').fill(password)
        await page.wait_for_timeout(500)

        # 3. Pulsar UNA sola vez Iniciar sesion
        print("[LOGIN] Pulsando Iniciar sesion una sola vez...")
        await page.locator('button[type="submit"]').click()

        # 4. Esperar cambio de URL hasta 15 segundos
        logged_in = False
        for sec in range(1, 16):
            await page.wait_for_timeout(1000)
            if "#!/login" not in page.url:
                print(f"[LOGIN] Exito en segundo {sec}: {page.url}")
                logged_in = True
                result["login"] = {"status": "SUCCESS", "second": sec, "url": page.url}
                break

        if not logged_in:
            print("[LOGIN] No se completo el inicio de sesion en 15s. Deteniendo.")
            result["login"] = {"status": "FAILED", "url": page.url}
            await browser.close()
            return

        # Pausa de estabilizacion inicial
        await page.wait_for_timeout(3000)

        # Inspeccionar cada pantalla pasivamente
        for idx, r in enumerate(routes):
            print(f"\n[NAVEGACION ({idx+1}/{len(routes)})] Inspeccionando {r['name']} ({r['url']})...")
            current_screen_network.clear()

            # Navegacion pasiva
            await page.goto(r["url"], wait_until="domcontentloaded", timeout=30000)
            
            # Pausa de 3.0s para renderizado de AngularJS y carga de tablas
            await page.wait_for_timeout(3000)

            # Extraccion de DOM pasiva
            dom_data = await page.evaluate("""() => {
                // Titulo y breadcrumb
                const titleEl = document.querySelector('.page-heading h2, h2.font-light, .page-title, h1, h2');
                const title = titleEl ? titleEl.innerText.trim().replace(/\\s+/g, ' ') : '';

                const bcEls = document.querySelectorAll('.breadcrumb li, .breadcrumb a, .breadcrumb span');
                const breadcrumbs = Array.from(bcEls).map(el => el.innerText.trim().replace(/\\s+/g, ' ')).filter(Boolean);

                // Botones visibles (nombres unicos)
                const btnEls = document.querySelectorAll('button, a.btn, input[type="button"], input[type="submit"]');
                const buttons = [];
                btnEls.forEach(b => {
                    const txt = b.innerText ? b.innerText.trim() : (b.value || '');
                    if (txt && b.offsetWidth > 0 && b.offsetHeight > 0) {
                        buttons.push(txt.replace(/\\s+/g, ' '));
                    }
                });

                // Tablas y cabeceras
                const tableHeaders = [];
                document.querySelectorAll('table').forEach((t, tIdx) => {
                    const headers = [];
                    t.querySelectorAll('th').forEach(th => {
                        const hTxt = th.innerText.trim().replace(/\\s+/g, ' ');
                        if (hTxt) headers.push(hTxt);
                    });
                    const rowCount = t.querySelectorAll('tbody tr').length;
                    if (headers.length > 0) {
                        tableHeaders.push({
                            tableIndex: tIdx,
                            headers: headers,
                            visibleRows: rowCount
                        });
                    }
                });

                // Formularios, campos, interruptores y switches
                const formControls = [];
                document.querySelectorAll('label, .form-group, .checkbox, .radio, .switch').forEach(el => {
                    const labelEl = el.querySelector('label') || (el.tagName.toLowerCase() === 'label' ? el : null);
                    let labelTxt = labelEl ? labelEl.innerText.trim().replace(/\\s+/g, ' ') : '';
                    
                    const select = el.querySelector('select');
                    const input = el.querySelector('input');
                    const textarea = el.querySelector('textarea');

                    if (select) {
                        const opts = Array.from(select.options).map(o => o.text.trim()).filter(Boolean);
                        formControls.push({
                            label: labelTxt || 'Selector',
                            control: 'select',
                            model: select.getAttribute('ng-model') || '',
                            options_sample: opts.slice(0, 15)
                        });
                    } else if (input) {
                        const itype = input.type || 'text';
                        formControls.push({
                            label: labelTxt || input.placeholder || '',
                            control: itype,
                            model: input.getAttribute('ng-model') || '',
                            placeholder: input.placeholder || '',
                            checked: input.checked || false
                        });
                    } else if (textarea) {
                        formControls.push({
                            label: labelTxt || textarea.placeholder || '',
                            control: 'textarea',
                            model: textarea.getAttribute('ng-model') || '',
                            placeholder: textarea.placeholder || ''
                        });
                    }
                });

                // Pestañas / Tabs
                const tabs = [];
                document.querySelectorAll('.nav-tabs li, tabset li, .nav-pills li, ul.tabs li').forEach(tab => {
                    const txt = tab.innerText.trim().replace(/\\s+/g, ' ');
                    if (txt) tabs.push(txt);
                });

                // Alertas, notas o mensajes
                const alerts = [];
                document.querySelectorAll('.alert, .help-block, .text-muted, .ibox-title h5').forEach(al => {
                    const txt = al.innerText.trim().replace(/\\s+/g, ' ');
                    if (txt && al.offsetWidth > 0 && al.offsetHeight > 0 && txt.length < 250) {
                        alerts.push(txt);
                    }
                });

                // Secciones o paneles destacados (ibox)
                const panels = [];
                document.querySelectorAll('.ibox-title, .panel-heading').forEach(p => {
                    const txt = p.innerText.trim().replace(/\\s+/g, ' ');
                    if (txt) panels.push(txt);
                });

                return {
                    title: title,
                    breadcrumbs: Array.from(new Set(breadcrumbs)),
                    tabs: Array.from(new Set(tabs)),
                    panels: Array.from(new Set(panels)),
                    buttons: Array.from(new Set(buttons)),
                    tableHeaders: tableHeaders,
                    formControls: formControls.slice(0, 50),
                    alerts: Array.from(new Set(alerts)).slice(0, 20)
                };
            }""")

            # Endpoints detectados
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

            # Pausa obligatoria de 2.5s entre pantallas
            await page.wait_for_timeout(2500)

        # Cerrar sesion de forma segura al finalizar
        print("\n[LOGOUT] Cerrando sesion al finalizar la lectura pasiva...")
        try:
            logout_btn = page.locator('a:has-text("Cerrar sesión"), a:has-text("Cerrar Sesión"), a:has-text("Salir")').first
            if await logout_btn.count() > 0:
                await logout_btn.click()
                await page.wait_for_timeout(2000)
                print("[LOGOUT] Sesion cerrada exitosamente.")
        except Exception as e:
            print(f"[LOGOUT] Aviso de logout: {e}")

        await browser.close()

    output_path = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ajustes-a/ajustes_a_live_structure.json"
    with open(output_path, "w", encoding="utf-8") as out_f:
        json.dump(result, out_f, indent=2, ensure_ascii=False)
    print(f"\n[FINALIZADO] Estructura guardada en {output_path}")

if __name__ == "__main__":
    asyncio.run(run_inspection())
