import asyncio
import json
from playwright.async_api import async_playwright

async def inspect_page():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        api_calls = []
        def on_request(req):
            if "/api/" in req.url or "ajax" in req.url or "/rest/" in req.url or "php" in req.url:
                api_calls.append(req.url)
        page.on("request", on_request)

        url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"Loading {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        
        # Wait a bit for AngularJS to render
        await page.wait_for_timeout(5000)
        
        title = await page.title()
        current_url = page.url
        print(f"Title: {title}")
        print(f"Current URL: {current_url}")
        
        # Inspect forms and fields
        fields_data = await page.evaluate("""() => {
            const results = [];
            const elements = document.querySelectorAll('input, select, textarea');
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
                results.push({
                    tag: el.tagName.toLowerCase(),
                    type: el.type || '',
                    name: el.name || '',
                    id: el.id || '',
                    placeholder: el.placeholder || '',
                    value: el.type === 'password' ? '[REDACTED]' : el.value,
                    ng_model: el.getAttribute('ng-model') || '',
                    disabled: el.disabled,
                    readonly: el.readOnly,
                    visible: visible,
                    className: el.className
                });
            });
            return results;
        }""")
        
        buttons_data = await page.evaluate("""() => {
            const results = [];
            const elements = document.querySelectorAll('button, input[type="submit"], a.btn');
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                const visible = rect.width > 0 && rect.height > 0;
                results.push({
                    tag: el.tagName.toLowerCase(),
                    text: el.innerText.trim(),
                    type: el.type || '',
                    id: el.id || '',
                    visible: visible,
                    className: el.className
                });
            });
            return results;
        }""")
        
        tech_data = await page.evaluate("""() => {
            const info = {};
            if (window.angular) {
                info.angular = window.angular.version ? window.angular.version.full : true;
            }
            if (window.jQuery) {
                info.jquery = window.jQuery.fn ? window.jQuery.fn.jquery : true;
            }
            return info;
        }""")
        
        print("\n--- TECH DATA ---")
        print(json.dumps(tech_data, indent=2))
        
        print("\n--- FORM FIELDS ---")
        print(json.dumps(fields_data, indent=2))
        
        print("\n--- BUTTONS ---")
        print(json.dumps(buttons_data, indent=2))
        
        print("\n--- API / HTTP REQUESTS ---")
        print(json.dumps(api_calls[:20], indent=2))
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_page())
