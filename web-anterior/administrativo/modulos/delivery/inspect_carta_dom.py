import asyncio
import json
from playwright.async_api import async_playwright

async def inspect_dom():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        await page.goto("https://caprichos.restaurant.pe/carta-digital/#/inicio", wait_until="networkidle", timeout=45000)
        await page.wait_for_timeout(4000)

        html = await page.content()
        # Save HTML for inspection
        with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/carta_digital_dom.html", "w", encoding="utf-8") as f:
            f.write(html)

        # Inspect visible text and elements
        info = await page.evaluate("""() => {
            const allElements = document.querySelectorAll('*');
            const customTags = new Set();
            allElements.forEach(el => {
                if (el.tagName.includes('-')) {
                    customTags.add(el.tagName.toLowerCase());
                }
            });
            return {
                custom_tags: Array.from(customTags),
                all_text: document.body.innerText,
                inputs: Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
                    tag: el.tagName,
                    type: el.type,
                    placeholder: el.placeholder,
                    id: el.id,
                    className: el.className,
                    name: el.name,
                    value: el.value
                })),
                clickable: Array.from(document.querySelectorAll('button, a, [role="button"], .clickable, .card, .btn')).map(el => ({
                    tag: el.tagName,
                    text: el.innerText.trim(),
                    className: el.className
                }))
            };
        }""")

        with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/carta_digital_elements.json", "w", encoding="utf-8") as f:
            json.dump(info, f, indent=2, ensure_ascii=False)
        print("DOM inspected and saved.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_dom())
