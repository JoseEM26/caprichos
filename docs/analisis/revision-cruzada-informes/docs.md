---
id: ANA-CAP-054
tipo: analisis
titulo: "Informe de Auditoria de Documentacion del Proyecto Caprichos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, revision-cruzada-informes]
---

# Informe de Auditoria de Documentacion del Proyecto Caprichos

## 1. Resumen ejecutivo

Este informe presenta la auditoria exhaustiva de la documentacion del proyecto Caprichos, contrastando el documento principal de requerimientos de negocio (`docs/BRD.md`) con las especificaciones tecnicas y de diseno (`docs/registro-mockup.md`, `docs/modulos-y-roles.md`, `docs/flujo-de-pedidos.md`, `docs/combos-y-opciones.md`, `docs/cierre-de-caja.md`, `docs/impresion-tickets.md`, `docs/pantalla-cocina.md`, `docs/configuracion-centralizada.md`), las actas de descubrimiento (`docs/acta-01-descubrimiento.md`, `docs/acta-02-descubrimiento.md`, `docs/iniciativas-acta-02.md`), los informes de revision por rol (`docs/*-informes/README.md`) y el codigo fuente vivo del mockup (`fuente/Admin.dc.html`, `fuente/Main.dc.html`, `fuente/Chatbot.dc.html`).

Se identificaron 25 hallazgos criticos agrupados en cinco categorias principales:
1. Numeracion de requerimientos (NEC) y reglas de negocio (RN) repetida, con huecos y desordenada en `docs/BRD.md`.
2. Discordancias y contradicciones directas entre documentos respecto a permisos de roles, flujos de operacion, nombres de areas, reglas de envio y eliminacion de registros.
3. Desalineacion entre el alcance planificado del BRD y la realidad del mockup (funcionalidades marcadas como pendientes que ya fueron construidas, y requisitos marcados como fase actual que solo son simulaciones).
4. Versiones, fechas y referencias de ruta desactualizadas o rotas.
5. Decisiones del cliente expresadas en las actas que fueron omitidas en el BRD o modificadas unilateralmente por el equipo de desarrollo.

---

## 2. Inventario detallado de hallazgos

### Hallazgo D-01
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md`, tabla de Reglas de negocio:
    - Texto: `| RN-CAP-081 | El mensaje de WhatsApp con el que la persona del equipo contacta al cliente incluye el resumen del pedido (productos y opciones, nota, entrega, total y pago preferido), no solo el código y el total. |`
    - Texto: `| RN-CAP-082 | Los montos de un pago mixto deben sumar el total del pedido. El vuelto se calcula sobre la parte pagada en efectivo. |`
    - Texto: `| RN-CAP-083 | El documento (DNI o RUC) de un cliente no se cambia al editar; el cajero no edita puntos, pedidos ni crédito. |`
    - Texto: `| RN-CAP-084 | El estado de un pedido se calcula con el de sus áreas: pasa a preparación cuando alguna empieza y a listo cuando todas terminan. Despejar un pedido solo lo quita de la pantalla de cocina; no cambia su estado. |`
    - Texto: `| RN-CAP-085 | Agotado por hoy vence al cambiar la fecha; agotado desde Productos dura hasta que se vuelva a ofrecer. Toda activación pide confirmación Sí/No. |`
    - Texto: `| RN-CAP-086 | Con Alta demanda activa el tiempo de entrega mostrado es 13 minutos más lo elegido (5, 10, 15 o 20). |`
  - Lado 2: `docs/BRD.md`, tabla de Reglas de negocio (bloques posteriores):
    - Texto: `| RN-CAP-084 | Un abono nunca puede pasar del saldo; al llegar a cero el crédito queda pagado. Los abonos se conservan. |`
    - Texto: `| RN-CAP-085 | Al vender un combo se descuenta cada producto elegido por separado y se registra el combo vendido; el nombre de un combo no puede repetir el de un producto. |`
    - Texto: `| RN-CAP-086 | Las opciones de producto no se eliminan: se desactivan. Un cambio en un grupo de opciones vale para todos los productos que lo usan. |`
    - Texto: `| RN-CAP-081 | Al registrar una compra, la cantidad se convierte a la unidad del almacén con la equivalencia del insumo; los insumos perecibles exigen fecha de vencimiento. Una compra registrada no se borra: se anula o se marca pagada. |`
    - Texto: `| RN-CAP-082 | Un proveedor desactivado conserva su historial y no se puede elegir en compras nuevas. El proveedor A, B y C de un insumo no puede repetirse. |`
    - Texto: `| RN-CAP-083 | La orden de compra por WhatsApp se arma desde el insumo, con su proveedor A (y su número del directorio). |`
- Por que importa: Existen tres reglas distintas identificadas como RN-CAP-081, tres como RN-CAP-082, tres como RN-CAP-083, dos como RN-CAP-084, dos como RN-CAP-085 y dos como RN-CAP-086. Esto destruye la trazabilidad entre el BRD, los casos de prueba, los criterios de aceptacion y el codigo.
- Prioridad: Alta
- Propuesta de arreglo: Renumerar secuencialmente las reglas duplicadas a partir de RN-CAP-096 hasta RN-CAP-107 para que cada regla posea un identificador unico e irrepetible.
- Evidencia:
  - CONFIRMADO: Verificado con grep en `docs/BRD.md` que las cadenas citadas coexisten en la misma tabla de reglas.
  - SUPOSICION: La colision se origino al fusionar simultaneamente notas de tres fuentes distintas (cajero, cocina y compras) sin verificar la secuencia del correlativo.

---

### Hallazgo D-02
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md`, tabla de Reglas de negocio:
    - Texto: `| RN-CAP-027 | El pedido del mozo usa el mismo catálogo y las mismas reglas de opciones que la carta (obligatorio, mínimo, máximo y precio extra), y puede llevar varios productos. |`
    - Texto inmediatamente siguiente: `| RN-CAP-026 | Las listas (categorías, tipos, origen) no se eliminan: se crean, se editan y se desactivan; el movimiento de almacén ofrece por defecto entrada y salida. |`
  - Lado 2: `docs/BRD.md`, tabla de Reglas de negocio:
    - Texto: `| RN-CAP-074 |`
    - Texto inmediatamente siguiente: `| RN-CAP-081 |`
    - Texto posterior (tras RN-CAP-095): `| RN-CAP-075 | Para pagos por Yape, Plin o transferencia, quien confirma debe subir el comprobante al pedido... |` hasta `| RN-CAP-080 |`
