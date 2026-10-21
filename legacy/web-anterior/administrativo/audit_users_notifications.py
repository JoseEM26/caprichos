import asyncio
import os
import json
import re
import sys
from playwright.async_api import async_playwright

async def run():
    user = os.environ.get("LOGIN_USER", "krosales")
    password = os.environ.get("LOGIN_PASSWORD")
    if not password:
        print("ERROR: LOGIN_PASSWORD environment variable not set.", file=sys.stderr)
        sys.exit(1)

    result = {
        "login_result": {
            "status": None,
            "url_initial": None,
            "url_final": None,
            "duration_seconds": None,
            "button_states": [],
            "http_calls": [],
            "console_logs": [],
            "dom_messages": [],
            "preloaded_inputs": []
        },
        "notifications": {
            "status": "NO OBSERVADO",
            "reason": None,
            "details": {}
        },
        "user_profile": {
            "status": "NO OBSERVADO",
            "reason": None,
            "details": {}
        },
        "users_module": {
            "status": "NO OBSERVADO",
            "reason": None,
            "details": {}
        },
        "logout_status": "NO REALIZADO"
    }

    def sanitize_text(text):
        if not text:
            return ""
        # Redact password, tokens, cookies, auth headers
        s = str(text)
        s = re.sub(r'("token"\s*:\s*)"[^"]+"', r'\1"[REDACTED]"', s, flags=re.IGNORECASE)
        s = re.sub(r'("usuario_clave"\s*:\s*)"[^"]+"', r'\1"[REDACTED]"', s, flags=re.IGNORECASE)
        s = re.sub(r'("password"\s*:\s*)"[^"]+"', r'\1"[REDACTED]"', s, flags=re.IGNORECASE)
        s = re.sub(r'("jwt"\s*:\s*)"[^"]+"', r'\1"[REDACTED]"', s, flags=re.IGNORECASE)
        s = re.sub(r'(Bearer\s+)[A-Za-z0-9_\-\.]+', r'\1[REDACTED]', s, flags=re.IGNORECASE)
        s = re.sub(r'(PHPSESSID=)[^;]+', r'\1[REDACTED]', s, flags=re.IGNORECASE)
        return s

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        # Listen to console
        page.on("console", lambda msg: result["login_result"]["console_logs"].append(f"[{msg.type}] {sanitize_text(msg.text)}"))
        page.on("pageerror", lambda err: result["login_result"]["console_logs"].append(f"[PAGEERROR] {sanitize_text(str(err))}"))

        # Listen to network
        async def on_request(req):
            if any(term in req.url.lower() for term in ["rest", "api", "login", "auth", "usuario"]):
                post_data = req.post_data
                result["login_result"]["http_calls"].append({
                    "event": "REQUEST",
                    "method": req.method,
                    "url": req.url,
                    "post_data": sanitize_text(post_data)[:500] if post_data else None
                })

        async def on_response(resp):
            if any(term in resp.url.lower() for term in ["rest", "api", "login", "auth", "usuario"]):
                body_sample = ""
                try:
                    raw_text = await resp.text()
                    body_sample = sanitize_text(raw_text)[:1000]
                except Exception:
                    body_sample = "[NO_TEXT]"

                result["login_result"]["http_calls"].append({
                    "event": "RESPONSE",
                    "method": resp.request.method,
                    "url": resp.url,
                    "status": resp.status,
                    "status_text": resp.status_text,
                    "body_preview": body_sample
                })

        page.on("request", on_request)
        page.on("response", on_response)

        target_url = "https://caprichos.restaurant.pe/restaurant/#!/login"
        print(f"[1] Navegando a {target_url}...")
        await page.goto(target_url, wait_until="domcontentloaded", timeout=60000)

        # Espera pasiva para estabilizar AngularJS
        print("[2] Esperando 4 segundos para estabilización de AngularJS...")
        await page.wait_for_timeout(4000)

        result["login_result"]["url_initial"] = page.url

        # Inspeccionar campos precargados
        preloaded = await page.evaluate("""() => {
            const list = [];
            document.querySelectorAll('form input, form select').forEach(el => {
                let displayVal = el.value;
                if (el.tagName.toLowerCase() === 'select') {
                    const opt = el.options[el.selectedIndex];
                    displayVal = opt ? opt.text : el.value;
                } else if (el.type === 'password') {
                    displayVal = el.value ? '[CONTRASENA_PRECARGADA]' : '[VACIO]';
                }
                list.push({
                    name: el.name || el.id || el.getAttribute('ng-model') || '',
                    tag: el.tagName.toLowerCase(),
                    text_or_val: displayVal
                });
            });
            return list;
        }""")
        result["login_result"]["preloaded_inputs"] = preloaded
        print(f"Campos precargados observados: {preloaded}")

        # Rellenar estrictamente usuario y contraseña
        user_input = page.locator('input[name="usuario_nick"]')
        pass_input = page.locator('input[name="usuario_clave"]')

        print(f"[3] Ingresando usuario '{user}'...")
        await user_input.fill(user)
        await page.wait_for_timeout(500)

        print("[4] Ingresando contraseña...")
        await pass_input.fill(password)
        await page.wait_for_timeout(500)

        # Obtener estado del botón antes de clic
        btn_locator = page.locator('button[type="submit"]')
        btn_before = await page.evaluate("""() => {
            const btn = document.querySelector('button[type="submit"]');
            if (!btn) return null;
            return {
                text: btn.innerText.trim(),
                className: btn.className,
                disabled: btn.disabled,
                data_loading: btn.getAttribute('data-loading')
            };
        }""")
        result["login_result"]["button_states"].append({"phase": "before_click", "state": btn_before})

        print("[5] Pulsando 'Iniciar sesión' UNA sola vez...")
        await btn_locator.click()

        # Esperar hasta 15 segundos observando cambios
        print("[6] Observando respuesta durante hasta 15 segundos...")
        login_success = False
        for sec in range(1, 16):
            await page.wait_for_timeout(1000)
            curr_url = page.url
            btn_state = await page.evaluate("""() => {
                const btn = document.querySelector('button[type="submit"]');
                if (!btn) return null;
                return {
                    text: btn.innerText.trim(),
                    className: btn.className,
                    disabled: btn.disabled,
                    loading_class: btn.classList.contains('data-loading') || btn.classList.contains('loading')
                };
            }""")
            
            # Buscar mensajes visibles
            dom_msgs = await page.evaluate("""() => {
                const msgs = [];
                const sels = [
                    '.toast-message', '.toastr', '.alert', '.alert-danger', '.alert-warning',
                    '.sweet-alert', '.swal2-container', '.help-block', '.text-danger',
                    '.modal-body', '.notification', '[ng-show*="error"]', '[ng-if*="error"]'
                ];
                sels.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        const txt = el.innerText.trim();
                        if (txt && el.offsetWidth > 0 && el.offsetHeight > 0) {
                            msgs.push({ selector: sel, text: txt });
                        }
                    });
                });
                return msgs;
            }""")

            if sec in [1, 3, 5, 10, 15] or "#!/login" not in curr_url:
                result["login_result"]["button_states"].append({f"second_{sec}": btn_state})
                if dom_msgs:
                    result["login_result"]["dom_messages"].extend(dom_msgs)

            if "#!/login" not in curr_url:
                print(f"[OK] ¡Transición detectada en segundo {sec}! Nueva URL: {curr_url}")
                login_success = True
                result["login_result"]["duration_seconds"] = sec
                break

        result["login_result"]["url_final"] = page.url
        result["login_result"]["status"] = "EXITOSO" if login_success else "FALLIDO_O_BLOQUEADO"

        if not login_success:
            print("[ALERTA] Login no transicionó tras 15 segundos.")
            print("Deteniendo inmediatamente sin reintentar conforme a directivas de seguridad.")
        else:
            # Espera 3 segundos de estabilización tras login
            print("[7] Login exitoso. Esperando 3 segundos para estabilización del dashboard...")
            await page.wait_for_timeout(3000)

            # (1) NOTIFICACIONES
            print("\n--- [8] INSPECCIONANDO NOTIFICACIONES (Barra superior) ---")
            try:
                notif_info = await page.evaluate("""() => {
                    const data = {
                        found: false,
                        selector: null,
                        badge_count: null,
                        dropdown_visible: false,
                        items: [],
                        raw_links: []
                    };

                    // Buscar icono o contenedor de notificaciones en barra superior
                    // Típico en Inspinia / Bootstrap: .navbar-top-links .dropdown, i.fa-bell, i.fa-envelope, .count-info
                    const bell = document.querySelector('.navbar-top-links .fa-bell, .nav.navbar-top-links .dropdown-alerts, [uib-dropdown] .fa-bell, .fa-bell');
                    if (bell) {
                        data.found = true;
                        const parentLink = bell.closest('a') || bell.parentElement;
                        data.selector = parentLink ? (parentLink.className || parentLink.id || 'bell_parent') : 'fa-bell';
                        
                        const badge = parentLink.querySelector('.label, .badge');
                        data.badge_count = badge ? badge.innerText.trim() : '0';

                        // Check dropdown menu asociado
                        const dropdownMenu = parentLink.parentElement.querySelector('.dropdown-menu, .dropdown-alerts');
                        if (dropdownMenu) {
                            dropdownMenu.querySelectorAll('li').forEach(li => {
                                const a = li.querySelector('a');
                                const text = li.innerText.trim();
                                if (text) {
                                    data.items.push({
                                        text: text,
                                        href: a ? (a.getAttribute('href') || '') : ''
                                    });
                                }
                            });
                        }
                    }
                    return data;
                }""")

                # Si no está desplegado, hacer clic pasivo para abrir el menú dropdown de notificaciones
                if notif_info["found"] and len(notif_info["items"]) == 0:
                    print("Abriendo menú dropdown de notificaciones con clic pasivo...")
                    bell_el = page.locator('.navbar-top-links .fa-bell, .fa-bell').first
                    if await bell_el.count() > 0:
                        await bell_el.click()
                        await page.wait_for_timeout(2000) # Pausa requerida 2s
                        
                        # Re-evaluar contenido del dropdown
                        dropdown_items = await page.evaluate("""() => {
                            const res = [];
                            const menu = document.querySelector('.dropdown-alerts, .navbar-top-links .dropdown-menu.show, .navbar-top-links .open .dropdown-menu');
                            if (menu) {
                                menu.querySelectorAll('li').forEach(li => {
                                    const a = li.querySelector('a');
                                    const text = li.innerText.trim();
                                    if (text) {
                                        res.push({
                                            text: text.replace(/\\s+/g, ' '),
                                            href: a ? (a.getAttribute('href') || '') : ''
                                        });
                                    }
                                });
                            }
                            return res;
                        }""")
                        notif_info["items"] = dropdown_items
                        
                        # Cerrar dropdown pulsando nuevamente la campana para restaurar estado
                        await bell_el.click()
                        await page.wait_for_timeout(2000)

                result["notifications"]["status"] = "OBSERVADO" if notif_info["found"] else "NO OBSERVADO"
                result["notifications"]["details"] = notif_info
                print(f"Notificaciones capturadas: {notif_info}")

            except Exception as e:
                print(f"Error inspeccionando notificaciones: {e}")
                result["notifications"]["status"] = "ERROR_AL_OBSERVAR"
                result["notifications"]["reason"] = str(e)

            await page.wait_for_timeout(2000) # Pausa reglamentaria 2s

            # (2) PERFIL DEL USUARIO
            print("\n--- [9] INSPECCIONANDO PERFIL DE USUARIO ---")
            try:
                profile_info = await page.evaluate("""() => {
                    const data = {
                        found: false,
                        user_display: null,
                        options: []
                    };

                    // Buscar bloque de usuario en topnav o sidebar
                    // Inspinia: .nav-header .profile-element, .navbar-top-links, o link con krosales
                    const userEls = Array.from(document.querySelectorAll('.profile-element, .nav-header, .navbar-top-links, .navbar-static-top a, #side-menu .nav-header'));
                    
                    // Buscar elementos con dropdown de usuario
                    const profileToggle = document.querySelector('.profile-element a[data-toggle="dropdown"], .nav-header a[data-toggle="dropdown"], .dropdown-profile, [uib-dropdown-toggle]');
                    if (profileToggle) {
                        data.found = true;
                        data.user_display = profileToggle.innerText.trim();
                        const menu = profileToggle.parentElement.querySelector('.dropdown-menu');
                        if (menu) {
                            menu.querySelectorAll('li a').forEach(a => {
                                data.options.push({
                                    text: a.innerText.trim().replace(/\\s+/g, ' '),
                                    href: a.getAttribute('href') || ''
                                });
                            });
                        }
                    } else {
                        // Buscar en topbar enlaces de usuario
                        const links = Array.from(document.querySelectorAll('.navbar-top-links a, .nav.navbar-top-links li a'));
                        const userLink = links.find(l => (l.innerText || '').toLowerCase().includes('krosales') || (l.innerText || '').toLowerCase().includes('perfil'));
                        if (userLink) {
                            data.found = true;
                            data.user_display = userLink.innerText.trim();
                        }
                    }
                    return data;
                }""")

                # Si no encontramos las opciones completas, intentamos desplegar el menú de perfil
                if profile_info["found"] and len(profile_info["options"]) == 0:
                    profile_btn = page.locator('.profile-element a[data-toggle="dropdown"], .nav-header a[data-toggle="dropdown"]').first
                    if await profile_btn.count() > 0:
                        print("Desplegando menú de perfil...")
                        await profile_btn.click()
                        await page.wait_for_timeout(2000)
                        
                        opts = await page.evaluate("""() => {
                            const res = [];
                            const menu = document.querySelector('.profile-element .dropdown-menu, .nav-header .dropdown-menu');
                            if (menu) {
                                menu.querySelectorAll('li a').forEach(a => {
                                    res.push({
                                        text: a.innerText.trim().replace(/\\s+/g, ' '),
                                        href: a.getAttribute('href') || ''
                                    });
                                });
                            }
                            return res;
                        }""")
                        profile_info["options"] = opts
                        # Cerrar dropdown
                        await profile_btn.click()
                        await page.wait_for_timeout(2000)

                result["user_profile"]["status"] = "OBSERVADO" if profile_info["found"] else "NO OBSERVADO"
                result["user_profile"]["details"] = profile_info
                print(f"Perfil capturado: {profile_info}")

            except Exception as e:
                print(f"Error inspeccionando perfil: {e}")
                result["user_profile"]["status"] = "ERROR_AL_OBSERVAR"
                result["user_profile"]["reason"] = str(e)

            await page.wait_for_timeout(2000) # Pausa reglamentaria 2s

            # (3) USUARIOS: Ajustes > Usuarios (#!/ajustes/usuarios)
            print("\n--- [10] INSPECCIONANDO MODULO USUARIOS (#!/ajustes/usuarios) ---")
            try:
                print("Navegando a #!/ajustes/usuarios...")
                await page.evaluate("() => { window.location.hash = '!/ajustes/usuarios'; }")
                await page.wait_for_timeout(3500) # Espera para carga de tabla y datos REST

                users_data = await page.evaluate("""() => {
                    const data = {
                        route: window.location.hash,
                        page_title: '',
                        tabs: [],
                        columns: [],
                        row_count_approx: 0,
                        pagination_text: '',
                        action_buttons: [],
                        form_fields: [],
                        roles_permissions_section: []
                    };

                    const title = document.querySelector('.page-heading h2, h2, .ibox-title h5');
                    data.page_title = title ? title.innerText.trim() : '';

                    // Tabs o pestañas si existen
                    document.querySelectorAll('.nav-tabs li a, .nav-pills li a').forEach(tab => {
                        data.tabs.push(tab.innerText.trim());
                    });

                    // Columnas de la tabla
                    document.querySelectorAll('table th').forEach(th => {
                        const txt = th.innerText.trim();
                        if (txt) data.columns.push(txt);
                    });

                    // Conteo aproximado de filas (sin copiar datos)
                    const rows = document.querySelectorAll('table tbody tr');
                    data.row_count_approx = rows.length;

                    // Info de paginación (ej. Mostrando 1 a 10 de 25)
                    const pagInfo = document.querySelector('.dataTables_info, .pagination, [ng-table-pagination]');
                    if (pagInfo) {
                        data.pagination_text = pagInfo.innerText.trim().replace(/\\s+/g, ' ');
                    }

                    // Botones de acción generales visibles (ej. 'Nuevo Usuario', etc.)
                    document.querySelectorAll('.ibox-tools a, .ibox-tools button, .page-heading a, .page-heading button').forEach(b => {
                        const txt = b.innerText.trim();
                        if (txt) data.action_buttons.push(txt);
                    });

                    return data;
                }""")

                # Ahora inspeccionamos el formulario de edición abriendo con clic en Editar
                # REGLAS: "pulsar editar solo para ver los campos esta permitido SIEMPRE QUE no escribas nada,
                # no cambies ningun valor y cierres con X o Cancelar. NO pulses Guardar, Aceptar, Nuevo/Crear,
                # Eliminar, Desactivar, Resetear contrasena...".
                print("Buscando botón de Editar en la primera fila para abrir formulario en solo lectura...")
                edit_btn = page.locator('table tbody tr button.btn-primary, table tbody tr a.btn-primary, table tbody tr .fa-pencil, table tbody tr .fa-edit').first
                
                form_opened = False
                if await edit_btn.count() > 0:
                    print("Haciendo clic en botón Editar...")
                    await edit_btn.click()
                    await page.wait_for_timeout(2500) # Pausa reglamentaria 2s
                    form_opened = True

                    # Extraer campos del formulario sin copiar valores reales
                    form_info = await page.evaluate("""() => {
                        const fields = [];
                        const modal = document.querySelector('.modal.in, .modal.show, form[name*="usuario"], .ibox-content form');
                        if (!modal) return { modal_found: false, fields: [], roles: [] };

                        // Extraer etiquetas y nombres de campos
                        const groups = modal.querySelectorAll('.form-group, .row');
                        groups.forEach(g => {
                            const label = g.querySelector('label');
                            const input = g.querySelector('input, select, textarea');
                            if (label || input) {
                                const labelText = label ? label.innerText.trim().replace(/\\s+/g, ' ') : '';
                                const inputName = input ? (input.name || input.id || input.getAttribute('ng-model') || input.type) : '';
                                const inputType = input ? (input.tagName.toLowerCase() === 'select' ? 'select' : (input.type || 'text')) : '';
                                
                                // Si es select de rol o perfil, capturar nombres de opciones
                                let selectOptions = [];
                                if (input && input.tagName.toLowerCase() === 'select') {
                                    Array.from(input.options).forEach(opt => {
                                        const optText = opt.text.trim();
                                        if (optText && !optText.toLowerCase().includes('seleccione')) {
                                            selectOptions.push(optText);
                                        }
                                    });
                                }

                                if (labelText || inputName) {
                                    fields.push({
                                        label: labelText,
                                        field_name: inputName,
                                        control_type: inputType,
                                        options: selectOptions.length > 0 ? selectOptions : undefined
                                    });
                                }
                            }
                        });

                        // Buscar selectores de roles o perfiles específicos
                        const roles = [];
                        const roleSelect = modal.querySelector('select[name*="rol"], select[name*="perfil"], select[ng-model*="rol"], select[ng-model*="perfil"]');
                        if (roleSelect) {
                            Array.from(roleSelect.options).forEach(opt => {
                                const t = opt.text.trim();
                                if (t) roles.push(t);
                            });
                        }

                        // Buscar pestañas o secciones internas (ej. permisos, locales asignados)
                        const modalTabs = [];
                        modal.querySelectorAll('.nav-tabs li a, .nav-pills li a').forEach(t => {
                            modalTabs.push(t.innerText.trim());
                        });

                        // Buscar botones de cierre o cancelar
                        const closeBtn = modal.querySelector('button[data-dismiss="modal"], button.close, button:has-text("Cancelar"), a:has-text("Cancelar")');

                        return {
                            modal_found: true,
                            fields: fields,
                            roles: roles,
                            modal_tabs: modalTabs,
                            has_cancel_button: !!closeBtn
                        };
                    }""")

                    users_data["form_inspection"] = form_info
                    print(f"Campos del formulario de usuario extraídos: {len(form_info.get('fields', []))}")

                    # Cerrar inmediatamente con Cancelar o X
                    print("Cerrando modal/formulario con Cancelar o X...")
                    cancel_btn = page.locator('.modal.in button[data-dismiss="modal"], .modal.in button:has-text("Cancelar"), .modal.in button.close, .modal.show button.close').first
                    if await cancel_btn.count() > 0:
                        await cancel_btn.click()
                        print("Formulario cerrado correctamente.")
                    else:
                        # Cerrar pulsando tecla Escape
                        await page.keyboard.press("Escape")
                        print("Formulario cerrado vía Escape.")
                    await page.wait_for_timeout(2000)

                result["users_module"]["status"] = "OBSERVADO"
                result["users_module"]["details"] = users_data

            except Exception as e:
                print(f"Error inspeccionando módulo Usuarios: {e}")
                result["users_module"]["status"] = "ERROR_AL_OBSERVAR"
                result["users_module"]["reason"] = str(e)

            await page.wait_for_timeout(2000) # Pausa reglamentaria 2s

            # [11] CERRAR SESIÓN DE MANERA SEGURA Y LIMPIA
            print("\n--- [11] CERRANDO SESIÓN LIMPIAMENTE ---")
            try:
                logout_clicked = False
                logout_link = page.locator('text="Cerrar sesión"').first
                if await logout_link.count() > 0:
                    await logout_link.click()
                    logout_clicked = True
                    print("Clic en 'Cerrar sesión' efectuado.")
                else:
                    logout_alt = page.locator('a:has-text("Salir")').first
                    if await logout_alt.count() > 0:
                        await logout_alt.click()
                        logout_clicked = True
                        print("Clic en 'Salir' efectuado.")
                
                await page.wait_for_timeout(2000)
                result["logout_status"] = "EXITOSO" if logout_clicked else "BOTON_NO_ENCONTRADO"
            except Exception as e:
                print(f"Error al cerrar sesión: {e}")
                result["logout_status"] = f"ERROR: {e}"

        await browser.close()
        print("[12] Navegador cerrado.")

    # Guardar reporte de auditoría en JSON
    json_path = "/home/jose/JoseEM/caprichos/web-anterior/administrativo/audit_output.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Resultado guardado en {json_path}")

if __name__ == "__main__":
    asyncio.run(run())
