---
id: ANA-CAP-045
tipo: analisis
titulo: "Informe de Auditoria: Rol Administrador y Control del Negocio (Caprichos)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, produccion-admin-bot-informes]
---

# Informe de Auditoria: Rol Administrador y Control del Negocio (Caprichos)

## 1. Resumen Ejecutivo y Alcance

El presente documento evalua exhaustivamente las capacidades de control del negocio que el prototipo administrativo (`fuente/Admin.dc.html`) ofrece al Administrador (dueno y encargado general de Caprichos). Se audita la fidelidad funcional frente a los requerimientos expresados por Kevin Rosales en las reuniones de descubrimiento (`fuente/acta-01-descubrimiento.md`, `fuente/acta-02-descubrimiento.md`, `fuente/iniciativas-acta-02.md`, `fuente/BRD.md`, `fuente/modulos-y-roles.md`), y se contrasta minuciosamente contra el sistema operativo de produccion `restaurant.pe` documentado en `referencia/informes.md`, `referencia/escritorio.md` y `referencia/modulos-usuarios-notificaciones.md`.

El analisis revela una brecha critica entre la apariencia grafica del prototipo y las herramientas reales de gestion que un negocio gastronomico requiere:
1. Las metricas de ventas, tiempos e indicadores del escritorio no provienen de transacciones de la base de datos ni del array de pedidos, sino de formulas matematicas sinteticas generadas con ondas sinusoidales (`Math.sin`) o valores literales fijos incrustados en el codigo cliente.
2. El modulo de Informes no es un motor analitico ni un visualizador de reportes: es una tabla catalogo estatica de catorce filas que describe que informes podrian existir, presentada como tarjetas con botones de editar y desactivar, sin capacidad de consulta, agregacion, cruce de datos ni exportacion real a Excel o PDF.
3. No existe trazabilidad ni autorizaciones de supervisor (PIN de seguridad) para operaciones de alto riesgo de fraude como anulacion de comandas, aplicacion de descuentos discrecionales o cierre de turnos con descuadre de caja.
4. Datos personales criticos (DNI, telefonos, correos y contraseñas) se almacenan en texto plano o con algoritmos de dispersion no seguros dentro del almacenamiento local del navegador (`localStorage`), con desalineacion estructural en las tablas de visualizacion.
5. La matriz de permisos otorga privilegios peligrosos a roles operativos (cajeros editando politicas de descuentos y cerrando cajas descuadradas sin autorizacion; cocina visualizando margenes y costos de recetas; call center y mozos con capacidad de anular comandas).

---

## 2. Auditoria Detallada por Area de Control

### 2.1 Escritorio del Administrador

#### A. Cifras fijas y generacion artificial de datos
- CONFIRMADO en el codigo: En `fuente/Admin.dc.html`, cuando el usuario ingresa con el rol `admin`, la constante `kpisAdmin` define valores en texto rigido inalterable:
  - Ventas de hoy: `s/ 1,284.50`
  - Pedidos: `38`
  - Ticket promedio: `s/ 33.80`
  - Entrega promedio: `16 min · meta 13`
- CONFIRMADO en el codigo: Los canales de venta (`channels`) estan codificados con proporciones estaticas: Salon (46%), Delivery (28%), Web recojo (14%), WhatsApp (12%).
- CONFIRMADO en el codigo: El ranking de productos mas vendidos (`tops`) posee cantidades fijas: Frappe Oreo (41 u.), Capuccino (33 u.), Club Sandwich (24 u.), Nutewaffle (19 u.), Donas Artesanales (17 u.).
- CONFIRMADO en el codigo: Al activarse la vista de graficos estadisticos (`showStats`), el calculo de ventas diarias `dayVal(ms)` no consulta el registro de pedidos (`orders`), sino una funcion matematica trigonometrica:
  `Math.round((1050 + 330 * Math.sin(k * 0.9) + (wk === 0 || wk === 6 ? 380 : 0) + d.getUTCMonth() * 18 - (d.getUTCFullYear() - 2026) * 160) * CF)`
  Asimismo, el tiempo de entrega promedio (`ent`) se genera mediante:
  `14 + 2.2 * Math.sin(i * 1.3)` o `14.2 + 2.4 * Math.sin(t / DAY * 0.8)`
- Impacto para la cafeteria: El dueno no tiene visibilidad del flujo de caja real del dia. Si se producen ventas altas en salon o quiebre de stock en delivery, el tablero muestra cifras ficticias, impidiendo tomar decisiones sobre compras de emergencia, refuerzo de personal en barra o promociones reactivas.
- Prioridad: Alta.

