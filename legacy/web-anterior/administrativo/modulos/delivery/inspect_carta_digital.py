import asyncio
import json
import re
from playwright.async_api import async_playwright

async def inspect_carta():
    data = {
        "urls": {},
        "network_requests": [],
        "categories": [],
        "sample_product": {},
        "modalities": [],
        "checkout_fields": [],
        "payment_methods": [],
        "order_destination": None,
        "scripts_and_frameworks": {}
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        # Capture GET API endpoints
        async def handle_response(resp):
            url = resp.url
            if any(term in url.lower() for term in ["rest", "api", "carta", "producto", "tienda", "local", "pago", "delivery"]):
                try:
                    # Ignore images/fonts
                    if any(ext in url.lower() for ext in [".png", ".jpg", ".jpeg", ".svg", ".woff", ".css"]):
                        return
                    content_type = resp.headers.get("content-type", "")
                    if "json" in content_type or "text" in content_type:
                        text = await resp.text()
                        # summarize json structure
                        summary = None
                        try:
                            parsed = json.loads(text)
                            if isinstance(parsed, dict):
                                summary = {"type": "dict", "keys": list(parsed.keys())}
                            elif isinstance(parsed, list):
                                summary = {"type": "list", "length": len(parsed), "item_keys": list(parsed[0].keys()) if len(parsed) > 0 and isinstance(parsed[0], dict) else "primitive"}
                        except Exception:
                            summary = text[:200]
                        data["network_requests"].append({
                            "url": url,
                            "method": resp.request.method,
                            "status": resp.status,
                            "summary": summary
                        })
                except Exception:
                    pass

        page.on("response", handle_response)

        target_url = "https://caprichos.restaurant.pe/carta-digital/#/inicio"
        print(f"Navigating to {target_url}...")
        await page.goto(target_url, wait_until="networkidle", timeout=45000)
        await page.wait_for_timeout(3000)

        data["urls"]["inicio"] = page.url

        # Check framework
        framework = await page.evaluate("""() => {
            return {
                angular: window.angular ? (window.angular.version ? window.angular.version.full : 'yes') : 'no',
                vue: window.Vue ? 'yes' : 'no',
                react: window.React ? 'yes' : 'no',
                title: document.title,
                body_classes: document.body.className
            };
        }""")
        data["scripts_and_frameworks"] = framework
        print("Framework:", framework)

        # Inspect initial screen elements (e.g. store selector, delivery mode selector)
        modal_or_overlay = await page.evaluate("""() => {
            const modals = document.querySelectorAll('.modal, .swal2-container, .dialog, [role="dialog"], .popup');
            const visible = [];
            modals.forEach(m => {
                if (m.offsetWidth > 0 && m.offsetHeight > 0) {
                    visible.push({
                        class: m.className,
                        text: m.innerText.trim().slice(0, 500)
                    });
                }
            });
            return visible;
        }""")
        data["initial_modals"] = modal_or_overlay
        print("Initial Modals:", json.dumps(modal_or_overlay, ensure_ascii=False))

        # Check navigation / categories / modalities
        page_info = await page.evaluate("""() => {
            const buttons = Array.from(document.querySelectorAll('button, a, .btn')).map(b => b.innerText.trim()).filter(Boolean);
            const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5')).map(h => h.innerText.trim()).filter(Boolean);
            const categories = Array.from(document.querySelectorAll('.categoria, .category, .nav-item, [ng-repeat*="cat"], [v-for*="cat"]')).map(c => c.innerText.trim()).filter(Boolean);
            return {
                buttons: buttons.slice(0, 30),
                headers: headers.slice(0, 20),
                categories: categories.slice(0, 30)
            };
        }""")
        data["page_info"] = page_info
        print("Page info:", json.dumps(page_info, ensure_ascii=False))

        # Let's inspect routes and state definitions if AngularJS
        states = await page.evaluate("""() => {
            try {
                if (window.angular) {
                    const el = document.querySelector('[ng-app]') || document.body;
                    const injector = window.angular.element(el).injector();
                    if (injector) {
                        if (injector.has('$state')) {
                            const $state = injector.get('$state');
                            return $state.get().map(s => ({
                                name: s.name,
                                url: s.url,
                                templateUrl: s.templateUrl,
                                controller: s.controller
                            }));
                        }
                    }
                }
            } catch (e) {
                return { error: e.message };
            }
            return null;
        }""")
        data["angular_states"] = states
        print("Angular states:", json.dumps(states, ensure_ascii=False))

        await browser.close()

    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/carta_digital_info.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Saved carta_digital_info.json")

if __name__ == "__main__":
    asyncio.run(inspect_carta())
