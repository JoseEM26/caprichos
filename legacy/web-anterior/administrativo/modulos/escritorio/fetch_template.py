import asyncio
import os
import json
from playwright.async_api import async_playwright

async def get_template_and_controller():
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

        data = await page.evaluate("""() => {
            const el = angular.element(document.body);
            const inj = el.injector();
            if (!inj) return { error: 'No injector' };

            const $tc = inj.get('$templateCache');
            const templateHtml = $tc.get('scripts/restaurantpe/escritorio/resumen/resumen.view.html');

            // Find scope of vm
            const viewEl = document.querySelector('[ui-view]');
            let vmProperties = [];
            let vmFunctions = [];
            if (viewEl) {
                const sc = angular.element(viewEl).scope();
                if (sc && sc.vm) {
                    for (let k in sc.vm) {
                        if (typeof sc.vm[k] === 'function') {
                            vmFunctions.push(k);
                        } else {
                            vmProperties.push(k);
                        }
                    }
                }
            }

            return {
                template: templateHtml,
                vmProperties: vmProperties,
                vmFunctions: vmFunctions
            };
        }""")

        # Save template
        if data.get("template"):
            t_path = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/escritorio/resumen.view.html"
            with open(t_path, "w", encoding="utf-8") as f:
                f.write(data["template"])
            print(f"Template saved to {t_path} ({len(data['template'])} chars)")
        else:
            print("Template NOT found in $templateCache")

        print("vm Properties:", data.get("vmProperties"))
        print("vm Functions:", data.get("vmFunctions"))

        with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/escritorio/vm_summary.json", "w", encoding="utf-8") as f:
            json.dump({
                "vmProperties": data.get("vmProperties"),
                "vmFunctions": data.get("vmFunctions")
            }, f, indent=2)

        # Logout cleanly
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
    asyncio.run(get_template_and_controller())
