import asyncio
import json
from playwright.async_api import async_playwright

async def explore():
    res = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Desktop viewport: 1400x900
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        print("1. Loading inicio...")
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

        print("2. In catalog:", page.url)

        # Let's find ion-button with AÑADIR
        anadir_btn = page.locator('ion-button:has-text("AÑADIR")').first
        print("Añadir button visible:", await anadir_btn.is_visible())
        await anadir_btn.click()
        await page.wait_for_timeout(3000)

        # Check if product modal is open
        modal_info = await page.evaluate("""() => {
            const m = document.querySelector('ion-modal');
            if (!m) return null;
            return {
                text: m.innerText.trim(),
                buttons: Array.from(m.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean)
            };
        }""")
        print("Product modal text:\n", modal_info["text"] if modal_info else "No modal")
        res["product_modal"] = modal_info

        # If modal is open, select any required option and click Agregar
        if modal_info:
            # Check radio buttons or options inside modal
            radio = page.locator('ion-modal ion-radio, ion-modal input[type="radio"], ion-modal ion-checkbox').first
            if await radio.count() > 0:
                print("Selecting first option in modal...")
                await radio.click()
                await page.wait_for_timeout(1000)

            add_m = page.locator('ion-modal ion-button:has-text("Agregar"), ion-modal ion-button:has-text("Añadir")').first
            if await add_m.count() > 0:
                print("Clicking Agregar in modal...")
                await add_m.click()
                await page.wait_for_timeout(2000)

        # Check cart icon / counter
        cart_badge = page.locator('app-header fa-icon[data-icon="cart-shopping"], app-header .fa-cart-shopping, app-header ion-badge').first
        print("Cart badge found:", await cart_badge.count())
        # Also there's a floating or header cart button
        header_cart = page.locator('app-header .cursor-pointer:has(fa-icon)').last
        print("Clicking header cart...")
        await header_cart.click()
        await page.wait_for_timeout(3000)

        print("URL after cart click:", page.url)
        cart_state = await page.evaluate("""() => {
            return {
                url: window.location.href,
                text: document.body.innerText.slice(0, 3000),
                buttons: Array.from(document.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean)
            };
        }""")
        print("Cart state text:\n", cart_state["text"][:800])
        print("Cart buttons:", cart_state["buttons"])
        res["cart_state"] = cart_state

        # Click next button in cart (Continuar / Pedir / Ir a pagar)
        next_btn = page.locator('text="Continuar", text="Ir a pagar", text="Pedir", text="Confirmar pedido"').first
        if await next_btn.count() > 0:
            print("Clicking next button...")
            await next_btn.click()
            await page.wait_for_timeout(3000)

            print("URL after next:", page.url)
            checkout_info = await page.evaluate("""() => {
                const inputs = Array.from(document.querySelectorAll('input, select, textarea, ion-input, ion-textarea, ion-select')).map(el => {
                    const parent = el.closest('ion-item, .form-group, label, div');
                    return {
                        tag: el.tagName,
                        type: el.getAttribute('type') || el.type || '',
                        placeholder: el.getAttribute('placeholder') || el.placeholder || '',
                        name: el.getAttribute('name') || el.name || '',
                        label: parent ? parent.innerText.split('\\n')[0].trim() : ''
                    };
                });
                return {
                    url: window.location.href,
                    text: document.body.innerText.slice(0, 4000),
                    inputs: inputs,
                    buttons: Array.from(document.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean)
                };
            }""")
            print("Checkout form fields count:", len(checkout_info["inputs"]))
            print("Checkout buttons:", checkout_info["buttons"])
            print("Checkout text:\n", checkout_info["text"][:1200])
            res["checkout_info"] = checkout_info

        await browser.close()

    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/cart_checkout_result.json", "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2, ensure_ascii=False)
    print("Saved cart_checkout_result.json")

if __name__ == "__main__":
    asyncio.run(explore())