#### B. Falta de comparativos reales y filtros analiticos
- CONFIRMADO en el codigo: El selector de fechas (`feGroups`) permite alternar entre Hoy, 7 dias, 30 dias, 90 dias o Ano, pero la comparacion porcentual (`mkDelta`) se calcula contra el bloque temporal contiguo inmediato generado artificialmente (`prev`).
- CONFIRMADO en referencia (`referencia/escritorio.md` y `referencia/consolidado-reunion.md`): En un negocio de cafeteria, la comparacion util es contra el mismo dia de la semana anterior (ejemplo: este sabado contra el sabado anterior), debido a que la demanda entre dias laborales y fines de semana difiere dramaticamente. El prototipo no ofrece comparativo interanual ni comparativo por dia equivalente.
- CONFIRMADO en referencia (`referencia/escritorio.md`): `restaurant.pe` ofrece en su pantalla principal (`#!/`) el desglose por turno (Turno Dia vs Turno Noche), ultima venta sincronizada en milisegundos, conteo de comensales sentados vs transacciones facturadas, y consumo promedio por comensal (`promedioConsumoPorPersona`). En el mockup de Caprichos, el ticket promedio solo se divide sobre pedidos brutos ficticios (`orders2 = Math.max(1, Math.round(total / 33.8))`), sin distincion de personas atendidas.
- Prioridad: Alta.

---

### 2.2 Indicadores y Metas de Negocio

#### A. Seguimiento de la meta de 13 minutos
- CONFIRMADO en el acta (`fuente/acta-01-descubrimiento.md` y `fuente/BRD.md` RN-CAP-022): Kevin establecio el reto critico de reducir el tiempo de preparacion y despacho de 20-25 minutos a un maximo estricto de 13 minutos.
- CONFIRMADO en el codigo: En la seccion de Indicadores (`isIndicadores`), las metas (`goals`) muestran barras con textos estaticos predefinidos. El grafico de entrega dibuja una linea punteada horizontal en `metaY = Y(13, entMax)`, pero los puntos trazados (`entPts`) provienen de la formula sinusoidal descrita anteriormente.
- SUPOSICION / Brecha funcional: El sistema no desglosa los 13 minutos en sus componentes operativos reales:
  1. Tiempo de confirmacion en caja (cuanto tarda el cajero en verificar y enviar a cocina).
  2. Tiempo de preparacion en cocina/barra (KDS comanda a plato listo).
  3. Tiempo de despacho/empaque.
  4. Tiempo de transito del motorizado (en delivery).
  Al consolidar todo en una curva inventada, el administrador no puede identificar en que estacion se produce el cuello de botella.
- Prioridad: Alta.

#### B. Ausencia de indicadores financieros de rentabilidad (Food Cost y Utilidad)
- CONFIRMADO en referencia (`referencia/informes.md` Seccion 4.3): `restaurant.pe` presenta en el encabezado de `#!/indicadores` las ecuaciones contables activas:
  Utilidades = Ventas facturadas - Compras (o Costo en ventas) - Cuentas por pagar.
  Y desglosa los pasivos vigentes y el Stock Valorizado mediante costeo de Promedio Ponderado.
- CONFIRMADO en el codigo: En `fuente/Admin.dc.html`, la vista `isIndicadores` no calcula Utilidad Bruta, ni Utilidad Neta, ni Food Cost porcentual sobre la venta. Se limita a mostrar tarjetas fijas (`topNow`, `topHist`, `promoSold`, `prodSold`), sin conexion con los costos reales de los insumos ni con las compras registradas a proveedores.
- Impacto para la cafeteria: Una cafeteria puede tener ventas brutas altas pero registrar perdidas si el costo de insumos importados (cafe de especialidad, pulpas, lacteos, empaques descartables) excede el 35% del precio de venta. El administrador carece de un indicador de margen operativo diario.
- Prioridad: Alta.

---

### 2.3 Modulo de Informes (Auditoria del "Modulo Fantasma")

#### A. Inexistencia de motor de reportes
- CONFIRMADO en el codigo: El elemento `TABLES.informes` en `fuente/Admin.dc.html` contiene el texto explicativo:
  `Catálogo de reportes disponibles. Aquí solo se muestra su estructura.`
  Consiste unicamente en 14 filas de texto plano:
  1. Ventas por mozo
  2. Ventas por producto
  3. Platos cancelados
  4. Ventas por canal
  5. Cierre de caja
  6. Arqueo de caja
  7. Kardex de insumos
  8. Stock bajo
  9. Mermas
  10. Compras por proveedor
  11. Cuentas por cobrar
  12. Frecuencia de clientes
  13. Cobertura de delivery
  14. Reclamos de delivery
