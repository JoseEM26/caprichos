import asyncio
import os
import json
import re
from playwright.async_api import async_playwright

async def inspect():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD environment variable not set.")
        return

    data_collected = {
        "routes": [],
        "productos_routes": [],
        "network_get_endpoints": [],
        "screen_info": {},
        "modals_or_forms": {},
        "templates": {}
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1600, "height": 1000})
        page = await context.new_page()

        # Capture GET API endpoints
        async def handle_response(resp):
            url = resp.url
            if resp.request.method == "GET" and any(k in url for k in ["/rest/", "/api/", "/m/rest/"]):
                status = resp.status
                # We do NOT capture personal data or amounts, just URL and structure of json keys
                entry = {
                    "url": url,
                    "status": status,
                    "keys": []
                }
                try:
                    ct = resp.headers.get("content-type", "")
                    if "application/json" in ct:
                        res_json = await resp.json()
                        if isinstance(res_json, dict):
                            entry["keys"] = list(res_json.keys())
                            # if results array, get sample keys
                            for k, v in res_json.items():
                                if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                                    entry[f"{k}_item_keys"] = list(v[0].keys())
                        elif isinstance(res_json, list) and len(res_json) > 0 and isinstance(res_json[0], dict):
                            entry["keys"] = list(res_json[0].keys())
                except Exception:
                    pass
                data_collected["network_get_endpoints"].append(entry)

        page.on("response", handle_response)

        target_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"1. Navigating to {target_url}...")
        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)

        # Wait 4s for AngularJS models to stabilize
        print("2. Waiting 4 seconds for dropdowns to preload...")
        await page.wait_for_timeout(4000)

        # Fill ONLY username and password
        print("3. Filling username and password...")
        await page.locator('input[name="usuario_nick"]').fill(user)
        await page.wait_for_timeout(500)
        await page.locator('input[name="usuario_clave"]').fill(password)
        await page.wait_for_timeout(500)

        # Click submit once
        print("4. Clicking Iniciar sesión...")
        await page.locator('button[type="submit"]').click()

        # Wait up to 15s for URL to change
        print("5. Waiting up to 15s for login navigation...")
        logged_in = False
        for _ in range(30):
            await page.wait_for_timeout(500)
            if "#!/login" not in page.url:
                logged_in = True
                print(f"Logged in successfully! Current URL: {page.url}")
                break

        if not logged_in:
            print("Login failed or URL did not change within 15 seconds.")
            await browser.close()
            return

        # Wait 3s after login
        await page.wait_for_timeout(3000)

        # Extract all routes registered in AngularJS
        routes_info = await page.evaluate("""() => {
            try {
                const el = document.querySelector('[ng-app]') || document.body;
                const injector = angular.element(el).injector();
                if (!injector) return { error: 'No injector' };
                
                let routes = [];
                if (injector.has('$route')) {
                    const $route = injector.get('$route');
                    for (let r in $route.routes) {
                        if (r && r !== 'null' && r !== 'undefined') {
                            const rObj = $route.routes[r];
                            routes.push({
                                path: r,
                                templateUrl: rObj.templateUrl || null,
                                controller: rObj.controller || null
                            });
                        }
                    }
                } else if (injector.has('$state')) {
                    const $state = injector.get('$state');
                    const states = $state.get();
                    routes = states.map(s => ({
                        name: s.name,
                        url: s.url,
                        templateUrl: s.templateUrl || null,
                        controller: s.controller || null
                    }));
                }
                return { routes: routes };
            } catch (e) {
                return { error: e.toString() };
            }
        }""")
        data_collected["routes"] = routes_info

        # Filter routes for productos / platos / categorias / recetas
        if "routes" in routes_info and isinstance(routes_info["routes"], list):
            for r in routes_info["routes"]:
                p_val = r.get("path") or r.get("url") or ""
                if any(k in p_val.lower() for k in ["producto", "plato", "categoria", "receta", "insumo", "adicional"]):
                    data_collected["productos_routes"].append(r)

        print(f"Identified {len(data_collected['productos_routes'])} routes matching productos / platos / etc.")

        # Pause 2s before navigating to target module
        await page.wait_for_timeout(2000)

        # Navigate to #!/productos/platos/categoria/All
        dest_url = "https://caprichos.restaurant.pe/restaurant/#!/productos/platos/categoria/All"
        print(f"6. Navigating to {dest_url}...")
        await page.goto(dest_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)

        print(f"Current page URL: {page.url}")

        # Extract structure of the current screen
        screen_structure = await page.evaluate("""() => {
            const res = {
                title: document.title,
                breadcrumbs: [],
                header_title: '',
                buttons: [],
                tabs: [],
                filters: [],
                tables: [],
                forms: [],
                modal_triggers: []
            };

            // Breadcrumbs / Titles
            document.querySelectorAll('.breadcrumb li, h2, h3, h4, .page-heading').forEach(el => {
                const txt = el.innerText.trim();
                if (txt) res.breadcrumbs.push(txt);
            });

            // Buttons
            document.querySelectorAll('button, .btn, a.btn').forEach(btn => {
                const txt = btn.innerText.trim() || btn.getAttribute('title') || btn.getAttribute('aria-label') || '';
                const ngClick = btn.getAttribute('ng-click') || '';
                const href = btn.getAttribute('href') || '';
                const classes = btn.className || '';
                if (txt || ngClick) {
                    res.buttons.push({ text: txt, ngClick: ngClick, href: href, class: classes });
                }
            });

            // Nav tabs
            document.querySelectorAll('.nav-tabs li, .nav-pills li').forEach(tab => {
                res.tabs.push(tab.innerText.trim());
            });

            // Filters / Selects / Inputs
            document.querySelectorAll('select, input, textarea').forEach(inp => {
                let lbl = '';
                if (inp.id) {
                    const lEl = document.querySelector(`label[for="${inp.id}"]`);
                    if (lEl) lbl = lEl.innerText.trim();
                }
                if (!lbl && inp.closest('.form-group')) {
                    const lEl = inp.closest('.form-group').querySelector('label');
                    if (lEl) lbl = lEl.innerText.trim();
                }
                let options = [];
                if (inp.tagName.toLowerCase() === 'select') {
                    Array.from(inp.options).slice(0, 15).forEach(o => options.push(o.text.trim()));
                }
                res.filters.push({
                    tag: inp.tagName.toLowerCase(),
                    type: inp.type || '',
                    name: inp.name || '',
                    ngModel: inp.getAttribute('ng-model') || '',
                    placeholder: inp.placeholder || '',
                    label: lbl,
                    options: options
                });
            });

            // Tables
            document.querySelectorAll('table').forEach((tbl, idx) => {
                const headers = [];
                tbl.querySelectorAll('th').forEach(th => headers.push(th.innerText.trim()));
                res.tables.push({
                    tableIndex: idx,
                    headers: headers,
                    rowCount: tbl.querySelectorAll('tbody tr').length
                });
            });

            return res;
        }""")
        data_collected["screen_info"]["productos_main"] = screen_structure

        # Wait 2s
        await page.wait_for_timeout(2000)

        # Safely logout at the end
        print("7. Logging out safely...")
        try:
            logout_found = await page.evaluate("""() => {
                const links = Array.from(document.querySelectorAll('a, button'));
                const exitLink = links.find(el => {
                    const t = (el.innerText || '').toLowerCase();
                    return t.includes('cerrar sesión') || t.includes('salir');
                });
                if (exitLink) {
                    exitLink.click();
                    return true;
                }
                return false;
            }""")
            print(f"Logout link clicked: {logout_found}")
            await page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Logout error: {e}")

        await browser.close()

    # Save findings
    out_path = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/productos/raw_inspection.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data_collected, f, indent=2, ensure_ascii=False)
    print(f"Saved inspection findings to {out_path}")

if __name__ == "__main__":
    asyncio.run(inspect())
