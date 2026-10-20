import asyncio
import json
from playwright.async_api import async_playwright

async def explore_to_checkout():
    result = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        print("1. Going to /inicio...")
        await page.goto("https://caprichos.restaurant.pe/carta-digital/#/inicio", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        # Recojo en tienda
        await page.click("text='Recojo en tienda'")
        await page.wait_for_timeout(2000)

        # Local
        await page.locator(".cursor-pointer.rounded-lg").first.click()
        await page.wait_for_timeout(1000)

        # Day
        await page.locator("text='Martes'").first.click()
        await page.wait_for_timeout(1000)

        # Hour
        await page.locator("text='3 pm'").first.click()
        await page.wait_for_timeout(1000)

        # Minute
        await page.locator("text='3:00'").first.click()
        await page.wait_for_timeout(1000)

        # Aceptar
        await page.click("text='Aceptar'")
        await page.wait_for_timeout(4000)

        print("2. In catalog! Clicking AÑADIR...")
        await page.locator('ion-button:has-text("AÑADIR")').first.click()
        await page.wait_for_timeout(2500)

        # Click the first plus button 6 times to satisfy "Máximo: 6"
        plus_btn = page.locator('ion-modal button.hover\\:text-primary').first
        if await plus_btn.count() > 0:
            print("Clicking plus button 6 times...")
            for i in range(6):
                await plus_btn.click()
                await page.wait_for_timeout(200)

        # Click Agregar
        agregar_btn = page.locator('ion-modal button:has-text("Agregar")').last
        print("Clicking Agregar button in modal...")
        await agregar_btn.click()
        await page.wait_for_timeout(3000)

        # Check if modal closed
        modal_open = await page.locator("ion-modal").count()
        print("Modal open count:", modal_open)

        # Now click cart! Let's find the cart trigger
        # Look for cart button in header
        cart_icon = page.locator('app-header .fa-cart-shopping, app-header fa-icon[data-icon="cart-shopping"], app-header ion-badge').first
        if await cart_icon.count() > 0:
            print("Clicking cart icon...")
            await cart_icon.click()
            await page.wait_for_timeout(3000)

            print("Cart page URL:", page.url)
            cart_html = await page.content()
            with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/cart_page.html", "w") as f:
                f.write(cart_html)

            cart_text = await page.evaluate("""() => {
                return {
                    url: window.location.href,
                    text: document.body.innerText.slice(0, 3000),
                    buttons: Array.from(document.querySelectorAll('button, ion-button, a')).map(b => b.innerText.trim()).filter(Boolean)
                };
            }""")
            print("Cart text preview:\n", cart_text["text"][:800])
            print("Cart buttons:", cart_text["buttons"])
            result["cart"] = cart_text

            # Look for button to proceed to checkout (Continuar / Ir a pagar / Pedir)
            proceed_btn = page.locator('text="Continuar", text="Ir a pagar", text="Pedir", text="Confirmar", text="Siguiente"').first
            if await proceed_btn.count() > 0:
                print("Clicking proceed button:", await proceed_btn.inner_text())
                await proceed_btn.click()
                await page.wait_for_timeout(3000)

                print("Checkout page URL:", page.url)
                checkout_html = await page.content()
                with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/checkout_page.html", "w") as f:
                    f.write(checkout_html)

                checkout_data = await page.evaluate("""() => {
                    const inputs = Array.from(document.querySelectorAll('input, select, textarea, ion-input, ion-textarea, ion-select')).map(el => {
                        const parent = el.closest('ion-item, .form-group, label, div');
                        return {
                            tag: el.tagName,
                            type: el.getAttribute('type') || el.type || '',
                            placeholder: el.getAttribute('placeholder') || el.placeholder || '',
                            name: el.getAttribute('name') || el.name || '',
                            id: el.id || '',
                            label: parent ? parent.innerText.split('\\n')[0].trim() : ''
                        };
                    });
                    const radios = Array.from(document.querySelectorAll('ion-radio, [role="radio"], ion-checkbox, [role="checkbox"]')).map(r => r.innerText.trim()).filter(Boolean);
                    const buttons = Array.from(document.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean);
                    return {
                        url: window.location.href,
                        text: document.body.innerText.slice(0, 4000),
                        inputs,
                        radios,
                        buttons
                    };
                }""")
                print("Checkout form fields:", len(checkout_data["inputs"]))
                print("Checkout inputs:", checkout_data["inputs"])
                print("Checkout radios:", checkout_data["radios"])
                print("Checkout buttons:", checkout_data["buttons"])
                result["checkout"] = checkout_data

        await browser.close()

    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/full_cart_checkout_data.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print("Saved full_cart_checkout_data.json")

if __name__ == "__main__":
    asyncio.run(explore_to_checkout())
