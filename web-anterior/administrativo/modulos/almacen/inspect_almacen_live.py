import asyncio
import os
import json
import re
import sys
from playwright.async_api import async_playwright

async def run_inspection():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: Variable de entorno LOGIN_PASSWORD no encontrada", file=sys.stderr)
        sys.exit(1)

    result = {
        "login": {},
        "screens": {}
    }

    # Targeted routes
    routes = [
        {
            "id": "movimiento_interno",
            "name": "Movimiento Interno",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/almacen/requerimientomovimiento/requerimientos/movimiento"
        },
        {
            "id": "requerimiento",
            "name": "Nuevo Requerimiento",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/almacen/requerimientomovimiento/requerimientos/nuevo-requerimiento"
        },
        {
            "id": "recepcion",
            "name": "Recepción",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/almacen/requerimientomovimiento/requerimientos/nuevo-recepcion"
        },
        {
            "id": "lista_procesos",
            "name": "Lista de Procesos",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/almacen/requerimientomovimiento/requerimientos/lista-de-proceso"
        },
        {
            "id": "stock",
            "name": "Stock / Existencias y Stock Bajo",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/almacen/stock"
        },
        {
            "id": "ajustes_produccion_almacen",
            "name": "Almacenes y Áreas de Producción (Ajustes)",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/ajustes/produccion"
        },
        {
            "id": "kardex",
            "name": "Kárdex de Almacén",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/almacen/kardex"
        },
        {
            "id": "merma",
            "name": "Mermas",
            "url": "https://caprichos.restaurant.pe/restaurant/#!/almacen/merma"
        }
    ]

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        current_screen_network = []

        async def on_request(req):
            if any(term in req.url.lower() for term in ["rest", "api"]):
                url_clean = req.url.split("?")[0]
                current_screen_network.append({
                    "type": "REQUEST",
                    "method": req.method,
                    "url_endpoint": url_clean
                })

        async def on_response(resp):
            if any(term in resp.url.lower() for term in ["rest", "api"]):
                url_clean = resp.url.split("?")[0]
                current_screen_network.append({
                    "type": "RESPONSE",
                    "method": resp.request.method,
                    "url_endpoint": url_clean,
                    "status": resp.status
                })

        page.on("request", on_request)
        page.on("response", on_response)

        login_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"[LOGIN] Navegando a {login_url}...")
        await page.goto(login_url, wait_until="domcontentloaded", timeout=60000)

        # Esperar 4 segundos obligatorios para que carguen desplegables
        print("[LOGIN] Esperando 4 segundos a que carguen desplegables...")
        await page.wait_for_timeout(4000)

        # Rellenar solo usuario y contraseña
        print("[LOGIN] Ingresando credenciales...")
        await page.locator('input[name="usuario_nick"]').fill(user)
        await page.wait_for_timeout(500)
        await page.locator('input[name="usuario_clave"]').fill(password)
        await page.wait_for_timeout(500)

        # Pulsar una sola vez Iniciar sesion
        print("[LOGIN] Pulsando Iniciar sesión (un solo intento)...")
        await page.locator('button[type="submit"]').click()

        # Esperar cambio de URL hasta 15 segundos
        logged_in = False
        for sec in range(1, 16):
            await page.wait_for_timeout(1000)
            if "#!/login" not in page.url:
                print(f"[LOGIN] Éxito en segundo {sec}: {page.url}")
                logged_in = True
                result["login"] = {"status": "SUCCESS", "second": sec, "url": page.url}
                break

        if not logged_in:
            print("[LOGIN] No se completó el inicio de sesión en 15s. Deteniendo.")
            result["login"] = {"status": "FAILED", "url": page.url}
            await browser.close()
            with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/almacen_live_structure.json", "w", encoding="utf-8") as out_f:
                json.dump(result, out_f, indent=2, ensure_ascii=False)
            return

        # Pausa de 2.5s tras login
        await page.wait_for_timeout(2500)

        # Recorrer cada pantalla en SOLO LECTURA
        for r in routes:
            print(f"\n[NAVEGACION] Inspeccionando pasivamente {r['name']} ({r['url']})...")
            current_screen_network.clear()

            try:
                await page.goto(r["url"], wait_until="domcontentloaded", timeout=30000)
                # Pausa de 3s para que renderice Angular y carguen tablas
                await page.wait_for_timeout(3000)

                # Extraer estructura DOM limpia
                dom_data = await page.evaluate("""() => {
                    const titleEl = document.querySelector('.page-heading h2, h2.font-light, .page-title, h1, h2');
                    const title = titleEl ? titleEl.innerText.trim() : '';

                    const bcEls = document.querySelectorAll('.breadcrumb li, .breadcrumb a, .breadcrumb span');
                    const breadcrumbs = Array.from(bcEls).map(el => el.innerText.trim()).filter(Boolean);

                    // Botones visibles (solo nombres y clases, sin tocarlos)
                    const btnEls = document.querySelectorAll('button, a.btn, input[type="button"], input[type="submit"]');
                    const buttons = [];
                    btnEls.forEach(b => {
                        const txt = b.innerText ? b.innerText.trim() : (b.value || '');
                        if (txt && b.offsetWidth > 0 && b.offsetHeight > 0) {
                            buttons.push(txt.replace(/\\s+/g, ' '));
                        }
                    });

                    // Cabeceras de tablas
                    const tableHeaders = [];
                    document.querySelectorAll('table').forEach((t, tIdx) => {
                        const headers = [];
                        t.querySelectorAll('th').forEach(th => {
                            const hTxt = th.innerText.trim().replace(/\\s+/g, ' ');
                            if (hTxt) headers.push(hTxt);
                        });
                        if (headers.length > 0) {
                            tableHeaders.push({ tableIndex: tIdx, headers: headers });
                        }
                    });

                    // Filtros, labels, selects e inputs visibles (sin copiar datos reales de personas o montos)
                    const fields = [];
                    document.querySelectorAll('label, .form-group').forEach(fg => {
                        const label = fg.querySelector('label') ? fg.querySelector('label').innerText.trim().replace(/\\s+/g, ' ') : '';
                        const select = fg.querySelector('select');
                        const input = fg.querySelector('input');
                        if (select) {
                            // Extraer solo nombres de opciones genéricas o contar opciones
                            const optTexts = Array.from(select.options).map(o => o.text.trim()).filter(Boolean);
                            fields.push({
                                label: label || 'Selector',
                                type: 'select',
                                options_count: optTexts.length,
                                options_structure: optTexts.slice(0, 8)
                            });
                        } else if (input) {
                            fields.push({
                                label: label || input.placeholder || 'Campo de entrada',
                                type: input.type || 'text',
                                placeholder: input.placeholder || ''
                            });
                        }
                    });

                    // Pestañas / Tabs
                    const tabs = [];
                    document.querySelectorAll('.nav-tabs li, tabset li, .nav-pills li').forEach(tab => {
                        const txt = tab.innerText.trim().replace(/\\s+/g, ' ');
                        if (txt) tabs.push(txt);
                    });

                    // Mensajes o alertas visibles
                    const alerts = [];
                    document.querySelectorAll('.alert, .alert-info, .alert-warning, .ibox-title h5').forEach(al => {
                        const txt = al.innerText.trim().replace(/\\s+/g, ' ');
                        if (txt && al.offsetWidth > 0 && al.offsetHeight > 0 && txt.length < 150) {
                            alerts.push(txt);
                        }
                    });

                    // Modales visibles si hubiera alguno
                    const modalEl = document.querySelector('.modal.in, .modal.show');
                    let modalInfo = null;
                    if (modalEl && modalEl.offsetWidth > 0) {
                        const modalTitle = modalEl.querySelector('.modal-title, h4, h3');
                        modalInfo = {
                            title: modalTitle ? modalTitle.innerText.trim() : 'Modal activo'
                        };
                    }

                    return {
                        actual_url: window.location.href,
                        title: title,
                        breadcrumbs: breadcrumbs,
                        tabs: tabs,
                        buttons: Array.from(new Set(buttons)),
                        tableHeaders: tableHeaders,
                        fields: fields.slice(0, 35),
                        alerts: Array.from(new Set(alerts)).slice(0, 10),
                        modal: modalInfo
                    };
                }""")

                # Endpoints observados durante la carga
                endpoints_seen = []
                for item in current_screen_network:
                    ep = f"{item['method']} {item['url_endpoint']}"
                    if ep not in endpoints_seen:
                        endpoints_seen.append(ep)

                result["screens"][r["id"]] = {
                    "id": r["id"],
                    "name": r["name"],
                    "url": r["url"],
                    "dom_structure": dom_data,
                    "endpoints_called": endpoints_seen
                }
                print(f"[OK] Pantalla capturada. Tablas: {len(dom_data['tableHeaders'])}, Botones: {len(dom_data['buttons'])}, Endpoints: {len(endpoints_seen)}")

            except Exception as ex:
                print(f"[ERROR] Error al inspeccionar {r['id']}: {ex}")
                result["screens"][r["id"]] = {
                    "id": r["id"],
                    "name": r["name"],
                    "error": str(ex)
                }

            # Pausa obligatoria de 2 segundos entre pantallas
            await page.wait_for_timeout(2000)

        # Cierre de sesión seguro y pasivo
        print("\n[LOGOUT] Cerrando sesión de manera segura...")
        try:
            logout_btn = page.locator('a:has-text("Cerrar sesión"), a:has-text("Cerrar Sesión"), a:has-text("Salir")').first
            if await logout_btn.count() > 0:
                await logout_btn.click()
                await page.wait_for_timeout(2000)
                print("[LOGOUT] Sesión cerrada.")
        except Exception as e:
            print(f"[LOGOUT] Aviso: {e}")

        await browser.close()

    output_path = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/almacen/almacen_live_structure.json"
    with open(output_path, "w", encoding="utf-8") as out_f:
        json.dump(result, out_f, indent=2, ensure_ascii=False)
    print(f"\n[FINALIZADO] Estructura guardada en {output_path}")

if __name__ == "__main__":
    asyncio.run(run_inspection())
