import asyncio
import os
import json
import re
from playwright.async_api import async_playwright

MODULE_ROUTES = [
    # Escritorio
    {"module": "Escritorio", "submodule": "Resumen", "route": "#!/"},
    {"module": "Escritorio", "submodule": "Novedades", "route": "#!/novedades"},
    # Ventas
    {"module": "Ventas", "submodule": "Pedidos en caja", "route": "#!/ventas/hacer-pedidos/salones"},
    {"module": "Ventas", "submodule": "Pedidos Multimozo", "route": "#!/ventas/multimozo"},
    {"module": "Ventas", "submodule": "Pantalla de cocina", "route": "#!/ventas/ver-pedidos/estado"},
    # Caja
    {"module": "Caja", "submodule": "Cobrar", "route": "#!/caja/cobrar/salones"},
    {"module": "Caja", "submodule": "Apertura y cierre", "route": "#!/caja/apertura-cierre"},
    {"module": "Caja", "submodule": "Cierre caja Z", "route": "#!/caja/cierre-caja-z"},
    {"module": "Caja", "submodule": "Cierres de caja", "route": "#!/caja/movimientos"},
    {"module": "Caja", "submodule": "Ingresos", "route": "#!/caja/ingresos"},
    {"module": "Caja", "submodule": "Egresos", "route": "#!/caja/egresos"},
    {"module": "Caja", "submodule": "Notas de credito", "route": "#!/caja/Notas-Credito"},
    {"module": "Caja", "submodule": "Notas de debito", "route": "#!/caja/Notas-Debito"},
    {"module": "Caja", "submodule": "Monitor de ventas", "route": "#!/caja/monitorcaja"},
    {"module": "Caja", "submodule": "Consulta de precios", "route": "#!/informes/inventario/productos-con-precio"},
    # Reservas
    {"module": "Reservas", "submodule": "Reservas", "route": "#!/reservas/principal"},
    # Créditos
    {"module": "Créditos", "submodule": "Cobro de ventas", "route": "#!/creditos/ventacreditos"},
    {"module": "Créditos", "submodule": "Pago de compras", "route": "#!/creditos/compracreditos"},
    # Clientes
    {"module": "Clientes", "submodule": "Clientes", "route": "#!/clientes"},
    {"module": "Clientes", "submodule": "Debito", "route": "#!/clientes/debito"},
    # Productos
    {"module": "Productos", "submodule": "Productos", "route": "#!/productos/platos/categoria/All"},
    # Ofertas
    {"module": "Ofertas", "submodule": "Ofertas", "route": "#!/ofertas/sucursales/2en1/1/categoria/All"},
    # Descuentos
    {"module": "Descuentos", "submodule": "Descuentos", "route": "#!/descuentos"},
    {"module": "Descuentos", "submodule": "Cupón descuento", "route": "#!/ajustes/cupondescuento"},
    {"module": "Descuentos", "submodule": "Promociones y sorteos", "route": "#!/promocionsorteo"},
    {"module": "Descuentos", "submodule": "Vales de Pago", "route": "#!/ajustes/valedepago"},
    # Compras
    {"module": "Compras", "submodule": "Proveedores", "route": "#!/compras/proveedores"},
    {"module": "Compras", "submodule": "Lotizar compras", "route": "#!/compras/lotes"},
    {"module": "Compras", "submodule": "Ajustes", "route": "#!/compras/ajustes/banco"},
    # Almacén
    {"module": "Almacén", "submodule": "Movimiento interno", "route": "#!/almacen/requerimientomovimiento/requerimientos/movimiento"},
    {"module": "Almacén", "submodule": "Requerimiento", "route": "#!/almacen/requerimientomovimiento/requerimientos/nuevo-requerimiento"},
    {"module": "Almacén", "submodule": "Recepción", "route": "#!/almacen/requerimientomovimiento/requerimientos/nuevo-recepcion"},
    {"module": "Almacén", "submodule": "Lista de procesos", "route": "#!/almacen/requerimientomovimiento/requerimientos/lista-de-proceso"},
    # Delivery
    {"module": "Delivery", "submodule": "Call center", "route": "#!/ventas/callcenter"},
    {"module": "Delivery", "submodule": "Tu restaurant en facebook", "route": "#!/delivery"},
    {"module": "Delivery", "submodule": "Zona de reparto", "route": "#!/ajustes/zonareparto"},
    {"module": "Delivery", "submodule": "Ajustes", "route": "#!/delivery/ajustes/motorizado"},
    {"module": "Delivery", "submodule": "Resumen", "route": "#!/resumen/delivery"},
    {"module": "Delivery", "submodule": "Zona de reparto (cobertura)", "route": "#!/informes/ventas/deliverys-cobertura"},
    {"module": "Delivery", "submodule": "Zona de reparto (Mapa de calor)", "route": "#!/informes/ventas/deliverys-cobertura/mapa"},
    {"module": "Delivery", "submodule": "Reclamos", "route": "#!/ventas/callcenter/reclamo"},
    {"module": "Delivery", "submodule": "Frecuencia", "route": "#!/informes/ventas/deliverys-frecuencia"},
    # Informes
    {"module": "Informes", "submodule": "Informes", "route": "#!/informes"},
    # Indicadores
    {"module": "Indicadores", "submodule": "Indicadores", "route": "#!/indicadores"},
    # Mi restaurant
    {"module": "Mi restaurant", "submodule": "Mi empresa", "route": "#!/mirestaurante/miempresa"},
    {"module": "Mi restaurant", "submodule": "Facturación Electrónica", "route": "#!/ajustes/facturacionelectronica"},
    {"module": "Mi restaurant", "submodule": "Series de contingencia", "route": "#!/ajustes/serie-contingencia"},
    {"module": "Mi restaurant", "submodule": "Integraciones", "route": "#!/ajustes/integraciones"},
    {"module": "Mi restaurant", "submodule": "Integración POS", "route": "#!/ajustes/pos"},
    {"module": "Mi restaurant", "submodule": "Contrato", "route": "#!/ajustes/contrato"},
    # Ajustes (excluyendo 'Usuarios' por instrucción explícita)
    {"module": "Ajustes", "submodule": "Opciones sistema", "route": "#!/ajustes/opcionessistema"},
    {"module": "Ajustes", "submodule": "Opciones de APP Quipu", "route": "#!/ajustes/configuracionpos"},
    {"module": "Ajustes", "submodule": "Configuración regional", "route": "#!/ajustes/configuracionregional"},
    {"module": "Ajustes", "submodule": "Locales", "route": "#!/ajustes/locales"},
    {"module": "Ajustes", "submodule": "Almacenes y Producción", "route": "#!/ajustes/produccion"},
    {"module": "Ajustes", "submodule": "Salones y Mesas", "route": "#!/ajustes/salones"},
    {"module": "Ajustes", "submodule": "Cajas", "route": "#!/ajustes/cajas"},
    {"module": "Ajustes", "submodule": "Comprobantes", "route": "#!/ajustes/comprobantes"},
    {"module": "Ajustes", "submodule": "Impresoras", "route": "#!/ajustes/impresoras"},
    {"module": "Ajustes", "submodule": "Impuestos", "route": "#!/ajustes/impuestos"},
    {"module": "Ajustes", "submodule": "Tarjetas", "route": "#!/ajustes/tarjetas"},
    {"module": "Ajustes", "submodule": "Turnos", "route": "#!/ajustes/turnos"},
    {"module": "Ajustes", "submodule": "Monedas", "route": "#!/ajustes/monedas"},
    {"module": "Ajustes", "submodule": "Moneda de facturacion", "route": "#!/ajustes/monedafacturacion"},
    {"module": "Ajustes", "submodule": "Cuentas de transferencia", "route": "#!/ajustes/tipotransferencia"},
    {"module": "Ajustes", "submodule": "Gestión de marcas", "route": "#!/ajustes/marca"},
    {"module": "Ajustes", "submodule": "Imágenes self service", "route": "#!/ajustes/imagen-self-service"},
    {"module": "Ajustes", "submodule": "Categoría Anular Venta", "route": "#!/ajustes/categoriaanularventa"},
    {"module": "Ajustes", "submodule": "Formas de pago", "route": "#!/ajustes/formas-de-pago"}
]

