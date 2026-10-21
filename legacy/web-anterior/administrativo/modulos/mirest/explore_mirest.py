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

    data_collected = {
        "routes": {},
        "screens_dom": {},
        "templates": {},
        "endpoints": []
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        # Capture API GET endpoints
        def on_response(response):
            req = response.request
            url = req.url
            if "/restaurant/api/" in url or "/rest/" in url:
                # Sanitize URL
                clean_url = re.sub(r'([?&]token=)[^&]+', r'\1[REDACTED]', url)
                clean_url = re.sub(r'([?&]clave=)[^&]+', r'\1[REDACTED]', clean_url)
                data_collected["endpoints"].append({
                    "method": req.method,
                    "url": clean_url.split('?')[0],
                    "status": response.status,
                    "query": clean_url.split('?')[1] if '?' in clean_url else ""
                })

        page.on("response", on_response)

        # 1. Login
        target_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"Navegando a {target_url}...")
        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)

        # Wait 4s
        print("Esperando 4 segundos obligatorios...")
        await page.wait_for_timeout(4000)

        # Fill credentials only
        print("Llenando credenciales...")
        await page.fill('input[name="usuario_nick"]', user)
        await page.wait_for_timeout(500)
        await page.fill('input[name="usuario_clave"]', password)
        await page.wait_for_timeout(500)

        # Click submit once
        print("Pulsando submit...")
        await page.click('button[type="submit"]')

        # Wait up to 15s
        logged_in = False
        for _ in range(30):
            await page.wait_for_timeout(500)
            if "#!/login" not in page.url:
                logged_in = True
                break

        if not logged_in:
            print("ERROR: No se pudo ingresar. URL:", page.url)
            await browser.close()
            return

        print(f"Login exitoso: {page.url}")
        await page.wait_for_timeout(2000)

        # Extract states metadata
        states_meta = await page.evaluate("""() => {
            try {
                const el = document.querySelector('[ng-app]') || document.body;
                const injector = angular.element(el).injector();
                if (!injector) return [];
                const $state = injector.get('$state');
                const states = $state.get();
                return states.filter(s => {
                    const n = s.name || '';
                    const u = s.url || '';
                    return n.includes('mirestaurante') || n.includes('facturacion') || 
                           n.includes('contingencia') || n.includes('integracion') || 
                           n.includes('pos') || u.includes('miempresa') || 
                           u.includes('serie-contingencia');
                }).map(s => ({
                    name: s.name,
                    url: s.url,
                    templateUrl: s.templateUrl,
                    controller: s.controller,
                    abstract: s.abstract
                }));
            } catch (e) {
                return { error: e.message };
            }
        }""")
        data_collected["states_meta"] = states_meta
        print(f"Estados filtrados encontrados: {len(states_meta)}")

        # List of routes to inspect
        target_routes = [
            ("Mi empresa", "https://caprichos.restaurant.pe/restaurant/#!/mirestaurante/miempresa"),
            ("Facturacion Electronica", "https://caprichos.restaurant.pe/restaurant/#!/ajustes/facturacionelectronica"),
            ("Series de contingencia", "https://caprichos.restaurant.pe/restaurant/#!/ajustes/serie-contingencia"),
            ("Integraciones", "https://caprichos.restaurant.pe/restaurant/#!/ajustes/integraciones"),
            ("Integracion POS", "https://caprichos.restaurant.pe/restaurant/#!/ajustes/pos")
        ]

        for screen_name, route_url in target_routes:
            print(f"\n--- Navegando a {screen_name}: {route_url} ---")
            await page.goto(route_url, wait_until="domcontentloaded", timeout=60000)
            # Wait 2s
            await page.wait_for_timeout(2500)

            # Extract screen DOM structure
            screen_info = await page.evaluate("""() => {
                const getStructure = () => {
                    // Title and breadcrumbs
                    const titleEl = document.querySelector('.page-heading h2, h2, .ibox-title h5');
                    const title = titleEl ? titleEl.innerText.trim() : '';
                    
                    const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb li')).map(li => li.innerText.trim());
                    
                    // Buttons
                    const buttons = Array.from(document.querySelectorAll('button, a.btn')).map(b => ({
                        text: b.innerText.trim(),
                        class: b.className,
                        type: b.getAttribute('type') || '',
                        ngClick: b.getAttribute('ng-click') || '',
                        href: b.getAttribute('href') || ''
                    })).filter(b => b.text.length > 0);

                    // Tables
                    const tables = Array.from(document.querySelectorAll('table')).map(t => {
                        const headers = Array.from(t.querySelectorAll('thead th, thead td')).map(th => th.innerText.trim());
                        const rowCount = t.querySelectorAll('tbody tr').length;
                        return { headers, rowCount };
                    });

                    // Forms and inputs
                    const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(inp => {
                        let label = '';
                        const formGroup = inp.closest('.form-group');
                        if (formGroup) {
                            const lblEl = formGroup.querySelector('label');
                            if (lblEl) label = lblEl.innerText.trim();
                        }
                        return {
                            name: inp.name || inp.id || '',
                            type: inp.type || inp.tagName.toLowerCase(),
                            placeholder: inp.placeholder || '',
                            label: label,
                            ngModel: inp.getAttribute('ng-model') || '',
                            required: inp.required || !!inp.getAttribute('required') || !!inp.getAttribute('ng-required'),
                            disabled: inp.disabled || !!inp.getAttribute('ng-disabled'),
                            options: inp.tagName.toLowerCase() === 'select' ? Array.from(inp.options).map(o => o.text.trim()) : []
                        };
                    });

                    // Tabs
                    const tabs = Array.from(document.querySelectorAll('.nav-tabs li a')).map(a => a.innerText.trim());

                    // Alerts or notices
                    const alerts = Array.from(document.querySelectorAll('.alert, .note, .help-block')).map(a => a.innerText.trim()).filter(t => t.length > 0);

                    // Text of the page content summary
                    const contentContainer = document.querySelector('.wrapper-content') || document.body;
                    
                    return {
                        title,
                        breadcrumbs,
                        buttons,
                        tables,
                        inputs,
                        tabs,
                        alerts,
                        htmlSnippet: contentContainer.innerHTML.slice(0, 5000)
                    };
                };
                return getStructure();
            }""")
            data_collected["screens_dom"][screen_name] = screen_info
            print(f"Inspeccionada pantalla {screen_name}. Titulo: '{screen_info.get('title')}', Tablas: {len(screen_info.get('tables', []))}, Inputs: {len(screen_info.get('inputs', []))}")

        # Extract templates from $templateCache
        templates_dict = await page.evaluate("""() => {
            try {
                const el = document.querySelector('[ng-app]') || document.body;
                const injector = angular.element(el).injector();
                if (!injector) return {};
                const $templateCache = injector.get('$templateCache');
                // We can check keys in templateCache
                // In angular 1.x $templateCache doesn't have an easy keys() array, but we can inspect cache info or keys if available
                return { note: "checked" };
            } catch (e) {
                return { error: e.message };
            }
        }""")
        
        # Logout at the end
        print("\nCerrando sesion...")
        try:
            logout_btn = page.locator('a:has-text("Cerrar sesión"), a:has-text("Cerrar Sesión"), a:has-text("Salir")')
            if await logout_btn.count() > 0:
                await logout_btn.first.click()
                await page.wait_for_timeout(2000)
                print("Sesion cerrada correctamente.")
        except Exception as e:
            print("Error cerrando sesion:", e)

        await browser.close()

    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/mirest/raw_inspection.json", "w", encoding="utf-8") as f:
        json.dump(data_collected, f, indent=2, ensure_ascii=False)
    print("Exploración finalizada. Datos guardados en raw_inspection.json")

if __name__ == "__main__":
    asyncio.run(explore())
