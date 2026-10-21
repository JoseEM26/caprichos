---
id: FT-USR-02
tipo: spec
titulo: "Roles, permisos y escritorio por rol"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-013, FT-USR-01, FT-INF-02, ADR-001, ADR-011, ADR-014, ADR-004, ADR-008, NEC-CAP-008, NEC-CAP-010, NEC-CAP-088, RN-CAP-013, RN-CAP-094]
tags: [usuarios, plt-03, ep-cap-013, ft-usr-02, debe-tener]
---

# FT-USR-02 — Roles, permisos y escritorio por rol

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PERSONAL · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-USR-02 | Roles, permisos y escritorio por rol | EP-CAP-013 Personal, usuarios y roles |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-010 · RN-CAP-013) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El sistema tiene **siete roles**: administrador, cajero, cocina y barra, mozo, call center, almacén y repartidor (NEC-CAP-010), más producción como función del almacén o la cocina. Cada rol entra y ve **solo sus módulos** y un **escritorio** con lo importante para su función; solo el administrador ve ventas e indicadores del negocio (RN-CAP-013). La matriz de permisos por rol (qué módulo y qué acción: ver, crear, editar, anular) es **editable por el administrador** (NEC-CAP-088), con la matriz inicial de `analisis/modulos-y-roles.md`. Algunas acciones sensibles exigen el **PIN del administrador** cuando las hace otro rol: anular un pedido, cambiar condiciones del crédito o las ofertas (RN-CAP-094). La autorización se verifica en el servidor, no solo ocultando botones.

**Beneficio esperado.** Que cada persona vea solo lo que necesita (NEC-CAP-010) y que los procesos y roles queden documentados (NEC-CAP-008). Hipótesis medible: **0 accesos a módulos fuera del rol** en la prueba con un usuario por rol (criterio del BRD §6).

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (administra roles y permisos) · ACT-CAP-002 Cajero/a (usa su escritorio) · ACT-CAP-003 Cocina y barra (usa su escritorio) · ACT-CAP-004 Mozos (usa su escritorio) · ACT-CAP-005 Almacén (usa su escritorio) · ACT-CAP-009 Repartidor (motorizado) (usa su escritorio) · Call center (aún sin código ACT en el BRD) (usa su escritorio).