async def run_extraction():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD environment variable not set.")
        return

    extracted_results = []
    failed_routes = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        target_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"1. Navegando a {target_url}...")
        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        
        # Espera pasiva para estabilizar AngularJS y selectores
        await page.wait_for_timeout(4000)

        # Rellenar estrictamente solo usuario y contraseña
        user_input = page.locator('input[name="usuario_nick"]')
        pass_input = page.locator('input[name="usuario_clave"]')

        print(f"2. Ingresando usuario '{user}'...")
        await user_input.fill(user)
        await page.wait_for_timeout(500)

        print("3. Ingresando contrasena...")
        await pass_input.fill(password)
        await page.wait_for_timeout(500)

        print("4. Pulsando boton Iniciar sesion una sola vez...")
        login_btn = page.locator('button[type="submit"]')
        await login_btn.click()

        # Observar transicion
        for _ in range(20):
            await page.wait_for_timeout(500)
            if "#!/login" not in page.url:
                break

        await page.wait_for_timeout(3000)
        current_url = page.url

        if "#!/login" in current_url:
            print("ERROR FATAL: El login ha fallado. Deteniendo inmediatamente para evitar bloqueo.")
            error_text = await page.evaluate("""() => {
                const el = document.querySelector('.toast-message, .alert, .text-danger, form');
                return el ? el.innerText.trim() : 'Mensaje no identificado';
            }""")
            print(f"Mensaje exacto observado: {error_text}")
            await browser.close()
            return

        print(f"5. Login EXITOSO. URL actual: {current_url}")
        print(f"6. Iniciando exploracion de {len(MODULE_ROUTES)} pantallas en modo SOLO LECTURA...")

        base_web_url = "http://caprichos.restaurant.pe/restaurant/"

        for idx, item in enumerate(MODULE_ROUTES, 1):
            mod = item["module"]
            sub = item["submodule"]
            route = item["route"]

            print(f"[{idx}/{len(MODULE_ROUTES)}] Navegando a: {mod} -> {sub} ({route})")
            
            try:
                # Navegacion por hash / goto
                target_route_url = base_web_url + route
                await page.evaluate("(h) => { window.location.hash = h.replace(/^#/, ''); }", route)
                
                # Pausa estricta de minimo 2.5 segundos (respetando limite <= 1 peticion/segundo y 2s de pausa)
                await page.wait_for_timeout(2500)

                # Extraer informacion de texto visible en pantalla
                screen_data = await page.evaluate("""() => {
                    const titleEl = document.querySelector('.page-heading h2, .page-heading h1, .ibox-title h5, h2, h1');
                    const title = titleEl ? titleEl.innerText.trim() : '';

                    const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb li'))
                        .map(el => el.innerText.trim())
                        .filter(Boolean);

                    const headings = Array.from(document.querySelectorAll('#page-wrapper h3, #page-wrapper h4, #page-wrapper h5, #page-wrapper .ibox-title, #page-wrapper legend'))
                        .map(el => el.innerText.trim())
                        .filter(t => t.length > 0 && t.length < 150)
                        .slice(0, 8);

                    const descEls = document.querySelectorAll('#page-wrapper .help-block, #page-wrapper .alert, #page-wrapper p.text-muted, #page-wrapper .well, #page-wrapper small, #page-wrapper .text-info');
                    const help_texts = Array.from(descEls)
                        .map(el => el.innerText.trim())
                        .filter(t => t.length > 0 && t.length < 300)
                        .slice(0, 8);

                    const tabs = Array.from(document.querySelectorAll('#page-wrapper .nav-tabs li a, #page-wrapper .nav-pills li a'))
                        .map(el => el.innerText.trim())
                        .filter(Boolean)
                        .slice(0, 8);

                    const ths = Array.from(document.querySelectorAll('#page-wrapper th'))
                        .map(el => el.innerText.trim())
                        .filter(Boolean)
                        .slice(0, 10);

                    return {
                        title: title,
                        breadcrumbs: breadcrumbs,
                        headings: headings,
                        help_texts: help_texts,
                        tabs: tabs,
                        table_headers: ths
                    };
                }""")

                screen_data["module"] = mod
                screen_data["submodule"] = sub
                screen_data["route"] = route
                screen_data["status"] = "OK"
                extracted_results.append(screen_data)

            except Exception as e:
                print(f"Error accediendo a {route}: {e}")
                failed_routes.append({"module": mod, "submodule": sub, "route": route, "error": str(e)})

        # 7. Cerrar sesion de manera limpia y segura
        print("7. Finalizada la exploracion de pantallas. Cerrando sesion...")
        logout_clicked = False
        try:
            logout_btn = page.locator('text="Cerrar sesión"').first
            if await logout_btn.count() > 0:
                await logout_btn.click()
                logout_clicked = True
                print("Clic en 'Cerrar sesión' efectuado exitosamente.")
            else:
                logout_alt = page.locator('a:has-text("Salir")').first
                if await logout_alt.count() > 0:
                    await logout_alt.click()
                    logout_clicked = True
                    print("Clic en 'Salir' efectuado exitosamente.")
        except Exception as e:
            print(f"Aviso al cerrar sesion: {e}")

        await page.wait_for_timeout(2000)
        await browser.close()
        print("8. Navegador cerrado correctamente.")

    # Guardar resultados extraidos
    output_path = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/extracted_screen_info.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "results": extracted_results,
            "failed": failed_routes
        }, f, indent=2, ensure_ascii=False)
    print(f"Datos estructurados guardados en {output_path}")

if __name__ == "__main__":
    asyncio.run(run_extraction())