- CONFIRMADO en el codigo: Al ingresar a la vista `informes`, la aplicacion entra por la condicion `isTable` (linea correspondiente a plantillas genericas de tablas). Cada informe se renderiza como una tarjeta con campos `Informe`, `Categoría`, `Qué muestra`, `Filtros`, `Exportar`, y muestra los botones operativos estandar: `Editar` y `Desactivar/Activar`.
- CONFIRMADO en el codigo: No existe ninguna funcion para ejecutar, consultar, tabular o generar ninguno de estos 14 reportes. El texto en la columna de exportacion es una cadena fija (`PDF · Excel`, `PDF`, `Excel`) sin enlaces (`href`), sin llamadas a librerias tipo jsPDF, SheetJS o endpoints de backend.
- Impacto para la cafeteria: El Administrador no tiene como auditar el historial de ventas por canal, no puede saber que insumos registraron mayor merma en el mes, no puede obtener el listado consolidado de cuentas por cobrar al personal ni conciliar el IVA/IGV o las ventas gravadas. El modulo es puramente decorativo.
- Prioridad: Alta.

#### B. Comparativa con el Catalogo Maestro de restaurant.pe
- CONFIRMADO en referencia (`referencia/informes.md` Seccion 2): `restaurant.pe` ofrece en produccion mas de 100 reportes transaccionales clasificados en 10 categorias funcionales:
  - Ventas (50 informes: Todas las ventas, anuladas, por forma de pago, por hora, por tipo de impuesto, consumo clientes, pedidos modificados).
  - Caja y Finanzas (15 informes: Cierres Z, resumen comparativo, ingresos/egresos extras, notas de credito/debito, complementos de propinas y vouchers).
  - Inventario y Almacen (28 informes: Kardex 13.1 SUNAT, stock valorizado, promedio ponderado, paloteo de insumos, historial de merma, food cost).
  - Compras (11 informes: Compras del mes, insumo vs proveedor, variacion de precios, cuentas por pagar).
  - Delivery (7 informes: Mapa de calor, cobertura, frecuencia, reclamos).
  - Facturacion Electronica (5 informes: CDR de Restafact, documentos pendientes).
- CONFIRMADO en el codigo: El mockup de Caprichos redujo todo este universo analitico a cero pantallas reales de reporte, dejando al negocio en indefension administrativa si se pretende sustituir a `restaurant.pe`.
- Prioridad: Alta.

---

### 2.4 Caja y Cierres (Historial, Conciliacion y Diferencias)

#### A. Flujo de arqueo y cierres
- CONFIRMADO en el codigo: El modulo de cierres (`cjVals`) implementa una division en dos pestanas: `Turno actual` e `Historial de cierres`.
- CONFIRMADO en el codigo: En `Turno actual`, se calcula el efectivo esperado:
  `cjEsp = inicial + ventasEfectivo + ingresosExtras - egresosExtras`
- CONFIRMADO en el codigo: El formulario de arqueo (`openCierre`) obliga a detallar billetes (`cjBill`: S/ 10, 20, 50, 100, 200) y monedas (`cjMon`: S/ 0.10, 0.20, 0.50, 1, 2, 5). En los medios electronicos (Yape, Plin, Transferencia, Tarjeta, Otros), el cajero ingresa manualmente el monto observado (`cjMan`).
- CONFIRMADO en el codigo: El sistema calcula la diferencia por cada medio (`sis - cont`) y la diferencia total (`cjDifTot`). Si la diferencia es menor a medio centavo se marca como `Cuadrado`, si es mayor como `Sobrante` y si es menor como `Faltante`.
- CONFIRMADO en el codigo: Los botones de impresion y PDF en el detalle del cierre (`cjPrint` y `cjPdf`) son simulaciones visuales que unicamente actualizan un mensaje de estado en pantalla:
  `Ticket de cierre enviado a la ticketera (simulado).`
  `PDF del cierre listo para descargar (simulado).`
- Prioridad: Media.

