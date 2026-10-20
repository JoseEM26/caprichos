---
id: ANA-CAP-010
tipo: analisis
titulo: "Informe de Analisis Funcional: Cierre de Caja y Arqueo Diario en Caprichos POS"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, caja-informes]
---

# Informe de Analisis Funcional: Cierre de Caja y Arqueo Diario en Caprichos POS

Este informe evalua la existencia, cobertura y vacios del proceso de **Cierre de Caja y Arqueo Diario** en el prototipo funcional actual de la cafeteria Caprichos (Lima, Peru). El analisis se basa en la lectura estatica del codigo fuente del administrativo ([Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html)), los requerimientos de negocio ([BRD.md](file:///tmp/claude-1000/caja-agy/fuente/BRD.md)), la definicion de roles ([modulos-y-roles.md](file:///tmp/claude-1000/caja-agy/fuente/modulos-y-roles.md)), el registro del estado del prototipo ([registro-mockup.md](file:///tmp/claude-1000/caja-agy/fuente/registro-mockup.md)) y el analisis tecnico de impresion ([impresion-tickets.md](file:///tmp/claude-1000/caja-agy/fuente/impresion-tickets.md)).

---

## 1 Lo que YA existe (con evidencia)

A continuacion se detallan los elementos visuales, datos y flujos presentes en el prototipo que guardan relacion directa o indirecta con la caja y los cobros:

1. **Etiquetas visuales fijas de Caja y Turno (Login y Perfil):**
   - En la pantalla de inicio de sesion ([Admin.dc.html, lineas 78-79](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L78-L79)) se muestran tres recuadros informativos fijos: `LOCAL: CAPRICHOS`, `CAJA: Caja Principal` y `TURNO: Dia`.
   - En la vista de Perfil de usuario ([Admin.dc.html, linea 1526](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L1526)) se repite el campo: `CAJA Y TURNO: Caja Principal · Dia`.
   - *Evidencia:* Son textos estaticos codificados directamente en la interfaz. No provienen de una sesion activa de caja ni permiten interactuar con ellos.

2. **Mencion de cambio de turno en notificaciones simuladas:**
   - En el catalogo de alertas internas ([Admin.dc.html, linea 2464](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2464)), figura como dato de ejemplo: `['13/10 16:30', 'Mensaje interno', 'Cambio de turno: caja 2 abre a las 18:00', 'Leida']`.
   - *Evidencia:* Es un registro textual en la tabla de demostracion de notificaciones; no existe una funcionalidad operativa de cambio de turno asociada.

3. **Menciones nominales en el catalogo de Informes:**
   - En la configuracion del modulo de Informes ([Admin.dc.html, linea 2445](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2445)), la tabla contiene dos filas de muestra:
     - `['Cierre de caja', 'Caja', 'Ingresos y egresos por turno', 'Fecha, caja', 'PDF']`
     - `['Arqueo de caja', 'Caja', 'Efectivo esperado y contado', 'Fecha, caja', 'PDF']`
   - *Evidencia:* Como declara la descripcion del propio modulo en [Admin.dc.html, linea 2441](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2441), se trata de un "Catalogo de reportes disponibles. Aqui solo se muestra su estructura". Al hacer clic no se genera ningun informe, no hay filtros funcionales ni descarga de archivos.

4. **Registro individual del Medio de Pago por pedido:**
   - Cada pedido en el prototipo ([Admin.dc.html, lineas 1905-1909](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L1905-L1909), constante `SEED`) almacena el campo `pay` (por ejemplo: `'Efectivo'`, `'Yape'`, `'Plin'`, `'Tarjeta'`) y el booleano `paid` (`true` o `false`).
   - El requerimiento de negocio [BRD.md, linea 179](file:///tmp/claude-1000/caja-agy/fuente/BRD.md#L179) (`RN-CAP-011`) formaliza los canales de pago: "Medios de pago admitidos: efectivo (con monto para el vuelto), Yape, Plin, transferencia y tarjeta".
   - En el detalle del pedido ([Admin.dc.html, lineas 314-315](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L314-L315)), pestana Cobro, se visualiza el medio de pago (`sel.pay`) y el estado (`sel.paidText`).
   - En el cobro a credito del personal ([Admin.dc.html, linea 3214](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L3214)), se asigna `pay: 'Credito del personal'` y se genera un comprobante de deuda interna.

5. **Registro de cobro y cierre individual de pedidos:**
   - En la vista de pedidos ([Admin.dc.html, lineas 390-396](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L390-L396)), el cajero dispone de los botones:
     - "Registrar cobro" (funcion `collectSel`, [Admin.dc.html, linea 3514](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L3514)): cambia `paid: true`.
     - "Entregar al cliente y cerrar" (funcion `deliverSel`, [Admin.dc.html, linea 3515](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L3515)): marca `status: 'entregado'` y `paid: true`.
   - Existen filtros de pedidos por estado de pago ([Admin.dc.html, lineas 2759-2760 y 3483](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2759-L2760)): `Todos`, `Cobrado` y `Pendiente`.

6. **Indicadores de cobro en el Escritorio:**
   - En el Escritorio del rol Cajero ([Admin.dc.html, linea 2715](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2715)), se calculan o muestran cuatro tarjetas resumen:
     - `Pedidos por aceptar` (dinamico, segun pedidos con estado `nuevo`).
     - `Cobros pendientes` (dinamico: `orders.filter(o => !o.paid && o.status !== 'rechazado').length`).
     - `Cobrado en mi caja hoy` (valor fijo de demostracion: `'s/ 668.40'`).
     - `Pedidos cerrados hoy` (dinamico, segun pedidos con estado `entregado`).
   - En el Escritorio del Administrador ([Admin.dc.html, linea 2705](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2705)), se muestran tarjetas con datos estaticos: `Ventas de hoy: 's/ 1,284.50'` y `Ticket promedio: 's/ 33.80'`.

7. **Proceso de "Cierre del dia" exclusivo para insumos en Almacen (no dinero):**
   - En el modulo Almacen ([Admin.dc.html, lineas 3315-3318](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L3315-L3318), funcion `closeDay`) y documentado en [registro-mockup.md, linea 58](file:///tmp/claude-1000/caja-agy/fuente/registro-mockup.md#L58), existe una accion de cierre que pasa a merma el remanente de productos perecibles del dia (ejemplo: donas) y deja su stock en cero.
   - *Evidencia:* Esta accion es 100% de inventario; NO realiza ningun cuadre financiero ni arqueo monetario.

---

## 2 Lo que FALTA o esta incompleto

La siguiente tabla consolida todas las brechas funcionales detectadas entre las necesidades operativas de una cafeteria y el estado actual del prototipo:

| Que falta | Por que importa | Gravedad |
| :-- | :-- | :-- |
| **Apertura de caja con fondo inicial (sencillo)** | **NO EXISTE.** No hay pantalla ni variable para registrar con cuanto sencillo en efectivo inicia la jornada el cajero. Sin esto, es imposible saber si el dinero en gaveta al final del dia corresponde a ventas o al cambio base. | Alta |
| **Gestion de turnos y responsable de cierre** | **NO EXISTE.** El turno "Dia" es un texto fijo. Si en Caprichos se trabaja en dos turnos (manana y tarde), no se puede hacer entrega de caja entre cajeros, ni saber quien respondia por la caja ante un faltante. | Alta |
| **Conteo fisico de efectivo (pantalla de arqueo)** | **NO EXISTE.** No hay interfaz ni calculadora para que el cajero cuente y deslose sus billetes y monedas al terminar el turno. | Alta |
| **Cuadre consolidado de ventas por medio de pago** | **NO EXISTE.** Aunque cada pedido guarda su forma de pago, no existe ninguna vista que sume y presente el consolidado: Total Efectivo, Total Yape, Total Plin, Total Tarjeta y Total Transferencias para conciliar con los extractos y comprobantes. | Alta |
| **Registro y justificacion de diferencias (faltante/sobrante)** | **NO EXISTE.** No hay formula que reste el efectivo esperado del contado ni campo para registrar explicaciones (errores en vuelto, billetes falsos, redondeo). | Alta |
| **Retiros y gastos de caja chica (egresos menores)** | **NO EXISTE.** En la operacion diaria se compra hielo de emergencia, insumos menores o se retira efectivo para deposito por seguridad. Actualmente la caja no registra salidas de dinero, lo que desvirtua cualquier arqueo. | Alta |
| **Validacion de pedidos impagos al intentar cerrar** | **NO EXISTE.** No hay bloqueo ni advertencia que impida cerrar el dia si todavia hay mesas abiertas con consumo pendiente de pago o pedidos para llevar sin cobrar. | Alta |
| **Bloqueo operativo de ventas tras el cierre** | **NO EXISTE.** Al no existir el estado de caja cerrada, cualquier usuario puede seguir registrando y cobrando pedidos en el sistema aun despues de haber emitido el balance del turno. | Media |
| **Reporte impreso (ticket termico) o PDF de cierre** | **NO EXISTE.** Solo esta mencionado como texto plano en el catalogo de informes. No hay diseno de ticket de 80 mm para imprimir en la ticketera del local ni generador de PDF. | Media |
| **Historial y auditoria de cierres anteriores** | **NO EXISTE.** No hay ninguna pantalla donde el administrador o contador pueda consultar los arqueos de dias o semanas previas para auditoria. | Media |
| **Permisos de cierre por rol** | **INCOMPLETO.** El cajero no tiene acceso a Informes ([modulos-y-roles.md, linea 109](file:///tmp/claude-1000/caja-agy/fuente/modulos-y-roles.md#L109)), pero tampoco tiene un modulo o boton de cierre en su vista de Caja. No esta delimitado quien puede autorizar un cierre con descuadre. | Media |

---

## 3 Propuesta concreta para el mockup (pantallas, campos, botones, reglas)

Para incorporar el flujo completo de cierre y arqueo sin romper la estetica ni la simplicidad actual del administrativo, se propone la siguiente solucion funcional:

### A. Modal: Apertura de Caja (al iniciar turno)
- **Activacion:** Aparece automaticamente si el usuario con rol `cajero` ingresa y la caja esta cerrada, o mediante un boton en la cabecera: "Abrir caja".
- **Campos:**
  - Fecha y hora de apertura (automatica).
  - Cajero responsable (toma el usuario autenticado, ejemplo: `Marta (cajera)`).
  - Turno: selector desplegable (`Turno Manana`, `Turno Tarde`).
  - Fondo inicial de sencillo: campo numerico en soles (ejemplo por defecto: `s/ 150.00`), con desglose opcional de monedas y billetes para cambio.
- **Botones:** "Confirmar apertura".
- **Regla:** Mientras la caja este "Cerrada", los botones "Nuevo pedido", "Registrar cobro" y la recepcion de pedidos web quedan en pausa o con advertencia en caja.

### B. Opcion de Caja Chica: Registrar Egreso / Retiro
- **Ubicacion:** En la vista `caja`, en la columna izquierda superior, junto a los botones de pedidos, agregar el boton: "Movimiento de caja".
- **Campos:**
  - Tipo: `Gasto menor / Caja chica` (compras urgentes de insumos, limpieza, movilidad) o `Retiro de efectivo / Sangria` (traslado de exceso de efectivo a caja fuerte o dueno).
  - Monto en soles.
  - Motivo / Justificacion (texto obligatorio).
  - N° de recibo o boleta de soporte (opcional).
- **Botones:** "Registrar salida", "Cancelar".
- **Regla:** Todo egreso resta de forma inmediata del efectivo teorico esperado en la gaveta.

### C. Modal: Cierre de Turno y Arqueo de Caja
- **Ubicacion:** Boton destacado en la cabecera del modulo Caja: "Cerrar caja y arqueo".
- **Paso 1: Control de pendientes (Regla de negocio estricta):**
  - El sistema valida si hay pedidos con `status !== 'entregado'` o `paid === false`.
  - Si existen pedidos abiertos (por ejemplo, Mesa 7 comiendo), muestra una advertencia bloqueante: *"No puedes cerrar caja con 2 pedidos pendientes de cobro. Coblralos o cancelalos antes de continuar"*.
- **Paso 2: Conteo fisico del efectivo (Arqueo):**
  - Desglose rapido por denominacion:
    - Billetes: s/ 100, s/ 50, s/ 20, s/ 10.
    - Monedas: s/ 5, s/ 2, s/ 1, s/ 0.50, s/ 0.20, s/ 0.10.
  - Calculo en tiempo real del "Total Fisico Contado".
- **Paso 3: Conciliacion y Cuadre de caja:**
  - **Efectivo:**
    - (+) Fondo inicial de apertura.
    - (+) Ventas cobradas en efectivo.
    - (-) Egresos de caja chica / retiros registrados.
    - (=) **Total Efectivo Esperado en Sistema**.
    - (-) **Total Efectivo Contado en Gaveta**.
    - (=) **Diferencia:** `Cuadrado (s/ 0.00)`, `Faltante (- s/ X.XX)` o `Sobrante (+ s/ X.XX)`.
    - Si la diferencia es distinta de cero: campo obligatorio *"Motivo del descuadre"*.
  - **Medios electronicos (Informativo para conciliacion):**
    - Total ventas Yape (monto y cantidad de transacciones).
    - Total ventas Plin (monto y cantidad de transacciones).
    - Total ventas Tarjeta / POS (monto y cantidad).
    - Total Transferencias bancarias.
    - Casilla de verificacion: *"Confirmo que los montos de Yape, Plin y tarjetas coinciden con los comprobantes y terminales"*.
- **Botones de accion:**
  - "Imprimir precierre (Reporte X)" (para verificar sin cerrar la sesion).
  - "Confirmar y cerrar turno (Reporte Z)" (pide confirmacion: *"Esta accion cerrara la sesion de ventas"*).

### D. Formato de Ticket Impreso de Cierre (Ticketera 80 mm)
- Siguiendo el mismo estilo de ticket comanda ya desarrollado en [Admin.dc.html, lineas 325-348](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L325-L348), se anadira la opcion de impresion del "Ticket de Cierre Z":
  - Cabecera: `CAPRICHOS · CIERRE DE CAJA (TURNO DIA)`.
  - Fecha, hora de apertura, hora de cierre y nombre del cajero.
  - Resumen por medio de pago (Efectivo: s/ X, Yape: s/ X, Plin: s/ X, Tarjeta: s/ X).
  - Resumen de efectivo (Fondo inicial + Ventas efectivo - Gastos = Total esperado vs Contado).
  - Resultado final: Diferencia y observaciones.
  - Espacio para firma: `Firma Cajero` y `Firma Administrador`.

### E. Pantalla: Historial de Cierres de Caja
- **Ubicacion:** Pestaña adicional dentro del modulo `Informes` (visible para Administrador) o subpestana "Cierres anteriores" en `caja` (visible para Cajero y Administrador).
- **Columnas de la tabla:** N° Cierre, Fecha, Turno, Cajero, Total Vendido, Diferencia Efectivo, Estado (`Cuadrado`, `Faltante`, `Sobrante`), Acciones (`Ver detalle`, `Reimprimir ticket`).

---

## 4 Preguntas para el dueno (Kevin)

Para afinar el diseno definitivo con las politicas reales del negocio, se deben definir las siguientes dudas con Kevin:

1. **Arqueo a ciegas vs. Arqueo abierto:**
   ¿El cajero debe contar el dinero "a ciegas" (escribir cuanto tiene sin saber de antemano cuanto pide el sistema), o el sistema debe mostrarle en pantalla el monto esperado mientras cuenta? *(En restaurantes se recomienda el arqueo a ciegas para evitar que se maquillen faltantes).*
2. **Cantidad y dinamica de turnos:**
   ¿Caprichos opera con un solo turno corrido durante todo el dia, o cambian de cajero a media jornada (por ejemplo manana y tarde) exigiendo un corte y entrega de efectivo entre ambos?
3. **Manejo del fondo de sencillo (apertura):**
   ¿Cual es el monto tipico de sencillo que se deja en la caja al abrir (ej. s/ 100, s/ 150)? ¿Ese monto se queda en la gaveta de un dia para otro, o el administrador lo entrega y retira cada dia?
4. **Politica de compras con dinero de la caja (caja chica):**
   ¿El personal suele tomar efectivo de la venta diaria para comprar insumos de emergencia (leche, frutas, hielo) o pagar fletes? ¿O todos los gastos se pagan por transferencia o con un fondo fijo independiente?
5. **Tolerancia y responsabilidad ante faltantes:**
   ¿Existe una tolerancia para diferencias minimas por redondeo de monedas (ej. hasta s/ 1.00)? En caso de un faltante mayor, ¿se le descuenta al cajero, se asume como gasto de operacion o requiere autorizacion de gerencia para cerrar?
6. **Validacion de billeteras digitales (Yape / Plin):**
   ¿Como verifica actualmente el cajero que un Yape o Plin es legitimo y cuanto se vendio en el dia? ¿Tienen un celular del local en caja, o Kevin revisa las notificaciones desde su telefono personal?
7. **Necesidad de comprobante fisico de cierre:**
   ¿Kevin requiere obligatoriamente imprimir el ticket de cierre en la ticketera termica para graparlo a los vouchers fisicos de tarjeta, o prefiere revisarlo de forma digital en su telefono o laptop?

---
INFORME LISTO.
