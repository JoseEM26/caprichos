---
modulo: mirest
titulo: Configuración: Inteligencia artificial (Capri y vouchers)
ruta: /admin/mirest
seccion: ia
activa_con: [tab=ayuda, tab=vouchers]
permiso: local/ver
roles: [ADMIN]
relacionados: [caja, mensajes, comprobantes]
sugerencias:
  - ¿Cómo enciendo o apago la IA de Capri?
  - ¿Cómo configuro la lectura de vouchers de Yape y Plin con IA?
  - ¿Qué pasa cuando se llega al tope mensual de gasto en IA?
  - ¿Para qué sirve el titular y el número que pido en vouchers?
---
# Configuración: Inteligencia artificial (Capri y vouchers)

## Para que sirve
Dos usos de inteligencia artificial con un tope de gasto mensual compartido: el asistente de ayuda Capri (este chat) y la lectura automática de vouchers de Yape y Plin en [[caja]]. La IA solo propone; la persona siempre decide.

## Como se hace: encender o apagar la IA de Capri
1. En Configuración del local abre la pestaña "Asistente de ayuda con IA" ([Asistente de ayuda con IA](/admin/mirest?tab=ayuda)).
2. Pulsa el interruptor y confirma con "Sí, activar" o "Sí, desactivar".
3. Con la IA encendida, Capri responde con los manuales y un modelo de OpenAI (consume tokens). Apagada, responde solo con los manuales, sin costo de IA. Capri solo explica: nunca anula pedidos ni registra cobros.
4. Más abajo ves el consumo del mes frente al tope.

## Como se hace: configurar la lectura de vouchers con IA
1. Abre la pestaña "Lectura de vouchers con IA" ([Lectura de vouchers con IA](/admin/mirest?tab=vouchers)).
2. Enciende o apaga la lectura (confirma con "Sí, activar"/"Sí, desactivar"). Apagada, el voucher se guarda como "Sin lectura" y Caja lo revisa a mano.
3. Escribe el Titular, el número Yape y el número Plin que deben aparecer en los vouchers y pulsa "Guardar datos de cuentas"; confirma con "Sí, guardar cambios". Un voucher con otro titular u otro número se marca como dudoso.
4. En los límites, escribe el tope mensual en USD (de 1 a 500; por defecto 20) y el corte automático en minutos (de 1 a 120; por defecto 10) y pulsa "Guardar límites"; confirma con "Sí, guardar límites".

