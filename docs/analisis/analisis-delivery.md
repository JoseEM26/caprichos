---
id: ANA-CAP-057
tipo: analisis
titulo: "Análisis del delivery (acta 03)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-21
relacionados: [BRD-CAP-001, FT-PED-02, FT-DEL-01, FT-DEL-02, FT-DEL-03, FT-CAJ-01]
tags: [analisis, apoyo, delivery]
---

# Análisis del delivery (acta 03, 20/10/2026)

> Informe de apoyo. Decisiones tomadas: DT-57 a DT-60 en `analisis/decisiones.md`. Lo que este informe propone y aún no está decidido queda como pendiente D-31 a D-35. Fuente principal: `actas/acta-03-revision-mockup.md` §1, §6 y §17. El delivery fue el tema más largo de la reunión.

## Resumen

| # | Problema | Qué ya está resuelto (documentos y mockup v210) | Brecha que queda |
|---|---|---|---|
| P1 | El cliente da una ubicación equivocada o imprecisa | Mapa con punto movible y «Mi pedido llega aquí»; zonas invisibles; ubicación opcional (DT-57) | Avisar cuando el GPS es impreciso; medir cuántas entregas fallan por dirección |
| P2 | El repartidor no ve prioridades ni rutas en hora punta | Mapa principal con nombre, código, colores por espera, zonas y orden sugerido (DT-59) | El orden se calcula en línea recta; tomar varios pedidos a la vez; mapa real en el sistema |
| P3 | El cliente no contesta y la comida se enfría | Mensajes automáticos al salir y al llegar, que se cortan si el cliente responde (DT-60) | Costo de las plantillas de Meta; plan B manual mientras no haya API |
| P4 | No se sabe qué pedido lleva cada repartidor | Cada repartidor tiene su usuario; solo uno puede tomar un pedido (RN-CAP-024) | Límite de pedidos por repartidor; reasignación por caja |
| P5 | No hay una medida de qué es «tarde» | Rango de 25 a 35 minutos; naranja desde 35 y rojo desde 50 (V1, D-29) | Meta propia de cocina; línea base con datos reales |
| P6 | El despacho no sabe qué sale | Vista de despacho y copia impresa (DT-58) | Pantalla física en despacho (equipos, DEP-03) |
| P7 | Entrega fallida sin evidencia | Espera máxima de 10 minutos; volver al local; coordinación (FT-DEL-03) | Registrar llamadas y una foto como prueba (Kevin lo mencionó) |
| P8 | Pedidos que se cocinan sin pago | Caja coordina el pago y anula con PIN (DT-57, DT-61) | Riesgo de pedidos falsos; regla para clientes nuevos con montos altos |
| P9 | Zonas y tarifas | Zona automática; sin huecos entre zonas (FT-DEL-01) | Faltan las tarifas vigentes (D-03, DEP-07) |
| P10 | Seguir al repartidor en vivo | Descartado por costo (DT-59) | El costo real es bajo; los motivos de fondo son privacidad y batería (ver P10) |

## P1. Ubicación del cliente

- **Problema.** Hoy el cliente pide rápido y el GPS sale impreciso, o escribe una calle que existe en dos distritos (Las Águilas en Carrión y en Huachipa). El repartidor se adelanta y llega al lugar equivocado. En OlaClick el cliente no veía el mapa, solo un texto («Cercado de Lima»). Además, según Kevin, entre el 15 y el 20 % de los clientes movía el punto a la zona más barata y después decía «vivo más arriba».
- **Necesidad.** Que el punto que recibe el repartidor sea el de la puerta donde se entrega.
  - Métrica propuesta: porcentaje de entregas con el incidente «No encuentro la dirección».
  - No hay línea base: Kevin dijo «con recurrencia», sin cifra. Se mide la primera semana del piloto.
- **Ya existe:**
  - Mapa con el punto, botones para moverlo y confirmación obligatoria antes de pedir (mockup v210, FT-PED-02).
  - El mapa no dibuja las zonas.
  - Sin ubicación, el pedido se cocina igual, pero no puede salir hasta que caja lo ubique (FT-CAJ-01).
- **Falta:**
  - Si el GPS dice que la precisión es peor que unos 50 metros, mostrar «Tu ubicación es aproximada: revisa el punto». Hoy solo se muestra la precisión en el texto.
  - Que el repartidor vea la referencia escrita junto al punto. Ya se muestra en el resumen del mapa.
- **Riesgo.** El cliente puede confirmar sin mirar. La confirmación ayuda pero no lo garantiza; por eso se mantiene la llamada del repartidor antes de llegar.

## P2. El mapa del repartidor

