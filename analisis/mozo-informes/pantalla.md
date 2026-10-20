---
id: ANA-CAP-040
tipo: analisis
titulo: "INFORME DE EVALUACIÓN: FLUJO DE TRABAJO DEL MOZO EN PANTALLA"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, mozo-informes]
---

# INFORME DE EVALUACIÓN: FLUJO DE TRABAJO DEL MOZO EN PANTALLA

**Proyecto:** Caprichos - Cafetería Artesanal (Lima)  
**Documento analizado:** `fuente/Admin.dc.html` (Mockup administrativo v96)  
**Documentos de contraste:** `referencia/` (Restaurant.pe), `fuente/flujo-de-pedidos.md`, `fuente/acta-01-descubrimiento.md`, `fuente/acta-02-descubrimiento.md`, `fuente/iniciativas-acta-02.md`, `fuente/modulos-y-roles.md`, `fuente/BRD.md`  
**Enfoque de auditoría:** Flujo operativo completo del rol Mozo, usabilidad táctil en celular y gestión de casos límite.  

---

## 1. RESUMEN EJECUTIVO

El rol de Mozo en el mockup actual (`fuente/Admin.dc.html`, clave de rol `mozo`) implementa con fidelidad la directriz central expresada por Kevin Rosales: **el mozo no cobra dinero en el sistema y los pedidos tomados en sala van directo a las pantallas de cocina sin requerir validación previa de caja**. Asimismo, se incluye la visualización de planos, modalidades de venta (En el local, Para llevar, Delivery, Reserva), pedidos del personal y circuito de precuenta con código QR.

Sin embargo, la auditoría del recorrido completo en pantalla evidencia **vacíos operativos críticos para una cafetería de salón**, fallas severas de **ergonomía y usabilidad táctil en celulares** (botones de mesa de 17 píxeles y scroll vertical excesivo), y la **imposibilidad técnica de resolver escenarios cotidianos del salón**: no se puede agregar productos a una comanda ya enviada, no se puede cambiar de mesa a clientes reubicados, no se pueden anular ítems despachados erróneamente, y las mesas reservadas quedan bloqueadas impidiendo abrir el pedido cuando los comensales se presentan.

---

## 2. RECORRIDO COMPLETO DEL FLUJO DE TRABAJO DEL MOZO

A continuación se auditan de forma exhaustiva los 15 pasos y funciones del recorrido del mozo en el mockup.

```
+--------------------------------------------------------------------------------------------------+
| FLUJO EN PANTALLA: ROL MOZO (Caprichos)                                                         |
+--------------------------------------------------------------------------------------------------+
| [1. Modalidad/Mesa] ---> [2. Catálogo/Buscador] ---> [3. Opciones Prod.] ---> [4. Carrito/DNI]   |
|   - En el local (Plano)     - Filtro por categoría     - Tamaño (Var)            - Sin cuenta    |
|   - Para llevar             - Buscador por nombre      - Leche, Endulzante       - DNI 8 dígitos |
|   - Delivery (GPS/Mapa)     - Fotos On/Off             - Extras / Adicionales    - Personal      |
|   - Reservar mesa                                      - Nota para cocina        - Cupón promo   |
|                                                                                                  |
| [5. Enviar a Cocina] --> [6. Estado en Mesa]  -----> [7. Precuenta]     -----> [8. Cobro Caja]   |
|   - Va directo a KDS        - En cola (cola)           - Vista en pantalla       - Mozo NO cobra |
|   - Descuenta stock         - En preparación (prep)    - QR transferencia        - Caja cobra y  |
|   - Imprime etiquetas       - Listo para llevar (listo)- Falta botón Imprimir      libera mesa   |
+--------------------------------------------------------------------------------------------------+
```

---

### 2.1 Elegir mesa o modalidad

* **Ubicación en el mockup / acta:**
  Botón "Nuevo pedido" (`openMo`) en vista Pedidos y caja, y paso modal `isMoModal` / `isMoPlan` en `Admin.dc.html`. Acta 02 (Kevin Rosales): "el mozo lo que agarra es cuando va a tomar el pedido... son ocho mesas más o menos".
* **Descripción técnica y operativa:**
  Al pulsar "Nuevo pedido", el sistema despliega el modal "¿Qué vas a hacer?" con cuatro tarjetas: "En el local (mesa)", "Para llevar", "Delivery" y "Reservar mesa".
  Si se pulsa "En el local", el sistema valida la cantidad de pisos activos. Si hay un solo piso activo (`p1`), avanza directamente al plano (`isMoPlan`); si hay varios pisos activos, muestra selector previo de pisos (`isMoFloor`).
  En el plano, las mesas muestran tres estados visuales:
  - Libre: Fondo verde claro, borde verde oscuro.
  - Ocupada: Fondo naranja claro, borde naranja oscuro, etiqueta "ocupada" o número de comanda.
  - Reservada: Fondo amarillo suave, borde mostaza, letra "R" y hora de reserva.
  Adicionalmente existe un selector de modo: "Tomar pedido" o "Liberar o marcar mesa".
* **Evaluación para cafetería:**
  Cumple con la agilidad requerida para un salón pequeño de 8 mesas reales. Sin embargo, no permite ver de un vistazo qué mozo atiende cada mesa ocupada ni el tiempo transcurrido desde la ocupación.
* **Clasificación de certeza:** CONFIRMADO en el código y en el acta.
* **Prioridad:** Media.

---

### 2.2 Buscar productos

