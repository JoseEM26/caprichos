import asyncio
import json
from playwright.async_api import async_playwright

async def explore_tienda_1():
    data = {
        "tienda_url": None,
        "apis_called": [],
        "categories": [],
        "products": [],
        "product_modal": None,
        "cart": None,
        "checkout": None
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        async def on_resp(resp):
            u = resp.url
            if any(term in u.lower() for term in ["rest", "api", "delivery", "cargar", "categoria", "producto", "plato"]):
                if not any(ext in u.lower() for ext in [".png", ".jpg", ".jpeg", ".svg", ".woff", ".css", ".ico"]):
                    try:
                        ct = resp.headers.get("content-type", "")
                        if "json" in ct:
                            body = await resp.json()
                            data["apis_called"].append({
                                "url": u,
                                "method": resp.request.method,
                                "status": resp.status,
                                "keys": list(body.keys()) if isinstance(body, dict) else (list(body[0].keys()) if isinstance(body, list) and len(body)>0 and isinstance(body[0], dict) else "list")
                            })
                    except Exception:
                        pass

        page.on("response", on_resp)

        url = "https://caprichos.restaurant.pe/carta-digital/#/inicio"
        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)

        # 1. Click "Recojo en tienda"
        print("Clicking Recojo en tienda...")
        await page.click("text='Recojo en tienda'")
        await page.wait_for_timeout(2000)

        # 2. Click the local card (it has "Calle 11" or "CAPRICHOS")
        print("Selecting local card...")
        local_card = page.locator("text='Calle 11'").first
        if await local_card.count() > 0:
            await local_card.click()
            await page.wait_for_timeout(1000)

        # 3. Click "Aceptar"
        print("Clicking Aceptar...")
        await page.click("text='Aceptar'")
        await page.wait_for_timeout(4000)

        data["tienda_url"] = page.url
        print(f"Current URL: {page.url}")

        # Check categories and products
        info = await page.evaluate("""() => {
            const cats = Array.from(document.querySelectorAll('ion-segment-button, .segment-button, [class*="category"], [class*="categoria"]')).map(el => el.innerText.trim()).filter(Boolean);
            const prods = Array.from(document.querySelectorAll('ion-card, [class*="product-card"], [class*="card-product"], .card')).map(el => {
                const name = el.querySelector('h1, h2, h3, h4, .title, .nombre, ion-card-title') ? el.querySelector('h1, h2, h3, h4, .title, .nombre, ion-card-title').innerText.trim() : '';
                const price = el.querySelector('[class*="price"], [class*="precio"], .bold') ? el.querySelector('[class*="price"], [class*="precio"], .bold').innerText.trim() : '';
                const desc = el.querySelector('p, ion-card-subtitle, .desc') ? el.querySelector('p, ion-card-subtitle, .desc').innerText.trim() : '';
                return { name, price, desc, text: el.innerText.trim().slice(0, 150) };
            });
            return {
                title: document.title,
                bodyText: document.body.innerText.slice(0, 1500),
                categories: cats,
                products: prods
            };
        }""")
        data["categories"] = info["categories"]
        data["products"] = info["products"]
        data["catalog_body"] = info["bodyText"]
        print(f"Categories: {len(info['categories'])}, Products: {len(info['products'])}")
        print(f"Body text preview: {info['bodyText'][:300]}")

        # Click the first product to view detail modal
        first_card = page.locator('ion-card, [class*="product-card"], [class*="card-product"]').first
        if await first_card.count() > 0:
            print("Clicking first product...")
            await first_card.click()
            await page.wait_for_timeout(2500)

            modal_info = await page.evaluate("""() => {
                const modal = document.querySelector('ion-modal, app-product-detail, .modal');
                if (!modal) return null;
                const title = modal.querySelector('h1, h2, h3, .title, ion-title') ? modal.querySelector('h1, h2, h3, .title, ion-title').innerText.trim() : '';
                const options = Array.from(modal.querySelectorAll('ion-item, ion-checkbox, ion-radio, label')).map(o => o.innerText.trim()).filter(Boolean);
                const buttons = Array.from(modal.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean);
                const inputs = Array.from(modal.querySelectorAll('input, textarea, ion-textarea')).map(i => ({
                    tag: i.tagName,
                    placeholder: i.placeholder,
                    type: i.type
                }));
                return {
                    title,
                    text: modal.innerText.trim().slice(0, 1500),
                    options: options.slice(0, 20),
                    buttons,
                    inputs
                };
            }""")
            data["product_modal"] = modal_info
            print("Product modal:", modal_info)

            # Add to cart
            add_btn = page.locator('text="Agregar", ion-button:has-text("Agregar")').first
            if await add_btn.count() > 0:
                print("Adding to cart...")
                await add_btn.click()
                await page.wait_for_timeout(2500)

                # Look for cart / "Ver pedido" / "Ver carrito"
                cart_btn = page.locator('text="Ver pedido", text="Ver carrito", [class*="cart"], ion-fab-button').first
                if await cart_btn.count() > 0:
                    print("Clicking cart button...")
                    await cart_btn.click()
                    await page.wait_for_timeout(3000)

                    cart_data = await page.evaluate("""() => {
                        return {
                            url: window.location.href,
                            text: document.body.innerText.slice(0, 2000),
                            buttons: Array.from(document.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean)
                        };
                    }""")
                    data["cart"] = cart_data
                    print("Cart data buttons:", cart_data["buttons"])

                    # Click next step (e.g. "Continuar" or "Pedir" or "Ir a pagar")
                    continue_btn = page.locator('text="Continuar", text="Pedir", text="Siguiente", text="Datos", text="Confirmar"').first
                    if await continue_btn.count() > 0:
                        print("Clicking next step to see checkout fields...")
                        await continue_btn.click()
                        await page.wait_for_timeout(3000)

                        checkout_data = await page.evaluate("""() => {
                            const inputs = Array.from(document.querySelectorAll('input, select, textarea, ion-input, ion-textarea, ion-select')).map(el => ({
                                tag: el.tagName,
                                type: el.getAttribute('type') || el.type || '',
                                placeholder: el.getAttribute('placeholder') || el.placeholder || '',
                                name: el.getAttribute('name') || el.name || '',
                                label: el.closest('ion-item, .form-group, label') ? el.closest('ion-item, .form-group, label').innerText.split('\n')[0].trim() : ''
                            }));
                            return {
                                url: window.location.href,
                                text: document.body.innerText.slice(0, 3000),
                                inputs,
                                buttons: Array.from(document.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean)
                            };
                        }""")
                        data["checkout"] = checkout_data
                        print("Checkout data buttons:", checkout_data["buttons"])

        await browser.close()

    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/tienda_1_info.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Saved tienda_1_info.json")

if __name__ == "__main__":
    asyncio.run(explore_tienda_1())
