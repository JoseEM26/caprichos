---
id: FT-COC-01
tipo: spec
titulo: "Pantallas de cocina por área"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-006, FT-COC-02, FT-COC-03, FT-CAJ-01, FT-SAL-02, FT-CFG-01, ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007, NEC-CAP-020, NEC-CAP-037, NEC-CAP-072, NEC-CAP-101, RN-CAP-022, RN-CAP-035, RN-CAP-084]
tags: [cocina, plt-03, ep-cap-006, ft-coc-01, debe-tener]
---

# FT-COC-01 — Pantallas de cocina por área

**PLT-03 · Feature · Catálogo de requerimientos** · Frente COCINA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-COC-01 | Pantallas de cocina por área | EP-CAP-006 Cocina por áreas e impresión |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-020 · NEC-CAP-037 · NEC-CAP-072) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Cada área de producción (**Bebidas, Postres y Salados**, más hasta cuatro áreas propias, NEC-CAP-101) tiene su pantalla y ve **solo lo que le toca**, incluidas las partes de un combo (RN-CAP-035). Cada comanda muestra ticket, mozo o canal, modalidad, cronómetro, productos con opciones y notas, sin tener que desplazar la pantalla (NEC-CAP-020). Hay una vista general opcional. Al llegar suena un aviso y el color cambia según el tiempo frente a la meta de entrega (RN-CAP-022). Cada área avanza su parte con un toque (en preparación → listo) y puede deshacer; el pedido queda listo solo cuando **todas** sus áreas terminan (RN-CAP-084). Los listos se despejan de la pantalla sin cambiar su estado. Hay además una URL de **TV de solo lectura**, vinculada una vez con una llave propia que el administrador puede desactivar, que no muestra teléfono ni dirección (RN-CAP-023).

**Beneficio esperado.** Cada área sabe qué preparar sin gritos ni papeles, y el tiempo de cada pedido se ve y se mide. Contribuye a OBJ-CAP-001. Hipótesis medible: **Tiempo medio de preparación medido por área desde el primer día**; **0 partes de combo en un área equivocada**.

**Usuarios / roles.** ACT-CAP-003 Cocina y barra (prepara y avanza su parte) · ACT-CAP-004 Mozos (recibe el aviso de listo) · ACT-CAP-001 Kevin Rosales, dueño y administrador (activa la TV y crea áreas).

