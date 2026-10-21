---
id: FT-PLA-03
tipo: spec
titulo: "Copias y recuperación"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-02, FT-PLA-04, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DT-31, DT-35, DT-47, RNF-CAP-003, RNF-CAP-008]
tags: [plataforma, plt-03, ep-cap-021, ft-pla-03, debe-tener]
---

# FT-PLA-03 — Copias y recuperación

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PLATAFORMA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-PLA-03 | Copias y recuperación | EP-CAP-021 Plataforma, despliegue y operación |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (DT-31 · DT-47 · ADR-012) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Cada día a las 03:00 de Lima se hace **una copia cifrada con restic** de la base (`pg_dump` por ambiente) y de las carpetas de fotos y comprobantes de pago, y se envía **fuera del VPS** (Backblaze B2 o Cloudflare R2), con 30 copias diarias y 6 mensuales (DT-31, ADR-012). Se suma al Auto Backup y al snapshot del proveedor. La copia avisa si falla. **Restaurar** está escrito paso a paso en `operacion/RB-CAP-002` y se **prueba cada 3 meses** en el ambiente de pruebas, midiendo el tiempo (DT-47). La clave de restic se guarda fuera del VPS.

**Beneficio esperado.** No perder pedidos, cobros ni fotos aunque falle el proveedor o se borre algo por error. Hipótesis medible: **100 % de los días con copia verificada**; **restauración en menos de 1 hora** en la prueba trimestral.

**Usuarios / roles.** Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD) (configura las copias y restaura) · ACT-CAP-001 Kevin Rosales, dueño y administrador (confía en que sus datos están a salvo).

**Pantallas de referencia.** No tiene pantallas de negocio: se opera desde GitHub, el panel de Dokploy, Uptime Kuma y GlitchTip (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-PLA-03-01 | Cada día a las 03:00 se copia, cifrado, la base de cada ambiente y las carpetas de fotos y comprobantes a un almacenamiento fuera del VPS. | Debe tener | DT-31 · ADR-012 | Dado el día 21, cuando son las 03:10, entonces el repositorio de restic tiene una copia nueva con la base de producción, la de pruebas y las dos carpetas, y su contenido no se puede leer sin la clave. | Propuesto |
| RQ-PLA-03-02 | Se guardan 30 copias diarias y 6 mensuales y las más viejas se eliminan solas. | Debe tener | ADR-012 | Dadas 40 copias diarias, cuando corre la limpieza, entonces quedan las 30 últimas diarias y una por mes de los últimos 6 meses. | Propuesto |
| RQ-PLA-03-03 | Si la copia falla o no corre, llega un aviso al celular. | Debe tener | DT-44 · ADR-012 | Dado un día en que el almacenamiento externo no responde, cuando la copia falla, entonces Uptime Kuma marca el monitor de la copia en rojo y envía el aviso antes de las 04:00. | Propuesto |
| RQ-PLA-03-04 | La clave de restic y el acceso al almacenamiento de copias se guardan fuera del VPS. | Debe tener | ADR-012 · DT-43 | Dado el VPS perdido por completo, cuando hay que restaurar, entonces la clave y el acceso están en el gestor de contraseñas del responsable y no solo en el servidor. | Propuesto |
| RQ-PLA-03-05 | Restaurar la base y las carpetas está escrito paso a paso en RB-CAP-002. | Debe tener | DT-51 | Dado RB-CAP-002, cuando lo sigue alguien distinto de quien lo escribió, entonces logra restaurar en pruebas sin pedir ayuda. | Propuesto |
| RQ-PLA-03-06 | Cada 3 meses se prueba restaurar la copia del día en pruebas y se anota el tiempo. | Debe tener | DT-47 | Dado el primer lunes del trimestre, cuando se restaura la copia del día en pruebas, entonces los pedidos y cobros del día anterior aparecen completos y el tiempo total queda anotado (meta: menos de 1 hora). | Propuesto |
| RQ-PLA-03-07 | Se puede recuperar un solo dato borrado por error sin restaurar todo el sistema. | Debería tener | ADR-012 | Dado un producto borrado por error ayer, cuando se restaura la copia en una base aparte, entonces se copia solo ese registro a producción y el resto no cambia. | Propuesto |

Prioridad *Debe tener*: los datos de caja y pedidos no se pueden perder. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-003 | Disponibilidad | La carta, el administrativo y el chatbot están en línea durante el horario de atención. | ≥ 99,5 % mensual en horario · medición: monitoreo externo (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-008 aplica porque las copias contienen datos personales: van cifradas y fuera del VPS.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| DT-31 | Copia diaria fuera del VPS con 30 días de historial. | decisiones.md |
| DT-35 | Fotos y comprobantes en el VPS, incluidos en la copia. | decisiones.md |
| DT-47 | Prueba de restauración cada 3 meses. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-PLA-03-01 | HU-CAP-184 | — | R-01 |
| RQ-PLA-03-02 | HU-CAP-184 | — | R-01 |
| RQ-PLA-03-03 | HU-CAP-184 | FT-PLA-04 | R-01 |
| RQ-PLA-03-04 | HU-CAP-184 | — | R-11 |
| RQ-PLA-03-05 | HU-CAP-185 | operacion/RB-CAP-002 | R-01 |
| RQ-PLA-03-06 | HU-CAP-185 | — | R-01 |
| RQ-PLA-03-07 | HU-CAP-185 | operacion/RB-CAP-002 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-184 Hacer la copia diaria cifrada fuera del VPS
- HU-CAP-185 Restaurar una copia y probarlo cada 3 meses

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.

**Fuera de alcance**

- Snapshot y Auto Backup del proveedor (se suman, no reemplazan).
- Copia de los registros de vigilancia.

**Preguntas abiertas**

1. **¿B2 o R2?** Propuesta: R2 si ya se usa Cloudflare; B2 si se quiere otro proveedor distinto del DNS.

---

Generado por IA: DT-31, DT-35, DT-47, ADR-012 y DT-51 — Revisado por: *(pendiente)*