## Ajustes: IA de Capri y de vouchers
- **Activar el asistente Capri con IA** (ayuda_ia_activo): Con IA encendida, Capri responde las dudas del personal usando los manuales del sistema y un modelo de OpenAI (consume tokens). Apagada, responde solo con los manuales, sin costo de IA. Capri solo explica: nunca anula pedidos ni registra cobros. Ejemplo: Un mozo nuevo pregunta «¿cómo cobro una mesa?» y Capri le explica los pasos. Permiso: ADMIN. [Activar el asistente Capri con IA](/admin/mirest?tab=ayuda&campo=ayuda-capri-interruptor)
- **Consumo mensual de IA frente al tope** (chatbot_ia_tope_mensual_usd): Consultas, tokens y costo estimado de IA del mes frente al tope mensual en dólares. Con el tope alcanzado Capri responde solo con los manuales, sin IA; el tope se cambia en Parámetros (chatbot_ia_tope_mensual_usd). Ejemplo: 31 200 tokens y $4.12 de $20.00 es el 20 % del tope. [Consumo mensual de IA frente al tope](/admin/mirest?tab=ayuda&campo=ayuda-capri-consumo)
- **Leer vouchers de Yape y Plin con IA** (voucher_ia_activo): La IA lee la foto del voucher y propone monto, titular y número destino con un semáforo. Apagada, el voucher se guarda como «Sin lectura» y Caja lo revisa a mano. La persona siempre decide Aprobar o Rechazar. Ejemplo: Encendida: el cliente sube su captura de S/ 45 y Caja ve el monto leído y un semáforo verde si coincide. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Leer vouchers de Yape y Plin con IA](/admin/mirest?tab=vouchers&campo=vouchers-ia-interruptor)
- **Titular de la cuenta que debe aparecer en el voucher** (voucher_titular_nombre): Nombre de quien recibe los pagos. La IA lo compara con el nombre que lee en la captura: si no coincide el voucher se marca como dudoso para que Caja lo revise. Ejemplo: Si el titular es «Maria Morillo» y el voucher dice otro nombre, el semáforo avisa «Titular no coincide» y Caja lo revisa con más cuidado. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Titular de la cuenta que debe aparecer en el voucher](/admin/mirest?tab=vouchers&campo=vouchers-titular)
- **Número Yape que recibe los pagos** (voucher_yape_numero): Celular al que los clientes deben yapear. La IA lo compara con el número destino que lee en la captura; un voucher a otro número se marca como dudoso. Ejemplo: 977503006. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Número Yape que recibe los pagos](/admin/mirest?tab=vouchers&campo=vouchers-yape-numero)
- **Número Plin que recibe los pagos** (voucher_plin_numero): Celular al que los clientes deben hacer plin. La IA lo compara con el destino leído en la captura; otro número marca el voucher como dudoso. Ejemplo: 977503006. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Número Plin que recibe los pagos](/admin/mirest?tab=vouchers&campo=vouchers-plin-numero)
- **Guardar datos de cuentas de vouchers**: Guarda titular, número Yape y número Plin juntos. Cambian desde la siguiente lectura de voucher; los ya leídos no se recalculan. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Guardar datos de cuentas de vouchers](/admin/mirest?tab=vouchers&campo=vouchers-guardar-datos)
- **Consumo de IA de vouchers este mes** (chatbot_ia_tope_mensual_usd): Dólares gastados este mes en leer vouchers con IA, frente al tope mensual, con barra de progreso. Al llegar al tope la lectura automática se detiene, los vouchers se guardan y Caja los revisa a ojo; se avisa una sola vez a los administradores. Ejemplo: Con tope de 20 USD y 15 USD usados, la barra marca 75 %. [Consumo de IA de vouchers este mes](/admin/mirest?tab=vouchers&campo=vouchers-ia-consumo)
- **Tope mensual de IA para vouchers (USD)** (chatbot_ia_tope_mensual_usd): Gasto máximo del mes en la lectura de vouchers con IA. Al alcanzarlo la lectura automática se detiene, los vouchers se guardan y Caja los revisa a ojo; se avisa una sola vez a los administradores. Ejemplo: Con 20, al gastar 20 USD en vouchers la IA deja de leer hasta el mes siguiente. valor por defecto 20, rango 1 a 500, unidad USD. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Tope mensual de IA para vouchers (USD)](/admin/mirest?tab=vouchers&campo=vouchers-ia-tope)
- **Corte automático de la IA de vouchers (minutos)** (voucher_ia_corte_min): Si la IA falla tres veces seguidas por saldo o clave (o cinco errores), se corta durante estos minutos y los vouchers se guardan sin lectura; luego una lectura de prueba decide si se reanuda. Ejemplo: Con 10, tras el corte la IA no se llama por 10 minutos. valor por defecto 10, rango 1 a 120, unidad minutos. Permiso: ADMIN. [Corte automático de la IA de vouchers (minutos)](/admin/mirest?tab=vouchers&campo=vouchers-ia-corte)
- **Asistente de ayuda con IA (Capri)** (ayuda_ia_activo): Habilita al asistente Capri, que orienta a los usuarios del panel de administración con IA. También depende de la clave de OpenAI y del tope mensual. Ejemplo: En «Sí», el asistente de ayuda del panel responde con IA. [Asistente de ayuda con IA (Capri)](/admin/mirest?tab=parametros&campo=parametros-ayuda-ia-activo)
- **Consumo de la IA este mes**: Muestra cuántas consultas, tokens y dólares gastó la IA en el mes frente al tope. Solo informa; el tope se cambia en «Tope mensual de gasto en IA». Ejemplo: USD 4.20 de USD 20 (21 % consumido). [Consumo de la IA este mes](/admin/mirest?tab=parametros&campo=parametros-consumo-ia)

## Errores y dudas comunes
- Capri responde "sin IA": la IA está apagada, falta la clave de OpenAI o se llegó al tope mensual; igual responde con los manuales.
- Con el tope alcanzado la lectura automática de vouchers se detiene, los vouchers se guardan y Caja los revisa a ojo; se avisa una sola vez a los administradores.
- Si la IA falla tres veces seguidas por saldo o clave (o cinco errores), se corta durante los minutos del corte y luego una lectura de prueba decide si se reanuda.
- Los datos de cuentas cambian desde la siguiente lectura; los vouchers ya leídos no se recalculan.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El administrador no escribe código de supervisor: el sistema lo autoriza solo y el cambio queda en el historial de auditoría.
