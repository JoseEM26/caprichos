---
modulo: mirest
titulo: Configuración: Alta demanda y pausa de pedidos
ruta: /admin/mirest
seccion: alta-demanda
activa_con: [tab=demanda]
permiso: local/ver
roles: [ADMIN]
relacionados: [cocina, mensajes, caja]
sugerencias:
  - ¿Cómo activo la alta demanda y agrego minutos al tiempo de entrega?
  - ¿Cómo pauso los pedidos de la carta y del chatbot?
  - ¿Cómo apago la alta demanda cuando pasa la hora pico?
  - ¿Por qué no puedo pausar los pedidos?
---
# Configuración: Alta demanda y pausa de pedidos

## Para que sirve
Cuando la cocina está congestionada, suma minutos extra al tiempo de entrega que prometen la carta virtual y el chatbot y, si hace falta, pausa la recepción de pedidos. Se ve de inmediato en la carta, el chatbot y todas las áreas. Cocina también puede activarla desde su propia pantalla ([[cocina]]).

## Como se hace: activar la alta demanda con minutos extra
1. En Configuración del local abre la pestaña "Alta demanda y pausa de pedidos" ([Alta demanda y pausa de pedidos](/admin/mirest?tab=demanda)).
2. Elige un atajo de minutos extra (de +5 a +60) o escribe otro valor en "Otro (min)": solo enteros de 5 a 180.
3. Pulsa "Activar alta demanda (+N min)" y, en "¿Activar la alta demanda?", pulsa "Sí, activar". Los minutos se suman al "Tiempo prometido de entrega" de Parámetros: con base 30 y +15, la carta anuncia 45 minutos para los pedidos nuevos.

## Como se hace: pausar la recepción de pedidos
1. En esta pestaña elige "Pausar pedidos" (la otra opción es "Seguir recibiendo pedidos"). La pausa solo se puede activar con la alta demanda encendida.
2. Con la alta demanda ya encendida, pulsa "Guardar cambios (+N min, con pausa)" y confirma en "¿Guardar cambios en la alta demanda?".
3. Con la pausa activa la carta aparece cerrada ("Por ahora no estamos recibiendo pedidos") y el chatbot no toma pedidos nuevos.

## Como se hace: apagar la alta demanda
1. En la misma pestaña pulsa "Apagar alta demanda" y confirma en "¿Apagar la alta demanda?".
2. Se quitan los minutos extra y la pausa: la carta y el chatbot vuelven al tiempo normal y se reanuda la recepción de pedidos. Al apagar la alta demanda, la pausa se quita sola.