- Por que importa: La inversion de RN-CAP-027 antes de RN-CAP-026 y el desplazamiento del bloque RN-CAP-075 al RN-CAP-080 al final de la tabla (despues de RN-CAP-095) genera la falsa impresion de huecos o reglas faltantes en lecturas parciales o auditorias formales.
- Prioridad: Media
- Propuesta de arreglo: Reordenar las filas de la tabla de reglas de negocio en estricto orden numerico ascendente del 001 al correlativo final.
- Evidencia:
  - CONFIRMADO: Verificado en `docs/BRD.md` que RN-CAP-027 antecede a RN-CAP-026 y que RN-CAP-075 a 080 estan ubicadas tras RN-CAP-095.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-03
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md`, tabla de Necesidades:
    - Texto: `| NEC-CAP-009 | Que el repartidor reciba su pedido con la dirección de entrega... |`
    - Filas siguientes: `| NEC-CAP-014 |`, `| NEC-CAP-015 |`, `| NEC-CAP-016 |`, `| NEC-CAP-013 |`, `| NEC-CAP-010 |`, `| NEC-CAP-011 |`, `| NEC-CAP-012 |`, y luego `| NEC-CAP-017 |`
  - Lado 2: `docs/BRD.md`, tabla de Necesidades:
    - Texto: `| NEC-CAP-066 | Los combos los arma el propio usuario... |`
    - Fila siguiente: `| NEC-CAP-068 | Las ofertas (combo, llevas más pagas menos, descuento)... |`
    - Fila final de la tabla (tras NEC-CAP-084): `| NEC-CAP-067 | Los tamaños, el tipo de leche, el endulzante, los shots, los extras y demás opciones... |`
- Por que importa: La secuencia 010 a 016 esta completamente desordenada, y NEC-CAP-067 quedo traspapelada al final de la tabla (tras NEC-CAP-084), dando la impresion de un hueco entre 066 y 068.
- Prioridad: Media
- Propuesta de arreglo: Reordenar numericamente todas las filas de la tabla de necesidades para mantener la continuidad 001-084.
- Evidencia:
  - CONFIRMADO: Verificado en `docs/BRD.md` mediante extraccion de encabezados de fila `| NEC-CAP-`.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-04
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/modulos-y-roles.md`, seccion Cajero y tabla de acceso:
    - Texto: `- **Ve:** Escritorio, Pedidos y caja, Reservas, Clientes, Créditos, Ofertas y descuentos, Notificaciones.`
    - Texto: `| Ofertas y descuentos | [check] | [check] | | | | | |` (en el documento original marcado en columnas Admin y Cajero)
  - Lado 2: `docs/BRD.md`, `docs/produccion-admin-bot-informes/README.md` y `fuente/Admin.dc.html`:
    - Texto `docs/BRD.md`: `| RN-CAP-094 | Las condiciones del crédito del personal y las ofertas las edita solo el administrador; anular un pedido por otro rol exige el PIN del administrador. |`
    - Texto `docs/produccion-admin-bot-informes/README.md`: `cajero sin Ofertas ni condiciones del crédito`
    - Texto `fuente/Admin.dc.html`: `cajero: { n: 'Cajero', user: 'caja01', person: 'Cajera de ejemplo', ini: 'CE', color: '#D99E39', views: [ 'escritorio', 'caja', 'cierre', 'reservas', 'clientes', 'creditos', 'mensajes', 'notificaciones' ], home: 'escritorio', manage: true },`
- Por que importa: Si el cajero tuviese acceso al modulo de Ofertas podria alterar promociones, combos y precios con descuento; el BRD y el codigo fuente le deniegan explicitamente el acceso a Ofertas, pero el documento de modulos y roles le otorga visibilidad y edicion.
- Prioridad: Alta
- Propuesta de arreglo: Quitar Ofertas y descuentos de la lista de vistas y de la tabla de accesos del rol Cajero en `docs/modulos-y-roles.md`.
- Evidencia:
  - CONFIRMADO: En `fuente/Admin.dc.html` la constante `ROLES.cajero.views` no contiene `ofertas`, y `docs/BRD.md` RN-CAP-094 restringe ofertas solo al administrador.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-05
- Tipo: hueco
- Donde esta cada lado:
  - Lado 1: `docs/modulos-y-roles.md`, seccion 2 (Módulos):
    - Texto: `| **Caja y cierres** | Abrir la caja en cero, ver las ventas del turno por medio de pago, registrar movimientos y cerrar el día con arqueo. | Administrador y cajero. Turno actual: ventas por medio, efectivo esperado, movimientos. Cierre: verificar movimientos, contar billetes y monedas, anotar lo que se ve en billeteras y tarjetas, diferencia y observaciones. Historial de cierres con filtros, ticket de 80 mm y PDF; no se edita ni se borra. |`
  - Lado 2: `docs/modulos-y-roles.md`, seccion 3 (Roles) y seccion 4 (Resumen de acceso):
    - Texto: En la definicion de Administrador no se menciona Caja y cierres; en Cajero se lista solo `Escritorio, Pedidos y caja, Reservas, Clientes, Créditos, Ofertas y descuentos, Notificaciones`.
    - Texto: En la tabla `Resumen de acceso`, entre las filas `Pedidos y caja` y `Cocina`, o entre `Créditos` y `Productos`, no existe ninguna fila para `Caja y cierres`.
- Por que importa: El modulo mas critico para la cuadratura contable y arqueo diario de dinero no esta formalizado en la matriz de permisos de roles.
- Prioridad: Alta
- Propuesta de arreglo: Incorporar la fila `Caja y cierres` en la tabla de resumen de accesos de `docs/modulos-y-roles.md` con permisos asignados al Administrador y al Cajero.
- Evidencia:
  - CONFIRMADO: La cadena `Caja y cierres` solo aparece una vez en todo `docs/modulos-y-roles.md` (en la tabla descriptiva de la seccion 2).
  - SUPOSICION: Ninguna.

---

