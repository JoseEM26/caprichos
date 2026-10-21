---
id: ANA-CAP-025
tipo: analisis
titulo: "INFORME DE AUDITORIA Y DIAGNOSTICO OPERATIVO: INVENTARIO, RECETAS Y STOCK EN EL ROL COCINA Y BARRA"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, cocina-informes]
---

# INFORME DE AUDITORIA Y DIAGNOSTICO OPERATIVO: INVENTARIO, RECETAS Y STOCK EN EL ROL COCINA Y BARRA

## 1. RESUMEN EJECUTIVO

El presente informe constituye la auditoria integral y tecnica de los flujos de inventario, gestion de recetas, produccion diaria, semaforos de stock, mermas, requerimientos, vencimientos y disponibilidad operativa (agotados) correspondientes al rol **Cocina y barra** (identificador en codigo `cocina`), contrastando la implementacion en el prototipo funcional (`fuente/Admin.dc.html`), los acuerdos y directivas comerciales de las actas de descubrimiento con el cliente Kevin Rosales (`fuente/acta-01-descubrimiento.md`, `fuente/acta-02-descubrimiento.md`, `fuente/iniciativas-acta-02.md`) y la arquitectura de referencia operativa de Restaurant.pe (`referencia/almacen.md`, `referencia/productos.md`, `referencia/escritorio.md`).

### Principales conclusiones de la auditoria

1. **Desconexion funcional entre la Pantalla de Cocina (KDS) y el inventario**: El personal en estacion (cocinero y barista) atiende comandas en pantalla, pero carece de herramientas para marcar un producto agotado, notificar una merma operativa o solicitar insumos a la bodega desde su puesto de trabajo.
2. **Deficiencias severas en el motor de descuento automatico (`usageOf`)**:
   - De 64 productos analizados en el catalogo general (`MCAT`), **25 productos carecen absolutamente de regla de descuento** (0% de insumos descontados al venderse).
   - El descuento **ignora por completo el tamano** del producto: una bebida de 12 oz, 16 oz o 21 oz descuenta exactamente la misma cantidad fija de insumos.
   - En combos y promociones, la funcion `acceptEffects` **elimina las opciones seleccionadas por el cliente** asignando `d: ''`, lo que provoca que cualquier personalizacion (como cambio de leche) se pierda y se descuente invariablemente leche entera.
   - Existen **asignaciones erroneas por expresiones regulares**: `ICED CHOCOLATE` (rotulado como sin cafe) descuenta cafe en grano; `CAFÉ AMERICANO` e `ICED COFFE` descuentan 0.2 L de leche entera; la hamburguesa `PARRILLERO` (200 g de carne de res) descuenta filete de pollo y pan de molde en lugar de carne y pan brioche.
   - Los **adicionales y extras con costo** (shots de espresso, huevo, tocino, queso dambo, bolas de helado, chantilly extra) no descargan inventario alguno.
3. **Bloqueo administrativo al rol Cocina (`canMove: false`)**: Las funciones operativas de registrar movimientos de almacen, asentar mermas, registrar produccion diaria y ejecutar el cierre del dia estan bloqueadas para el rol `cocina`, subordinandolo por completo a la presencia o accion del administrador o almacenero.
4. **Distorsion en el modulo de pedidos de insumos**: En lugar de permitir a Cocina generar Requerimientos Internos de reabastecimiento hacia el Almacen Central del local, la pantalla `Stock y recetas` ofrece ordenes de compra directas hacia proveedores externos via WhatsApp, una funcion ajena al cocinero de turno.
5. **Produccion diaria incompleta y sin escandallo**: Solo existe registro para "Donas (produccion del dia)". No se contemplan galletas, pizzas, masas ni bases de reposteria, y la entrada de donas no descuenta harina, azucar ni levadura.
6. **Lotes y vencimientos estaticos**: Los lotes con fecha de vencimiento creados en compras nunca se descargan con las ventas; permanecen congelados en el sistema sin rotacion FIFO/PEPS.

---

## 2. PANTALLA "STOCK Y RECETAS" (`isStock`)

### 2.1 Descripcion de la Interfaz y Capacidades en el Mockup
La vista `isStock` (lineas 809 a 867 de `fuente/Admin.dc.html`) es accesible para el rol `cocina` (configurado en `ROLES.cocina.views: ['escritorio', 'cocina', 'stock', 'notificaciones']`).

La interfaz se divide en dos secciones principales:
- **Panel izquierdo (Insumos)**: Presenta chips de filtrado (`stockChips`: 'Todos', 'Stock bajo', 'Regular', 'Suficiente'), un boton `+ Nuevo insumo` (`openNewIc`), un boton de accion masiva `Armar orden de compra con lo bajo` (`orderAll`), una condicional `<sc-if value="{{canMove}}">` con el boton `Cerrar el día (sobrantes a merma)` (`closeDay`), un selector de alertas por correo, y el listado de tarjetas de insumos de la constante `SUPPLIES`. Cada tarjeta exhibe una barra de porcentaje visual, cantidades actuales frente a minimos, medios y maximos, la terna de proveedores (A, B, C) y botones para ver "Ficha y unidades" o "Pedir por WhatsApp".
- **Panel derecho (Recetas)**: Muestra un recetario con pestanas horizontales (`recipeTabs`), el desglose de ingredientes por linea (`recipeLines`), el costo total calculado, precio de venta y margen comercial en porcentaje.

### 2.2 Hallazgos de la Pantalla "Stock y Recetas"

#### Hallazgo 1: Recetario decorativo desconectado de la logica de venta
- **CONFIRMADO en el codigo**: Lineas 2485 a 2489 (`const RECIPES = [...]`) y lineas 3928 a 3931 de `fuente/Admin.dc.html`. La constante `RECIPES` contiene unicamente tres recetas estaticas de muestra: `Frappe Oreo 16 oz`, `Capuccino 12 oz` y `Club Sandwich`. Al venderse un producto en caja o salon, el sistema no consulta este arreglo `RECIPES` para descontar inventario, sino una funcion separada y cableada llamada `usageOf`. Ademas, `RECIPES` contiene ingredientes ficticios que no existen en `SUPPLIES` (como "Hielo y jarabe", "Vaso y sorbete", "Pollo a la plancha 120 g", "Papas nativas 150 g").
- **Por que importa para una cafeteria**: El cocinero o barista que consulta la pantalla no puede ver las recetas reales de las mas de 60 opciones de la carta (como Frappe Choco Lucuma, Nutewaffle, Waffle Kiwiberry, o Croissant de Pollo). No sirve como manual operativo de preparacion ni garantiza estandarizacion de gramajes.
- **Prioridad**: Alta.

