---
id: ANA-CAP-041
tipo: analisis
titulo: "Pantalla de cocina en la TV (análisis técnico)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-13
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, analisis]
---

# Pantalla de cocina en la TV (análisis técnico)

> Borrador para revisión, por confirmar con Kevin. La decisión se formaliza después en un ADR.

## 1. Cómo funciona hoy en restaurant.pe (observado, solo lectura)
Fuente: `web-anterior/administrativo/modulos/ventas.md`, sección "Pantalla de Cocina / KDS".
- La pantalla de cocina es **una página web más** (`#!/ventas/ver-pedidos/estado`). No hay señal de video que se envíe: el dispositivo de cocina **abre la página en un navegador**.
- Las comandas llegan **en tiempo real** (WebSockets / Firebase) y suena un timbre; además la página se vuelve a consultar cada 60 segundos como respaldo.
- Muestra tarjetas por estado (pendiente, en preparación), con colores por tiempo (azul, naranja desde 15 min, rojo desde 20 min), filtros por estación (cocina, barra, repostería) y opción de **ocultar la barra lateral** para verla a pantalla completa.
- El cocinero pulsa para **empezar a preparar**, **marcar listo** o **agotar** un producto.

## 2. Aclaración de Kevin/equipo (por confirmar)
- La **TV es solo para visualizar**: no se toca ni se administra desde ella.
- En cocina hay una **mini computadora** desde donde se administra y se marca el avance de los pedidos (en preparación, listo, agotado).
- Hay **una computadora en caja** donde se cobra, se registra la compra y está conectada la ticketera.

## 3. Diseño propuesto
- Una **URL de solo lectura** ("modo TV") que muestra los pedidos en cocina: letra grande, colores por tiempo, timbre opcional, sin botones ni menús, que se actualiza sola.
- La TV abre esa URL (navegador de la TV o aparato por HDMI). Como no se toca, no importa que sea táctil o no.
- La **mini computadora de cocina** abre la vista de cocina normal (con botones) y es la que cambia los estados; la TV los refleja al instante.
- La URL de TV no pide usuario: usa un **enlace privado con código** que no da acceso a nada más, y se puede regenerar si se filtra.
- Si cae internet, la TV muestra el aviso "sin conexión" en vez de datos viejos.

### 3.1 Acceso de la TV: URL aparte, sin usuario, con llave propia
- **No va dentro del administrativo ni con un usuario.** Una sesión de usuario vence (por ejemplo a las 3 horas) y la TV quedaría pidiendo login o en blanco en plena atención.
- **Solución:** una URL aparte (por ejemplo `/pantalla/<código largo>`) con una **llave de dispositivo** que no vence sola, solo se anula a mano. Esa llave **solo permite ver la lista de pedidos de cocina**: no sirve para entrar al administrativo ni para modificar nada.
- **Cómo se vincula la TV (como en las apps de TV):** la TV muestra un **código corto** en pantalla; el administrador lo escribe en el administrativo (módulo "Pantallas", con confirmación Sí/No) y la TV queda vinculada. Alternativa más simple: el administrador genera el enlace y lo abre una sola vez en la TV.
- **Seguridad:**
  - la llave es larga y aleatoria, imposible de adivinar;
  - el administrador ve las pantallas vinculadas y puede **desactivar** una (no se elimina) si se pierde o se filtra; la TV muestra "Pantalla desvinculada";
  - muestra solo lo necesario (código, productos, nota y tiempo; **sin teléfono ni dirección** del cliente);
  - opcional: aceptar la llave solo desde la conexión a internet del local.
- **Si se corta internet o se reinicia la TV:** se reconecta sola con la misma llave, sin que nadie escriba nada.
- **La mini computadora de cocina sí usa usuario y contraseña** (rol "Cocina y barra"), porque cambia estados; su sesión debe renovarse sola mientras se use y avisar antes de vencer.

## 4. Opciones para que la TV abra la URL

| Opción | Cómo se ve | Pros | Contras |
| :-- | :-- | :-- | :-- |
| **A. Mini PC, caja Android TV o Chromecast con Google TV por HDMI** (recomendada) | El aparato abre el navegador en pantalla completa (modo quiosco) con la página de cocina; la TV es solo el monitor. | Estable, barato, arranca solo al encender, no depende del navegador de la TV. | Un aparato más; si la TV no es táctil, hay que marcar los pedidos con mouse, teclado o tablet. |
| **B. El navegador de la Smart TV** | Se escribe la dirección en el navegador de la TV. | Cero hardware extra. | Navegadores de TV lentos, se actualizan poco, se cierran solos o piden reingresar; poco fiable. |
| **C. Enviar la pantalla desde otro aparato** (cast, espejo, cable HDMI desde la PC de caja) | La TV copia lo que ve otra pantalla. | Rápido de probar. | Depende de que ese aparato siga encendido; si cierra la sesión, la TV se queda en negro. |
| **D. Tablet fija en cocina** | La página en una tablet. | Táctil: marcar listo con el dedo. | Pantalla pequeña para ver desde lejos. |

**Recomendación:** A (o B si la TV tiene navegador aceptable) abriendo la URL de solo lectura; los estados se marcan en la mini computadora de cocina.

## 5. Qué debe cumplir el sistema nuevo
- Una **vista "Pantalla de cocina"** a pantalla completa con letra grande, legible a 3 metros.
- **Sesión que no se cierra** (usuario "Cocina" dedicado) y **recarga sola** si se corta internet.
- **Timbre** al llegar un pedido y **colores por tiempo** con la meta de 13 minutos.
- **Separación por estación** (cocina, barra) para que cada pantalla vea solo lo suyo.
- Mostrar el **pedido completo**: productos, tamaño, leche, endulzante, cremas, adicionales y nota.
- La TV debe **no apagarse sola** (reposo de pantalla desactivado).
- Impresión y pantalla funcionan **juntas**: la comanda se imprime y aparece en la pantalla; si una falla, la otra sigue (ver `impresion-tickets.md`).

## 6. Preguntas para Kevin
0. ¿Prefieren vincular la TV con un código en pantalla o abriendo un enlace una sola vez?
0. ¿Confirmas que la TV es solo visual y que los estados se marcan en la mini computadora de cocina?
1. ¿Qué TV(s) hay o se comprarán, y de qué marca? ¿Tiene HDMI libre y está cerca de una PC o de un enchufe?
2. ¿Una pantalla para cocina y otra para barra, o una sola?
3. ¿La mini computadora de cocina tiene pantalla propia, o la TV es la única pantalla?
4. ¿Hay internet estable en cocina (cable o Wi-Fi)?
5. ¿Quieren sonido de aviso en la cocina?

---
Generado por IA a partir del análisis de restaurant.pe — Revisado por: (pendiente)
