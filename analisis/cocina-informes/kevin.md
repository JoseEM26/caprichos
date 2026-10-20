---
id: ANA-CAP-023
tipo: analisis
titulo: "Informe de Análisis: Declaraciones y Decisiones de Kevin Rosales frente al Prototipo del Rol Cocina y Barra"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, cocina-informes]
---

# Informe de Análisis: Declaraciones y Decisiones de Kevin Rosales frente al Prototipo del Rol Cocina y Barra

## 1. Introducción y Metodología

El presente informe analiza de manera exhaustiva todas las declaraciones, directrices y decisiones formuladas por el cliente Kevin Rosales (fundador de Caprichos) durante las sesiones de descubrimiento documentadas en `fuente/acta-01-descubrimiento.md` y `fuente/acta-02-descubrimiento.md`, contrastadas con el inventario de iniciativas de `fuente/iniciativas-acta-02.md` y la implementación actual del prototipo interactivo en `fuente/Admin.dc.html`.

El objetivo central es auditar el estado del rol "Cocina y barra" y los módulos operativos conexos frente a las necesidades reales de una cafetería artesanal en Lima, evaluando el grado de cumplimiento de cada requerimiento mediante tres estados:
- **Cumple**: La funcionalidad está implementada en el código del prototipo y responde a la necesidad expresada por Kevin.
- **Cumple a medias**: La idea se encuentra parcialmente modelada, simulada superficialmente, o presenta inconsistencias operativas con lo solicitado.
- **No existe**: La funcionalidad o regla de negocio no ha sido contemplada en el código del archivo `Admin.dc.html`.

Siguiendo las directrices del proyecto, cada hallazgo detalla:
(a) Ubicación exacta en el código del mockup o cita en las actas.
(b) Razón de impacto operativo y comercial para una cafetería artesanal.
(c) Nivel de prioridad (Alta, Media o Baja).
(d) Distinción estricta entre **CONFIRMADO en el código o en el acta** y **SUPOSICION**.

---

## 2. Análisis por Ejes Temáticos

### Eje 1: Cocina, barra y áreas de preparación

#### Hallazgo 1.1: División de la producción en tres áreas independientes (Salados, Postres y Bebidas)
- **Frase del acta**: "tenemos el área de salados, postres y bebidas, esas tres áreas de producción. Entonces, hay una por cada área, ¿no?" (Acta 02, líneas 550-554).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 469-470, 501-502 y 3701: `const kareaChips = [ ['todas', 'Todas'], ['bebidas', 'Bebidas'], ['postres', 'Postres'], ['salados', 'Salados'] ]`. En la vista de cocina existen botones de filtro por estación y títulos correspondientes (`BEBIDAS`, `POSTRES`, `SALADOS`, `TODAS LAS ÁREAS`).
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Permite organizar estaciones de trabajo especializadas (barista en bebidas, pastelera en postres, cocinera en plancha/salados) evitando cuellos de botella e interferencias en locales con alta demanda.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 1.2: Segmentación estricta de comandas para evitar saturación visual del personal
- **Frase del acta**: "así debería ser porque de esa manera no saturamos visualmente a la persona que está preparando los pedidos, al barista, la cocinera, a la que está haciendo postres... si yo estoy haciendo bebidas nada más, pero ¿qué me hace llegando a mí un queque, qué me hace llegando a mí un club sándwich si yo no me encargo de despachar eso ni de cocinar eso, no?" (Acta 02, líneas 581, 588).
- **Dónde está en el mockup**: En `Admin.dc.html`, línea 3695: `const its = orders.map((o) => ({ o: o, parts: areaParts(o, s.promos, s.avail).filter((p) => s.karea === 'todas' || p.area.toLowerCase() === s.karea) }))...`. La función `areaParts` vincula cada producto con `AREA_OF` y filtra las líneas para que cada pantalla solo muestre sus ítems asignados cuando se filtra por área.
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Si una estación recibe órdenes que no le competen, el operario pierde segundos valiosos descartando visualmente ítems ajenos, incrementando el riesgo de errores en modificadores (como tipo de leche o endulzante).
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 1.3: Desglose y reparto automático de componentes en combos y promociones (Dúo Compartir)
- **Frase del acta**: "en el dúo compartir... si lo colocara como combo, si me da la posibilidad de repente de que el queque o las galletas salgan en la pantalla de cocina de postres, que es donde le corresponde despachar, y las bebidas salgan en la solo las bebidas salgan en en bebidas de esa manera no saturable cocina con con comandas que o productos que no corresponden al área" (Acta 02, línea 561).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 2660-2662: `const areaParts = (o, promos, avail) => { const out = []; o.items.forEach((it) => { const pr = findPromo(promos || PROMOS0, it.n); if (pr) { expandPromo(pr, it, avail).forEach((x) => out.push({ area: x.area, q: x.q, n: x.n + ' (parte de ' + it.n + ')', ... })); } ...`.
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Resuelve una falla crítica de restaurant.pe, donde los combos obligaban a que un área viera todo el combo o a que la otra pantalla no recibiera su parte del trabajo, provocando descoordinación en entregas simultáneas.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 1.4: Continuidad de venta de combos ante agotamiento de complementos específicos
- **Frase del acta**: "El combo no se desactiva. El combo sigue activado, pero con el con lo restante, ¿no? que permite que incluya el combo. O sea, si se agotan las donas, que el combo incluya galletas y que incluya queques o empanadas... un cambio de complemento, porque si no hay donas tenemos que seguir vendiendo el combo" (Acta 02, líneas 605-609).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 2640-2662 (`expandPromo`): si un complemento de la lista está marcado como agotado en `s.avail`, el sistema busca un reemplazo disponible de la misma categoría y lo anota como `en lugar de [producto] (agotado)`.
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Evita perder ventas de paquetes de alto margen comercial cuando solo falta un elemento secundario de pastelería fácilmente sustituible.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 1.5: Pantalla o etiquetera central para despacho consolidado de pedidos
- **Frase del acta**: "me gustaría una pantalla de vamos a comprar otra pantalla de despacho donde o una etiquetera despacho donde solamente salgan ahí sí salga todo junto, ¿no?" (Acta 02, línea 588).
- **Dónde está en el mockup**: En `Admin.dc.html`, la vista de cocina contiene el filtro `Todas` que consolida los pedidos, y en `LBL_PRINTER` (línea 2668) existe `general: 'ETIQUETERA CAJA 192.168.1.210'`. Sin embargo, no existe un rol, pantalla dedicada ni interfaz exclusiva de "Despacho" que permita al empacador o anfitrión cotejar el ensamblaje de bandejas o bolsas de delivery antes de que salgan a mesa o repartidor.
- **Estado**: Cumple a medias.
- **Por qué importa para una cafetería**: En un modelo con áreas separadas (salados calientes y bebidas frías), el punto de ensamblaje final necesita verificar que el café y el sándwich salgan juntos al cliente para que ninguno se enfríe o derrita esperando al otro.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 1.6: Terminales de cocina operadas en computadoras fijas y no en televisores Smart TV
- **Frase del acta**: "Nuestras pantallas de cocina son computadoras... todas las pantallas de cocina que tenemos son computadoras, ¿no?" (Acta 02, líneas 521, 548).
- **Dónde está en el mockup**: En `Admin.dc.html`, línea 471 (`Pantalla completa, sin desplazar`), líneas 499-520 (`isKfull`), y línea 1249 (`isPantallas`). El prototipo diseñó la vista `isPantallas` bajo el supuesto de Smart TVs vinculados con código de 6 caracteres (`Ejemplo: K7M-4QX`), aunque la vista `isCocina` en sí es una aplicación web utilizable en monitores de PC.
- **Estado**: Cumple a medias.
- **Por qué importa para una cafetería**: Una computadora de escritorio en cocina con teclado/mouse o pantalla táctil requiere interacción directa de software operativo, mientras que un Smart TV solo suele permitir navegación pasiva de visualización.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 1.7: Pantalla KDS ejecutada como aplicación web sobre red local (no app de escritorio inestable)
- **Frase del acta**: "la semana de la semana pasada hasta desde que iniciamos era a través del aplicativo instalado en la computadora y te ibas a la categoría a la opción de pantalla de cocina, pero siempre ha tenido fallas... con un reclamo que hemos hecho, lo que nos han colocado es la pantalla de cocina, pero web a través de una URL que está conectada, ¿no? A la a la a la red, nada más a la red local" (Acta 02, líneas 525, 530).
- **Dónde está en el mockup**: En `Admin.dc.html`, la vista de cocina es 100% web dentro del aplicativo (`isCocina`), accesible por navegador. No obstante, el mockup aún corre dentro de un archivo único monolítico y no como un micro-servicio local desacoplado.
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Evita caídas por congelamiento de software antiguo empaquetado y facilita abrir la terminal en cualquier navegador moderno conectado a la red Wi-Fi/cableada del café.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 1.8: Interfaz KDS sin desplazamiento vertical (cero scroll para manos húmedas o con guantes)
- **Frase del acta**: "Esto de acá tiene para desplazar, ¿no? Entonces, que imagínate que va a estar haciendo eso, pues con la mano mojada. A veces uno está o a veces uno está. Entonces, es una pantalla para ver nada más y para dar clic y despejar, ¿no? Pero para estar bajando el scroll, todo esto." (Acta 02, líneas 655-657).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 471 y 500-518: botón "Pantalla completa, sin desplazar", contenedor con `overflow:hidden`, y límite forzado en JavaScript (líneas 3708-3709: `const KMAX = 3; const bigCols = columns.map(...)`).
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: En un entorno de cocina y cafetería donde se manipula vapor, agua, jarabes y grasas, tocar una pantalla para hacer scroll ensucia el monitor, ralentiza la preparación y arriesga contaminación cruzada.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

