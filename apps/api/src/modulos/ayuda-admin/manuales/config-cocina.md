---
modulo: mirest
titulo: Configuración: Cocina
ruta: /admin/mirest
seccion: cocina
activa_con: [tab=cocina]
permiso: local/ver
roles: [ADMIN]
relacionados: [cocina, recetas, pantallas]
sugerencias:
  - ¿Cómo evito que cocina pida confirmación al despejar una comanda?
  - ¿Dónde cambio los minutos de preparación por defecto?
  - ¿Qué significa "Listo en ~10 min" en un producto nuevo?
---
# Configuración: Cocina

## Para que sirve
Dos ajustes generales de la pantalla de [[cocina]]: si despejar una comanda pide confirmar con Sí o No, y cuántos minutos se usan para decir "Listo en ~N min" cuando un producto no tiene datos recientes.

## Como se hace: pedir o no confirmación al despejar comandas
1. En Configuración del local abre la pestaña "Cocina" ([Cocina](/admin/mirest?tab=cocina)) y la tarjeta "Confirmar al despejar".
2. Elige Sí (despejar pide confirmar con Sí o No) o No (un toque despeja la comanda directo).
3. Pulsa "Sí, confirmar" en el diálogo. Es el valor general del local; cada cocinero puede cambiarlo solo para sí desde Cocina ("Preguntar antes de despejar").

## Como se hace: cambiar los minutos de preparación por defecto
1. En la misma pestaña busca la tarjeta "Tiempo estimado" y el campo "Minutos de preparación por defecto".
2. Escribe un entero de 1 a 120 y guarda; confirma el diálogo.
3. Se usa para "Listo en ~N min" de un producto sin datos de los últimos 30 días; con datos, cada producto usa su promedio real. Por defecto son 10 minutos.

## Ajustes: Cocina
- **Confirmar al despejar comandas** (cocina_confirmar_despejar): Valor general del local: encendido, despejar un pedido en cocina pide confirmar con Sí o No; apagado, un toque despeja la comanda directo. Vale para quien no lo haya personalizado: cada cocinero puede cambiarlo para sí mismo desde Cocina («Preguntar antes de despejar»). Solo el administrador cambia el general y queda auditado. Ejemplo: Apagado: el cocinero toca Despejar y la comanda sale de la pantalla sin preguntar. valor por defecto Sí (encendido si no existe), rango Sí o No. Permiso: ADMIN. [Confirmar al despejar comandas](/admin/mirest?tab=cocina&campo=cocina-confirmar-despejar)
- **Minutos de preparación por defecto** (cocina_minutos_preparacion_defecto): Minutos que se usan para «Listo en ~N min» de un producto que no tiene datos de los últimos 30 días. Con datos, cada producto usa su promedio real. Ejemplo: Con 15: un producto nuevo sin pedidos previos dirá que está listo en unos 15 minutos. valor por defecto 10 minutos, rango Entero de 1 a 120, unidad minutos. Permiso: ADMIN. [Minutos de preparación por defecto](/admin/mirest?tab=cocina&campo=cocina-minutos-preparacion-defecto)

## Errores y dudas comunes
- "Los minutos de preparación deben ser un número entero entre 1 y 120": no se aceptan decimales ni valores fuera de ese rango.
- Un cocinero dice que a él sí le pregunta: lo personalizó en su pantalla de Cocina; el valor del local vale para quien no lo cambió.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El administrador no escribe código de supervisor: el sistema lo autoriza solo y el cambio queda en el historial de auditoría. Solo el administrador cambia el valor general y queda auditado.