* **Ubicación en el mockup / acta:**
  Input `#mo-q` ("Buscar producto"), selector de categorías `moCats` y chips `moImgChips` dentro de `isMoItems`.
* **Descripción técnica y operativa:**
  La lista `moProdsBase` aplica filtros combinados: disponibilidad activa (`s.avail !== false`), categoría activa (`catOn`), vigencia de horario/canal (`vigNow`), coincidencia de categoría (`mo.cat === 'Todos' || CATLABEL[p.cat] === mo.cat`) y búsqueda por texto (`p.name.toLowerCase().indexOf(mq) >= 0`).
  Dispone de un selector de vista "Sin imagen" / "Con imagen", lo que permite aligerar la vista en conexiones lentas.
* **Deficiencias detectadas:**
  1. Si el mozo tiene seleccionada una categoría específica (ejemplo: "Bebidas calientes") e introduce en el buscador un término de otra categoría (ejemplo: "Club Sandwich"), el sistema devuelve cero resultados. Obliga al mozo a regresar manualmente a la pestaña "Todos" para buscar globalmente.
  2. El buscador solo compara con el atributo `p.name`. No busca por ingredientes, etiquetas ("PROMO", "VEGANO") ni descripciones.
  3. Si la categoría activa es "Promociones", la lista conmuta a `moPromoItems`, la cual no implementa filtro por texto (`mq`), ignorando completamente lo que el mozo escriba en la barra de búsqueda.
* **Evaluación para cafetería:**
  En horas punta de desayuno o lonche, un mozo necesita tipear "sin lactosa" o "sandwich" sin preocuparse de en qué pestaña de la carta se encuentra parado.
* **Clasificación de certeza:** CONFIRMADO en el código.
* **Prioridad:** Alta.

---

### 2.3 Opciones (tamaño, tipo de leche, endulzantes, extras)

* **Ubicación en el mockup / acta:**
  Modal `isCfg` ("Opciones del producto"), variables `cfgVariants`, `cfgGroups`, `cfgNote`, `cfgAdd` en `Admin.dc.html`.
* **Descripción técnica y operativa:**
  Al tocar un producto del catálogo, se abre una ventana modal flotante:
  - Variantes de tamaño/presentación: Botones de selección única (ejemplo: Regular 12 oz, Grande 16 oz, 21 oz) con actualización inmediata del precio base.
  - Grupos de modificadores (`cfgGroups`): Soporta selección única (`type: 'one'`) o múltiple con topes (`min` y `max`), como tipo de leche (Entera, Deslactosada, Almendras), endulzante (Azúcar rubia, Stevia, Sin azúcar) y adicionales/extras con recargo monetario explícito (`+ s/ 3.00`).
  - Grupos con más de 8 opciones activan un buscador interno (`hasSearch`).
  - Validación de obligatoriedad: Si un grupo obligatorio no es completado, el botón de agregar bloquea la acción y emite alerta: "Falta elegir: [Nombre del grupo]".
  - Contador de unidades integrado (`cfgMinus`, `cfgPlus`).
* **Evaluación para cafetería:**
  Es una de las secciones mejor logradas del mockup. Modela con precisión la personalización crítica de una cafetería de especialidad, donde equivocarse en el tipo de leche (entera vs deslactosada o vegetal) arruina la comanda.
* **Clasificación de certeza:** CONFIRMADO en el código.
* **Prioridad:** Baja (funciona adecuadamente).

---

### 2.4 Combos y promociones

* **Ubicación en el mockup / acta:**
  Pestaña "Promociones" en catálogo, generador `moPromoItems`, función `compText` y expansor `expandPromo` en `Admin.dc.html`. Acta 02: "promociones armadas con componentes: al venderlas se registra la promoción y se descuentan sus productos por separado".
* **Descripción técnica y operativa:**
  Las promociones vigentes (ejemplo: "2x1 LATTE COFFE", "DÚO PARA COMPARTIR") se despliegan en la categoría "Promociones".
* **Deficiencias críticas detectadas:**
  Al pulsar una promoción en `moPromoItems`, el código ejecuta inmediatamente:
  `cart.concat([ { name: pr.n, desc: pr.comps.map(compText).join(' + '), q: 1, note: '', unit: parseFloat(pr.precio), promo: true } ])`
  **No abre ningún modal de configuración ni personalización**.
  Si el combo "DÚO PARA COMPARTIR" incluye frappés y donas con múltiples sabores o tipos de leche, el mozo no tiene interfaz para elegirlos. El sistema agrega la línea con texto estático por defecto y, al llegar a cocina, el código recurre a la regla documentada: *"los sabores salen de lo que se anotó en el pedido y, si no hay, se toma el primero de la categoría"*.
* **Evaluación para cafetería:**
  Falla grave. Un combo de cafetería casi siempre requiere que el cliente elija el sabor de la dona (Oreo, Manjar, Nutella) y la bebida. Forzar a que el mozo digite manualmente notas de texto libre para suplir la falta de selector genera confusiones y reclamos en barra.
* **Clasificación de certeza:** CONFIRMADO en el código.
* **Prioridad:** Alta.

---

### 2.5 Notas para cocina

* **Ubicación en el mockup / acta:**
  Input `#cfg-note` ("Nota para cocina") en `isCfg`, renderizado en `moLines` (`l.note`) y compilación en `sendMo` (`notes = cc.filter((l) => l.note).map(...).join(' | ')`).
