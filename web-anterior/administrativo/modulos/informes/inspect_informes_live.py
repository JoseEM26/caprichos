import asyncio
import os
import sys
import json
import re
from playwright.async_api import async_playwright

async def inspect_live():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD environment variable not set.", file=sys.stderr)
        return

    report_data = {
        "screens": {},
        "network_endpoints": []
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        def handle_route_request(req):
            if any(k in req.url.lower() for k in ["rest", "api"]):
                url_clean = req.url.split("?")[0]
                # filter out sensitive tokens or data
                report_data["network_endpoints"].append({
                    "method": req.method,
                    "url": url_clean
                })

        page.on("request", handle_route_request)

        # 1. Login
        target_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"Navigating to {target_url}...")
        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        
        print("Waiting 4 seconds for dropdowns to initialize...")
        await page.wait_for_timeout(4000)

        user_input = page.locator('input[name="usuario_nick"]')
        pass_input = page.locator('input[name="usuario_clave"]')
        await user_input.fill(user)
        await page.wait_for_timeout(500)
        await pass_input.fill(password)
        await page.wait_for_timeout(500)

        login_btn = page.locator('button[type="submit"]')
        print("Clicking login once...")
        await login_btn.click()

        logged_in = False
        for sec in range(1, 16):
            await page.wait_for_timeout(1000)
            if "#!/login" not in page.url:
                print(f"Login success at second {sec}: {page.url}")
                logged_in = True
                break

        if not logged_in:
            print(f"Login failed or took too long. Current URL: {page.url}")
            await browser.close()
            return

        await page.wait_for_timeout(2000)

        # Helper to extract structure from current page
        async def extract_current_screen_structure(screen_id, name):
            print(f"\n[EXTRACT] Analyzing screen '{name}' ({page.url})...")
            # Wait 2 seconds for Angular render
            await page.wait_for_timeout(2500)

            dom_info = await page.evaluate("""() => {
                const info = {
                    title: "",
                    headings: [],
                    filters: [],
                    buttons: [],
                    table_headers: [],
                    export_buttons: [],
                    alerts: []
                };

                // Title / Headings
                const h1s = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, .page-heading'));
                info.headings = h1s.map(h => h.innerText.trim()).filter(t => t.length > 0 && t.length < 100);
                if (h1s.length > 0) info.title = h1s[0].innerText.trim();

                // Form controls / Filters
                const controls = Array.from(document.querySelectorAll('input, select, textarea, ui-select, .ui-select-container'));
                controls.forEach(c => {
                    // Try to find label or placeholder
                    let label = "";
                    let id = c.id || c.getAttribute('name') || c.getAttribute('ng-model') || '';
                    if (c.id) {
                        const lbl = document.querySelector(`label[for="${c.id}"]`);
                        if (lbl) label = lbl.innerText.trim();
                    }
                    if (!label) {
                        const parentLbl = c.closest('.form-group, .form-inline, td, th');
                        if (parentLbl) {
                            const lblEl = parentLbl.querySelector('label');
                            if (lblEl) label = lblEl.innerText.trim();
                        }
                    }
                    const placeholder = c.getAttribute('placeholder') || c.getAttribute('aria-label') || '';
                    const tag = c.tagName.toLowerCase();
                    const type = c.getAttribute('type') || (tag === 'select' ? 'select' : (tag.includes('select') ? 'ui-select' : 'text'));
                    const ngModel = c.getAttribute('ng-model') || '';

                    // For select, get option labels (without values/counts)
                    let options = [];
                    if (tag === 'select') {
                        options = Array.from(c.querySelectorAll('option')).map(o => o.text.trim()).filter(o => o.length > 0);
                    }

                    info.filters.push({
                        id: id,
                        tag: tag,
                        type: type,
                        label: label,
                        placeholder: placeholder,
                        ngModel: ngModel,
                        options: options.slice(0, 15)
                    });
                });

                // Buttons
                const btns = Array.from(document.querySelectorAll('button, .btn, a.btn, [role="button"]'));
                btns.forEach(b => {
                    const text = b.innerText.trim();
                    const title = b.getAttribute('title') || b.getAttribute('uib-tooltip') || '';
                    const icon = b.querySelector('i') ? b.querySelector('i').className : '';
                    if (text || title || icon) {
                        const btnDesc = {
                            text: text.replace(/\\n/g, ' ').trim(),
                            title: title,
                            icon: icon,
                            ngClick: b.getAttribute('ng-click') || '',
                            uiSref: b.getAttribute('ui-sref') || ''
                        };
                        // Detect if export button
                        if (text.toLowerCase().includes('excel') || text.toLowerCase().includes('pdf') || 
                            text.toLowerCase().includes('descargar') || text.toLowerCase().includes('exportar') ||
                            icon.includes('file-excel') || icon.includes('file-pdf') || icon.includes('download')) {
                            info.export_buttons.push(btnDesc);
                        } else {
                            info.buttons.push(btnDesc);
                        }
                    }
                });

                // Tables
                const tables = Array.from(document.querySelectorAll('table'));
                tables.forEach((t, tIdx) => {
                    const ths = Array.from(t.querySelectorAll('thead th, th'));
                    const headers = ths.map(th => th.innerText.replace(/\\n/g, ' ').trim()).filter(h => h.length > 0);
                    if (headers.length > 0) {
                        info.table_headers.push({
                            table_index: tIdx,
                            columns: headers
                        });
                    }
                });

                // Alerts
                const alerts = Array.from(document.querySelectorAll('.alert, .panel-transparent'));
                info.alerts = alerts.map(a => a.innerText.trim()).filter(a => a.length > 0 && a.length < 200);

                return info;
            }""")

            report_data["screens"][screen_id] = {
                "name": name,
                "url": page.url,
                "dom": dom_info
            }
            print(f"Done extracting '{name}'. Headings: {len(dom_info['headings'])}, Filters: {len(dom_info['filters'])}, Buttons: {len(dom_info['buttons'])}, Columns: {len(dom_info['table_headers'])}")

        # List of routes to inspect (1 per second max, 2.5s pause)
        target_routes = [
            ("informes_hub", "Hub Principal de Informes", "https://caprichos.restaurant.pe/restaurant/#!/informes"),
            ("informes_ventas_menu", "Menú de Informes de Ventas", "https://caprichos.restaurant.pe/restaurant/#!/informes/ventas"),
            ("informes_ventas_todas", "Todas las Ventas", "https://caprichos.restaurant.pe/restaurant/#!/informes/ventas/todas"),
            ("informes_ventas_anuladas", "Ventas Anuladas", "https://caprichos.restaurant.pe/restaurant/#!/informes/ventas/ventasanuladas"),
            ("informes_ventas_porproducto", "Ventas por Producto o Categoría", "https://caprichos.restaurant.pe/restaurant/#!/informes/ventas/producto"),
            ("informes_ventas_porformadepago", "Ventas por Forma de Pago", "https://caprichos.restaurant.pe/restaurant/#!/informes/ventas/porformadepago"),
            ("informes_ventas_pormozo", "Ventas por Mozo y Cajero", "https://caprichos.restaurant.pe/restaurant/#!/informes/ventas/pormozo"),
            ("informes_ventas_deliverysvendidos", "Deliverys Vendidos", "https://caprichos.restaurant.pe/restaurant/#!/informes/ventas/deliverysvendidos"),
            ("informes_finanzas_menu", "Menú de Informes de Finanzas", "https://caprichos.restaurant.pe/restaurant/#!/informes/finanzas"),
            ("informes_finanzas_resumen", "Cierres de Caja (Finanzas)", "https://caprichos.restaurant.pe/restaurant/#!/informes/finanzas/resumen"),
            ("informes_finanzas_ingresos", "Ingresos Extras", "https://caprichos.restaurant.pe/restaurant/#!/informes/finanzas/ingresos"),
            ("informes_finanzas_egresos", "Egresos Extras", "https://caprichos.restaurant.pe/restaurant/#!/informes/finanzas/egresos"),
            ("informes_inventario_menu", "Menú de Informes de Inventario", "https://caprichos.restaurant.pe/restaurant/#!/informes/inventario"),
            ("informes_inventario_catalogo", "Catálogo de Productos/Insumos", "https://caprichos.restaurant.pe/restaurant/#!/informes/inventario/catalogo"),
            ("informes_inventario_stockvalorizado", "Stock Valorizado", "https://caprichos.restaurant.pe/restaurant/#!/informes/inventario/stockvalorizado"),
            ("informes_compras_menu", "Menú de Informes de Compras", "https://caprichos.restaurant.pe/restaurant/#!/informes/compras"),
            ("informes_compras_todas", "Todas las Compras", "https://caprichos.restaurant.pe/restaurant/#!/informes/compras/todas"),
            ("informes_gerenciales_menu", "Menú de Reportes Consolidados/Gerenciales", "https://caprichos.restaurant.pe/restaurant/#!/informes/gerenciales"),
            ("indicadores_dashboard", "Tablero de Indicadores Gráficos (KPIs)", "https://caprichos.restaurant.pe/restaurant/#!/indicadores")
        ]

        for s_id, s_name, s_url in target_routes:
            print(f"\n---> Navegando a {s_name} ({s_url})...")
            await page.goto(s_url, wait_until="domcontentloaded", timeout=40000)
            await extract_current_screen_structure(s_id, s_name)
            # Sleep 2 seconds strictly before next navigation
            await page.wait_for_timeout(2000)

        # Cerrar sesión de manera limpia al finalizar
        print("\nFinalizando auditoría. Cerrando sesión...")
        try:
            logout_btn = page.locator('a:has-text("Cerrar sesión"), button:has-text("Cerrar sesión")')
            if await logout_btn.count() > 0:
                await logout_btn.first.click()
                await page.wait_for_timeout(2000)
                print("Sesión cerrada exitosamente.")
            else:
                # Direct navigation or look for dropdown
                print("Buscando enlace de usuario para cerrar sesión...")
                user_menu = page.locator('.dropdown-toggle:has-text("krosales"), .profile-element')
                if await user_menu.count() > 0:
                    await user_menu.first.click()
                    await page.wait_for_timeout(500)
                    logout_link = page.locator('a:has-text("Cerrar sesión")')
                    if await logout_link.count() > 0:
                        await logout_link.first.click()
                        await page.wait_for_timeout(2000)
                        print("Sesión cerrada mediante menú desplegable.")
        except Exception as e:
            print(f"Aviso durante el cierre de sesión: {e}")

        await browser.close()

    # Save output to json
    out_file = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/informes/live_inspection.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2, ensure_ascii=False)
    print(f"\nInspección completada con éxito. Datos guardados en {out_file}")

if __name__ == "__main__":
    asyncio.run(inspect_live())