---

### Eje 2: Tiempos de preparación (meta de 13 minutos)

#### Hallazgo 2.1: Meta estricta de tiempo de entrega fijada en 13 minutos como máximo
- **Frase del acta**: "el reto de reducir el tiempo de entrega de 20-25 min a un máximo de 13 min" (Acta 01, línea 76; recursos/README.md).
- **Dónde está en el mockup**: En `Admin.dc.html`, línea 468 (`Meta de entrega: 13 minutos como máximo`), línea 924 (gráfico de entrega en Indicadores), línea 3340 (`Atrasados (13 min o más)` en KPIs de cocina), y línea 3698 (`tBg: o.mins >= 13 ? '#B2500F' : (o.mins >= 8 ? '#D99E39' : '#E3D6C6')`).
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: En el consumo de café matutino y refrigerios, los tiempos superiores a 15-20 minutos provocan deserción de clientes oficinistas y reseñas negativas en plataformas digitales.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 2.2: Indicador visual semafórico según el avance del cronómetro de preparación
- **Frase del acta**: "Al aceptar el pedido, este aparece en todas las pantallas de cocina y empiezan a correr los tiempos." (Acta 01, línea 30); validado en Acta 02, línea 667.
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 481, 510 y 3698: la etiqueta de minutos utiliza color neutro (`#E3D6C6`) entre 0 y 7 minutos, advertencia naranja (`#D99E39`) de 8 a 12 minutos, y alerta crítica marrón/roja (`#B2500F`) a partir de los 13 minutos.
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Ofrece al barista y cocinero una referencia periférica inmediata para acelerar pedidos atrasados sin tener que leer detalladamente cada reloj.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 2.3: Mecanismo de alta demanda para ajustar dinámicamente tiempos de entrega y pausar bot
- **Frase del acta**: "Ahí puedes pausar el bot este en alta demanda. on. Cuando le colocas on en la parte superior alta demanda... se configura diferentes tiempos de entrega. En cuando hay alta demanda, se el tiempo de entrega sube." (Acta 02, línea 1712).
- **Dónde está en el mockup**: No existe en `Admin.dc.html`. No hay ningún conmutador, estado global ni variable relacionada con "alta demanda" ni ajuste de tiempos estimados de cocina/reparto hacia el bot o la carta.
- **Estado**: No existe.
- **Por qué importa para una cafetería**: En horas punta (4:00 PM a 7:00 PM), si la cocina se satura y el sistema sigue prometiendo 13 minutos en los pedidos web o de WhatsApp, se generan reclamos masivos por demoras imprevistas.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el acta; confirmado inexistente en el código.

