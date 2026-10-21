import asyncio
import os
import json
import re
from playwright.async_api import async_playwright

ADMIN_ROUTES = [
    {"name": "Call center", "route": "#!/ventas/callcenter"},
    {"name": "Zona de reparto", "route": "#!/ajustes/zonareparto"},
    {"name": "Ajustes de delivery", "route": "#!/delivery/ajustes/motorizado"},
    {"name": "Resumen", "route": "#!/resumen/delivery"},
    {"name": "Zona de reparto (cobertura)", "route": "#!/informes/ventas/deliverys-cobertura"},
    {"name": "Zona de reparto (Mapa de calor)", "route": "#!/informes/ventas/deliverys-cobertura/mapa"},
    {"name": "Reclamos", "route": "#!/ventas/callcenter/reclamo"},
    {"name": "Frecuencia", "route": "#!/informes/ventas/deliverys-frecuencia"},
    {"name": "Tu restaurant en facebook", "route": "#!/delivery"}
]

async def explore_admin():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD env variable not set.")
        return

    output = {
        "login_status": None,
        "screens": {},
        "network_endpoints": []
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        # Capture network GET endpoints structure without real data
        async def on_response(resp):
            u = resp.url
            if any(term in u.lower() for term in ["/rest/", "/m/rest/", "/api/"]):
                if not any(ext in u.lower() for ext in [".png", ".jpg", ".jpeg", ".svg", ".woff", ".css", ".ico", ".js"]):
                    try:
                        ct = resp.headers.get("content-type", "")
                        summary_keys = None
                        if "json" in ct:
                            body = await resp.json()
                            if isinstance(body, dict):
                                summary_keys = list(body.keys())
                            elif isinstance(body, list):
                                summary_keys = {
                                    "is_list": True,
                                    "count": len(body),
                                    "item_keys": list(body[0].keys()) if len(body) > 0 and isinstance(body[0], dict) else "primitive"
                                }
                        output["network_endpoints"].append({
                            "url": u,
                            "method": resp.request.method,
                            "status": resp.status,
                            "keys": summary_keys
                        })
                    except Exception:
                        pass

        page.on("response", on_response)

        # 1. Login step
        login_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"Opening login page: {login_url}...")
        await page.goto(login_url, wait_until="domcontentloaded", timeout=45000)
        
        # Mandatory 4 seconds wait for dropdowns to preload
        print("Waiting 4.0 seconds for AngularJS models to stabilize...")
        await page.wait_for_timeout(4000)

        # Fill ONLY user and password
        user_input = page.locator('input[name="usuario_nick"]')
        pass_input = page.locator('input[name="usuario_clave"]')
        await user_input.fill(user)
        await page.wait_for_timeout(500)
        await pass_input.fill(password)
        await page.wait_for_timeout(500)

        # Click submit button ONCE
        login_btn = page.locator('button[type="submit"]')
        print("Clicking submit button once...")
        await login_btn.click()

        # Wait up to 15s for URL change
        print("Waiting up to 15s for login transition...")
        logged_in = False
        for _ in range(30):
            await page.wait_for_timeout(500)
            if "#!/login" not in page.url:
                logged_in = True
                break

        if not logged_in:
            print("Login failed or URL did not change.")
            output["login_status"] = "FALLIDO"
            output["current_url"] = page.url
            await browser.close()
            with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/admin_delivery_data.json", "w", encoding="utf-8") as f:
                json.dump(output, f, indent=2, ensure_ascii=False)
            return

        output["login_status"] = "EXITOSO"
        print(f"Logged in successfully! Landed on: {page.url}")
        await page.wait_for_timeout(3000)

        # Extract Angular UI-Router states related to delivery
        states_info = await page.evaluate("""() => {
            try {
                const el = document.querySelector('[ng-app]') || document.body;
                const inj = window.angular.element(el).injector();
                if (inj && inj.has('$state')) {
                    const $state = inj.get('$state');
                    return $state.get()
                        .filter(s => s.name && (s.name.includes('delivery') || s.name.includes('callcenter') || s.name.includes('zonareparto') || s.name.includes('cobertura') || s.name.includes('motorizado') || s.name.includes('reclamo')))
                        .map(s => ({
                            name: s.name,
                            url: s.url,
                            templateUrl: s.templateUrl,
                            controller: s.controller
                        }));
                }
            } catch(e) {
                return { error: e.message };
            }
            return [];
        }""")
        output["angular_delivery_states"] = states_info

        # 2. Iterate through each delivery admin route
        for item in ADMIN_ROUTES:
            name = item["name"]
            route = item["route"]
            target = f"https://caprichos.restaurant.pe/restaurant/{route}"
            print(f"\nVisiting [{name}] -> {target}...")

            await page.goto(target, wait_until="domcontentloaded", timeout=30000)
            # Pause 2.5s between screens
            await page.wait_for_timeout(2500)

            # Analyze screen DOM structure
            screen_info = await page.evaluate("""() => {
                // Breadcrumbs & Title
                const titleEl = document.querySelector('h2, .page-heading h2, .wrapper-content h2, .ibox-title h5');
                const title = titleEl ? titleEl.innerText.trim() : '';
                const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb li, .page-heading ol li')).map(b => b.innerText.trim()).filter(Boolean);

                // Table headers / columns
                const tables = [];
                document.querySelectorAll('table').forEach(tbl => {
                    const headers = Array.from(tbl.querySelectorAll('th')).map(th => th.innerText.trim()).filter(Boolean);
                    if (headers.length > 0) {
                        tables.push({
                            id: tbl.id || '',
                            className: tbl.className || '',
                            columns: headers
                        });
                    }
                });

                // Filters & Controls
                const filters = [];
                document.querySelectorAll('input, select, textarea').forEach(el => {
                    if (el.type === 'hidden') return;
                    const parent = el.closest('.form-group, .input-group, label, td, div');
                    const label = parent ? (parent.querySelector('label') ? parent.querySelector('label').innerText.trim() : '') : '';
                    filters.push({
                        tag: el.tagName.toLowerCase(),
                        type: el.type || '',
                        name: el.name || el.id || el.getAttribute('ng-model') || '',
                        placeholder: el.placeholder || '',
                        label: label.slice(0, 60),
                        disabled: el.disabled
                    });
                });

                // Buttons / Actions
                const buttons = [];
                document.querySelectorAll('button, a.btn, .btn').forEach(btn => {
                    const text = btn.innerText.trim();
                    const title = btn.getAttribute('title') || '';
                    const icon = btn.querySelector('i, fa-icon') ? btn.querySelector('i, fa-icon').className : '';
                    const actionName = text || title || icon;
                    if (actionName && !buttons.some(b => b.action === actionName)) {
                        buttons.push({
                            action: actionName,
                            classes: btn.className,
                            disabled: btn.disabled || btn.classList.contains('disabled')
                        });
                    }
                });

                // Visible tabs / state filters (e.g. Nav tabs)
                const tabs = Array.from(document.querySelectorAll('.nav-tabs li, .btn-group label, .nav-pills li')).map(t => t.innerText.trim()).filter(Boolean);

                // Alerts or badges
                const alerts = Array.from(document.querySelectorAll('.alert, .badge, .label')).map(a => a.innerText.trim()).filter(Boolean);

                // Visible text snippet
                const bodyText = (document.querySelector('.wrapper-content') || document.body).innerText;

                return {
                    url: window.location.href,
                    title,
                    breadcrumbs,
                    tables,
                    filters: filters.slice(0, 30),
                    buttons: buttons.slice(0, 30),
                    tabs,
                    alerts: alerts.slice(0, 15),
                    text_snippet: bodyText.slice(0, 2000)
                };
            }""")

            output["screens"][name] = screen_info
            print(f"Screen [{name}] inspected. Title: '{screen_info.get('title')}', Tables: {len(screen_info.get('tables', []))}, Filters: {len(screen_info.get('filters', []))}, Buttons: {len(screen_info.get('buttons', []))}")

        # 3. Log out safely at the end
        print("\nLogging out safely...")
        try:
            # Locate Cerrar sesión
            logout_btn = page.locator('text="Cerrar sesión", text="Salir"').first
            if await logout_btn.count() > 0:
                await logout_btn.click()
                await page.wait_for_timeout(2000)
                print("Logout completed.")
        except Exception as e:
            print(f"Note during logout: {e}")

        await browser.close()

    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/admin_delivery_data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print("Saved all admin delivery data to admin_delivery_data.json!")

if __name__ == "__main__":
    asyncio.run(explore_admin())
