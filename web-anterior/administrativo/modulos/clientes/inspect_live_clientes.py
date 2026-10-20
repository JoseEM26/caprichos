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
        "login_status": None,
        "network_get_endpoints": [],
        "screens": {}
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

        # Wait 4s for dropdowns to stabilize
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
            data_collected["login_status"] = "FALLIDO"
            await browser.close()
            return

        data_collected["login_status"] = "EXITOSO"
        # Wait 3s after login
        await page.wait_for_timeout(3000)

        # ==============================================================
        # SCREEN 1: Clientes (#!/clientes)
        # ==============================================================
        print("6. Navigating to #!/clientes...")
        await page.goto("https://caprichos.restaurant.pe/restaurant/#!/clientes", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3500)

        screen_clientes = await page.evaluate("""() => {
            const res = {
                url: window.location.href,
                title: document.title,
                breadcrumbs: [],
                header_titles: [],
                tabs: [],
                buttons: [],
                filters: [],
                tables: []
            };

            // Breadcrumbs / Titles
            document.querySelectorAll('.breadcrumb li, h1, h2, h3, h4, .page-heading').forEach(el => {
                const txt = el.innerText.trim();
                if (txt && !res.breadcrumbs.includes(txt)) res.breadcrumbs.push(txt);
            });

            // Tabs
            document.querySelectorAll('.nav-tabs li, .nav-pills li').forEach(tab => {
                const txt = tab.innerText.trim();
                const active = tab.classList.contains('active');
                if (txt) res.tabs.push({ text: txt, active: active });
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

            // Filters & Inputs (inspect controls without reading private data)
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
                    Array.from(inp.options).slice(0, 20).forEach(o => options.push(o.text.trim()));
                }
                res.filters.push({
                    tag: inp.tagName.toLowerCase(),
                    type: inp.type || '',
                    name: inp.name || '',
                    id: inp.id || '',
                    ngModel: inp.getAttribute('ng-model') || '',
                    placeholder: inp.placeholder || '',
                    label: lbl,
                    options: options
                });
            });

            // Tables (headers and structure ONLY, no row content)
            document.querySelectorAll('table').forEach((tbl, idx) => {
                const headers = [];
                tbl.querySelectorAll('th').forEach(th => headers.push(th.innerText.trim()));
                const rowCount = tbl.querySelectorAll('tbody tr').length;
                res.tables.push({
                    tableIndex: idx,
                    headers: headers,
                    rowCount: rowCount
                });
            });

            return res;
        }""")
        data_collected["screens"]["clientes"] = screen_clientes
        print(f"Captured Clientes screen structure: {len(screen_clientes['buttons'])} buttons, {len(screen_clientes['tables'])} tables.")

        # Pause 2s between screens
        print("Pausing 2s...")
        await page.wait_for_timeout(2000)

        # ==============================================================
        # SCREEN 2: Debito (#!/clientes/debito)
        # ==============================================================
        print("7. Navigating to #!/clientes/debito...")
        await page.goto("https://caprichos.restaurant.pe/restaurant/#!/clientes/debito", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3500)

        screen_debito = await page.evaluate("""() => {
            const res = {
                url: window.location.href,
                title: document.title,
                breadcrumbs: [],
                header_titles: [],
                tabs: [],
                buttons: [],
                filters: [],
                tables: [],
                summary_cards: []
            };

            // Breadcrumbs / Titles
            document.querySelectorAll('.breadcrumb li, h1, h2, h3, h4, .page-heading').forEach(el => {
                const txt = el.innerText.trim();
                if (txt && !res.breadcrumbs.includes(txt)) res.breadcrumbs.push(txt);
            });

            // Tabs
            document.querySelectorAll('.nav-tabs li, .nav-pills li').forEach(tab => {
                const txt = tab.innerText.trim();
                const active = tab.classList.contains('active');
                if (txt) res.tabs.push({ text: txt, active: active });
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

            // Filters & Inputs
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
                    Array.from(inp.options).slice(0, 20).forEach(o => options.push(o.text.trim()));
                }
                res.filters.push({
                    tag: inp.tagName.toLowerCase(),
                    type: inp.type || '',
                    name: inp.name || '',
                    id: inp.id || '',
                    ngModel: inp.getAttribute('ng-model') || '',
                    placeholder: inp.placeholder || '',
                    label: lbl,
                    options: options
                });
            });

            // Tables (headers and column structure only)
            document.querySelectorAll('table').forEach((tbl, idx) => {
                const headers = [];
                tbl.querySelectorAll('th').forEach(th => headers.push(th.innerText.trim()));
                const rowCount = tbl.querySelectorAll('tbody tr').length;
                res.tables.push({
                    tableIndex: idx,
                    headers: headers,
                    rowCount: rowCount
                });
            });

            // Summary cards or widget labels (e.g. Total saldo, Total debito, etc.)
            document.querySelectorAll('.ibox-title, .widget, .panel-heading').forEach(el => {
                const txt = el.innerText.trim();
                if (txt) res.summary_cards.push(txt);
            });

            return res;
        }""")
        data_collected["screens"]["debito"] = screen_debito
        print(f"Captured Debito screen structure: {len(screen_debito['buttons'])} buttons, {len(screen_debito['tables'])} tables.")

        # Pause 2s
        await page.wait_for_timeout(2000)

        # ==============================================================
        # Safe Logout
        # ==============================================================
        print("8. Logging out safely...")
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
            print(f"Logout clicked: {logout_found}")
            await page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Logout note: {e}")

        await browser.close()

    out_file = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/clientes/clientes_live_inspection.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(data_collected, f, indent=2, ensure_ascii=False)
    print(f"Inspection completed successfully and saved to {out_file}")

if __name__ == "__main__":
    asyncio.run(inspect())
