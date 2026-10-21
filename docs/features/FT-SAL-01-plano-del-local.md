---
id: FT-SAL-01
tipo: spec
titulo: "Plano del local"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-007, FT-SAL-02, FT-SAL-03, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, NEC-CAP-014, NEC-CAP-052, RN-CAP-014, RN-CAP-068]
tags: [salon, plt-03, ep-cap-007, ft-sal-01, debe-tener]
---

# FT-SAL-01 — Plano del local

**PLT-03 · Feature · Catálogo de requerimientos** · Frente SALON · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-SAL-01 | Plano del local | EP-CAP-007 Salón: plano, mesas, pedido del mozo y reservas |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-014 · NEC-CAP-052) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El administrador dibuja el local por piso sobre una cuadrícula: mesas (con número y asientos), cocina, barra, baños, paredes, entrada y otros elementos (NEC-CAP-014). Los controles van arriba y el plano ocupa casi toda la pantalla; la cuadrícula tiene tamaño ajustable (NEC-CAP-052). Los elementos se mueven, giran (horizontal o vertical) y cambian de tamaño. Hoy hay un piso; el segundo existe desactivado y se activa cuando haga falta. Cualquier elemento que no sea mesa se elimina sin restricción; una mesa se puede eliminar aunque ya se haya usado (los pedidos y reservas cerrados conservan su nombre), salvo que tenga un pedido abierto o una reserva activa hoy, y entonces solo se desactiva (RN-CAP-068). El diseño se puede copiar y pegar como texto para respaldarlo. El plano por defecto es el documentado en `analisis/plano-del-local.md` (piso 1: 10 mesas, 38 asientos).

**Beneficio esperado.** Que el mozo vea el local tal como es para elegir mesa, y que el dueño pueda cambiar la distribución sin programador. Hipótesis medible: **El plano del sistema coincide con el local real** (validación de Kevin, D-16); **0 mesas eliminadas con pedido abierto**.

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (dibuja y edita el plano) · ACT-CAP-004 Mozos (lo usa para elegir mesa).

**Pantallas de referencia.** Administrativo ▸ Pantallas y plano ▸ Plano del local (`Admin.dc.html`); `analisis/plano-del-local.md` y `.default.json` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-SAL-01-01 | El administrador agrega mesas, cocina, barra, baños, paredes, entrada y otros elementos sobre una cuadrícula por piso. | Debe tener | NEC-CAP-014 | Dado el piso 1, cuando el administrador agrega una mesa de 4 asientos, entonces aparece en la cuadrícula con el siguiente número libre. | Propuesto |
| RQ-SAL-01-02 | Los elementos se mueven, giran y cambian de tamaño. | Debe tener | NEC-CAP-052 | Dada la entrada de 4×1, cuando el administrador la gira, entonces pasa a 1×4 en el mismo lugar si cabe. | Propuesto |
| RQ-SAL-01-03 | Los controles van arriba, el plano ocupa casi toda la pantalla y la cuadrícula tiene tamaño ajustable. | Debe tener | NEC-CAP-052 | Dada la cuadrícula de 12×12, cuando el administrador la cambia a 16×12, entonces el plano muestra más cuadros y conserva los elementos. | Propuesto |
| RQ-SAL-01-04 | Los pisos se activan y desactivan; con un solo piso activo, el mozo no elige piso. | Debe tener | NEC-CAP-014 · RN-CAP-025 | Dado el piso 2 desactivado, cuando el mozo abre un pedido de mesa, entonces solo ve el piso 1; al activarlo, primero elige piso. | Propuesto |
| RQ-SAL-01-05 | Cualquier elemento que no sea mesa se elimina sin restricción, con Sí/No. | Debe tener | RN-CAP-014 | Dada una pared, cuando el administrador la elimina y confirma, entonces desaparece del plano. | Propuesto |
| RQ-SAL-01-06 | Una mesa con pedido abierto o reserva activa hoy no se elimina: se desactiva. | Debe tener | RN-CAP-068 | Dada la mesa 4 con un pedido abierto, cuando el administrador intenta eliminarla, entonces ve el motivo y la opción de desactivarla. | Propuesto |
| RQ-SAL-01-07 | Una mesa ya usada se puede eliminar y sus pedidos cerrados conservan el nombre de la mesa. | Debe tener | RN-CAP-068 | Dada la mesa 9 con pedidos cobrados ayer, cuando se elimina, entonces esos pedidos siguen mostrando «Mesa 9». | Propuesto |
| RQ-SAL-01-08 | El plano muestra mesas, asientos y elementos en totales. | Podría tener | Mockup | Dado el piso 1, cuando el administrador abre el plano, entonces ve mesas, asientos totales y mesas activas. | Propuesto |
| RQ-SAL-01-09 | El diseño se copia como texto y se pega para restaurarlo. | Podría tener | D-16 · mockup | Dado un plano, cuando el administrador toca «Copiar» y luego pega ese texto en otro equipo, entonces el plano queda igual; un texto inválido muestra un error y no cambia nada. | Propuesto |
| RQ-SAL-01-10 | El plano por defecto es el documentado para Caprichos. | Debe tener | D-16 · `analisis/plano-del-local.md` | Dado un sistema nuevo, cuando se abre el plano, entonces el piso 1 tiene 10 mesas con 38 asientos y la entrada horizontal a la derecha, y el piso 2 está desactivado. | Propuesto |