- **Problema.** En restaurant.pe, con mucha demanda, el repartidor «se marea»: no ve qué pedido llegó antes, cuánto espera cada cliente ni dónde está. Tiene que entrar y salir de Google Maps por cada pedido. Ejemplo de Kevin: unas donas listas a media cuadra deberían salir antes que un pedido con más retraso en El Agustino.
- **Necesidad.** Que el repartidor decida su ruta en segundos, desde una sola pantalla y con una mano.
- **Ya existe (DT-59, mockup v210):**
  - Mapa a pantalla completa con zoom automático.
  - Nombre completo y código chico en cada punto.
  - Verde, naranja y rojo que palpita, según la espera.
  - Zonas y orden sugerido.
  - Resumen al tocar un punto con Llamar, WhatsApp y Navegar.
  - Un botón grande con cuatro estados.
- **Falta:**
  - **El orden sugerido usa distancia en línea recta.** En San Juan de Lurigancho hay cerros, el puente y calles cerradas, así que la línea recta puede mentir. Para la primera versión basta, porque es solo una sugerencia y decide el repartidor. Si en el piloto el orden se ignora seguido, se evalúa un servicio de rutas: OSRM con datos de OpenStreetMap es gratis, pero hay que alojarlo.
  - **Tomar varios pedidos a la vez:** propuesta de hasta 3, configurable (D-32).
  - **Mapa real:** en el mockup es un dibujo; en el sistema real es Leaflet con OpenStreetMap, sin costo por uso (ADR del mapa interno).

## P3. Avisos al cliente durante la entrega

- **Problema.** El cliente no ve el WhatsApp. El repartidor espera en la puerta y los productos se enfrían o se derriten.
- **Ya existe (DT-60):**
  - Mensaje 1 al pulsar «En camino».
  - Mensaje 2 al pulsar «He llegado».
  - Mensaje 3 si no responde en minuto y medio (lo dijo Kevin; DT-74), con la espera máxima de 10 minutos.
  - Si el cliente responde, no se envían más. Los textos son editables.
- **Falta, y es lo más importante de este informe:**
  - **Costo de Meta.** Un mensaje que inicia el negocio es una plantilla y se cobra. Las respuestas dentro de las 24 horas desde el último mensaje del cliente son gratis.
    - Si el cliente nunca escribió, cada aviso puede costar.
    - Un pedido podría generar hasta cuatro plantillas: el resumen y tres avisos.
    - Hay que verificar el precio vigente para Perú (D-08) y medir cuántas se envían al mes.
    - Mitigación: los botones de respuesta («Ya salgo») hacen que el cliente responda, se abre la ventana gratuita y no se envían los siguientes avisos.
  - **Dependencia del bot — resuelta (DT-72, 21/10/2026):** José ya tiene la API de WhatsApp de Meta, así que los avisos salen automáticos. Plan B que se había propuesto (D-31), ya no necesario: mientras no esté la API, los botones «En camino» y «He llegado» abren WhatsApp con el mensaje ya escrito y el repartidor solo toca «Enviar». No cuesta nada y no depende de Meta.

## P4. Asignación entre repartidores

- **Ya existe:**
  - Cada repartidor tiene su usuario.
  - «Tomar pedido» lo asigna, y si dos lo intentan a la vez solo uno lo recibe; el bloqueo es en el servidor (RNF-CAP-010).
  - Caja puede reasignar.
- **Resuelto (DT-68, 21/10/2026):** hasta 3 pedidos a la vez, configurable.
- **Falta:**
  - Qué pasa con los pedidos de un repartidor que termina su turno. Con el horario de trabajo (DT-64), el sistema puede avisar a caja.

## P5. Tiempos

- **Ya existe:**
  - Se le dice al cliente de 25 a 35 minutos (V1), y la alta demanda le suma minutos.
  - El mapa se pone naranja desde los 35 minutos y rojo desde los 50 (D-29).
  - La pantalla de cocina se pone ámbar a los 19 minutos y roja a los 25.
- **Resuelto (DT-69, 21/10/2026):** revisado el audio, Kevin no dio un tiempo para cocina; dio 25 ideal, 35 retraso y 50 crítico contados desde que el cliente terminó el pedido. Cocina y reparto usan esos mismos tiempos.
- **Antes se proponía:**
  - **Una meta de cocina coherente con la de entrega (D-33).** Si el cliente espera como mucho 35 minutos y el viaje toma de 10 a 15, cocina debería tener lista la comanda en unos 15 a 20 minutos. Propuesta: meta de cocina de 15 minutos para delivery, que se ajusta con la medición.
  - **Línea base:** hoy no se mide. El sistema registra las horas de toma, salida, llegada y entrega desde el primer día (FT-DEL-02, RQ de estados).