* **Descripción técnica y operativa:**
  Cada producto individual configurado permite ingresar una instrucción particular (ejemplo: "muy caliente", "sin hielo", "término medio"). Esta nota se almacena en el ítem del carrito y se muestra resaltada en color marrón cobrizo (`#B2500F`).
  Al momento de enviar el pedido (`sendMo`), todas las notas de los productos se concatenan con separadores (" | ") y se almacenan en el campo `order.note`, mostrándose en el ticket general de cocina y en las comandas de preparación.
* **Deficiencias detectadas:**
  No existe un campo para ingresar una **nota general de la comanda/mesa** (ejemplo: "Mesa de cumpleaños", "Traer todo junto al final", "Cliente apurado"). Solo existen notas atadas a productos específicos.
* **Evaluación para cafetería:**
  Importante para coordinar el ritmo de servicio entre bebidas rápidas y sándwiches horneados.
* **Clasificación de certeza:** CONFIRMADO en el código.
* **Prioridad:** Media.

---

### 2.6 Descuentos y cupones

* **Ubicación en el mockup / acta:**
  Lógica `moAuto`, `moCp`, inputs `moCpIn`, botón `moCpApply` dentro del panel de pedido en `isMoItems`.
* **Descripción técnica y operativa:**
  El pedido evalúa en tiempo real:
  1. Descuentos automáticos vigentes (`moAuto`): Aplica por producto, categoría o total de comanda si supera el consumo mínimo y coincide con el canal local.
  2. Cupones promocionales (`moCp`): El mozo puede tipear un cupón alfanumérico (ejemplo: cupones impresos en tickets previos o campañas). Valida vigencia, canal, tope de usos y reglas de acumulación (`s.rg.acumula`). Si el cupón exige cliente registrado (`c.cuenta`), bloquea su aplicación hasta asociar el DNI.
  3. Desglose visible: Se muestran las deducciones monetarias antes de liquidar el total neto (`moNet`).
* **Evaluación para cafetería:**
  Excelente integración. Protege los márgenes del negocio evitando acumulación indebida de promociones y respetando la política comercial de Caprichos.
* **Clasificación de certeza:** CONFIRMADO en el código.
* **Prioridad:** Baja (funciona adecuadamente).

---

### 2.7 Cuenta del cliente por DNI

* **Ubicación en el mockup / acta:**
  Sección "¿Quién pide?", chips `moWhoChips`, input `moDni`, función `moDniFind`, formulario `moShowReg` y registro `regDo`. Acta 02: fidelización y acumulación de puntos.
* **Descripción técnica y operativa:**
  Ofrece tres modalidades:
  - "Sin cuenta": Venta anónima sin solicitar datos; no acumula puntos.
  - "Cliente con cuenta (DNI)": Input numérico restringido a 8 dígitos. Al pulsar "Buscar", consulta el padrón de clientes (`s.clientes`).
    - Si existe: Vincula la cuenta, muestra el nombre del cliente y calcula en vivo los puntos que sumará el consumo al momento de pagarse en caja.
    - Si no existe: Despliega inmediatamente un formulario de "Registro rápido en el local" (Nombre obligatorio, cumpleaños opcional para promociones futuras, correo opcional y casilla de consentimiento de datos). Al confirmar, crea el cliente sin contraseña (el cliente la creará después al ingresar a la carta virtual web).
  - Seguridad: Nunca se le solicita contraseña al cliente en el salón; la identificación es exclusivamente por DNI.
* **Evaluación para cafetería:**
  Diseño sobresaliente para agilizar el servicio en mesa. Permite captar clientes para el club de fidelización sin demorar la comanda ni generar fricción por contraseñas.
* **Clasificación de certeza:** CONFIRMADO en el código y en el acta.
* **Prioridad:** Baja (funciona adecuadamente).

---

### 2.8 Pedido del personal

* **Ubicación en el mockup / acta:**
  Botón de cabecera "Pedido del personal" (`openMoStaff`), chip "Personal" en `moWhoChips`, chips de colaboradores `moStaffChips`. Iniciativas Acta 02: "Cobro a crédito del personal en Pedidos y caja... plazo configurable".
* **Descripción técnica y operativa:**
  Permite ingresar comandas para los colaboradores del turno (Marta, Luis, Rosa, Pedro, Elena, Jorge).
  Reglas implementadas:
  - Solo se permite para las modalidades "En el local" o "Para llevar"; bloquea explícitamente delivery (`mo.modal === 'delivery'`).
  - Se vincula directamente a la cuenta del trabajador sumando sus consumos.
  - Al llegar a caja, se puede cobrar al contado o liquidar bajo la modalidad "Cobrar a crédito del personal" con vencimiento a 15 días (descontable por planilla).
* **Evaluación para cafetería:**
  Resuelve de forma ordenada el consumo interno de café y alimentos del personal sin desvirtuar el control de inventario de cocina.
* **Clasificación de certeza:** CONFIRMADO en el código y en el acta.
* **Prioridad:** Baja (funciona adecuadamente).

---

### 2.9 Enviar a cocina

* **Ubicación en el mockup / acta:**
  Botón `sendMo` ("Enviar a cocina"), diálogo de confirmación `ask`, inserción en `orders` y ejecución de `acceptEffects` en `Admin.dc.html`. Documento `flujo-de-pedidos.md` (Sección 2): "El pedido va directo a las pantallas de cocina; se descuentan los productos y se imprimen la comanda y las etiquetas".
