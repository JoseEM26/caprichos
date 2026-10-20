---
id: ANA-CAP-016
tipo: analisis
titulo: "Informe Funcional: Módulo de Créditos del Personal (Vista 'creditos') - Rol Cajero"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, cajero-informes]
---

# Informe Funcional: Módulo de Créditos del Personal (Vista 'creditos') - Rol Cajero

## 1 Lo que el cajero YA puede hacer en el mockup en este modulo (con evidencia: lineas o funciones)

El análisis del archivo principal [Admin.dc.html](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html) y los documentos funcionales de fuente ([modulos-y-roles.md](file:///tmp/claude-1000/cajero-agy/fuente/modulos-y-roles.md), [BRD.md](file:///tmp/claude-1000/cajero-agy/fuente/BRD.md), [registro-mockup.md](file:///tmp/claude-1000/cajero-agy/fuente/registro-mockup.md)) permite identificar las siguientes capacidades y pantallas disponibles para el cajero:

1. **Acceso al módulo y visibilidad en el menú lateral**:
   - En [Admin.dc.html (línea 2667)](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2667), el rol cajero (`ROLES.cajero`) incluye explícitamente `'creditos'` dentro de su lista de vistas autorizadas (`views: [ 'escritorio', 'caja', 'cierre', 'reservas', 'clientes', 'creditos', 'ofertas', 'notificaciones' ]`).
   - En la barra de navegación lateral ([Admin.dc.html, línea 2807](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2807)), bajo el grupo "Clientes y ventas", el cajero visualiza el botón interactivo `Créditos del personal`, el cual navega a la vista `'creditos'`.

2. **Visualización del listado de créditos en tarjetas**:
   - La tabla base está definida en [Admin.dc.html (líneas 2693 a 2698)](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2693-L2698) bajo `TABLES.creditos`. Posee 9 columnas: Documento, Trabajador, Rol, Emisión, Vence, Monto (con 25 %), Saldo, Estado y Mes.
   - Cuenta con 8 registros iniciales de prueba (ej. vales `CP-P01` a `CP-P06` y `CP-S01` a `CP-S02`) pertenecientes a 6 colaboradores de distintos cargos (Marta de Caja, Luis de Cocina, Rosa de Mozo, Pedro de Almacén, Elena de Producción, Jorge de Reparto).
   - En la plantilla HTML ([Admin.dc.html, líneas 1089 a 1108](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1089-L1108)), cada registro se muestra como una tarjeta independiente (`trows`), exhibiendo el identificador de documento en el encabezado, una etiqueta de estado (badge con color según si está 'Al día', 'Por vencer', 'Vencido' o 'Pagado'), y un cuadrante con sus datos de cargo, fechas de emisión/vencimiento, monto pactado, saldo actual y mes.
   - Dispone de paginación de 6 en 6 registros ([Admin.dc.html, línea 2960](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2960)).

3. **Filtros interactivos y búsqueda predictiva**:
   - **Buscador de texto**: campo de búsqueda `tq` con marcador "Buscar por documento o trabajador" ([Admin.dc.html, líneas 1062 a 1064](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1062-L1064)).
   - **Filtros desplegables por faceta**: configurados en `TABLES.creditos.filters` ([Admin.dc.html, línea 2695](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2695)), accesibles al presionar el botón "Filtros" ([Admin.dc.html, líneas 1067 a 1086](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1067-L1086)):
     - Por **Trabajador**: Marta (cajera), Luis (cocina), Rosa (mozo), Pedro (almacén), Elena (producción), Jorge (reparto).
     - Por **Mes**: Septiembre, Octubre.
     - Por **Rol**: Caja, Cocina y barra, Mozo, Almacén, Producción, Reparto.
     - Por **Estado**: Al día, Por vencer, Vencido, Pagado.
     - Por **Registro**: Activos, Desactivados (filtro transversal del sistema, línea 2965).

4. **Gráfico de barras de consumo por trabajador**:
   - En la cabecera del módulo ([Admin.dc.html, líneas 1047 a 1051](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1047-L1051)), se despliega el bloque "Consumo a crédito por trabajador (con los filtros de abajo: Mes y Trabajador)".
   - La variable `credBars` ([Admin.dc.html, líneas 3484 a 3486](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3484-L3486)) calcula dinámicamente la sumatoria del consumo de cada trabajador según los filtros aplicados y dibuja barras horizontales proporcionales con el importe total acumulado en soles.

5. **Modificación de las condiciones comerciales de crédito (descuento % y días de plazo)**:
   - En [Admin.dc.html (líneas 1039 a 1046)](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1039-L1046), el cajero puede editar directamente en pantalla el porcentaje de descuento (`credPctV`) y el plazo para pagar en días (`credDaysV`).
   - Al pulsar el botón "Guardar", se invoca la función `saveCred` ([Admin.dc.html, líneas 3570 a 3572](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3570-L3572)), la cual abre un diálogo de confirmación y almacena los valores en el almacenamiento local (`writeCfg({ credit: this.state.credCfg })`).

6. **Cobro a crédito desde el módulo "Pedidos y caja"**:
   - En la vista de pedidos ([Admin.dc.html, líneas 416 a 419](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L416-L419)), cuando una comanda está pendiente de pago (`sel.canCollect`), aparece el botón secundario naranja **"Cobrar a crédito del personal"** junto a "Registrar cobro".
   - Al presionarlo, se activa la función `openCr` ([Admin.dc.html, línea 3584](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3584)) que abre el modal emergente `isCr` ([Admin.dc.html, líneas 1782 a 1793](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1782-L1793)).
   - **Selector de colaborador**: lista los miembros del equipo en botones interactivos (`crStaff`, línea 3585).
   - **Cálculo automático de descuento**: la función `estLine` y `crCalc` ([Admin.dc.html, líneas 3573 a 3577](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3573-L3577)) analiza los ítems del pedido, descuenta el 25 % configurable a los productos individuales y excluye explícitamente combos, docenas y promociones. Muestra en pantalla el total original, el monto descontado, el monto neto a pagar y la fecha límite de vencimiento (`crCalc.due`).
   - **Confirmación del cobro diferido**: la función `crConfirm` ([Admin.dc.html, líneas 3578 a 3582](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3578-L3582)) actualiza el pedido como pagado (`paid: true`, `pay: 'Crédito del personal'`), crea un nuevo código de vale (ej. `CP-P07`) y lo añade automáticamente a la lista activa de créditos del módulo (`credAdded`).

7. **Monitoreo desde el Escritorio del Cajero**:
   - En el panel de inicio del cajero ([Admin.dc.html, líneas 3002 a 3005](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3002-L3005)), en el bloque de pendientes, figura la tarjeta interactiva `Créditos por vencer (2)`, la cual enlaza directamente a la vista `'creditos'`.

8. **Edición genérica y desactivación de registros**:
   - Cada tarjeta de crédito presenta dos botones ([Admin.dc.html, líneas 1103 a 1105](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1103-L1105)):
     - Botón **"Editar"**: dispara `s.edit` ([Admin.dc.html, línea 2976](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2976)), abriendo el modal genérico de edición de datos de tabla ([Admin.dc.html, líneas 2008 a 2033](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2008-L2033)).
     - Botón **"Desactivar" / "Activar"**: ejecuta la acción `toggle` ([Admin.dc.html, línea 2975](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2975)) para ocultar o atenuar el vale mediante `tinactive`.

---

## 2 Lo que hace restaurant.pe en este modulo (resumen propio, con el archivo de REFERENCIA que lo respalda)

La funcionalidad del sistema de referencia se encuentra detallada en [/tmp/claude-1000/cajero-agy/referencia/creditos.md](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md) (con respaldos transversales en [ventas.md](file:///tmp/claude-1000/cajero-agy/referencia/ventas.md) e [informes.md](file:///tmp/claude-1000/cajero-agy/referencia/informes.md)). En restaurant.pe, el módulo de Créditos es un subsistema financiero de doble vía:

1. **División estructural del módulo**:
   - **Cuentas por Cobrar (Cobro de Ventas)** (`#!/creditos/ventacreditos`): administra deudas contraídas por clientes particulares o empresas con convenios corporativos autorizados ([creditos.md, líneas 16 a 21](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L16-L21)).
   - **Cuentas por Pagar (Pago de Compras)** (`#!/creditos/compracreditos`): gestiona los vencimientos de facturas emitidas por proveedores de insumos ([creditos.md, líneas 22 a 27](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L22-L27)).

2. **Panel de control financiero (Tarjetas métricas)**:
   - En la parte superior de la vista de cobranzas se muestran 4 tarjetas analíticas en tiempo real: **Deuda total acumulada**, **Interés generado**, **Monto total amortizado** y **Saldo neto pendiente** ([creditos.md, líneas 72, 88-89](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L72)).

3. **Mecanismo de cobranza y registro de abonos (amortizaciones)**:
   - **Cobro de cuota individual**: botón azul **"Pagar"** en cada fila. Abre la pasarela de caja (`modalcaja.view.html`) en su pestaña de pagos, permitiendo elegir si el cliente cancela en Efectivo, Tarjeta o Transferencia bancaria ([creditos.md, líneas 90 a 93](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L90-L93)).
   - **Cobro masivo por bloques**:
     - **"Pagar varias cuotas"**: cancela la deuda íntegra consolidada de un deudor en una sola operación ([creditos.md, línea 95](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L95)).
     - **"Pagar seleccionadas"**: permite marcar cuotas específicas con casillas de verificación y liquidarlas juntas ([creditos.md, línea 96](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L96)).
   - **Pantalla de pago manual directo**: (`ventacredito-registrar.html`) calcula en tiempo real el vuelto o el saldo faltante al ingresar el importe recibido, permite registrar número de operación bancaria, adjuntar foto del voucher y dejar observaciones contables ([creditos.md, líneas 175 a 194](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L175-L194)).

4. **Conciliación estricta con la Caja física**:
   - Toda cobranza de crédito realizada durante el turno genera inmediatamente un movimiento de ingreso en el arqueo del cajero activo, asegurando que el dinero recibido cuadre al momento del cierre de caja ([creditos.md, líneas 369 a 375](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L369-L375)).

5. **Auditoría completa 360° (Modal de detalle)**:
   - Al pulsar "Detalles", se abre el diálogo `detalleventa-modal.html` ([creditos.md, líneas 195 a 210](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L195-L210)):
     - Historial cronológico de abonos con fecha, hora, cajero receptor, caja y medio de pago.
     - Enlace para visualizar o descargar la imagen del voucher bancario.
     - Desglose de los productos e insumos consumidos en el ticket original.
     - Botón para reexpedir o imprimir copia física de la comanda térmica.
     - Función de **Anulación de amortizaciones**: exige ingresar obligatoriamente un motivo justificado para revertir un pago mal registrado.

6. **Canje tributario de comprobantes**:
   - Permite agrupar Notas de Venta emitidas al crédito y emitir una Boleta o Factura electrónica formal definitiva para efectos contables ante la administración tributaria ([creditos.md, líneas 98 a 101](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L98-L101)).

7. **Límites de crédito autorizados y convenios**:
   - Cada cliente habilitado para crédito posee un parámetro de **Límite de crédito** (`cliente_limitecredito`). El punto de venta no permite cobrar a crédito si el importe supera el saldo autorizado ([creditos.md, líneas 378 a 380](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L378-L380)). Dispone además de la opción "Reiniciar límite créditos" para contratos empresariales quincenales o mensuales ([creditos.md, línea 163](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L163)).

8. **Exportación de estados de cuenta y reportes**:
   - Menú de descarga en formatos Excel estándar, Excel Detallado (con cada cuota y abono histórico) y Excel analítico V2 ([creditos.md, líneas 104 a 106](file:///tmp/claude-1000/cajero-agy/referencia/creditos.md#L104-L106)).

---

## 3 Diferencias y faltantes

| Qué falta o está mal | Dónde se ve | Por qué importa | Gravedad |
| :--- | :--- | :--- | :--- |
| **NO EXISTE registro de pagos o abonos (amortizaciones)** | [Admin.dc.html, líneas 1102 a 1106](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1102-L1106) | El cajero no tiene forma operativa de registrar que un trabajador pagó su deuda (parcial o total). Solo hay botones "Editar" (que edita texto plano) y "Desactivar". | **ALTA** |
| **NO EXISTE conciliación con Caja ni arqueo de turno** | [Admin.dc.html, línea 3581](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3581) y vista `isCierre` | Si un trabajador paga su vale en efectivo o Yape, ese dinero no ingresa a la caja del cajero ni figura en el cierre. Igualmente, el cobro inicial se marca como pagado sin ingresar dinero físico. | **ALTA** |
| **Permisos de configuración comercial indebidos para el Cajero** | [Admin.dc.html, líneas 1042 a 1046](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1042-L1046) | El cajero puede modificar libremente el porcentaje de descuento (25 %) y los días de plazo (15 días) y guardarlos para todo el negocio, lo cual es función exclusiva del dueño/administrador. | **ALTA** |
| **Cálculo de fechas y vencimientos totalmente estáticos (hardcodeados)** | [Admin.dc.html, líneas 2466, 3577 y 3582](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2466) | La función `ddmm` asume que el sistema siempre está en octubre/noviembre de 2026. Al cobrar a crédito, la fecha de emisión se fija rígidamente en `'15/10'`, el mes en `'Octubre'` y el estado en `'Al día'`. | **ALTA** |
| **Falta de validación del titular del pedido al cobrar a crédito** | [Admin.dc.html, líneas 416 a 418](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L416-L418) y [línea 3584](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3584) | En "Pedidos y caja", cualquier pedido normal de un cliente común muestra el botón "Cobrar a crédito del personal". El cajero puede imputar consumos ajenos a un trabajador sin validación. | **ALTA** |
| **NO EXISTE Estado de Cuenta por Trabajador ni historial de consumos** | [Admin.dc.html, vista 'creditos'](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1038) | No hay vista consolidada, PDF ni ficha por colaborador donde se liste su saldo acumulado, las órdenes consumidas y los pagos efectuados para descuento por planilla. | **MEDIA** |
| **NO EXISTE filtro por año ni gráficos temporales de evolución** | [Admin.dc.html, línea 2695](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2695) | Los filtros solo incluyen "Mes" con opciones fijas `['Septiembre', 'Octubre']`. No existe filtro de Año ni reportes comparativos anuales de crédito. | **MEDIA** |
| **El gráfico de barras muestra consumo histórico acumulado y no deuda pendiente** | [Admin.dc.html, líneas 3485 a 3486](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3485-L3486) | La variable `crTot` suma la columna `Monto (con 25 %)` (consumo bruto) e ignora si el vale ya está en estado "Pagado" con saldo 0. No refleja lo que los trabajadores realmente deben hoy. | **MEDIA** |
| **NO EXISTE límite de crédito o tope de consumo por colaborador** | [Admin.dc.html, línea 3578](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3578) | A diferencia de restaurant.pe (`cliente_limitecredito`), un trabajador puede acumular consumos ilimitados sin que el sistema bloquee el vale por exceso de endeudamiento. | **MEDIA** |
| **Alerta de Escritorio "Créditos por vencer (2)" fija y no interactiva** | [Admin.dc.html, línea 3004](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3004) | Muestra un número "2" estático en el escritorio del cajero (en la tabla solo hay un registro por vencer). Al hacer clic, no filtra la tabla por el estado "Por vencer", sino que muestra todo. | **BAJA** |
| **Acciones de tarjeta inadecuadas para gestión contable ("Desactivar")** | [Admin.dc.html, líneas 1104, 2975](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1104) | En deudas financieras no procede "desactivar" un registro. Se debe liquidar, anular con justificación o pasar a cobranza dudosa. Desactivar solo oculta la deuda visualmente. | **BAJA** |

---

## 4 Errores o incoherencias que veas en el mockup

1. **Botón "Editar" en las tarjetas de crédito abre el editor genérico de texto**:
   - En [Admin.dc.html (línea 1103 y línea 2976)](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1103), el botón "Editar" de cada vale abre el diálogo modal `s.edit` ([línea 2008](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2008)). Este editor permite escribir a mano cualquier texto en las celdas de "Monto", "Saldo" o "Estado". Esto es un error grave de diseño: un cajero podría tipear "s/ 0.00" y "Pagado" para liquidar una deuda sin registrar un comprobante de abono ni ingresar el efectivo a caja.

2. **Botón "Desactivar" para documentos financieros**:
   - En [Admin.dc.html (línea 1104 y línea 2975)](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1104), el botón "Desactivar" ejecuta `tinactive`, lo que atenúa la tarjeta y le coloca la etiqueta "Desactivado". Una obligación de pago no puede simplemente desactivarse: debe figurar como cancelada, pendiente o anulada con motivo de auditoría.

3. **Incoherencia entre la regla "Crédito solo para personal" y la tabla de Clientes**:
   - En los documentos funcionales ([modulos-y-roles.md, línea 31](file:///tmp/claude-1000/cajero-agy/fuente/modulos-y-roles.md#L31) y [BRD.md, regla RN-CAP-058](file:///tmp/claude-1000/cajero-agy/fuente/BRD.md#L229)) se estipula taxativamente: *"El crédito es solo para el personal; no se da crédito a clientes"*.
   - Sin embargo, en [Admin.dc.html (líneas 2687 a 2688)](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2687-L2688), la tabla `TABLES.clientes` incluye la columna `"Crédito del personal"` con filtro `"Sí" / "No"`, mezclando a clientes externos con trabajadores y dejando abierta la ambigüedad respecto a si los clientes empresariales tienen o no crédito.

4. **El botón "Cobrar a crédito del personal" aparece en cualquier pedido de salón o mostrador**:
   - En [Admin.dc.html (línea 418)](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L418), la condición para mostrar el botón de crédito es simplemente `sel.canCollect` ([línea 3157](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3157)), la cual se cumple para toda comanda atendida pendiente de cobro. No valida si la orden se originó mediante "Pedido del personal" ([línea 228](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L228)). Cualquier mesa ocupada por clientes particulares puede ser cobrada a crédito de cualquier colaborador por error del cajero.

5. **Incoherencia de estado al cobrar a crédito en Pedidos y caja**:
   - Al confirmar el cobro a crédito en `crConfirm` ([Admin.dc.html, línea 3581](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3581)), la comanda se actualiza con `paid: true`. En la interfaz de Pedidos, el pedido pasa a figurar como cobrado y cerrado. No obstante, al cajero no le ingresó dinero ni hubo un medio de pago formal. Al revisar los totales de caja, no existe diferenciación entre ventas efectivas en caja y ventas diferidas a crédito.

6. **Permisos indebidos asignados al Cajero**:
   - En [Admin.dc.html (líneas 1042 a 1046)](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1042-L1046), el bloque de configuración "Condiciones del crédito del personal" es completamente editable por el cajero. El documento [modulos-y-roles.md (línea 64)](file:///tmp/claude-1000/cajero-agy/fuente/modulos-y-roles.md#L64) establece que el Administrador es el *"Único que ve ventas e indicadores del negocio y que cambia la carta, los colores, los usuarios y los datos personales"*. El cajero no debe poder modificar las políticas comerciales del negocio.

7. **Cálculo de fechas ficticias en `crConfirm` y `ddmm`**:
   - En [Admin.dc.html (línea 2466)](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2466), `const ddmm = (day) => { const d = day > 31 ? day - 31 : day; return String(d).padStart(2, '0') + '/' + (day > 31 ? '11' : '10'); };` fija rígidamente los meses en octubre (10) y noviembre (11).
   - En [línea 3582](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3582), al emitir el vale se guardan fijos los valores `'15/10'` y `'Octubre'`. Si el cajero cobra un crédito en otra fecha u otro mes, los registros siguen registrándose en octubre.

---

## 5 Propuesta concreta de mejora para el mockup (pantallas, campos, botones, reglas), priorizada

### Prioridad 1: Flujo de Cobranza y Amortización en Caja (Urgente / Operativo)
1. **Botón y modal "Registrar Abono / Pago" en las tarjetas de crédito**:
   - Retirar los botones "Editar" y "Desactivar".
   - Colocar en cada tarjeta con saldo pendiente el botón principal verde **"Registrar Pago"**.
   - Al pulsar "Registrar Pago", desplegar un modal con:
     - Nombre del colaborador y documento asociado (ej. `CP-P01`).
     - Saldo actual exigible (ej. S/ 48.00).
     - Campo **"Monto a pagar"**: numérico, precargado con el saldo total, pero editable para pagos parciales (amortizaciones). Validación: no permitir importes menores a 0 ni mayores al saldo adeudado.
     - Campo **"Medio de cobro"**: botones de selección rápida (Efectivo, Yape, Plin, Transferencia bancaria, Descuento por planilla).
     - Campo **"Código de operación / Voucher"**: requerido si el pago es por transferencia o billetera digital.
     - Campo **"Observación"**: texto libre opcional.
     - Botón de acción **"Confirmar Cobranza"**.
2. **Sincronización automática con el Turno de Caja**:
   - Toda cobranza registrada en efectivo, Yape o tarjeta debe impactar de inmediato en el módulo "Caja y cierres", sumándose a la sesión activa como un **"Ingreso por cobranza de crédito"** para asegurar el cuadre del cajero.
3. **Blindaje del cobro a crédito en Pedidos y caja**:
   - El botón "Cobrar a crédito del personal" solo debe habilitarse si el pedido fue marcado desde su creación como "Pedido del personal" o si tiene asignado un usuario del equipo. Si es un pedido de mesa o mostrador sin cuenta de trabajador, el botón debe permanecer oculto o deshabilitado con un aviso explicativo.

### Prioridad 2: Estado de Cuenta y Auditoría por Trabajador (Gestión Financiera)
1. **Modal de Estado de Cuenta Individual**:
   - Agregar en la cabecera del módulo un selector de trabajador con el botón **"Ver Estado de Cuenta"**.
   - Pantalla o modal que consolide:
     - Total acumulado de consumos del mes.
     - Total amortizado o pagado.
     - **Saldo neto pendiente de liquidación**.
     - Tabla histórica de vales emitidos, detalle de productos consumidos, fechas de consumo y abonos realizados con indicación del cajero que cobró.
     - Botón **"Imprimir Estado de Cuenta"** (ticket térmico o formato PDF para entrega al colaborador o descuento en la planilla quincenal).
2. **Corrección del indicador superior de consumo**:
   - Modificar la tarjeta superior para que muestre claramente dos métricas separadas: **"Deuda Pendiente por Cobrar"** (suma de saldos activos) y **"Consumo Mensual Acumulado"** (suma de compras).

### Prioridad 3: Seguridad, Permisos y Límites de Endeudamiento (Control y Políticas)
1. **Protección de la Configuración Comercial**:
   - Restringir la edición del Descuento (%) y Plazo (días) exclusivamente al rol `admin`.
   - Para el Cajero, dicho recuadro debe mostrarse en modo de solo lectura: *"Condiciones autorizadas: 25 % de descuento | 15 días de plazo (Configurado por Administración)"*.
2. **Límite de Crédito por Colaborador**:
   - Incorporar en el padrón de usuarios/trabajadores un campo configurable de **"Límite de crédito quincenal"** (ej. S/ 120.00).
   - Al momento de cobrar a crédito en Pedidos y caja, el sistema debe validar: `(Deuda pendiente actual + Nuevo pedido) <= Límite autorizado`. Si lo supera, impedir la operación o exigir autorización con clave del administrador.

### Prioridad 4: Filtros y Visualización Avanzada (Usabilidad)
1. **Filtro dinámico de Año y Calendario**:
   - Reemplazar las opciones estáticas de meses (`Septiembre`, `Octubre`) por selectores dinámicos de **Año** (ej. 2026) y **Mes** calendario, o un selector de rango de fechas real.
2. **Interconexión reactiva desde el Escritorio**:
   - Al hacer clic en la tarjeta de pendientes del escritorio `Créditos por vencer (X)`, el sistema debe redirigir a la vista `'creditos'` aplicando automáticamente el filtro `Estado = 'Por vencer'`, para que el cajero vea de inmediato únicamente los vales urgentes.

---

## 6 Preguntas para el dueno (Kevin)

1. **Destinatarios del crédito comercial**:  
   ¿El crédito en Caprichos será **exclusivamente para los trabajadores**, o se requiere habilitar créditos a **clientes corporativos / empresas vecinas** con convenios especiales (como colegios u oficinas que consumen por volumen mensual)?
2. **Modalidad de pago y amortización**:  
   ¿Cómo cancelan sus deudas los trabajadores: se acercan a la caja a pagar en efectivo / Yape en cualquier momento dentro de los 15 días, o el saldo acumulado se liquida mediante **descuento automático en su boleta de pago o planilla quincenal**?
3. **Límite máximo de endeudamiento**:  
   ¿Debe establecerse un tope máximo de crédito por trabajador (por ejemplo, hasta S/ 100.00 o S/ 150.00 por quincena, o un porcentaje tope de su sueldo) para evitar que acumulen deudas impagables?
4. **Comprobante fiscal de la venta al crédito**:  
   Al entregar comida a un trabajador a crédito, ¿se le debe emitir de inmediato una **Boleta de Venta electrónica formal** con el descuento comercial del 25 % impreso, o se registra internamente como una **Nota de Venta de consumo interno** que se regulariza al cierre del mes?
5. **Permisos y excepciones en caja**:  
   ¿Quién tiene autorización para otorgar excepciones de crédito (por ejemplo, si un trabajador superó su plazo o su límite): solo el dueño/administrador, o el cajero puede autorizarlo bajo su responsabilidad?
6. **Gestión de renuncias o ceses con saldo deudor**:  
   Si un colaborador deja de laborar en Caprichos manteniendo un crédito pendiente, ¿qué procedimiento contable debe seguir el cajero o administrador en el sistema para dar de baja o castigar la deuda?

---

## 7 NO VERIFICADO

1. **Procedimiento real de cobranza de personal en Caprichos**:  
   No se puede verificar en el código si en la operación diaria actual de Caprichos los empleados pagan sus consumos físicamente en caja o si la administración realiza los cobros descontando directamente en un archivo Excel de planillas externo.
2. **Existencia de convenios corporativos activos**:  
   No se puede verificar si Caprichos cuenta actualmente en producción con clientes empresariales o convenios que tengan una línea de financiamiento activa, ya que el mockup solo incluye registros simulados de trabajadores y empresas de muestra sin créditos habilitados.
3. **Tratamiento contable y tributario del descuento del 25 % ante SUNAT**:  
   No se puede verificar en los archivos estáticos si el descuento del 25 % otorgado a los colaboradores califica contablemente como descuento comercial en comprobante electrónico o como entrega gratuita / retiro de bienes sujeto a reglamentación tributaria específica.
4. **Estructura viva de la base de datos de producción**:  
   El análisis se basó exclusivamente en el archivo de maqueta estática `Admin.dc.html` y en la documentación técnica de referencia de restaurant.pe; no se tuvo acceso de lectura ni conexión a la base de datos SQL viva de Caprichos.

INFORME LISTO.