### Hallazgo D-06
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/modulos-y-roles.md`, seccion 3 (Mozo):
    - Texto: `- **Pedido de mesa:** en Pedidos y caja pulsa "Nuevo pedido de mesa": elige el piso (solo si hay más de uno), toca una mesa libre en el plano y arma el pedido como un carrito con **las mismas opciones de la carta** (tamaño, leche, endulzante, cremas, adicionales y nota para cocina), con varios productos; lo envía a caja.`
  - Lado 2: `docs/modulos-y-roles.md` (seccion 2), `docs/BRD.md` y `docs/flujo-de-pedidos.md`:
    - Texto `docs/modulos-y-roles.md`: `Pedido del mozo en el local: va directo a cocina.`
    - Texto `docs/BRD.md`: `| RN-CAP-073 | Un pedido que el mozo toma en el local va directo a las pantallas de cocina y se imprimen su comanda y sus etiquetas. No pasa por caja; el cobro se hace al final. |`
    - Texto `docs/flujo-de-pedidos.md`: `El pedido va **directo a las pantallas de cocina**; se descuentan los productos y se imprimen la comanda y las etiquetas.`
- Por que importa: Existe una contradiccion interna dentro del mismo documento `modulos-y-roles.md` y contra el BRD; si el mozo enviara el pedido a caja para aprobacion, los pedidos en salon se retrasarian contraviniendo la meta de entrega de 13 minutos.
- Prioridad: Alta
- Propuesta de arreglo: Corregir la oracion en `docs/modulos-y-roles.md` reemplazando "lo envía a caja" por "lo envía directo a cocina".
- Evidencia:
  - CONFIRMADO: Verificado en `docs/modulos-y-roles.md` que la oracion termina exactamente con `lo envía a caja.`
  - SUPOSICION: Ninguna.

---

### Hallazgo D-07
- Tipo: hueco
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md` (seccion 4) y `docs/modulos-y-roles.md`:
    - Texto `docs/BRD.md`: `- **Roles y escritorio por rol:** siete roles (administrador, cajero, cocina y barra, mozo, call center, almacén, repartidor).`
    - Texto `docs/modulos-y-roles.md`: Omite totalmente al rol Produccion en la seccion 3 y en las columnas de la tabla de accesos de la seccion 4.
  - Lado 2: `docs/BRD.md` (secciones 1, 3, 5), `docs/registro-mockup.md` y `fuente/Admin.dc.html`:
    - Texto `docs/BRD.md`: `| NEC-CAP-081 | Producción registra tandas por receta (donas, galletas, pan pullman, gelatina)... |`
    - Texto `docs/BRD.md`: `| RN-CAP-091 | Registrar una producción baja la materia prima de la receta por el número de tandas... |`
    - Texto `docs/registro-mockup.md`: `Menú por grupos y por rol (administrador, cajero, cocina y barra, mozo, call center, almacén, producción y repartidor).`
    - Texto `fuente/Admin.dc.html`: `produccion: { n: 'Producción', user: 'prod01', person: 'Encargada de producción', ini: 'PR', color: '#E6B89C', views: [ 'escritorio', 'almacen', 'stock', 'notificaciones' ], home: 'escritorio', manage: true },`
- Por que importa: Produccion es un rol operativo real con usuario dedicado (`prod01`), escritorio propio y permisos de registro de tandas y mermas matutinas; omitirlo en el BRD y en `modulos-y-roles.md` deja sin definicion contractual sus permisos y responsabilidades.
- Prioridad: Alta
- Propuesta de arreglo: Actualizar el BRD declarando formalmente 8 roles en el alcance e incorporar el perfil y la columna de Produccion en `docs/modulos-y-roles.md`.
- Evidencia:
  - CONFIRMADO: En `fuente/Admin.dc.html` existe `ROLES.produccion`, y en `docs/registro-mockup.md` se lista entre los 8 roles.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-08
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/modulos-y-roles.md`, seccion Call center:
    - Texto: `- **Ve:** Escritorio, Pedidos y caja, Repartos, Reservas, Clientes, Notificaciones.`
  - Lado 2: `fuente/Admin.dc.html`, definicion de ROLES:
    - Texto: `callcenter: { n: 'Call center', user: 'call01', person: 'Operadora de ejemplo', ini: 'OP', color: '#D9CFC2', views: [ 'escritorio', 'caja', 'repartos', 'reservas', 'clientes', 'mapa', 'mensajes', 'notificaciones' ], home: 'escritorio', manage: false },`
- Por que importa: El operador de call center necesita ver el mapa de entregas (`mapa`) para orientar clientes sobre cobertura y la consola de mensajes (`mensajes`) para resolver dudas; omitirlos en el documento desalinea la documentacion del sistema implementado.
- Prioridad: Media
- Propuesta de arreglo: Anadir `Mapa de entregas` y `Mensajes de WhatsApp` a la lista de vistas y tabla de acceso del rol Call center en `docs/modulos-y-roles.md`.
- Evidencia:
  - CONFIRMADO: En `fuente/Admin.dc.html` la constante `ROLES.callcenter.views` incluye explicitamente `'mapa'` y `'mensajes'`.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-09
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md` (seccion 7, Supuestos) y `fuente/Admin.dc.html`:
    - Texto `docs/BRD.md`: `- El cajero o la cajera seguirá aceptando todos los pedidos, incluidos los del chatbot.`
    - Texto `fuente/Admin.dc.html`: `caja: ['Pedidos y caja', 'El cajero verifica cada pedido y lo acepta antes de que pase a cocina.'], cocina: ['Pantalla de cocina', 'Pedidos aceptados por caja, con su tiempo.'],`
  - Lado 2: `docs/BRD.md` (seccion 5), `docs/flujo-de-pedidos.md` y `docs/registro-mockup.md`:
    - Texto `docs/BRD.md`: `| RN-CAP-001 | Un pedido fuera del local (carta virtual, chatbot, teléfono: delivery o para recoger) no pasa a cocina hasta que una persona del equipo habla con el cliente por WhatsApp, confirma el pedido y el pago y sube el comprobante. *(Cambia la regla original del acta 01, que lo hacía solo caja; ver RN-CAP-073 a RN-CAP-076.)* |`
    - Texto `docs/BRD.md`: `| RN-CAP-074 | Un pedido fuera del local (delivery o para recoger) llega con estado "por confirmar". Una persona de caja, mozo o call center debe hablar con el cliente por WhatsApp, elegir el medio de pago y confirmar. |`
    - Texto `docs/flujo-de-pedidos.md`: `Quién puede confirmar: caja, mozo, call center y administrador.`