* **Descripción técnica y operativa:**
  Al pulsar "Enviar a cocina":
  1. Solicita confirmación expresa: *"¿Enviar el pedido de Mesa X a cocina? Va directo a las pantallas de cocina, sin pasar por caja. El cobro se hace al final, en caja."*
  2. Genera identificador único correlativo (`CP-0109`, etc.).
  3. Inserta el pedido con estado inicial `'cola'` (En cola de cocina), canal `'Mozo'`, `paid: false`.
  4. Ejecuta de inmediato `acceptEffects`: descuenta existencias de insumos según recetas, emite avisos de stock si cruza mínimos y manda a imprimir comanda de cocina y etiquetas de bebidas/áreas.
  5. Cierra el modal y redirige la vista a la pestaña "En curso" (`tab: 'curso'`).
* **Evaluación para cafetería:**
  Cumple al 100% el nuevo flujo acordado tras la reunión del 18/10/2026, eliminando el cuello de botella donde los mozos debían esperar a que caja aprobara el ticket para empezar a preparar el café.
* **Clasificación de certeza:** CONFIRMADO en el código y en el acta.
* **Prioridad:** Baja (funciona adecuadamente).

---

### 2.10 Agregar a un pedido ya enviado (adición de comanda)

* **Ubicación en el mockup / acta:**
  Inspección de `Admin.dc.html` (handlers de mesa en `isMoPlan`, vista `isMoItems` y detalle de pedidos en `Pedidos y caja`).
* **Deficiencia crítica detectada:**
  **NO EXISTE la función de agregar productos a una mesa con pedido abierto**.
  Si una mesa ya tiene comanda abierta (estado `'cola'`, `'prep'` o `'listo'`), al tocar la mesa en el plano el código ejecuta:
  `if (used) { this.setState({ mo: Object.assign({}, mo, { msg: e.label + ' está ocupada (pedido ' + busy[code] + '). Se libera al cobrar o a mano.' }) }); return; }`
  El sistema se detiene y no permite avanzar.
  Tampoco existe en la pantalla de Pedidos y caja ningún botón como "Agregar productos", "Adicionar comanda" o "Nueva ronda".
* **Evaluación para cafetería:**
  **Falla de severidad máxima**. En una cafetería, la sobremesa es el núcleo del negocio: clientes que inicialmente pidieron café luego piden postres, agua mineral o un segundo café. Si el mozo no puede ingresar ítems a una mesa abierta, el personal se ve obligado a inventar mesas ficticias o anotar en papelitos, colapsando el control de cocina y caja.
* **Clasificación de certeza:** CONFIRMADO en el código (ausencia total de la función).
* **Prioridad:** Alta.

---

### 2.11 Cambiar de mesa (transferencia de comanda)

* **Ubicación en el mockup / acta:**
  Botón "Cambiar mesa" (`moChangeMesa`) en cabecera de `isMoItems`. Referencia `modulos-usuarios-notificaciones.md` ("División de cuentas y transferencia de mesas").
* **Descripción técnica y deficiencia:**
  El botón "Cambiar mesa" que figura en el mockup únicamente opera **durante el borrador del pedido**, antes de enviarlo a cocina (simplemente regresa al plano `setMo({ step: 'plan' })` para corregir una mesa mal pulsada).
  Una vez que la orden fue enviada a cocina (`sendMo`), **NO EXISTE ningún mecanismo para transferir la comanda de una mesa a otra**.
* **Evaluación para cafetería:**
  Situación sumamente común: clientes sentados en una mesa pequeña o cerca de la puerta piden cambiarse a una mesa más amplia o a la terraza cuando esta se desocupa. Sin transferencia de mesa, la comanda queda asociada a la mesa física equivocada y el cajero cobrará la cuenta a quien se siente después.
* **Clasificación de certeza:** CONFIRMADO en el código.
* **Prioridad:** Alta.

---

### 2.12 Anular un ítem de un pedido enviado

* **Ubicación en el mockup / acta:**
  Botón `remove` y `minus` en `moLines` (solo borrador). Referencia `informes.md` ("Ventas Anuladas... Categoría anulación: Error de digitación, Queja del cliente, Mesa cancelada... platos cancelados").
* **Descripción técnica y deficiencia:**
  El mozo puede eliminar o restar ítems de su bandeja mientras está armando el pedido en `mo.cart`.
  Sin embargo, una vez enviado el pedido a cocina:
  1. No existe botón para cancelar o anular un ítem específico (ejemplo: cliente se arrepiente del cheesecake antes de que lo sirvan o se digitó por error 2 cafés en vez de 1).
  2. Ni siquiera existe botón para rechazar o anular la comanda completa en curso: el botón `rejectSel` solo está disponible para pedidos en estado `'nuevo'`, pero los pedidos de mesa pasan de inmediato a `'cola'`.
* **Evaluación para cafetería:**
  Requiere auditoría estricta. Si un mozo digita un producto por error o la máquina de espresso quema la leche y el cliente cancela el plato, debe existir un flujo de anulación con motivo justificado para reintegrar insumos a stock o registrar la merma correspondiente.
* **Clasificación de certeza:** CONFIRMADO en el código.
* **Prioridad:** Alta.

---

### 2.13 Ver el estado de sus mesas (En cola, En preparación, Listo para llevar)

* **Ubicación en el mockup / acta:**
  Pantalla Escritorio del mozo (`s.role === 'mozo'`), tarjetas `dKpis`, lista `dListTitle = 'Mis mesas'` y módulo Pedidos y caja (`s.view === 'caja'`).
