---
id: FT-CON-02
tipo: spec
titulo: "Diseñador de la carta y decoración"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-016, FT-CON-01, FT-CON-03, FT-CAR-01, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, NEC-CAP-011, NEC-CAP-012, RN-CAP-018]
tags: [contenidos, plt-03, ep-cap-016, ft-con-02, deberia-tener]
---

# FT-CON-02 — Diseñador de la carta y decoración

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CONTENIDOS · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CON-02 | Diseñador de la carta y decoración | EP-CAP-016 Administración de la carta y contenidos |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-011 · NEC-CAP-012) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El administrador configura la carta **viéndola como la ve el cliente** (NEC-CAP-011): cambia el orden de productos y categorías arrastrando, fotos, textos y precios, oculta productos y edita las dos promociones de la parte superior. Elige entre **tres organizaciones** (por secciones, lista o tarjetas grandes). Aplica **decoración festiva** (Halloween, Navidad, Año Nuevo y otras) con su paleta propia, solo mientras esté activa; al quitarla vuelve la paleta de la marca (NEC-CAP-012). Los cambios se **publican con una acción explícita**; mientras no se publique, la carta del cliente no cambia (RN-CAP-018). El diseñador ve también los productos y categorías creados en la sesión.

**Beneficio esperado.** Cambiar la carta sin formularios técnicos y sin errores visibles para el cliente hasta publicar. Hipótesis medible: **0 cambios visibles en la carta sin publicar** y **criterio del BRD §6 cumplido** (orden, foto y precio publicados y vistos por el cliente).

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (diseña y publica).

**Pantallas de referencia.** Administrativo ▸ Diseño de la carta (vista del cliente, decoración, publicar) (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CON-02-01 | El administrador edita la carta en una vista igual a la del cliente. | Debería tener | NEC-CAP-011 | Dado el diseñador, cuando lo abre, entonces ve la carta con su cabecera, categorías y productos como el cliente, con controles de edición. | Propuesto |
| RQ-CON-02-02 | Cambia el orden de productos y categorías arrastrando. | Debería tener | NEC-CAP-011 | Dado Postres después de Frappés, cuando arrastra Postres antes, entonces la vista previa cambia al momento. | Propuesto |
| RQ-CON-02-03 | Cambia fotos, textos y precios y oculta productos desde la vista. | Debería tener | NEC-CAP-011 | Dado un producto, cuando cambia su foto y su precio, entonces la vista previa lo muestra y queda pendiente de publicar. | Propuesto |
| RQ-CON-02-04 | Edita las dos promociones de la parte superior. | Debería tener | BRD §4 «Administración de la carta» | Dados los dos destacados de arriba, cuando el administrador elige otro producto para el segundo, entonces la vista previa lo muestra. | Propuesto |
| RQ-CON-02-05 | Elige una de tres organizaciones: por secciones, lista o tarjetas grandes. | Debería tener | BRD §4 | Dada la organización «por secciones», cuando elige «tarjetas grandes», entonces la vista previa cambia. | Propuesto |
| RQ-CON-02-06 | Activa una decoración festiva con su paleta solo mientras está activa. | Debería tener | NEC-CAP-012 | Dada la decoración de Navidad, cuando se activa y publica, entonces la carta usa su paleta; al quitarla y publicar, vuelve la paleta de la marca. | Propuesto |
| RQ-CON-02-07 | Los cambios se publican con una acción explícita y Sí/No; antes, la carta del cliente no cambia. | Debe tener | RN-CAP-018 | Dados cambios pendientes, cuando un cliente abre la carta, entonces ve la versión anterior; al publicar, ve la nueva. | Propuesto |
| RQ-CON-02-08 | Se pueden descartar los cambios pendientes. | Debería tener | RN-CAP-018 | Dados cambios pendientes, cuando el administrador toca «Descartar» con Sí/No, entonces el diseñador vuelve a la versión publicada. | Propuesto |

Prioridad *Debería tener* por la épica; RQ-CON-02-07 es *Debe tener* (RN-CAP-018). Va en la fase Ahora porque el criterio de aceptación del BRD §6 lo pide al fin de esa fase. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-001 | Rendimiento | La carta abre en un celular con 4G y muestra la primera categoría sin esperar a que carguen todas las fotos. | Primera vista ≤ 3 s (p75) · medición: monitoreo del navegador (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-001 aplica: la decoración no debe hacer más lenta la carta.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-018 | Los cambios de la carta se publican con una acción explícita. | Prototipo de UX |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CON-02-01 | HU-CAP-148 | — | R-01 |
| RQ-CON-02-02 | HU-CAP-148 | — | R-01 |
| RQ-CON-02-03 | HU-CAP-148 | FT-CON-01 | R-01 |
| RQ-CON-02-04 | HU-CAP-149 | FT-OFE-01 | R-01 |
| RQ-CON-02-05 | HU-CAP-149 | — | R-01 |
| RQ-CON-02-06 | HU-CAP-150 | — | R-01 |
| RQ-CON-02-07 | HU-CAP-150 | — | R-01 |
| RQ-CON-02-08 | HU-CAP-150 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-148 Editar la carta en la vista del cliente
- HU-CAP-149 Elegir organización y decoración festiva
- HU-CAP-150 Publicar o descartar los cambios

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.

**Fuera de alcance**

- Crear productos y opciones: FT-CON-01.
- Novedades y destacadas: FT-CON-03.

**Preguntas abiertas**

1. **Fechas de cada decoración** — propuesta: el administrador la activa a mano, sin calendario automático.

---

Generado por IA: BRD (NEC-CAP-011, 012; RN-CAP-018, BRD §4 y §6) y el mockup del Diseño de la carta — Revisado por: *(pendiente)*