- Por que importa: El supuesto de la seccion 7 del BRD y la descripcion en pantalla del Admin corresponden a la version obsoleta (Acta 01); contradicen el nuevo flujo acordado el 18/10 donde mozo, call center y admin tambien confirman pedidos y el mozo no pasa por caja.
- Prioridad: Alta
- Propuesta de arreglo: Eliminar el supuesto restrictivo de la seccion 7 del BRD y actualizar el texto descriptivo del modulo caja en `Admin.dc.html` indicando la confirmacion multirrol.
- Evidencia:
  - CONFIRMADO: El supuesto en `docs/BRD.md` linea 337 mantiene la frase textual antigua.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-10
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md` y `docs/modulos-y-roles.md` (regla antigua):
    - Texto `docs/BRD.md`: `| RN-CAP-014 | ...una mesa solo se elimina si no tiene pedidos ni reservas, y si los tiene solo se desactiva. |`
    - Texto `docs/modulos-y-roles.md`: `una **mesa** solo se elimina si no tiene pedidos ni reservas, y si los tiene **solo se desactiva**.`
  - Lado 2: `docs/BRD.md` y `docs/modulos-y-roles.md` (regla nueva del 17/10):
    - Texto `docs/BRD.md`: `| RN-CAP-068 | Una mesa se puede eliminar del plano aunque ya se haya usado; los pedidos y reservas cerrados conservan el nombre de la mesa para consultas. No se elimina una mesa con un pedido abierto o una reserva activa hoy; mientras tanto se desactiva. (Cambia la regla anterior de eliminar solo lo que no tiene historial.) |`
    - Texto `docs/modulos-y-roles.md`: `Única excepción: en el Plano del local se puede eliminar cualquier elemento, incluso una mesa que ya se usó (el historial conserva el nombre de la mesa); solo se bloquea una mesa con un pedido abierto o una reserva activa hoy, que se desactiva mientras tanto.`
- Por que importa: RN-CAP-014 y RN-CAP-068 conviven en el mismo BRD sin haber sido depurada la regla original. Ademas, `modulos-y-roles.md` afirma ambas cosas en distintas secciones (seccion 1 vs seccion 2).
- Prioridad: Media
- Propuesta de arreglo: Actualizar RN-CAP-014 en el BRD y la descripcion del modulo Plano en `docs/modulos-y-roles.md` para reflejar la redaccion definitiva de RN-CAP-068.
- Evidencia:
  - CONFIRMADO: Ambas redacciones contradictorias coexisten literalmente en `docs/BRD.md` y en `docs/modulos-y-roles.md`.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-11
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md` y `docs/modulos-y-roles.md`:
    - Texto `docs/BRD.md`: `editar las dos promociones de la parte superior; al publicar, la carta virtual lo refleja.`
    - Texto `docs/modulos-y-roles.md`: `editar las dos promociones de la parte superior; decoración festiva;`
  - Lado 2: `docs/registro-mockup.md`, seccion Carta virtual:
    - Texto: `Las dos tarjetas de promociones dúo y la franja "Un lugar para compartir" se quitaron por decisión del 17/10.`
- Por que importa: Se sigue documentando una funcionalidad de diseno en el administrador para elementos visuales que ya fueron eliminados formalmente de la carta virtual.
- Prioridad: Baja
- Propuesta de arreglo: Suprimir la mencion a "las dos promociones de la parte superior" en el alcance del BRD y en `docs/modulos-y-roles.md`.
- Evidencia:
  - CONFIRMADO: Verificado en `docs/registro-mockup.md` que las dos tarjetas de promociones duo fueron retiradas.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-12
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/impresion-tickets.md` y `docs/pantalla-cocina.md`:
    - Texto `docs/impresion-tickets.md`: `por **área de producción** (cocina, barra), por **caja y tipo de comprobante**`
    - Texto `docs/pantalla-cocina.md`: `filtros por estación (cocina, barra, repostería)` y `Separación por estación (cocina, barra) para que cada pantalla vea solo lo suyo.`
  - Lado 2: `docs/BRD.md`, `docs/registro-mockup.md` y `fuente/Admin.dc.html`:
    - Texto `docs/BRD.md`: `| NEC-CAP-020 | Que cada área de producción (bebidas, postres y salados) vea en su pantalla solo lo que le toca... |`
    - Texto `docs/registro-mockup.md`: `por área (Bebidas, Salados, Postres o dulces)`
    - Texto `fuente/Admin.dc.html`: `kareaChips = [ ['todas', 'Todas'], ['bebidas', 'Bebidas'], ['postres', 'Postres'], ['salados', 'Salados'] ]` y funcion `AREA_OF`.
- Por que importa: La division del trabajo operativo y la asignacion de ticketeras de red y pantallas depende de nombres consistentes; hablar de "cocina y barra" frente a "Bebidas, Postres y Salados" confunde la configuracion de hardware.
- Prioridad: Media
- Propuesta de arreglo: Unificar la terminologia en todos los analisis tecnicos adoptando la triada oficial: Bebidas, Postres y Salados.
- Evidencia:
  - CONFIRMADO: En `fuente/Admin.dc.html` las areas codificadas son Bebidas, Postres y Salados; en `impresion-tickets.md` se sigue hablando de cocina y barra.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-13
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md` (secciones 1 y 4) y `docs/registro-mockup.md` (seccion 2):
    - Texto `docs/BRD.md`: `| NEC-CAP-019 | ...costo de delivery por rangos de distancia. |`
    - Texto `docs/BRD.md`: `delivery por rangos de distancia;`
    - Texto `docs/registro-mockup.md`: `costo de delivery por rangos de distancia.`
  - Lado 2: `docs/BRD.md` (secciones 1 y 5), `docs/delivery-informes/README.md` y `fuente/Admin.dc.html`:
    - Texto `docs/BRD.md`: `| NEC-CAP-076 | El costo de envío sale de la zona de reparto (Z2, Z3, Z4, Z5, Z7, de 2 a 7 soles) calculada con la ubicación del cliente; fuera de la zona se ofrece recojo. |`
    - Texto `docs/delivery-informes/README.md`: `Delivery: el bot real usa polígonos (LIMITES_DELIVERY.geojson: zonas Z2, Z3, Z4, Z5 y Z7, con tarifa de 2 a 7 soles; fuera de cobertura se ofrece recojo). La carta del mockup usa tres tramos inventados por kilómetros (3, 5 y 8 soles).`
    - Texto `fuente/Admin.dc.html`: `{ k: 'tarZ2', l: 'Envío zona 2 (s/)' }, { k: 'tarZ3', l: 'Envío zona 3 (s/)' }, { k: 'tarZ4', l: 'Envío zona 4 (s/)' }, { k: 'tarZ5', l: 'Envío zona 5 (s/)' }, { k: 'tarZ7', l: 'Envío zona 7 (s/)' }`