* **Descripción técnica y operativa:**
  En el Escritorio, el mozo visualiza:
  - KPI "Mesas con pedido abierto" (cuenta órdenes locales activas).
  - KPI "Listos para llevar a la mesa" (cuenta órdenes con `status === 'listo'`).
  - Lista "Mis mesas" con accesos directos al detalle del pedido.
  En Pedidos y caja, la pestaña "En curso" lista los pedidos con etiquetas de color:
  - "En cola" (`status === 'cola'`, beige `#E3D6C6`).
  - "En preparación" (`status === 'prep'`, amarillo `#D99E39`).
  - "Listo para llevar" / "Listo para entregar" (`status === 'listo'`, verde `#2F9E57`).
* **Deficiencias detectadas:**
  1. **No hay filtrado por mozo autor:** El sistema muestra "Mis mesas", pero en realidad lista todas las mesas del local independientemente de qué usuario creó la comanda.
  2. **Dato quemado:** El KPI "Reservas de hoy" en el escritorio del mozo tiene el valor fijo en texto `'4'` (`v: '4'`), sin importar cuántas reservas reales existan en el sistema.
  3. **Incongruencia en cocina:** En las comandas de cocina (`tickets`), el código hardcodea `'mozo Luis'` cuando el canal es Mozo (`canal: o.canal + (o.canal === 'Mozo' ? ' · mozo Luis' : '')`), a pesar de que en la plantilla de personal Luis es de cocina y la moza registrada es Rosa.
* **Evaluación para cafetería:**
  Fundamental para que el mozo retire las bebidas a tiempo de la barra antes de que el café se enfríe o la espuma se baje.
* **Clasificación de certeza:** CONFIRMADO en el código.
* **Prioridad:** Media.

---

### 2.14 Pedir la cuenta o precuenta

* **Ubicación en el mockup / acta:**
  Botón "Sacar precuenta (el cajero cobra)" (`openPre`), modal `isPre` en `Admin.dc.html`. Acta 02 (Kevin Rosales): "al mozo no le permite cobrar porque el único responsable de cobrar es caja. Entonces, el mozo lo que puede hacer es sacar precuentas y con eso cobrar al cliente en mesa... el mozo llega a caja, paga y recién el cajero recibe el dinero y emite el comprobante".
* **Descripción técnica y operativa:**
  1. El mozo debe ingresar a Pedidos y caja, seleccionar la orden de la mesa, conmutar a la subpestaña "Cobro" (`ctCobro`) y deslizar la pantalla hacia abajo.
  2. Allí encuentra el botón "Sacar precuenta (el cajero cobra)", que abre una ventana con aspecto de tique térmico monoespaciado (`font-family: 'Courier New'`).
  3. Muestra: Mesa, desglose de cantidades y productos con opciones, Total en soles, un recuadro de código QR y la leyenda: *"Paga con Yape o Plin al 9XX XXX XXX o entrega el efectivo al mozo; el cajero cobra y emite el comprobante. La precuenta no es un comprobante de pago."*
  4. Restricción de cobro: El mozo tiene `canManage: false`, por lo que **no se le muestran los botones "Registrar cobro" ni "Cobrar a crédito del personal"**. La regla de Kevin se cumple con rigor.
* **Deficiencias detectadas:**
  - El modal de precuenta **no tiene botón de imprimir**. Solo tiene un botón de "Cerrar" (`closePre`). En la operación real, el mozo no le entrega su teléfono al comensal: debe pulsar un botón que mande el papelito a la ticketera de servicio para llevarlo en la cuenta a la mesa.
  - La ubicación del botón está oculta: requiere 4 toques y navegación profunda en la pestaña Cobro de Pedidos y caja, en lugar de estar accesible tocando la mesa en el plano.
* **Evaluación para cafetería:**
  Vital para el control de fugas de efectivo y cumplimiento tributario.
* **Clasificación de certeza:** CONFIRMADO en el código y en el acta.
* **Prioridad:** Alta (por la falta de impresión física y acceso rápido).

---

### 2.15 Reservas de mesa

* **Ubicación en el mockup / acta:**
  Flujo `isMoResv` en modal de pedido, marcación en plano `isMoPlan` (`rv`), vista `isReservasView` y alertas de 15 minutos en notificaciones. Acta 02: "margen de tolerancia de 15 minutos en reservas... señalización gráfica R en el plano... alerta 15 minutos antes para poner la base informativa".
* **Descripción técnica:**
  - Se puede registrar una reserva indicando nombre, número de comensales (2, 4, 6 u 8) y horario hábil.
  - Al seleccionar la mesa libre en el plano, queda registrada con la letra "R", hora programada y color amarillo/naranja.
  - En la vista `Reservas`, el mozo puede ver solicitudes pendientes llegadas desde el chatbot de WhatsApp y asignarles mesa.
* **Deficiencia crítica detectada:**
  **BLOQUEO DE ATENCIÓN DE CLIENTES RESERVADOS**:
  Cuando el cliente que reservó (ejemplo: Camila Ríos a las 19:30) se presenta puntualmente a la cafetería, el mozo entra a "Nuevo pedido" -> "En el local" y toca la mesa reservada.
  El código ejecuta:
  `if (rv) { this.setState({ mo: Object.assign({}, mo, { msg: e.label + ' está reservada para ' + rv.nombre + ' a las ' + rv.hora + '. Llega con 15 minutos de tolerancia.' }) }); return; }`
  **El sistema rechaza la acción con un mensaje de error y no permite abrir la comanda**.
  No existe botón de "Comenzar atención", "Activar mesa reservada" o "Sentar cliente". La mesa reservada es intocable en el plano.
