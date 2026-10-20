---
id: ANA-CAP-021
tipo: analisis
titulo: "Cierre de caja (lógica copiada de restaurant.pe)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, analisis]
---

# Cierre de caja (lógica copiada de restaurant.pe)

> Decisiones de la reunión del 18/10/2026, sobre el análisis de restaurant.pe de `caja-informes/restaurantpe-caja.md`. Por validar con Kevin. Vivo en el mockup (v97), módulo Caja y cierres.

## 1. Decisiones del cliente
- La caja se **abre en cero** cada mañana y aparece vacía.
- El cajero cuenta **viendo el sistema** y el dinero físico; no es a ciegas.
- Yape, Plin y transferencias se miran en **otro celular o en la cuenta**, fuera del sistema. El sistema solo muestra cuánto dice que se vendió por cada medio.
- El historial **nunca se pierde**. No se buscan responsables: se registra la diferencia y se guarda.
- La lógica se copia de restaurant.pe.

## 2. Flujo
1. **Abrir caja:** monto inicial (normalmente s/ 0.00), cajero y turno.
2. **Durante el turno:** ventas por medio de pago (efectivo, Yape, Plin, transferencia, tarjeta, otros), y movimientos: ingresos extras y egresos o gastos menores, siempre con motivo.
3. **Efectivo esperado** = apertura + ventas en efectivo + ingresos − egresos.
4. **Cerrar caja:**
   1. *Verificar movimientos* (obligatorio): abre un panel grande con todo el turno (ventas cobradas por pedido y medio, ingresos y egresos, pendientes). Se puede abrir siempre, aunque haya pedidos sin cobrar o por confirmar; esos pendientes impiden **cerrar**, no verlos.
   2. *Contar el efectivo* por billetes (200, 100, 50, 20, 10) y monedas (5, 2, 1, 0.50, 0.20, 0.10).
   3. *Billeteras y tarjetas:* el cajero anota lo que ve en el celular o terminal; el sistema muestra al lado su monto.
   4. *Resultado:* por cada medio, sistema, contado y diferencia (cuadrado, sobrante o faltante), más la diferencia total. Observaciones opcionales.
   5. Confirmar con Sí. El cierre se guarda y la caja queda cerrada; al día siguiente se abre en cero.
5. **Historial:** lista con filtros por fecha y estado; cada cierre se abre en un ticket de 80 mm que se puede reimprimir o bajar en PDF. No se edita ni se borra.

## 3. Lo que hace restaurant.pe y no está en el mockup
Según el informe: correlativos de boletas y facturas por turno, moneda extranjera, tarjetas una por una con vouchers, liquidación automática de inventario al cerrar, aviso al gerente, comprobantes pendientes de SUNAT, propinas, y opciones de impresión (paloteo, ventas por usuario, Excel). Quedan fuera por ahora; el mockup cubre el núcleo.

## 4. Por confirmar con Kevin
1. ¿Cuántos turnos hay al día? Hoy el cierre es uno por apertura.
2. ¿Quién puede abrir y cerrar: solo el cajero o también el administrador?
3. ¿Hace falta registrar propinas y moneda extranjera?
4. ¿Qué otras cuentas ("otros") cobran: crédito del personal, vales, pagos en línea?
5. ¿Se imprime el ticket de cierre o se revisa en digital?

## 5. Sobre el informe de restaurant.pe
El informe se generó con un agente de Antigravity. Contrasté tres puntos con las plantillas ya extraídas de restaurant.pe en `web-anterior/administrativo/modulos/caja/` (verificar movimientos antes de cerrar, conteo por billetes y monedas, caja a ciegas) y coinciden. No pude confirmar que el agente haya visto la aplicación en vivo, y varias partes del informe (tolerancia de descuadre, PDF del servidor, cajón monedero) figuran como no verificadas.
