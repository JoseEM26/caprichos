import asyncio
import os
import json
import re
from playwright.async_api import async_playwright

TARGET_ROUTES = [
    {
        "name": "Ofertas",
        "url": "https://caprichos.restaurant.pe/restaurant/#!/ofertas/sucursales/2en1/1/categoria/All"
    },
    {
        "name": "Descuentos",
        "url": "https://caprichos.restaurant.pe/restaurant/#!/descuentos"
    },
    {
        "name": "Cupon descuento",
        "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/cupondescuento"
    },
    {
        "name": "Promociones y sorteos",
        "url": "https://caprichos.restaurant.pe/restaurant/#!/promocionsorteo"
    },
    {
        "name": "Vales de Pago",
        "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/valedepago"
    }
]

async def inspect_screen(page, route_info):
    print(f"\n--- Navigating to {route_info['name']}: {route_info['url']} ---")
    await page.goto(route_info['url'], wait_until="domcontentloaded", timeout=60000)
    await page.wait_for_timeout(3000) # Give AngularJS time to render

    info = await page.evaluate("""() => {
        // Extract page title and breadcrumbs
        const titleEl = document.querySelector('.page-heading h2, h2.font-bold, .wrapper-content h2, title');
        const pageTitle = titleEl ? titleEl.innerText.trim() : document.title;
        
        const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb li')).map(li => li.innerText.trim());

        // Extract tabs / submenus
        const tabs = Array.from(document.querySelectorAll('ul.nav-tabs li, .nav-pills li, .btn-group button, .nav-tabs a')).map(t => t.innerText.trim()).filter(Boolean);

        // Extract tables and headers
        const tables = [];
        document.querySelectorAll('table').forEach((tbl, idx) => {
            const headers = Array.from(tbl.querySelectorAll('th')).map(th => th.innerText.trim()).filter(Boolean);
            const rowCount = tbl.querySelectorAll('tbody tr').length;
            tables.push({
                tableIndex: idx,
                headers: headers,
                rowCount: rowCount
            });
        });

        // Extract form controls (labels, input names, types, placeholders)
        const formControls = [];
        document.querySelectorAll('label, .form-group, .form-horizontal .control-label').forEach(group => {
            const label = group.querySelector('label') ? group.querySelector('label').innerText.trim() : (group.tagName.toLowerCase() === 'label' ? group.innerText.trim() : '');
            const input = group.querySelector('input, select, textarea');
            if (input && label) {
                formControls.push({
                    label: label,
                    tag: input.tagName.toLowerCase(),
                    type: input.type || '',
                    name: input.name || input.getAttribute('ng-model') || '',
                    placeholder: input.placeholder || ''
                });
            }
        });

        // Extract visible filters
        const filters = [];
        document.querySelectorAll('select, .ui-select-container, input[type="search"], input[ng-model*="filtro"], input[ng-model*="buscar"], input[ng-model*="search"]').forEach(el => {
            let label = el.getAttribute('placeholder') || el.name || el.getAttribute('ng-model') || 'Filtro';
            let options = [];
            if (el.tagName.toLowerCase() === 'select') {
                options = Array.from(el.options).map(o => o.text.trim());
            }
            filters.push({
                identifier: label,
                tag: el.tagName.toLowerCase(),
                options: options.slice(0, 15) // Limit to top 15 options
            });
        });

        // Extract action buttons (pure structure, do not click)
        const buttons = [];
        document.querySelectorAll('button, a.btn, input[type="button"], input[type="submit"]').forEach(btn => {
            const text = btn.innerText.trim() || btn.title || btn.getAttribute('aria-label') || '';
            const className = btn.className || '';
            if (text && btn.offsetWidth > 0 && btn.offsetHeight > 0) {
                buttons.push({
                    text: text,
                    class: className
                });
            }
        });

        // Current Angular Scope state or controller name
        let controllerName = null;
        let routeParams = null;
        try {
            const appEl = document.querySelector('[ng-controller], [ui-view]');
            if (appEl && window.angular) {
                const scope = window.angular.element(appEl).scope();
                if (scope) {
                    controllerName = scope.vm ? 'vm' : (scope.$ctrl ? '$ctrl' : 'scope');
                }
            }
        } catch(e) {}

        return {
            pageTitle: pageTitle,
            breadcrumbs: breadcrumbs,
            tabs: tabs,
            tables: tables,
            formControls: formControls,
            filters: filters,
            buttons: buttons
        };
    }""")

    return info

async def run_inspection():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD environment variable not set.")
        return

    results = {
        "login_status": None,
        "screens": {}
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        # Listen to GET requests to observe endpoints passively
        observed_get_endpoints = {}
        async def handle_request(req):
            if req.method == "GET":
                url = req.url
                if "/restaurant/api/" in url or "/api/rest/" in url or "/m/rest/" in url:
                    # strip query params or ids to document structure
                    clean_url = url.split("?")[0]
                    observed_get_endpoints[clean_url] = observed_get_endpoints.get(clean_url, 0) + 1

        page.on("request", handle_request)

        # Login flow
        target_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"Navigating to {target_url}...")
        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        
        # Mandatory 4s wait
        await page.wait_for_timeout(4000)

        # Fill credentials
        user_input = page.locator('input[name="usuario_nick"]')
        pass_input = page.locator('input[name="usuario_clave"]')
        await user_input.fill(user)
        await page.wait_for_timeout(500)
        await pass_input.fill(password)
        await page.wait_for_timeout(500)

        # Submit ONCE
        login_btn = page.locator('button[type="submit"]')
        print("Clicking submit button once...")
        await login_btn.click()

        # Wait up to 15s for URL to change
        logged_in = False
        for _ in range(30):
            await page.wait_for_timeout(500)
            if "#!/login" not in page.url:
                logged_in = True
                print(f"Login successful! Navigated to: {page.url}")
                break

        if not logged_in:
            print("Login failed or URL did not change.")
            results["login_status"] = "FALLIDO"
            await browser.close()
            return

        results["login_status"] = "EXITOSO"
        await page.wait_for_timeout(3000)

        # Now navigate through target routes with 2s pause
        for route in TARGET_ROUTES:
            await page.wait_for_timeout(2000)
            screen_info = await inspect_screen(page, route)
            results["screens"][route["name"]] = screen_info

        results["observed_get_endpoints"] = list(observed_get_endpoints.keys())

        # Safely logout at the end
        print("\nLogging out safely...")
        try:
            await page.click('text="Cerrar sesión"', timeout=4000)
            await page.wait_for_timeout(2000)
            print("Session closed cleanly.")
        except Exception as e:
            print(f"Logout failed or already closed: {e}")

        await browser.close()

    output_path = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/promos/live_structure.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Structure saved to {output_path}")

if __name__ == "__main__":
    asyncio.run(run_inspection())