#### Hallazgo 2: Ocultamiento del Cierre del Dia para el rol Cocina
- **CONFIRMADO en el codigo**: Linea 815 (`<sc-if value="{{canMove}}" ...><button onClick="{{closeDay}}">Cerrar el día (sobrantes a merma)</button></sc-if>`) y linea 4231 (`const canMove = [ 'admin', 'almacen', 'produccion' ].indexOf(s.role) >= 0;`).
- **Por que importa para una cafeteria**: El personal de cocina y barra que culmina el turno nocturno es quien fisicamente contabiliza lo que sobro en vitrina o mesas de trabajo para darlo de baja o enviarlo a donacion. Al estar condicionado por `canMove`, el boton desaparece para el usuario con rol `cocina`. El cocinero queda imposibilitado de cerrar su estacion sin llamar a un administrador.
- **Prioridad**: Alta.

#### Hallazgo 3: Ordenes de compra externas en lugar de solicitud de suministros al almacen
- **CONFIRMADO en el codigo**: Lineas 3921 y 3925 a 3927 (`order: ask('¿Armar la orden de compra de ' + x.n + '?', ...)`, `orderAll = ask('¿Armar la orden de compra con todo lo que está bajo o regular?', ...)`).
- **Por que importa para una cafeteria**: Un cocinero o barista no emite ordenes de compra a distribuidores de lacteos o avicolas via WhatsApp personal; eso corresponde a Compras o Administracion. Lo que la barra necesita al ver stock bajo es un boton para generar un "Requerimiento interno" hacia el Almacen Central del negocio solicitando reposicion de cajas de leche o bolsas de cafe.
- **Prioridad**: Alta.

---

## 3. PRODUCCION DIARIA (DONAS, GALLETAS, PIZZAS, MASAS Y POSTRES)

### 3.1 Contraste entre el Mockup y las Declaraciones del Cliente
En el Acta 02 (iniciativas C-42 y D-02), Kevin Rosales especifico con claridad la dinamica del obrador:
> "Por las mañanas acude una encargada de producción que elabora postres, pan pullman, gelatinas y otros productos. Ella toma los insumos directamente del almacén físico, anota lo utilizado y, al finalizar su jornada diaria, debe ingresar al sistema tanto el consumo de insumos (salidas de almacén) como el inventario de productos terminados preparados (entradas de stock diario)."

En la arquitectura de Restaurant.pe (`referencia/almacen.md`, Seccion 8.2), esto corresponde exactamente a la **Modalidad 3: Descuento por Lote de Produccion Previa (`Modo de descargo = 0`)**, donde se corre una orden de preparacion que descuenta la materia prima cruda y da de alta el lote terminado.

### 3.2 Analisis del Prototipo en `Admin.dc.html`

#### Hallazgo 4: Registro exclusivo para donas y omision de otros productos del obrador
- **CONFIRMADO en el codigo**: Linea 2472 (`{ n: 'Donas (producción del día)', u: 'unidades', s: 24, min: 6, mid: 10, max: 30, p: 'int', vida: 1 }`) y linea 4248 (`openProd: () => openMov({ tipo: 'Entrada', insumo: 'Donas (producción del día)', origen: 'Producción', destino: 'Almacén central' })`).
- **Por que importa para una cafeteria**: En Caprichos no solo se producen donas. Se elaboran por lote: galletas de choco chips, masa de waffles, masa de pizzas/empanadas, panes pullman, gelatinas mosaico, queques marmoleados y carrot cakes. El sistema no tiene ningun mecanismo para dar de alta estas producciones matutinas; los productos terminados no existen como insumos intermedios en `SUPPLIES`.
- **Prioridad**: Alta.

#### Hallazgo 5: Entrada directa sin explosion de insumos crudos (escandallo ausente)
- **CONFIRMADO en el codigo**: Lineas 4238 a 4240 (`mvSave: const nv = Math.max(0, Math.round((cur + (SIGN[m.tipo] || 0) * q) * 100) / 100)`).
- **Por que importa para una cafeteria**: Al registrar una entrada de 24 donas mediante `openProd`, el sistema unicamente suma 24 al saldo de donas. No descuenta gramos de harina, azucar, manteca, levadura ni huevos del inventario. Esto destruye el balance de materias primas y obliga al personal a calcular y digitar manualmente salidas de insumo linea por linea, lo que en operacion real jamas se cumple por falta de tiempo.
- **Prioridad**: Alta.

#### Hallazgo 6: Inaccesibilidad total del registro de produccion para el rol Cocina
- **CONFIRMADO en el codigo**: Linea 1092 (`isAlmacenView`) y linea 2992 (`views` del rol `cocina`).
- **Por que importa para una cafeteria**: El boton `openProd` ("Registrar la produccion del dia") reside exclusivamente dentro de la vista `almacen`. El rol `cocina` no tiene acceso a dicha vista. Aunque el cocinero hornee donas o galletas en su turno, no tiene ninguna pantalla para asentar lo producido, dependiendo obligatoriamente de que un usuario con rol `produccion`, `almacen` o `admin` inicie sesion.
- **Prioridad**: Alta.

---

## 4. RECETAS Y DESCUENTO AUTOMATICO DE INSUMOS AL VENDER

