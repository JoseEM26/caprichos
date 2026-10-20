import asyncio
import json
from playwright.async_api import async_playwright

async def inspect_checkout_screen():
    data = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        # Navigate to domain first to access localStorage
        await page.goto("https://caprichos.restaurant.pe/carta-digital/#/inicio", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)

        # Set valid simulated state in localStorage
        await page.evaluate("""() => {
            const local = {
                local_id: "1",
                local_nombrecomercial: "CAPRICHOS",
                local_direccion: "Calle 11, Mz D LT 27 Urb. Los girasoles de Campoy, SJL, Lima",
                local_telefono: "977503006",
                local_idioma: "es-Pe",
                monedafacturacion: "S/",
                local_tiempominimodelivery: 45,
                local_montominimo: 15,
                local_porcentajeImpuesto: 18,
                local_aceptapagoenlinea: "1",
                local_aceptaefectivopordelivery: "1",
                local_aceptatarjetapordelivery: "1",
                local_pagotransferenciamenuonline: "1",
                local_permitecomprobantemenuonline: "1"
            };
            const delivery = {
                local_id: "1",
                local_direccion: local.local_direccion,
                tipo_modalidad: "recojo",
                modalidad: "recojo",
                delivery_nombres: "",
                delivery_apellidos: "",
                delivery_celular: "",
                delivery_email: "",
                delivery_direccion: "Calle 11, Mz D LT 27 Urb. Los girasoles de Campoy, SJL, Lima",
                delivery_tipopago: "1",
                delivery_comprobante: "3",
                delivery_costoenvio: 0,
                delivery_horarecojo: "15:00:00",
                delivery_fecharecojo: "2026-10-13"
            };
            const carrito = [
                {
                    producto_id: "101",
                    producto_descripcion: "DUO COMPARTIR",
                    producto_precio: "33.00",
                    pedido_cantidad: 1,
                    pedido_productoprecio: "33.00",
                    pedido_subtotal: "33.00",
                    lista_productocombo: [],
                    lista_productobase: []
                }
            ];
            localStorage.setItem("localSeleccionado", JSON.stringify(local));
            localStorage.setItem("delivery", JSON.stringify(delivery));
            localStorage.setItem("carrito", JSON.stringify(carrito));
        }""")

        # Navigate to finalizarcompra
        target_url = "https://caprichos.restaurant.pe/carta-digital/#/tienda/1/finalizarcompra"
        print(f"Navigating to {target_url}...")
        await page.goto(target_url, wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)

        # Inspect checkout screen details
        info = await page.evaluate("""() => {
            const sections = [];
            document.querySelectorAll('.direccion, .tiempoentrega, .datos, .comprobante, .metodopago, .cupon, .productaccordion').forEach(el => {
                sections.push({
                    className: el.className,
                    text: el.innerText.trim()
                });
            });

            const inputs = Array.from(document.querySelectorAll('input, select, textarea, ion-input, ion-textarea, ion-select')).map(el => {
                const parent = el.closest('ion-item, .form-group, label, div');
                return {
                    tag: el.tagName,
                    type: el.getAttribute('type') || el.type || '',
                    placeholder: el.getAttribute('placeholder') || el.placeholder || '',
                    name: el.getAttribute('name') || el.name || '',
                    id: el.id || '',
                    label: parent ? parent.innerText.split('\\n')[0].trim() : ''
                };
            });

            const paymentMethods = [];
            document.querySelectorAll('#mediosPago ion-item, #mediosPago div, .metodopago ion-item, .metodopago [class*="cursor-pointer"]').forEach(el => {
                const text = el.innerText.trim();
                if (text && !paymentMethods.includes(text)) {
                    paymentMethods.push(text);
                }
            });

            const buttons = Array.from(document.querySelectorAll('button, ion-button, a')).map(b => b.innerText.trim()).filter(Boolean);

            return {
                url: window.location.href,
                bodyText: document.body.innerText,
                sections,
                inputs,
                paymentMethods,
                buttons
            };
        }""")

        with open("/home/jose/JoseEM/caprichos/web-anterior/administrativo/modulos/delivery/finalizar_compra_screen.json", "w", encoding="utf-8") as f:
            json.dump(info, f, indent=2, ensure_ascii=False)
        print("Finalizar compra screen analyzed and saved!")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_checkout_screen())
