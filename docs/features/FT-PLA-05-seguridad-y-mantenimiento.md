---
id: FT-PLA-05
tipo: spec
titulo: "Seguridad y mantenimiento"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-01, FT-PLA-02, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DT-43, DT-47, RNF-CAP-006, RNF-CAP-007, R-11]
tags: [plataforma, plt-03, ep-cap-021, ft-pla-05, debe-tener]
---

# FT-PLA-05 — Seguridad y mantenimiento

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PLATAFORMA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-PLA-05 | Seguridad y mantenimiento | EP-CAP-021 Plataforma, despliegue y operación |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (DT-47 · DT-43) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El servidor instala solo los **parches de seguridad** (Ansible). **Renovate** abre PRs para actualizar dependencias e imágenes y **Trivy** revisa las imágenes en el CI (DT-47). Antes de salir a producción se hace la **revisión de seguridad** de `operacion/SEC-CAP-001`. Hay un procedimiento para **rotar claves** (OpenAI, WhatsApp, Google, almacenamiento de copias, JWT, base de datos) y para responder a una **filtración**, en `operacion/RB-CAP-005`. Se recomienda rotar ya las claves del bot actual, que estaban en texto plano.

**Beneficio esperado.** Que una librería vieja o una clave filtrada no se convierta en un incidente con datos de clientes. Hipótesis medible: **0 vulnerabilidades críticas abiertas** en imágenes publicadas; **rotación de una clave en menos de 30 minutos** siguiendo el runbook.

**Usuarios / roles.** Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD) (mantiene y responde a incidentes).

**Pantallas de referencia.** No tiene pantallas de negocio: se opera desde GitHub, el panel de Dokploy, Uptime Kuma y GlitchTip (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-PLA-05-01 | El servidor instala solo los parches de seguridad del sistema operativo. | Debe tener | DT-47 · DT-40 | Dado un parche de seguridad publicado, cuando pasa un día, entonces está instalado y queda en el registro de unattended-upgrades. | Propuesto |
| RQ-PLA-05-02 | Renovate abre PRs para actualizar dependencias e imágenes, y pasan por el mismo CI. | Debería tener | DT-47 | Dada una versión nueva de NestJS, cuando Renovate la detecta, entonces abre un PR que corre todas las pruebas antes de unirse. | Propuesto |
| RQ-PLA-05-03 | Trivy bloquea publicar una imagen con vulnerabilidades críticas. | Debe tener | DT-47 | Dada una imagen con una vulnerabilidad crítica conocida, cuando corre el CI, entonces falla y la imagen no se sube a GHCR. | Propuesto |
| RQ-PLA-05-04 | Antes de cada salida a producción se completa la revisión de seguridad SEC-CAP-001. | Debe tener | DT-51 · G7 | Dado el piloto H1, cuando se prepara la salida, entonces SEC-CAP-001 tiene cada punto revisado con evidencia o con su pendiente aceptado. | Propuesto |
| RQ-PLA-05-05 | Rotar cualquier clave está escrito en RB-CAP-005 y no interrumpe la atención. | Debe tener | DT-43 · DT-51 | Dada la clave de OpenAI expuesta, cuando se sigue RB-CAP-005, entonces se genera una nueva, se cambia en Dokploy, se reinicia el servicio y la vieja se revoca en menos de 30 minutos. | Propuesto |
| RQ-PLA-05-06 | Ante una filtración se sigue el procedimiento de RB-CAP-005: contener, rotar, revisar el historial de acciones y avisar. | Debe tener | ADR-014 · ADR-005 | Dada una sospecha de acceso indebido, cuando se sigue el procedimiento, entonces se revocan sesiones y claves, se revisa el Historial de acciones y se evalúa si hay que avisar a los afectados (Ley 29733). | Propuesto |

Prioridad *Debe tener*: el sistema guarda datos personales y dinero. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-007 | Seguridad | Las contraseñas y PIN se guardan solo como huella (hash con sal), nunca en texto. | 0 contraseñas en texto · revisión de la base (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. Aplican los tres porque una vulnerabilidad o una clave filtrada exponen accesos, contraseñas y datos personales.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| DT-43 | Secretos fuera del repositorio. | decisiones.md |
| DT-47 | Parches, Renovate, Trivy y prueba de restauración. | decisiones.md |
| ADR-005 | Datos personales (Ley 29733). | ADR-005 |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-PLA-05-01 | HU-CAP-188 | — | R-01 |
| RQ-PLA-05-02 | HU-CAP-188 | FT-PLA-01 | R-01 |
| RQ-PLA-05-03 | HU-CAP-188 | FT-PLA-01 | R-01 |
| RQ-PLA-05-04 | HU-CAP-189 | operacion/SEC-CAP-001 | R-01 |
| RQ-PLA-05-05 | HU-CAP-189 | operacion/RB-CAP-005 | R-11 |
| RQ-PLA-05-06 | HU-CAP-189 | operacion/RB-CAP-005 | R-11 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-188 Mantener el sistema parchado y las dependencias al día
- HU-CAP-189 Revisar la seguridad antes de salir y responder a una filtración

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.

**Fuera de alcance**

- Pruebas de penetración contratadas a terceros (no previstas en el piloto).

**Preguntas abiertas**

1. **¿Cuándo rotar las claves del bot actual?** Recomendación: ahora, antes del piloto, porque estuvieron en texto plano.

---

Generado por IA: DT-43, DT-47, ADR-005, ADR-014 y DT-51 — Revisado por: *(pendiente)*