**Pantallas de referencia.** Administrativo ▸ Roles y permisos, escritorio de cada rol, selector de rol del mockup (`Admin.dc.html`); `analisis/modulos-y-roles.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-USR-02-01 | El sistema tiene los siete roles del BRD y cada usuario tiene uno. | Debe tener | NEC-CAP-010 | Dada la lista de roles, cuando el administrador asigna un rol, entonces elige entre administrador, cajero, cocina y barra, mozo, call center, almacén y repartidor. | Propuesto |
| RQ-USR-02-02 | Cada rol ve en su menú solo los módulos que le corresponden. | Debe tener | RN-CAP-013 · NEC-CAP-010 | Dado un usuario de cocina, cuando entra, entonces su menú muestra Cocina y Producción y no Pedidos y caja, Informes ni Usuarios. | Propuesto |
| RQ-USR-02-03 | Un rol sin permiso no accede a un módulo aunque escriba su dirección. | Debe tener | RN-CAP-013 · RNF-CAP-006 | Dado un mozo, cuando abre la dirección de Informes, entonces ve «No tienes acceso» y el servidor no entrega datos. | Propuesto |
| RQ-USR-02-04 | Cada rol tiene un escritorio con lo importante para su función; solo el administrador ve ventas e indicadores. | Debe tener | RN-CAP-013 · NEC-CAP-010 | Dado un cajero, cuando entra, entonces ve pedidos por confirmar, caja abierta y cobros del día, sin ventas del mes ni márgenes. | Propuesto |
| RQ-USR-02-05 | La matriz de permisos por rol y acción es editable por el administrador. | Debería tener | NEC-CAP-088 | Dado el rol mozo sin «Reservas», cuando el administrador le da «ver y crear» con Sí/No, entonces los mozos ven Reservas al volver a entrar. | Propuesto |
| RQ-USR-02-06 | La matriz inicial es la de `modulos-y-roles.md`. | Debe tener | NEC-CAP-008 | Dado un sistema nuevo, cuando se revisa la matriz, entonces coincide con la tabla de módulos y roles del análisis. | Propuesto |
| RQ-USR-02-07 | Las acciones sensibles hechas por otro rol exigen el PIN de 6 dígitos de la supervisora (rol administrador), escrito en la misma pantalla; no hay aprobación a distancia. | Debe tener | RN-CAP-094 · DT-61 | Dado un cajero que anula un pedido, cuando confirma, entonces la pantalla de caja pide el PIN de la supervisora y sin él no se anula; no se envía ninguna notificación para aprobar desde otro lugar. | Propuesto |
| RQ-USR-02-08 | El administrador cambia su PIN de 6 dígitos, que se guarda como huella y no se comparte. | Debe tener | RN-CAP-094 · RNF-CAP-007 · DT-61 | Dado el perfil del administrador, cuando cambia su PIN por otro de 6 dígitos, entonces el nuevo vale y el anterior no; un PIN de 4 dígitos o como 123456 no se acepta. | Propuesto |
| RQ-USR-02-09 | El administrador no puede quitarse a sí mismo el rol de administrador si es el único. | Debe tener | Propuesta (calidad) | Dado un solo administrador, cuando intenta cambiar su rol, entonces se rechaza con «Debe quedar al menos un administrador». | Propuesto |

Prioridad por NEC-CAP-010 y RN-CAP-013 (E1). RQ-USR-02-05 es *Debería tener*: la matriz editable puede llegar después del piloto. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-007 | Seguridad | Las contraseñas y PIN se guardan solo como huella (hash con sal), nunca en texto. | 0 contraseñas en texto · revisión de la base (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-006 es el umbral clave (criterio de aceptación del BRD §6).

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-013 | Cada rol accede solo a los módulos y datos de su función; solo el administrador ve ventas. | Prototipo de UX |
| RN-CAP-094 | Condiciones del crédito y ofertas solo las edita el administrador; anular por otro rol exige su PIN. | Permisos |
| DT-09 | Tres líneas de producto en una sola plataforma web. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-USR-02-01 | HU-CAP-119 | — | R-01 |
| RQ-USR-02-02 | HU-CAP-119 | — | R-01 |
| RQ-USR-02-03 | HU-CAP-119 | — | R-01 |
| RQ-USR-02-04 | HU-CAP-120 | — | R-01 |
| RQ-USR-02-05 | HU-CAP-121 | — | R-01 |
| RQ-USR-02-06 | HU-CAP-121 | DEP-01 (validación de Kevin) | R-01 |
| RQ-USR-02-07 | HU-CAP-122 | FT-CAJ-02 | R-01 |
| RQ-USR-02-08 | HU-CAP-122 | — | R-01 |
| RQ-USR-02-09 | HU-CAP-121 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-119 Asignar un rol y ver solo mis módulos
- HU-CAP-120 Ver mi escritorio según mi rol
- HU-CAP-121 Editar la matriz de permisos por rol
- HU-CAP-122 Autorizar una acción sensible con el PIN del administrador

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-004, ADR-008.

**Fuera de alcance**

- Altas y primer ingreso: FT-USR-01.
- Permisos por usuario distintos a su rol (no pedido).

**Preguntas abiertas**

1. **Matriz exacta de permisos** — RN-CAP-013 la deja por confirmar con el cliente.
2. **¿Producción es un rol aparte?** El BRD la nombra como stakeholder pero no como rol; propuesta: permiso adicional para cocina o almacén.

---

Generado por IA: BRD (NEC-CAP-008, 010, 088; RN-CAP-013, 094), DT-09 y `analisis/modulos-y-roles.md` — Revisado por: *(pendiente)*