---

### Eje 3: Tickets y comandas

#### Hallazgo 3.1: Datos indispensables en la comanda (mozo, número de ticket, cronómetro y notas)
- **Frase del acta**: "Bueno veo que acá tiene el nombre del mozo, también tiene el número de ticket, el tiempo que va ir corriendo. Ya es un dato muy importante." (Acta 02, línea 667). "acá abajo sale el modificador... sin tomate sin mayonesa. Hay este comentarios." (Acta 02, línea 662).
- **Dónde está en el mockup**:
  - En la vista general de cocina (`isCocina`, líneas 480-487): muestra código (`k.code`), minutos (`k.mins`), canal/mozo (`k.canal`), ítems desglosados y nota (`k.note`).
  - En el ticket impreso simulado (`ctTicket`, líneas 329-370): incluye razón social, ticket, hora, mozo, mesa/cliente, productos con modificadores, nota para cocina y clave Wi-Fi.
  - En la vista de pantalla completa (`bigCols`, líneas 509-513): **OMITE** la nota de cocina, el nombre del mozo y el número de mesa.
- **Estado**: Cumple a medias (completo en vista regular y ticket impreso; deficiente en KDS pantalla completa).
- **Por qué importa para una cafetería**: Si una bebida requiere "leche sin lactosa bien caliente y stevia" o un sándwich "sin mayonesa", omitir esa nota en la pantalla de elaboración provoca desperdicio de producto y reelaboración obligada.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 3.2: Clave de acceso a la red Wi-Fi impresa en el ticket de compra
- **Frase del acta**: "Nos gustaría ponerle, pero no está, creo, la contraseña en el voucher ahorita. Sería bueno ponerle y después sería bueno implementar un servidor... para usuarios y contraseñas asociados al ticket para controlar más el la red wifi" (Acta 02, línea 473).
- **Dónde está en el mockup**: En `Admin.dc.html`, línea 351: `<div style="text-align:center">Wi-Fi: Caprichos-Clientes · clave 12345678 (ejemplo)</div>` dentro de la plantilla de comanda/ticket de 80 mm.
- **Estado**: Cumple. (Nota: el servidor cautivo con usuarios temporales dinámicos por ticket no existe y quedó como propuesta a futuro).
- **Por qué importa para una cafetería**: Los clientes de cafetería acuden a trabajar o estudiar; imprimir la clave en el comprobante reduce interrupciones constantes al cajero y mozo solicitando la contraseña.
- **Prioridad**: Baja.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 3.3: Configuración y administración de impresoras térmicas de producción por red local
- **Frase del acta**: "lo de las impresoras sí es este importante, ¿no? Claro, tú lo vas a modificar ahí. Impresoras, de producción... Sí, con la red local... eso sí es manejable." (Acta 02, líneas 860-873).
- **Dónde está en el mockup**: En `Admin.dc.html`, línea 3687 (`tkPrinter: 'COCINA 192.168.1.201:9100'`) y línea 2668 (`LBL_PRINTER = { ... }`). Sin embargo, son constantes cableadas en el código JavaScript. No existe un módulo interactivo ni interfaz de configuración para cambiar IPs, puertos o realizar pruebas de impresión (ticket de calibración).
- **Estado**: Cumple a medias.
- **Por qué importa para una cafetería**: Si el router asigna una nueva IP o se cambia una impresora averiada, el administrador debe poder reconfigurarla sin requerir intervención de un programador.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el código y en el acta.

---

### Eje 4: Pantallas de TV

#### Hallazgo 4.1: Destino real de los 3 televisores Smart TV (salón para clientes, no para cocina)
- **Frase del acta**: "los tres Smart TV que tenemos para el cliente. Sí, es eso, dices, para que los pedidos los pedidos listos salgan en pantalla... en cocina este no tenemos todavía, pero está bien que estés preparándolo para un Smart TV, pero todas las pantallas de cocina que tenemos son computadoras" (Acta 02, líneas 540-548).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 1249-1260 (`isPantallas`): está concebido exclusivamente para televisores de cocina/barra ("TV cocina", "TV barra"). No existe ninguna vista, plantilla ni módulo para proyectar en los 3 Smart TV del salón la cartelera de pedidos para clientes (llamador con estados "En preparación" y "Listos para retirar").
- **Estado**: No existe para clientes (cumple a medias de forma invertida en cocina).
- **Por qué importa para una cafetería**: En modelos de autoservicio o retiro en barra, una pantalla en el salón permite que el cliente espere sentado en su mesa hasta ver su código o nombre listo, evitando aglomeraciones frente al mostrador.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 4.2: Procedimiento de vinculación de pantallas mediante código de seguridad
- **Frase del acta**: Iniciativa B-21 derivada de la explicación de José: "cuando intenta ingresar solamente con la URL le va a pedir el código de vinculación... van a venir acá a la parte administrativa, por acá tengo el módulo de pantalla y lo van a probar y automáticamente lo va a liberar" (Acta 02, líneas 531-533).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 1251-1259 y líneas 4399-4400: input `pair-code`, botón `Vincular pantalla`, validación de 6 caracteres y confirmación `pairLink`.
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Facilita agregar dispositivos de pantalla en el local sin tener que iniciar sesión manualmente con contraseñas complejas en controles remotos o navegadores de televisor.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el código y en el acta.

---

### Eje 5: Etiquetas