### 4.1 Comportamiento del Codigo en Aceptacion de Pedidos
El descuento automatico se ejecuta en el metodo `acceptEffects(o)` (lineas 3081 a 3090):
```javascript
acceptEffects(o) {
  const used = {}; const lines = [];
  const ps = JSON.parse(JSON.stringify(this.state.psales));
  if (o) {
    o.items.forEach((it) => {
      const pr = findPromo(this.state.promos, it.n);
      if (pr) {
        const ex = expandPromo(pr, it, this.state.avail);
        const e = ps.promos[pr.n] || { u: 0, lines: {} };
        e.u += it.q;
        ex.forEach((x) => {
          lines.push({ n: x.n, q: x.q, d: '' }); // <-- ATENCION: d se borra
          e.lines[x.n] = (e.lines[x.n] || 0) + x.q;
          ps.prods[x.n] = (ps.prods[x.n] || 0) + x.q;
        });
        ps.promos[pr.n] = e;
      } else {
        lines.push(it);
        ps.prods[it.n] = (ps.prods[it.n] || 0) + it.q;
      }
    });
  }
  lines.forEach((it) => usageOf(it).forEach((u) => {
    used[u[0]] = (used[u[0]] || 0) + u[1];
  }));
  const stock = Object.assign({}, this.state.stock);
  const parts = [];
  Object.keys(used).forEach((k) => {
    const sp = SUPPLIES.find((x) => x.n === k);
    if (!sp) { return; }
    const cur = stock[k] !== undefined ? stock[k] : sp.s;
    stock[k] = Math.max(0, Math.round((cur - used[k]) * 100) / 100);
    parts.push(k + ' −' + qty1(used[k]) + ' ' + sp.u);
  });
  return { psales: ps, stock: stock, stockLog: ... };
}
```

La funcion `usageOf(it)` (lineas 2476 a 2484) determina el gasto de insumos:
```javascript
const usageOf = (it) => {
  const n = String(it.n).toUpperCase();
  const d = String(it.d || '').toLowerCase();
  const q = it.q;
  const u = [];
  const leche = d.indexOf('sin lactosa') >= 0 ? 'Leche sin lactosa' : (d.indexOf('almendra') >= 0 ? 'Bebida de almendra' : 'Leche entera');
  if (/DÚO/.test(n)) { u.push([leche, 0.5 * q], ['Galleta Oreo', 0.5 * q]); }
  else if (/FRAPPE/.test(n)) { u.push([leche, 0.25 * q], ['Galleta Oreo', /OREO/.test(n) ? 0.5 * q : 0], ['Crema chantilly', 0.05 * q], ['Pulpa de maracuyá', /MARACUY/.test(n) ? 0.2 * q : 0]); }
  else if (/CAPUCC|MOCACC|LATTE|CAFÉ|ICED|MACCHIATO/.test(n)) { u.push(['Café en grano', 0.018 * q], [leche, 0.2 * q]); }
  else if (/WAFFLE|NUTE/.test(n)) { u.push(['Nutella', /NUTE/.test(n) ? 0.05 * q : 0], ['Crema chantilly', 0.05 * q]); }
  else if (/DONA/.test(n)) { u.push(['Donas (producción del día)', q]); }
  else if (/SANDWICH|SÁNDWICH|CAPRISABROSO|PARRILLERO|SUPREMA/.test(n)) { u.push(['Pan de molde', 0.2 * q], ['Filete de pollo', 1 * q]); }
  return u.filter((x) => x[1] > 0);
};
```

### 4.2 Verificacion: ¿El stock realmente baja en Combos?
- **CONFIRMADO en el codigo**:
  1. **Combos reconocidos en `findPromo`**: Si el combo esta registrado en `COMBOS_DEF` (como `DÚO PARA COMPARTIR` o `DÚO IRRESISTIBLE`), `expandPromo` desglosa el combo en sus componentes individuales. Si un componente individual coincide con una expresion regular de `usageOf` (por ejemplo, si el combo incluye `FRAPPE OREO` o `CLUB SANDWICH`), **el stock de esos insumos especificos si disminuye**.
  2. **Perdida de opciones y tipo de leche en combos**: En la linea 3085, al hacer `lines.push({ n: x.n, q: x.q, d: '' })`, el codigo asigna explicitamente una cadena vacia a la descripcion `d`. En consecuencia, cuando `usageOf` evalua el tipo de leche mediante `d.indexOf('sin lactosa')` o `d.indexOf('almendra')`, la condicion siempre resulta falsa. Por tanto, **en cualquier combo con bebida, el sistema siempre descuenta Leche Entera, ignorando si el cliente pidio leche de almendras o sin lactosa**.
  3. **Combos no reconocidos que no descuentan nada**: El producto `COMBO CAJITA CAPRIKIDS` esta registrado en `MCAT` bajo la categoria `combos`, pero **no forma parte de `COMBOS_DEF`**. Al aceptarse un pedido con `COMBO CAJITA CAPRIKIDS`, `findPromo` devuelve `undefined`, y al evaluarse en `usageOf`, el nombre no coincide con ninguna expresion regular. **El stock no baja en lo absoluto (cero descuento de insumos)**.
  4. **Falla en el combo de docena de donas**: El producto `1/2 DOCENA DONUTS O GALLETAS` tiene la palabra `DONUTS`. La expresion regular en `usageOf` busca `/DONA/`. Debido a que `DONUTS` no contiene `DONA`, **no descuenta ninguna unidad de donas del stock**.
  5. **Complementos del combo sin receta**: Si en el `DÚO PARA COMPARTIR` el cliente elige como complemento `1 Carrot Cake`, `1 Keke Marmoleado`, `Empanada de jamón y queso` o `Bandeja de 4 Petit Pan`, ninguno de estos items tiene regla en `usageOf`. No descuentan inventario.