Prioridad por NEC-CAP-014 y NEC-CAP-052 (E1). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-004 | Usabilidad | Las pantallas se usan desde un celular sin desplazamiento horizontal. | Ancho mínimo 360 px · 0 pantallas con scroll horizontal (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. El plano se edita sobre todo en computadora; RNF-CAP-004 aplica a la vista del mozo en tablet.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-014 | Los registros no se eliminan, salvo los elementos del plano; una mesa con pedidos o reservas se desactiva. | Diseño |
| RN-CAP-025 | El mozo solo abre pedido en mesas libres; con más de un piso activo elige primero el piso. | Prototipo |
| RN-CAP-068 | Una mesa se elimina aunque se haya usado; no con un pedido abierto o reserva activa hoy. | Decisión del 17/10 |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-SAL-01-01 | HU-CAP-058 | DEP-08 plano real (D-16) | R-01 |
| RQ-SAL-01-02 | HU-CAP-058 | — | R-01 |
| RQ-SAL-01-03 | HU-CAP-058 | — | R-01 |
| RQ-SAL-01-04 | HU-CAP-059 | — | R-01 |
| RQ-SAL-01-05 | HU-CAP-059 | — | R-01 |
| RQ-SAL-01-06 | HU-CAP-059 | — | R-01 |
| RQ-SAL-01-07 | HU-CAP-059 | — | R-01 |
| RQ-SAL-01-08 | HU-CAP-058 | — | R-01 |
| RQ-SAL-01-09 | HU-CAP-060 | D-16 | R-01 |
| RQ-SAL-01-10 | HU-CAP-060 | DEP-08 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-058 Dibujar el plano del local por piso
- HU-CAP-059 Activar pisos y eliminar o desactivar elementos
- HU-CAP-060 Copiar, pegar y restaurar el plano por defecto

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007.

**Fuera de alcance**

- Abrir pedidos en mesas: FT-SAL-02.
- Reservas: FT-SAL-03.
- Pantallas de TV para clientes (horizonte futuro).

**Preguntas abiertas**

1. **Plano real** — D-16. El plano por defecto se tomó del diseño del mockup; falta que Kevin lo valide.

---

Generado por IA: BRD (NEC-CAP-014, 052; RN-CAP-014, 025, 068), `analisis/plano-del-local.md` y el mockup del plano — Revisado por: *(pendiente)*
