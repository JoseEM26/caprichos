import asyncio
import os
import json
from playwright.async_api import async_playwright

async def get_state_and_template():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD not set")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        print("Navigating to login...")
        await page.goto("https://caprichos.restaurant.pe/restaurant/#!/login", wait_until="domcontentloaded", timeout=60000)
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
        await page.wait_for_timeout(5000)

        res = await page.evaluate("""() => {
            const el = angular.element(document.body);
            const inj = el.injector();
            if (!inj) return { error: 'No injector' };

            const $state = inj.get('$state');
            const $tc = inj.get('$templateCache');

            const sEscritorio = $state.get('escritorio');
            const sResumen = $state.get('escritorio.resumen');

            // Find all templateCache keys matching resumen or escritorio or dashboard
            const matchingKeys = [];
            // In angular $templateCache info tells size, but we can check if keys are exposed or iterate
            // If $tc has keys or if we can inspect views
            
            return {
                sEscritorio: {
                    name: sEscritorio ? sEscritorio.name : null,
                    abstract: sEscritorio ? sEscritorio.abstract : null,
                    template: sEscritorio ? sEscritorio.template : null,
                    templateUrl: sEscritorio ? sEscritorio.templateUrl : null,
                    views: sEscritorio ? Object.keys(sEscritorio.views || {}) : null,
                    controller: sEscritorio ? sEscritorio.controller : null
                },
                sResumen: {
                    name: sResumen ? sResumen.name : null,
                    template: sResumen ? sResumen.template : null,
                    templateUrl: sResumen ? sResumen.templateUrl : null,
                    views: sResumen ? sResumen.views : null,
                    controller: sResumen ? sResumen.controller : null,
                    controllerAs: sResumen ? sResumen.controllerAs : null
                }
            };
        }""")

        print("State details:")
        print(json.dumps(res, indent=2))

        # Logout safely
        try:
            await page.evaluate("""() => {
                const sc = angular.element(document.body).scope();
                if (sc && sc.main && typeof sc.main.cerrarSesion === 'function') {
                    sc.main.cerrarSesion();
                }
            }""")
            await page.wait_for_timeout(2000)
        except Exception:
            pass

        await browser.close()

if __name__ == "__main__":
    asyncio.run(get_state_and_template())
