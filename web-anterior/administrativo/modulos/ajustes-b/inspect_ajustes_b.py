import asyncio
import os
import json
import re
import sys
from playwright.async_api import async_playwright

async def inspect_ajustes():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD env variable missing", file=sys.stderr)
        sys.exit(1)

    target_routes = [
        {"id": "comprobantes", "name": "Comprobantes", "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/comprobantes"},
        {"id": "impuestos", "name": "Impuestos", "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/impuestos"},
        {"id": "tarjetas", "name": "Tarjetas", "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/tarjetas"},
        {"id": "monedas", "name": "Monedas", "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/monedas"},
        {"id": "monedafacturacion", "name": "Moneda de facturacion", "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/monedafacturacion"},
        {"id": "tipotransferencia", "name": "Cuentas de transferencia", "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/tipotransferencia"},
        {"id": "categoriaanularventa", "name": "Categoria Anular Venta", "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/categoriaanularventa"},
        {"id": "formas_de_pago", "name": "Formas de pago", "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/formas-de-pago"}
    ]

    result = {
        "login": {},
        "screens": {},
        "relevant_templates": {}
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        current_network_calls = []

        async def on_request(req):
            if any(term in req.url.lower() for term in ["rest", "api"]):
                url_clean = req.url.split("?")[0]
                current_network_calls.append({
                    "type": "REQUEST",
                    "method": req.method,
                    "url_endpoint": url_clean
                })

        async def on_response(resp):
            if any(term in resp.url.lower() for term in ["rest", "api"]):
                url_clean = resp.url.split("?")[0]
                current_network_calls.append({
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

        # Esperar 4 segundos obligatorios para estabilización de selectores
        print("[LOGIN] Esperando 4 segundos a que carguen desplegables...")
        await page.wait_for_timeout(4000)

        # Rellenar únicamente usuario y contraseña
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
            with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ajustes-b/live_structure.json", "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            return

        # Pausa de estabilización inicial
        await page.wait_for_timeout(2000)

        # 1. Extraer todas las plantillas del $templateCache de AngularJS para nuestro módulo
        print("[TEMPLATES] Extrayendo plantillas relevantes de $templateCache...")
        templates_extracted = await page.evaluate("""() => {
            const data = {};
            try {
                const el = document.querySelector('[ng-app]') || document.body;
                const $injector = angular.element(el).injector();
                if ($injector) {
                    const $templateCache = $injector.get('$templateCache');
                    // Lista de claves en templateCache
                    // En Angular 1.x, $templateCache.info() da las keys o podemos iterar
                    // pero $templateCache es un cache object.
                    // Para obtener todas las keys podemos inspeccionar las propiedades internas
                    // o buscar en el bundle o invocar un script
                    // En Angular $templateCache se apoya en $cacheFactory
                    // Intentamos acceder a las keys
                }
            } catch(e) {
                data['error'] = e.toString();
            }
            return data;
        }""")

        # 2. Navegar pasivamente por cada una de las 8 pantallas asignadas
        for r in target_routes:
            print(f"\n[NAVEGACION] Inspeccionando {r['name']} ({r['url']})...")
            current_network_calls.clear()

            await page.goto(r["url"], wait_until="domcontentloaded", timeout=30000)
            # Esperar 2.5s para renderizado pasivo de Angular y tablas
            await page.wait_for_timeout(2500)

            # Extraer estructura DOM completa (solo lectura)
            dom_data = await page.evaluate("""() => {
                const titleEl = document.querySelector('.page-heading h2, h2.font-light, .page-title, h1, h2');
                const title = titleEl ? titleEl.innerText.trim() : '';

                const bcEls = document.querySelectorAll('.breadcrumb li, .breadcrumb a, .breadcrumb span');
                const breadcrumbs = Array.from(bcEls).map(el => el.innerText.trim()).filter(Boolean);

                // Botones visibles (nombres, clases, atributos seguros)
                const btnEls = document.querySelectorAll('button, a.btn, input[type="button"], input[type="submit"], a[ui-sref], a[ng-click]');
                const buttons = [];
                btnEls.forEach(b => {
                    const txt = b.innerText ? b.innerText.trim() : (b.value || '');
                    if (txt && b.offsetWidth > 0 && b.offsetHeight > 0) {
                        buttons.push({
                            text: txt.replace(/\\s+/g, ' '),
                            classes: b.className || '',
                            ng_click: b.getAttribute('ng-click') || '',
                            ui_sref: b.getAttribute('ui-sref') || '',
                            title: b.getAttribute('title') || ''
                        });
                    }
                });

                // Tablas y cabeceras
                const tables = [];
                document.querySelectorAll('table').forEach((t, tIdx) => {
                    const headers = [];
                    t.querySelectorAll('th').forEach(th => {
                        const hTxt = th.innerText.trim().replace(/\\s+/g, ' ');
                        if (hTxt) headers.push(hTxt);
                    });

                    // Extraer nombres de atributos / columnas en ng-repeat si existen
                    const sampleRow = t.querySelector('tbody tr');
                    const rowNgRepeat = sampleRow ? (sampleRow.getAttribute('ng-repeat') || '') : '';
                    
                    // Conteo de filas visibles
                    const rowCount = t.querySelectorAll('tbody tr').length;

                    tables.push({
                        tableIndex: tIdx,
                        headers: headers,
                        rowNgRepeat: rowNgRepeat,
                        rowCount: rowCount
                    });
                });

                // Campos visibles (formularios / filtros)
                const formFields = [];
                document.querySelectorAll('form, .ibox-content, .panel-body').forEach(container => {
                    container.querySelectorAll('.form-group, label').forEach(fg => {
                        const labelEl = fg.tagName.toLowerCase() === 'label' ? fg : fg.querySelector('label');
                        const labelTxt = labelEl ? labelEl.innerText.trim().replace(/\\s+/g, ' ') : '';
                        
                        const input = fg.querySelector('input');
                        const select = fg.querySelector('select');
                        const textarea = fg.querySelector('textarea');

                        if (select) {
                            const optTexts = Array.from(select.options).map(o => o.text.trim()).filter(Boolean);
                            formFields.push({
                                label: labelTxt || 'Selector',
                                tag: 'select',
                                ng_model: select.getAttribute('ng-model') || '',
                                options_sample: optTexts.slice(0, 10)
                            });
                        } else if (input) {
                            formFields.push({
                                label: labelTxt || input.placeholder || 'Input',
                                tag: 'input',
                                type: input.type || 'text',
                                ng_model: input.getAttribute('ng-model') || '',
                                placeholder: input.placeholder || '',
                                required: input.hasAttribute('required')
                            });
                        } else if (textarea) {
                            formFields.push({
                                label: labelTxt || 'Textarea',
                                tag: 'textarea',
                                ng_model: textarea.getAttribute('ng-model') || '',
                                placeholder: textarea.placeholder || ''
                            });
                        }
                    });
                });

                // Tabs y pills
                const tabs = [];
                document.querySelectorAll('.nav-tabs li, tabset li, .nav-pills li').forEach(tab => {
                    const txt = tab.innerText.trim().replace(/\\s+/g, ' ');
                    if (txt) tabs.push(txt);
                });

                // Mensajes de ayuda, alertas y textos informativos
                const alerts = [];
                document.querySelectorAll('.alert, .help-block, .text-muted, .text-info, .label, .badge').forEach(el => {
                    const txt = el.innerText.trim().replace(/\\s+/g, ' ');
                    if (txt && el.offsetWidth > 0 && el.offsetHeight > 0 && txt.length < 200) {
                        alerts.push(txt);
                    }
                });

                // Identificar el controlador y scope de la vista
                let controllerName = '';
                let stateName = '';
                const appRoot = document.querySelector('[ng-app]') || document.body;
                if (window.angular) {
                    try {
                        const viewEl = document.querySelector('[ui-view]') || document.querySelector('[ng-view]') || document.body;
                        const scope = angular.element(viewEl).scope();
                        if (scope) {
                            if (scope.$state) stateName = scope.$state.current.name;
                            if (scope.vm) {
                                controllerName = scope.vm.constructor ? scope.vm.constructor.name : 'vm';
                            }
                        }
                    } catch(e) {}
                }

                return {
                    title: title,
                    breadcrumbs: breadcrumbs,
                    tabs: tabs,
                    stateName: stateName,
                    controllerName: controllerName,
                    buttons: buttons,
                    tables: tables,
                    formFields: formFields.slice(0, 40),
                    alerts: Array.from(new Set(alerts)).slice(0, 20)
                };
            }""")

            # Obtener endpoints filtrados (método y URL sin parámetros sensibles)
            endpoints_seen = []
            for item in current_network_calls:
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

            # Pausa estricta de 2 segundos requerida entre pantallas
            await page.wait_for_timeout(2000)

        # 3. Al finalizar toda la inspección de solo lectura, cerrar sesión
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

    output_file = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/ajustes-b/live_structure.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n[FINALIZADO] Inspección completada. Datos guardados en {output_file}")

if __name__ == "__main__":
    asyncio.run(inspect_ajustes())
