import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"Navigating to {url}...")
        response = await page.goto(url, wait_until="networkidle")
        print(f"Current URL: {page.url}")
        
        # Check title and content
        title = await page.title()
        print(f"Page Title: {title}")
        
        # Check inputs
        inputs = await page.query_selector_all("input")
        print(f"Found {len(inputs)} inputs:")
        for idx, inp in enumerate(inputs):
            inp_type = await inp.get_attribute("type")
            inp_name = await inp.get_attribute("name")
            inp_id = await inp.get_attribute("id")
            inp_placeholder = await inp.get_attribute("placeholder")
            inp_model = await inp.get_attribute("ng-model")
            print(f"  [{idx}] type={inp_type}, name={inp_name}, id={inp_id}, placeholder={inp_placeholder}, ng-model={inp_model}")
            
        # Check buttons
        buttons = await page.query_selector_all("button, input[type='submit']")
        print(f"Found {len(buttons)} buttons/submits:")
        for idx, btn in enumerate(buttons):
            text = (await btn.inner_text()).strip() if await btn.get_attribute("type") != "submit" else await btn.get_attribute("value")
            btn_type = await btn.get_attribute("type")
            print(f"  [{idx}] text='{text}', type={btn_type}")
            
        # Check AngularJS or other libraries in window
        framework_info = await page.evaluate("""() => {
            const info = {};
            if (window.angular) {
                info.angular = window.angular.version ? window.angular.version.full : true;
            }
            if (window.jQuery) {
                info.jquery = window.jQuery.fn.jquery;
            }
            return info;
        }""")
        print("Framework info:", framework_info)
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