### 4.3 Verificacion: ¿El stock baja con Opciones, Tamanos y Extras?
- **CONFIRMADO en el codigo**:
  1. **Tamanos (12 oz, 16 oz, 21 oz)**: En `usageOf`, el multiplicador es exclusivamente `q` (cantidad de unidades). El codigo no examina si en `it.d` dice "Regular 12 oz", "Grande 16 oz" o "Extra 21 oz". Un Frappe de 21 oz descuenta exactamente 0.25 L de leche y 0.05 L de chantilly, exactamente lo mismo que uno de 12 oz. **El tamano no altera las cantidades descontadas**.
  2. **Adicionales y extras con recargo**: En `Admin.dc.html` existen grupos de modificadores como `SHOTS` (shots extra de espresso por s/ 2 o s/ 4), `TOPPINGS` (syrup de cacao, maracuya, fresa, bola de helado, chantilly), `SAL_EXTRA` (huevo adicional s/ 2, tocino s/ 2, jamon ingles s/ 1, queso dambo s/ 1.50, carne artesanal s/ 9.50, filete de pollo 90 g s/ 7.50) y `PAPAS` (papas nativas 350 g s/ 6). **Ninguno de estos extras es procesado por `usageOf`**. No se descuenta carne molida, papas, huevos ni cafe adicional al cobrar extras.

### 4.4 Verificacion: Productos Sin Receta en el Catalogo
Al ejecutar la evaluacion de `usageOf` contra los 64 productos definidos mediante `mk(...)` en `MCAT`, se confirma que **25 productos (el 39% de la carta) no tienen ninguna regla de receta ni descuentan insumo alguno**:

| Categoria | Producto sin receta | Insumos reales que deberia descontar |
| :--- | :--- | :--- |
| `combos` | `COMBO CAJITA CAPRIKIDS` | Frappe (leche, cafe/cacao), nuggets, papas nativas, juguetes |
| `combos` | `1/2 DOCENA DONUTS O GALLETAS` | 6 Donas artesanales o 6 Galletas choco chips |
| `iced` | `ICE BERRY` | Mermelada artesanal de frutos rojos, leche entera, hielo |
| `frozen` | `FROZEN LIMONADA` | Limon fresco, jarabe/azucar, hielo, hierbabuena |
| `frozen` | `FROZEN MARACUYÁ` | Pulpa de maracuya, limon, jarabe/azucar, hielo |
| `frozen` | `FROZEN STRAWBERRY` | Fresas frescas, limon, jarabe/azucar, hielo, hierbabuena |
| `calientes` | `CAPRIBERRY VAINILLA` | Cafe en grano, leche entera, jarabe de frutos rojos, vainilla |
| `calientes` | `SALTAMEL BROWNIE` | Cafe en grano, leche entera, salsa caramelo salado, trozos de brownie |
| `calientes` | `CHOCONUBE` | Cacao 100%, leche entera, crema de leche, marshmallows |
| `calientes` | `CHOCOLATE CALIENTE` | Cacao 100% puro, leche entera, syrup de almendra |
| `salados` | `PAPAS NATIVAS` | Papas nativas (350 g), aceite para freir, sal |
| `salados` | `PETIT PAN RELLENO DE POLLO` | Panes petit pan (4 und), pechuga deshilachada, salsa casera |
| `salados` | `EMPANADA ARTESANAL` | Masa hojaldrada, relleno (pollo, jamon/queso con bechamel, o carne) |
| `croissants` | `CROISSANT DE POLLO Y FRUTOS SECOS` | Croissant hojaldrado, pollo deshilachado, frutos secos |
| `croissants` | `CROISSANT DE JAMÓN Y QUESO` | Croissant hojaldrado, jamon ingles, queso dambo |
| `croissants` | `CROISSANT DE CACAO` | Croissant hojaldrado, relleno artesanal de cacao |
| `complementos` | `GALLETA CHOCO CHIPS` | Harina, mantequilla, azucar, chispas de chocolate (o unidad elaborada) |
| `complementos` | `CARROT CAKE` | Tajada de queque de zanahoria, frosting de queso crema |
| `complementos` | `MARMOLEADO CHIPS` | Tajada de queque marmoleado, cobertura de chocolate |
| `complementos` | `ENTREMETS Y TARTALETA` | Base de tarta, crema pastelera, fruta fresca |
| `complementos` | `GELATINA MOSAICO` | Gelatina en cubos, crema de leche/leche condensada, vaso 12 oz |
| `complementos` | `CREMA VOLTEADA` | Tajada de crema volteada, caramelo liquido |
| `complementos` | `TORTA DE CHOCOLATE` | Tajada de bizcocho de chocolate, fudge de cacao artesanal |
| `complementos` | `TARTALETA MIX DE FRUTAS` | Masa quebrada, crema pastelera, mix de frutas de estacion |
| `complementos` | `PIE DE LIMÓN` | Masa quebrada, crema de limon y leche condensada, merengue |

### 4.5 Hallazgos de Recetas y Descuentos

#### Hallazgo 7: Asignacion aberrante de insumos por coincidencias parciales de texto
- **CONFIRMADO en el codigo**: Lineas 2480 y 2483 de `fuente/Admin.dc.html`.
  - La regex `/CAPUCC|MOCACC|LATTE|CAFÉ|ICED|MACCHIATO/` aplica a `ICED CHOCOLATE`, descontando 0.018 kg de cafe en grano a pesar de que la carta especifica: *"No contiene café"*.
  - La misma regex aplica a `CAFÉ AMERICANO` e `ICED COFFE`, descontando 0.2 L de leche entera a bebidas que solo llevan agua, espresso y hielo.
  - La regex `/SANDWICH|SÁNDWICH|CAPRISABROSO|PARRILLERO|SUPREMA/` aplica a `PARRILLERO`, descontando 1 filete de pechuga de pollo y 0.2 bolsa de pan de molde a un plato que en carta lleva 200 g de carne de res artesanal, tocino, huevo y pan artesanal.
- **Por que importa para una cafeteria**: Genera descuadres inmediatos entre el inventario logico y el inventario real. El sistema inflara faltantes de leche y pollo mientras que el cafe, la carne de res y los panes de hamburguesa jamas se descontaran, arruinando los reportes de mermas y rentabilidad.
- **Prioridad**: Alta.

