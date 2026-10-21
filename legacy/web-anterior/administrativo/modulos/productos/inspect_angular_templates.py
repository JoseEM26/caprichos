import asyncio
import os
import json
from playwright.async_api import async_playwright

async def inspect_module():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD not set")
        return

    out_dir = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/productos"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1600, "height": 1000})
        page = await context.new_page()

        print("Navigating to login...")
        await page.goto("https://caprichos.restaurant.pe/restaurant/#!/login", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(4000)

        print("Entering credentials...")
        await page.locator('input[name="usuario_nick"]').fill(user)
        await page.wait_for_timeout(500)
        await page.locator('input[name="usuario_clave"]').fill(password)
        await page.wait_for_timeout(500)

        print("Submitting login...")
        await page.locator('button[type="submit"]').click()

        logged_in = False
        for _ in range(30):
            await page.wait_for_timeout(500)
            if "#!/login" not in page.url:
                logged_in = True
                print("Login successful:", page.url)
                break

        if not logged_in:
            print("Failed to log in")
            await browser.close()
            return

        await page.wait_for_timeout(3000)

        # Extract all templates from $templateCache via injector
        print("Extracting templateCache...")
        extracted_templates = await page.evaluate("""() => {
            const el = document.querySelector('[ng-app]') || document.body;
            const injector = angular.element(el).injector();
            const $templateCache = injector.get('$templateCache');
            const $http = injector.get('$http');
            
            // $templateCache info
            const cacheInfo = $templateCache.info();
            // To get keys, $templateCache in AngularJS doesn't have an explicit keys() method by default,
            // but we can query known keys or inspect the internal cache object if accessible.
            // Let's see if we can get keys from the cache object:
            // In AngularJS $cacheFactory, cache.get(id) works, and internal items are in cache (depending on version).
            // Let's test accessing keys:
            let keys = [];
            // In angular $cacheFactory, the cache function object has get, put, remove, removeAll, destroy, info.
            // But let's check if there is an internal data object or if we can pass a list of known paths.
            return {
                cacheId: cacheInfo.id,
                cacheSize: cacheInfo.size
            };
        }""")
        print("TemplateCache info:", extracted_templates)

        # Let's read the list of known template paths we found earlier and extract each via $templateCache.get()!
        known_templates = [
            "scripts/restaurantpe/productos/productos.view.html",
            "scripts/restaurantpe/productos/selector.html",
            "scripts/restaurantpe/productos/breadcrumb-productos.html",
            "scripts/restaurantpe/productos/categorias/arbol/categoria.arbol.view.html",
            "scripts/restaurantpe/productos/categorias/form/categoria.form.view.html",
            "scripts/restaurantpe/productos/categorias/form/categoria.view.html",
            "scripts/restaurantpe/productos/categorias/modals/modal-asignarimpuestos.html",
            "scripts/restaurantpe/productos/categorias/modals/modalNewCategoriaDelivery.view.html",
            "scripts/restaurantpe/productos/platos/lista/platos.lista.view.html",
            "scripts/restaurantpe/productos/platos/ver/platos.ver.html",
            "scripts/restaurantpe/productos/platos/ver/platos.ver.info.html",
            "scripts/restaurantpe/productos/platos/ver/platos.ver.presentaciones.html",
            "scripts/restaurantpe/productos/platos/editar/platos.editar.full.html",
            "scripts/restaurantpe/productos/platos/editar/platos.editar.full2.html",
            "scripts/restaurantpe/productos/platos/editar/platos.editar.rapido.html",
            "scripts/restaurantpe/productos/platos/presentacion/presentacion.lista.view.html",
            "scripts/restaurantpe/productos/platos/presentacion/presentacion.tab.view.html",
            "scripts/restaurantpe/productos/platos/presentacion/presentacion.full.view.html",
            "scripts/restaurantpe/productos/platos/presentacion/presentacion.full.editar.view.html",
            "scripts/restaurantpe/productos/platos/presentacion/presentacion.full.ingredientes.view.html",
            "scripts/restaurantpe/productos/platos/presentacion/presentacion.full.no.transformado.ingredientes.view.html",
            "scripts/restaurantpe/productos/platos/presentacion/presentacion.full.productos.llevar.view.html",
            "scripts/restaurantpe/productos/platos/presentacion/modals/modal-actualizaareaproduccionsucursales.html",
            "scripts/restaurantpe/productos/platos/presentacion/modals/modal-actualizapreciosucursales.html",
            "scripts/restaurantpe/productos/platos/presentacion/modals/modal-actualizaproductogeneralcategoria.html",
            "scripts/restaurantpe/productos/platos/presentacion/modals/modal-actualizarpropiedadesproducto.html",
            "scripts/restaurantpe/productos/platos/modals/modalAgregarModificadores.view.html",
            "scripts/restaurantpe/productos/platos/modals/modificador.view.html",
            "scripts/restaurantpe/productos/platos/modals/vinculacionmodificadorseleccion.view.html",
            "scripts/restaurantpe/productos/modals/modalActualizacionRapida.html",
            "scripts/restaurantpe/productos/modals/modalFormatoActualizarPrecios.html",
            "scripts/restaurantpe/productos/modals/modalFormatoCartaImagen.html",
            "scripts/restaurantpe/productos/modals/modalImportarProductosBDMaster.html",
            "scripts/restaurantpe/productos/modals/modalSelectorModoProductoAgotado.html",
            "scripts/restaurantpe/productos/modals/modaRegistroRapido.html",
            "scripts/restaurantpe/productos/modals/listaalmacenescontrolstock.html",
            "scripts/restaurantpe/productos/modificadores/modificadores.view.html",
            "scripts/restaurantpe/productos/modificadores/lista/modificadores.lista.view.html",
            "scripts/restaurantpe/productos/modificadores/nuevo/agrupador-nuevo.html",
            "scripts/restaurantpe/productos/modificadores/nuevo/modificador-nuevo.html",
            "scripts/restaurantpe/productos/modificadores/modificadorseleccion/modificadores.gestion.html",
            "scripts/restaurantpe/productos/modificadores/modificadorseleccion/vinculacion-modificador.gestion.html",
            "scripts/restaurantpe/productos/modificadores/ver/insumosmodificador.lista.html",
            "scripts/restaurantpe/productos/insumos/insumos.view.html",
            "scripts/restaurantpe/productos/insumos/lista/insumos.lista.view.html",
            "scripts/restaurantpe/productos/insumos/normal/insumos-ver.html",
            "scripts/restaurantpe/productos/insumos/normal/insumos-editar.html",
            "scripts/restaurantpe/productos/insumos/nuevo/insumos-nuevo.html",
            "scripts/restaurantpe/productos/insumos/receta/recetas-detalle.html",
            "scripts/restaurantpe/productos/insumos/receta/recetas-nodo.html",
            "scripts/restaurantpe/productos/insumos/porcionable/porcion-detalle.html",
            "scripts/restaurantpe/productos/insumos/porcionable/porcion-nodo.html",
            "scripts/restaurantpe/productos/combos/combos.view.html",
            "scripts/restaurantpe/productos/combos/nuevo/combos.nuevo.view.html",
            "scripts/restaurantpe/productos/combos/editar/combos.editar.view.html",
            "scripts/restaurantpe/productos/productodescartable/descartables.view.html",
            "scripts/restaurantpe/productos/productodescartable/lista/descartables.lista.view.html",
            "scripts/restaurantpe/productos/menus/programacion/programacion.html",
            "scripts/restaurantpe/productos/menus/programacion/dia/dia.html",
            "scripts/restaurantpe/productos/productosugerido/productosugerido.view.html",
            "scripts/restaurantpe/productos/productosugerido/components/porcategorias/vistaporcategorias.view.html",
            "scripts/restaurantpe/productos/productosugerido/components/porproducto/vistaporproducto.view.html"
        ]

        templates_content = await page.evaluate("""(paths) => {
            const el = document.querySelector('[ng-app]') || document.body;
            const injector = angular.element(el).injector();
            const $templateCache = injector.get('$templateCache');
            const res = {};
            paths.forEach(p => {
                const val = $templateCache.get(p);
                if (val) {
                    res[p] = val;
                }
            });
            return res;
        }""", known_templates)

        print(f"Successfully retrieved {len(templates_content)} templates from $templateCache!")

        # Save templates into files
        tpl_dir = os.path.join(out_dir, "angular_templates")
        os.makedirs(tpl_dir, exist_ok=True)
        for k, v in templates_content.items():
            fname = k.replace("/", "_").replace("\\", "_")
            with open(os.path.join(tpl_dir, fname), "w", encoding="utf-8") as f:
                f.write(v)

        # Now navigate to #!/productos/platos/categoria/All to inspect live UI elements and data structure
        await page.wait_for_timeout(2000)
        print("Navigating to #!/productos/platos/categoria/All...")
        await page.goto("https://caprichos.restaurant.pe/restaurant/#!/productos/platos/categoria/All", wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)

        # Inspect current state scope / data structure (without personal data)
        scope_info = await page.evaluate("""() => {
            const res = {
                buttons: [],
                columns: [],
                filters: [],
                tabs: [],
                selects: [],
                modals: []
            };
            // Tabs in top bar
            document.querySelectorAll('.nav-tabs li a, .nav-pills li a, .top-navigation a').forEach(a => {
                const t = a.innerText.trim();
                const h = a.getAttribute('href') || a.getAttribute('ui-sref') || '';
                if (t) res.tabs.push({ text: t, href: h });
            });
            // Table columns
            document.querySelectorAll('table th').forEach(th => {
                const t = th.innerText.trim();
                if (t) res.columns.push(t);
            });
            // Buttons
            document.querySelectorAll('button, a.btn').forEach(btn => {
                const t = btn.innerText.trim();
                const title = btn.getAttribute('title') || '';
                const click = btn.getAttribute('ng-click') || '';
                if (t || title) res.buttons.push({ text: t, title: title, ngClick: click });
            });
            // Inputs / Filters
            document.querySelectorAll('input, select').forEach(inp => {
                res.filters.push({
                    tag: inp.tagName.toLowerCase(),
                    type: inp.type || '',
                    name: inp.name || '',
                    placeholder: inp.placeholder || '',
                    ngModel: inp.getAttribute('ng-model') || '',
                    id: inp.id || ''
                });
            });
            return res;
        }""")

        with open(os.path.join(out_dir, "live_screen_scope.json"), "w", encoding="utf-8") as f:
            json.dump(scope_info, f, indent=2, ensure_ascii=False)

        # Now navigate safely to #!/productos/insumos/categoria/All/0/1/nombre (Insumos subtab) to check its live structure
        await page.wait_for_timeout(2000)
        print("Navigating to Insumos tab...")
        await page.goto("https://caprichos.restaurant.pe/restaurant/#!/productos/insumos/categoria/All/0/1/nombre", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        insumos_scope = await page.evaluate("""() => {
            return {
                title: document.title,
                columns: Array.from(document.querySelectorAll('table th')).map(th => th.innerText.trim()),
                buttons: Array.from(document.querySelectorAll('button, a.btn')).map(b => b.innerText.trim() || b.getAttribute('title') || ''),
                inputs: Array.from(document.querySelectorAll('input, select')).map(i => ({
                    placeholder: i.placeholder || '',
                    ngModel: i.getAttribute('ng-model') || '',
                    type: i.type || i.tagName.toLowerCase()
                }))
            };
        }""")
        with open(os.path.join(out_dir, "live_insumos_scope.json"), "w", encoding="utf-8") as f:
            json.dump(insumos_scope, f, indent=2, ensure_ascii=False)

        # Safe logout
        await page.wait_for_timeout(2000)
        print("Logging out safely...")
        try:
            await page.evaluate("""() => {
                const links = Array.from(document.querySelectorAll('a, button'));
                const exitLink = links.find(el => {
                    const t = (el.innerText || '').toLowerCase();
                    return t.includes('cerrar sesión') || t.includes('salir');
                });
                if (exitLink) exitLink.click();
            }""")
            await page.wait_for_timeout(2000)
        except Exception as e:
            print("Logout error:", e)

        await browser.close()
        print("Inspection completed cleanly.")

if __name__ == "__main__":
    asyncio.run(inspect_module())
