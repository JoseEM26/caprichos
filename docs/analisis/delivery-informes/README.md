---
id: ANA-CAP-028
tipo: analisis
titulo: "Revisión de Call center, Repartidor y lógica del chatbot"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, delivery-informes]
---

# Revisión de Call center, Repartidor y lógica del chatbot

Fecha: 18/10/2026. Seis informes de agentes de Antigravity (v107 + código del bot entregado): `callcenter.md`, `repartidor.md`, `bot.md`. Al bot solo se le dio el código (no `.env`, llaves ni datos de clientes).

## Verificado
1. **Delivery:** el bot real usa polígonos (`LIMITES_DELIVERY.geojson`: zonas Z2, Z3, Z4, Z5 y Z7, con tarifa de 2 a 7 soles; fuera de cobertura se ofrece recojo). La carta del mockup usa tres tramos inventados por kilómetros (3, 5 y 8 soles). Los pedidos manuales del Admin no calculan flete.
2. **Ya coinciden:** envío gratis desde 70 soles y pedido mínimo de 14.50.
3. **Repartos** no tiene enlaces para llamar ni para WhatsApp, y los enlaces a Maps y Waze buscan por texto con "Lima Peru".
4. **Entregar** un pedido no registra el cobro contra entrega en la caja.
5. **Reglas del bot que faltan** (informe bot.md, sección 8): poligonos y tarifa por ubicación, recordar la dirección anterior por teléfono, "cancelo con [monto]" como efectivo y vuelto, tarifas especiales por cliente, modo Alta demanda (ya hecho en v107), pausa del bot y reseteo a las 3 horas, pedido por confirmar con aprobación humana, reglas del Dúo, de modificadores y de hielo.

## Decisiones que no son errores
El pedido por teléfono queda "Por confirmar" y el comprobante lo sube el equipo: así lo decidió Kevin. Los agentes lo marcan como fallo; si se quiere cambiar (por ejemplo, validar en la app del banco sin archivo) lo decide el cliente.

## Riesgos del bot entregado (sin repetir secretos)
Datos de clientes y chats en JSON sin cifrar, escrituras sin bloqueo, credenciales por defecto del panel `/admin` si falta el entorno, tráfico sin TLS si no hay proxy, sin límite de consumo de OpenAI, carta que depende de nombres de columna de una hoja pública. Además la carpeta entregada incluía una llave SSH privada y un `.env`: rotarlos.

## Construido (v108 y v109)
1. **Zonas:** polígonos del bot (Z2, Z3, Z4, Z5 y Z7) en la carta y el Admin; la ubicación del cliente o el pin decide la zona y la tarifa (editable en Configuración del local, Entrega). Fuera de cobertura: aviso y recojo. Sin ubicación, la carta muestra las zonas para elegir (estimado).
2. **Repartos:** llamar, WhatsApp, Maps y Waze por coordenadas, vuelto, estados "cliente no contesta" y "no encuentro la dirección" (avisan a caja y call center), devolver a la tienda, cobro contra entrega y liquidación del efectivo en Caja y cierres, fletes de hoy.
3. **Mozo:** consumos adicionales en mesa ocupada, sentar o liberar reserva, precuenta con impresión, "ya lo llevé a la mesa", aviso de pedido listo, nombre real del mozo, reservas de hoy reales, nota del descuento del personal.
4. **Call center:** memoria de dirección por teléfono, repetir pedido, anular con motivo, "paga con", tarifa especial por cliente (Ana Pérez de ejemplo: envío 2 soles).
5. **Mapa de entregas:** calor, zonas, radios de 0.5, 1 y 2 km, ventas por zona, intentos fuera de cobertura, filtros de período y canal.

## Límites
- Nunca se abrió en navegador; probado con arnés. Los mosaicos del mapa necesitan internet.
- Los puntos del mapa de calor son inventados (95); los pedidos nuevos con ubicación se suman. La carta aún no manda las coordenadas al Admin.
- Anular un pedido no devuelve los insumos descontados.
- Quedan sin hacer: código Plus de Google, zonas editables en el mapa, pedido del cliente con ubicación hacia el Admin, "cancelo con" dentro del simulador del chatbot, agrupar entregas por ruta, prueba de entrega con foto, propinas.