#### Hallazgo 8: Catalogo de insumos insuficiente frente a la carta de productos
- **CONFIRMADO en el codigo**: Arreglo `SUPPLIES` (lineas 2467 a 2473) solo contiene 11 insumos. No existen insumos criticos como: carne de res molida/hamburguesas, huevos, queso edam/dambo, jamon ingles, tocino, harina, azucar, cacao en polvo, mantequilla, papas nativas, verduras frescas (lechuga, tomate, limon), ni descartables (vasos 12, 16, 21 oz, tapas, sorbetes, bolsas kraft).
- **Por que importa para una cafeteria**: Una cafeteria de especialidad no puede controlar costos ni mermas si el 80% de sus insumos fisicos no estan modelados en la base de datos de inventario.
- **Prioridad**: Alta.

---

## 5. SEMAFORO DE STOCK Y PARAMETROS OPERATIVOS

### 5.1 Logica de Calculo en el Mockup
En el Acta 02 (iniciativa D-28), Kevin Rosales solicito:
> "Definir para cada insumo umbrales de stock mínimo, stock intermedio y stock máximo, activando un indicador semafórico visual: color verde cuando hay stock suficiente, naranja para stock regular o medio, y rojo para stock bajo crítico."

En el codigo (lineas 3914 y 3915):
```javascript
const LV = {
  rojo: { l: 'STOCK BAJO', c: '#C73E2A' },
  naranja: { l: 'REGULAR', c: '#C98A1B' },
  verde: { l: 'SUFICIENTE', c: '#2F9E57' }
};
const lvOf = (x) => {
  const v = stockOf(x);
  return v < x.min ? 'rojo' : (v < x.mid ? 'naranja' : 'verde');
};
```

### 5.2 Hallazgos del Semaforo de Stock

#### Hallazgo 9: Semaforo global sin discriminacion de stock en estacion de barra
- **CONFIRMADO en el codigo**: `stockOf(x)` consulta directamente el saldo total del insumo en `s.stock[x.n]`.
- **Por que importa para una cafeteria**: En la operacion diaria, el barista necesita saber cuanta leche o cafe tiene disponible en la repisa de barra (stock de estacion), independientemente de que en el almacen central cerrado con llave existan 50 litros mas. Si el semaforo marca verde porque hay stock en almacen pero en barra queda 1 litro, la barra colapsa en plena hora punta.
- **Prioridad**: Media.

#### Hallazgo 10: Parametros de umbrales editables pero sin validacion jerarquica
- **CONFIRMADO en el codigo**: En `ficha` (`icSave`, lineas 3662 a 3670), el usuario puede editar `min`, `mid` y `max`. Sin embargo, no hay validacion que exija que `min < mid < max`. Un error de digitacion (por ejemplo, fijar `min: 15` y `mid: 10`) altera la coherencia de los colores del semaforo.
- **Por que importa para una cafeteria**: Una barra desatendida podria mostrar estado suficiente cuando en realidad esta en estado critico.
- **Prioridad**: Baja.

---

## 6. MERMAS Y REGISTRO DE DESPERDICIOS

### 6.1 Tratamiento de Mermas en el Sistema
En el Acta 02 (iniciativas D-04 y D-17), Kevin Rosales explico su politica de mermas:
- Las donas y perecibles no vendidos al final del turno son merma comercial; Kevin decide si se regalan o donan, pero nunca se tiran a la basura.
- Los insumos preparados que sobran en mesas refrigeradas de cocina (mise en place) se guardan para el dia siguiente; solo si se deterioran o vencen se registran como merma formal.

En Restaurant.pe (`referencia/almacen.md`, Seccion 7.3), la pantalla `#!/almacen/merma` exige:
- Fecha, Almacen de salida, Insumo/Producto, Cantidad mermada, Motivo de merma (Vencido, Caido, Mal estado, Merma de elaboracion) y Costo estimado imputado.

### 6.2 Hallazgos en el Mockup

#### Hallazgo 11: Imposibilidad de Cocina para asentar mermas del turno
- **CONFIRMADO en el codigo**: El formulario de registro de merma solo se abre mediante `openMov({ tipo: 'Merma' })` (linea 4236), el cual reside en `isAlmacenView` (linea 1092) y esta protegido por `canMove`.
- **Por que importa para una cafeteria**: Durante el servicio ocurren accidentes rutinarios: se quema una jarra de leche al vaporizar, se cae un waffle al emplatar, o se detecta fruta descompuesta. Si el personal de cocina y barra no tiene un boton directo de "Registrar merma" en su propia pantalla, la merma jamas se registra, distorsionando el inventario teorico y ocultando perdidas economicas.
- **Prioridad**: Alta.

#### Hallazgo 12: Tipificacion de motivos de merma incompleta
- **CONFIRMADO en el codigo**: Linea 4249 (`mvMotivos: mvChips('motivo', [ 'Donación', 'Personal', 'Desecho' ])`).
- **Por que importa para una cafeteria**: Falta tipificar las causas operativas reales de una cafeteria: "Error de comanda", "Caida/Accidente en preparacion", "Caducidad/Vencimiento", "Calibracion de molino de cafe" y "Prueba de calidad". Clasificar todo como simple desecho o donacion no permite a gerencia identificar si las perdidas son por fallas del equipo de baristas o por calidad de compra.
- **Prioridad**: Media.

---

## 7. PEDIR INSUMOS AL ALMACEN (REQUERIMIENTOS INTERNOS)

### 7.1 La Brecha entre el Mockup y la Operacion Real
En Restaurant.pe (`referencia/almacen.md`, Seccion 3), el flujo fundamental de abastecimiento de cocina es la pantalla de **Requerimiento**:
1. Cocina o Barra selecciona una plantilla (ej. "Requerimiento diario de barra").
2. Especifica la fecha y hora de necesidad.
3. Ajusta las cantidades solicitadas de insumos crudos y descartables.
4. Envia el requerimiento, el cual viaja a la cola de atencion del Almacenero.
5. El Almacenero despacha y Cocina recibe dando conformidad.

### 7.2 Hallazgos en el Mockup

