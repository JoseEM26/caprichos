---
id: FT-INF-02
tipo: spec
titulo: "Indicadores y mapa de entregas"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-018, FT-INF-01, FT-DEL-01, FT-USR-02, ADR-001, ADR-011, ADR-014, ADR-006, ADR-012, NEC-CAP-041, NEC-CAP-077]
tags: [informes, plt-03, ep-cap-018, ft-inf-02, podria-tener]
---

# FT-INF-02 — Indicadores y mapa de entregas

**PLT-03 · Feature · Catálogo de requerimientos** · Frente INFORMES · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-INF-02 | Indicadores y mapa de entregas | EP-CAP-018 Informes, indicadores y notificaciones |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Podría tener** (NEC-CAP-041 · NEC-CAP-077) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H3 · 22/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El **escritorio del administrador** e **Indicadores** muestran las cifras clave del día y del período con gráficos y filtros (NEC-CAP-041): ventas, pedidos, ticket promedio, tiempo de entrega frente a la meta, pedidos por confirmar, productos agotados y stock bajo. El **mapa de entregas** muestra el **calor** de los pedidos con delivery, las **zonas** de reparto, **ventas por zona**, **radios** desde la tienda para repartir volantes y los **intentos fuera de cobertura** (NEC-CAP-077).

**Beneficio esperado.** Ver de un vistazo cómo va el negocio y dónde están los clientes. Hipótesis medible: **Cifras del escritorio iguales a las de Informes para el mismo período**.

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (consulta).

**Pantallas de referencia.** Administrativo ▸ Escritorio del administrador, Indicadores, Mapa de entregas (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-INF-02-01 | El escritorio del administrador muestra ventas, pedidos, ticket promedio y tiempo de entrega del día. | Podría tener | NEC-CAP-041 · NEC-CAP-010 | Dado el día, cuando el administrador entra, entonces ve las cuatro cifras con su comparación con el día anterior. | Propuesto |
| RQ-INF-02-02 | Indicadores se filtran por período, año, fechas y canal. | Podría tener | NEC-CAP-041 | Dado el año 2026, cuando filtra canal «Chatbot», entonces los gráficos solo cuentan ese canal. | Propuesto |
| RQ-INF-02-03 | El mapa muestra el calor de los pedidos con delivery por período. | Podría tener | NEC-CAP-077 | Dado octubre, cuando abre el mapa, entonces ve el calor de los puntos de entrega. | Propuesto |
| RQ-INF-02-04 | El mapa muestra zonas, ventas por zona y radios desde la tienda. | Podría tener | NEC-CAP-077 | Dado el mapa, cuando activa «Radios», entonces ve círculos de 1, 2 y 3 km desde la tienda y las ventas de cada zona. | Propuesto |
| RQ-INF-02-05 | El mapa muestra los intentos fuera de cobertura. | Podría tener | NEC-CAP-077 | Dados intentos fuera de cobertura, cuando activa la capa, entonces los ve como puntos. | Propuesto |
| RQ-INF-02-06 | Las cifras del escritorio coinciden con Informes. | Debe tener | RNF-CAP-011 | Dado el mismo día, cuando se comparan, entonces son iguales. | Propuesto |

Prioridad *Podría tener* por la épica (fase Después). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-017 | Rendimiento | Los informes y gráficos de un mes cargan rápido. | ≤ 5 s para un mes de datos (umbral propuesto) | Podría tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Podría tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Podría tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-008 aplica: el mapa de calor no muestra datos que identifiquen a un cliente.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-013 | Solo el administrador ve ventas e indicadores. | Prototipo |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-INF-02-01 | HU-CAP-164 | — | R-01 |
| RQ-INF-02-02 | HU-CAP-164 | — | R-01 |
| RQ-INF-02-03 | HU-CAP-165 | FT-DEL-01 | R-01 |
| RQ-INF-02-04 | HU-CAP-165 | — | R-01 |
| RQ-INF-02-05 | HU-CAP-165 | FT-DEL-01 | R-01 |
| RQ-INF-02-06 | HU-CAP-164 | FT-INF-01 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-164 Ver mi escritorio e indicadores
- HU-CAP-165 Ver el mapa de entregas

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-012.

**Fuera de alcance**

- Informes detallados: FT-INF-01.
- Seguimiento del repartidor en tiempo real (fuera de alcance).

**Preguntas abiertas**

1. **Radios para volantes** — propuesta: 1, 2 y 3 km, configurables.

---

Generado por IA: BRD (NEC-CAP-010, 041, 077; RN-CAP-013) y el mockup — Revisado por: *(pendiente)*
