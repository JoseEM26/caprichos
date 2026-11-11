---
modulo: mirest
titulo: Configuración: Impresión
ruta: /admin/mirest
seccion: impresion
activa_con: [tab=impresion]
permiso: local/ver
roles: [ADMIN]
relacionados: [caja, cocina, pantallas]
sugerencias:
  - ¿Cómo funciona la impresión? ¿Se configura por cada PC o una para todas?
  - ¿Qué se imprime y cuándo? Me imprime cosas que no tienen que ver
  - ¿Cómo agrego otra computadora para imprimir?
  - ¿Cómo reintento un papel que falló?
  - ¿Cómo reimprimo un sticker o un ticket que ya salió?
  - ¿Cómo actualizo el programa de impresión a una versión nueva?
  - Salen papeles dobles: ¿tengo varias copias del programa abiertas?
---
# Configuración: Impresión

## Para que sirve
Decide qué papeles se imprimen (ticket del pago, comanda de salón, stickers de bebida, por área y general), en qué computadora salen y si todo está bien conectado. La pantalla tiene 3 pasos: 1) Tus computadoras, 2) Qué se imprime y 3) Probar. Se usa desde [[caja]] y [[cocina]].

## Como funciona (lo importante, en 4 líneas)
1. Las reglas (qué se imprime) son UNA sola para todo el local. No se configuran por computadora.
2. Cada computadora solo dice qué impresoras tiene (ticketera, etiquetera) y de qué área se encarga (Caja, Bebidas…).
3. Si una PC está apagada, sus papeles esperan y salen al encenderla; no se pierden.
4. Si un área no tiene computadora, su papel sale en Caja.

## Lo que sale hoy (de fábrica)
- Ticket o comprobante del pago: siempre, en la ticketera de Caja, al cobrar.
- Comanda de salón: solo en pedidos en el local (mesa), en la ticketera de Caja.
- Sticker de bebida (uno por vaso): solo para llevar, recoger y delivery, en la PC de Bebidas (o en Caja si no hay).
- Sticker por área (uno por cada área con productos, sin Bebidas): solo para llevar, recoger y delivery, en la PC de esa área (o en Caja).
- Sticker general (todo el pedido): apagado.
- Comanda por área: apagada.
- En el local no sale ningún sticker.

## Como se hace: Paso 1, tus computadoras
1. Abre Configuración del local, pestaña "Impresión" ([Impresión](/admin/mirest?tab=impresion)). Se abre en el Paso 1.
2. Cada tarjeta es una computadora con el programa. La luz y la frase dicen cómo está: "Lista", "El programa no está abierto en esta PC", "No elegiste impresora de tickets", "Se acabó el papel"…
3. En "Esta PC imprime lo de" elige Caja, Bebidas u otra área. Cada área y tipo de máquina tiene una sola computadora; si ya hay una, el sistema pregunta antes de reemplazarla.
4. Con "Cambiar impresoras" ves las impresoras reales de esa PC, numeradas. Pulsa "Imprimir prueba" en una para ver cuál es; luego "Usar como ticketera" o "Usar como etiquetera". Queda guardada: al encender la PC se conecta sola.
5. Para sumar una computadora pulsa "Agregar otra computadora": te da un código de un solo uso y el programa para descargar (Windows o Linux). Pasos en la PC: 1) descarga y abre el programa una sola vez; 2) vincúlalo con el código; 3) listo: queda funcionando en segundo plano, sin ventana, y arranca solo cada vez que prendas la PC (no hay que dejar ninguna terminal abierta). Para verlo escribe `--estado` junto al programa; para detenerlo, `--detener`.

## Como se hace: Paso 2, qué se imprime
1. Baja al Paso 2. Las filas son los papeles y las columnas son "En el local", "Para llevar" y "Delivery".
2. Marca o desmarca con ✓ lo que quieres. Cada fila dice en una frase qué es y "Sale en" qué máquina. "Ver ejemplo" muestra el papel tal como sale.
3. Los atajos de arriba rellenan toda la tabla: "Recomendado para Caprichos" (ticket siempre; comanda solo en el local; stickers de bebida y por área solo para llevar y delivery), "Solo ticket en todos los pedidos" (ticket y comanda en el local, sin stickers) y "Todo apagado excepto ticket".
4. El ticket del pago siempre sale: su casilla está fija.

