---
modulo: supervisor-codigo
titulo: Código del supervisor
ruta: /admin/supervisor-codigo
permiso: supervisor/ver_codigo
roles: [ADMIN]
relacionados: [caja, usuarios, mirest, historial, compras]
sugerencias:
  - ¿Para qué sirve el código del supervisor?
  - ¿Por qué el código cambia cada 30 segundos?
  - ¿Cómo dicto o copio el código para autorizar una acción en caja o pedidos?
  - ¿Qué hago si la pantalla dice que el código rotativo no está configurado?
---
# Código del supervisor

## Para que sirve
Muestra en tiempo real el código rotativo de seguridad de 6 dígitos (TOTP) que cambia automáticamente cada 30 segundos. Este código es indispensable para autorizar operaciones delicadas en el local, tales como la anulación de pedidos cobrados en [[caja]], la pausa de pedidos por alta demanda en [[mirest]], el cambio de rol o desactivación en [[usuarios]], anulación de [[compras]] y queda registrado en [[historial]].

## Como se hace: consultar y dictar el código al personal
1. Ingresa a la pantalla Código del supervisor desde el menú lateral de Configuración.
2. En el centro verás el código actual en tamaño grande, separado en dos grupos de tres dígitos (por ejemplo: "842 195").
3. Encima del código se ubica un reloj circular con una cuenta regresiva que muestra los segundos restantes (de 30 a 1).
4. Cuando un cajero o mozo te solicite autorización en su pantalla, dicte los 6 dígitos o pulsa el botón "Copiar código" para enviarlo. Al copiarlo, el botón confirmará brevemente con la palabra "Copiado".
5. Recuerda que el personal debe ingresar el código antes de que el contador llegue a cero; cuando expire, la pantalla cambiará inmediatamente a un nuevo número de 6 dígitos.
Despues: [[caja]]
Ver tambien: [[usuarios]]

## Como se hace: generar el secreto inicial si no está configurado
1. Si entras por primera vez o en un local nuevo, verás el panel "Código rotativo no configurado".
2. Pulsa el botón "Generar secreto".
3. Aparecerá la ventana de confirmación "¿Generar secreto del supervisor?".
4. Pulsa el botón "Sí, generar secreto" para crear la clave criptográfica del local protegida con cifrado AES-256-GCM.
5. Inmediatamente el sistema comenzará a generar los códigos rotativos de 30 segundos.
Despues: [[supervisor-codigo]]
Ver tambien: [[historial]]

## Como se hace: rotar el secreto del local por seguridad
1. Si sospechas que el secreto del local fue filtrado o por política periódica de seguridad, puedes generar uno completamente nuevo.
2. Pulsa el botón "Rotar secreto" en la parte inferior de la tarjeta.
3. Se abrirá la ventana de advertencia "¿Rotar secreto del supervisor?".
4. Lee el mensaje con atención: al rotar el secreto, el código actual y los anteriores quedarán invalidados de inmediato en todos los dispositivos.
5. Confirma pulsando "Sí, rotar secreto" o cancela con "No, cancelar".
Ver tambien: [[historial]]

## Errores y dudas comunes
- El cajero dice que el código es incorrecto o expiró: los códigos tienen una validez estricta de 30 segundos. Si el reloj está en los últimos 5 segundos (se colorea en tono vino), es preferible esperar al siguiente ciclo antes de dictarlo para evitar que expire mientras el colaborador lo escribe.
- ¿Dónde se pide este código?: a los roles que no son administrador, en acciones como anular un pedido entregado, pausar la carta por alta demanda, modificar roles de empleados o desactivar usuarios. Si entras como administrador no te lo pide: eres tú quien autoriza.
- Si como administrador ves el mensaje «Código de supervisor incorrecto», avisa al equipo de soporte: el administrador no debe escribir este código en ninguna pantalla.
- No es una contraseña fija: no intentes memorizar el código de 6 dígitos, ya que se calcula criptográficamente en base a la hora oficial de Lima.

## Quien puede hacerlo
El administrador (ADMIN) nunca necesita este código: al entrar como administrador, ninguna acción lo pide (ni horario, ni cierre, ni anulaciones, cobros sin voucher, mermas, usuarios o configuración). El sistema lo deja registrado en auditoría como autorizado por rol ADMIN.

Esta pantalla requiere el permiso supervisor/ver_codigo y está restringida únicamente a usuarios con el rol Administrador (ADMIN) o supervisores autorizados. Ningún cajero, mozo, cocinero ni repartidor tiene acceso a esta vista para evitar autoautorizaciones.