- Por que importa: El calculo por distancia euclidiana o radios en kilometros no refleja la realidad vial ni las tarifas reales de entrega acordadas en base a las 5 zonas GeoJSON del bot.
- Prioridad: Media
- Propuesta de arreglo: Reemplazar las menciones a "rangos de distancia" en el BRD y registro del mockup por "zonas poligonales de reparto Z2, Z3, Z4, Z5 y Z7".
- Evidencia:
  - CONFIRMADO: En `fuente/Admin.dc.html` y en `docs/BRD.md` NEC-CAP-076 se implementaron las zonas Z2 a Z7, coexistiendo con los textos viejos de distancia.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-14
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md`, `docs/delivery-informes/README.md` y `fuente/Main.dc.html`:
    - Texto `docs/BRD.md`: `| RN-CAP-009 | Delivery: envío gratis desde S/ 70; por debajo, el costo depende de la zona o la distancia (por confirmar vigencia y tarifas). |`
    - Texto `docs/delivery-informes/README.md`: `Ya coinciden: envío gratis desde 70 soles y pedido mínimo de 14.50.`
    - Texto `fuente/Main.dc.html`: `Delivery gratis desde ' + fmt(Number(INFO.envioGratis))`
  - Lado 2: `docs/BRD.md` y `docs/produccion-admin-bot-informes/README.md`:
    - Texto `docs/BRD.md`: `| RN-CAP-095 | Pendiente de Kevin: envío gratis "desde 70" (carta y tienda vieja) o "más de 70" (bot). El mockup usa "desde 70". |`
    - Texto `docs/produccion-admin-bot-informes/README.md`: `Bot: regla de envío gratis: el bot usa "más de 70" (> 70); la tienda vieja y nuestra carta usan "desde 70" (>= 70). Hay que decidir con Kevin.`
- Por que importa: Para un pedido de exactamente S/ 70.00, la carta virtual y el sistema administrativo no cobran envio (`>= 70`), pero el bot de WhatsApp real le cobra flete (`> 70`), provocando reclamos de clientes.
- Prioridad: Baja
- Propuesta de arreglo: Homogeneizar la regla formalmente en el BRD y ajustar el codigo del bot a "desde 70 soles" (`>= 70`).
- Evidencia:
  - CONFIRMADO: La discrepancia entre `>= 70` y `> 70` esta explicitamente registrada como pendiente en RN-CAP-095.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-15
- Tipo: hueco
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md`, seccion 4 (Siguiente / Deberia y Podria) y seccion 6 (Criterios de aceptacion):
    - Texto: `- **Stock de insumos en tiempo real** y vínculo con la carta, para no ofrecer productos agotados.` (Hito: Fin de la fase "Siguiente")
    - Texto: `- **Recetas por plato** con costos y margen de utilidad.` (Hito: Fin de la fase "Siguiente")
    - Texto: `- **Almacén y recetas** *(acta 02)*: entrada, salida y merma; producción diaria al stock; descuento de insumos por receta al vender; semáforo de stock y alertas por correo; proveedores A, B y C por insumo; orden de compra por WhatsApp con un clic.` (Hito: Fin de la fase "Siguiente")
    - Texto: `- **Cuentas de cliente y puntos** *(acta 02)*: compra como invitado o con cuenta (correo y cumpleaños), puntos y aviso de privacidad.`
    - Texto: `- **Crédito del personal** *(acta 02)*: hasta 15 días y 25 % de descuento...`
    - Texto: `- **Etiquetas adhesivas para vasos y pantalla de despacho** *(acta 02)*.`
  - Lado 2: `docs/registro-mockup.md` (secciones 4 y 6) y `fuente/Admin.dc.html`:
    - Texto `docs/registro-mockup.md`: Registra que en las versiones v94, v100, v102, v106, v107 y v110 ya se construyeron: modulo Compras con proveedores A/B/C, Almacen con entradas/salidas/mermas, Stock y recetas con margen y costo, Produccion por tandas, Creditos con abonos, Clientes con puntos y etiquetas adhesivas para vasos.
    - Codigo `fuente/Admin.dc.html`: Implementa las plantillas completas de Compras, Proveedores, Almacen, Stock con recetas y calculo de margen, Creditos del personal y etiquetas de vasos.
- Por que importa: El BRD presenta como "trabajo futuro" funcionalidades nucleares que ya estan terminadas en el prototipo, impidiendo que el cliente evalue y firme la aprobacion de lo que ya esta construido.
- Prioridad: Alta
- Propuesta de arreglo: Mover estos modulos desde la seccion "Siguiente" a la seccion "En alcance - Fase Ahora" del BRD y actualizar sus hitos de aceptacion a la fase actual.
- Evidencia:
  - CONFIRMADO: En `fuente/Admin.dc.html` existen todos los modulos citados y en `docs/registro-mockup.md` figuran como construidos.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-16
- Tipo: hueco
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md`, seccion 4 (En alcance - E1 / Debe tener) y seccion 6 (Criterios de aceptacion):
    - Texto: `- **Impresión de tickets:** al aceptar un pedido se imprime la comanda en la ticketera de la red del local según el área (cocina, barra)...` (Criterio: Fin de la fase "Ahora")
    - Texto: `- **Pantalla de cocina en TV:** una URL de solo lectura que muestra los pedidos en cocina...` (Criterio: Fin de la fase "Ahora")
    - Texto: `| RN-CAP-005 | El chatbot ofrece las mismas opciones, precios y reglas que la carta. |` (Criterio: Fin de la fase "Siguiente")
    - Texto: `| NEC-CAP-049 | "Usar mi ubicación actual" en todo pedido de delivery (carta, administrativo y chatbot)... |`
  - Lado 2: `docs/registro-mockup.md` (seccion 7) y `docs/delivery-informes/README.md`:
    - Texto `docs/registro-mockup.md`: `- **Impresión, pantallas de TV, WhatsApp real, base de datos local para modo sin internet:** solo propuestas o simulaciones.`
    - Texto `docs/registro-mockup.md`: `- **Ubicación:** ...el pedido de la carta no llega con coordenadas al administrativo.`
    - Texto `docs/combos-y-opciones.md`: `- El chatbot tiene todavía una carta propia de ejemplo; en el sistema real leerá la misma carta que la web.`