#### Hallazgo 5.1: Impresión de comandas en etiquetas autoadhesivas para vasos de bebidas (estándar Starbucks)
- **Frase del acta**: "nosotros tener impresoras de sticker de las que tienen autoadhesivo y y ahí que salga la comanda para pegarlo nosotros en el vaso de la bebida... En Star en algunos sucursales hacen eso. En Estados Unidos hacen eso." (Acta 02, líneas 495-503).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 2663-2668, 3670-3675 y 3684: modelado completo de etiquetas autoadhesivas con pestañas de configuración (`lbToggles`: general, por área y por bebida), generador de etiquetas por vaso (`labels`) e impresoras virtuales asignadas.
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: En barra es el estándar de oro: el barista pega el sticker en el vaso acrílico o de polipapel con el detalle exacto de leche, tamaño y temperatura, evitando confusiones al servir en mesa o despachar delivery.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 5.2: Personalización festiva o temática en el diseño de las etiquetas para vasos
- **Frase del acta**: Idea de José aprobada por Kevin: "sería bueno eso y asociarlo dependiendo el día festivo. Claro, era muy bueno." (Acta 02, líneas 504-507; iniciativa B-20).
- **Dónde está en el mockup**: En `Admin.dc.html`, línea 3684: `fx: dz.theme !== 'ninguno' ? 'Edición ' + FX[dz.theme].n : ''`. Al imprimir stickers de bebida, agrega automáticamente la leyenda festiva activa (ejemplo: "Edición Halloween", "Edición Aniversario").
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Refuerza la identidad de marca y la experiencia visual del cliente, especialmente en campañas estacionales de alto consumo.
- **Prioridad**: Baja.
- **Certeza**: CONFIRMADO en el código y en el acta.

---

### Eje 6: Producción diaria

#### Hallazgo 6.1: Turno de producción matutina (elaboración de postres, pan pullman y gelatinas)
- **Frase del acta**: "En la mañana viene producción. Este viene un una señorita que hace toda la producción, todo lo que son los postres, los panes, pulman, gelatinas, todo viene en la mañana. Eh ella usualmente agarra directo del almacén. La idea es que ahorita agarre, apunte y después en su salida ingrese todos esos registros al sistema de entrada." (Acta 02, línea 1032).
- **Dónde está en el mockup**: En `Admin.dc.html`, línea 1091 ("La producción de la mañana entra como producto terminado y sus insumos salen del almacén"), línea 1092 (botón `Registrar la producción del día`), y línea 4248 (`openProd`).
- **Estado**: Cumple (en el módulo Almacén).
- **Por qué importa para una cafetería**: Las cafeterías artesanales hornean y preparan bases a primera hora; registrar esa producción alimenta el stock disponible para venta diurna.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 6.2: Descargo simultáneo de insumos consumidos e ingreso de productos terminados al finalizar la jornada
- **Frase del acta**: "Que ingrese este los insumos que ha usado, ¿no? Que sacó del almacén. y que ingrese también los productos que ha preparado el stop diario al finalizar su jornada." (Acta 02, línea 1034).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 1890-1898 y 4248-4250: el modal permite registrar tipo `Entrada` con origen `Producción` y destino `Almacén central` para insumos como `Donas (producción del día)`. Sin embargo, no descuenta automáticamente los insumos brutos usados (harina, manteca, azúcar) en una sola transacción combinada, sino que requiere registrar salidas independientes.
- **Estado**: Cumple a medias.
- **Por qué importa para una cafetería**: Si el proceso de registro al terminar el turno es doble y manual, el personal suele omitir la salida de ingredientes primarios, generando descuadres en el inventario teórico de almacén.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el código y en el acta.

---

### Eje 7: Recetas

#### Hallazgo 7.1: Recetas vinculadas para costeo y cálculo del margen de utilidad
- **Frase del acta**: "Recetas vinculadas, para saber el margen de utilidad." (Acta 01, línea 27); "en qué benefician las recetas? En que el costeo y la utilidad que va a tener cada producto en el costeo influye. Yo tengo por ahí un Excel de recetas." (Acta 02, línea 1195).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 835-855 y líneas 4451-4453: pestañas de recetas (`recipeTabs`), desglose de insumos con cantidades y costos (`recipeLines`), costo total (`recipeCost`), precio de venta (`recipePrice`) y margen comercial en porcentaje (`recipeMargin`).
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: En cafetería el costo de insumos lácteos y café oscila frecuentemente; conocer el margen unitario permite fijar precios rentables y detectar sobrecostos.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 7.2: Descuento automatizado de insumos al vender productos preparados al instante
- **Frase del acta**: "cuando se vende un club sándwich ya se esté vendiendo este, por ejemplo, ingresaron filetes de pollo... en el club Sandwich, cuando sale el club Sandwich, se va a estar agotando automáticamente un filete de pollo... tiene una receta y esa receta tiene que estar anexada a productos para que cuando se venda ese producto automáticamente se descuente esa receta del almacén que salga." (Acta 02, líneas 1103, 1139).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 2475-2484 (`usageOf`) y líneas 3081-3090 (`acceptEffects`): al aceptar un pedido, se evalúan los productos y se descuentan de forma automática los insumos del stock (`stockLog`).
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: A diferencia de los postres que se producen en lote cerrado, la comida rápida (sándwiches, waffles, cafés) se arma bajo pedido; el descuento automático mantiene el inventario en tiempo real sin obligar al cocinero a registrar salidas individuales por plato.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 7.3: Receta exacta del Club Sándwich y uso de pan pullman artesanal dosificado
- **Frase del acta**: "la chica que hace pan va a poner en entrada cuántos panes hizo y de esos panes que hizo, cada pan, por ejemplo, podría tener una dosificación de un pan, por ejemplo, salen este siete club sándwich... van a salir automáticamente x x rebanada de cuatro rebanadas de panes... cada club sand lleva dos rebanadas de jamón edan y dos rebanadas de queso... queso edan y jamón inglés, ¿no? O sea, tiene una receta" (Acta 02, líneas 1132-1139).
- **Dónde está en el mockup**: En `Admin.dc.html`, línea 2483: `else if (/SANDWICH|SÁNDWICH|CAPRISABROSO|PARRILLERO|SUPREMA/.test(n)) { u.push(['Pan de molde', 0.2 * q], ['Filete de pollo', 1 * q]); }`. Y en `RECIPES` (línea 2488): `{ n: 'Club Sandwich', price: 27, lines: [ { n: 'Pan de molde', q: '0.2 bolsa' ... }, { n: 'Tocino y jamón' ... }, { n: 'Queso y verduras' ... } ] }`.
- **Estado**: Cumple a medias. La deducción real en `usageOf` solo descuenta genéricamente pan de molde y filete de pollo, omitiendo el descuento real y dosificado de rebanadas de jamón inglés, queso edam y tocino en el inventario.
- **Por qué importa para una cafetería**: El queso y los embutidos representan un porcentaje elevado del costo de los salados; no descontarlos por lonjas produce desfases en el costeo real del almacén.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 7.4: Abastecimiento y control de pollo por unidades de filete limpio (no pollos enteros)
- **Frase del acta**: "nosotros lo compramos ya en filetes... Filetes de pollo y pollo. Pecho especial... filete." (Acta 02, líneas 1207-1216).
- **Dónde está en el mockup**: En `Admin.dc.html`, línea 2471 (`{ n: 'Filete de pollo', u: 'filetes', s: 40, min: 20, mid: 30, max: 100, p: 'pol' }`) y línea 2460 (`'Filete de pollo': [ 'Bandeja 10 filetes', 10, 'unidad', 1, true ]`).
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Simplifica la gestión de inventario y compras, evitando tener que calcular factores de rendimiento por merma de hueso o despiece.
- **Prioridad**: Baja.
- **Certeza**: CONFIRMADO en el código y en el acta.

