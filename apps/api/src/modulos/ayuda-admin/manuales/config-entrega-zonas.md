---
modulo: mirest
titulo: Configuración: Entrega y zonas de reparto
ruta: /admin/mirest
seccion: entrega-zonas
activa_con: [tab=entrega, tab=zonas]
permiso: local/ver
roles: [ADMIN]
relacionados: [zonas, repartos, caja, mapa]
sugerencias:
  - ¿Dónde cambio el monto de envío gratis y el pedido mínimo?
  - ¿Cómo cambio la tarifa o los minutos de una zona de reparto?
  - ¿Cómo apago una zona un día de lluvia?
  - ¿Por qué un cliente cercano queda fuera de cobertura?
---
# Configuración: Entrega y zonas de reparto

## Para que sirve
Reúne lo que decide cuánto cuesta y si se acepta un delivery: el pedido mínimo, el monto desde el que el envío es gratis y las zonas de reparto dibujadas en el mapa (su tarifa, sus minutos y si están activas). La pestaña "Entrega" no se edita: remite a Parámetros del sistema. La pestaña "Zonas de reparto (mapa)" es la misma pantalla del módulo [[zonas]]; el reparto físico lo coordina [[repartos]].

## Como se hace: cambiar el envío gratis o el pedido mínimo
1. En Configuración del local abre la pestaña "Entrega" ([Entrega](/admin/mirest?tab=entrega)). Cada fila dice "Se edita en Parámetros → …" y tiene un enlace.
2. Pulsa el enlace de la fila que quieras: te lleva a la fila exacta en Parámetros del sistema (por ejemplo [Monto de compra para envío gratis](/admin/mirest?tab=parametros&campo=parametros-envio-gratis-monto)).
3. Pulsa "Editar" en esa fila, escribe el nuevo valor y pulsa "Guardar". Confirma con "Sí, guardar" en "¿Guardar parámetro de operación?".
4. "Cómo se compara el monto de envío gratis" admite "desde" (el monto exacto ya cuenta: S/ 70 o más) o "mas_de" (hay que superarlo: más de S/ 70).

## Como se hace: cambiar tarifa, minutos o estado de una zona
1. Abre la pestaña "Zonas de reparto (mapa)" ([Zonas de reparto (mapa)](/admin/mirest?tab=zonas)) o el módulo Zonas de reparto.
2. Toca la zona en el mapa o en la lista. Usa "Editar tarifa" (S/ 0 o más), "Editar minutos" (enteros de 5 a 120, el mínimo no puede pasar del máximo) o "Desactivar" / "Activar".
3. Confirma con Sí/No. Los cambios rigen solo para pedidos nuevos; los pedidos ya creados conservan su envío y su zona.
4. Los pasos detallados (editar el área en el mapa, normalizar zonas, probar un punto) están en el manual de Zonas de reparto: [[zonas]].
Ver tambien: [[zonas]]