#### B. Riesgo de fraude y bypass de pedidos pendientes
- CONFIRMADO en el codigo: La funcion `doCerrar` valida que no existan pedidos pendientes (`if (cjPend.length) { bad('Hay pedidos sin cobrar o por confirmar.'); return; }`).
- CONFIRMADO en el codigo: Para superar esta restriccion, se programo una funcion de prueba visible en interfaz: `cjVerTest`:
  `ask('Solo prototipo: ¿marcar los pendientes como cobrados?', 'Sirve para probar el cierre completo sin tener que cobrar pedido por pedido. Los marca como cobrados en efectivo.')`
  Esta accion transforma masivamente cualquier comanda abierta en cobrada con efectivo, alterando de forma ficticia el efectivo esperado de la caja. Si este codigo llega a produccion, un cajero podria cerrar su turno ocultando pedidos impagos o descuadrados simplemente pulsando dicha opcion.
- CONFIRMADO en el codigo: No se solicita clave o PIN de supervisor si el arqueo presenta faltantes graves de dinero. Un cajero puede cerrar una caja con S/ 500.00 de faltante, colocar en observaciones cualquier texto y consumar el cierre en la base de datos sin notificacion de bloqueo ni requerir la firma electronica del administrador.
- Prioridad: Alta.

---

### 2.5 Mapa de Entregas (Zonas de Reparto y Cobertura)

#### A. Visualizacion geoespacial y mapa de calor
- CONFIRMADO en el codigo: La vista `isMapa` (`isMapaOn`) despliega un contenedor interactivo con capas de OpenStreetMap (`hmTiles`), poligonos SVG de zonas de reparto (`hmZones`), circulos concentricos de distancia (`hmRings`: radios de 1 km, 2 km, 3 km) y puntos/manchas de calor (`hmBlobs`, `hmDots`).
- CONFIRMADO en el codigo: El panel clasifica puntos rojos (entregas efectivas dentro de zona) y puntos azules (intentos de pedido fuera de cobertura, `hmOutNote`). Muestra metricas de ventas por zona (`hmZoneRows`) y pedidos por distancia (`hmRingRows`).
- Impacto positivo para la cafeteria: Es una herramienta de gran utilidad tactica para planificar el reparto de volantes publicitarios, evaluar la ampliacion de cobertura hacia distritos vecinos y ajustar la tarifa minima de envio.
- Prioridad: Media.

#### B. Deficiencias frente al requerimiento del cliente (Plus Codes de Google Maps)
- CONFIRMADO en el acta (`fuente/iniciativas-acta-02.md` Seccion 4.3): Kevin critico severamente a `restaurant.pe` debido a que su mapa no reconoce coordenadas geograficas directas ni codigos Plus Codes de Google Maps (ejemplo: `65G2+XX Lima`) que los clientes envian comunmente por WhatsApp, obligando al personal a tipear manualmente nombres de calles ambiguas. Kevin solicito replicar la funcionalidad agil de HolaClick donde se pega el Plus Code y el sistema clava el pin de forma instantanea.
- CONFIRMADO en el codigo: En `fuente/Admin.dc.html`, la vista de mapa del administrador no cuenta con una barra de busqueda por coordenadas GPS ni campo de entrada para Plus Codes. Dispone de botones cardinales de desplazamiento (`hmLeft`, `hmRight`, `hmUp`, `hmDown`) y botones de zoom (`hmZoomIn`, `hmZoomOut`), pero no permite al administrador auditar la ubicacion exacta de un pedido individual pegando su codigo geografico.
- Prioridad: Media.

---

### 2.6 Reclamos, Encuestas y Atencion al Cliente

#### A. Flujo de quejas y evaluacion
- CONFIRMADO en el codigo: El prototipo enlaza los comentarios ingresados desde la carta web ("¿Como te fue en Caprichos?") con la pantalla de Clientes (`commentCards`). Cada tarjeta expone: cliente, fecha, mensaje, estado (`pendiente` / `atendido`) y tipo de satisfaccion (`Bien`, `Regular`, `Mal`).
- CONFIRMADO en el codigo: En el escritorio general y en los chips de simulacion (`evtChips`), se incluye el evento `Queja en la encuesta`, el cual genera una alerta con prioridad alta si el cliente marco `Mal`.
- CONFIRMADO en el codigo: La unica accion disponible sobre una queja es el boton `Marcar como atendido` (`c.mark`).
- Brecha de control para el administrador:
  - No existe tipificacion de la queja (ejemplo: demora en cocina, producto frio, trato del motorizado, producto derramado o faltante).
  - No hay registro de accion correctiva (ejemplo: emision de cupon de compensacion, devolucion de dinero o llamada telefonica).
  - No se almacena quien atendio la queja ni a que hora.
  - No existen metricas consolidadas de satisfaccion (CSAT o NPS) en el tablero de control gerencial.
