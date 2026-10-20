import asyncio
import os
import json
from playwright.async_api import async_playwright

async def get_details():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD not set")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

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

        print("Logged in successfully. Inspecting ui-router states and templates...")

        details = await page.evaluate("""async () => {
            const el = document.querySelector('[ng-app]') || document.body;
            const injector = angular.element(el).injector();
            if (!injector) return { error: "no injector" };

            const $state = injector.get('$state');
            const $templateCache = injector.get('$templateCache');
            const $http = injector.get('$http');

            const allStates = $state.get();
            const relevantStates = allStates.filter(s => {
                const n = s.name || '';
                const u = s.url || '';
                return n.includes('mirestaurante') || n.includes('facturacion') || 
                       n.includes('contingencia') || n.includes('seriemanualfe') ||
                       n.includes('integracion') || n.includes('pos');
            });

            const statesData = [];
            const templatesData = {};

            for (const s of relevantStates) {
                // Find templateUrl
                let templateUrl = s.templateUrl;
                if (!templateUrl && s.views) {
                    for (let v in s.views) {
                        if (s.views[v] && s.views[v].templateUrl) {
                            templateUrl = s.views[v].templateUrl;
                            break;
                        }
                    }
                }

                statesData.push({
                    name: s.name,
                    url: s.url,
                    templateUrl: templateUrl,
                    controller: s.controller || (s.views && s.views['@'] ? s.views['@'].controller : null),
                    controllerAs: s.controllerAs || (s.views && s.views['@'] ? s.views['@'].controllerAs : null),
                    params: s.params,
                    data: s.data
                });

                if (templateUrl) {
                    let cached = $templateCache.get(templateUrl);
                    if (!cached) {
                        try {
                            const res = await $http.get(templateUrl);
                            cached = res.data;
                            $templateCache.put(templateUrl, cached);
                        } catch(e) {
                            cached = "Error loading: " + e.message;
                        }
                    }
                    templatesData[templateUrl] = cached;
                }
            }

            return {
                states: statesData,
                templates: templatesData
            };
        }""")

        with open("detailed_states_templates.json", "w", encoding="utf-8") as f:
            json.dump(details, f, indent=2, ensure_ascii=False)
        print("Guardado en detailed_states_templates.json")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(get_details())