#### Hallazgo 13: Inexistencia absoluta del modulo de Requerimientos Internos
- **CONFIRMADO en el codigo**: No existe ninguna funcion, plantilla ni vista de `requerimiento` en `Admin.dc.html`.
- **Por que importa para una cafeteria**: El prototipo asume erroneamente que Cocina debe abastecerse pidiendo directamente a proveedores comerciales por WhatsApp (`order: ask('¿Armar la orden de compra...?')`). En una estructura organizada donde hay un encargado de stock (como confirmo Kevin en el Acta 01: *"Roles y áreas mencionados: cajero/a, meseros, cocina, almacenero - hay un encargado de stock"*), la cocina debe pedir formalmente al almacen interno para que haya trazabilidad y no se generen pedidos duplicados hacia la calle.
- **Prioridad**: Alta.

---

## 8. AGOTADO DE UN PRODUCTO DESDE LA COCINA (CARTA Y BOT)

### 8.1 Requerimiento del Negocio
En el Acta 02 (iniciativa B-30), Kevin indico:
> "Trabajan con pulpa de fruta fresca procesada diariamente (por ejemplo, lúcuma fresca para el batido Chocolúcuma). Si en un día se agota la fruta, ese producto debe inhabilitarse de inmediato en la carta web y sincronizarse en tiempo real con el bot de WhatsApp, ofreciendo alternativas o recomendaciones al comensal para concretar la venta."

En Restaurant.pe (`referencia/productos.md`, Seccion 6 y Seccion 9.A), existe el modal `modalSelectorModoProductoAgotado.html` que permite agotar una presentacion con tres politicas temporales: "Agotarlo solo por hoy", "Por una semana" o "Indefinido".

### 8.2 Hallazgos en el Mockup

#### Hallazgo 14: El rol Cocina no puede marcar productos agotados
- **CONFIRMADO en el codigo**: El toggle de disponibilidad `p.toggle` (linea 3753) se renderiza exclusivamente en la vista `productos` (linea 792: `<button onClick="{{p.toggle}}">`). En la definicion de roles (linea 2992), el rol `cocina` tiene asignadas las vistas `['escritorio', 'cocina', 'stock', 'notificaciones']`. **No tiene acceso a la vista `productos`**.
- **Por que importa para una cafeteria**: Si al cocinero se le acaban las donas, o al barista se le termina la lúcuma o la leche de almendras a las 5:00 PM, no puede desactivar el producto desde su Pantalla de Cocina ni desde su Escritorio. Debe dejar de cocinar, buscar al mozo o al cajero y pedirle que entre a la administracion de la carta para apagarlo. Si no lo hace de inmediato, siguen entrando pedidos pagados por WhatsApp Bot o comensales de sala pidiendo platos inexistentes.
- **Prioridad**: Alta.

#### Hallazgo 15: Ausencia de temporizador de reactivacion automatica (agotado inteligente)
- **CONFIRMADO en el codigo**: El toggle en linea 3753 invoca: `this.setState({ avail: Object.assign({}, s.avail, { [p.n]: off }) })`. Es un booleano permanente que no guarda fecha de expiracion.
- **Por que importa para una cafeteria**: Si la lúcuma se marco como agotada el martes por la noche, el miercoles por la manana cuando ingresa pulpa fresca el producto sigue figurando como "AGOTADO" en la carta web y en el bot hasta que alguien recuerde reactivarlo manualmente. Restaurant.pe resuelve esto con la opcion "Agotarlo solo por hoy" (se reactiva solo al abrir turno matutino).
- **Prioridad**: Media.

#### Hallazgo 16: Falta de apagado en cascada por quiebre de insumo base
- **CONFIRMADO en el codigo**: No existe conexion entre `s.stock` y `s.avail`.
- **Por que importa para una cafeteria**: Si el stock de "Donas (produccion del dia)" llega a 0 por ventas o merma, el sistema deberia inhabilitar automaticamente el producto "DONAS ARTESANALES" en carta y en el bot, o al menos lanzar una alerta en pantalla avisando al barista. En el prototipo actual, el stock puede llegar a cero o valores negativos y el producto sigue figurando como disponible para la venta.
- **Prioridad**: Alta.

---

## 9. CIERRE DEL DIA Y SOBRANTES A MERMA

### 9.1 Funcionamiento en el Mockup
La funcion `closeDay` (lineas 4241 a 4244 de `Admin.dc.html`) opera de la siguiente manera:
```javascript
const closeDay = ask(
  '¿Cerrar el día?',
  'Lo que sobra de los productos que duran un día (por ejemplo las donas) pasa a merma y el stock queda en cero. Se registra el movimiento.',
  () => {
    const st = Object.assign({}, this.state.stock);
    let rows = [];
    const logs = [];
    SUPPLIES.filter((x) => x.vida).forEach((x) => {
      const v = st[x.n] !== undefined ? st[x.n] : x.s;
      if (v > 0) {
        rows.push([ '15/10', 'Merma', x.n, qty1(v) + ' ' + x.u, 'Producción', 'Merma · Donación', 'MER-' + String(100 + this.state.movAdded.length + rows.length) ]);
        logs.push('Cierre del día: ' + x.n + ' −' + qty1(v) + ' ' + x.u + ' pasó a merma');
        st[x.n] = 0;
      }
    });
    if (!rows.length) { return; }
    this.setState({ movAdded: rows.reverse().concat(this.state.movAdded), ... , stock: st, stockLog: logs.concat(this.state.stockLog).slice(0, 6) });
  }
);
```

### 9.2 Hallazgos del Cierre del Dia

#### Hallazgo 17: El cierre solo contempla Donas y omite el resto de perecibles
- **CONFIRMADO en el codigo**: `SUPPLIES.filter((x) => x.vida)` unicamente encuentra un insumo en todo el sistema: `Donas (producción del día)` (linea 2472).
- **Por que importa para una cafeteria**: Al final de la jornada sobran otros productos con vida util de 12 a 24 horas: galletas horneadas, porciones de torta fresca, jarras de leche pasteurizada abiertas, vasos de gelatina preparados y los filetes de pollo cocidos del mise en place que Kevin menciono en el Acta 02 (iniciativa D-10). Ninguno de ellos pasa a merma ni se resetea a cero en el cierre de turno.
- **Prioridad**: Alta.