* **Evaluación para cafetería:**
  Falla funcional grave. Inutiliza la función de reservas, ya que al llegar el cliente que reservó, el mozo no tiene forma informática de tomarle la orden en su mesa asignada.
* **Clasificación de certeza:** CONFIRMADO en el código.
* **Prioridad:** Alta.

---

## 3. COMPARACIÓN CON RESTAURANT.PE Y FLUJO DE PEDIDOS

| Funcionalidad / Escenario | Caprichos Mockup (`Admin.dc.html`) | Restaurant.pe (`referencia/`) | Documento `flujo-de-pedidos.md` |
| :--- | :--- | :--- | :--- |
| **Envío a cocina** | Directo a KDS sin pasar por caja (`sendMo`). Estado inicial `'cola'`. | Comanda va a cocina pero según perfil podía exigir aprobación de comanda. | Especificado: directo a cocina, sin validación en caja. |
| **Toma de pedidos móvil** | Modal integrado en web responsive (`isMo`). | Módulo independiente "Pedidos Multimozo" (`#!/ventas/multimozo`) y app móvil "Quipu". | Tablet del mozo con catálogo idéntico a la carta virtual. |
| **Permisos de cobro** | Bloqueado (`canManage: false`). Mozo no puede registrar pagos. | Mozo no cobra salón a menos que tenga tag explícito `caja.cobrar`. | Prohibido terminantemente por Kevin Rosales. Solo caja cobra. |
| **Precuenta** | Vista monoespaciada en pantalla con QR. Sin botón de imprimir. | Emisión de precuenta térmica hacia impresora de comandas. | Válida para control de efectivo antes del pago en caja. |
| **Adición de comanda** | NO EXISTE. Mesa ocupada rechaza apertura de nuevos ítems. | Soporte nativo para agregar rondas continuas a comanda abierta. | No documentado en detalle; asumido implícitamente en salón. |
| **Cambio de mesa** | Solo en borrador. Imposible tras enviar a cocina. | Función expresa: "Transferencia de mesas" (`ventas.hacerpedidos.salones`). | Requisito operativo estándar no contemplado en v96. |
| **Anulación de ítems** | Imposible en comandas enviadas. Sin registro de motivo. | Módulo "Platos cancelados" con selección de motivo y autorización. | Requiere registro para no desfasar inventario de insumos. |
| **Reservas** | Integradas en plano con "R". Bloquea apertura de mesa reservada. | Módulo formal de Reservas con asignación de estado (Atendida/Cancelada). | Tolerancia de 15 min y alerta previa en administrativo. |

---

## 4. FALLAS DE USABILIDAD EN CELULAR (DISPOSITIVOS MÓVILES)

Al auditar la interfaz configurada para dispositivos móviles (`isMobile = s.device === 'mobile'` o ancho menor a 700px), se identificaron serios problemas ergonómicos para el trabajo de pie de un mozo:

```
+-------------------------------------------------------------------------+
| PANTALLA MÓVIL: PROBLEMA DE APILAMIENTO Y TAMAÑOS CRÍTICOS              |
+-------------------------------------------------------------------------+
| [ Plano de mesas ]: Celdas de 17px (touch target 17x17px o 34x34px)     |
|                     Texto de mesa: 8px (ilegible sin zoom)             |
|                                                                         |
| [ Catálogo en columna 1 ]:                                              |
|   - Barra de búsqueda                                                   |
|   - Carrusel horizontal de categorías                                   |
|   - Rejilla de productos (2 columnas) que se extiende por más de 1200px |
|                                                                         |
|   vvvvvvv (SCROLL VERTICAL OBLIGATORIO DE VARIAS PANTALLAS) vvvvvvv     |
|                                                                         |
| [ Carrito en columna 2 (desplazado al fondo) ]:                         |
|   - Lista de productos agregados                                        |
|   - Selector de cuenta / DNI                                            |
|   - Aplicación de cupones                                               |
|   - Botón final: [ ENVIAR A COCINA ]                                    |
+-------------------------------------------------------------------------+
```

### 4.1 Touch Targets diminutos en el plano de mesas (17 píxeles)
* **Ubicación en el código:**
  `const cell = isMobile ? 17 : 40;` y cálculo de tamaño en `elCss`.
* **Falla:**
  En pantalla móvil, la celda de la cuadrícula se reduce de 40px a 17px. Un elemento de mesa de 1x1 celdas mide 17x17 píxeles; una mesa estándar de 2x2 celdas mide 34x34 píxeles.
  Los estándares internacionales de ergonomía táctil (Google Material Design y Apple Human Interface Guidelines) exigen un área táctil mínima de **48x48 píxeles** (o 44x44 puntos).
* **Impacto en salón:**
  El mozo, caminando entre mesas o interactuando rápidamente con una sola mano, cometerá constantes toques erróneos seleccionando la mesa vecina o la pared divisoria.
* **Prioridad:** Alta.

### 4.2 Tipografía microscópica (8 píxeles)
* **Ubicación en el código:**
  `font-size:' + (cell < 30 ? 8 : 12) + 'px;`
* **Falla:**
  Cuando `cell` vale 17px, el tamaño de fuente dentro de la mesa se fuerza a **8 píxeles**. A esta escala, el número de la mesa y la letra "R" de reserva resultan casi ilegibles bajo iluminación tenue de cafetería.
  Además, la lógica suprime intencionalmente el texto descriptivo de la mesa en móviles (`cell < 30`), impidiendo ver la cantidad de comensales que caben en la mesa (`e.seats + ' pers.'`).
