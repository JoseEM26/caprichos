# Diccionario de datos – Plantilla de Almacén

Archivo: `Plantilla-Almacen-Caprichos.xlsx` (se regenera con `cd apps/api && npx ts-node --transpile-only scripts/generar-plantilla-almacen.ts`).

Reglas generales: en cada hoja de datos la fila 1 es el título, la 2 los encabezados (celeste = obligatorio, gris = opcional; **no se cambian**), la 3 la ayuda y desde la 4 los datos. La columna A «¿Ejemplo?» dice «EJEMPLO – borrar» solo en las filas amarillas de ejemplo (inventadas); las filas con algo en A se ignoran al importar.
«Campo» = dónde vive hoy en el sistema; **NUEVO** = propuesto, hoy no existe.

## Reglas de negocio decididas (reflejadas en el LEEME)
- Hoy ningún producto tiene receta y el control de almacén está apagado: RECETAS y PRODUCTOS_CARTA se cargan desde cero para todos los platos.
- El consumo se descuenta siempre del stock de COCINA, al marcar Cocina «Listo»; nunca directo de Almacén.
- Si Cocina no alcanza, igual se vende y queda un «pendiente de emitir de Almacén»; lo emite el administrador o el rol Almacén.
- Al anular un pedido ya preparado se elige: «merma» o «nunca se preparó: devolver».

## Qué existe hoy y qué es nuevo (resumen)

| Tema | Existe hoy | Propuesto / nuevo |
|---|---|---|
| Insumo | nombre, unidad_compra, unidad_almacen, unidad_receta, factor_compra, factor_receta, minimo, intermedio, maximo, costo_unit, lugar_consumo, proveedor_a/b/c, activo | código, categoría, «¿costo incluye IGV?», «se controla stock», mínimo en cocina, perecible, vida útil, merma % |
| Lugar de stock | `lugar_stock` (tipo ALMACEN o AREA); stock por insumo y lugar | — (decisión: una sola cocina; lugares fijos «Almacén central» y «Cocina») |
| Proveedor | razón social, nombre comercial, RUC (11 dígitos), teléfono, contacto, días de crédito, cuenta de pago | qué vende, días de entrega |
| Receta | producto, tamaño, `es_produccion`, `rinde`, líneas (insumo + cantidad) | receta por sabor (NUEVO; otro agente lo agrega), equivalencias por insumo |
| Producto de carta | `controla_stock`, `vida_util_horas`, sabores, tamaños | stock mínimo terminado, tipo explícito (hoy se deduce de `es_produccion` de la receta) |
| Stock inicial / conteo | movimientos de stock, cierre del día con conteo, conteo de apertura de productos | carga masiva de stock inicial por insumo y lugar |

## LEEME
Instrucciones, colores, qué no tocar, glosario. No se importa.

## PROVEEDORES
| Columna | Qué es | Oblig. | Ejemplo | Campo | Para qué |
|---|---|---|---|---|---|
| Razón social | Nombre legal | Sí | Distribuidora Ejemplo S.A.C. | `razonSocial` | Identificar al proveedor en compras |
| Nombre comercial | Cómo lo llaman | No | Don Ejemplo | `nombreComercial` | Reconocerlo rápido |
| RUC | 11 dígitos | Sí | 00000000000 | `ruc` (11 dígitos) | Compras con factura; evita duplicados |
| Teléfono | Para pedir | No | 000000000 | `telefono` | Contacto |
| Persona de contacto | Con quién hablar | No | Persona Ejemplo | `contacto` | Contacto |
| Días de crédito | Plazo de pago | No | 7 | `diasCredito` (>=0) | Cuentas por pagar |
| Cuenta de pago | Dónde se le paga | No | Yape/banco | `cuentaPago` | Pagos |
| Qué nos vende | Resumen | No | Lácteos y huevos | NUEVO | Ordenar y filtrar |
| Días que demora en entregar | Tiempo de entrega | No | 2 | NUEVO | Calcular cuándo pedir |