#### Hallazgo 18: Destino de merma cableado sin opcion de decision gerencial
- **CONFIRMADO en el codigo**: En linea 4242 se hardcodea `'Merma · Donación'`.
- **Por que importa para una cafeteria**: Como explico Kevin (Acta 02, D-04), el destino de lo que sobra lo decide el personalmente segun el estado fisico del alimento (donacion a familiares, consumo del personal o descarte). El sistema no permite elegir el destino ni documentar observaciones.
- **Prioridad**: Baja.

---

## 10. VENCIMIENTOS Y CONTROL DE LOTES

### 10.1 Mecanica de Lotes en el Mockup
En el prototipo, los lotes se registran exclusivamente al asentar una recepcion de compra de insumos perecibles (linea 3629: `if (l.venc) { (ic2.lotes[x.n] = ic2.lotes[x.n] || []).push({ lote: l.lote || id, venc: l.venc, q: qty, compra: id }); }`).

En la tarjeta de insumo de `Stock y recetas` (linea 3918):
`const lt = (s.insu.lotes || {})[x.n] || []; const nv = lt.map((z) => z.venc).filter(Boolean).sort()[0];`
Se muestra: `Próximo vencimiento: DD/MM/AAAA`.

### 10.2 Hallazgos de Vencimientos

#### Hallazgo 19: Lotes estaticos desacoplados del consumo por ventas (ausencia de FIFO)
- **CONFIRMADO en el codigo**: En `acceptEffects` (lineas 3081 a 3090), las ventas descuentan unidades unicamente de `this.state.stock[k]`. El arreglo de lotes `s.insu.lotes` **no se modifica jamas durante las ventas**.
- **Por que importa para una cafeteria**: Si se compraron 20 litros de leche con vencimiento al 18/10 y se vendieron 15 litros, el lote sigue registrando 20 litros. Aun cuando toda la leche de ese lote haya sido consumida por completo, la fecha de vencimiento seguira mostrandose como alerta en la tarjeta de inventario, perdiendo toda credibilidad operativa.
- **Prioridad**: Alta.

#### Hallazgo 20: Cero control de vida util secundaria en cocina (rotulado de mise en place)
- **CONFIRMADO en el codigo**: No existe ninguna funcionalidad para registrar la fecha y hora de apertura o transformacion de insumos (ej. salsa de carne abierta que dura 3 dias refrigerada, pulpa de fruta descongelada que dura 24 horas, o leche abierta en barra).
- **Por que importa para una cafeteria**: Las inspecciones sanitarias (DIGESA/Municipalidad) y la inocuidad alimentaria exigen rotular la fecha de caducidad secundaria del mise en place en barra y cocina. Restaurant.pe lo soporta mediante sub-recetas y kárdex por almacen.
- **Prioridad**: Media.

---

## 11. QUE LE FALTA AL ROL COCINA Y BARRA PARA NO DEPENDER DEL ALMACENERO

Actualmente, el rol `Cocina y barra` en `Admin.dc.html` es un rol pasivo y subordinado que depende completamente del almacenero o del administrador para casi cualquier contingencia de inventario.

Para lograr una **operacion autonoma y eficiente en cocina**, se requiere implementar las siguientes siete capacidades directas en el rol `cocina`:

### 1. Modulo de Requerimientos Internos de Turno
- **Problema actual**: Cocina solo tiene un boton que manda un WhatsApp a proveedores externos. No puede pedir nada al almacen interno.
- **Solucion necesaria**: Una vista o modal dentro de Cocina con **plantillas de solicitud interna** (ej. "Apertura de Barra", "Reposicion de Tarde"). El barista marca: 6 litros de leche, 2 kg de cafe, 1 bolsa de pan; pulsa "Enviar requerimiento al Almacen", notificando de inmediato a la pantalla del almacenero.

### 2. Boton de "Agotar Insumo / Producto" directo en la Pantalla de Cocina (KDS)
- **Problema actual**: El toggle esta en el modulo `productos`, al que Cocina no tiene acceso.
- **Solucion necesaria**: En la cabecera de la Pantalla de Cocina (KDS), anadir un boton rapido `Gestionar Disponibilidad / Agotados`. Al abrirlo, el cocinero selecciona con un toque el producto o ingrediente faltante (ej. "Lucuma"), eligiendo "Agotar por hoy". Inmediatamente el sistema lo oculta de la Carta Web y del Chatbot de WhatsApp.

### 3. Registro Express de Mermas Operativas
- **Problema actual**: El registro de mermas esta bloqueado por `canMove: false` y ubicado dentro de la vista `almacen`.
- **Solucion necesaria**: Permitir al rol `cocina` registrar mermas operativas desde su propia estacion indicando: Insumo, Cantidad y Motivo estandarizado (Leche cortada, Caida de plato, Error de comanda, Merma de calibracion).

### 4. Registro de Produccion Matutina y Mise en Place
- **Problema actual**: El cocinero u horneador que hace donas, galletas o pizzas no puede asentar su lote porque `openProd` no le aparece.
- **Solucion necesaria**: Habilitar en Cocina el registro de lotes de elaboracion para: Donas, Galletas, Masas de waffle/pizza, Pan pullman y Postres del dia. Al dar de alta el lote, el sistema debe descontar automaticamente los insumos crudos correspondientes mediante la receta base.

### 5. Cierre de Estacion y Arqueo de Insumos Perecibles
- **Problema actual**: `closeDay` esta oculto para `cocina` y solo procesa donas.
- **Solucion necesaria**: Permitir al jefe de cocina ejecutar el cierre de turno seleccionando los insumos perecibles sobrantes en sus mesas frias (donas, postres, filetes de pollo cocidos) para definir su destino (Pasa a merma donacion, Se guarda en frio para apertura con prioridad, o Desecho).

### 6. Sub-Almacen Logico de Estacion (Barra / Cocina)
- **Problema actual**: Todo el inventario se muestra en un unico saco comun. No se sabe si el insumo esta en el estante de bodega o en la refrigeradora de barra.
- **Solucion necesaria**: Adoptar la estructura de Restaurant.pe (`referencia/almacen.md`, Seccion 7.1) con almacenes fisicos diferenciados (*Almacen Central* vs *Cocina/Barra*). Las ventas en comanda deben descargar del stock de *Cocina/Barra*; los Requerimientos Internos transfieren del *Almacen Central* a *Cocina/Barra*.