## P6. Despacho

- **Ya existe:** vista de Despacho con el pedido completo, lo que falta de cada área y una copia impresa (DT-58).
- **Falta:** saber si en despacho habrá una pantalla o si se usará la copia impresa. Depende de los equipos del local (DEP-03).

## P7. Entrega fallida

- **Ya existe:** la espera máxima de 10 minutos, «volver al local», el pedido en coordinación y las opciones reprogramar, devolver o cobrar igual (FT-DEL-03).
- **Falta:** Kevin dijo que el repartidor **«va a tomar foto y va a tener registro de las llamadas»**. No está documentado. **Propuesta (D-34):**
  - Al reportar «No contesta», el sistema guarda cada intento de llamada y de mensaje con su hora (sale de los botones Llamar y WhatsApp).
  - Permite una foto opcional de la puerta.
  - Esto sirve como prueba si el cliente reclama.
  - Riesgo: la foto puede mostrar personas o casas, que son datos personales. Se guarda en la carpeta privada (ADR-005).
- **Resuelto (DT-70, 21/10/2026):** se adopta la propuesta, pero la foto **no se borra a los 30 días**: se conserva como el Historial de acciones (2 años y luego archivo cifrado). La ley pide un plazo definido, que se fija en la política de privacidad (D-18).

## P8. Pedido que se cocina sin pago

- **Problema que crea DT-57.** El pedido de la carta va directo a cocina, sin esperar la captura de pago. Si es una broma o el cliente no paga, se pierde lo cocinado.
- **Ya existe:**
  - «Pago por coordinar» en caja.
  - La anulación con motivo y el PIN de la supervisora.
  - Un recordatorio a los 5 minutos.
- **Resuelto (DT-71, 21/10/2026):** todo directo, también el chatbot, **sin freno**. Riesgo aceptado; se mide cuántos pedidos se anulan por falta de pago.

## P9. Zonas y tarifas

- **Ya existe:** zona y costo calculados solos; aviso de huecos entre zonas; envío gratis desde S/ 70.
- **Falta:** las tarifas y zonas vigentes de Kevin (D-03, DEP-07). Sin ellas, el piloto cobraría con valores de ejemplo.

## P10. Ubicación del repartidor en tiempo real

- **Corrección honesta.** En la reunión se descartó por «costo de la API». En realidad, con el GPS del celular del repartidor y el mapa de OpenStreetMap, **el costo es casi cero**: no hace falta una API de pago.
- **Lo que de verdad cuesta:**
  - **Privacidad:** la ubicación del repartidor es un dato personal (Ley N.° 29733) y hace falta su consentimiento.
  - **Batería y datos** de su celular.
  - **Complejidad:** pide enviar la posición cada pocos segundos y tener la web abierta.
- **Recomendación (D-35):** mantenerlo fuera de la primera versión, como se decidió, pero por estos motivos y no por costo. Volver a evaluarlo después del piloto si los avisos «En camino» y «He llegado» no bastan.

## Orden sugerido

1. **P1 ubicación y P9 tarifas.** Sin un punto correcto y tarifas reales no hay piloto.
2. **P2 mapa y P4 asignación.** Son el centro del trabajo del repartidor.
3. **P6 despacho y P5 tiempos.** Despacho evita viajes a caja; los tiempos se miden desde el día 1.
4. **P3 avisos.** Primero el plan B manual (D-31) y luego la API de Meta cuando esté.
5. **P7 evidencia y P8 regla de pago.** Se ajustan con lo que pase en el piloto.
6. **P10.** Después del piloto.

## Preguntas abiertas para Kevin

1. ~~¿Cuántos pedidos lleva un repartidor (D-32)?~~ Resuelto: hasta 3 (DT-68).
2. ~~¿Meta de cocina (D-33)?~~ Resuelto: los tiempos de Kevin, 25/35/50 (DT-69).
3. ~~¿Evidencia en entregas fallidas (D-34)?~~ Resuelto: llamadas y foto opcional, sin borrado a los 30 días (DT-70).
4. ~~¿Freno a clientes nuevos (D-26)?~~ Resuelto: sin freno (DT-71).
5. ¿Las tarifas y zonas vigentes (D-03)?
6. ¿La plantilla de los tres mensajes (D-27) y quién asume el costo de Meta (D-08)?
7. Los colores del mapa: ¿verde hasta 35 y rojo desde 50 (D-29)?

---
Generado por IA: análisis del delivery a partir del acta 03, las decisiones DT-57 a DT-60, las features FT-PED-02, FT-DEL-01 a FT-DEL-03 y FT-CAJ-01, y el mockup v210 — Revisado por: *(pendiente)*
