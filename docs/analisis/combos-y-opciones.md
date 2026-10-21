---
id: ANA-CAP-026
tipo: analisis
titulo: "Combos y opciones de producto administrables"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, analisis]
---

# Combos y opciones de producto administrables

> Decisiones del 18/10/2026. Por validar con Kevin. Vivo en el mockup (v103): Ofertas y descuentos > Promociones > Armar combo, y Productos > Opciones y tamaños.

## 1. Por qué un combo se arma con productos de la carta
Dos formas posibles: (a) el combo es un producto aparte, sin relación con los productos sueltos; (b) el combo es un producto con precio propio **armado con productos de la carta**. Se eligió la (b), porque:
- **Stock:** al vender un Dúo se descuentan los frappés, las donas o el queque elegidos, no un "Dúo" abstracto.
- **Cocina y etiquetas:** cada parte va a la pantalla y etiquetera de su área.
- **Informes (a escala):** se pueden ver dos lecturas a la vez: *cuántos combos se vendieron y cuánto dinero dejaron*, y *cuántas unidades de cada producto salieron* (incluidas las de combos). Así, "frappé más vendido" cuenta también los frappés de los combos.
- **Mantenimiento:** si cambia un producto (nombre, receta, desactivarlo), el combo lo refleja solo.
Queda pendiente decidir cómo repartir el dinero del combo entre sus productos para los informes de ingresos por producto (propuesta: proporcional al precio de lista de cada parte).

## 2. Cómo se arma una oferta (sin programador)
Ofertas y descuentos > Promociones > **+ Armar oferta**. Primero se elige qué oferta: **Combo** (varios productos por un precio, el cliente elige), **Llevas más, pagas menos** (2x1, 3x2) o **Descuento** (porcentaje o monto menos). Las tres se pueden limitar por días, horas, fechas y canal; sin marcar nada valen siempre. Un combo se arma así:
1. **Nombre y precio por tamaño.** Una o varias filas (por ejemplo Regular 12 oz, Grande 16 oz, Extra 20 oz).
2. **¿Qué lleva?** Se agregan partes de tres tipos:
   - **Productos a elección del cliente:** cantidad (2 bebidas), de qué categorías puede elegir (Frappes, Iced, Calientes; se deja afuera Frozen con solo no marcarlo) y, si hace falta, productos sueltos.
   - **Una opción entre varias:** por ejemplo el complemento: 2 donas, 2 galletas, 1 dona + 1 galleta, carrot cake, keke, empanada, petit pan. Cada opción lleva uno o varios productos con su cantidad.
   - **Un producto fijo:** va siempre (Club Sándwich, papas).
3. **¿Cuándo vale?** Días, horas, fechas y canal (opcional). Fuera de ese tiempo el combo no aparece en la carta ni en Nuevo pedido.
4. Vista previa "Así lo ve el cliente", validaciones claras y confirmación Sí/No.
Al guardar, el combo aparece en la carta, en Nuevo pedido y en el chatbot, con la elección de cada bebida y de los sabores de dona o galleta.

## 3. Opciones y tamaños (frappés, iced, waffles, salados)
Productos > en cada producto, botón **Opciones y tamaños**. Un solo lugar, sin tablas sueltas:
- **Tamaños y precios** del producto: se agregan, se activan o se desactivan; un botón copia los tamaños a todos los productos de la categoría.
- **Grupos de opciones** (tipo de leche, endulzante, shots, extras, adicionales, cremas, acompañamiento): se crean y se editan ahí mismo. Cada grupo es obligatorio u opcional, de elegir una o varias (con un máximo), y tiene sus opciones con precio extra y botón Activa o Desactivada. Se puede agregar una opción nueva (por ejemplo una leche nueva o un tipo de azúcar).
- **Dónde se pregunta:** por producto (botón en cada grupo) y por categoría. Así "solo para los frappés" se resuelve marcando la categoría.
- Los cambios de un grupo valen para todos los productos que lo usan; se avisa. Nada se elimina: se desactiva.

## 4. Límites de esta versión
- Los datos se guardan en el navegador; en el sistema real irán a la base de datos.
- El chatbot tiene todavía una carta propia de ejemplo; en el sistema real leerá la misma carta que la web.
- Un combo no puede llevar productos que no estén en la carta (por ejemplo "nuggets"): Cajita Caprikids y la media docena siguen como productos simples.
- Falta definir el reparto del ingreso de un combo entre sus productos para los informes.