## Ajustes: Entrega, envío gratis y zonas
- **Zonas de reparto en el mapa**: Dibuja el área que cubre cada zona. Define a qué dirección se puede enviar, qué tarifa y qué tiempo se le dice al cliente. Un punto fuera de toda zona activa queda «fuera de cobertura». Riesgo alto: toca dinero o deja de atender clientes. [Zonas de reparto en el mapa](/admin/mirest?tab=zonas&campo=zonas-mapa)
- **Tarifa de envío de la zona (S/)** (zona_reparto.tarifa): Lo que paga de envío el cliente cuyo pedido cae en esa zona (botón «Editar tarifa»), salvo que alcance el envío gratis. Rige solo para pedidos nuevos: los ya creados conservan su envío y su zona. Ejemplo: Zona 3 a S/ 6: el cliente de esa zona paga S/ 6 de envío. rango 0 o más (0 = envío sin costo), unidad S/. Riesgo alto: toca dinero o deja de atender clientes. [Tarifa de envío de la zona (S/)](/admin/mirest?tab=zonas&campo=zonas-tarifa)
- **Tiempo de entrega de la zona (mínimo y máximo)** (zona_reparto.minutos_min/minutos_max): Rango de minutos que se le dice al cliente de esa zona (botón «Editar minutos»); también alimenta el aviso de WhatsApp y el estimado del reparto. Rige solo para pedidos nuevos: los ya creados conservan su envío y su zona. Ejemplo: De 25 a 40: el cliente lee «25 a 40 min». rango Enteros de 5 a 120; el mínimo no puede pasar del máximo, unidad minutos. [Tiempo de entrega de la zona (mínimo y máximo)](/admin/mirest?tab=zonas&campo=zonas-minutos)
- **Encender o apagar una zona** (zona_reparto.activa): Una zona apagada deja de recibir delivery: sus direcciones quedan fuera de cobertura. Rige solo para pedidos nuevos: los ya creados conservan su envío y su zona. Ejemplo: Apagar la zona 5 un día de lluvia fuerte. Riesgo alto: toca dinero o deja de atender clientes. [Encender o apagar una zona](/admin/mirest?tab=zonas&campo=zonas-activa)
- **Envío gratis sobre la tarifa de zona** (envio_gratis_monto / envio_gratis_modo): La tarifa que ves en cada zona es la tarifa pura. Si el pedido supera el monto de envío gratis, el cliente no la paga. El monto y si exige «más de» o «desde» se cambian en Parámetros del sistema. Ejemplo: Con envío gratis desde S/ 70 y tarifa S/ 6: un pedido de S/ 80 no paga los S/ 6. valor por defecto 70 y «más de». Riesgo alto: toca dinero o deja de atender clientes. [Envío gratis sobre la tarifa de zona](/admin/mirest?tab=zonas&campo=zonas-envio-gratis)
- **Tolerancia de pegado entre zonas (metros)** (zonas_snap_m): Distancia máxima a la que el mapa pega solo el borde de una zona al de su vecina para no dejar huecos ni solapes (botones «Pegar a zonas vecinas», «Arreglar» y «Normalizar»). Es el parámetro zonas_snap_m; no tiene pantalla propia. Ejemplo: Con 15, dos bordes a menos de 15 m se unen. valor por defecto 15, unidad metros. [Tolerancia de pegado entre zonas (metros)](/admin/mirest?tab=zonas&campo=zonas-snap-m)
- **Editar el área de una zona en el mapa (vértices)** (zona_reparto.poligono): Arrastra los puntos (vértices) para mover el borde, toca un cuadrito entre dos puntos para agregar uno, o quita el seleccionado (mínimo 3). Nada se guarda hasta confirmar con Sí/No. Ejemplo: Mover un vértice para incluir una calle más en la zona 3. rango Mínimo 3 vértices. Riesgo alto: toca dinero o deja de atender clientes. [Editar el área de una zona en el mapa (vértices)](/admin/mirest?tab=zonas&campo=zonas-editar-area)
- **Normalizar todas las zonas**: Arregla de una vez los huecos finos y los solapes entre zonas activas. Si dos zonas se pisan, te pide elegir cuál conserva el área compartida. Muestra una vista previa y aplica todo o nada con Sí/No. Riesgo alto: toca dinero o deja de atender clientes. [Normalizar todas las zonas](/admin/mirest?tab=zonas&campo=zonas-normalizar)
- **Coordenadas de la zona (JSON avanzado)** (zona_reparto.poligono): Respaldo para pegar a mano los puntos [latitud, longitud] que limitan una zona (botón «Editar JSON» o «Ver / Editar polígono»). Se valida antes de guardar. Ejemplo: [[-12.015, -76.968], [-12.012, -76.964], [-12.018, -76.962]]. rango Mínimo 3 puntos. Riesgo alto: toca dinero o deja de atender clientes. [Coordenadas de la zona (JSON avanzado)](/admin/mirest?tab=zonas&campo=zonas-poligonos)
- **Monto de compra para envío gratis** (envio_gratis_monto): Total de productos desde el cual el delivery no cobra envío. Lo aplican la carta, el chatbot y el cálculo del pedido. Ejemplo: Con 70 en modo «mas_de»: una compra de S/ 71 no paga envío; una de S/ 70 exacto sí paga. Riesgo alto: toca dinero o deja de atender clientes. [Monto de compra para envío gratis](/admin/mirest?tab=parametros&campo=parametros-envio-gratis-monto)
- **Cómo se compara el monto de envío gratis** (envio_gratis_modo): Escribe «desde» para que el monto exacto ya cuente (S/ 70 o más), o «mas_de» para exigir superar el monto (más de S/ 70). Ejemplo: Con monto 70: en «desde» una compra de 70 es gratis; en «mas_de» no. Riesgo alto: toca dinero o deja de atender clientes. [Cómo se compara el monto de envío gratis](/admin/mirest?tab=parametros&campo=parametros-envio-gratis-modo)
- **Pedido mínimo** (pedido_minimo): Monto mínimo de productos para que el sistema acepte un pedido nuevo. Si el cliente no llega, el pedido se rechaza con el aviso del monto mínimo. Ejemplo: Con 25: un pedido de S/ 20 en productos no se acepta; uno de S/ 25 sí. Riesgo alto: toca dinero o deja de atender clientes. [Pedido mínimo](/admin/mirest?tab=parametros&campo=parametros-pedido-minimo)

## Errores y dudas comunes
- Un cliente cercano queda "fuera de cobertura": su punto cae fuera de toda zona activa o la zona está apagada.
- El envío salió gratis o cobrado distinto a lo esperado: revisa el monto y el modo ("desde" o "mas_de"); la tarifa que ves en cada zona es la tarifa pura.
- Cambié la tarifa y un pedido ya creado no cambió: los cambios rigen solo para pedidos nuevos.
- El pedido mínimo rechaza pedidos: si el cliente no llega al monto, el pedido se rechaza con el aviso del mínimo.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El cambio queda en el historial de auditoría. Para las zonas, ver o cambiar requiere zonas/ver o zonas/editar, también exclusivos del Administrador.
