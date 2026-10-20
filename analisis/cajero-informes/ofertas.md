---
id: ANA-CAP-018
tipo: analisis
titulo: "Informe de Analisis Funcional: Modulo de Ofertas y Descuentos para el Rol Cajero en Caprichos POS"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, cajero-informes]
---

# Informe de Analisis Funcional: Modulo de Ofertas y Descuentos para el Rol Cajero en Caprichos POS

Este informe evalua el funcionamiento, alcance de permisos y vacios operativos del modulo **Ofertas y Descuentos** (vista 'ofertas') para el rol de **Cajero** en el prototipo funcional actual de la cafeteria Caprichos (Lima, Peru). El analisis se fundamenta en la revision estatica de los archivos fuente del prototipo ([Admin.dc.html](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html), [modulos-y-roles.md](file:///tmp/claude-1000/cajero-agy/fuente/modulos-y-roles.md), [BRD.md](file:///tmp/claude-1000/cajero-agy/fuente/BRD.md), [flujo-de-pedidos.md](file:///tmp/claude-1000/cajero-agy/fuente/flujo-de-pedidos.md) y [registro-mockup.md](file:///tmp/claude-1000/cajero-agy/fuente/registro-mockup.md)) y se compara con la arquitectura funcional del sistema de referencia [restaurant.pe](file:///tmp/claude-1000/cajero-agy/referencia/promos.md).

---

## 1 Lo que el cajero YA puede hacer en el mockup en este modulo (con evidencia: lineas o funciones)

En el prototipo administrativo actual, el rol `cajero` tiene acceso al modulo `ofertas` ([Admin.dc.html, linea 2667](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2667)). Debido a que no existen restricciones internas de permisos por rol dentro de esta vista, el cajero puede visualizar, crear, editar, reordenar y desactivar elementos en las cuatro pestanas del modulo:

### 1.1 Pestana Promociones (`ofTab === 'promos'`)
- **Visualizacion de promociones vigentes:** El cajero visualiza las promociones activas e inactivas en tarjetas informativas ([Admin.dc.html, lineas 1125-1135](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1125-L1135)), que muestran nombre, precio en soles, tipo de oferta (Combo, 2x1, 3x2, etc.), distintivo de estado operativo ("Activa" / "Desactivada"), indicador de vigencia temporal calculado en tiempo real ("Vigente ahora", "Hoy no aplica", "Fuera de horario", "Programada" o "Vencida" segun la funcion `vigNow` en linea 2424), dias/horas de vigencia y el desglose de los componentes que integran la promocion.
- **Creacion de nuevas promociones:** Mediante el boton "+ Armar promocion" ([Admin.dc.html, linea 1124](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1124)), se abre el modal constructor `pbd` ([Admin.dc.html, lineas 1864-1895](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1864-L1895)). El cajero puede definir nombre, tipo (Combo, 2x1, 3x2, etc.), precio de venta, componentes (por producto individual, por tipo con sabores administrables o por categoria completa con opcion de reemplazo automatico si se agota el insumo principal), y el cronograma de vigencia (dias de la semana, horario desde/hasta, rango de fechas calendario desde/hasta, canales de venta autorizados y limite maximo por pedido). La accion se guarda con confirmacion obligatoria mediante la funcion `pbSave` ([Admin.dc.html, lineas 3664-3668](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3664-L3668)).
- **Edicion y activacion/desactivacion:** Cada tarjeta cuenta con botones para editar (`pr.edit`, [Admin.dc.html, linea 3657](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3657)) y para conmutar estado entre "Activar" y "Desactivar" (`pr.toggle`, [Admin.dc.html, linea 3658](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3658)).
- **Descuento de inventario en cocina:** Al enviarse un pedido a cocina con un producto en promocion, la funcion `acceptEffects` ([Admin.dc.html, lineas 2758-2766](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2758-L2766)) y la funcion `expandPromo` ([Admin.dc.html, lineas 2317-2339](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2317-L2339)) descomponen el combo y descuentan las existencias de cada producto o ingrediente por separado en el inventario.

### 1.2 Pestana Descuentos (`ofTab === 'descuentos'`)
- **Visualizacion de politicas de descuento automatico:** Se presentan tarjetas ([Admin.dc.html, lineas 1140-1149](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1140-L1149)) con el nombre de la regla (ej. "Happy hour de la tarde", "Domingos de waffles"), porcentaje o monto fijo rebajado, alcance (toda la carta, una categoria o un producto), dias y horas aplicables, monto de compra minima requerida y distintivo de vigencia activa.
- **Creacion y edicion de descuentos:** Mediante el boton "+ Nuevo descuento" ([Admin.dc.html, linea 1138](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1138)) y el modal `ddd` ([Admin.dc.html, lineas 1841-1861](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1841-L1861)), el cajero puede registrar y modificar reglas de rebaja automatica sin codigo, estableciendo nombre, tipo (porcentaje o monto en soles), valor, compra minima, catalogo objetivo, dias de la semana, ventana de horas, vigencia de fechas y canal. Se persiste mediante `ddSave` ([Admin.dc.html, lineas 3641-3644](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3641-L3644)).
- **Desactivacion/Activacion:** Las tarjetas permiten deshabilitar temporalmente el descuento sin eliminarlo (`d.toggle`, [Admin.dc.html, linea 3640](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3640)).

### 1.3 Pestana Cupones (`ofTab === 'cupones'`)
- **Administracion de cupones de comprobante y virtuales:** El cajero ve la lista completa de codigos creados ([Admin.dc.html, lineas 1174-1183](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1174-L1183)), con su valor porcentual o en soles, vigencia hasta, veces impreso y si aplica a toda la carta o productos seleccionados.
- **Creacion de cupones con parametros avanzados:** Mediante el boton "+ Nuevo cupon" ([Admin.dc.html, linea 1165](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1165)) y el modal `cpd` ([Admin.dc.html, lineas 1796-1822](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1796-L1822)), el cajero puede configurar: codigo alfanumerico, descripcion, tipo (porcentaje o monto fijo), compra minima requerida, vigencia desde/hasta, limite de usos maximos generales, usos permitidos por cliente, aplicacion a producto o categoria, canal comercial, obligatoriedad de cuenta registrada del cliente y si sale impreso al pie del comprobante (con frase publicitaria y dias de validez). Se guarda mediante `cpSave` ([Admin.dc.html, lineas 3599-3609](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3599-L3609)).
- **Orden de prioridad de impresion:** Cada tarjeta tiene botones de flecha arriba y abajo (`c.up`, `c.down`, [Admin.dc.html, linea 3595](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3595)), que permiten al cajero alterar el orden de impresion de los cupones que saldran en las boletas.
- **Vista previa de impresion termica:** La interfaz muestra un bloque de previsualizacion fiel ("ASI SALEN EN EL COMPROBANTE", [Admin.dc.html, lineas 1170-1172](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1170-L1172)), renderizando la simulacion de corte termico con lineas discontinuas, tijera, titulo, detalle de rebaja, dias de validez, codigo compuesto con correlativo (ej. `DUO20-0102`) y texto legal al pie.
- **Historial de auditoria de cupones:** El boton "Ver historial" ([Admin.dc.html, lineas 1167 y 1173](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1167)) despliega una bitacora interna generada por `logCt` ([Admin.dc.html, linea 3590](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3590)), donde se registra fecha, hora, rol de usuario responsable y accion efectuada (creaciones, modificaciones, cambios de orden en la lista, modificaciones de cupo por ticket e impresiones efectuadas en caja con detalle de pedido y codigos emitidos).

### 1.4 Pestana Reglas (`ofTab === 'reglas'`)
- **Configuracion global de politicas comerciales:** El cajero puede modificar las variables maestras del negocio ([Admin.dc.html, lineas 1151-1161](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1151-L1161)):
  1. Si se permite juntar o no un cupon con un descuento automatico (`rgAcumula`, [Admin.dc.html, linea 3652](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3652)).
  2. Cantidad de cupones impresos por comprobante: 1, 2 o 3 (`ctPorChips`, [Admin.dc.html, linea 3619](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3619)).
  3. Dias de validez por defecto para cupones nuevos (`rgValidez`, [Admin.dc.html, linea 3653](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3653)).
  4. Texto legal impreso al pie de los cupones (`rgPie`, [Admin.dc.html, linea 3653](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3653)).
  5. Boton de navegacion directa hacia "Creditos del personal" (`goCreditos`, [Admin.dc.html, linea 3654](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3654)).
- **Guardado y descarte:** Dispone de botones para guardar los cambios a nivel general (`rgSave`) o revertirlos (`rgDiscard`) con alerta de cambios pendientes (`rgDirty`, [Admin.dc.html, linea 1154](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1154)).

### 1.5 Impresion de Cupones en el Comprobante de Caja
- En la vista de pedidos ([Admin.dc.html, lineas 378-397](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L378-L397)), pestana Comprobante, el cajero puede revisar el ticket final del cliente.
- Si hay cupones activos marcados para impresion (`ctActive`, [Admin.dc.html, linea 3059](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3059)), estos se adhieren abajo con la leyenda "cortar aqui", mostrando titulo, detalle, fecha de caducidad calculada y codigo dinamico con sufijo del pedido (ej. `DUO20-0101`).
- Al pulsar "Imprimir comprobante con cupones" (`printReceipt`, [Admin.dc.html, linea 3868](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3868)), el contador de veces impreso del cupon se incrementa y se asienta el evento en el historial `ctLog`.

---

## 2 Lo que hace restaurant.pe en este modulo (resumen propio, con el archivo de REFERENCIA que lo respalda)

Segun la documentacion tecnica y funcional de referencia ([referencia/promos.md](file:///tmp/claude-1000/cajero-agy/referencia/promos.md), respaldada por [referencia/ventas.md](file:///tmp/claude-1000/cajero-agy/referencia/ventas.md) y [referencia/modulos.md](file:///tmp/claude-1000/cajero-agy/referencia/modulos.md)), restaurant.pe estructura las ofertas, descuentos y fidelizacion en cinco subsistemas comerciales diferenciados, gobernados por permisos de acceso restringidos:

### 2.1 Ofertas Comerciales por Matriz y Modalidad (`#!/ofertas`)
- **Cuatro mecanicas predefinidas:** 
  1. *2 en 1:* Venta de un paquete cerrado de articulos a precio fijo global (`oferta2en1`).
  2. *2 x 1:* Mecanica clasica de compra un producto y lleva otro bonificado o de menor valor (`oferta2x1`).
  3. *Precio Bajo:* Rebaja directa unitaria o escalonada por volumen vendido ("de 1 a 5 unidades a S/ 10, de 6 a mas a S/ 8") con soporte para activacion diferenciada en carta QR web (`lowprice`).
  4. *Por Salon:* Precios diferenciados de acuerdo con la zona fisica de consumo (ej. barra vs. terraza vs. salon principal) (`porsalon`).
- **Matriz de sucursales:** Permite encender o apagar la oferta local por local de forma granular o masiva con casillas de verificacion maestras.
- **Restricciones:** Filtro por canal (Delivery, Salones, Venta Rapida), condicion de monto minimo de pedido para activar la oferta y control de cupos maximos por comanda o stock limite.
- **Acceso:** Protegido por permiso de seguridad ACL `"ofertas"` (no asignado al cajero).

### 2.2 Politicas y Categorias de Descuento (`#!/descuentos`)
- **Tipificacion formal de motivos:** No existen descuentos arbitrarios sin sustento; se crean categorias normadas como "Cortesia de Salon", "Descuento de Personal", "Convenio Corporativo" o "Descuento de Gerencia".
- **Limites y candados de seguridad en caja:** Cada categoria define un porcentaje por defecto y un **Monto Maximo en soles** autorizado. Si en el punto de venta el cajero o mozo intenta aplicar una rebaja que supere dicho tope, el sistema bloquea la transaccion y solicita obligatoriamente el PIN de aprobacion del supervisor o administrador.
- **Deducibilidad tributaria y control fiscal:** Permite marcar si el descuento tiene un porcentaje deducible de impuestos (gastos de representacion).
- **Regla anti-acumulacion:** Casilla `"No afecta a promociones u ofertas"` (`categoriadescuento_noafectaoferta`). Al marcarse, el algoritmo de caja descuenta unicamente sobre los productos con precio regular, ignorando y protegiendo el margen de los platos que ya tienen ofertas aplicadas.
- **Acceso:** Protegido por permiso de seguridad ACL `"descuentos"`.

### 2.3 Cupones de Descuento con Monedero y Lotes (`#!/ajustes/cupondescuento`)
- **Emision masiva y correlativa:** Permite generar series correlativas por lotes (ej. desde `PROM-001` hasta `PROM-500`) con verificacion automatica de siglas unicas, ademas de carga masiva mediante importacion de archivos Excel.
- **Control de saldo remanente (Monedero):** El cupon no se extingue si el consumo es menor al valor facial; mantiene campos para `monto`, `monto_usado` y `monto_disponible`, permitiendo que el cliente gaste el remanente en su siguiente visita.
- **Politica de un solo uso por cliente:** Mediante el parametro `cupondescuento_unusoporcliente`, el sistema POS exige en caja ingresar el DNI del comensal y rechaza el cupon si ese documento ya lo redimio previamente en cualquier sucursal.
- **Acceso:** Protegido por permiso de seguridad ACL `"ajustes"`.

### 2.4 Promociones y Sorteos en Punto de Venta (`#!/promocionsorteo`)
- **Disparador automatico en ticketera:** Campanas vinculadas al volumen de venta en caja.
- **Mecanica por consumo o productos:** Configura la regla para que, al momento de cobrar, la ticketera termica expida de forma complementaria boletos para anforas fisicas (ej. "Por cada S/ 40.00 de consumo, imprima 1 boleto de sorteo", con un tope de hasta 5 cupones por venta).
- **Campos en blanco y mensaje legal:** El boleto sale preformateado con lineas para que el cliente llene a mano: Nombre, DNI, Telefono y Correo, seguido del texto legal de la promocion.
- **Acceso:** Protegido por permiso de seguridad ACL `"clientes"`.

### 2.5 Vales de Pago y Certificados de Regalo / Gift Cards (`#!/ajustes/valedepago`)
- **Integracion con cobros de caja:** El vale se comporta directamente como una forma de pago en la interfaz de cobranza (`ingresovalepago.view.html`).
- **Validacion de saldo y reutilizacion:** El cajero ingresa el codigo del vale, el sistema consulta el saldo en linea, descuenta la venta y, si el vale es reutilizable, conserva el saldo restante para compras futuras.
- **Restriccion por catalogo:** Posibilidad de vincular el vale exclusivamente a ciertos productos autorizados (ej. solo cafeteria y tortas, no licores ni platos de cocina).

---

## 3 Diferencias y faltantes

La siguiente tabla resume las brechas detectadas entre el prototipo y las necesidades reales del puesto de cajero frente a la referencia:

| Que falta o esta mal | Donde se ve | Por que importa | Gravedad |
| :--- | :--- | :--- | :--- |
| **No se pueden elegir promociones en Nuevo Pedido manual** | En `moProds` ([Admin.dc.html, linea 3291](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3291)), solo se listan productos de `MCAT`. Las promociones creadas en la pestana Promociones (ej. `2x1 LATTE COFFE`) NO EXISTEN en la lista de seleccion. | Si un cliente pide en mesa o en caja una promocion vigente del local, el mozo o cajero no puede marcarla ni cobrar el precio promocional; tendria que marcar productos sueltos cobrando de mas. | Alta |
| **No se pueden redimir cupones en Nuevo Pedido ni en Cobros de Caja** | En el flujo de `Nuevo pedido` ([Admin.dc.html, lineas 1622-1755](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1622-L1755)) y en el boton `collectSel` ([Admin.dc.html, linea 3872](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3872)), NO EXISTE ningun campo, boton o modal para ingresar o validar codigos de cupon. | Los cupones impresos que el propio cajero entrega al cliente (ej. `DUO20-0102`) solo se pueden canjear en la carta web; el cajero esta completamente incapacitado para recibirlos y aplicarlos en el local fisico. | Alta |
| **Los descuentos automaticos no se aplican en pedidos manuales** | En la creacion de pedidos de salon o mostrador (`sendMo`, [Admin.dc.html, lineas 3315 y 3322](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3315)), el total es la suma plana de productos. Las reglas de `s.descs` (ej. 15% en happy hour) no se evaluan. | Si es la hora del happy hour y el cliente pide en el local a traves del cajero o mozo, no se le aplica el descuento reglamentado; se produce cobro indebido y quejas en mostrador. | Alta |
| **El cajero tiene permisos de Administrador para alterar ofertas y reglas** | En `ROLES.cajero` ([Admin.dc.html, linea 2667](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2667)) y en la vista `ofertas` ([Admin.dc.html, lineas 1120-1184](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1120-L1184)), el cajero puede crear, editar, desactivar promociones y cambiar politicas generales del negocio. | Riesgo grave de fraude interno o descontrol comercial: un empleado de caja podria inventar un cupon de 90%, cambiar las reglas de no acumulacion o desactivar promociones oficiales del dueno. | Alta |
| **No existen categorias de descuento operativo ni autorizacion por PIN** | En el prototipo NO EXISTE la definicion de categorias de descuento operativo (cortesias, personal en sala, convenios). Tampoco existe el ingreso de PIN supervisor para montos maximos. | En la operacion diaria hay platos derramados, cortesias a clientes especiales o descuentos de amigos del dueno. Al no haber motivos tipificados ni autorizacion, o no se hace nada o se descuadra la caja. | Alta |
| **Vigencia de cupones con fecha base fija en el comprobante** | En `sel.receiptCoupons` ([Admin.dc.html, linea 3150](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3150)), la caducidad se calcula sobre `Date.UTC(2026, 9, 15)` (15 de octubre de 2026). | Cualquier ticket emitido hoy o en fechas posteriores calcula la vigencia contra una fecha fija del pasado o del diseno original, generando cupones impresos ya vencidos o con dias erroneos. | Alta |
| **Historial de cupones no registra canjes ni clientes** | En `logCt` ([Admin.dc.html, linea 3590](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3590)) y documentado en [registro-mockup.md, linea 95](file:///tmp/claude-1000/cajero-agy/fuente/registro-mockup.md#L95), los usos no incrementan al canjear ni se asocia al DNI del cliente. | No hay control de fraude: un cliente puede reutilizar infinitamente el mismo codigo de cupon impreso porque el sistema no marca que ya fue redimido ni valida su documento. | Media |
| **Mecanica de Sorteos y Vales de Pago no operativa** | En `LIST_DEFAULT.tipos` ([Admin.dc.html, linea 2104](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2104)), existen los nombres "Vale" y "Sorteo", pero actuan como combos corrientes. NO EXISTE emision de boletos de sorteo ni cobro por Gift Card. | No se pueden realizar campanas de fidelizacion con anforas en mostrador ni vender/canjear certificados de regalo corporativos. | Media |

---

## 4 Errores o incoherencias que veas en el mockup (botones que no hacen nada, textos viejos, reglas contradictorias con flujo-de-pedidos.md, permisos que no corresponden al cajero)

1. **Permisos indebidos en el rol Cajero:**
   - En [modulos-y-roles.md, linea 137](file:///tmp/claude-1000/cajero-agy/fuente/modulos-y-roles.md#L137), se establecio como punto abierto: *"Si el cajero tambien edita ofertas o solo las consulta"*. Sin embargo, en el codigo actual ([Admin.dc.html, lineas 1120-1184](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1120-L1184)), el cajero tiene acceso total de escritura: botones "+ Armar promocion", "+ Nuevo descuento", "+ Nuevo cupon", "Guardar reglas", flechas para cambiar el orden de impresion y botones para desactivar ofertas del local. Un cajero jamas deberia fijar precios ni crear campanas comerciales.
2. **Incoherencia entre la carta y las promociones armadas:**
   - En el prototipo existen dos promociones que figuran estaticamente como productos en la categoria `combos` de `MCAT` ("DUO PARA COMPARTIR" y "DUO IRRESISTIBLE", [Admin.dc.html, lineas 2231-2232](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2231-L2232)). Pero a la vez, en la lista inicial `PROMOS0` ([Admin.dc.html, lineas 2308-2311](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2308-L2311)), se encuentran registradas `2x1 LATTE COFFE` y `2x1 ICED COFFE`. Estas ultimas dos no se encuentran en `MCAT` y por lo tanto son totalmente invisibles e imposibles de pedir en el modulo de toma de pedidos manuales de sala o mostrador.
3. **Subtitulo enganoso en la vista de Ofertas:**
   - En [Admin.dc.html, linea 2699](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2699), el encabezado del modulo declara: `"Combos, promociones por cantidad, descuentos, cupones, vales y sorteos"`. Sin embargo, en el diseno solo existen 4 pestanas (`promos`, `descuentos`, `cupones`, `reglas`); no existen pantallas de configuracion ni gestion operativa para "vales" ni "sorteos".
4. **Calculo de fecha de validez con valor congelado:**
   - En [Admin.dc.html, linea 3150](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3150), la leyenda de validez del cupon impreso en comprobante ejecuta: `dmy(Date.UTC(2026, 9, 15) + (parseInt(c.validez, 10) || 15) * 86400000)`. La fecha del sistema esta congelada en el 15 de octubre de 2026, lo que contradice el principio de emision dinamica de comprobantes.
5. **Gestion de listas no habilitada en Ofertas:**
   - La constante `LIST_COLS` ([Admin.dc.html, linea 2108](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2108)) declara `{ ofertas: { 1: 'tipos' } }`. No obstante, la constante `MANAGE` ([Admin.dc.html, linea 2109](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2109)) no incluye a `ofertas`. En consecuencia, el boton "Gestionar listas" nunca se muestra en este modulo, dejando los tipos de oferta congelados en los valores de fabrica sin poder ser editados desde la vista.

---

## 5 Propuesta concreta de mejora para el mockup (pantallas, campos, botones, reglas), priorizada

Para subsanar las brechas operativas detectadas y alinear el comportamiento con restaurant.pe sin sobrecargar la experiencia del usuario, se plantea la siguiente propuesta por niveles de prioridad:

### Prioridad 1 (Critica para la venta diaria en el local)

#### A. Inclusion de Promociones en "Nuevo Pedido" (Mozo y Cajero)
- **Modificacion en la grilla de productos:** Al pulsar la categoria "Combos" o "Promociones" en la toma de pedidos ([Admin.dc.html, lineas 1701-1712](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1701-L1712)), el sistema debe incluir dinamicamente todos los registros de `s.promos` que esten activos (`on: true`) y cuya vigencia (`vigNow`) sea valida para el canal actual (Salon o Para Llevar).
- **Mecanica de seleccion de opciones:** Al tocar una promocion (ej. `2x1 LATTE COFFE`), si contiene productos con variantes o sabores, debe abrirse la ventana de opciones existente para que el operador especifique los detalles de cada componente antes de agregarlo a la comanda.

#### B. Campo de Canje de Cupones en Toma de Pedidos y Cobro
- **En la columna del pedido:** En `Nuevo pedido` ([Admin.dc.html, linea 1748](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1748)), incorporar un campo con boton: `[ Codigo de cupon ] [ Aplicar ]`.
- **Validacion inmediata:** Al validar el codigo:
  - Verificar vigencia con la fecha real actual.
  - Verificar compra minima requerida.
  - Verificar que el cliente cumpla la regla de uso unico (cruzando con el DNI del cliente si se selecciono "Cuenta").
  - Aplicar el descuento directamente sobre el subtotal de la comanda, desglosando la linea: *"Descuento por Cupon [CODIGO]: − s/ X.XX"*.
- **En la pantalla de Cobro:** En el panel de cobro de caja ([Admin.dc.html, linea 417](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L417)), permitir agregar un cupon antes de presionar "Registrar cobro" si el cliente lo presenta en mostrador.

#### C. Aplicacion Automatica de Descuentos Horarios en Salon
- Al consolidar el carrito de pedidos (`moTotal`, [Admin.dc.html, linea 3315](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3315)), el sistema debe invocar la misma logica de la carta web: evaluar si hoy y a esta hora calza un descuento automatico (ej. Happy Hour). Si cumple, agregar una linea deducible visible en el preconteo y comprobante.

### Prioridad 2 (Seguridad operativa y control de roles)

#### D. Modo "Solo Consulta" en Ofertas para el Cajero
- **Perfilamiento de la vista:** Si el usuario autenticado tiene rol `cajero`:
  - Ocultar los botones de accion administrativa: "+ Armar promocion", "+ Nuevo descuento", "+ Nuevo cupon", "Guardar reglas", "Descartar", las flechas de orden y los botones "Editar" de las tarjetas.
  - Reemplazar los botones por un boton pasivo: "Ver condiciones / detalle".
  - En la pestana Reglas, presentar los valores en modo solo lectura informativo (sin botones clickeables que alteren las politicas de la empresa).
  - La creacion, edicion y desactivacion de ofertas queda reservada exclusivamente al rol `admin`.

#### E. Descuentos Operativos Manuales con Autorizacion por PIN
- **Modal de Descuento en Caja:** En el detalle de pedido antes de cobrar, habilitar un boton: "Aplicar Descuento / Cortesia".
- **Campos:** Selector de motivo obligatorio (*Cortesia*, *Consumo personal*, *Convenio*, *Compensacion por queja*), tipo (% o monto fijo en soles) y justificacion.
- **Regla:** Si el descuento supera el limite parametrizado (ej. mas de S/ 20.00 o mas del 25%), el sistema debe desplegar un teclado numerico de 4 digitos solicitando el "PIN del Administrador" para continuar.

### Prioridad 3 (Fidelizacion y consistencia)

#### F. Correccion del Calculo de Fecha en el Ticket Termico
- Reemplazar la fecha fija en [Admin.dc.html, linea 3150](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3150) por:
  `dmy(Date.now() + (parseInt(c.validez, 10) || 15) * 86400000)` para que cada boleta impresa asigne una fecha limite calculada exactamente a partir del dia en que se atiende al cliente.

#### G. Registro Real de Redencion de Cupones en Historial
- Al cobrar un pedido con cupon, incrementar el contador `c.usos` en la base del cupon y agregar un registro a `ctLog` con el formato: `[Fecha y Hora] · [Cajero]: Canjeo el cupon [CODIGO] en pedido [CP-XXXX] (Cliente: [DNI/Nombre])`.

---

## 6 Preguntas para el dueno (Kevin)

1. **Nivel de autonomia del cajero:** ¿El cajero en Caprichos debe poder crear o desactivar promociones y descuentos cuando se agote un producto en tienda, o su acceso a este modulo debe ser estrictamente informativo (solo consulta) para explicarle las ofertas a los clientes?
2. **Descuentos por cortesia o problemas de atencion:** Cuando se presenta un incidente con un comensal (por ejemplo, una bebida fria o demora excesiva) o se atiende a una visita de gerencia, ¿como aplica hoy el cajero una cortesia o descuento manual? ¿Se requiere ingresar una clave o autorizacion verbal?
3. **Canje de cupones impresos en el local:** Los cupones que salen al pie de la boleta (ej. "20% en tu siguiente compra"): ¿los clientes los presentan frecuentemente en caja fisica o estan orientados unicamente a fomentar compras posteriores por la web?
4. **Mecanica de Sorteos con anforas:** ¿Caprichos realiza sorteos fisicos con tickets impresos en caja donde el cliente anota a mano su nombre y telefono para depositarlos en un anfora, o todas las promociones son exclusivamente rebajas de precio inmediatas?
5. **Tarjetas de Regalo (Gift Cards) y Vales:** ¿Existe la venta o entrega de vales de consumo o Gift Cards corporativas? De ser asi, ¿el cliente puede consumir su saldo en varias visitas o debe gastarlo todo en una sola compra?

---

## 7 NO VERIFICADO

1. **Prueba de impresion fisica en ticketera termica:** Debido a las restricciones de auditoria estatica y a la ausencia de hardware de impresion conectado al entorno de pruebas, no fue posible comprobar el corte de papel fisico ni la densidad visual de los cupones emitidos tras la boleta de venta.
2. **Persistencia entre navegadores distintos:** Al depender el administrativo de almacenamiento local (`window.localStorage`), no fue posible comprobar de manera estatica si la sincronizacion de cupones y reglas hacia la carta virtual del cliente opera en tiempo real cuando se ejecuta en dispositivos fisicos independientes sin una base de datos centralizada conectada.

---

INFORME LISTO.
