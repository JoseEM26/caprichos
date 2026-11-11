---
modulo: mirest
titulo: Configuración: Correos de aviso
ruta: /admin/mirest
seccion: correos-aviso
activa_con: [tab=correos]
permiso: local/ver
roles: [ADMIN]
relacionados: [mensajes, caja, almacen, comprobantes]
sugerencias:
  - ¿Cómo hago que mi contador reciba avisos por correo sin crearle un usuario?
  - ¿Qué avisos me llegan por correo y cuándo se mandan?
  - ¿Cómo sé si un correo de la lista está funcionando?
  - ¿Por qué no me llegó el aviso de un chat sin responder?
  - ¿Quién recibe los avisos por su usuario y cómo lo cambio?
  - ¿Cómo apago o cambio los minutos de los avisos de impresoras y chats?
---
# Configuración: Correos de aviso

## Para que sirve
Decide a quién le llegan por correo los avisos del sistema. Solo la ve el administrador, en Configuración, pestaña "Correos de aviso" ([Correos de aviso](/admin/mirest?tab=correos)). Tiene tres partes: "Correos extra", "Por su usuario" y "Cuándo se avisa".

## Que avisos existen (y cuando se mandan)
- Stock bajo: cuando un insumo o producto se agota o hay que pedirlo ([[almacen]]).
- Impresora sin conexión: cuando hay etiquetas esperando y la impresora de Caja no responde ([[caja]]).
- Computadoras de impresión sin conectar: 20 minutos después de abrir la caja del día se revisa si todas las computadoras de impresión están en línea. Si falta alguna, llega UN correo con cuántas faltan, cuáles son y qué hacer. Si siguen sin conectar, llega UN recordatorio 1 hora después y ya no se repite ese día. Si todo está en línea, no se manda nada.
- Chat de WhatsApp sin responder: cuando un cliente espera a una persona 15 minutos o más (solo dentro del horario del local) llega UN correo por chat con un enlace para abrirlo ([[mensajes]]). Si hay muchos a la vez, llega un solo correo resumen.
- Certificado y comprobantes: el certificado digital por vencer y problemas con boletas o facturas ([[comprobantes]]).
- Otros avisos: pagos sin revisar, pedidos sin confirmar y calificaciones bajas.

## Como se hace: agregar un correo extra
1. Entra a Configuración y abre "Correos de aviso" ([Correos de aviso](/admin/mirest?tab=correos)).
2. En "Correos extra" pulsa "Agregar correo".
3. Escribe el correo y, si quieres, un nombre como "Contador" o "Socio".
4. Marca los tipos de aviso que debe recibir. Si no marcas ninguno, no recibe nada.
5. Pulsa "Guardar". Puedes pausarlo, editarlo o quitarlo cuando quieras. Se pueden tener hasta 20.
6. Pulsa "Enviar correo de prueba" para ver si llega (uno por minuto por correo y hasta 10 al día).

## Como se hace: ver quien recibe por su usuario
1. Abre la pestaña "Por su usuario". Es solo para mirar.
2. Ahí están las personas que tienen marcada la casilla "Recibir avisos del sistema por correo" en [Usuarios](/admin/usuarios). Reciben todos los avisos, cuando están de turno.
3. Si un correo está en las dos listas, solo recibe un correo.

## Como se hace: cambiar cuándo se avisa
1. Abre la pestaña "Cuándo se avisa".
2. Cada aviso nuevo tiene un interruptor para apagarlo y los minutos que se esperan antes de avisar.
3. Los minutos tienen mínimo y máximo; si te pasas, la pantalla te dice qué número poner.

## Errores y dudas comunes
- "El envío de correos no está configurado": en este ambiente no hay cuenta de correo, así que los avisos quedan registrados pero no salen. Avisa a soporte.
- No llegó un aviso: revisa que el correo esté Activo, que tenga marcado ese tipo y mira la carpeta de spam.
- No avisa de chats fuera del horario del local. Si al abrir quedan chats esperando, llega un solo correo con todos.

## Quien puede hacerlo
Solo el Administrador (ADMIN) ve y cambia esta pantalla. Cada correo agregado, cambiado o quitado queda en el historial de auditoría con el correo oculto (por ejemplo c***@dominio.com).
