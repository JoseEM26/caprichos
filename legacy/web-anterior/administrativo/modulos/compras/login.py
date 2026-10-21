import asyncio
import os
import json
import re
from playwright.async_api import async_playwright

async def run_login_attempt():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD environment variable not set.")
        return

    result = {
        "login_status": None,
        "error_message": None,
        "lockout_or_counter": None,
        "preloaded_fields": [],
        "post_login_url": None,
        "menu_tree": [],
        "locked_or_absent_modules": [],
        "tech_stack": {},
        "api_base_url": None,
        "network_login_response": None
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        api_urls = []
        login_api_info = {}

        async def handle_response(resp):
            url = resp.url
            api_urls.append(url)
            if any(term in url.lower() for term in ["login", "autentic", "auth", "usuario", "sesion"]):
                try:
                    text = await resp.text()
                    # Redact any password or token if present
                    safe_text = re.sub(r'"token"\s*:\s*"[^"]+"', '"token":"[REDACTED]"', text)
                    login_api_info["url"] = url
                    login_api_info["status"] = resp.status
                    login_api_info["body"] = safe_text[:1000]
                except Exception:
                    login_api_info["url"] = url
                    login_api_info["status"] = resp.status

        page.on("response", handle_response)

        target_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"Navigating to {target_url}...")
        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        
        # Wait 4s for AngularJS models to stabilize
        await page.wait_for_timeout(4000)

        # 1. Read tech stack
        tech = await page.evaluate("""() => {
            return {
                angular: window.angular && window.angular.version ? window.angular.version.full : (window.angular ? 'yes' : 'no'),
                jquery: window.jQuery && window.jQuery.fn ? window.jQuery.fn.jquery : 'no',
                bootstrap: (window.jQuery && window.jQuery.fn && window.jQuery.fn.emulateTransitionEnd) ? 'Bootstrap 3' : 'unknown'
            };
        }""")
        result["tech_stack"] = tech

        # 2. Inspect all form fields and preloaded values
        fields = await page.evaluate("""() => {
            const list = [];
            const elements = document.querySelectorAll('form input, form select, form textarea');
            elements.forEach(el => {
                let displayVal = el.value;
                if (el.tagName.toLowerCase() === 'select') {
                    const opt = el.options[el.selectedIndex];
                    displayVal = opt ? opt.text : el.value;
                } else if (el.type === 'password') {
                    displayVal = el.value ? '[CONTRASENA_PRECARGADA]' : '[VACIO]';
                }
                list.push({
                    name: el.name || el.id || el.getAttribute('ng-model') || 'sin_nombre',
                    tag: el.tagName.toLowerCase(),
                    type: el.type || '',
                    placeholder: el.placeholder || '',
                    label_or_text: displayVal,
                    raw_value: el.type === 'password' ? '[REDACTED]' : el.value
                });
            });
            return list;
        }""")
        result["preloaded_fields"] = fields
        print(f"Preloaded fields captured: {len(fields)}")

        # 3. Fill ONLY usuario_nick and usuario_clave
        user_input = page.locator('input[name="usuario_nick"]')
        pass_input = page.locator('input[name="usuario_clave"]')

        print(f"Typing user '{user}' into username field...")
        await user_input.fill(user)
        await page.wait_for_timeout(500)

        print("Typing password into password field...")
        await pass_input.fill(password)
        await page.wait_for_timeout(500)

        # 4. Click login button ONCE
        login_btn = page.locator('button[type="submit"]')
        print("Clicking submit button once...")
        await login_btn.click()

        # 5. Observe what happens (wait up to 10 seconds)
        print("Waiting to observe result...")
        for _ in range(20):
            await page.wait_for_timeout(500)
            current_url = page.url
            if "#!/login" not in current_url:
                print(f"URL changed to: {current_url}")
                break

        await page.wait_for_timeout(3000)
        current_url = page.url
        result["post_login_url"] = current_url
        result["network_login_response"] = login_api_info

        # Check for error messages / alerts / toasts / notifications
        messages = await page.evaluate("""() => {
            const msgs = [];
            // Common alert selectors
            const selectors = [
                '.toast-message', '.toastr', '.alert', '.alert-danger', '.alert-warning',
                '.sweet-alert', '.swal2-container', '.help-block', '.text-danger',
                '.modal-body', '.notification', '[ng-show*="error"]', '[ng-if*="error"]'
            ];
            selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    const text = el.innerText.trim();
                    if (text && el.offsetWidth > 0 && el.offsetHeight > 0) {
                        msgs.push({ selector: sel, text: text });
                    }
                });
            });
            // Also check for any visible text containing error/incorrecto/bloque/invalido
            return msgs;
        }""")

        # Also find base API URL from captured URLs
        for u in api_urls:
            if "/m/rest/" in u or "/rest/" in u or "/api/" in u:
                m = re.match(r'(https?://[^/]+/[^/]+/(m/rest|rest|api))', u)
                if m:
                    result["api_base_url"] = m.group(1)
                    break

        if "#!/login" in current_url:
            print("Still on login page. Login failed or requires additional action.")
            result["login_status"] = "FALLIDO"
            
            # Look for exact text visible in message containers
            exact_msg = ""
            for m in messages:
                exact_msg += f"[{m['selector']}] {m['text']}\n"
            
            # If no standard container found, grab any visible text on form
            if not exact_msg:
                form_text = await page.evaluate("""() => {
                    const form = document.querySelector('form');
                    return form ? form.innerText : '';
                }""")
                exact_msg = form_text.strip()

            result["error_message"] = exact_msg
            
            # Check for counter or lockout keywords
            counter_match = re.search(r'(\d+)\s*(intentos?|veces|bloque|segundos|minutos)', exact_msg, re.IGNORECASE)
            result["lockout_or_counter"] = counter_match.group(0) if counter_match else "No se observó contador ni aviso explícito de bloqueo."
            
            print(f"Error message detected:\n{exact_msg}")
            print(f"Lockout / counter: {result['lockout_or_counter']}")

        else:
            print(f"Login SUCCESSFUL! Navigated to {current_url}")
            result["login_status"] = "EXITOSO"

            # Check if there is an active popup / modal (e.g., apertura de caja)
            modal_info = await page.evaluate("""() => {
                const modal = document.querySelector('.modal.in, .modal.show, .swal2-modal, .sweet-alert.showSweetAlert');
                if (modal && modal.offsetWidth > 0) {
                    return modal.innerText.trim();
                }
                return null;
            }""")
            if modal_info:
                print(f"Modal detected: {modal_info[:200]}")
                result["modal_detected"] = modal_info

            # Explore navigation menu (expand dropdowns if needed)
            # Find menu items
            menu_data = await page.evaluate("""() => {
                const tree = [];
                // Find main navigation bar / sidebar
                const nav = document.querySelector('nav, #side-menu, .metismenu, .navbar-default, .sidebar-collapse');
                if (!nav) return [{ error: 'No se encontró contenedor principal de navegación' }];

                // Check all menu items
                const items = nav.querySelectorAll('li');
                items.forEach(li => {
                    const link = li.querySelector('a');
                    if (!link) return;
                    
                    // We only want top-level or direct items
                    const parentLi = li.parentElement.closest('li');
                    if (parentLi) return; // will be handled as child

                    const titleEl = link.querySelector('.nav-label, span') || link;
                    const title = titleEl.innerText.trim();
                    if (!title) return;

                    // Check for subitems
                    const subUl = li.querySelector('ul');
                    const subItems = [];
                    if (subUl) {
                        subUl.querySelectorAll('li a').forEach(subA => {
                            const subText = subA.innerText.trim();
                            if (subText) {
                                subItems.push({
                                    title: subText,
                                    href: subA.getAttribute('href') || ''
                                });
                            }
                        });
                    }

                    tree.push({
                        title: title,
                        href: link.getAttribute('href') || '',
                        submodules: subItems
                    });
                });
                return tree;
            }""")
            result["menu_tree"] = menu_data
            print("Extracted navigation menu tree:")
            print(json.dumps(menu_data, indent=2, ensure_ascii=False))

            # Take screenshot of menu ONLY
            sidebar = page.locator('#side-menu, .sidebar-collapse, nav.navbar-default').first
            try:
                if await sidebar.count() > 0 and await sidebar.is_visible():
                    await sidebar.screenshot(path="/home/jose/JoseEM/caprichos/web-anterior/administrativo/menu_screenshot.png")
                    print("Saved menu screenshot to menu_screenshot.png")
                else:
                    await page.screenshot(path="/home/jose/JoseEM/caprichos/web-anterior/administrativo/menu_screenshot.png", clip={"x": 0, "y": 0, "width": 300, "height": 800})
                    print("Saved viewport screenshot of menu area.")
            except Exception as e:
                print(f"Could not take screenshot: {e}")

            # Check for clear logout button
            logout_btn = await page.evaluate("""() => {
                const links = Array.from(document.querySelectorAll('a, button'));
                const exitLink = links.find(el => {
                    const t = (el.innerText || '').toLowerCase();
                    return t.includes('cerrar sesión') || t.includes('salir') || t.includes('logout');
                });
                return exitLink ? { text: exitLink.innerText.trim(), href: exitLink.getAttribute('href') } : null;
            }""")
            print(f"Logout option found: {logout_btn}")
            if logout_btn:
                print("Clicking logout button to safely end session...")
                try:
                    await page.click('text="Cerrar sesión"', timeout=3000)
                except Exception:
                    try:
                        await page.click('text="Salir"', timeout=3000)
                    except Exception:
                        pass
                await page.wait_for_timeout(2000)

        await browser.close()

    # Save output to json for modulos.md generation
    with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/execution_result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print("Results saved to execution_result.json")

if __name__ == "__main__":
    asyncio.run(run_login_attempt())
