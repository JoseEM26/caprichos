---
modulo: mirest
titulo: Configuración: Reparto y entregas fallidas
ruta: /admin/mirest
seccion: reparto
activa_con: [tab=reparto, tab=fallas]
permiso: local/ver
roles: [ADMIN]
relacionados: [repartos, mapa, cocina, mensajes]
sugerencias:
  - ¿Cómo cambio el máximo de pedidos que lleva un repartidor?
  - ¿Dónde cambio los minutos para los colores amarillo, naranja y rojo del mapa?
  - ¿Dónde configuro cuánto espera el repartidor en la puerta?
  - ¿Cuánto se cobra por reprogramar una entrega fallida?
---
# Configuración: Reparto y entregas fallidas

## Para que sirve
Ajusta cómo se vigila y se cierra un delivery: los minutos de espera que pintan los pedidos de amarillo, naranja y rojo en el mapa de reparto y en cocina, la velocidad media del repartidor, cuántos pedidos puede llevar a la vez (límite del repartidor), cuánto espera en la puerta, cuántas veces se reprograma una entrega fallida y cuánto se cobra por volver a enviar. Lo ven [[repartos]], [[mapa]] y [[cocina]]. Los avisos de WhatsApp al cliente (en camino, llegué, espera agotada) se encienden en otra parte: ver más abajo.

## Como se hace: cambiar los colores de espera y el máximo de pedidos por repartidor
1. En Configuración del local abre la pestaña "Reparto y avisos al cliente" ([Reparto y avisos al cliente](/admin/mirest?tab=reparto)).
2. En "Umbrales de espera y operación del mapa" cambia los minutos de Retrasado (amarillo), Tarde (naranja) y Muy tarde (rojo palpitando). Deben ir en orden ascendente: retrasado menor que tarde, y tarde menor que muy tarde (si no, el sistema no deja guardar).
3. Cambia la "Velocidad media" del repartidor (en km/h, entre 5 y 100) y el "Máximo de pedidos" por repartidor (entre 1 y 20).
4. Pulsa "Guardar configuración de reparto" y confirma con "Sí, guardar". El máximo de pedidos se guarda junto con su gemelo "Máximo de pedidos por repartidor" de Parámetros: son el mismo ajuste.
5. Con el tope lleno, el repartidor no puede tomar otro pedido hasta entregar alguno y recibe el mensaje "entrega alguno antes de tomar otro".

## Como se hace: cambiar la espera en la puerta y la reprogramación
1. Abre la pestaña "Entregas fallidas" ([Entregas fallidas](/admin/mirest?tab=fallas)). Cada fila dice "Se edita en Parámetros → …" y tiene un enlace.
2. Pulsa el enlace (por ejemplo [Espera máxima en la puerta](/admin/mirest?tab=parametros&campo=parametros-reparto-espera-max-min)), pulsa "Editar", escribe el valor y "Guardar"; confirma con "Sí, guardar".
3. Con 10 minutos de espera máxima y 3 de insistencia, el aviso de espera agotada sale a los 10 minutos y el repartidor se retira a los 13; el pedido vuelve a Listo con recargo.
4. El costo de volver a enviar tiene tres modos: IGUAL_ENVIO, FIJO o SIN_COSTO. Con FIJO se usa el "Monto fijo por reprogramar".

## Como se hace: encender o apagar los avisos de WhatsApp de reparto
1. Los mensajes "repartidor en camino", "repartidor en la puerta" y "espera agotada" se encienden en Parámetros del sistema, grupo "Avisos automáticos por WhatsApp al cliente": [Aviso: repartidor en camino](/admin/mirest?tab=parametros&campo=parametros-whatsapp-aviso-salida-activo), [Aviso: repartidor en la puerta](/admin/mirest?tab=parametros&campo=parametros-whatsapp-aviso-llegada-activo) y [Aviso: espera agotada y reprogramación](/admin/mirest?tab=parametros&campo=parametros-whatsapp-aviso-espera-activo).
2. Sin el aviso de espera agotada no se retira la moto ni se pregunta si se reprograma.

