import asyncio
import json
from playwright.async_api import async_playwright

async def run_flow():
    result = {
        "menu_categories": [],
        "product_selected": {},
        "modifier_modal": {},
        "cart_summary": {},
        "checkout_form": {},
        "delivery_mode_info": {}
    }

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

        print("2. In catalog:", page.url)

        # Click first 'AÑADIR' button
        anadir_btn = page.locator("text='AÑADIR'").first
        if await anadir_btn.count() > 0:
            print("Clicking first AÑADIR button...")
            await anadir_btn.click()
            await page.wait_for_timeout(2500)

            # Check if a modal popped up (for combos/options) or if it went straight to cart
            modal_text = await page.evaluate('''() => {
                const modal = document.querySelector('ion-modal, app-product-detail, .modal, [class*="dialog"]');
                if (!modal) return null;
                const radios = Array.from(modal.querySelectorAll('ion-radio, input[type="radio"], ion-checkbox, input[type="checkbox"], label')).map(r => r.innerText.trim()).filter(Boolean);
                const buttons = Array.from(modal.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean);
                const inputs = Array.from(modal.querySelectorAll('input, textarea, ion-textarea')).map(i => ({
                    tag: i.tagName,
                    placeholder: i.placeholder,
                    type: i.type
                }));
                return {
                    text: modal.innerText.trim(),
                    radios: radios.slice(0, 30),
                    buttons,
                    inputs
                };
            }''')
            result["modifier_modal"] = modal_text
            print("Modifier modal detected:", bool(modal_text))
            if modal_text:
                print("Modal text snippet:\n", modal_text["text"][:500])

                # If there are required options, let's see what buttons exist
                # Look for an "Agregar" or "Añadir" button inside modal
                modal_add = page.locator('ion-modal button:has-text("Agregar"), ion-modal ion-button:has-text("Agregar"), ion-modal button:has-text("Añadir")').first
                if await modal_add.count() > 0:
                    print("Clicking modal Agregar...")
                    await modal_add.click()
                    await page.wait_for_timeout(2000)

            # 3. Check cart button (floating or header)
            cart_btn = page.locator('app-header [class*="cart"], ion-header [class*="cart"], ion-fab-button, text="Ver pedido", text="Ver carrito"').first
            if await cart_btn.count() == 0:
                # Try clicking number badge or cart icon
                cart_btn = page.locator('.fa-cart-shopping, [data-icon="cart-shopping"], .fa-shopping-cart, ion-badge').first
            
            if await cart_btn.count() > 0:
                print("Clicking cart icon/button...")
                await cart_btn.click()
                await page.wait_for_timeout(3000)

                cart_content = await page.evaluate('''() => {
                    const buttons = Array.from(document.querySelectorAll('button, ion-button, a')).map(b => b.innerText.trim()).filter(Boolean);
                    return {
                        url: window.location.href,
                        text: document.body.innerText.slice(0, 2500),
                        buttons
                    };
                }''')
                result["cart_summary"] = cart_content
                print("Cart content text snippet:\n", cart_content["text"][:600])
                print("Cart buttons:", cart_content["buttons"])

                # 4. Click next button in cart (e.g. "Continuar", "Confirmar datos", "Ir a pagar", "Pedir")
                next_btn = page.locator('text="Continuar", text="Pedir", text="Confirmar datos", text="Ir a pagar", text="Siguiente", text="Datos de entrega"').first
                if await next_btn.count() > 0:
                    print("Clicking next in cart...")
                    await next_btn.click()
                    await page.wait_for_timeout(3000)

                    checkout_content = await page.evaluate('''() => {
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
                            text: document.body.innerText.slice(0, 3000),
                            inputs,
                            radios,
                            buttons
                        };
                    }''')
                    result["checkout_form"] = checkout_content
                    print("Checkout inputs found:", len(checkout_content["inputs"]))
                    print("Checkout inputs:", checkout_content["inputs"])
                    print("Checkout radios/options:", checkout_content["radios"])
                    print("Checkout buttons:", checkout_content["buttons"])

        await browser.close()

    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/digital_menu_checkout_flow.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print("Saved digital_menu_checkout_flow.json")

if __name__ == "__main__":
    asyncio.run(run_flow())