---

### Eje 8: Mermas

#### Hallazgo 8.1: Vida útil de 12 horas para donas y reseteo diario matutino a stock cero
- **Frase del acta**: "de donas, sí, solo de donas. Donas su periodo de vida es de un día nada más, es menos todavía. O sea, lo hacen en la tarde son como 12 horas y eso un día. O sea para caprichos... pero ya es contabilizado como merma, pues a finales es contabilizado como merma, pero lo único que dura un día es en este caso la dona" (Acta 02, líneas 1081-1089).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 815, 1092 y 4241-4244: función `closeDay` ("Cerrar el día"), la cual recorre los insumos con atributo `vida: true` (`SUPPLIES.filter(x => x.vida)`), envía el saldo a merma y setea el stock remanente en cero.
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: La pastelería frita pierde crocancia y frescura rápidamente; impedir que el saldo de donas del día anterior se ofrezca como stock fresco protege la reputación de calidad del local.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 8.2: Destino de donación/regalo para mermas en lugar de desecho
- **Frase del acta**: "todo se separa y yo decido qué hago con esa manera... cuando queda este donas se regalan, se se donan las donas, no se votan. Todavía no estoy acostumbrado a votar es esa cosa. Prefiero que alguien lo lo disfrute, ¿no? Algo, pero no votarlo." (Acta 02, línea 1046).
- **Dónde está en el mockup**: En `Admin.dc.html`, línea 1895 (`¿Qué se hace con la merma?`), línea 4242 (`'Merma · Donación'`), y línea 4249 (`mvMotivos: mvChips('motivo', [ 'Donación', 'Personal', 'Desecho' ])`).
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Permite diferenciar contable y operativamente qué producto se desechó por mal estado biológico frente al que se destinó a donación a familiares o personal, manteniendo trazabilidad ética y de costos.
- **Prioridad**: Baja.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 8.3: Sobrantes en mesas refrigeradas de cocina (conservación vs. merma)
- **Frase del acta**: "si le sobra, que se quede para el día siguiente... Y si se malobra, es merma." (Acta 02, líneas 1187-1191).
- **Dónde está en el mockup**: En `Admin.dc.html`, no existe distinción de stock intermedio o inventario en estación de cocina. Todo el inventario se registra en un único almacén teórico, sin control de lo que queda abierto en la mesa refrigerada.
- **Estado**: Cumple a medias.
- **Por qué importa para una cafetería**: Los insumos cortados (quesos abiertos, verduras picadas) tienen una tasa de degradación mayor que los insumos cerrados en bodega; no monitorearlos propicia pérdidas invisibles.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el código y en el acta.

---

### Eje 9: Prioridades de pedidos

#### Hallazgo 9.1: Procedimiento ágil de despeje en pantalla KDS y eliminación de comandas acumuladas
- **Frase del acta**: "Este de acá ya lo debieron de haber despachado, pero no lo despejaron todavía... no lo despejan. Ese ya es este parte de ellos, ¿no? Que tienen que despejarlo" (Acta 02, líneas 636-640); "es una pantalla para ver nada más y para dar clic y despejar, ¿no?" (Acta 02, línea 655).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 3703-3705 y línea 490: cada tarjeta permite avanzar de "Nuevos" a "En preparación" y a "Listos". Sin embargo:
  1. Cada acción invoca la función `ask(...)`, desplegando un cuadro modal con pregunta "¿Está seguro? Sí/No", lo que entorpece el "dar clic y despejar" inmediato.
  2. En la columna "LISTOS", la acción está vacía (`label: ''`), por lo que no hay forma de archivar o retirar el pedido completado de la pantalla de cocina.
- **Estado**: Cumple a medias.
- **Por qué importa para una cafetería**: Si los pedidos listos permanecen en pantalla indefinidamente, la interfaz colapsa visualmente, ocultando los nuevos pedidos urgentes.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 9.2: Prioridad de salida matutina para filetes de pollo cocidos refrigerados del mise en place
- **Frase del acta**: "se quedan pollos, filetes de pollos se quedan cocidos ya que lo tienen parte como parte de su misan plaz... lo colocas en un tapper de acero y lo refrigeran para el día siguiente y eso es lo que sale primero al día siguiente, ¿no? Pero ese eso vendría siendo este periodo de vida de un día máximo del del pollo" (Acta 02, líneas 1094-1096).
- **Dónde está en el mockup**: No existe en `Admin.dc.html`. No hay gestión de lotes, alertas FIFO ni recordatorio en KDS o Almacén sobre insumos preparados previamente que deben consumirse con prioridad.
- **Estado**: No existe.
- **Por qué importa para una cafetería**: La inocuidad alimentaria exige rotación estricta (primeras entradas, primeras salidas); dejar pollo cocido más de 24 horas arriesga descomposición bacteriana y riesgos de salud.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el acta; confirmado inexistente en el código.

---

### Eje 10: Pedidos del mozo directos a cocina y pedidos por confirmar