## Ajustes: Reparto y entregas fallidas
- **Colores de espera del mapa de reparto (amarillo, naranja, rojo)**: Agrupa los minutos para las alertas Retrasado, Tarde y Muy tarde del mapa y la lista de reparto. Deben ir en orden ascendente. Ejemplo: Con 20 / 30 / 45: amarillo a los 20 min, naranja a los 30, rojo palpitando a los 45. [Colores de espera del mapa de reparto (amarillo, naranja, rojo)](/admin/mirest?tab=reparto&campo=reparto-alertas-color)
- **Minutos para alerta amarilla (Retrasado)** (reparto_retrasado_min): Minutos de espera del pedido para pintar su punto en amarillo (Retrasado) en el mapa y la lista de reparto. Lo ven Caja y quien coordina el reparto. Ejemplo: Con 20: un pedido que lleva 20 minutos esperando pasa de verde a amarillo. [Minutos para alerta amarilla (Retrasado)](/admin/mirest?tab=reparto&campo=reparto-retrasado-min)
- **Minutos para alerta naranja (Tarde)** (reparto_tarde_min): Minutos de espera para pintar el pedido en naranja (Tarde) en el mapa de reparto. Ejemplo: Con 30: a los 30 minutos el punto se ve naranja. [Minutos para alerta naranja (Tarde)](/admin/mirest?tab=reparto&campo=reparto-tarde-min)
- **Minutos para alerta roja palpitando (Muy tarde)** (reparto_muy_tarde_min): Minutos de espera para marcar el pedido en rojo palpitando (crítico) en el mapa de reparto. Ejemplo: Con 45: a los 45 minutos el punto palpita en rojo y exige atención. [Minutos para alerta roja palpitando (Muy tarde)](/admin/mirest?tab=reparto&campo=reparto-muy-tarde-min)
- **Velocidad media de viaje** (reparto_velocidad_kmh): Velocidad promedio del repartidor en moto. Con ella se estima el tiempo de viaje por distancia, el orden de la ruta y el tiempo estimado que ve el cliente. Ejemplo: Con 25 km/h: 5 km de camino se estiman en unos 12 minutos. [Velocidad media de viaje](/admin/mirest?tab=reparto&campo=reparto-velocidad-kmh)
- **Máximo de pedidos por repartidor** (reparto_max_pedidos): Cuántos pedidos puede llevar a la vez un repartidor. Con el tope lleno no puede tomar otro ni se le puede asignar otro hasta que entregue alguno. Ejemplo: Con 5: el repartidor con 5 pedidos activos recibe «entrega alguno antes de tomar otro». [Máximo de pedidos por repartidor](/admin/mirest?tab=reparto&campo=reparto-max-pedidos)
- **Dónde se cambian los mensajes de WhatsApp al salir y llegar**: Los avisos «En camino», «He llegado» y espera agotada se encienden o apagan en Parámetros (Avisos automáticos por WhatsApp) y sus tiempos en Parámetros (entrega fallida). Aquí no se editan. Ejemplo: Para apagar el aviso «Repartidor en la puerta» ve a Parámetros. [Dónde se cambian los mensajes de WhatsApp al salir y llegar](/admin/mirest?tab=reparto&campo=reparto-mensajes-whatsapp)
- **Pedido en naranja: minutos de espera (cocina y pedidos)** (rep_naranja_min): Minutos desde que entró el pedido para pintarlo naranja en las comandas de cocina y en la lista de pedidos. No es el mapa de reparto: ese usa «Tarde». Ejemplo: Con 35: un pedido que lleva 36 minutos esperando se ve naranja. [Pedido en naranja: minutos de espera (cocina y pedidos)](/admin/mirest?tab=parametros&campo=parametros-rep-naranja-min)
- **Pedido en rojo: minutos de espera (cocina y pedidos)** (rep_rojo_min): Minutos desde que entró el pedido para pintarlo rojo (crítico) en las comandas de cocina y en la lista de pedidos. Ejemplo: Con 50: un pedido con 50 minutos de espera o más se ve rojo. [Pedido en rojo: minutos de espera (cocina y pedidos)](/admin/mirest?tab=parametros&campo=parametros-rep-rojo-min)
- **Mapa de reparto: amarillo (Retrasado)** (reparto_retrasado_min): Minutos de espera para marcar un pedido en amarillo (Retrasado) en el mapa y la lista de reparto. Ejemplo: Con 20: a los 20 minutos el punto pasa de verde a amarillo. [Mapa de reparto: amarillo (Retrasado)](/admin/mirest?tab=parametros&campo=parametros-reparto-retrasado-min)
- **Mapa de reparto: naranja (Tarde)** (reparto_tarde_min): Minutos de espera para marcar un pedido en naranja (Tarde) en el mapa de reparto. Ejemplo: Con 30: a los 30 minutos el punto se ve naranja. [Mapa de reparto: naranja (Tarde)](/admin/mirest?tab=parametros&campo=parametros-reparto-tarde-min)
- **Mapa de reparto: rojo palpitando (Muy tarde)** (reparto_muy_tarde_min): Minutos de espera para marcar un pedido en rojo palpitando (crítico) en el mapa de reparto. Ejemplo: Con 45: a los 45 minutos el punto palpita en rojo. [Mapa de reparto: rojo palpitando (Muy tarde)](/admin/mirest?tab=parametros&campo=parametros-reparto-muy-tarde-min)
- **Velocidad media del repartidor** (reparto_velocidad_kmh): Velocidad promedio en moto que usa el sistema para estimar el tiempo de viaje por distancia, en el orden de la ruta y en el tiempo estimado al cliente. Ejemplo: Con 25 km/h, 5 km de recorrido se estiman en 12 minutos. [Velocidad media del repartidor](/admin/mirest?tab=parametros&campo=parametros-reparto-velocidad-kmh)
- **Máximo de pedidos por repartidor** (rep_max_pedidos): Cuántos pedidos puede llevar a la vez un repartidor. Con el tope lleno no puede tomar otro hasta entregar alguno. Es el mismo ajuste que «Máximo de pedidos (reparto)»: la pestaña Reparto guarda los dos juntos. Ejemplo: Con 5: el repartidor con 5 pedidos activos ve el mensaje «entrega alguno antes de tomar otro». [Máximo de pedidos por repartidor](/admin/mirest?tab=parametros&campo=parametros-rep-max-pedidos)
- **Máximo de pedidos por repartidor (reparto)** (reparto_max_pedidos): Mismo tope de pedidos simultáneos por repartidor, guardado junto con el anterior desde la pestaña Reparto. Ejemplo: Con 3: ningún repartidor puede tener más de 3 pedidos activos. [Máximo de pedidos por repartidor (reparto)](/admin/mirest?tab=parametros&campo=parametros-reparto-max-pedidos)
- **Minutos en la puerta antes del aviso de insistencia** (reparto_insistencia_min): Minutos que espera el repartidor en la puerta antes de que el cliente reciba el aviso 3 («estoy afuera»). También es el tiempo de gracia extra tras la espera máxima antes de retirar la moto. Ejemplo: Con 3: a los 3 minutos de llegar el cliente recibe el aviso; con espera máxima 10, la moto se retira a los 13. [Minutos en la puerta antes del aviso de insistencia](/admin/mirest?tab=parametros&campo=parametros-reparto-insistencia-min)
- **Espera máxima en la puerta** (reparto_espera_max_min): Minutos que espera el repartidor en la puerta antes de avisar al cliente que se retirará y ofrecer reprogramar. La moto se retira esa espera más los minutos de insistencia. Ejemplo: Con 10 y insistencia 3: aviso de espera agotada a los 10 minutos y retiro a los 13; el pedido vuelve a Listo con recargo. Riesgo alto: toca dinero o deja de atender clientes. [Espera máxima en la puerta](/admin/mirest?tab=parametros&campo=parametros-reparto-espera-max-min)
- **Costo de volver a enviar un pedido** (reprog_recargo_modo): Cuánto paga el cliente por reenviar un pedido tras una entrega fallida: igual al envío, un monto fijo o sin costo. Se le dice antes de que responda SÍ o NO y se cobra al reenviar. Ejemplo: «Igual al envío» con envío de S/ 6: reenviar cuesta S/ 6 más. «Monto fijo» cobra siempre el monto fijo. Riesgo alto: toca dinero o deja de atender clientes. [Costo de volver a enviar un pedido](/admin/mirest?tab=parametros&campo=parametros-reprog-recargo-modo)
- **Monto fijo por reprogramar** (reparto_recargo_reprogramacion): Monto que se cobra al reenviar un pedido cuando el costo de reprogramar está en «Monto fijo». Con los otros modos no se usa. Ejemplo: Con S/ 5 en modo fijo: todo reenvío cobra S/ 5, sin importar el pedido. Riesgo alto: toca dinero o deja de atender clientes. [Monto fijo por reprogramar](/admin/mirest?tab=parametros&campo=parametros-reparto-recargo-reprogramacion)
- **Tiempo del cliente para responder si reprograma** (reprog_respuesta_min): Minutos que tiene el cliente para contestar SÍ o NO a reprogramar tras el retiro del repartidor. Si no responde, el pedido se cancela por falta de respuesta. Ejemplo: Con 30: si a los 30 minutos no contestó, el pedido se cancela. Riesgo alto: toca dinero o deja de atender clientes. [Tiempo del cliente para responder si reprograma](/admin/mirest?tab=parametros&campo=parametros-reprog-respuesta-min)
- **Reprogramaciones máximas por pedido** (reprog_max_intentos): Cuántas veces se puede reprogramar el mismo pedido tras una espera agotada. Al llegar al tope ya no se pregunta y el pedido se cancela. Ejemplo: Con 1: la segunda entrega fallida cancela el pedido directo. Riesgo alto: toca dinero o deja de atender clientes. [Reprogramaciones máximas por pedido](/admin/mirest?tab=parametros&campo=parametros-reprog-max-intentos)

## Errores y dudas comunes
- "Los umbrales deben estar en orden ascendente (retrasado < tarde < muy tarde)": corrige los tres números para que crezcan.
- El repartidor no puede tomar otro pedido: llegó al máximo de pedidos por repartidor.
- Cambié el tiempo del cliente para responder y sigue igual: ese plazo está en Parámetros ("Tiempo del cliente para responder si reprograma"), no en la pestaña Entregas fallidas.
- Si el cliente no responde a tiempo, el pedido se cancela por falta de respuesta; si se llega al máximo de reprogramaciones, el pedido se cancela directo.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El administrador no escribe código de supervisor: el sistema lo autoriza solo y el cambio queda en el historial de auditoría.