* **Prioridad:** Alta.

### 4.3 Desplazamiento vertical interminable (Scroll) para acceder al carrito
* **Ubicación en el código:**
  Contenedor flex `display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start` en `isMoItems`.
* **Falla:**
  En pantallas angostas, el contenedor colapsa en una sola columna vertical. Primero se renderiza la columna del catálogo con más de 20 tarjetas de productos en 2 columnas; **el panel del carrito, la identificación por DNI y el botón "Enviar a cocina" quedan relegados al final absoluto de la página**.
* **Impacto en salón:**
  Cada vez que el mozo agrega productos, debe realizar un scroll exhaustivo hacia el fondo para verificar el pedido o enviar la orden. Carece de una barra inferior flotante ("Sticky Bar") que resuma: *"3 productos · s/ 42.50 · [Ver Carrito / Enviar]"*.
* **Prioridad:** Alta.

### 4.4 Modales flotantes que no aprovechan el viewport nativo
* **Ubicación en el código:**
  Estilo de modal: `width:min(900px,calc(100% - 24px));max-height:calc(100% - 24px);overflow-y:auto;border-radius:20px;padding:20px`.
* **Falla:**
  En lugar de comportarse como una vista de pantalla completa ("Full Screen Sheet") o página móvil dedicada, el pedido se abre como una tarjeta flotante centrada con márgenes de 12px a cada lado, perdiendo valioso espacio horizontal para los nombres de los productos y generando conflicto de doble barra de desplazamiento (el scroll del fondo del sistema y el scroll del interior del modal).
* **Prioridad:** Media.

---

## 5. ANÁLISIS DE CASOS RAROS Y SITUACIONES LÍMITE

### 5.1 Mesa ya ocupada
* **Comportamiento en el código:**
  Si el mozo toca una mesa ocupada, el sistema emite el mensaje: `"Mesa X está ocupada (pedido CP-XXXX). Se libera al cobrar o a mano."` y aborta el flujo.
* **Problema operativo:**
  No ofrece ninguna acción contextual constructiva. Si el mozo deseaba ver qué consumen para ofrecer la precuenta, no puede. Si deseaba sumar una botella de agua, no puede.
  Para sobreescribir la mesa debe cambiar manualmente al modo "Liberar o marcar mesa", confirmar la liberación forzada mediante cuadro de diálogo, volver a cambiar de modo y abrir la mesa desde cero.
* **Prioridad:** Alta.

### 5.2 Pedido duplicado por concurrencia simultánea
* **Escenario expuesto por Kevin (Acta 02, líneas 762-764):**
  Un cliente pide en caja una bebida en Mesa 02; simultáneamente el mozo en sala toma comanda en Mesa 02 en su tablet.
* **Comportamiento en el código:**
  La ocupación de mesa (`busy`) se evalúa únicamente al momento de **tocar la mesa en el plano**.
  Mientras el mozo permanece 2 o 3 minutos configurando opciones de café (leche, endulzante, donas) dentro de `mo`, la mesa sigue figurando libre en la base general. Si caja abre la Mesa 02 y la envía, y segundos después el mozo presiona "Enviar a cocina", la función `sendMo` **NO valida nuevamente si la mesa fue ocupada en ese intervalo**.
  El código concatena ciegamente la orden:
  `orders: this.state.orders.concat([ ... base ... ])`
  Resultado: Quedan creados dos pedidos distintos para la misma mesa (`CP-0109` y `CP-0110`), duplicando la atención en cocina y generando que al cobrar en caja solo se liquide uno de ellos, tal como ocurría en restaurant.pe.
* **Prioridad:** Alta.

### 5.3 Producto agotado durante el armado del pedido
* **Escenario:**
  El mozo abre la mesa cuando aún figuraban 2 porciones de Torta de Chocolate. Mientras el cliente decide, cocina registra la merma o venta de la última porción marcándola como agotada en `avail`.
* **Comportamiento en el código:**
  - Si el mozo ya había añadido el ítem a su carrito (`cart`), la función de envío `sendMo` **no valida el stock ni la disponibilidad al presionar "Enviar a cocina"**. La orden entra a cocina conteniendo un producto inexistente.
  - Si el mozo busca el producto en el catálogo después de agotado, este desaparece silenciosamente de la cuadrícula (`s.avail[p.name] !== false`). No muestra un estado visual deshabilitado ("Agotado"), lo que desorienta al mozo haciéndole dudar si escribió mal el nombre en el buscador.
* **Prioridad:** Media.

### 5.4 Cliente que se retira sin pagar ("Perro muerto" / Fuga)
* **Escenario:**
  Una mesa consume en sala y los clientes se retiran furtivamente sin acudir a caja ni abonar la precuenta.
* **Comportamiento en el código:**
  El sistema queda en un callejón sin salida:
  1. La orden permanece en estado `'cola'`, `'prep'` o `'listo'` sin cobrar (`paid: false`).
  2. Como ya no está en estado `'nuevo'`, no se le puede aplicar `rejectSel` ("Rechazar").
  3. No existe ningún botón de "Anular por fuga", "Declarar incobrable" o "Mesa abandonada".
  4. La mesa física queda bloqueada como ocupada indefinidamente. Si el mozo la libera a mano (`mesaOv`), el pedido sigue existiendo como "pedido abierto" en la base.
  5. Al finalizar la jornada, el cajero intenta realizar el cierre de turno (`isCierre`), pero el sistema bloquea el cuadre:
     `No se puede cerrar la caja con pedidos abiertos.`
  6. Para poder cerrar caja, el cajero se ve obligado a simular un cobro falso en efectivo o tarjeta, distorsionando el arqueo de dinero físico y la tributación fiscal.