- Prioridad: Media.

---

### 2.7 Sistema de Alertas por Correo y WhatsApp

#### A. Simulacion de integraciones externas
- CONFIRMADO en el codigo: En `fuente/Admin.dc.html`, la notificacion de queja genera el siguiente detalle textual:
  `Respondió "Mal" en la encuesta · [TELEFONO]. Se avisó al correo kevin@ejemplo.com y al grupo: Grupo del equipo (por definir).`
- CONFIRMADO en el codigo: En la configuracion del local (`mirest`), los campos de avisos son cadenas de texto plano: `correoDueno` y `grupoWhatsapp`.
- CONFIRMADO en el codigo: En el modulo de stock, el control `toggleMail` ejecuta:
  `ask(s.mailOn ? '¿Apagar las alertas de stock por correo?' : '¿Activar las alertas de stock por correo?', 'Cuando un insumo baje del mínimo se avisa al correo configurado (' + s.info.correoDueno + ').', () => this.setState({ mailOn: !s.mailOn }))`
- CONFIRMADO en el codigo: No existe backend, servicio de mensajeria SMTP, SendGrid, Amazon SES, webhook ni llamada a la Meta Cloud API para WhatsApp. Todo aviso es un mensaje visual en la campana interna de la maqueta. Los botones de WhatsApp simplemente abren un enlace tipo `https://wa.me/51...` en el navegador del usuario para envio manual.
- SUPOSICION / Riesgo operativo: Si el cliente asume que el sistema ya despacha alertas automaticas nocturnas al correo o al grupo de administracion ante quiebres de stock o quejas graves, el negocio operara a ciegas a menos que se desarrolle un microservicio transaccional real.
- Prioridad: Alta.

---

## 3. Matriz de Permisos de los 8 Roles del Sistema

En `fuente/Admin.dc.html` (lineas de definicion de `ROLES`), el sistema estructura exactamente ocho roles. A continuacion se audita la visibilidad configurada (`views`), las acciones operativas permitidas (`manage`), los riesgos de seguridad detectados y lo que cada rol **NO deberia poder hacer** segun las mejores practicas de control interno para una cafeteria.

| Rol | Modulos que ve en el Mockup (`views`) | Acciones Permitidas (`manage`) | Lo que NO deberia poder hacer (Riesgo detectado) | Prioridad |
| :--- | :--- | :---: | :--- | :---: |
| **1. Administrador (`admin`)** | Todos los 25 modulos (`ALL_VIEWS`) | `true` (Control total) | Ninguna objecion estructural. Debe ser el unico con acceso a ventas globales, indicadores, utilidades, borrado logico y creacion de cuentas. | Baja |
| **2. Cajero (`cajero`)** | `escritorio`, `caja`, `cierre`, `reservas`, `clientes`, `creditos`, `ofertas`, `notificaciones` | `true` | **Alarma de Fraude**: 1) Tiene acceso a `ofertas` y `manage: true`: un cajero puede crear descuentos automaticos del 50% o cupones fraudulentos para aplicarlos a conocidos. 2) Cierra caja con faltantes sin aprobacion de supervisor. 3) Ve base de clientes con DNI y datos de contacto completos. | **Alta** |
| **3. Cocina y barra (`cocina`)** | `escritorio`, `cocina`, `stock`, `notificaciones` | `false` | **Filtracion Financiera**: El modulo `stock` le expone el precio de venta (`recipePrice`), el costo unitario de insumos (`recipeCost`) y el margen comercial de cada producto (`recipeMargin`). El personal de preparacion no debe tener acceso a margenes del negocio ni recetas valorizadas. Solo debe ver recetas tecnicas cuantitativas (gramajes) y existencias fisicas. | **Alta** |
| **4. Mozo (`mozo`)** | `escritorio`, `caja`, `reservas`, `productos`, `notificaciones` | `false` | **Riesgo Operativo y de Caja**: Ve el modulo `caja` (`Pedidos y caja`) en su totalidad, no solo sus mesas asignadas. Puede ver pedidos de delivery y ventas por cobrar de mostrador. En pedidos de mesa puede ejecutar anulaciones sin solicitar el PIN del administrador. | **Alta** |
| **5. Call center (`callcenter`)** | `escritorio`, `caja`, `repartos`, `reservas`, `clientes`, `mapa`, `notificaciones` | `false` | **Fuga de Informacion y Fraude**: 1) Puede anular pedidos en curso (`anuSave`) sin autorizacion. 2) Accede al `mapa` gerencial completo y a la lista de `clientes` con telefonos personales y consumo acumulado. Deberia estar limitado estrictamente a la toma y despacho de pedidos telefonicos. | **Media** |
| **6. Almacen (`almacen`)** | `escritorio`, `compras`, `almacen`, `stock`, `informes`, `notificaciones` | `false` | **Acceso Indebido a Reportes**: Tiene asignado el modulo `informes`, lo que en una estructura real le permitiria consultar ventas y rendimiento de mozos. Solo deberia ver reportes de inventario (Kardex, stock valorizado, mermas). | **Media** |
| **7. Produccion (`produccion`)** | `escritorio`, `almacen`, `stock`, `notificaciones` | `true` | **Duplicidad y Privilegio Excesivo**: Posee `manage: true` (puede gestionar listas maestras). No tiene acceso al KDS de cocina a pesar de preparar productos. Existe colision de funciones entre el rol `cocina` y `produccion` no resuelta en el diseno. | **Media** |
| **8. Repartidor (`repartidor`)** | `escritorio`, `repartos`, `notificaciones` | `false` | Diseno correcto en terminos generales. No ve ventas globales ni otros repartidores. Unicamente debe asegurarse que al entregar no tenga acceso a los telefonos personales tras cerrar la entrega (proteccion de datos). | **Baja** |

