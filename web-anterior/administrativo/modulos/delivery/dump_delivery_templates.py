import asyncio
import os
import json
import re
from playwright.async_api import async_playwright

async def dump_templates():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD not set")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        # Login
        await page.goto("https://caprichos.restaurant.pe/restaurant/#!/login", wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)
        await page.fill('input[name="usuario_nick"]', user)
        await page.wait_for_timeout(500)
        await page.fill('input[name="usuario_clave"]', password)
        await page.wait_for_timeout(500)
        await page.click('button[type="submit"]')

        for _ in range(25):
            await page.wait_for_timeout(500)
            if "#!/login" not in page.url:
                break
        await page.wait_for_timeout(3000)

        # Inspect $templateCache
        templates = await page.evaluate("""() => {
            const result = {};
            try {
                const el = document.querySelector('[ng-app]') || document.body;
                const inj = window.angular.element(el).injector();
                if (inj && inj.has('$templateCache')) {
                    const tc = inj.get('$templateCache');
                    // Get all keys if possible or test common keys
                    // In angular $templateCache is a cache object with get/put/info
                    // If created with $cacheFactory, tc.info() gives id, size
                    // Keys can be retrieved if we inspect internal data
                }
            } catch (e) {
                result.error = e.message;
            }
            return result;
        }""")

        # Also let's extract state definitions with their templateUrls and resolve functions
        all_states = await page.evaluate("""() => {
            try {
                const el = document.querySelector('[ng-app]') || document.body;
                const inj = window.angular.element(el).injector();
                const $state = inj.get('$state');
                const tc = inj.get('$templateCache');
                
                const list = [];
                $state.get().forEach(s => {
                    if (s.name && (s.name.includes('delivery') || s.name.includes('callcenter') || s.name.includes('motorizado') || s.name.includes('zonareparto') || s.name.includes('reclamo') || s.name.includes('cobertura') || s.name.includes('frecuencia'))) {
                        let tpl = s.template || '';
                        if (s.templateUrl && tc.get(s.templateUrl)) {
                            tpl = tc.get(s.templateUrl);
                        }
                        list.push({
                            name: s.name,
                            url: s.url,
                            templateUrl: s.templateUrl,
                            controller: s.controller,
                            templateContent: tpl ? tpl.slice(0, 3000) : ''
                        });
                    }
                });
                return list;
            } catch(e) {
                return [{ error: e.message }];
            }
        }""")

        with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/angular_templates.json", "w", encoding="utf-8") as f:
            json.dump(all_states, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(all_states)} states and templates to angular_templates.json")

        # Log out safely
        try:
            await page.click('text="Cerrar sesión"', timeout=3000)
            await page.wait_for_timeout(1500)
        except Exception:
            pass
        await browser.close()

if __name__ == "__main__":
    asyncio.run(dump_templates())
