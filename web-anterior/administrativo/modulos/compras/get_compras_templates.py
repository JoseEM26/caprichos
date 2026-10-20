import asyncio
import os
import json
from playwright.async_api import async_playwright

target_keys = [
    'scripts/restaurantpe/compras/proveedor/proveedor-lista.html',
    'scripts/restaurantpe/compras/proveedor/proveedor-editar.html',
    'scripts/restaurantpe/compras/proveedor/proveedor-ver.html',
    'scripts/restaurantpe/compras/proveedor/proveedor-placeholder.html',
    'scripts/restaurantpe/compras/lotecompra/lotecompra-lista.html',
    'scripts/restaurantpe/compras/lotecompra/lotecompra-editar.html',
    'scripts/restaurantpe/compras/lotecompra/lotecompra-form.html',
    'scripts/restaurantpe/compras/lotecompra/lotecompra-pagar.html',
    'scripts/restaurantpe/compras/lotecompra/lotecompra-ver.html',
    'scripts/restaurantpe/compras/ajustes/ajustesselector.html',
    'scripts/restaurantpe/creditos/banco/index.html',
    'scripts/restaurantpe/creditos/banco/editar.html',
    'scripts/restaurantpe/creditos/cuentabancaria/index.html',
    'scripts/restaurantpe/creditos/cuentabancaria/editar.html',
    'scripts/restaurantpe/compras/comprobantecompra/index.html',
    'scripts/restaurantpe/compras/comprobantecompra/editar.html',
    'scripts/restaurantpe/compras/percepcion/index.html',
    'scripts/restaurantpe/compras/percepcion/editar.html',
    'scripts/restaurantpe/ajustes/transportistas/index.html',
    'scripts/restaurantpe/ajustes/transportistas/editar.html',
    'scripts/restaurantpe/compras/serviciocompra/index.html',
    'scripts/restaurantpe/compras/serviciocompra/editar.html',
    'scripts/restaurantpe/compras/categoriaserviciocompra/index.html',
    'scripts/restaurantpe/compras/categoriaserviciocompra/editar.html',
    'scripts/restaurantpe/compras/impuestoscompra/index.html',
    'scripts/restaurantpe/compras/impuestoscompra/editar.html',
    'scripts/restaurantpe/compras/compra/compra-lista.html',
    'scripts/restaurantpe/compras/compra/compra-editar.html',
    'scripts/restaurantpe/compras/compra/compra-form.html',
    'scripts/restaurantpe/compras/compra/compra-ver.html',
    'scripts/restaurantpe/compras/ordencompra/ordencompra-lista.html',
    'scripts/restaurantpe/compras/ordencompra/ordencompra-editar.html',
    'scripts/restaurantpe/compras/ordencompra/ordencompra-form.html',
    'scripts/restaurantpe/compras/guia/guia-lista.html',
    'scripts/restaurantpe/compras/guia/guia-nuevo.html',
    'scripts/restaurantpe/compras/guia/guia-form.html',
    'scripts/restaurantpe/compras/notasdecredito/notasdecredito-lista.html',
    'scripts/restaurantpe/compras/notasdecredito/modal-detalle.html',
    'scripts/restaurantpe/compras/modals/proveedor-modal.html',
    'scripts/restaurantpe/compras/modals/ordencompra-modal.html',
    'scripts/restaurantpe/compras/modals/cuoataspago-modal.html',
    'scripts/restaurantpe/compras/modals/notacredito.view.html',
    'scripts/restaurantpe/creditos/compracredito/compracredito-lista.html',
    'scripts/restaurantpe/creditos/compracredito/compracredito-registrar.html',
    'scripts/restaurantpe/creditos/compracredito/compracredito-editar.html',
    'scripts/restaurantpe/creditos/modals/detallecompra-modal.html'
]

async def extract_exact_templates():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        print("Login...")
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

        print(f"Logged in: {page.url}")
        await page.wait_for_timeout(2000)

        results = await page.evaluate("""(keys) => {
            const el = document.querySelector('[ng-app]') || document.body;
            const injector = angular.element(el).injector();
            const $templateCache = injector.get('$templateCache');
            const data = {};
            keys.forEach(k => {
                data[k] = $templateCache.get(k) || null;
            });
            return data;
        }""", target_keys)

        with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/compras/compras_exact_templates.json", "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print("Guardado en compras_exact_templates.json")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(extract_exact_templates())
