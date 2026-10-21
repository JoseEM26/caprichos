---
id: ANA-CAP-014
tipo: analisis
titulo: "Revisión de lo que puede hacer el cajero (sin Caja y cierres)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, cajero-informes]
---

# Revisión de lo que puede hacer el cajero (sin Caja y cierres)

Fecha: 18/10/2026. Seis agentes de Antigravity revisaron el mockup (v99) contra los documentos de análisis de restaurant.pe. Cada informe está en esta carpeta. Todos los hallazgos son propuestas: nada se cambió en el mockup. Los puntos marcados "verificado" los comprobé yo contra el código; el resto sale del informe del agente y está por confirmar.

| Módulo | Informe |
|---|---|
| Pedidos y caja | [pedidos.md](pedidos.md) |
| Reservas | [reservas.md](reservas.md) |
| Clientes | [clientes.md](clientes.md) |
| Créditos del personal | [creditos.md](creditos.md) |
| Ofertas y descuentos | [ofertas.md](ofertas.md) |
| Escritorio, notificaciones, perfil | [escritorio.md](escritorio.md) |

## Lo más importante

**1. Cobrar un pedido no pide nada (verificado).** "Registrar cobro" solo marca el pedido como cobrado: no se elige el medio de pago, ni el monto recibido, ni el vuelto, ni hay pago mixto. Esto afecta al cierre de caja, que cuadra por medio de pago. Es lo primero a arreglar.

**2. Faltan operaciones de caja del día a día.** Anular un pedido ya cobrado, devoluciones, descuentos o cortesías con autorización, propinas, cambiar el medio de pago o la mesa de un pedido abierto, motivo al rechazar un pedido, imprimir la precuenta (verificado: solo tiene "Cerrar").

**3. Clientes: error al editar (verificado en el código).** La lista muestra el DNI enmascarado (`4521****`) y al guardar una edición se vuelve a guardar el texto enmascarado. Además, las ediciones de la tabla no llegan al registro real de clientes. También: no hay botón para crear cliente, ni historial de pedidos del cliente.

**4. Reservas:** no hay "Nueva reserva" dentro del módulo (verificado), las reservas aprobadas no se suman a la lista, la tolerancia de 15 minutos no tiene lógica y no se puede activar la mesa cuando llega el cliente.

**5. Créditos del personal:** no hay registro de abonos ni estado de cuenta por trabajador, y el cajero puede cambiar las condiciones del crédito (porcentaje y plazo).

**6. Ofertas:** en Nuevo pedido no se pueden elegir promociones (verificado: solo salen productos), ni canjear cupones, ni se aplican los descuentos automáticos en pedidos manuales.

**7. Escritorio con números fijos (verificado):** "Cobrado en mi caja hoy" (s/ 668.40), "Reservas de hoy" (3) y "Créditos por vencer" (2) no cambian nunca. Falta una señal sonora o visual para los pedidos por confirmar.

**8. Permisos (verificado):** el cajero tiene permiso de administrador sobre todos sus módulos (`manage: true`), así que puede editar ofertas, reglas y condiciones del crédito. `modulos-y-roles.md` deja abierto si el cajero edita o solo consulta.

## Ya construido (v100)
Cobro con medio, pago mixto y vuelto; Clientes (nuevo, búsqueda por DNI, edición segura, historial); abonos del crédito; escritorio con cifras reales; promociones, cupones y descuentos automáticos en Nuevo pedido. Pendiente: anulaciones, descuentos manuales con autorización, propinas, precuenta imprimible, reservas (nueva reserva, tolerancia de 15 minutos) y permisos del cajero, que dependen de lo que decida Kevin.

## Decisiones para Kevin
1. ¿El cajero edita ofertas, reglas y el crédito del personal, o solo los consulta?
2. ¿Quién autoriza descuentos y anulaciones de pedidos ya cobrados (PIN del administrador)?
3. ¿Se registran propinas y pagos mixtos?
4. ¿El cajero puede crear clientes y reservas?
5. Boleta y factura: el BRD las deja fuera del sistema; uno de los informes pide pedir el RUC al elegir Factura. Hay que decidir si se registra al menos el RUC.

## Límites de esta revisión
- Los agentes compararon con documentos de análisis de restaurant.pe, no con la aplicación en vivo.
- Un agente puede equivocarse: antes de construir cada punto hay que comprobarlo contra el código.