#### Hallazgo 10.1: Restricción estricta de cobro a mozos y uso de precuenta para control de efectivo
- **Frase del acta**: "aquí al mozo no le permite cobrar porque el único responsable de cobrar es caja. Entonces, hermoso lo que puede hacer es precuentas, sacar precuentas y con eso cobrar al cliente con la precuenta. Y una vez cobrado al cliente en mesa, el mozo llega a caja, paga y recién el cajero recibe el dinero y emite el comprobante de pago, ¿no? Eso me parece también lógico y me parece también sensato." (Acta 02, línea 448).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 1655-1663 (`precuenta`), línea 4430 (`openPre`), y línea 3689 (`canCollect` condicionado a `canManage`, exclusivo de admin y cajero). El mozo solo puede imprimir o visualizar la precuenta con la leyenda: "La precuenta no es un comprobante de pago. Entrega el efectivo al mozo; el cajero cobra y emite el comprobante".
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Centraliza la responsabilidad del dinero en la persona asignada a la gaveta de caja, previniendo descuadres y posibles fugas de efectivo en el salón.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 10.2: Enrutamiento directo de pedidos de mesa a cocina sin intermediación previa de caja
- **Frase del acta**: "meseros (toman pedidos con tablet y el pedido aparece en pantalla)" (Acta 01, línea 33); estructurado en `flujo-de-pedidos.md` y `modulos-y-roles.md`.
- **Dónde está en el mockup**: En `Admin.dc.html`, línea 3861: en `sendMo`, cuando la modalidad es en el local (`m.modal === 'local'`), el pedido se asigna automáticamente con `status: 'cola'`, se imprimen comandas (`prints: 1`), y se descuentan insumos con `this.acceptEffects(...)` de forma inmediata.
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Agiliza la atención en salón; si el pedido de mesa tuviera que esperar a que el cajero lo apruebe mientras cobra a una fila presencial, la cocina tardaría varios minutos en enterarse de la orden.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 10.3: Retención como "Por confirmar" para pedidos fuera del local (Web y Chatbot)
- **Frase del acta**: "Bot de WhatsApp integrado: procesa el pedido, pero solo el cajero o la cajera lo acepta en el punto de venta tras verificarlo. Al aceptar el pedido, este aparece en todas las pantallas de cocina y empiezan a correr los tiempos." (Acta 01, líneas 29-30). "estamos esperando tu pago, te contactaremos por WhatsApp para que puedas enviarnos constancia... ya entablemos comunicación en el WhatsApp para la entrega también para coordinar, para darle seguimiento al pedido" (Acta 02, líneas 125-127).
- **Dónde está en el mockup**: En `Admin.dc.html`, línea 404: "Pedido fuera del local: aún no pasa a cocina. Habla con el cliente por WhatsApp, confirma el pago y sube el comprobante. Recién entonces va a las pantallas". Botón `openPc` (línea 406), generación de mensaje estructurado (`pcMsgOf`, línea 2688) y cambio de estado a cocina solo tras confirmación humana (`acceptOrder`, línea 3095).
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: En pedidos digitales por delivery o recojo, preparar platos costosos sin haber verificado el abono en Yape/Plin genera pérdidas directas por clientes que cancelan o envían comprobantes falsos.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

#### Hallazgo 10.4: Prevención de colisiones por concurrencia en la misma mesa (artificio de 30 mesas)
- **Frase del acta**: "nos entregaron con 8 mesas, nosotros le ampliamos a 30... el mozo está tomando en el pedido número cuatro... pero el mozo también agarró la mesa 02 y está tomando pedido... esos dos pedidos se juntan y uno de esos dos clientes se queda ahí... Hay conflicto. Se mezcla." (Acta 02, líneas 757-769).
- **Dónde está en el mockup**: En `Admin.dc.html`, líneas 4328-4331 y línea 710 de iniciativas: el plano interactivo bloquea una mesa que ya tiene pedido abierto o reserva activa impidiendo que se sobreescriba. Además se incorporó selector explícito de "Para llevar" para evitar ocupar mesas del plano en compras rápidas de mostrador.
- **Estado**: Cumple.
- **Por qué importa para una cafetería**: Elimina el caos operativo de mezclar comandas de clientes distintos en la misma cuenta y asegura precisión en la facturación de sala.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el código y en el acta.

---

## 3. Matriz Consolidada de Cumplimiento

