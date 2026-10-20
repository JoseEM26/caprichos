import asyncio
import os
import json
from playwright.async_api import async_playwright

async def inspect_template_cache():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

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

        print(f"Logueado en: {page.url}")
        await page.wait_for_timeout(2000)

        # Check $templateCache
        templates_extracted = await page.evaluate("""() => {
            const el = document.querySelector('[ng-app]') || document.body;
            const injector = angular.element(el).injector();
            const $templateCache = injector.get('$templateCache');
            const $state = injector.get('$state');
            
            const states = $state.get();
            const results = {};

            states.forEach(s => {
                const sName = s.name || '';
                const urlsToCheck = [];
                if (s.templateUrl) urlsToCheck.push(s.templateUrl);
                if (s.views) {
                    Object.keys(s.views).forEach(vk => {
                        if (s.views[vk].templateUrl) urlsToCheck.push(s.views[vk].templateUrl);
                    });
                }
                
                urlsToCheck.forEach(tUrl => {
                    const cached = $templateCache.get(tUrl);
                    if (cached) {
                        results[tUrl] = cached;
                    }
                });
            });

            return {
                total_in_cache: Object.keys(results).length,
                templates: results
            };
        }""")

        print(f"Plantillas encontradas en $templateCache: {templates_extracted.get('total_in_cache')}")
        
        with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/compras/cached_templates.json", "w", encoding="utf-8") as f:
            json.dump(templates_extracted, f, indent=2, ensure_ascii=False)
        print("Guardado en cached_templates.json")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_template_cache())