## INSUMOS
| Columna | Qué es | Oblig. | Ejemplo | Campo | Para qué |
|---|---|---|---|---|---|
| Código sugerido | Sigla corta única | No | PAN-01 | NUEVO | Evitar confundir nombres parecidos |
| Nombre del insumo | Nombre exacto, único | Sí | Pan de molde | `insumo.nombre` (único) | Clave para recetas y stock |
| Categoría | Familia | No | Panadería y harinas | NUEVO | Reportes y orden |
| Unidad de compra | Como lo vende el proveedor | Sí | bolsa | `unidad_compra` | Órdenes de compra |
| Unidad de almacén | Con la que se cuenta (base) | Sí | unidad | `unidad_almacen` | El stock se lleva en esta unidad |
| Unidad de receta | La de las recetas | Sí | unidad / g / ml | `unidad_receta` | Descuento por receta |
| Unidades de almacén por 1 unidad de compra | Cuánto trae una de compra | Sí (>0) | 20 | `factor_compra` | Convertir compra a stock |
| Unidades de receta por 1 unidad de almacén | Cuánto hay en una de almacén | Sí (>0) | 400 (lechuga: 1 unidad = 400 g) | `factor_receta` | Convertir stock a receta |
| Proveedor habitual | Principal | No | Distribuidora Ejemplo | `proveedor_a` | Sugerir a quién pedir |
| Proveedor alterno | Segunda opción | No | — | `proveedor_b` (hay también `proveedor_c`, no se pide) | Plan B |
| Costo por unidad de compra (S/) | Precio de UNA unidad de compra tal como sale en la factura | No | 9.50 | `costo_unit` (el sistema lo guarda por unidad de almacén, sin IGV o con IGV según la casilla siguiente) | Costo de receta y margen |
| ¿Ese costo incluye IGV? | Sí = la factura ya trae IGV; No = el insumo no paga IGV (exonerado) o el precio es sin IGV. Obligatoria si hay costo | Condicional | Sí | NUEVO | El sistema calcula el otro valor con el IGV de compras (parámetro, 18 %, a confirmar por el contador; Kevin NO lo llena) |
| ¿Se controla el stock? | Sí/No | No | Sí | NUEVO | Excluir sal, agua, etc. |
| Stock mínimo en almacén | Nivel de alerta | Sí (>=0) | 10 | `minimo` | Aviso de compra |
| Stock máximo en almacén | Tope | Sí (>=0) | 40 | `maximo` | Cuánto pedir |
| Stock intermedio en almacén | Aviso «regular» | No | 20 | `intermedio` | Semáforo |
| Stock mínimo en cocina | Mínimo en cocina | No | 5 | NUEVO (hoy los niveles son únicos por insumo) | Pedido interno Almacén a Cocina |
| Lugar donde se usa | Destino habitual | No | Cocina | `lugar_consumo_id` | Traslados |
| ¿Es perecible? | Sí/No | No | Sí | NUEVO | Rotación |
| Vida útil (días) | Cuántos días dura | No | 4 | NUEVO | Alertas de vencimiento |
| Merma habitual (%) | Lo que se pierde al limpiar, pelar o cocinar. ÚNICO lugar donde se anota | No | 15 | NUEVO | El sistema descuenta cantidad ÷ (1 − merma) |
| Observaciones | Texto libre | No | — | NUEVO | Notas |

## EQUIVALENCIAS (todas las columnas son NUEVO)
| Columna | Qué es | Oblig. | Ejemplo |
|---|---|---|---|
| Insumo | Vacío = vale para todos | No | Huevo |
| De esta unidad | Unidad de partida | Sí | caja |
| Equivale a esta cantidad | Cuánto es | Sí (>0) | 30 |
| En esta unidad | Unidad de llegada | Sí | unidad |
| Nota | Texto | No | Solo para el huevo |

Para qué: validar y convertir unidades fuera de los dos factores del insumo (kg↔g, docena↔unidad…). Hoy el sistema solo tiene los dos factores por insumo.

## STOCK_INICIAL
| Columna | Qué es | Oblig. | Ejemplo | Campo | Para qué |
|---|---|---|---|---|---|
| Insumo | De INSUMOS | Sí | Pan de molde | `stock.insumo_id` | Punto de partida |
| Lugar | Almacén central o Cocina | Sí | Cocina | `stock.lugar_id` | Dos stocks separados |
| Cantidad contada | En unidad de almacén | Sí (>=0) | 8 | `stock.cantidad` | Stock inicial |
| Fecha del conteo | Día contado | Sí | 15/11/2026 | fecha del movimiento | Auditoría |
| Quién contó | Persona | Sí | Persona Ejemplo | `movimiento_stock.por` / nota | Responsable |
| Observaciones | Texto | No | — | `movimiento_stock.nota` | Contexto |