- Por que importa: El BRD compromete para la entrega actual componentes fisicos de hardware y conectividad (impresion directa por socket TCP y pantallas sincronizadas en TV) que en el software son unicamente interfaces simuladas en memoria local.
- Prioridad: Alta
- Propuesta de arreglo: Especificar en los criterios de aceptacion de la fase "Ahora" que la impresion fisica y el streaming a TV requieren el diseno de arquitectura local (ADR) y la instalacion de servicios puente.
- Evidencia:
  - CONFIRMADO: `docs/registro-mockup.md` linea 114 admite que impresion y TV son solo simulaciones.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-17
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md`, `docs/registro-mockup.md` y `docs/configuracion-centralizada.md` (metadatos frontmatter):
    - Texto `docs/BRD.md`: `version: "1.36"`, `fecha: 2026-10-17`
    - Texto `docs/registro-mockup.md`: `version: "0.1"`, `fecha: 2026-10-17`, `Estado del mockup al 17/10/2026: artifact "Caprichos Plataforma Digital", versión 105.`
    - Texto `docs/configuracion-centralizada.md`: `version: "0.1"`, `fecha: 2026-10-17`, `Estado en el mockup (versión 65 del artifact)`
  - Lado 2: `docs/registro-mockup.md` (cuerpo) y los README de informes:
    - Texto `docs/registro-mockup.md`: Cita versiones v106, v107, v108, v109 y v110 con fecha 18/10/2026.
    - Texto `docs/cajero-informes/README.md`: `Fecha: 18/10/2026.`
    - Texto `docs/cocina-informes/README.md`: `Fecha: 18/10/2026.`
    - Texto `docs/delivery-informes/README.md`: `Fecha: 18/10/2026.`
    - Texto `docs/produccion-admin-bot-informes/README.md`: `Fecha: 18/10/2026.`
- Por que importa: Los documentos normativos declaran formalmente estar en versiones obsoletas (v65 o v105 del 17 de octubre), mientras que su contenido ya incorpora decisiones tomadas en la version 110 del 18 de octubre.
- Prioridad: Media
- Propuesta de arreglo: Homogeneizar la fecha a 2026-10-18 y elevar la version de los documentos para alinearlos con el estado actual del prototipo (v110).
- Evidencia:
  - CONFIRMADO: Los frontmatters indican 2026-10-17 mientras que el cuerpo cita profusamente la fecha 18/10/2026 y versiones hasta v110.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-18
- Tipo: hueco
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md`, referencias a rutas relativas:
    - Texto: `analisis/ficha-intake.md`
    - Texto: `actas/acta-01-descubrimiento.md`
    - Texto: `actas/acta-02-descubrimiento.md`
    - Texto: `analisis/iniciativas-acta-02.md`
    - Texto: `analisis/pantalla-cocina.md`
    - Texto: `analisis/impresion-tickets.md`
    - Texto: `recursos/carta-completa.md`
  - Lado 2: Estructura del repositorio en disco:
    - Las carpetas `analisis/`, `actas/` y `recursos/` no existen en el directorio raiz ni dentro de `docs/`. Todos los archivos estan directamente bajo `docs/` (`docs/ficha-intake.md`, `docs/acta-01-descubrimiento.md`, etc.), excepto `carta-completa.md` que no existe en el proyecto.
- Por que importa: Cualquier lector o validador que intente navegar por la documentacion oficial encontrara enlaces rotos.
- Prioridad: Media
- Propuesta de arreglo: Corregir las rutas en `docs/BRD.md` para que apunten a los archivos reales dentro de `docs/` y reemplazar la referencia a `carta-completa.md` por el archivo correspondiente.
- Evidencia:
  - CONFIRMADO: Verificado mediante comando de terminal que `analisis`, `actas` y `recursos` no existen en el sistema de archivos.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-19
- Tipo: hueco
- Donde esta cada lado:
  - Lado 1: `docs/acta-01-descubrimiento.md`, seccion Contexto del cliente:
    - Texto: `El bot está programado para terminar cada respuesta con una pregunta de **cierre de venta**, para orientar al cliente hasta cerrar el pedido.`
  - Lado 2: `docs/BRD.md`, seccion 1 y 5:
    - Omite la obligatoriedad del cierre de venta comercial persuasivo en cada respuesta conversacional del chatbot (solo menciona tono de marca y no fallar en NEC-CAP-007).
