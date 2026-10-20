import asyncio
import os
import json
import re
from playwright.async_api import async_playwright

def sanitize_data_schema(obj, depth=0):
    if depth > 5:
        return "..."
    if isinstance(obj, dict):
        return {k: sanitize_data_schema(v, depth + 1) for k, v in obj.items()}
    elif isinstance(obj, list):
        if len(obj) == 0:
            return []
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

async def run_inspection():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD not set")
        return

    details = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1600, "height": 1000})
        page = await context.new_page()

        all_requests = []

        async def on_response(resp):
            url = resp.url
            method = resp.request.method
            status = resp.status
            content_type = resp.headers.get("content-type", "")
            if any(k in url for k in ["/rest/", "/api/", "/m/"]):
                req_entry = {
                    "method": method,
                    "url": url,
                    "status": status,
                    "content_type": content_type
                }
                # If POST, check postData
                if method == "POST":
                    post_data = resp.request.post_data
                    if post_data:
                        try:
                            req_entry["post_data_schema"] = sanitize_data_schema(json.loads(post_data))
                        except Exception:
                            req_entry["post_data_raw"] = "non_json_payload"
                if "application/json" in content_type:
                    try:
                        resp_data = await resp.json()
                        req_entry["response_schema"] = sanitize_data_schema(resp_data)
                    except Exception:
                        req_entry["response_schema"] = "could_not_parse_json"
                all_requests.append(req_entry)

        page.on("response", on_response)

        # 1. Login
        target_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print("Navigating to login...")
        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(4000)

        await page.locator('input[name="usuario_nick"]').fill(user)
        await page.wait_for_timeout(500)
        await page.locator('input[name="usuario_clave"]').fill(password)
        await page.wait_for_timeout(500)

        await page.locator('button[type="submit"]').click()

        for _ in range(30):
            await page.wait_for_timeout(500)
            if "#!/login" not in page.url:
                break

        print(f"Logged in: {page.url}")
        # Wait 6 seconds for all requests to finish
        await page.wait_for_timeout(6000)

        # 2. Extract UI-Router states and templateCache
        angular_data = await page.evaluate("""() => {
            const out = {
                ui_router_states: [],
                current_state: null,
                templates_related: {},
                controller_methods: {},
                filter_values: {}
            };

            const el = angular.element(document.body);
            const injector = el.injector();
            if (!injector) return { error: 'No injector' };

            // UI-Router ($state)
            if (injector.has('$state')) {
                const $state = injector.get('$state');
                out.current_state = {
                    name: $state.current.name,
                    url: $state.current.url,
                    templateUrl: $state.current.templateUrl,
                    controller: $state.current.controller,
                    controllerAs: $state.current.controllerAs
                };
                const states = $state.get();
                states.forEach(s => {
                    if (!s.abstract && (s.name.includes('resumen') || s.name.includes('escritorio') || s.name.includes('dash') || s.url === '' || s.url === '/')) {
                        out.ui_router_states.push({
                            name: s.name,
                            url: s.url,
                            templateUrl: s.templateUrl,
                            controller: s.controller,
                            controllerAs: s.controllerAs
                        });
                    }
                });
            }

            // $templateCache
            if (injector.has('$templateCache')) {
                const $tc = injector.get('$templateCache');
                // Check if current state templateUrl is in cache
                if (out.current_state && out.current_state.templateUrl) {
                    out.templates_related[out.current_state.templateUrl] = $tc.get(out.current_state.templateUrl);
                }
            }

            // Inspect the controller of the view
            const viewEl = document.querySelector('[ui-view], ng-view, #page-wrapper .wrapper-content');
            if (viewEl) {
                const sc = angular.element(viewEl).scope();
                if (sc) {
                    const methods = [];
                    const keys = [];
                    for (let k in sc) {
                        if (!k.startsWith('$')) {
                            if (typeof sc[k] === 'function') {
                                methods.push(k);
                            } else {
                                keys.push(k);
                            }
                        }
                    }
                    out.view_scope = { methods: methods, keys: keys };

                    // If vm or controllerAs is used
                    const ctrl = sc.vm || sc.escritorio || sc.resumen || sc;
                    if (ctrl && ctrl !== sc) {
                        const vmMethods = [];
                        const vmKeys = [];
                        for (let k in ctrl) {
                            if (typeof ctrl[k] === 'function') vmMethods.push(k);
                            else vmKeys.push(k);
                        }
                        out.vm_details = { methods: vmMethods, keys: vmKeys };
                    }
                }
            }

            // Also check angular scripts / services
            return out;
        }""")
        details["angular"] = angular_data
        details["requests"] = all_requests

        # 3. Inspect the raw HTML structure of the dashboard template
        # Let's clean up any actual numbers in the HTML to avoid storing production data
        content_html = await page.evaluate("""() => {
            const viewEl = document.querySelector('[ui-view], #page-wrapper .wrapper-content');
            if (!viewEl) return '';
            // Clone and sanitize text nodes
            const clone = viewEl.cloneNode(true);
            const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null, false);
            let n;
            while (n = walker.nextNode()) {
                const val = n.nodeValue.trim();
                // If it looks like a number or monetary value, sanitize
                if (val && (/[0-9]/.test(val) || val.startsWith('S/'))) {
                    n.nodeValue = '[NUMERIC_VALUE]';
                }
            }
            return clone.innerHTML;
        }""")
        # We can analyze the structure from content_html
        details["content_html_snippet"] = content_html[:4000] # First 4000 chars

        # 4. Extract card definitions, charts, and table headers specifically
        dom_detail = await page.evaluate("""() => {
            const result = {
                kpis: [],
                charts_info: [],
                tables_info: []
            };

            // All ibox elements
            document.querySelectorAll('.ibox').forEach(ibox => {
                const title = ibox.querySelector('.ibox-title h5') ? ibox.querySelector('.ibox-title h5').innerText.trim() : 'Sin título';
                const subTitle = ibox.querySelector('.ibox-title small') ? ibox.querySelector('.ibox-title small').innerText.trim() : '';
                const labels = [];
                ibox.querySelectorAll('label, .font-bold, h1, h2, h3, h4, th').forEach(el => {
                    const txt = el.innerText.trim();
                    if (txt && !/[0-9]/.test(txt)) labels.push(txt);
                });

                // Find chart type if any
                const chartEl = ibox.querySelector('[flot-chart], canvas, svg, .flot-chart, [chart-data]');
                let chartType = null;
                if (chartEl) {
                    chartType = chartEl.tagName.toLowerCase();
                    if (chartEl.getAttribute('flot-chart')) chartType = 'flot:' + chartEl.getAttribute('flot-chart');
                }

                // Find tables
                const tbl = ibox.querySelector('table');
                let tableCols = [];
                if (tbl) {
                    tbl.querySelectorAll('th').forEach(th => tableCols.push(th.innerText.trim()));
                }

                result.kpis.push({
                    title: title,
                    subTitle: subTitle,
                    labels: labels,
                    has_chart: !!chartEl,
                    chart_type: chartType,
                    table_headers: tableCols
                });
            });

            return result;
        }""")
        details["dom_kpis"] = dom_detail

        # 5. Clean logout
        print("Logging out safely...")
        try:
            await page.evaluate("""() => {
                const sc = angular.element(document.body).scope();
                if (sc && sc.main && typeof sc.main.cerrarSesion === 'function') {
                    sc.main.cerrarSesion();
                } else {
                    const btn = document.querySelector('[ng-click*="cerrarSesion"]');
                    if (btn) btn.click();
                }
            }""")
            await page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Logout note: {e}")

        await browser.close()

    out_file = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/escritorio/dashboard_details.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(details, f, indent=2, ensure_ascii=False)
    print(f"Details saved to {out_file}")

if __name__ == "__main__":
    asyncio.run(run_inspection())