### Brecha Critica: Falta de Permisos Granulares (ACL)
- CONFIRMADO en referencia (`referencia/modulos-usuarios-notificaciones.md` Seccion 3.C): `restaurant.pe` no utiliza unicamente permisos a nivel de pantalla, sino mas de **500 tags de permisos granulares**, tales como:
  - `ventas.hacerpedidos.salones.aprobarpedido`
  - `ventas.hacerpedidos.salones.cancelarpedido`
  - `caja.cierre-caja-z`
  - `caja.cobrar`
  - `ajustes.usuarios.visualizarclaves`
  - `usuario_pinsupervisor` (exige codigo de 4 a 6 digitos del gerente para cualquier anulacion, cortesía o descuento manual).
- CONFIRMADO en el codigo: En `fuente/Admin.dc.html`, la autorizacion es binaria segun el array `views`. Si un usuario tiene acceso a la vista `ofertas` o `cierre`, puede manipularla por completo. No existe concepto de perfil intermedio ni aprobacion jerarquica por PIN.
- Prioridad: Alta.

---

## 4. Evaluacion de Riesgos de Fraude y Control Interno

### 4.1 Anulaciones de Pedidos sin Rastro ni Supervisor
- CONFIRMADO en el codigo: La funcion `anuSave` permite anular pedidos en preparacion o ruta (`cola`, `prep`, `listo`, `ruta`) a cualquier usuario con rol `admin`, `cajero` o `callcenter`:
  ```javascript
  anuSave: () => {
    // ...
    ask('¿Anular el pedido ' + s.sel + '?', 'Sale de cocina y de repartos. Motivo: ' + q.motivo.toLowerCase() + '. Queda en el historial; no se elimina. Los insumos que ya se descontaron no se devuelven solos.', () => {
      this.setOrder(s.sel, { status: 'rechazado', rider: '', anulado: { motivo: this.state.anud.motivo, por: role.n } });
      this.setState({ anud: null });
    })();
  }
  ```
- Brechas de fraude confirmadas:
  1. No solicita clave ni PIN de supervisor.
  2. No emite Nota de Credito tributaria ni registra serie de contingencia.
  3. No revierte el stock consumido en cocina ni genera un movimiento automatico de merma justificada: el propio sistema advierte que *"Los insumos que ya se descontaron no se devuelven solos"*, abriendo una ventana inmediata para robo sistematico (preparar el producto, cobrar en efectivo por fuera, anular el pedido y dejar el stock descuadrado).
  4. No existe una categoria de auditoria como en `restaurant.pe` (`referencia/informes.md` Seccion 3.3: informe de Ventas Anuladas con `Autorizada por`, `Motivo anulación`, `Categoría de anulación`).
- Prioridad: Alta.

### 4.2 Descuentos Discrecionales y Modificacion de Reglas
- CONFIRMADO en el codigo: En `Ofertas y descuentos`, se permite crear descuentos automaticos en porcentaje o monto fijo (`ddSave`). El cajero, al tener acceso a este modulo con `manage: true`, puede crear una regla de descuento temporal no autorizada, cobrar al cliente el precio regular en efectivo, registrar la comanda con descuento y apropiarse de la diferencia.
- Prioridad: Alta.