### 7. Recetario Digital Operativo
- **Problema actual**: Solo hay 3 recetas decorativas en pantalla.
- **Solucion necesaria**: Vincular el recetario de la pantalla de cocina a la base real de fichas tecnicas, permitiendo al barista consultar dosificaciones exactas (gramajes de cafe, mililitros de leche, bombas de jarabe) para cada tamano (12, 16, 21 oz).

---

## 12. TABLA RESUMEN DE HALLAZGOS Y PRIORIDADES

| Codigo | Componente / Area | Tipo | Ubicacion en Codigo / Documento | Descripcion del Hallazgo | Prioridad |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **HAL-01** | Stock y Recetas | CONFIRMADO | `Admin.dc.html`: 2485, 3928 | Recetario estatico de 3 items desconectado del motor de ventas y con ingredientes ficticios. | **Alta** |
| **HAL-02** | Stock y Recetas | CONFIRMADO | `Admin.dc.html`: 815, 4231 | Cierre del dia bloqueado al rol `cocina` por condicion `canMove: false`. | **Alta** |
| **HAL-03** | Stock y Recetas | CONFIRMADO | `Admin.dc.html`: 3921, 3925 | Pantalla ofrece ordenes de compra externas por WhatsApp en vez de requerimientos internos al almacen. | **Alta** |
| **HAL-04** | Produccion diaria | CONFIRMADO | `Admin.dc.html`: 2472, 4248 | Solo se contempla produccion de donas; omitidas galletas, pizzas, masas y postres. | **Alta** |
| **HAL-05** | Produccion diaria | CONFIRMADO | `Admin.dc.html`: 4238 | Entrada de lote terminado no descuenta materias primas crudas (falta escandallo). | **Alta** |
| **HAL-06** | Produccion diaria | CONFIRMADO | `Admin.dc.html`: 1092, 2992 | Boton de registrar produccion inaccesible para el rol `cocina` (restringido a vista almacen). | **Alta** |
| **HAL-07** | Descuento en ventas | CONFIRMADO | `Admin.dc.html`: 3085 | En combos, `acceptEffects` borra opciones (`d: ''`), ignorando tipos de leche especiales. | **Alta** |
| **HAL-08** | Descuento en ventas | CONFIRMADO | `Admin.dc.html`: 2476, 2625 | `COMBO CAJITA CAPRIKIDS` y `1/2 DOCENA DONUTS` no descuentan ningun insumo al venderse. | **Alta** |
| **HAL-09** | Descuento en ventas | CONFIRMADO | `Admin.dc.html`: 2476-2484 | El tamano de presentacion (12, 16, 21 oz) no altera la cantidad de insumos descontados. | **Alta** |
| **HAL-10** | Descuento en ventas | CONFIRMADO | `Admin.dc.html`: 2476-2484 | Modificadores y adicionales con costo (shots, huevo, tocino, helado) no descargan stock. | **Alta** |
| **HAL-11** | Descuento en ventas | CONFIRMADO | `Admin.dc.html`: 2476-2484 | 25 de 64 productos del catalogo (39%) carecen de receta y no descuentan nada. | **Alta** |
| **HAL-12** | Descuento en ventas | CONFIRMADO | `Admin.dc.html`: 2480, 2483 | Reglas regex causan descuentos aberrantes (cafe en chocolate frio, leche en americano, pollo en res). | **Alta** |
| **HAL-13** | Maestro de insumos | CONFIRMADO | `Admin.dc.html`: 2467-2473 | Solo 11 insumos modelados en `SUPPLIES`, ignorando carnes, quesos, verduras y descartables. | **Alta** |
| **HAL-14** | Semaforo de stock | CONFIRMADO | `Admin.dc.html`: 3915 | Semaforo solo mide stock global del local; no mide existencias fisicas en estacion de barra. | **Media** |
| **HAL-15** | Mermas de turno | CONFIRMADO | `Admin.dc.html`: 1092, 4231 | Registro de merma bloqueado para el rol `cocina` por permisos y ubicacion en vista almacen. | **Alta** |
| **HAL-16** | Mermas de turno | CONFIRMADO | `Admin.dc.html`: 4249 | Motivos de merma limitados (Donacion, Personal, Desecho); faltan caidas, comanda y calibracion. | **Media** |
| **HAL-17** | Requerimientos | CONFIRMADO | `Admin.dc.html`: global | Inexistencia de pantalla o flujo de Requerimientos Internos entre Cocina y Almacen. | **Alta** |
| **HAL-18** | Agotado de productos | CONFIRMADO | `Admin.dc.html`: 792, 2992 | Boton de marcar agotado reservado a vista `productos`, inaccesible para Cocina y Barra. | **Alta** |
| **HAL-19** | Agotado de productos | CONFIRMADO | `Admin.dc.html`: 3753 | Agotado es un interruptor manual indefinido; falta la opcion de Restaurant.pe "Agotar solo por hoy". | **Media** |
| **HAL-20** | Agotado de productos | SUPOSICION | `referencia/almacen.md`: 540 | Ausencia de desactivacion en cascada cuando el stock de un ingrediente base llega a cero. | **Alta** |
| **HAL-21** | Cierre del dia | CONFIRMADO | `Admin.dc.html`: 2472, 4242 | `closeDay` unicamente resetea donas; omite galletas, cremas, pulpas y pollo del mise en place. | **Alta** |
| **HAL-22** | Control de lotes | CONFIRMADO | `Admin.dc.html`: 3081, 3629 | Ventas no descuentan de los lotes comprados; las fechas de vencimiento se vuelven estaticas. | **Alta** |
| **HAL-23** | Inocuidad y fechas | SUPOSICION | `referencia/almacen.md`: 535 | Falta de control y rotulado de vida util secundaria en preparaciones internas de cocina. | **Media** |

INFORME LISTO.