- Por que importa: El valor diferencial del chatbot para Kevin es la hospitalidad y la conversion comercial; omitir la pauta de cierre de venta en las reglas de negocio permite construir un bot puramente informativo y transaccional.
- Prioridad: Media
- Propuesta de arreglo: Anadir una regla de negocio en el BRD que obligue al chatbot a culminar cada consulta abierta con una propuesta de adicion o cierre de pedido.
- Evidencia:
  - CONFIRMADO: En `docs/acta-01-descubrimiento.md` linea 17 figura la cita textual del requerimiento de Kevin.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-20
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/acta-02-descubrimiento.md` y `docs/registro-mockup.md`:
    - Texto `docs/registro-mockup.md`: `Crédito solo para el personal (Kevin dijo en la reunión "ponle para todos").`
  - Lado 2: `docs/BRD.md`, seccion 5 y seccion 7:
    - Texto: `| RN-CAP-058 | El crédito es solo para el personal; no se da crédito a clientes. El porcentaje de descuento (25 % de inicio) y el plazo (15 días de inicio) se configuran en el administrativo. |`
    - Texto: `Créditos sirve solo para el personal (decisión del equipo de desarrollo el 16/10: aunque Kevin mencionó que el sistema actual lo permite a todos, a clientes no se les da crédito; queda por confirmar con Kevin).`
- Por que importa: El equipo de desarrollo tomo una decision unilateral de diseno que contraviene la instruccion directa dada por el cliente en la reunion, manteniendola sin validacion formal.
- Prioridad: Alta
- Propuesta de arreglo: Tratar con caracter prioritario en la proxima reunion con Kevin la aprobacion formal de si el credito es exclusivo del personal o si se habilitara para clientes frecuentes de confianza.
- Evidencia:
  - CONFIRMADO: El propio equipo documenta en `docs/BRD.md` linea 340 y `docs/registro-mockup.md` linea 73 que contradijeron la peticion expresa de Kevin.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-21
- Tipo: hueco
- Donde esta cada lado:
  - Lado 1: `docs/acta-02-descubrimiento.md`:
    - Texto: `los filetes. Eso es en los filetes por el tema de producción... y el pollo también, pero el pollo lo cosen en la noche y queda para el día siguiente. O sea, a veces hacen un poquito de más quea para el día siguiente refrigerado.`
    - Texto `docs/iniciativas-acta-02.md`: `Compra y control de pollo por unidades de filete de pechuga especial` y `Conservación y prioridad de salida para filetes de pollo cocidos`
  - Lado 2: `docs/BRD.md`, reglas de produccion:
    - Texto: `| NEC-CAP-081 | Producción registra tandas por receta (donas, galletas, pan pullman, gelatina)... |`
    - Texto: `| RN-CAP-092 | Las donas avisan a las 10 horas y pasan a alerta alta a las 12 horas desde su producción. |`
    - No existe ninguna mencion a la coccion nocturna, control por unidades ni conservacion de filetes de pechuga de pollo.
- Por que importa: El pollo es el ingrediente principal de los salados (Club Sandwich, empanadas); ignorar su control por tandas nocturnas deja fuera del modulo de Produccion su insumo de mayor costo.
- Prioridad: Media
- Propuesta de arreglo: Incorporar en el BRD y en las recetas de Produccion el procedimiento de coccion y rotacion nocturna de filetes de pollo por unidad.
- Evidencia:
  - CONFIRMADO: La explicacion operativa de Kevin consta en la transcripcion de `docs/acta-02-descubrimiento.md`.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-22
- Tipo: hueco
- Donde esta cada lado:
  - Lado 1: `docs/acta-02-descubrimiento.md` y `docs/iniciativas-acta-02.md`:
    - Texto `docs/iniciativas-acta-02.md`: `Inclusión de clave Wi-Fi en el ticket o voucher impreso`
  - Lado 2: `docs/BRD.md` (seccion 4) e `docs/impresion-tickets.md` (seccion 6):
    - Texto `docs/BRD.md`: `clave de Wi-Fi por ticket` colocada como idea futura en la seccion `Después / horizonte futuro`.
    - Texto `docs/impresion-tickets.md`: No incluye el campo de clave Wi-Fi en la estructura del ticket comanda ni en la precuenta.
- Por que importa: Es un detalle de hospitalidad solicitado por el cliente que reduce la carga del personal de sala al responder reiteradamente por la contrasena de la red.
- Prioridad: Baja
- Propuesta de arreglo: Anadir el campo configurable "Clave Wi-Fi para clientes" en Configuracion del local e imprimirlo al pie del ticket de precuenta o comanda.
- Evidencia:
  - CONFIRMADO: El requerimiento consta en las iniciativas extraidas del acta 02 y esta omitido en las especificaciones tecnicas de impresion.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-23
- Tipo: hueco
- Donde esta cada lado:
  - Lado 1: `docs/acta-02-descubrimiento.md` y `docs/iniciativas-acta-02.md`:
    - Texto `docs/iniciativas-acta-02.md`: `Uso de 3 televisores Smart TV en salón para avisos de pedidos a clientes`
  - Lado 2: `docs/BRD.md` (seccion 4) y `docs/pantalla-cocina.md`:
    - Texto `docs/BRD.md`: `televisores para clientes` relegado a `Después / horizonte futuro`.
    - Texto `docs/pantalla-cocina.md`: Solo especifica la pantalla KDS de TV de cocina/barra, ignorando por completo el diseno de la pantalla publica de turnos para clientes del salon.
- Por que importa: El cliente dispone fisicamente de los 3 televisores en el local y restaurant.pe no los aprovecha; la nueva solucion no esta especificando como mostraran los pedidos listos a los clientes en mesa.
- Prioridad: Media
- Propuesta de arreglo: Definir en la documentacion tecnica una URL publica secundaria de "Pantalla de turnos y llamados de salon" para las pantallas de los clientes.
- Evidencia:
  - CONFIRMADO: En `docs/BRD.md` linea 341 se admite la existencia de las 3 Smart TV, pero su pantalla se relego a futuro en la linea 181.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-24
- Tipo: discordancia
- Donde esta cada lado:
  - Lado 1: `docs/acta-02-descubrimiento.md` y `docs/iniciativas-acta-02.md`:
    - Texto `docs/iniciativas-acta-02.md`: `Soporte dual en salón: pedidos mediante QR y atención asistida por mozo`
  - Lado 2: `docs/BRD.md` y `docs/registro-mockup.md`:
    - Texto `docs/BRD.md`: `El pedido en mesa lo hace solo el mozo desde el administrativo (decisión del 17/10).`
    - Texto `docs/BRD.md`: `| RN-CAP-016 | ...El cliente no puede pedir "en el local": en el salón pide el mozo. |`
    - Texto `docs/registro-mockup.md`: `el cliente no pide "en el local": en el salón pide el mozo`
- Por que importa: El soporte de auto-pedido por codigo QR en la mesa del cliente es una funcionalidad clave discutida con Kevin; bloquearla en el BRD sin su consentimiento documentado cercena una via de atencion importante en horas punta.
- Prioridad: Media
- Propuesta de arreglo: Someter a confirmacion de Kevin si el pedido por QR en mesa queda descartado o si se implementara en una fase posterior.
- Evidencia:
  - CONFIRMADO: La decision de restringir el pedido de mesa exclusivamente al mozo fue tomada por el equipo el 17/10, modificando la propuesta inicial de soporte dual.
  - SUPOSICION: Ninguna.

---

### Hallazgo D-25
- Tipo: flujo
- Donde esta cada lado:
  - Lado 1: `docs/BRD.md`, regla de anulacion:
    - Texto: `| RN-CAP-089 | Anular un pedido exige motivo y queda en el historial; solo se anulan pedidos sin cobrar. Cliente que no contesta o dirección no encontrada avisa a caja y al call center. |`
  - Lado 2: `fuente/Admin.dc.html`, maquina de estados:
    - Texto: `STATUS = { nuevo: { l: 'Por confirmar'... }, cola: { l: 'En cocina · nuevo'... }, prep: { l: 'Preparando'... }, listo: { l: 'Listo'... }, ruta: { l: 'En camino'... }, entregado: { l: 'Entregado'... }, rechazado: { l: 'Rechazado'... } };`
    - Texto: `this.setOrder(s.sel, { status: 'rechazado', rider: '', anulado: { motivo: this.state.anud.motivo, por: role.n, pin: s.role !== 'admin' } });`
- Por que importa: Un pedido anulado no es semanticamente identico a un pedido rechazado (el rechazo ocurre antes de confirmarse o prepararse; la anulacion ocurre en cocina o reparto). Al reutilizar `rechazado`, las estadisticas y los filtros de auditoria mezclan ambos conceptos. Ademas, no se revierten los insumos descontados.
- Prioridad: Media
- Propuesta de arreglo: Incorporar el estado formal `anulado` en la maquina de estados y documentar la devolucion automatica de stock al anular.
- Evidencia:
  - CONFIRMADO: En `fuente/Admin.dc.html` no existe la clave `anulado` dentro del diccionario `STATUS`, y la funcion de anular fija `status: 'rechazado'`.
  - SUPOSICION: Ninguna.

---

## 3. Matriz de inconsistencias y acciones requeridas

| ID | Categoria | Documento origen | Documento destino / Codigo | Prioridad | Accion recomendada |
| :-- | :-- | :-- | :-- | :-: | :-- |
| D-01 | Numeracion | docs/BRD.md | docs/BRD.md | Alta | Renumerar las reglas colisionadas RN-CAP-081 a 086 duplicadas. |
| D-02 | Numeracion | docs/BRD.md | docs/BRD.md | Media | Ordenar ascendentemente RN-CAP-026/027 y reubicar RN-CAP-075-080. |
| D-03 | Numeracion | docs/BRD.md | docs/BRD.md | Media | Corregir secuencia desordenada NEC-CAP-010-016 y reubicar NEC-CAP-067. |
| D-04 | Permisos | docs/modulos-y-roles.md | docs/BRD.md / fuente/Admin.dc.html | Alta | Quitar acceso a Ofertas y descuentos del rol Cajero. |
| D-05 | Permisos | docs/modulos-y-roles.md | docs/cierre-de-caja.md / Admin.dc.html | Alta | Agregar modulo Caja y cierres en la tabla de accesos de roles. |
| D-06 | Flujo | docs/modulos-y-roles.md | docs/BRD.md / docs/flujo-de-pedidos.md | Alta | Cambiar "lo envía a caja" por "directo a cocina" en Mozo. |
| D-07 | Roles | docs/BRD.md / modulos-y-roles.md | docs/registro-mockup.md / Admin.dc.html | Alta | Reconocer oficialmente al rol Produccion (8 roles). |
| D-08 | Permisos | docs/modulos-y-roles.md | fuente/Admin.dc.html | Media | Anadir Mapa y Mensajes a la matriz de Call center. |
| D-09 | Flujo | docs/BRD.md / Admin.dc.html | docs/flujo-de-pedidos.md | Alta | Eliminar supuesto de que solo caja acepta pedidos. |
| D-10 | Reglas | docs/BRD.md / modulos-y-roles.md | docs/BRD.md / modulos-y-roles.md | Media | Eliminar RN-CAP-014 antigua y mantener RN-CAP-068. |
| D-11 | Alcance | docs/BRD.md / modulos-y-roles.md | docs/registro-mockup.md | Baja | Quitar menciones a las 2 promociones de cabecera retiradas. |
| D-12 | Terminologia | docs/impresion-tickets.md | docs/BRD.md / fuente/Admin.dc.html | Media | Unificar nombres de areas a Bebidas, Postres y Salados. |
| D-13 | Reglas | docs/BRD.md / registro-mockup.md | docs/delivery-informes / Admin.dc.html | Media | Reemplazar "distancia" por zonas GeoJSON Z2-Z7. |
| D-14 | Reglas | docs/BRD.md | docs/produccion-admin-bot-informes | Baja | Validar con Kevin y fijar `>= 70` en el bot de WhatsApp. |
| D-15 | Alcance | docs/BRD.md | docs/registro-mockup.md / Admin.dc.html | Alta | Mover modulos construidos de "Siguiente" a "En alcance - Ahora". |
| D-16 | Alcance | docs/BRD.md | docs/registro-mockup.md | Alta | Aclarar que impresion y KDS en TV son simulaciones en el mockup. |
| D-17 | Versiones | docs/BRD.md / registro-mockup.md | docs/*-informes/README.md | Media | Actualizar frontmatter a 18/10/2026 y v110. |
| D-18 | Rutas | docs/BRD.md | Sistema de archivos | Media | Corregir rutas rotas `analisis/` y `actas/` a `docs/`. |
| D-19 | Negocio | docs/acta-01-descubrimiento.md | docs/BRD.md | Media | Formalizar pregunta de cierre de venta obligatoria en el bot. |
| D-20 | Negocio | docs/acta-02-descubrimiento.md | docs/BRD.md / registro-mockup.md | Alta | Validar con Kevin la restriccion de credito exclusivo al personal. |
| D-21 | Operacion | docs/acta-02-descubrimiento.md | docs/BRD.md | Media | Documentar control de filetes de pechuga de pollo en Produccion. |
| D-22 | Hospitalidad | docs/acta-02-descubrimiento.md | docs/impresion-tickets.md | Baja | Anadir clave Wi-Fi en precuenta/ticket comanda. |
| D-23 | Hardware | docs/acta-02-descubrimiento.md | docs/pantalla-cocina.md | Media | Documentar URL publica para las 3 Smart TV de clientes. |
| D-24 | Canal | docs/acta-02-descubrimiento.md | docs/BRD.md | Media | Validar descarte de pedidos por QR de clientes en salon. |
| D-25 | Flujo | docs/BRD.md | fuente/Admin.dc.html | Media | Crear estado `anulado` formal y revertir stock. |

---

INFORME LISTO.
