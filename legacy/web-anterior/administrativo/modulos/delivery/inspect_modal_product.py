import asyncio
import json
from playwright.async_api import async_playwright

async def inspect_modal_dom():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        await page.goto("https://caprichos.restaurant.pe/carta-digital/#/inicio", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        await page.click("text='Recojo en tienda'")
        await page.wait_for_timeout(2000)
        await page.locator(".cursor-pointer.rounded-lg").first.click()
        await page.wait_for_timeout(1000)
        await page.locator("text='Martes'").first.click()
        await page.wait_for_timeout(1000)
        await page.locator("text='3 pm'").first.click()
        await page.wait_for_timeout(1000)
        await page.locator("text='3:00'").first.click()
        await page.wait_for_timeout(1000)
        await page.click("text='Aceptar'")
        await page.wait_for_timeout(4000)

        # Click AÑADIR
        await page.locator('ion-button:has-text("AÑADIR")').first.click()
        await page.wait_for_timeout(2500)

        # Inspect modal innerHTML
        modal_html = await page.evaluate("""() => {
            const m = document.querySelector('ion-modal');
            return m ? m.innerHTML : 'No modal';
        }""")
        with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/modal_product.html", "w") as f:
            f.write(modal_html)
        print("Wrote modal_product.html")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_modal_dom())