| # | Eje Temático | Idea o Requisito de Kevin | Cita Corta del Acta | Estado en Mockup | Prioridad | Certeza |
| :-: | :-- | :-- | :-- | :-: | :-: | :-- |
| 1 | Cocina y áreas | 3 áreas de producción (Salados, Postres, Bebidas) | "tenemos el área de salados, postres y bebidas..." (A-02, L550) | Cumple | Alta | Confirmado |
| 2 | Cocina y áreas | Segmentación estricta sin saturar visualmente | "de esa manera no saturamos visualmente..." (A-02, L581) | Cumple | Alta | Confirmado |
| 3 | Cocina y áreas | Desglose de combos por área (Dúo Compartir) | "que las bebidas salgan en bebidas y postres en postres..." (A-02, L561) | Cumple | Alta | Confirmado |
| 4 | Cocina y áreas | Continuidad de combos si se agota complemento | "El combo no se desactiva... con el cambio de complemento" (A-02, L605) | Cumple | Media | Confirmado |
| 5 | Cocina y áreas | Pantalla o etiquetera central de despacho | "vamos a comprar otra pantalla de despacho donde salga todo..." (A-02, L588) | Cumple a medias | Alta | Confirmado |
| 6 | Cocina y áreas | Pantallas de cocina en PC (no Smart TV) | "todas las pantallas de cocina que tenemos son computadoras" (A-02, L548) | Cumple a medias | Media | Confirmado |
| 7 | Cocina y áreas | KDS web en red local sin app inestable | "nos han colocado la pantalla de cocina pero web por URL..." (A-02, L530) | Cumple | Alta | Confirmado |
| 8 | Cocina y áreas | Cero barras de desplazamiento (scroll) en KDS | "para estar bajando el scroll... con la mano mojada..." (A-02, L655) | Cumple | Alta | Confirmado |
| 9 | Cocina y áreas | Abastecimiento y mesas refrigeradas | "personal de Salado... tiene que sacar todos los insumos..." (A-02, L1169) | Cumple a medias | Media | Confirmado |
| 10 | Tiempos | Meta máxima de 13 minutos | "reducir el tiempo de entrega... a un máximo de 13 min" (A-01, L76) | Cumple | Alta | Confirmado |
| 11 | Tiempos | Semáforo visual en el cronómetro de comanda | "Al aceptar el pedido... empiezan a correr los tiempos" (A-01, L30) | Cumple | Alta | Confirmado |
| 12 | Tiempos | Modo alta demanda (subir tiempos y pausar bot) | "Cuando le colocas on en la parte superior alta demanda..." (A-02, L1712) | No existe | Alta | Confirmado |
| 13 | Comandas | Datos indispensables (mozo, ticket, tiempo, notas) | "tiene el nombre del mozo, número de ticket, tiempo..." (A-02, L667) | Cumple a medias | Alta | Confirmado |
| 14 | Comandas | Clave de Wi-Fi en ticket | "Sería bueno ponerle... la contraseña en el voucher" (A-02, L473) | Cumple | Baja | Confirmado |
| 15 | Comandas | Gestión de impresoras térmicas de producción LAN | "lo de las impresoras sí es este importante... de producción" (A-02, L860) | Cumple a medias | Media | Confirmado |
| 16 | Pantallas TV | 3 Smart TV en salón para clientes (no cocina) | "los tres Smart TV que tenemos para el cliente..." (A-02, L540) | No existe | Alta | Confirmado |
| 17 | Pantallas TV | Vinculación de pantallas por código de seguridad | "le va a pedir el código de vinculación..." (A-02, L531) | Cumple | Media | Confirmado |
| 18 | Etiquetas | Stickers autoadhesivos para vasos (Starbucks) | "tener impresoras de sticker... para pegarlo en el vaso" (A-02, L495) | Cumple | Alta | Confirmado |
| 19 | Etiquetas | Personalización festiva en etiquetas de vasos | "asociarlo dependiendo el día festivo... era muy bueno" (A-02, L504) | Cumple | Baja | Confirmado |
| 20 | Producción | Turno matutino de postres, panes y gelatinas | "En la mañana viene producción... hace toda la producción" (A-02, L1032) | Cumple | Alta | Confirmado |
| 21 | Producción | Registro de insumos y productos al salir | "ingrese los insumos que ha usado y los productos preparados" (A-02, L1034) | Cumple a medias | Media | Confirmado |
| 22 | Recetas | Recetas vinculadas para costeo y margen | "Recetas vinculadas, para saber el margen de utilidad" (A-01, L27) | Cumple | Alta | Confirmado |
| 23 | Recetas | Descuento automático de insumos al vender | "cuando se vende un club sándwich se agota automáticamente..." (A-02, L1103) | Cumple | Alta | Confirmado |
| 24 | Recetas | Receta estándar del Club Sándwich (pan pullman) | "dos rebanadas de jamón edan y dos de queso... cuatro de pan" (A-02, L1137) | Cumple a medias | Media | Confirmado |
| 25 | Recetas | Pollo por filetes limpios especiales | "nosotros lo compramos ya en filetes... pecho especial" (A-02, L1207) | Cumple | Baja | Confirmado |
| 26 | Mermas | Vida útil de 12 horas en donas y stock cero diario | "Donas su periodo de vida... son como 12 horas... merma" (A-02, L1081) | Cumple | Alta | Confirmado |
| 27 | Mermas | Destino de donación/regalo (no botar) | "se regalan, se donan las donas, no se votan" (A-02, L1046) | Cumple | Baja | Confirmado |
| 28 | Mermas | Sobrantes en mesas refrigeradas | "si le sobra, que se quede para el día siguiente... merma" (A-02, L1187) | Cumple a medias | Media | Confirmado |
| 29 | Prioridades | Despeje rápido en KDS sin ventanas bloqueantes | "es una pantalla para ver nada más y para dar clic y despejar" (A-02, L655) | Cumple a medias | Alta | Confirmado |
| 30 | Prioridades | Salida prioritaria a filetes cocidos refrigerados | "le quedan cuatro pechugas... es lo que sale primero al día siguiente" (A-02, L1094) | No existe | Alta | Confirmado |
| 31 | Flujo pedidos | Mozo no cobra; usa precuenta para control | "al mozo no le permite cobrar... saca precuentas" (A-02, L448) | Cumple | Alta | Confirmado |
| 32 | Flujo pedidos | Pedidos de salón directo a pantallas de cocina | "meseros toman pedidos con tablet y aparece en pantalla" (A-01, L33) | Cumple | Alta | Confirmado |
| 33 | Flujo pedidos | Pedidos web/bot quedan por confirmar antes de KDS | "Pedido fuera del local: aún no pasa a cocina... confirma pago" (A-01, L29) | Cumple | Alta | Confirmado |
| 34 | Flujo pedidos | Prevención de colisión de mesas concurrentes | "el mozo y el cajero agarró la mesa 02... se mezcla" (A-02, L764) | Cumple | Alta | Confirmado |

---

## 4. Ideas de Kevin que el Rol "Cocina y barra" Todavía NO Cumple

Al examinar de punta a punta el perfil de acceso y la experiencia operativa del rol `cocina` en `Admin.dc.html` (usuario `coc01`, vistas asignadas: `escritorio`, `cocina`, `stock`, `notificaciones`), se identifican las siguientes deficiencias directas frente a lo que Kevin Rosales planteó en las reuniones:

1. **Omisión de notas y datos del comensal en el modo KDS pantalla completa**:
   - En `Admin.dc.html`, líneas 508-514 (`bigCols` en `isKfull`), la tarjeta del pedido muestra únicamente el código (`k.code`), los minutos transcurridos (`k.mins`) y la lista básica de productos con modificadores.
   - **No muestra** las notas especiales de cocina (`k.note`, como "sin hielo", "sin mayonesa"), ni la modalidad (`modalName`: En mesa, Para llevar, Delivery), ni el número de mesa (`o.mesa`), ni el nombre del mozo que atendió.
   - *Impacto*: Incumple de forma directa el requisito validado por Kevin en el Acta 02 (líneas 647, 662 y 667). En la pantalla real que mira el cocinero no se leen las instrucciones de preparación. Prioridad: **Alta**.