## Ajustes: Alta demanda
- **Estado actual de la alta demanda y quién la cambió**: Muestra si la alta demanda está activada o apagada, los minutos extra vigentes, si hay pausa y quién hizo el último cambio con fecha y hora de Lima. Solo informa. Ejemplo: ACTIVADA (+30 min, pedidos en pausa) · Activó Ana · 29/10/2026 20:15. Permiso: cocina/demanda. [Estado actual de la alta demanda y quién la cambió](/admin/mirest?tab=demanda&campo=demanda-estado-actual)
- **Minutos extra de espera por alta demanda**: Suma minutos al tiempo de entrega que la carta virtual y el chatbot le prometen al cliente mientras la cocina está congestionada. Se suman al «Tiempo prometido de entrega» de Parámetros. Elige un atajo (+5 a +60) o escribe otro valor. Ejemplo: Si el tiempo base es 30 y eliges +15, la carta anuncia 45 minutos para los pedidos nuevos. Permiso: cocina/demanda. [Minutos extra de espera por alta demanda](/admin/mirest?tab=demanda&campo=demanda-minutos-extra)
- **Otro valor de minutos extra (entre 5 y 180)**: Campo para escribir unos minutos extra distintos de los atajos. Solo acepta enteros de 5 a 180; fuera de ese rango no deja continuar. Ejemplo: Escribe 75 para anunciar 75 minutos más en la carta y el chatbot. Permiso: cocina/demanda. [Otro valor de minutos extra (entre 5 y 180)](/admin/mirest?tab=demanda&campo=demanda-otro-minutos)
- **Pausar la recepción de pedidos**: Con la pausa activa la carta aparece cerrada («Por ahora no estamos recibiendo pedidos») y el chatbot no toma pedidos nuevos. Solo se puede activar con la alta demanda encendida; al apagar la alta demanda la pausa se quita sola. Ejemplo: Cocina desbordada: pones +30 con pausa y nadie puede pedir hasta reanudar. Riesgo alto: toca dinero o deja de atender clientes. Permiso: cocina/demanda. [Pausar la recepción de pedidos](/admin/mirest?tab=demanda&campo=demanda-pausa-pedidos)
- **Activar o guardar los cambios de alta demanda**: Aplica los minutos extra y la pausa elegidos. Pide confirmación Sí/No y el cambio se ve de inmediato en la carta, el chatbot y todas las áreas. Ejemplo: Activar alta demanda (+30 min) y confirmar con «Sí, activar». Riesgo alto: toca dinero o deja de atender clientes. Permiso: cocina/demanda. [Activar o guardar los cambios de alta demanda](/admin/mirest?tab=demanda&campo=demanda-confirmar-guardar)
- **Apagar la alta demanda**: Quita los minutos extra y la pausa: la carta y el chatbot vuelven al tiempo normal y se reanuda la recepción de pedidos. Pide confirmación Sí/No. Ejemplo: Pasó la hora pico: apagas y la carta anuncia otra vez el tiempo base. Riesgo alto: toca dinero o deja de atender clientes. Permiso: cocina/demanda. [Apagar la alta demanda](/admin/mirest?tab=demanda&campo=demanda-apagar)
- **Pausa de pedidos por alta demanda** (pausa_alta_demanda): Estado de la pausa: con ella activa la carta aparece cerrada y el chatbot no toma pedidos nuevos. Solo se lee aquí; se activa en la pestaña Alta demanda. Ejemplo: Pausa activa: el cliente ve «Por ahora no estamos recibiendo pedidos». Riesgo alto: toca dinero o deja de atender clientes. [Pausa de pedidos por alta demanda](/admin/mirest?tab=parametros&campo=parametros-pausa-alta-demanda)
- **Minutos base por alta demanda** (alta_demanda_min_base): Aparece como parámetro pero ninguna pantalla ni regla lo lee. Los minutos extra se eligen al activar la alta demanda, en su pestaña. Ejemplo: Si pones 20 aquí, la alta demanda no cambia. [Minutos base por alta demanda](/admin/mirest?tab=parametros&campo=parametros-alta-demanda-min-base)
- **Tiempo prometido de entrega (base)** (tiempo_prometido_min): Minutos de espera que se le dicen al cliente como base, en la carta y en el chatbot. La alta demanda le suma sus minutos encima. También es el respaldo del aviso «tiempo estimado» cuando el pedido no tiene zona ni ubicación. Ejemplo: Si pones 30 y hay alta demanda de +15, la carta anuncia 45 minutos. [Tiempo prometido de entrega (base)](/admin/mirest?tab=parametros&campo=parametros-tiempo-prometido-min)

## Errores y dudas comunes
- No puedo activar la pausa: la pausa solo se activa con la alta demanda encendida.
- No me deja escribir 200 minutos: el rango de "Otro" es de 5 a 180.
- "Minutos base por alta demanda" en Parámetros no cambia nada: ninguna pantalla lo lee; los minutos extra se eligen al activar la alta demanda.
- El estado actual muestra quién activó y cuándo (hora de Lima): solo informa.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El administrador no escribe código de supervisor: el sistema lo autoriza solo y el cambio queda en el historial de auditoría. Activar o cambiar la alta demanda requiere el permiso cocina/demanda, que también tiene el personal de Cocina desde la pantalla de Cocina.
