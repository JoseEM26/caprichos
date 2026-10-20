import asyncio
import os
import json
import re
from playwright.async_api import async_playwright

def sanitize_data_schema(obj, depth=0):
    """
    Recursively extract the data structure (types and keys) without actual values,
    to avoid saving real numbers, names, sales, or personal data.
    """
    if depth > 5:
        return "..."
    if isinstance(obj, dict):
        return {k: sanitize_data_schema(v, depth + 1) for k, v in obj.items()}
    elif isinstance(obj, list):
        if len(obj) == 0:
            return []
        # Return sample element schema
        return [sanitize_data_schema(obj[0], depth + 1)]
    elif isinstance(obj, bool):
        return "boolean"
    elif isinstance(obj, (int, float)):
        return "number"
    elif isinstance(obj, str):
        return "string"
    elif obj is None:
        return "null"
    return type(obj).__name__

async def inspect():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD environment variable not set.")
        return

    report = {
        "screen": "Escritorio > Resumen",
        "route": "#!/",
        "angular_route_info": {},
        "network_get_endpoints": [],
        "dom_structure": {},
        "template_cache_keys": [],
        "resumen_template_html": ""
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1600, "height": 1000})
        page = await context.new_page()

        captured_requests = []

        async def on_response(resp):
            url = resp.url
            # Capture GET requests to REST/API or HTML templates
            if resp.request.method == "GET" and any(k in url for k in ["/rest/", "/api/", ".html", "resumen", "escritorio", "dashboard"]):
                status = resp.status
                content_type = resp.headers.get("content-type", "")
                entry = {
                    "url": url,
                    "status": status,
                    "content_type": content_type
                }
                if "application/json" in content_type:
                    try:
                        data = await resp.json()
                        entry["schema"] = sanitize_data_schema(data)
                    except Exception:
                        entry["schema"] = "could_not_parse_json"
                captured_requests.append(entry)

        page.on("response", on_response)

        # 1. Login
        target_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"Navigating to {target_url}...")
        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)

        # Wait 4 seconds for dropdowns to load
        print("Waiting 4 seconds for dropdowns to settle...")
        await page.wait_for_timeout(4000)

        # Fill credentials
        print(f"Typing user '{user}'...")
        await page.locator('input[name="usuario_nick"]').fill(user)
        await page.wait_for_timeout(500)

        print("Typing password...")
        await page.locator('input[name="usuario_clave"]').fill(password)
        await page.wait_for_timeout(500)

        # Click submit ONCE
        print("Submitting login form...")
        await page.locator('button[type="submit"]').click()

        # Wait up to 15s for URL to change away from #!/login
        print("Waiting up to 15s for navigation...")
        logged_in = False
        for _ in range(30):
            await page.wait_for_timeout(500)
            if "#!/login" not in page.url:
                logged_in = True
                break

        if not logged_in:
            print(f"Login failed or timed out. Current URL: {page.url}")
            await browser.close()
            return

        print(f"Logged in successfully. Current URL: {page.url}")
        # Wait 5 seconds for dashboard to load all widgets and data
        await page.wait_for_timeout(5000)

        # 2. Extract Angular routes and templates
        angular_info = await page.evaluate("""() => {
            const res = {
                routes: {},
                currentState: null,
                templates: []
            };
            try {
                const el = angular.element(document.body);
                const injector = el.injector();
                if (injector) {
                    if (injector.has('$route')) {
                        const $route = injector.get('$route');
                        const rMap = {};
                        for (let k in $route.routes) {
                            const r = $route.routes[k];
                            if (k === '' || k === '/' || k.includes('resumen') || k.includes('escritorio') || k.includes('novedades')) {
                                rMap[k] = {
                                    controller: r.controller || null,
                                    controllerAs: r.controllerAs || null,
                                    templateUrl: r.templateUrl || null,
                                    originalPath: r.originalPath || null
                                };
                            }
                        }
                        res.routes = rMap;
                        if ($route.current) {
                            res.currentRoute = {
                                controller: $route.current.controller || null,
                                controllerAs: $route.current.controllerAs || null,
                                templateUrl: $route.current.templateUrl || null,
                                params: $route.current.params || null
                            };
                        }
                    }
                    if (injector.has('$templateCache')) {
                        const $tc = injector.get('$templateCache');
                        // We can list keys in info() if available
                        if ($tc.info) {
                            res.templateCacheInfo = $tc.info();
                        }
                    }
                }
            } catch (e) {
                res.error = e.message;
            }
            return res;
        }""")
        report["angular_route_info"] = angular_info

        # Extract relevant HTML templates from $templateCache or DOM
        template_html = await page.evaluate("""() => {
            try {
                const el = angular.element(document.body);
                const injector = el.injector();
                if (injector && injector.has('$templateCache')) {
                    const $tc = injector.get('$templateCache');
                    const $route = injector.has('$route') ? injector.get('$route') : null;
                    let tUrl = $route && $route.current ? $route.current.templateUrl : null;
                    if (tUrl && $tc.get(tUrl)) {
                        return { url: tUrl, content: $tc.get(tUrl) };
                    }
                }
            } catch (e) {
                return { error: e.message };
            }
            return null;
        }""")
        if template_html:
            report["dashboard_template"] = template_html

        # 3. Inspect DOM elements: Cards, indicators, filters, tables, buttons
        dom_analysis = await page.evaluate("""() => {
            const data = {
                title: document.title,
                page_heading: "",
                breadcrumbs: [],
                filter_controls: [],
                widgets_and_cards: [],
                tables: [],
                charts: [],
                buttons: [],
                tabs: []
            };

            // Headings / breadcrumbs
            const headingEl = document.querySelector('.page-heading, h2, h1');
            if (headingEl) data.page_heading = headingEl.innerText.trim();

            document.querySelectorAll('.breadcrumb li').forEach(li => {
                data.breadcrumbs.push(li.innerText.trim());
            });

            // Filters / Selects / Datepickers
            document.querySelectorAll('input, select, .input-group, .daterange').forEach(el => {
                // Ignore hidden or logout or nav
                if (el.closest('nav') || el.closest('#side-menu')) return;
                const tag = el.tagName.toLowerCase();
                const name = el.name || el.id || el.getAttribute('ng-model') || '';
                const placeholder = el.placeholder || '';
                const type = el.type || '';
                let label = '';
                const parentLabel = el.closest('label') || el.closest('.form-group') ? el.closest('.form-group').querySelector('label') : null;
                if (parentLabel) label = parentLabel.innerText.trim();

                let options = [];
                if (tag === 'select') {
                    for (let i = 0; i < el.options.length; i++) {
                        options.push(el.options[i].text.trim());
                    }
                }

                if (name || label || placeholder || tag === 'select') {
                    data.filter_controls.push({
                        tag: tag,
                        type: type,
                        name: name,
                        label: label,
                        placeholder: placeholder,
                        options: options.slice(0, 10),
                        ngModel: el.getAttribute('ng-model')
                    });
                }
            });

            // Widgets / Cards (ibox, panel, card, widget)
            document.querySelectorAll('.ibox, .panel, .widget, .card, [class*="col-"]').forEach(box => {
                if (box.closest('nav') || box.closest('#side-menu')) return;
                const titleEl = box.querySelector('.ibox-title h5, .panel-heading, h3, h4, h5');
                const title = titleEl ? titleEl.innerText.trim() : "";
                
                // If it has a title or class widget / ibox
                if (box.classList.contains('ibox') || box.classList.contains('widget') || box.classList.contains('panel')) {
                    // Check tools/buttons inside
                    const tools = [];
                    box.querySelectorAll('.ibox-tools a, .panel-tools a, button').forEach(b => {
                        const bText = b.innerText.trim() || b.getAttribute('title') || b.className;
                        if (bText) tools.push(bText);
                    });

                    // Subheaders or labels inside
                    const labels = [];
                    box.querySelectorAll('label, th, small, span.label, .font-bold').forEach(lbl => {
                        const t = lbl.innerText.trim();
                        if (t && t.length < 50 && !labels.includes(t)) labels.push(t);
                    });

                    data.widgets_and_cards.push({
                        title: title,
                        className: box.className,
                        tools: tools,
                        sublabels: labels.slice(0, 15)
                    });
                }
            });

            // Tables
            document.querySelectorAll('table').forEach(tbl => {
                if (tbl.closest('nav') || tbl.closest('#side-menu')) return;
                const headers = [];
                tbl.querySelectorAll('th').forEach(th => headers.push(th.innerText.trim()));
                data.tables.push({
                    headers: headers,
                    rowCount: tbl.querySelectorAll('tbody tr').length
                });
            });

            // Charts
            document.querySelectorAll('[flot-chart], canvas, svg, .flot-chart, .chart, [highcharts], [chart-data]').forEach(ch => {
                data.charts.push({
                    tag: ch.tagName.toLowerCase(),
                    className: ch.className,
                    attributes: {
                        flot: ch.getAttribute('flot-chart') || ch.getAttribute('data-flot'),
                        chartData: ch.getAttribute('chart-data') || ch.getAttribute('data'),
                        ngAttr: ch.getAttribute('ng-model') || ch.getAttribute('ng-click')
                    }
                });
            });

            // Buttons
            document.querySelectorAll('button, a.btn').forEach(btn => {
                if (btn.closest('nav') || btn.closest('#side-menu')) return;
                const text = btn.innerText.trim();
                if (text) {
                    data.buttons.push({
                        text: text,
                        className: btn.className,
                        ngClick: btn.getAttribute('ng-click') || ""
                    });
                }
            });

            // Tabs
            document.querySelectorAll('.nav-tabs li, .nav-pills li').forEach(tab => {
                data.tabs.push(tab.innerText.trim());
            });

            return data;
        }""")
        report["dom_structure"] = dom_analysis
        report["network_get_endpoints"] = captured_requests

        # Let's also inspect all controllers and scopes in the main content container
        controller_info = await page.evaluate("""() => {
            const mainView = document.querySelector('[ng-view], #page-wrapper, .wrapper-content');
            if (!mainView) return null;
            const el = angular.element(mainView);
            const scope = el.scope();
            if (!scope) return null;

            const scopeKeys = [];
            for (let k in scope) {
                if (!k.startsWith('$') && typeof scope[k] !== 'function') {
                    scopeKeys.push({ key: k, type: typeof scope[k] });
                } else if (!k.startsWith('$') && typeof scope[k] === 'function') {
                    scopeKeys.push({ method: k, type: 'function' });
                }
            }

            // Also check vm if controllerAs is used
            let vmKeys = [];
            if (scope.vm) {
                for (let k in scope.vm) {
                    if (typeof scope.vm[k] !== 'function') {
                        vmKeys.push({ key: k, type: typeof scope.vm[k] });
                    } else {
                        vmKeys.push({ method: k, type: 'function' });
                    }
                }
            }

            return {
                scopeKeys: scopeKeys,
                vmKeys: vmKeys
            };
        }""")
        report["controller_scope_structure"] = controller_info

        # 4. Clean logout at the end
        print("Looking for logout link to safely exit...")
        try:
            logout_link = page.locator('text="Cerrar sesión"').first
            if await logout_link.count() > 0:
                print("Clicking 'Cerrar sesión'...")
                await logout_link.click(timeout=5000)
                await page.wait_for_timeout(2000)
            else:
                salir_link = page.locator('text="Salir"').first
                if await salir_link.count() > 0:
                    await salir_link.click(timeout=5000)
                    await page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Logout notice: {e}")

        await browser.close()

    # Save output to json in escritorio directory
    out_file = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/escritorio/escritorio_analysis.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"Analysis saved to {out_file}")

if __name__ == "__main__":
    asyncio.run(inspect())