2. **Falta de acción para despejar o retirar pedidos terminados en la columna LISTOS**:
   - En `Admin.dc.html`, línea 3705: `kcol('LISTOS', (x) => x === 'listo', '', 'listo')`. Al no tener etiqueta de acción (`label: ''`), la tarjeta de un pedido terminado carece de botón.
   - *Impacto*: Los pedidos completados se quedan estancados indefinidamente en la tercera columna hasta que otro rol los despache. Kevin criticó textualmente que el personal no despejaba las pantallas (Acta 02, líneas 636-640) y pidió una pantalla ágil "para dar clic y despejar". Prioridad: **Alta**.

3. **Interrupciones bloqueantes por cuadros de confirmación modal (`ask`)**:
   - Para cambiar un pedido de "Nuevos" a "En preparación" o de "En preparación" a "Listo", el sistema dispara la función `ask('¿Empezar a preparar?', ...)`, abriendo una ventana emergente que exige un segundo clic de confirmación ("Sí / No").
   - *Impacto*: En una cocina con calor, ritmo acelerado y manos mojadas o con guantes, exigir confirmaciones modales por cada plato contradice la exigencia de Kevin de "dar un solo clic y despejar" (Acta 02, línea 655). Prioridad: **Media**.

4. **Imposibilidad de marcar un producto o insumo como AGOTADO desde Cocina**:
   - La opción para conmutar un producto entre `DISPONIBLE` y `AGOTADO` reside exclusivamente en la vista `productos` (`Admin.dc.html`, líneas 3752-3754). El rol `cocina` no tiene acceso a dicha vista (`ROLES.cocina.views` solo tiene `escritorio`, `cocina`, `stock`, `notificaciones`).
   - Además, en la propia pantalla KDS no existe un botón rápido de "Agotar producto" cuando se termina un insumo en pleno turno (como ocurrió con la lúcuma fresca descrita por Kevin en Acta 02, línea 611).
   - *Impacto*: El cocinero debe desplazarse físicamente o avisar verbalmente a caja o administración para que apaguen el producto, arriesgando que ingresen más pedidos que no se pueden preparar. Prioridad: **Alta**.

5. **Incompatibilidad de permisos para registrar abastecimiento matutino y mermas**:
   - En `Admin.dc.html`, línea 4231: `const canMove = [ 'admin', 'almacen', 'produccion' ].indexOf(s.role) >= 0;`.
   - El rol Cocina y barra está excluido de `canMove`. Por tanto, el cocinero de salados tiene la vista `Stock y recetas` en modo de solo lectura y no puede pulsar "Cerrar el día (sobrantes a merma)" ni registrar la salida de insumos para sus mesas refrigeradas al iniciar el turno, tal como lo describió Kevin (Acta 02, líneas 1169-1183). Prioridad: **Media**.

6. **Inexistencia del interruptor y avisos de "Alta demanda"**:
   - `Admin.dc.html` no posee ningún control de "Alta demanda" para advertir sobrecarga en cocina ni para sincronizar la subida automática de tiempos de entrega en el chatbot y la carta virtual (Acta 02, línea 1712).
   - *Impacto*: La cocina no tiene forma de comunicar al sistema que se encuentra saturada para frenar el flujo de comandas entrantes. Prioridad: **Alta**.

7. **Ausencia de alerta sonora / timbre ante nuevas comandas entrantes**:
   - El prototipo no incluye ningún mecanismo de sonido ni reproducción de timbre acústico cuando un pedido nuevo pasa a cocina.
   - *Impacto*: El cocinero o barista tendría que estar mirando fijamente el monitor para advertir que ha ingresado un pedido, perdiendo valiosos minutos de la meta de 13 minutos. Prioridad: **Media**.

8. **Ausencia de la pantalla de llamado para clientes en los 3 televisores Smart TV de salón**:
   - El módulo `pantallas` de `Admin.dc.html` solo permite vincular pantallas KDS de cocina. No ofrece la vista de cara al cliente que Kevin especificó para los tres Smart TV del salón (pedidos en preparación y listos para recoger). Prioridad: **Alta**.

9. **Falta de estación y etiquetera dedicada de Despacho consolidado**:
   - Si bien el filtro "Todas" muestra el pedido íntegro, no existe una vista especializada de control de despacho donde se verifique que los elementos elaborados en paralelo (bebidas frías de barra y sándwiches calientes de plancha) se junten físicamente antes de salir a la mesa o al repartidor (Acta 02, línea 588). Prioridad: **Media**.

10. **Inexistencia de priorización de mise en place previo (filetes cocidos refrigerados)**:
    - No hay alertas ni etiquetas visuales que indiquen al cocinero que deben utilizarse primero las raciones preparadas la noche anterior antes de iniciar nuevas cocciones (Acta 02, línea 1094). Prioridad: **Baja**.

---

## 5. Conclusiones y Recomendaciones para el Mockup

El prototipo contenido en `fuente/Admin.dc.html` refleja con notable fidelidad la visión estratégica de Kevin Rosales respecto a la separación en tres áreas de producción, el desglose automático de combos (Dúo Compartir), la meta visible de 13 minutos, la impresión de etiquetas para vasos tipo Starbucks y la regla de no permitir cobrar al mozo.

Sin embargo, el rol **Cocina y barra** adolece de fricciones de usabilidad y brechas de diseño operativo crítico:
- El modo pantalla completa (KDS real de cocina) cercena información vital (notas de clientes, mozo y número de mesa).
- Los cuadros de diálogo modales (`ask`) hacen impracticable la manipulación táctil o con mouse en un entorno de producción gastronómica activa.
- Falta la acción para despejar los pedidos completados en la columna de listos.
- Cocina no puede declarar productos agotados ni activar el modo de alta demanda para contener la saturación de pedidos.

Ajustar estos puntos en la interfaz permitirá alinear completamente el prototipo con las expectativas y directrices operativas establecidas por Kevin en las actas de descubrimiento.

INFORME LISTO.
