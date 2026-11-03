# Plantilla de WhatsApp: pedido recibido con enlace de seguimiento

Qué hay que hacer: registrar esta plantilla en Meta (Business Manager, WhatsApp, Plantillas de mensaje) y esperar su aprobación.
Mientras no esté aprobada, el sistema sigue funcionando igual que hoy.

## Datos para registrarla

- **Nombre:** `caprichos_pedido_recibido_seguimiento`
- **Categoría:** Utilidad (UTILITY)
- **Idioma:** Español (es)
- **Encabezado:** ninguno
- **Pie:** ninguno
- **Botones:** ninguno

## Texto exacto del cuerpo

```
¡Hola {{1}}! 😊 Recibimos tu pedido {{2}}, ¡gracias por tu compra! Ya está en proceso. Sigue tu pedido aquí: {{3}}. ¡Gracias por preferir Caprichos! 💛
```

## Qué significa cada variable

1. `{{1}}` = nombre del cliente (por ejemplo, Marta).
2. `{{2}}` = código del pedido (por ejemplo, CP-W005).
3. `{{3}}` = enlace para seguir el pedido (por ejemplo, la dirección de la carta con el código y una clave de seguridad).

Ejemplo de cómo se ve al cliente:

> ¡Hola Marta! 😊 Recibimos tu pedido CP-W005, ¡gracias por tu compra! Ya está en proceso. Sigue tu pedido aquí: https://caprichos.pe/?seguimiento=CP-W005&t=…. ¡Gracias por preferir Caprichos! 💛

## Cuándo se usa

- Con la ventana de 24 h abierta (el cliente escribió hace poco), el aviso sale como texto libre y ya incluye el enlace. No necesita la plantilla.
- Fuera de la ventana, en pedidos en efectivo, sale esta plantilla **solo después** de que Meta la apruebe y de que se encienda el parámetro «Usar la plantilla de pedido recibido con enlace» en Configuración › Parámetros de operación. Hasta entonces sale la plantilla de siempre, sin enlace.

## Después de la aprobación

1. Confirmar en Meta que el estado es «Aprobada».
2. En Configuración › Parámetros de operación, activar «Usar la plantilla de pedido recibido con enlace» (Sí).
3. Probar con un pedido de prueba en efectivo, con el teléfono fuera de la ventana de 24 h.

Si Meta la rechaza, no pasa nada: se deja en «No» y se corrige el texto con el equipo técnico.
