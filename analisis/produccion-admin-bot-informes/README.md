---
id: ANA-CAP-043
tipo: analisis
titulo: "Revisión de Producción, Administrador y lectura completa del bot"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, produccion-admin-bot-informes]
---

# Revisión de Producción, Administrador y lectura completa del bot

Fecha: 18/10/2026. Seis informes de agentes de Antigravity sobre la v109 y el código del bot (sin `.env`, llaves ni datos de clientes): `produccion.md`, `admin-config.md`, `admin-control.md`, `bot-parte1.md` (prompt, AGENTS y bot_wa 1-2600), `bot-parte2.md` (bot_wa 2600-5184, panel web /admin), `bot-parte3.md` (bot.py, client_db, geo_utils, sheet_sync, tienda web vieja). Son propuestas. Los números de línea no valen: buscar por texto.

## Verificado
- **Producción:** el escritorio muestra "24 donas" y "2 salidas" fijos; solo 11 insumos (sin harina, azúcar, levadura, manteca); solo 3 recetas; cierre del día solo de donas; la entrega de un pedido al almacén no rebaja stock central.
- **Administrador:** el gráfico del escritorio usa una función de ondas (`dayVal`), no ventas reales; no existe "Nuevo producto"; los cambios de precio de Productos y el plano del local no se guardan al recargar; sí se guardan config, ofertas, proveedores, compras, caja, zonas, agotados.
- **Bot:** regla de envío gratis: el bot usa "más de 70" (`> 70`); la tienda vieja y nuestra carta usan "desde 70" (`>= 70`). Hay que decidir con Kevin.
- **Hoja de cálculo del cliente:** tiene precios contradictorios (leche de almendras 2.50 y 3.00; chantilly 2.00 y 2.50), señal de que el Admin debe ser la única fuente de la carta.

## Hallazgos nuevos del bot completo (a partir de la segunda lectura)
1. El bot ya tiene un **panel web /admin** que Kevin usa: ver chats, pausar el bot, alertas, aprobar/rechazar con botones también por WhatsApp, respuestas rápidas (/listo, /recojo, /ubicacion, /pago), copiar solo productos para el POS, alta demanda, tarea de medianoche. Nuestro Admin no tiene consola de mensajes.
2. Reglas del Dúo (2 donas o galletas, pero 1 si se elige carrot cake, keke, empanada o petit pan), toppings secos a 1 sol que no están en la carta nueva, advertencias de hielo, número de 9 dígitos para copiar, recepción 24 h.
3. Corrección al informe anterior: el bot **sí** escribe sus JSON de forma atómica (`atomic_json_dump`); el riesgo de concurrencia queda en el panel con varios usuarios a la vez.
4. La carta del bot es un archivo plano, desvinculado del inventario real: si se agota un insumo, el bot lo sigue vendiendo.

## Construido (v110)
1. **Producción:** 8 insumos de pastelería y 3 productos terminados; recetas por tanda de donas, galletas, pan pullman y gelatina (cantidades de ejemplo); registro con descuento de materia prima y entrada al stock; cierre con conteo físico y diferencia; alerta de 12 horas; escritorio real; entrega de pedidos de insumos que baja el stock.
2. **Administrador:** Nuevo producto (se suma a la carta, Nuevo pedido y Productos); precios y plano que se guardan; PIN para anular pedidos por otros roles (campo de ejemplo en Configuración, Entrega); cajero sin Ofertas ni condiciones del crédito; costo y margen de recetas ocultos a Cocina y Mozo; el escritorio muestra las ventas reales de hoy.
3. **Mensajes de WhatsApp:** consola de maqueta con chats, pausa del bot, aprobar o rechazar pagos con el tiempo prometido (suma Alta demanda), respuestas rápidas, copiar solo productos y celular.
4. **Carta:** toppings secos a 1 sol y aviso al pedir poco hielo o menos helado.

## Lo que el informe decía y no era cierto
- La regla del Dúo (2 donas o galletas, 1 si se elige carrot cake, keke, empanada o petit pan) **ya estaba** como alternativas del combo.

## Límites
- Nunca se abrió en navegador. La consola de mensajes no se conecta a WhatsApp. Los precios editados solo se aplican en la carta a productos de un solo tamaño.
- Las cifras históricas del escritorio (semana, mes, año) siguen siendo una serie de ejemplo; solo "hoy" usa los pedidos reales.
- Sin hacer: planificación de producción por día, alertas de caducidad por lote en todos los insumos, usuarios con altas desde la pantalla, categorías de la carta editables, límite de crédito, informes con exportación real, auditoría de cambios, hashing de contraseñas (necesita servidor).