## Como se hace: Paso 3, probar
1. "Imprimir una prueba en cada impresora" saca una hoja que dice "PRUEBA - no es un pedido" en cada impresora elegida. No cuenta como venta.
2. "Lo último que se imprimió" lista los últimos 10 papeles: qué pieza, de qué pedido, en qué PC y si salió bien, falló o espera, con el motivo en palabras simples.
3. Si algo falló, revisa papel y cable y pulsa "Reintentar".
4. La lista (y "Ver toda la cola") se separa en pestañas: "Todo", "Stickers (etiquetera)" y "Tickets (térmica)", cada una con su contador. Cada fila dice qué es: "STICKER · Bebida", "STICKER · Área Cocina", "TICKET · Pago", "TICKET · Comanda salón" o "PRUEBA"; muestra el pedido, la hora (con fecha si no es de hoy), la COMPUTADORA (nombre, si está conectada o desde qué hora está sin conexión), la impresora (por ejemplo Ticketera «EPSON TM-T20») y el estado, con el motivo. Si hay varias computadoras, el filtro "Computadora" deja ver solo la cola de una. Un papel que ninguna computadora tiene activado en "Impresión fácil" aparece como "Sin impresora asignada" con el motivo (no como "En cola"); el aviso rojo de arriba permite "Descartar los que no tienen impresora" (queda registrado con motivo, no se borra).
5. Qué hace cada uno: "Reintentar" vuelve a mandar el MISMO papel que no salió (no crea uno nuevo). "Reimprimir" saca una copia NUEVA (marcada COPIA) de uno que ya salió, falló o venció, en la misma máquina, sin tocar el original. Pide confirmación Sí/No y queda en el historial de auditoría con quién lo pidió.
6. Para varios: marca las casillas y pulsa "Reimprimir seleccionados", o usa "Reimprimir todos los stickers fallidos" / "Reimprimir todos los tickets fallidos". Máximo 30 papeles a la vez; si ya pediste la copia hace un momento, o el papel sigue en cola, o el pedido está anulado, no se copia y se te dice por qué. Si el sticker general está apagado, igual puedes reimprimir uno que ya existe.

## Como se hace: cambiar el tamaño de los stickers
1. Entra a Parámetros del sistema, grupo "Etiquetas e impresión" ([Parámetros](/admin/mirest?tab=parametros)).
2. Cambia el ancho y el alto (en milímetros, de 30 a 200) del sticker de bebida (de fábrica 76 x 38) o del sticker general (de fábrica 100 x 100). Pon lo mismo que dice el rollo cargado.
3. Guarda. Todo sticker que se imprima sale con la medida nueva, también los que esperaban en cola.

## Como se hace: vista avanzada y llaves
Al final de la pantalla, "Vista avanzada" abre el mapa dibujado, "Equipos y estado" (comandos del programa, llaves de acceso) y "Cola y pruebas" completas. Es lo mismo de los 3 pasos con más detalle; para crear o desactivar una llave del agente: "Equipos y estado", escribe un nombre y pulsa "Crear llave" (se muestra una sola vez; solo el Administrador). Enlaces: [Mapa](/admin/mirest?tab=impresion&seccion=mapa), [Equipos y estado](/admin/mirest?tab=impresion&seccion=equipos), [Cola y pruebas](/admin/mirest?tab=impresion&seccion=cola).

