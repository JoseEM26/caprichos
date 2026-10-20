import asyncio
import json
from playwright.async_api import async_playwright

async def explore_full_checkout():
    result = {
        "modalities": ["Recojo en tienda", "Delivery"],
        "recojo_step": {
            "local_name": "CAPRICHOS",
            "address": "Calle 11, Mz D LT 27 Urb. Los girasoles de Campoy, SJL, Lima",
            "schedule": "De 14:00 pm a 22:00 pm",
            "hours": ["2 pm", "3 pm", "4 pm", "5 pm", "6 pm", "7 pm", "8 pm", "9 pm", "10 pm"]
        },
        "catalog": {},
        "product_modal": {},
        "cart": {},
        "checkout_form": {},
        "apis": []
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
                            result["apis"].append({
                                "url": u,
                                "method": resp.request.method,
                                "status": resp.status,
                                "keys": list(body.keys()) if isinstance(body, dict) else (list(body[0].keys()) if isinstance(body, list) and len(body)>0 and isinstance(body[0], dict) else "list")
                            })
                    except Exception:
                        pass

        page.on("response", on_resp)

        print("Navigating to https://caprichos.restaurant.pe/carta-digital/#/inicio...")
        await page.goto("https://caprichos.restaurant.pe/carta-digital/#/inicio", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        # 1. Click Recojo en tienda
        await page.click("text='Recojo en tienda'")
        await page.wait_for_timeout(2000)

        # 2. Click local card
        await page.locator(".cursor-pointer.rounded-lg").first.click()
        await page.wait_for_timeout(1000)

        # 3. Click day
        await page.locator("text='Martes'").first.click()
        await page.wait_for_timeout(1000)

        # 4. Click hour (e.g. 3 pm)
        hour_btn = page.locator("text='3 pm'").first
        if await hour_btn.count() > 0:
            await hour_btn.click()
            await page.wait_for_timeout(1000)
            print("Selected 3 pm")

        # 5. Click Aceptar
        await page.click("text='Aceptar'")
        await page.wait_for_timeout(4000)

        print("Landed in catalog! Current URL:", page.url)
        result["catalog"]["url"] = page.url

        # Read catalog info
        cat_info = await page.evaluate("""() => {
            const categories = Array.from(document.querySelectorAll('ion-segment-button, .segment-button, [class*="categoria"]')).map(c => c.innerText.trim()).filter(Boolean);
            const products = Array.from(document.querySelectorAll('ion-card, [class*="product-card"], [class*="card-product"], .card')).map(card => {
                const title = card.querySelector('h1, h2, h3, h4, .title, .nombre, ion-card-title');
                const price = card.querySelector('[class*="precio"], [class*="price"], .bold');
                const desc = card.querySelector('p, ion-card-subtitle, .desc');
                return {
                    name: title ? title.innerText.trim() : '',
                    price: price ? price.innerText.trim() : '',
                    desc: desc ? desc.innerText.trim() : '',
                    snippet: card.innerText.trim().slice(0, 150)
                };
            }).filter(p => p.name || p.snippet);
            return {
                title: document.title,
                bodySnippet: document.body.innerText.slice(0, 1000),
                categories: categories.slice(0, 20),
                productsCount: products.length,
                productsSample: products.slice(0, 10)
            };
        }""")
        result["catalog"]["info"] = cat_info
        print(f"Categories found: {len(cat_info['categories'])}, Products: {cat_info['productsCount']}")

        # 6. Click on first product card
        first_prod = page.locator('ion-card, [class*="product-card"], [class*="card-product"], .card').first
        if await first_prod.count() > 0:
            print("Clicking first product to view modifier options...")
            await first_prod.click()
            await page.wait_for_timeout(2500)

            prod_detail = await page.evaluate("""() => {
                const modal = document.querySelector('ion-modal, app-product-detail, .modal');
                if (!modal) return null;
                const title = modal.querySelector('h1, h2, h3, .title, ion-title');
                const options = Array.from(modal.querySelectorAll('ion-item, ion-checkbox, ion-radio, label')).map(o => o.innerText.trim()).filter(Boolean);
                const buttons = Array.from(modal.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean);
                const inputs = Array.from(modal.querySelectorAll('input, textarea, ion-textarea')).map(i => ({
                    tag: i.tagName,
                    placeholder: i.placeholder,
                    type: i.type
                }));
                return {
                    title: title ? title.innerText.trim() : '',
                    text: modal.innerText.trim(),
                    options: options.slice(0, 20),
                    buttons,
                    inputs
                };
            }""")
            result["product_modal"] = prod_detail
            print("Product modal details:", prod_detail)

            # 7. Add product to cart
            add_btn = page.locator('text="Agregar", ion-button:has-text("Agregar")').first
            if await add_btn.count() > 0:
                print("Clicking 'Agregar' to add product to cart...")
                await add_btn.click()
                await page.wait_for_timeout(2500)

                # 8. Open cart
                cart_btn = page.locator('text="Ver pedido", text="Ver carrito", [class*="cart"], ion-fab-button').first
                if await cart_btn.count() > 0:
                    print("Opening cart...")
                    await cart_btn.click()
                    await page.wait_for_timeout(3000)

                    cart_state = await page.evaluate("""() => {
                        return {
                            url: window.location.href,
                            text: document.body.innerText.slice(0, 2000),
                            buttons: Array.from(document.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean)
                        };
                    }""")
                    result["cart"] = cart_state
                    print("Cart buttons:", cart_state["buttons"])

                    # 9. Click next step (e.g. Continuar / Pedir / Confirmar datos)
                    next_btn = page.locator('text="Continuar", text="Pedir", text="Siguiente", text="Datos", text="Confirmar", text="Ir a pagar"').first
                    if await next_btn.count() > 0:
                        print("Clicking next step to reach checkout form...")
                        await next_btn.click()
                        await page.wait_for_timeout(3000)

                        form_state = await page.evaluate("""() => {
                            const inputs = Array.from(document.querySelectorAll('input, select, textarea, ion-input, ion-textarea, ion-select')).map(el => {
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
                            const radios = Array.from(document.querySelectorAll('ion-radio, ion-checkbox, [role="radio"]')).map(r => r.innerText.trim()).filter(Boolean);
                            const buttons = Array.from(document.querySelectorAll('button, ion-button')).map(b => b.innerText.trim()).filter(Boolean);
                            return {
                                url: window.location.href,
                                text: document.body.innerText.slice(0, 3000),
                                inputs,
                                radios,
                                buttons
                            };
                        }""")
                        result["checkout_form"] = form_state
                        print("Checkout form fields:", len(form_state["inputs"]))
                        print("Checkout form buttons:", form_state["buttons"])

        await browser.close()

    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/full_checkout_flow.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print("Saved full_checkout_flow.json")

if __name__ == "__main__":
    asyncio.run(explore_full_checkout())
