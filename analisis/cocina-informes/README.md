---
id: ANA-CAP-022
tipo: analisis
titulo: "Revisión del rol Cocina y barra"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, cocina-informes]
---

# Revisión del rol Cocina y barra

Fecha: 18/10/2026. Tres informes de agentes de Antigravity sobre la v106: `kevin.md` (ideas de Kevin en las actas), `pantalla.md` (pantalla de Cocina y flujo del pedido) y `stock.md` (inventario, recetas, producción, mermas). Todo es propuesta; no se cambió el mockup. Los agentes citan números de línea de una copia: no confiar en ellos, buscar por texto.

## Verificado por mí contra el código (v106) y las actas
1. **El estado del pedido es uno solo para todas las áreas.** Si Bebidas marca "listo", el pedido completo pasa a listo aunque Salados no haya terminado (`kcol` usa `o.status` para todo el pedido).
2. **La columna LISTOS no tiene acción** para despejar; Kevin pidió "dar clic y despejar" (acta 02).
3. **Pantalla completa sin notas del cliente** (la vista normal sí las muestra).
4. **Ni la tarjeta ni la pantalla completa muestran el número de mesa** (solo "En mesa").
5. **Cada toque abre un cuadro Sí/No** (`ask`); Kevin pidió manos mojadas y un solo clic.
6. **Sin sonido de pedido nuevo.**
7. **Cocina no puede marcar un producto como agotado**: el interruptor está en Productos y el rol no lo ve (Kevin habló de la lúcuma que se acaba).
8. **Sin modo "Alta demanda"** (acta 02, 02:09: pausar el bot y subir el tiempo de entrega).
9. **Cocina no registra mermas, producción ni cierre del día** (`canMove` solo admin, almacén y producción).
10. **El minutero es manual** (botón "Simular +3 minutos").
11. **Sin requerimientos de Cocina a Almacén.**

## Por verificar antes de construir
Pérdida de opciones al repartir combos por área (existe `expandCombo`, que sí lee las líneas del combo); recetas por tamaño y productos sin receta (informe de stock: 25 de 64); reimpresión de tickets por Cocina; pantalla de turnos para los Smart TV del salón; pedidos programados.

## Construido (v107)
1. Estado por área: cada área avanza su parte; el pedido pasa a listo cuando todas terminan.
2. Un toque sin cuadro Sí/No, con barra Deshacer de 6 segundos.
3. Despejar en LISTOS; mesa y notas también en pantalla completa.
4. Se acabó algo: busca el producto y lo agota por hoy (vuelve solo mañana); la carta lo oculta.
5. Alta demanda: tiempo de entrega mayor en la carta y el chatbot, con pausa opcional del bot.
6. Sonido de pedido nuevo (activar o silenciar, probar).
7. Cocina registra mermas (con motivos de caída, error de comanda y calibración), cierra su estación y pide insumos al almacén, que los ve en Stock y su escritorio.

## Límites
- Nunca se abrió en navegador; probado con arnés. El sonido no se pudo oír y los navegadores lo bloquean hasta que la persona toque la pantalla una vez.
- El chatbot solo cambia su saludo; no hay pausa real del bot ni integración con WhatsApp.
- El minutero sigue siendo manual (botón de simulación). "Pedidos del salón" por Smart TV, recetas por tamaño y pedidos programados siguen pendientes.
- Un pedido ya aceptado no se vuelve a repartir por área si cambia el menú; el agotado no apaga combos que lo contengan.
