---
id: HU-CAP-002
tipo: hu
titulo: "Armar un producto con tamaño y opciones"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-001, FT-CAR-01, RQ-CAR-01-05, RQ-CAR-01-06, RQ-CAR-01-07, RQ-CAR-01-08, RQ-CAR-01-09, HU-CAP-001, HU-CAP-003, HU-CAP-004, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, DEP-02, DEP-05, DEP-06, R-01, R-03]
tags: [hu, carta, capa-a, ft-car-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-002 | Título | Armar un producto con tamaño y opciones |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-001 · FT-CAR-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | armar un producto con tamaño y opciones | pedir mi bebida exactamente como me gusta y saber cuánto pagaré |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAR-01 «Catálogo por categorías con tamaños y opciones» (Debe tener, épica EP-CAP-001). Cubre los requerimientos: **RQ-CAR-01-05** La ficha del producto muestra foto cuadrada ampliable, descripción, tamaños y grupos de opciones. **RQ-CAR-01-06** Cada grupo de opciones aplica su obligatoriedad, mínimo y máximo. **RQ-CAR-01-07** El precio de la ficha se recalcula en vivo con tamaño, opciones con precio extra y cantidad. **RQ-CAR-01-08** Los toppings secos cuestan S/ 1 y los frappés muestran el aviso de hielo. **RQ-CAR-01-09** En las bebidas se pide «Ingresa el nombre de la persona que tomará esta bebida», uno por cada unidad, con una imagen de referencia. | **Alcance.**<br>• La ficha del producto muestra foto cuadrada ampliable, descripción, tamaños y grupos de opciones.<br>• Cada grupo de opciones aplica su obligatoriedad, mínimo y máximo.<br>• El precio de la ficha se recalcula en vivo con tamaño, opciones con precio extra y cantidad.<br>• Los toppings secos cuestan S/ 1 y los frappés muestran el aviso de hielo.<br>• En las bebidas se pide «Ingresa el nombre de la persona que tomará esta bebida», uno por cada unidad, con una imagen de referencia. |
| **Problema.** Un canal de venta propio con la carta oficial, sin el costo ni las limitaciones de la plataforma anterior (NEC-CAP-006). Contribuye a OBJ-CAP-002 «No vender lo que no hay». | **Fuera de alcance.**<br>• HU-CAP-001: Navegar la carta por categorías y buscador.<br>• HU-CAP-003: Elegir sabores y armar un combo por unidad.<br>• HU-CAP-004: Ver promociones y combos con su precio.<br>• Agotados, horario y pausa en la carta: FT-CAR-02.<br>• Carrito, modalidad y datos del cliente: FT-PED-01.<br>• Cómo el administrador crea productos, listas y categorías: FT-CON-01.<br>• Cómo se crean combos y promociones: FT-OFE-01.<br>• Filtros por rango de precio y reseñas públicas (descartados, DT-13). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un producto con foto | el cliente lo abre | ve la foto cuadrada, puede ampliarla con un toque y la foto ampliada se adapta sin recortarse a productos anchos o altos y al tamaño de la pantalla; ve sus tamaños y grupos de opciones (RQ-CAR-01-05) |
| CA-2 | un grupo obligatorio con mínimo 1 y máximo 2 | el cliente intenta agregar sin elegir | el botón queda desactivado con el aviso del grupo; al marcar una tercera opción, la más antigua no se agrega y se avisa del máximo (RQ-CAR-01-06) |
| CA-3 | un frappé de S/ 12 en tamaño grande (+S/ 2) con leche de almendras (+S/ 1,50) y cantidad 2 | el cliente lo arma | el precio mostrado es S/ 31,00 (RQ-CAR-01-07) |
| CA-4 | un frappé | el cliente abre su ficha | ve el aviso de hielo y los toppings secos (Oreo triturado, chispas, chin chin, almendra) a S/ 1 cada uno (RQ-CAR-01-08) |
| CA-5 | 3 capuchinos | el cliente los agrega | ve tres campos «Ingresa el nombre de la persona que tomará esta bebida» con la imagen de una etiqueta de ejemplo; si deja uno vacío se usa el nombre del cliente, y cada nombre sale en la etiqueta de su bebida (FT-COC-02) (RQ-CAR-01-09) |
| CA-6 | un celular de 360 px de ancho | el cliente abre la pantalla de esta historia | todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) |

Origen: criterios de verificación de FT-CAR-01 (RQ-CAR-01-05, RQ-CAR-01-06, RQ-CAR-01-07, RQ-CAR-01-08, RQ-CAR-01-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-004) Cada producto puede tener tamaños y grupos de opciones; cada grupo indica si es obligatorio, mínimo, máximo y precio extra de cada opción.<br>**RB-02** (RN-CAP-007) Una promoción muestra el precio anterior tachado y el porcentaje; los combos Dúo tienen precio por tamaño.<br>**RB-03** (RN-CAP-053) Las bebidas pueden llevar toppings opcionales con precio extra; la lista se confirma con el cliente.<br>**RB-04** (DT-57) En las bebidas se pide el nombre de quien la tomará, uno por unidad; sale como protagonista en su etiqueta.<br>**RNF aplicables:** RNF-CAP-001, RNF-CAP-004, RNF-CAP-005, RNF-CAP-011, RNF-CAP-003. | `Producto` (nombre, descripción, foto, categoría, precio, activo, orden) · `Categoria` · `Tamano` · `GrupoOpciones` (obligatorio, mínimo, máximo) · `Opcion` (precio extra) · `TipoVariante`/`Sabor` · `Combo`/`ParteCombo` · `Ranking` mensual · `MensajeCarta` (tipo, texto, estado atendido).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-001** (Navegar la carta por categorías y buscador) va antes, dentro de la misma feature.<br>• DEP-05 lista de toppings.<br>• FT-COC-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01, R-03 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ inicio, barra de categorías, buscador y ficha de producto (`Main.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAR-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAR-01 (requerimientos RQ-CAR-01-05, RQ-CAR-01-06, RQ-CAR-01-07, RQ-CAR-01-08, RQ-CAR-01-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
