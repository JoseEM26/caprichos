---
id: ANA-CAP-001
tipo: analisis
titulo: "Revisión del rol Almacén frente a restaurant.pe"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, almacen-informes]
---

# Revisión del rol Almacén frente a restaurant.pe

Fecha: 18/10/2026. Ocho informes de agentes de Antigravity, en dos rondas:
- **Ronda 1** (documentos de análisis): `almacen.md`, `compras.md`, `stock.md`, `informes.md`, `modulos.md`.
- **Ronda 2** (pantallas reales de restaurant.pe extraídas antes, en HTML): `vivo-almacen.md`, `vivo-informes.md`, `vivo-ajustes.md`.

Nota sobre "en vivo": los agentes no iniciaron sesión en restaurant.pe (las credenciales no se les entregan). La ronda 2 usa las **pantallas guardadas de una extracción anterior**, que describen campos, botones, filtros y columnas reales. Compras e Insumos no tienen pantallas guardadas: esos dos temas salen solo de documentos. Todo es propuesta; no se cambió el mockup. Comprobé en el código del mockup que las recetas están fijas en 3 platos y que el Kardex es solo una fila de texto, y que las pantallas que citan los agentes existen en la extracción.

## Mapa de módulos (de `modulos.md`)
De los 17 módulos de restaurant.pe: **completos** 9 (Escritorio, Ventas, Caja, Reservas, Clientes, Ofertas, Descuentos, Delivery, Indicadores), **parciales** 6 (Productos, Compras, Almacén, Informes, Ajustes, Créditos) y **no tiene** "Mi restaurant" (facturación electrónica; fuera de alcance según el BRD). El rol Almacén ve en restaurant.pe más módulos que los 6 del mockup (por ejemplo, Ajustes de almacenes y el pago de compras en Créditos).

## Lo que falta, priorizado para una cafetería

**Prioridad 1: abastecimiento y datos maestros**
1. **Registro de compras** (proveedor, comprobante, detalle con cantidad, unidad, costo, **lote y fecha de vencimiento**) que sume al stock y deje el movimiento de entrada.
2. **Proveedores:** ficha con RUC, contacto, días de crédito y datos de pago.
3. **Insumos con unidades y conversión** (se compra en saco o caja, se guarda en kilos o litros, se consume en gramos o mililitros), stock mínimo y máximo editables.
4. **Recetas editables y por tamaño**, con descuento automático por venta (hoy fijas en 3 platos), incluyendo extras y shots, y descartables según canal (vasos, tapas, bolsas).

**Prioridad 2: control**
5. **Kardex** por insumo con saldo acumulado y costo (promedio), y kardex general.
6. **Mermas** con motivo, responsable, hora y valor en soles.
7. **Arqueo o toma de inventario** (conteo físico, diferencias, ajustes).
8. **Requerimientos** de Barra y Cocina a Almacén, con estados, y **recepción** de mercadería contra la orden de compra, con faltantes.
9. **Reposición:** monitor de stock con faltante contra el máximo y generación de la orden de compra.

**Prioridad 3: producción y logística**
10. **Preparación de recetas base** (jarabes, cremas, masa de queque) y **porcionamiento** con merma.
11. **Varios almacenes** (almacén central, barra, cocina) y **transferencias** con guía.
12. **Informes reales** de inventario y compras (stock valorizado, kardex, productos por vencer, cuadre de stock, compras por proveedor y por pagar) con filtros y exportación, y alerta de insumos por vencer.
13. **Notas de movimiento** imprimibles con firmas, y borradores o plantillas de transferencia (abastecer la barra cada mañana).

**Fuera de alcance por ahora:** guía de remisión electrónica y kardex para SUNAT (el BRD deja fuera lo tributario).

## Cómo hacerlo mejor que restaurant.pe (ideas de los informes)
- Un solo lugar por insumo: ficha con unidades, mínimos, proveedor habitual, receta donde se usa, últimos movimientos y kardex, sin saltar entre módulos.
- Compra, recepción y entrada a stock en un solo flujo.
- Alertas en el escritorio del almacenero: por vencer, bajo mínimo, requerimientos de cocina y compras por recibir.
- Mermas y arqueos con pocos clics y teclado numérico, pensados para celular.

## Preguntas para Kevin
1. ¿Cuántos almacenes reales hay (central, barra, cocina)?
2. ¿Se controla lote y vencimiento de todo, o solo de perecibles (leche, crema, embutidos, pastelería)?
3. ¿El costo es promedio o por última compra?
4. ¿Quién registra compras, mermas y conteos: almacenero, cajero o administrador?
5. ¿Se compra con factura a proveedores con RUC o también sin comprobante?

## Límites
- Los informes son de agentes: antes de construir cada punto hay que comprobarlo contra la pantalla o el código.
- Compras e Insumos sin pantallas reales: dependen de documentos.