## Ajustes: Impresión
- **Cómo funciona la impresión**: Las reglas (qué se imprime) son una sola para todo el local; cada computadora solo dice qué impresoras tiene y de qué área se encarga; si una PC está apagada sus papeles esperan y salen al encenderla; si un área no tiene PC, sale en Caja. [Cómo funciona la impresión](/admin/mirest?tab=impresion&seccion=facil&campo=impresion-como-funciona)
- **Paso 1 · Tus computadoras**: Una tarjeta por cada computadora con el programa: luz, frase de estado, su ticketera y su etiquetera, «Cambiar impresoras» y «Esta PC imprime lo de: Caja / Bebidas…». «Agregar otra computadora» da el código y el programa. Ejemplo: La PC de Bebidas imprime lo de Bebidas: los stickers de vaso salen allá. Permiso: configuracion/editar. [Paso 1 · Tus computadoras](/admin/mirest?tab=impresion&seccion=facil&campo=impresion-paso-computadoras)
- **Paso 2 · Qué se imprime (tabla)**: Tabla de piezas por tipo de pedido (en el local, para llevar, delivery) con casillas ✓, tres atajos arriba y «Ver ejemplo» en cada fila. Ejemplo: Recomendado: ticket siempre, comanda solo en el local, stickers de bebida y por área solo para llevar y delivery. Permiso: configuracion/editar. [Paso 2 · Qué se imprime (tabla)](/admin/mirest?tab=impresion&seccion=facil&campo=impresion-paso-que-se-imprime)
- **Paso 3 · Probar y lo último impreso**: «Imprimir una prueba en cada impresora» y la lista de los últimos 10 papeles con su estado, el motivo y «Reintentar». Ejemplo: Un sticker que falló por falta de papel: pon papel y pulsa Reintentar. [Paso 3 · Probar y lo último impreso](/admin/mirest?tab=impresion&seccion=facil&campo=impresion-paso-probar)
- **Sticker de bebida**: Enciende o apaga el sticker que sale por cada vaso con bebida. Por defecto sale en pedidos para llevar, recoger y delivery (no en mesa) y se imprime en la computadora asignada a Bebidas, o en Caja si no hay. Los botones «Sale en» eligen los tipos de pedido. Ejemplo: Apagado: los vasos ya no salen con sticker; el resto de tickets sigue igual. Permiso: configuracion/editar. [Sticker de bebida](/admin/mirest?tab=impresion&seccion=mapa&campo=mapa-impresion-bebida)
- **Sticker por área**: Enciende o apaga un sticker por cada área con productos (Salados, Postres…), para que cada área lo reciba en su equipo. Bebidas no lleva este sticker: ya sale uno por cada vaso. Por defecto sale en llevar, recoger y delivery, en la computadora de Caja; los botones «Sale en» eligen los tipos de pedido. Permiso: configuracion/editar. [Sticker por área](/admin/mirest?tab=impresion&seccion=mapa&campo=mapa-impresion-area)
- **Comanda de salón**: Enciende o apaga la comanda que sale en la ticketera de Caja al aceptar un pedido de mesa o local, con cada línea, tamaño, opciones y notas. No sale para llevar ni delivery. Permiso: configuracion/editar. [Comanda de salón](/admin/mirest?tab=impresion&seccion=mapa&campo=mapa-impresion-comanda)
- **Estado del agente de impresión de la PC de Caja**: Dice si el programa de la PC de Caja está conectado (último latido) y si la impresora está lista, sin papel, desconectada o con error. Si está sin conexión, las etiquetas se acumulan como pendientes. [Estado del agente de impresión de la PC de Caja](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-agente)
- **Impresoras de cada computadora: probar todas y elegir**: Por cada computadora con el programa (Caja, Bebidas...) lista sus impresoras reales, sin PDF ni OneNote. «Probar TODAS» imprime en cada una su número grande para saber cuál es cuál; «Usar como etiquetera/ticketera» la deja guardada en esa computadora: al encenderla se conecta sola a esa impresora hasta que la cambies aquí. Muestra también si el programa no corre, si falta elegir o si la elegida no aparece, y los comandos del programa para copiar. Ejemplo: Probar TODAS: la impresora que saque «Impresora 3 de 15» es la número 3; pulsa «Usar como etiquetera» en la 3. Permiso: configuracion/editar. [Impresoras de cada computadora: probar todas y elegir](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-impresoras-equipo)
- **Instalar o vincular el programa de impresión**: Descarga el programa para la PC de Caja (Windows o Linux) y lo vincula con un código de un solo uso; después queda en segundo plano y arranca solo al prender la PC. Sirve también para elegir qué equipo es la etiquetera y cuál la ticketera. [Instalar o vincular el programa de impresión](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-instalar)
- **Actualizar estado del agente y la cola**: Vuelve a consultar el estado del agente, de la impresora y de la cola de trabajos. No cambia ninguna configuración. [Actualizar estado del agente y la cola](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-actualizar)
- **Llaves de acceso del agente de impresión**: Claves que autorizan a una PC a imprimir las etiquetas del local. Solo el Administrador las crea o desactiva. Desactivar una llave deja a esa PC sin imprimir hasta darle una nueva. Permiso: ADMIN. [Llaves de acceso del agente de impresión](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-llaves)
- **Nombre de la nueva llave del agente**: Nombre para reconocer en la lista a qué PC pertenece la llave que vas a crear. No afecta la impresión. Ejemplo: Agente PC Caja 1. Permiso: ADMIN. [Nombre de la nueva llave del agente](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-llave-nombre)
- **Crear llave de agente**: Genera una llave nueva para conectar una PC de Caja. Se muestra una sola vez: cópiala antes de cerrar el aviso, porque no se puede volver a ver. Permiso: ADMIN. [Crear llave de agente](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-llave-crear)
- **Cola de trabajos pendientes y fallidos**: Etiquetas esperando imprimirse y trabajos que fallaron tras 5 intentos. Desde aquí se reintentan los fallidos para que el agente los imprima de nuevo. Los avisos por demora se ajustan en Parámetros (impresion_alerta_min, impresion_vence_min). Ejemplo: 3 pendientes y 1 fallido: reintenta el fallido cuando haya papel. [Cola de trabajos pendientes y fallidos](/admin/mirest?tab=impresion&seccion=cola&campo=impresion-cola)
- **Pruebas de impresión de la etiquetera y la ticketera**: Imprimen una pieza de ejemplo marcada como PRUEBA para comprobar que la máquina está bien conectada. No hacen ningún pedido. Ejemplo: Si la etiquetera no sale, haz una prueba y revisa el motivo que aparece debajo. [Pruebas de impresión de la etiquetera y la ticketera](/admin/mirest?tab=impresion&seccion=cola&campo=impresion-pruebas)
- **Aviso por WhatsApp de etiquetas sin imprimir** (impresion_alerta_min): Minutos con etiquetas en cola sin que la impresora de Caja las tome (PC apagada, sin sesión o sin conexión) antes de avisar a los administradores. Avisa una vez por tanda. Ejemplo: Con 5: si hay una etiqueta esperando 5 minutos, los administradores reciben el aviso. [Aviso por WhatsApp de etiquetas sin imprimir](/admin/mirest?tab=parametros&campo=parametros-impresion-alerta-min)
- **Vencimiento de etiquetas no impresas** (impresion_vence_min): Minutos en cola a partir de los cuales una etiqueta automática ya no se imprime sola al reconectar la impresora: queda VENCIDA y se reimprime a mano. Los pedidos anulados también vencen. Una reimpresión manual sale igual. Ejemplo: Con 180: al reconectar tras 4 horas, las etiquetas viejas no salen solas. [Vencimiento de etiquetas no impresas](/admin/mirest?tab=parametros&campo=parametros-impresion-vence-min)
- **Sticker de bebida: ancho** (impresion_etiqueta_bebida_ancho_mm): Medida en milímetros del ancho del sticker que sale por cada vaso, tal como se ve la etiqueta puesta de frente en la etiquetera. Poner aquí lo mismo que dice el rollo cargado: el diseño se ajusta solo a esta medida (la letra baja de tamaño y se recorta con «…» o «+ N más» antes de salirse). Debe ser un número entero de 30 a 200. Ejemplo: Con 76: es el 76 de «76 x 38». [Sticker de bebida: ancho](/admin/mirest?tab=parametros&campo=parametros-impresion-etiqueta-bebida-ancho-mm)
- **Sticker de bebida: alto** (impresion_etiqueta_bebida_alto_mm): Medida en milímetros del alto del sticker que sale por cada vaso, tal como se ve la etiqueta puesta de frente en la etiquetera. Poner aquí lo mismo que dice el rollo cargado: el diseño se ajusta solo a esta medida (la letra baja de tamaño y se recorta con «…» o «+ N más» antes de salirse). Debe ser un número entero de 30 a 200. Ejemplo: Con 38: es el 38 de «76 x 38». [Sticker de bebida: alto](/admin/mirest?tab=parametros&campo=parametros-impresion-etiqueta-bebida-alto-mm)
- **Sticker general: ancho** (impresion_etiqueta_general_ancho_mm): Medida en milímetros del ancho del sticker general del pedido (bolsa o bandeja, solo para llevar, recoger y delivery), tal como se ve la etiqueta puesta de frente en la etiquetera. Poner aquí lo mismo que dice el rollo cargado: el diseño se ajusta solo a esta medida (la letra baja de tamaño y se recorta con «…» o «+ N más» antes de salirse). Debe ser un número entero de 30 a 200. Ejemplo: Con 100: es el primer 100 de «100 x 100». [Sticker general: ancho](/admin/mirest?tab=parametros&campo=parametros-impresion-etiqueta-general-ancho-mm)
- **Sticker general: alto** (impresion_etiqueta_general_alto_mm): Medida en milímetros del alto del sticker general del pedido (bolsa o bandeja, solo para llevar, recoger y delivery), tal como se ve la etiqueta puesta de frente en la etiquetera. Poner aquí lo mismo que dice el rollo cargado: el diseño se ajusta solo a esta medida (la letra baja de tamaño y se recorta con «…» o «+ N más» antes de salirse). Debe ser un número entero de 30 a 200. Ejemplo: Con 100: es el segundo 100 de «100 x 100». [Sticker general: alto](/admin/mirest?tab=parametros&campo=parametros-impresion-etiqueta-general-alto-mm)