* **Prioridad:** Alta.

---

## 6. MATRIZ CONSOLIDADA DE HALLAZGOS

| ID | Hallazgo en Pantalla / Código | Impacto en Operación de Cafetería | Certeza | Prioridad |
| :--- | :--- | :--- | :--- | :--- |
| **H-01** | **Imposibilidad de adición de comanda** en mesa ocupada (`isMoPlan` bloquea si `used`). | Impide pedir postres o bebidas adicionales durante la sobremesa. | CONFIRMADO en el código | **Alta** |
| **H-02** | **Bloqueo permanente de mesas reservadas** (`if (rv) return`). | No permite abrir pedido cuando el cliente de la reserva llega al local. | CONFIRMADO en el código | **Alta** |
| **H-03** | **Ausencia de botón Imprimir en precuenta** (`isPre` solo tiene botón Cerrar). | El mozo no puede llevar el comprobante en papel térmico a la mesa. | CONFIRMADO en el código | **Alta** |
| **H-04** | **Celdas táctiles de 17px y textos de 8px** en el plano móvil (`isMobile`). | Errores constantes de pulsación y dificultad de lectura en sala. | CONFIRMADO en el código | **Alta** |
| **H-05** | **Falta de confirmación de concurrencia en `sendMo`** ante pedidos simultáneos. | Reincidencia en la falla de pedidos duplicados criticada por Kevin. | CONFIRMADO en el código | **Alta** |
| **H-06** | **Sin mecanismo de anulación o cancelación** para pedidos en curso o fuga de comensales. | Bloquea el cierre final de caja si un cliente se va sin pagar. | CONFIRMADO en el código | **Alta** |
| **H-07** | **Promociones/Combos sin configurador de sabores** (`moPromoItems` agrega texto fijo). | Despachos equivocados de sabores de donas o frappés en cocina. | CONFIRMADO en el código | **Alta** |
| **H-08** | **Imposibilidad de transferir comanda** a otra mesa tras ser enviada. | Confusiones en mesa y cobros erróneos al reubicar comensales. | CONFIRMADO en el código | **Alta** |
| **H-09** | **Scroll excesivo en celular**: Carrito y envío quedan debajo de todo el catálogo. | Lentitud en la toma de pedidos y fatiga ergonómica para el mozo. | CONFIRMADO en el código | **Alta** |
| **H-10** | **Buscador dependiente de categoría activa** y deshabilitado en Promociones. | Pérdida de tiempo del mozo al buscar productos de categorías cruzadas. | CONFIRMADO en el código | **Media** |
| **H-11** | **KPI "Reservas de hoy" hardcodeado en 4** y comanda hardcodea "mozo Luis". | Inconsistencias de auditoría interna y confusión en cocina. | CONFIRMADO en el código | **Media** |
| **H-12** | **Ruta de acceso a precuenta excesivamente oculta** (dentro de subpestaña Cobro). | Pérdida de agilidad al momento de solicitar la cuenta en el salón. | CONFIRMADO en el código | **Media** |
| **H-13** | **Falta de campo para nota general de mesa** (solo admite notas por producto). | Dificultad para comunicar instrucciones globales de servicio a cocina. | CONFIRMADO en el código | **Baja** |

---

## 7. CONCLUSIONES Y PROPUESTAS DE MEJORA

1. **Apertura de menú contextual al tocar una mesa en el plano:**
   En lugar de un comportamiento binario (abrir si está libre / rechazar si está ocupada o reservada), tocar una mesa en el plano debe desplegar un menú contextual adaptado al estado:
   - Si está libre: *"Abrir nuevo pedido"* o *"Reservar"*.
   - Si está ocupada: *"Adicionar productos"*, *"Ver comanda actual"*, *"Cambiar de mesa"* o *"Emitir precuenta"*.
   - Si está reservada: *"Iniciar atención de reserva (sentar comensales)"* o *"Liberar por inasistencia (tolerancia)"*.

2. **Rediseño móvil con barra inferior persistente (Sticky Bottom Sheet):**
   Implementar en pantallas móviles un pie de página flotante siempre visible mientras se navega el catálogo, con indicador de cantidad de ítems, monto acumulado y botón directo para abrir el resumen o enviar a cocina.

3. **Ampliación de cuadrícula táctil mínima:**
   Fijar un tamaño mínimo de botón de mesa de 48x48 píxeles en dispositivos móviles, permitiendo desplazamiento panorámico fluido en el plano en lugar de encoger las mesas a 17 píxeles.

4. **Incorporación de impresión física y acceso directo a precuenta:**
   Añadir el comando de impresión directa por red/Bluetooth a la ticketera de salón y habilitar la opción de precuenta desde el plano de mesas sin forzar al mozo a navegar dentro del módulo de cobros de caja.

5. **Validación atómica de concurrencia al despachar:**
   En el instante en que se presione "Enviar a cocina", revalidar si la mesa sigue disponible; si fue tomada durante la digitación, advertir al mozo y ofrecer asignarle otra mesa libre sin perder los productos cargados en el carrito.

INFORME LISTO
