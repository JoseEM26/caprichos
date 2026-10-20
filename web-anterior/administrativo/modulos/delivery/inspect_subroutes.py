import asyncio
import os
import json
from playwright.async_api import async_playwright

SUB_ROUTES = [
    {"name": "Canales de delivery", "url": "https://caprichos.restaurant.pe/restaurant/#!/delivery/ajustes/canaldelivery"},
    {"name": "Movilidad", "url": "https://caprichos.restaurant.pe/restaurant/#!/delivery/ajustes/movilidad"},
    {"name": "Tipo de reclamo", "url": "https://caprichos.restaurant.pe/restaurant/#!/delivery/ajustes/tiporeclamo"},
    {"name": "Motivos cancelacion", "url": "https://caprichos.restaurant.pe/restaurant/#!/delivery/ajustes/tipoproblemadelivery"},
    {"name": "Zona sucursal", "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/zonareparto/sucursal/1"}
]

async def inspect_subroutes():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        return

    res = {}
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

        for sr in SUB_ROUTES:
            name = sr["name"]
            url = sr["url"]
            print(f"Checking {name} -> {url}...")
            await page.goto(url, wait_until="domcontentloaded")
            await page.wait_for_timeout(2500)

            data = await page.evaluate("""() => {
                const tables = [];
                document.querySelectorAll('table').forEach(t => {
                    const cols = Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim()).filter(Boolean);
                    if (cols.length > 0) tables.push(cols);
                });
                const buttons = Array.from(document.querySelectorAll('button, a.btn')).map(b => b.innerText.trim()).filter(Boolean);
                const inputs = Array.from(document.querySelectorAll('input, select')).map(i => ({
                    placeholder: i.placeholder,
                    type: i.type,
                    name: i.name
                }));
                const bodyText = (document.querySelector('.wrapper-content') || document.body).innerText;
                return {
                    title: (document.querySelector('h2, h3, h4, h5') || {}).innerText || '',
                    tables,
                    buttons: buttons.slice(0, 20),
                    inputs: inputs.slice(0, 20),
                    snippet: bodyText.slice(0, 1000)
                };
            }""")
            res[name] = data
            print(f"Done {name}: Tables={len(data['tables'])}, Buttons={len(data['buttons'])}")

        try:
            await page.click('text="Cerrar sesión"', timeout=3000)
            await page.wait_for_timeout(1500)
        except Exception:
            pass
        await browser.close()

    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/subroutes_data.json", "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2, ensure_ascii=False)
    print("Saved subroutes_data.json")

if __name__ == "__main__":
    asyncio.run(inspect_subroutes())