## Como se hace: actualizar el programa y comandos útiles
Antes de abrir una versión nueva, ciérrala siempre: dos copias a la vez pueden imprimir doble. En Configuración > Impresión, junto a la descarga, está la sección "Comandos útiles y cómo actualizar" con todo para copiar y pegar.
1. En la PC, abre una ventana de comandos en la carpeta del programa (por ejemplo C:\Caprichos): en la carpeta escribe `cmd` en la barra de direcciones y pulsa Enter.
2. Cierra TODAS las copias: `agente-impresion-windows.exe --detener-todo`. Dice cuáles cerró ("Cerré 4 copias: pid ...").
3. Reemplaza el archivo de la carpeta por el recién descargado.
4. Ábrelo UNA vez (doble clic): queda en segundo plano y arranca solo con Windows. El programa nuevo también cierra solo las copias anteriores que encuentre.
Otros comandos (en la misma ventana): `--estado` (versión en uso, última disponible, cuántas copias hay y desde dónde arranca con Windows), `--copias` (lista las copias corriendo), `--version` (solo la versión), `autoinicio desactivar` y `autoinicio activar` (quitar o poner el inicio con Windows).

## Errores y dudas comunes
- ¿Se configura por cada PC o una para todas? Las reglas (Paso 2) son una sola para todo el local. Cada PC solo elige sus impresoras y su área (Paso 1).
- Me sale un papel que no pedí: mira la tabla del Paso 2 y apaga esa pieza en esa columna. En el local no debe salir ningún sticker.
- "Bebidas no tiene computadora: los vasos están saliendo en Caja": vincula la PC de Bebidas y en "Esta PC imprime lo de" elige Bebidas.
- Los papeles no salen: mira la luz de la PC en el Paso 1. Si dice "El programa no está abierto en esta PC", ábrelo con doble clic (queda en segundo plano y desde entonces arranca solo al prender la PC); lo pendiente sale solo. Si ya lo abriste, escribe `--estado` junto al programa para ver si corre y cuándo se conectó.
- Un papel viejo no salió solo al reconectar: pasó el tiempo de espera y se venció; pulsa "Reintentar" en "Lo último que se imprimió".
- En la cola hay una "Comanda salón" que no sale y dice "Sin impresora asignada": ninguna computadora tiene activada esa comanda en "Impresión fácil". Si la quieres, actívala en la computadora de Caja (ticketera > Comanda de salón) y saldrá sola; si no la quieres, pulsa "Descartar los que no tienen impresora". Cada computadora solo recibe los papeles que le activaste.
- Reimprimir desde Pedidos y caja: el menú dice, en cada opción, a qué computadora e impresora va y si está conectada. Las opciones que hoy no se pueden imprimir (sin computadora asignada, computadora apagada o impresora sin reconocer) salen apagadas con el motivo. Antes de enviar hay "Vista previa" y el aviso "¿Seguro? Se imprimirá N papel(es) en ...". Si pulsas dos veces lo mismo en menos de 15 segundos, se avisa "Ya se envió hace N s, espera a que salga" y solo sale otra copia si pulsas "Imprimir otra copia igual".
- Quiero otro sticker o ticket igual a uno que ya salió: en "Lo último que se imprimió" (o "Ver toda la cola") busca la fila, pulsa "Reimprimir" y confirma. Sale en la misma máquina, marcado COPIA.
- El sticker sale cortado o con mucho espacio: la medida de Parámetros no coincide con el rollo cargado.
- "No elegiste impresora de tickets/stickers": entra a "Cambiar impresoras" de esa PC y elige una.
- Salen papeles dobles o el estado dice "Hay N copias": quedaron varias copias del programa abiertas. Escribe `--detener-todo` junto al programa (ventana de comandos en su carpeta) y ábrelo una sola vez.
- Perdí la llave: no se puede volver a ver; crea una nueva y desactiva la anterior.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El cambio queda en el historial de auditoría. Cambiar qué se imprime requiere configuracion/editar; crear llaves, solo ADMIN.
