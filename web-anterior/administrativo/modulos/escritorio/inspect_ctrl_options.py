import asyncio
import os
import json
from playwright.async_api import async_playwright

async def inspect_ctrl_source():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

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

        await page.wait_for_timeout(5000)

        ctrl_info = await page.evaluate("""() => {
            const el = angular.element(document.body);
            const inj = el.injector();
            if (!inj) return null;

            // Find ResumenCtrl constructor
            let fnStr = "";
            try {
                const $controller = inj.get('$controller');
                // Instantiate or get annotated
                const sc = angular.element(document.querySelector('[ui-view]')).scope();
                if (sc && sc.vm) {
                    return {
                        vm_keys: Object.keys(sc.vm),
                        graficosPrincipalesDisponibles: sc.vm.graficosPrincipalesDisponibles,
                        tipoTicketPromedioList: sc.vm.tipoTicketPromedioList,
                        sucursalesCount: sc.vm.sucursalList ? sc.vm.sucursalList.length : 0,
                        cajasCount: sc.vm.cajaList ? sc.vm.cajaList.length : 0
                    };
                }
            } catch(e) {
                return { error: e.message };
            }
            return null;
        }""")

        with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/escritorio/ctrl_info.json", "w", encoding="utf-8") as f:
            json.dump(ctrl_info, f, indent=2)
        print("ctrl_info saved.")

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
    asyncio.run(inspect_ctrl_source())
