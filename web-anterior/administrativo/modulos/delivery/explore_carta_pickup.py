import asyncio
import json
from playwright.async_api import async_playwright

async def explore_carta_flow():
    result = {
        "modalities": {},
        "pickup_flow": {},
        "delivery_flow": {},
        "captured_apis": []
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        async def on_response(resp):
            url = resp.url
            if any(term in url.lower() for term in ["rest", "api", "local", "carta", "categoria", "producto", "delivery", "horario", "pago"]):
                if not any(ext in url.lower() for ext in [".png", ".jpg", ".jpeg", ".svg", ".woff", ".css", ".ico"]):
                    try:
                        ct = resp.headers.get("content-type", "")
                        if "json" in ct:
                            data = await resp.json()
                            keys = list(data.keys()) if isinstance(data, dict) else (list(data[0].keys()) if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict) else "list")
                            result["captured_apis"].append({
                                "url": url,
                                "method": resp.request.method,
                                "status": resp.status,
                                "response_keys": keys
                            })
                    except Exception:
                        pass

        page.on("response", on_response)

        # 1. Flow A: Recojo en tienda
        print("Testing Recojo en tienda...")
        await page.goto("https://caprichos.restaurant.pe/carta-digital/#/inicio", wait_until="networkidle", timeout=45000)
        await page.wait_for_timeout(3000)

        # Click Recojo en tienda
        recojo_btn = page.locator("text='Recojo en tienda'").first
        if await recojo_btn.is_visible():
            await recojo_btn.click()
            await page.wait_for_timeout(3000)
            result["pickup_flow"]["url_after_click"] = page.url
            result["pickup_flow"]["visible_text"] = (await page.inner_text("body"))[:2000]

        # Let's see what is on screen now
        print("Current URL:", page.url)

        # Check categories and products
        categories = await page.evaluate("""() => {
            const cats = Array.from(document.querySelectorAll('.cat-item, [class*="categoria"], ion-segment-button, .segment-button')).map(el => el.innerText.trim()).filter(Boolean);
            const prods = Array.from(document.querySelectorAll('.producto, [class*="card-product"], [class*="product-card"], ion-card')).map(el => {
                const title = el.querySelector('h1, h2, h3, h4, .title, .nombre') ? el.querySelector('h1, h2, h3, h4, .title, .nombre').innerText.trim() : '';
                const price = el.querySelector('.precio, .price, span[class*="price"]') ? el.querySelector('.precio, .price, span[class*="price"]').innerText.trim() : '';
                return { title, price, text: el.innerText.trim().slice(0, 100) };
            }).filter(p => p.title || p.text);
            return { cats, prods: prods.slice(0, 5) };
        }""")
        result["pickup_flow"]["catalog"] = categories
        print("Catalog sample:", json.dumps(categories, ensure_ascii=False))

        # Check if we can view product details / options modal by clicking first product card
        first_prod = page.locator('ion-card, [class*="product-card"], [class*="card-product"]').first
        if await first_prod.count() > 0:
            print("Clicking first product to see options modal...")
            await first_prod.click()
            await page.wait_for_timeout(2000)
            modal_prod = await page.evaluate("""() => {
                const modal = document.querySelector('ion-modal, .modal, app-product-detail, [class*="detail"]');
                if (modal) {
                    return {
                        title: modal.querySelector('h1, h2, h3, .title') ? modal.querySelector('h1, h2, h3, .title').innerText.trim() : '',
                        text: modal.innerText.trim().slice(0, 1000),
                        inputs: Array.from(modal.querySelectorAll('input, ion-checkbox, ion-radio, ion-radio-group, textarea')).map(i => ({
                            tag: i.tagName,
                            type: i.type,
                            placeholder: i.placeholder,
                            name: i.name
                        }))
                    };
                }
                return null;
            }""")
            result["pickup_flow"]["product_modal"] = modal_prod
            print("Product modal:", json.dumps(modal_prod, ensure_ascii=False))

            # Close modal or add to cart to test checkout
            close_btn = page.locator('ion-modal button, ion-modal [aria-label="close"], ion-modal ion-button:has-text("Cerrar"), ion-modal fa-icon[data-icon="xmark"], ion-modal fa-icon[data-icon="times"]').first
            # Or add to cart button:
            add_btn = page.locator('ion-modal ion-button:has-text("Agregar"), ion-modal button:has-text("Agregar")').first
            if await add_btn.count() > 0:
                print("Clicking 'Agregar' to test cart...")
                await add_btn.click()
                await page.wait_for_timeout(2000)
                
                # Check cart button / badge
                cart_info = await page.evaluate("""() => {
                    const cartBtn = document.querySelector('[class*="cart"], [class*="carrito"], ion-fab-button, [aria-label*="cart"]');
                    return cartBtn ? cartBtn.innerText.trim() : null;
                }""")
                result["pickup_flow"]["cart_btn"] = cart_info
                print("Cart button text:", cart_info)

                # Click on cart to open cart/checkout
                cart_el = page.locator('[class*="cart"], [class*="carrito"], ion-fab-button, text="Ver carrito", text="Ver pedido"').first
                if await cart_el.count() > 0:
                    print("Opening cart...")
                    await cart_el.click()
                    await page.wait_for_timeout(3000)
                    result["pickup_flow"]["cart_url"] = page.url
                    result["pickup_flow"]["cart_content"] = (await page.inner_text("body"))[:2000]

                    # Check checkout fields
                    fields = await page.evaluate("""() => {
                        const inputs = Array.from(document.querySelectorAll('input, select, textarea, ion-input, ion-textarea, ion-select')).map(el => ({
                            tag: el.tagName,
                            type: el.getAttribute('type') || '',
                            placeholder: el.getAttribute('placeholder') || '',
                            name: el.getAttribute('name') || '',
                            label: el.closest('ion-item, .form-group, label') ? el.closest('ion-item, .form-group, label').innerText.trim().slice(0, 50) : ''
                        }));
                        const buttons = Array.from(document.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean);
                        return { inputs, buttons };
                    }""")
                    result["pickup_flow"]["checkout_elements"] = fields
                    print("Checkout elements:", json.dumps(fields, ensure_ascii=False))

        await browser.close()

    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/carta_flow_pickup.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print("Done explore_carta_flow.")

if __name__ == "__main__":
    asyncio.run(explore_carta_flow())