### 4.3 Creditos al Personal sin Techo Financiero ni Auditoria de Sueldos
- CONFIRMADO en el acta (`fuente/acta-02-descubrimiento.md` lineas 915-935) y en el codigo (`TABLES.creditos` y `credVals`):
  El credito se otorga exclusivamente a trabajadores con un plazo de hasta 15 dias y 25% de descuento sobre productos individuales (no combos ni promociones).
- CONFIRMADO en el codigo: En `Admin.dc.html`, la funcion de cobro a credito (`openMoStaff` y `cbConfirm`) valida el porcentaje de descuento y calcula la fecha de vencimiento.
- Brechas detectadas:
  1. No existe un limite o linea de credito maxima por empleado (un colaborador con sueldo minimo podria acumular consumos superiores a su quincena).
  2. No existe enlace con planilla o liquidacion de sueldos para descuento automatico por nómina.
  3. El cajero puede registrar pagos de abonos (`crPay`) sin emitir recibo formal de cobranza interna ni exigir firma de conformidad.
- Prioridad: Media.

---

## 5. Proteccion de Datos Sensibles (DNI y Privacidad)

### 5.1 Almacenamiento no seguro en el navegador
- CONFIRMADO en el codigo: La persistencia de la base de datos de clientes se realiza en el `localStorage` del cliente bajo la llave `caprichos_carta_cfg_v1` mediante `cliSave(l)`:
  ```javascript
  const cliSave = (l) => {
    try {
      const raw = window.localStorage.getItem('caprichos_carta_cfg_v1');
      const cur = raw ? JSON.parse(raw) : {};
      cur.clientes = l;
      window.localStorage.setItem('caprichos_carta_cfg_v1', JSON.stringify(cur));
    } catch (err) {}
  };
  ```
- Impacto legal y de seguridad: Todos los datos personales (DNI, nombres, apellidos, telefonos, correos electronicos y fechas de cumpleanos) residen en texto plano sin cifrar dentro del almacenamiento web del equipo. Cualquier script malicioso (XSS), extension de navegador o persona con acceso a la computadora de caja puede exportar la base completa de comensales de Caprichos, vulnerando la Ley Peruana de Proteccion de Datos Personales (Ley N° 29733).
- Prioridad: Alta.

### 5.2 Algoritmo de dispersion de contraseñas vulnerable
- CONFIRMADO en el codigo: En `fuente/Admin.dc.html`, la funcion utilizada para proteger las contraseñas de las cuentas de clientes es:
  ```javascript
  const pwHash = (p) => {
    let h = 7;
    String(p).split('').forEach((c) => {
      h = (h * 31 + c.charCodeAt(0)) | 0;
    });
    return String(h);
  };
  ```
- Vulnerabilidad tecnica: `pwHash` es un algoritmo elemental de hashing polinomial de 32 bits (similar a Java hashCode). No contiene salt (sal aleatoria), no tiene factor de coste computacional ni resistencia contra ataques de fuerza bruta. Puede ser revertido o generar colisiones triviales en milisegundos utilizando tablas arcoiris. Deberia utilizarse una funcion de hash criptografico estandar como bcrypt o Argon2 en el backend.
- Prioridad: Alta.

### 5.3 Desalineacion estructural en la tabla de clientes
- CONFIRMADO en el codigo: En `TABLES.clientes`, la definicion de columnas es:
  `cols: ['Cliente', 'Tipo', 'DNI', 'Teléfono', 'Correo (opcional)', 'Cumpleaños', 'Pedidos', 'Puntos', 'Crédito del personal']`
  Sin embargo, en las filas de datos (`rows`), se cargaron los siguientes arreglos:
  `['Ana Pérez', 'Persona', '999 888 777', 'ana@ejemplo.com', '14/03', '18', '180', 'No']`
  `['Luis Ramos', 'Persona', '988 777 666', 'invitado', '—', '7', '0', 'No']`
- Deficiencia observada: El numero de telefono (`999 888 777`) se renderiza bajo la columna de `DNI`, el correo se renderiza bajo `Teléfono`, la fecha de cumpleanos bajo `Correo`, el numero de pedidos bajo `Cumpleaños` y los puntos bajo `Pedidos`. El arreglo tiene 8 elementos mientras que la cabecera define 9 columnas. Esta desalineacion inutiliza la vista para auditorias administrativas de clientes.
- Prioridad: Media.

---

## 6. Que le Falta al Dueno para Decidir (Carencias Gerenciales)

