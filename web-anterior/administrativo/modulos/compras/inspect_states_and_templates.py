import asyncio
import os
import json
import re
from playwright.async_api import async_playwright

async def inspect():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD not set")
        return

    output = {
        "all_states": [],
        "compras_states": [],
        "templates": {},
        "html_analysis": {}
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        # Login
        print("Iniciando login...")
        await page.goto("https://caprichos.restaurant.pe/restaurant/#!/login", wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)
        await page.fill('input[name="usuario_nick"]', user)
        await page.wait_for_timeout(500)
        await page.fill('input[name="usuario_clave"]', password)
        await page.wait_for_timeout(500)
        await page.click('button[type="submit"]')

        for _ in range(30):
            await page.wait_for_timeout(500)
            if "#!/login" not in page.url:
                break

        print(f"Sesion iniciada en: {page.url}")
        await page.wait_for_timeout(2000)

        # Extract UI-Router $state list
        states_data = await page.evaluate("""() => {
            try {
                const el = document.querySelector('[ng-app]') || document.body;
                const injector = angular.element(el).injector();
                if (!injector) return { error: 'No injector' };
                const $state = injector.get('$state');
                const states = $state.get();
                return states.map(s => ({
                    name: s.name,
                    url: s.url,
                    templateUrl: s.templateUrl,
                    controller: s.controller,
                    controllerAs: s.controllerAs,
                    views: s.views ? Object.keys(s.views).map(k => ({
                        viewName: k,
                        templateUrl: s.views[k].templateUrl,
                        controller: s.views[k].controller
                    })) : null
                }));
            } catch(e) {
                return { error: e.toString() };
            }
        }""")

        if isinstance(states_data, list):
            output["all_states"] = states_data
            # Filter compras and relevant warehouse / purchase states
            for s in states_data:
                s_name = s.get("name", "").lower()
                s_url = (s.get("url") or "").lower()
                if any(k in s_name or k in s_url for k in [
                    "compra", "proveed", "lote", "banco", "recepcion", "requerimiento", "almacen"
                ]):
                    output["compras_states"].append(s)

        print(f"Total states: {len(output['all_states'])}, Compras/related states: {len(output['compras_states'])}")

        # Collect unique templateUrls
        template_urls = set()
        for s in output["compras_states"]:
            if s.get("templateUrl"):
                template_urls.add(s["templateUrl"])
            if s.get("views"):
                for v in s["views"]:
                    if v.get("templateUrl"):
                        template_urls.add(v["templateUrl"])

        print(f"Plantillas unicas encontradas: {len(template_urls)}")
        for turl in sorted(list(template_urls)):
            print(f"Fetching template: {turl}")
            try:
                content = await page.evaluate("""async (url) => {
                    const resp = await fetch(url);
                    return resp.ok ? await resp.text() : 'HTTP_' + resp.status;
                }""", turl)
                output["templates"][turl] = content
            except Exception as e:
                output["templates"][turl] = f"ERROR: {str(e)}"
            await page.wait_for_timeout(300)

        # Safely logout
        try:
            # Let's find logout button
            logout_btn = await page.query_selector('a[ng-click*="cerrarSesion"]')
            if logout_btn:
                await logout_btn.click()
                await page.wait_for_timeout(2000)
        except Exception:
            pass

        await browser.close()

    out_file = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/compras/states_and_templates.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Guardado en {out_file}")

if __name__ == "__main__":
    asyncio.run(inspect())
