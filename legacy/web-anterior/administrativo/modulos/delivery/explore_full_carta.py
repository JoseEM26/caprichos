import asyncio
import json
from playwright.async_api import async_playwright

async def explore_full_carta():
    data = {
        "pickup_catalog": {},
        "product_detail": {},
        "cart_view": {},
        "checkout_flow": {},
        "delivery_modal_flow": {},
        "api_endpoints": []
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        async def on_resp(resp):
            u = resp.url
            if any(term in u.lower() for term in ["rest", "api", "local", "carta", "producto", "delivery", "pedido", "checkout", "plato"]):
                if not any(ext in u.lower() for ext in [".png", ".jpg", ".jpeg", ".svg", ".woff", ".css"]):
                    try:
                        ct = resp.headers.get("content-type", "")
                        if "json" in ct:
                            body = await resp.json()
                            summary = {
                                "url": u,
                                "method": resp.request.method,
                                "status": resp.status,
                                "keys": list(body.keys()) if isinstance(body, dict) else (list(body[0].keys()) if isinstance(body, list) and len(body) > 0 and isinstance(body[0], dict) else "list")
                            }
                            # If it has interesting structure, keep key samples
                            if "locales" in u or "producto" in u or "menu" in u or "plato" in u or "categoria" in u:
                                summary["sample_data_structure"] = {k: type(v).__name__ for k, v in (body.items() if isinstance(body, dict) else {})}
                            data["api_endpoints"].append(summary)
                    except Exception:
                        pass

        page.on("response", on_resp)

        print("1. Opening carta digital...")
        await page.goto("https://caprichos.restaurant.pe/carta-digital/#/inicio", wait_until="networkidle", timeout=45000)
        await page.wait_for_timeout(3000)

        # Step 1: Click "Recojo en tienda"
        print("Clicking Recojo en tienda...")
        await page.click("text='Recojo en tienda'")
        await page.wait_for_timeout(2000)

        # Step 2: In "Selecciona un local", click "Aceptar"
        print("Clicking Aceptar on local selection...")
        await page.click("text='Aceptar'")
        await page.wait_for_timeout(4000)

        print("Current URL after selecting local:", page.url)
        data["pickup_catalog"]["url"] = page.url

        # Check categories and products
        catalog = await page.evaluate("""() => {
            const bodyText = document.body.innerText;
            const segments = Array.from(document.querySelectorAll('ion-segment-button, .segment-button, button, a')).map(b => b.innerText.trim()).filter(Boolean);
            const prods = Array.from(document.querySelectorAll('ion-card, [class*="product"], [class*="card"]')).map(c => ({
                text: c.innerText.trim(),
                className: c.className
            }));
            return {
                bodyText: bodyText.slice(0, 1500),
                buttons_or_tabs: segments.slice(0, 30),
                products_count: prods.length,
                sample_products: prods.slice(0, 5)
            };
        }""")
        data["pickup_catalog"]["elements"] = catalog
        print("Catalog summary:", json.dumps(catalog, ensure_ascii=False))

        # Click the first product card to see the product details / modifiers
        first_card = page.locator('ion-card, [class*="card-product"], [class*="product"]').first
        if await first_card.count() > 0:
            print("Clicking first product...")
            await first_card.click()
            await page.wait_for_timeout(2000)

            prod_detail = await page.evaluate("""() => {
                const modal = document.querySelector('ion-modal, app-product-detail, .modal');
                if (!modal) return { error: 'No modal found' };
                return {
                    text: modal.innerText.trim(),
                    modifiers_or_groups: Array.from(modal.querySelectorAll('ion-item-divider, h3, h4, .group-title, ion-list-header')).map(h => h.innerText.trim()),
                    options: Array.from(modal.querySelectorAll('ion-checkbox, ion-radio, ion-item, label')).map(o => o.innerText.trim()).filter(Boolean).slice(0, 20),
                    inputs: Array.from(modal.querySelectorAll('input, textarea, ion-textarea')).map(i => ({
                        tag: i.tagName,
                        placeholder: i.placeholder,
                        type: i.type
                    }))
                };
            }""")
            data["product_detail"] = prod_detail
            print("Product detail:", json.dumps(prod_detail, ensure_ascii=False))

            # Click "Agregar" or button to add to cart
            add_btn = page.locator('text="Agregar", ion-button:has-text("Agregar"), button:has-text("Agregar")').first
            if await add_btn.count() > 0:
                print("Adding to cart...")
                await add_btn.click()
                await page.wait_for_timeout(2000)

                # Look for cart button / checkout trigger
                cart_btn = page.locator('text="Ver pedido", text="Ver carrito", [class*="cart"], ion-fab-button').first
                if await cart_btn.count() > 0:
                    print("Opening cart...")
                    await cart_btn.click()
                    await page.wait_for_timeout(3000)

                    cart_info = await page.evaluate("""() => {
                        return {
                            url: window.location.href,
                            text: document.body.innerText.slice(0, 2500),
                            buttons: Array.from(document.querySelectorAll('button, ion-button, a')).map(b => b.innerText.trim()).filter(Boolean)
                        };
                    }""")
                    data["cart_view"] = cart_info
                    print("Cart info:", json.dumps(cart_info, ensure_ascii=False))

                    # If there is a button like "Continuar", "Confirmar datos", "Ir a pagar", click it to see the checkout form fields!
                    # BUT DO NOT SUBMIT!
                    continue_btn = page.locator('text="Continuar", text="Pedir", text="Siguiente", text="Pagar", text="Datos de entrega"').first
                    if await continue_btn.count() > 0:
                        print("Clicking next step in cart (to see checkout form)...")
                        await continue_btn.click()
                        await page.wait_for_timeout(3000)

                        checkout_data = await page.evaluate("""() => {
                            const inputs = Array.from(document.querySelectorAll('input, select, textarea, ion-input, ion-textarea, ion-select, ion-radio, ion-checkbox')).map(el => {
                                const parent = el.closest('ion-item, .form-group, label, div');
                                return {
                                    tag: el.tagName,
                                    type: el.getAttribute('type') || el.type || '',
                                    placeholder: el.getAttribute('placeholder') || el.placeholder || '',
                                    name: el.getAttribute('name') || el.name || '',
                                    id: el.id || '',
                                    label: parent ? parent.innerText.split('\n')[0].trim() : ''
                                };
                            });
                            return {
                                url: window.location.href,
                                text: document.body.innerText.slice(0, 3000),
                                inputs: inputs,
                                buttons: Array.from(document.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean)
                            };
                        }""")
                        data["checkout_flow"] = checkout_data
                        print("Checkout data:", json.dumps(checkout_data, ensure_ascii=False))

        # Now test Flow B: Delivery modal
        print("\nTesting Delivery modal flow...")
        await page.goto("https://caprichos.restaurant.pe/carta-digital/#/inicio", wait_until="networkidle", timeout=45000)
        await page.wait_for_timeout(3000)

        delivery_btn = page.locator("text='Delivery'").first
        if await delivery_btn.is_visible():
            print("Clicking Delivery button...")
            await delivery_btn.click()
            await page.wait_for_timeout(3000)

            del_modal = await page.evaluate("""() => {
                const inputs = Array.from(document.querySelectorAll('input, select, textarea, ion-input')).map(i => ({
                    tag: i.tagName,
                    placeholder: i.getAttribute('placeholder') || i.placeholder || '',
                    type: i.getAttribute('type') || i.type || '',
                    className: i.className
                }));
                return {
                    url: window.location.href,
                    text: document.body.innerText.slice(0, 2000),
                    inputs: inputs,
                    buttons: Array.from(document.querySelectorAll('button, ion-button, a')).map(b => b.innerText.trim()).filter(Boolean)
                };
            }""")
            data["delivery_modal_flow"] = del_modal
            print("Delivery modal flow:", json.dumps(del_modal, ensure_ascii=False))

        # Also check Pedidos QR URL:
        print("\nChecking Pedidos QR URL...")
        await page.goto("https://caprichos.restaurant.pe/carta-digital/#/inicio?pickupAtStore=1&storeId=null", wait_until="networkidle", timeout=45000)
        await page.wait_for_timeout(3000)
        qr_info = await page.evaluate("""() => {
            return {
                url: window.location.href,
                text: document.body.innerText.slice(0, 1000)
            };
        }""")
        data["pedidos_qr"] = qr_info

        await browser.close()

    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/full_carta_data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Saved full_carta_data.json")

if __name__ == "__main__":
    asyncio.run(explore_full_carta())