## RECETAS (todos los platos sobre pedido; hoy ninguno tiene receta)
| Columna | Qué es | Oblig. | Ejemplo | Campo | Para qué |
|---|---|---|---|---|---|
| Producto de la carta | Nombre exacto | Sí | Club sándwich | `receta.producto_id` | Dueño de la receta |
| Tamaño | Si cambia por tamaño | No | Grande | `receta.tamano_valor_id` | Receta por tamaño |
| Insumo | Ingrediente | Sí | Lechuga | `receta_linea.insumo_id` | Qué se descuenta |
| Cantidad por UNA unidad vendida | En unidad de receta | Sí (>0) | 40 | `receta_linea.cantidad` | Cuánto se descuenta de Cocina |
| Unidad | Debe ser la de receta del insumo | Sí | g | `insumo.unidad_receta` (verificación) | Evitar errores de unidad |
| Sabor | Solo si la receta cambia por sabor; vacío = vale para todos | No | — | NUEVO (ver arriba) | Platos sobre pedido con sabores |
| Observaciones | Texto | No | Tres rebanadas | NUEVO | Notas |

## PRODUCCION_TANDA (productos del día con stock)
| Columna | Qué es | Oblig. | Ejemplo | Campo | Para qué |
|---|---|---|---|---|---|
| Producto de la carta | Producción del día | Sí | Donas | `receta.producto_id` con `es_produccion = true` | Dueño |
| Sabor | Clave de la fila: una fila por insumo y por sabor. Vacío = vale para todos los sabores | No | Chocolate | NUEVO (hoy una receta por producto y tamaño; otro agente lo agrega) | Receta distinta por sabor |
| Insumo | Ingrediente de la tanda | Sí | Harina | `receta_linea.insumo_id` | Descuento por tanda |
| Cantidad por tanda | En unidad de receta | Sí (>0) | 1.2 (kg) | `receta_linea.cantidad` | Descuento |
| Unidad | Unidad de receta | Sí | kg | verificación | Evitar errores |
| Unidades que rinde la tanda | Piezas por tanda | Sí (>0) | 12 | `receta.rinde` | Alta del producto terminado |
| Tamaño de tanda habitual | Tandas por día | No | 2 | NUEVO | Sugerir producción |
| Vida del producto terminado (horas) | Vida útil | No | 24 | `producto.vida_util_horas` | Merma por vencimiento |
| Observaciones | Texto | No | Masa base | NUEVO | Notas |

## PRODUCTOS_CARTA
| Columna | Qué es | Oblig. | Ejemplo | Campo | Para qué |
|---|---|---|---|---|---|
| Producto de la carta | Nombre exacto | Sí | Club sándwich | `producto.nombre` | Clave de relación |
| Categoría de la carta | Familia | No | Sándwiches | `producto.categoria` | Referencia |
| Tipo | Sobre pedido / Producción del día | Sí | Sobre pedido | `receta.es_produccion` (se deduce hoy) | Decide cómo se descuenta |
| ¿Controla stock terminado? | Sí/No | No | Sí | `producto.controla_stock` | «Quedan N» |
| Stock mínimo terminado | Piezas mínimas | No | 6 | NUEVO | Aviso de producir |
| Vida útil (horas) | Vida | No | 24 | `producto.vida_util_horas` | Merma |
| ¿Tiene sabores? | Sí/No | No | Sí | existe `sabor` por producto | Producción por sabor |
| Observaciones | Texto | No | — | NUEVO | Notas |

## Decisiones del dueño (11/11/2026)
- Una sola cocina. Costo con o sin IGV a elegir por insumo (una columna de costo + «¿Ese costo incluye IGV?»).
- Una sola merma por insumo (solo en INSUMOS); las recetas llevan cantidad NETA y el sistema descuenta cantidad ÷ (1 − merma).
- La receta puede cambiar por sabor: la del sabor manda; si no existe, vale la general (sabor vacío).

## LISTAS
Valores de los desplegables: Unidades, Categorías de insumo (propuestas), Lugares de stock, Sí/No, Tipo de producto. Hay 20 filas libres por lista para agregar valores propios (las listas desplegables las incluyen).