Para que Kevin Rosales pueda dirigir Caprichos eficazmente sin depender de la intuicion, el sistema debe proveerle respuestas exactas a cinco interrogantes criticas de negocio que el prototipo actual no responde:

### 1. ¿Cual es la ganancia real neta del dia?
- Carencia: El sistema no cruza la venta real del turno contra el costo teorico de recetas descontadas ni contra los egresos de caja y pasivos de proveedores. No existe calculo de margen de contribucion diario.
- Requerimiento: Incorporar el widget financiero de restaurant.pe:
  Utilidad Operativa = Ventas Netas - Costo de Alimentos (Food Cost) - Gastos Operativos Directos.

### 2. ¿Que canal de venta es verdaderamente rentable?
- Carencia: El mockup muestra un grafico circular con porcentajes fijos (46% salon, 28% delivery, etc.). No calcula cuanto dinero neto deja cada canal tras descontar el costo de envio cobrado, la merma por empaque y el costo del motorizado.
- Requerimiento: Estado de resultados segmentado por canal (Salon vs Para Llevar vs Delivery Propio vs Pedidos WhatsApp).

### 3. ¿Donde se estan perdiendo los 13 minutos?
- Carencia: El reporte de tiempos es una linea sinusoidal simulada. No muestra metricas de campana: pedidos que superaron los 13 minutos, desviacion estandar por area (cuanto tardo la estacion de cafes calientes vs frappés vs cocina salada).
- Requerimiento: Registro auditado de tiempos por ticket (timestamp de ingreso, timestamp de aceptacion en caja, timestamp de despacho en cocina y timestamp de entrega a la mesa o al repartidor).

### 4. ¿Cuanto dinero se pierde en mermas cada semana?
- Carencia: El prototipo permite registrar merma en almacen y cocina, pero no valoriza la perdida en moneda local (`s/ 0.00`). Tampoco consolida un reporte mensual de desperdicios por insumo.
- Requerimiento: Informe valorizado de mermas con distincion obligatoria de causa: insumo vencido, falla de manipulacion en cocina, producto quemado/estropeado o devolucion de cliente insatisfecho.

### 5. ¿Como conciliar el dinero del banco con las ventas registradas?
- Carencia: No existe exportable contable ni reporte de liquidacion de terminales POS o billeteras digitales.
- Requerimiento: Reporte de liquidacion diaria por pasarela con identificador de lote y codigo de operacion para cruce automatico con el extracto bancario de la empresa.

---

## 7. Plan de Remediacion Priorizado

### Fase Inmediata (Prioridad Alta - Seguridad y Fraude)
1. Desvincular todas las funciones de generacion sinusoidal (`dayVal`, `Math.sin`) y conectar el Escritorio a agregaciones reales calculadas sobre el historico de ventas.
2. Eliminar de la interfaz la funcion `cjVerTest` que convierte pedidos pendientes en cobrados ficticios en efectivo.
3. Bloquear el modulo `Ofertas y descuentos` para el rol `Cajero` (mantenerlo de solo lectura o acceso exclusivo del Administrador).
4. Ocultar los campos de costo y margen de la receta (`recipeCost`, `recipeMargin`) en la vista del rol `Cocina y barra`.
5. Implementar el campo obligatorio de PIN de supervisor para cualquier anulacion de pedido, asociando la autorizacion al legajo del administrador en la base de datos.
6. Reemplazar la persistencia insegura en `localStorage` por almacenamiento centralizado en backend y sustituir `pwHash` por bcrypt.

### Fase Media (Prioridad Media - Operacion y Fidelidad Funcional)
7. Construir un visor de reportes funcional para los 7 informes prioritarios de Caprichos (Ventas diarias, Ventas por producto, Ventas por canal, Cierre Z, Arqueo, Stock valorizado y Mermas) con exportacion real a Excel (XLSX).
8. Corregir la desalineacion de columnas y filas en la tabla de `Clientes`.
9. Agregar soporte para busqueda y localizacion por Plus Codes de Google Maps en el modulo de pedidos y entregas.
10. Incorporar el campo de limite de credito maximo en el modulo de creditos del personal.

### Fase Final (Prioridad Baja - Optimizacion Gerencial)
11. Integrar servicios reales de mensajeria transaccional (SMTP y WhatsApp Business API) para alertas de quiebre de stock y quejas graves de clientes.
12. Desarrollar la pantalla de indicadores contables de alto nivel inspirada en `restaurant.pe` con determinacion automatica de Utilidades y Food Cost.

---
INFORME LISTO.
