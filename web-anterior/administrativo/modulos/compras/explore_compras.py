import asyncio
import os
import json
import re
from playwright.async_api import async_playwright

async def explore():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD environment variable not set.")
        return

    report_data = {
        "routes": {},
        "screens": {},
        "templates": {},
        "api_endpoints": []
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        # Listen to GET requests to observe endpoints (without storing sensitive data)
        async def on_response(response):
            req = response.request
            url = req.url
            if "/restaurant/api/" in url or "/rest/" in url:
                # Store endpoint structure
                clean_url = re.sub(r'([?&]token=)[^&]+', r'\1[REDACTED]', url)
                # Remove query param values if they contain sensitive data
                report_data["api_endpoints"].append({
                    "method": req.method,
                    "url": clean_url.split('?')[0],
                    "query_keys": list(re.findall(r'[\?&]([^=]+)=', clean_url)),
                    "status": response.status
                })

        page.on("response", on_response)

        # Step 1: Login
        target_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"Navegando a {target_url}...")
        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)

        # STRICT: Esperar 4 segundos completos para que carguen los desplegables
        print("Esperando 4 segundos de estabilizacion...")
        await page.wait_for_timeout(4000)

        # Rellenar SOLO usuario y contrasena
        print(f"Rellenando usuario {user}...")
        await page.fill('input[name="usuario_nick"]', user)
        await page.wait_for_timeout(500)

        print("Rellenando contrasena desde variable de entorno...")
        await page.fill('input[name="usuario_clave"]', password)
        await page.wait_for_timeout(500)

        # Pulsar UNA SOLA VEZ Iniciar sesion
        print("Pulsando Iniciar sesion...")
        await page.click('button[type="submit"]')

        # Esperar hasta 15 s a que la URL cambie
        print("Esperando transicion de URL...")
        logged_in = False
        for _ in range(30):
            await page.wait_for_timeout(500)
            if "#!/login" not in page.url:
                logged_in = True
                break

        if not logged_in:
            print("ERROR: No se pudo iniciar sesion tras 15s. URL actual: " + page.url)
            await browser.close()
            return

        print(f"Login exitoso! URL actual: {page.url}")
        # Pausa de 2 s
        await page.wait_for_timeout(2000)

        # Step 2: Extract AngularJS routes
        print("Extrayendo rutas de AngularJS...")
        routes_info = await page.evaluate("""() => {
            try {
                const el = document.querySelector('[ng-app]') || document.body;
                const injector = angular.element(el).injector();
                if (!injector) return { error: 'No injector' };
                
                let res = { routeProvider: {}, stateProvider: {} };
                if (injector.has('$route')) {
                    const $route = injector.get('$route');
                    for (let key in $route.routes) {
                        const r = $route.routes[key];
                        if (r && (key.includes('compra') || key.includes('proveed') || key.includes('lote') || key.includes('ajuste') || key.includes('almacen') || key.includes('credito'))) {
                            res.routeProvider[key] = {
                                templateUrl: r.templateUrl,
                                controller: r.controller,
                                controllerAs: r.controllerAs
                            };
                        }
                    }
                }
                return res;
            } catch(e) {
                return { error: e.toString() };
            }
        }""")
        report_data["routes"] = routes_info
        print(f"Rutas encontradas: {len(routes_info.get('routeProvider', {}))}")

        # Target routes to visit and inspect DOM
        targets = [
            ("Proveedores", "https://caprichos.restaurant.pe/restaurant/#!/compras/proveedores"),
            ("Lotizar Compras", "https://caprichos.restaurant.pe/restaurant/#!/compras/lotes"),
            ("Ajustes Compras", "https://caprichos.restaurant.pe/restaurant/#!/compras/ajustes/banco")
        ]

        for name, url in targets:
            print(f"Visitando {name} ({url})...")
            # Pausa de 2 s entre pantallas
            await page.wait_for_timeout(2000)
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # Esperar a que cargue la vista
            await page.wait_for_timeout(3000)

            # Extraer estructura DOM (sin datos personales)
            screen_dom = await page.evaluate("""() => {
                const extractData = {};
                
                // Titulo o breadcrumbs
                const header = document.querySelector('.page-heading, .ibox-title, h2, h3, h4');
                extractData.title = header ? header.innerText.trim() : '';

                // Botones visibles
                extractData.buttons = Array.from(document.querySelectorAll('button, .btn, a.btn')).map(b => {
                    return {
                        text: b.innerText.trim().replace(/\\n/g, ' '),
                        tag: b.tagName,
                        classes: b.className,
                        type: b.getAttribute('type') || '',
                        id: b.id || '',
                        ngClick: b.getAttribute('ng-click') || '',
                        disabled: b.disabled || b.classList.contains('disabled')
                    };
                }).filter(b => b.text.length > 0 && !['Cerrar sesión', 'Salir'].includes(b.text));

                // Tablas y cabeceras de columnas
                extractData.tables = Array.from(document.querySelectorAll('table')).map(tbl => {
                    const headers = Array.from(tbl.querySelectorAll('thead th, thead td, th')).map(th => th.innerText.trim().replace(/\\n/g, ' '));
                    const rowCount = tbl.querySelectorAll('tbody tr').length;
                    return {
                        headers: headers.filter(h => h.length > 0),
                        rowCount: rowCount
                    };
                });

                // Formularios / inputs visibles o en la pagina
                extractData.inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(inp => {
                    const lbl = inp.closest('.form-group') ? inp.closest('.form-group').querySelector('label') : null;
                    return {
                        tag: inp.tagName.toLowerCase(),
                        type: inp.type || '',
                        name: inp.name || '',
                        id: inp.id || '',
                        placeholder: inp.placeholder || '',
                        label: lbl ? lbl.innerText.trim() : '',
                        ngModel: inp.getAttribute('ng-model') || '',
                        disabled: inp.disabled,
                        options: inp.tagName.toLowerCase() === 'select' ? Array.from(inp.options).map(o => o.text.trim()) : []
                    };
                });

                // Modales en el HTML
                extractData.modals = Array.from(document.querySelectorAll('.modal')).map(m => {
                    const modalTitle = m.querySelector('.modal-title, h4, h3');
                    const modalButtons = Array.from(m.querySelectorAll('button, .btn')).map(b => b.innerText.trim());
                    const modalLabels = Array.from(m.querySelectorAll('label')).map(l => l.innerText.trim());
                    const modalInputs = Array.from(m.querySelectorAll('input, select, textarea')).map(inp => {
                        const lbl = inp.closest('.form-group') ? inp.closest('.form-group').querySelector('label') : null;
                        return {
                            tag: inp.tagName.toLowerCase(),
                            type: inp.type || '',
                            name: inp.name || '',
                            label: lbl ? lbl.innerText.trim() : '',
                            ngModel: inp.getAttribute('ng-model') || '',
                            placeholder: inp.placeholder || ''
                        };
                    });
                    return {
                        id: m.id || '',
                        title: modalTitle ? modalTitle.innerText.trim() : '',
                        labels: modalLabels.filter(l => l.length > 0),
                        buttons: modalButtons.filter(b => b.length > 0),
                        inputs: modalInputs
                    };
                });

                // Tabs o pestañas
                extractData.tabs = Array.from(document.querySelectorAll('.nav-tabs li, .nav-pills li')).map(t => t.innerText.trim());

                return extractData;
            }""")
            report_data["screens"][name] = screen_dom

        # Fetch template HTMLs for compras
        print("Obteniendo contenido de plantillas asociadas...")
        templates_to_fetch = []
        rp = report_data["routes"].get("routeProvider", {})
        for rk, rv in rp.items():
            t_url = rv.get("templateUrl")
            if t_url and t_url not in templates_to_fetch:
                templates_to_fetch.append(t_url)

        print(f"Plantillas a descargar: {templates_to_fetch}")
        for t_url in templates_to_fetch:
            content = await page.evaluate("""async (url) => {
                try {
                    const resp = await fetch(url);
                    if (resp.ok) return await resp.text();
                    return 'ERROR ' + resp.status;
                } catch(e) {
                    return 'FETCH_ERROR: ' + e.toString();
                }
            }""", t_url)
            report_data["templates"][t_url] = content
            await page.wait_for_timeout(500)

        # Cierre de sesion seguro al final
        print("Cerrando sesion...")
        try:
            await page.click('text="Cerrar sesión"', timeout=3000)
            await page.wait_for_timeout(2000)
        except Exception as e:
            print("No se pudo cerrar sesion con boton:", e)

        await browser.close()

    # Guardar estructura
    out_file = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/compras/report_raw.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2, ensure_ascii=False)
    print(f"Reporte crudo guardado en {out_file}")

if __name__ == "__main__":
    asyncio.run(explore())