**Pantallas de referencia.** Administrativo ▸ Cocina por área, vista general, TV de cocina (`Admin.dc.html`); `analisis/pantalla-cocina.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-COC-01-01 | Un pedido que pasa a cocina aparece en la pantalla de cada área con solo sus productos. | Debe tener | NEC-CAP-020 · RN-CAP-002 | Dado un pedido con un frappé y un sándwich, cuando pasa a cocina, entonces Bebidas ve el frappé, Salados ve el sándwich y Postres no ve nada. | Propuesto |
| RQ-COC-01-02 | Las partes de un combo van cada una a su área. | Debe tener | RN-CAP-035 | Dado un combo de bebida y postre, cuando pasa a cocina, entonces la bebida va a Bebidas y el postre a Postres, cada uno con el nombre del combo. | Propuesto |
| RQ-COC-01-03 | La comanda muestra ticket, mozo o canal, modalidad, cronómetro, productos con opciones y notas sin desplazar. | Debe tener | NEC-CAP-020 · NEC-CAP-037 | Dado un pedido con 6 productos, cuando aparece en Bebidas, entonces todo cabe en su tarjeta sin scroll, con las opciones y la nota resaltada. | Propuesto |
| RQ-COC-01-04 | Al llegar un pedido suena un aviso y el color cambia según el tiempo frente a la meta. | Debe tener | RN-CAP-022 | Dada una meta de 13 minutos, cuando una comanda pasa los 10 y los 13 minutos, entonces cambia a ámbar y a rojo. | Propuesto |
| RQ-COC-01-05 | Cada área avanza su parte con un toque y puede deshacer. | Debe tener | NEC-CAP-072 | Dado un pedido nuevo, cuando Bebidas toca su parte, entonces pasa a «En preparación»; otro toque, a «Listo»; «Deshacer» la regresa un paso. | Propuesto |
| RQ-COC-01-06 | El pedido pasa a preparación cuando alguna área empieza y a listo cuando todas terminan. | Debe tener | RN-CAP-084 (1.ª) | Dado un pedido de dos áreas, cuando solo Bebidas termina, entonces el pedido sigue «En preparación»; cuando Salados termina, pasa a «Listo» y se avisa a caja o al mozo. | Propuesto |
| RQ-COC-01-07 | Los listos se despejan de la pantalla sin cambiar su estado. | Debe tener | RN-CAP-084 (1.ª) | Dado un pedido listo, cuando el área lo despeja, entonces desaparece de esa pantalla y sigue «Listo» en Pedidos. | Propuesto |
| RQ-COC-01-08 | Hay una vista general opcional con todas las áreas. | Debería tener | NEC-CAP-037 | Dado un usuario de cocina, cuando elige «Vista general», entonces ve todas las comandas con el estado de cada área. | Propuesto |
| RQ-COC-01-09 | La TV de cocina se vincula una vez con una llave propia, solo muestra comandas y el administrador la desactiva. | Debe tener | RN-CAP-023 · A5 | Dada una TV vinculada, cuando muestra las comandas, entonces no aparecen teléfono ni dirección; cuando el administrador desactiva su llave, la TV deja de ver pedidos. | Propuesto |
| RQ-COC-01-10 | El administrador crea hasta cuatro áreas propias, les asigna categorías y aparecen como pantalla. | Debería tener | NEC-CAP-101 · RN-CAP-123 | Dada un área nueva «Parrilla» con la categoría Hamburguesas, cuando entra un pedido con una hamburguesa, entonces aparece en la pantalla Parrilla; una quinta área no se puede crear. | Propuesto |
| RQ-COC-01-11 | Cada categoría de la carta tiene su área de cocina, editable por el administrador. | Debe tener | NEC-CAP-087 | Dada la categoría Postres en el área Postres, cuando el administrador la cambia a Bebidas con Sí/No, entonces los pedidos nuevos de esa categoría van a Bebidas. | Propuesto |

Prioridad por NEC-CAP-020, 037 y 072 (E1). RQ-COC-01-08 y 10 son *Debería tener*. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-002 | Tiempo real | Un pedido que pasa a cocina aparece en todas sus pantallas sin recargar. | Retardo ≤ 3 s (p95) · medición: registro de eventos (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-004 | Usabilidad | Las pantallas se usan desde un celular sin desplazamiento horizontal. | Ancho mínimo 360 px · 0 pantallas con scroll horizontal (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-003 | Disponibilidad | La carta, el administrativo y el chatbot están en línea durante el horario de atención. | ≥ 99,5 % mensual en horario · medición: monitoreo externo (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-002 es crítico aquí: una comanda que tarda en llegar retrasa la entrega. RNF-CAP-006 aplica a la TV, que solo ve comandas.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-002 | Al confirmarse (o enviarse por el mozo) aparece en las pantallas de cocina y empiezan los tiempos. | Acta 01 |
| RN-CAP-022 | La pantalla muestra el pedido completo, avisa con sonido y cambia de color según la meta. | Sistema actual |
| RN-CAP-023 | La TV se vincula con una llave propia, solo ve pedidos de cocina y se puede desactivar. | Propuesta |
| RN-CAP-035 | Los productos de un combo van a la pantalla de su área. | Acta 02 |
| RN-CAP-084 (1.ª) | El estado del pedido se calcula con el de sus áreas; despejar no cambia el estado (id repetido, O1). | Cocina |
| RN-CAP-123 | Hasta cuatro áreas propias; se desactivan, no se eliminan; sin etiqueta propia. | Cocina |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-COC-01-01 | HU-CAP-047 | — | R-01 |
| RQ-COC-01-02 | HU-CAP-047 | FT-OFE-01 | R-01 |
| RQ-COC-01-03 | HU-CAP-047 | — | R-01 |
| RQ-COC-01-04 | HU-CAP-047 | D-01 | R-01 |
| RQ-COC-01-05 | HU-CAP-048 | — | R-01 |
| RQ-COC-01-06 | HU-CAP-048 | — | R-01 |
| RQ-COC-01-07 | HU-CAP-048 | — | R-01 |
| RQ-COC-01-08 | HU-CAP-047 | — | R-01 |
| RQ-COC-01-09 | HU-CAP-049 | DEP-03 equipos del local | R-01 |
| RQ-COC-01-10 | HU-CAP-050 | FT-CFG-01 | R-01 |
| RQ-COC-01-11 | HU-CAP-050 | FT-CFG-01 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-047 Ver en mi pantalla solo las comandas de mi área
- HU-CAP-048 Avanzar y deshacer el estado de mi parte
- HU-CAP-049 Ver la TV de cocina de solo lectura
- HU-CAP-050 Crear áreas de cocina y asignarles categorías

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007.

**Fuera de alcance**

- Impresión de comandas y etiquetas: FT-COC-02.
- Agotado por hoy y Alta demanda: FT-COC-03.
- Mermas y cierre del día de cocina: FT-ALM-03.

**Preguntas abiertas**

1. **Equipos del local** — computadoras de cada área y TV (DEP-03). El BRD dice 3 áreas con computadora propia.
2. **Umbrales de color** — propuesta: ámbar al 75 % de la meta y rojo al pasarla.

---

Generado por IA: BRD (NEC-CAP-020, 037, 072, 087, 101; RN-CAP-002, 022, 023, 035, 084, 123), `analisis/pantalla-cocina.md` y el mockup de Cocina — Revisado por: *(pendiente)*
