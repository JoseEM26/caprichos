---
id: FT-LEG-02
tipo: spec
titulo: "Libro de Reclamaciones, términos y privacidad"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-020, FT-PED-01, FT-CLI-01, FT-CFG-01, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, NEC-CAP-089, RN-CAP-045, RN-CAP-071, RN-CAP-099]
tags: [legal, plt-03, ep-cap-020, ft-leg-02, debe-tener]
---

# FT-LEG-02 — Libro de Reclamaciones, términos y privacidad

**PLT-03 · Feature · Catálogo de requerimientos** · Frente LEGAL · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-LEG-02 | Libro de Reclamaciones, términos y privacidad | EP-CAP-020 Comprobantes y obligaciones legales |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-089 · Ley 29733) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** La carta tiene un **Libro de Reclamaciones** virtual: el cliente registra un reclamo o una queja con nombre, DNI, domicilio, teléfono o correo, el detalle y su pedido; recibe una constancia con número; la respuesta se da en el plazo legal (15 días hábiles según el BRD, por confirmar con revisión legal, D-06). Los reclamos se ven y responden en el administrativo. La carta muestra **términos y condiciones** y el **aviso de privacidad**; los datos personales se guardan solo con **aceptación registrada** (Ley 29733, RN-CAP-045, RN-CAP-071), y su conservación y atención de derechos se definen en ADR-005 (D-18).

**Beneficio esperado.** Cumplir obligaciones legales del consumidor y de datos personales antes de abrir la carta al público. Hipótesis medible: **100 % de reclamos con constancia y respuesta dentro del plazo**; **100 % de datos personales con aceptación registrada**.

**Usuarios / roles.** ACT-CAP-006 Clientes (registran reclamos y aceptan la privacidad) · ACT-CAP-001 Kevin Rosales, dueño y administrador (responde reclamos).

**Pantallas de referencia.** Carta ▸ Libro de Reclamaciones, términos, privacidad; administrativo ▸ Reclamos (`Main.dc.html`, `Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-LEG-02-01 | El cliente registra un reclamo o queja con sus datos, el detalle y su pedido. | Debe tener | NEC-CAP-089 | Dado el formulario, cuando el cliente completa nombre, DNI, domicilio, contacto y detalle, entonces se guarda y recibe la constancia con número. | Propuesto |
| RQ-LEG-02-02 | El cliente recibe una constancia con número y fecha. | Debe tener | NEC-CAP-089 | Dado un reclamo guardado, cuando termina, entonces ve y puede descargar su constancia. | Propuesto |
| RQ-LEG-02-03 | El administrador ve los reclamos con el plazo que falta y los responde. | Debe tener | NEC-CAP-089 · RN-CAP-099 | Dado un reclamo de hace 12 días hábiles, cuando el administrador abre la lista, entonces lo ve con «Faltan 3 días» y puede registrar la respuesta. | Propuesto |
| RQ-LEG-02-04 | Un reclamo no se elimina. | Debe tener | RN-CAP-014 | Dado un reclamo, cuando el administrador lo abre, entonces no hay opción de eliminar. | Propuesto |
| RQ-LEG-02-05 | La carta muestra términos y aviso de privacidad, editables en Configuración del local. | Debe tener | NEC-CAP-087 · RN-CAP-045 | Dado el pie de la carta, cuando el cliente toca «Privacidad», entonces ve el texto vigente. | Propuesto |
| RQ-LEG-02-06 | Los datos personales se guardan solo con aceptación registrada. | Debe tener | RN-CAP-071 · RN-CAP-045 · D-18 | Dado un pedido que guarda teléfono y dirección para la próxima vez, cuando el cliente no acepta el aviso, entonces se usan solo para ese pedido. | Propuesto |

Prioridad *Debe tener*: es obligación legal antes de publicar la carta (DEP-09). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-008 es el umbral clave (Ley 29733).

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-045 | Los datos del cliente se guardan para el siguiente pedido con aviso de privacidad. | Acta 02 |
| RN-CAP-071 | El DNI se guarda solo con aceptación y se enmascara. | BRD §5 |
| RN-CAP-099 | Pendiente de Kevin y revisión legal: texto y plazo del Libro de Reclamaciones. | Legal |
| D-06 | Texto y plazo del Libro de Reclamaciones. | decisiones.md |
| D-18 | Datos personales: consentimiento, retención y derechos (ADR-005). | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-LEG-02-01 | HU-CAP-173 | DEP-09 (D-06) | R-01 |
| RQ-LEG-02-02 | HU-CAP-173 | — | R-01 |
| RQ-LEG-02-03 | HU-CAP-174 | D-06 | R-01 |
| RQ-LEG-02-04 | HU-CAP-174 | — | R-01 |
| RQ-LEG-02-05 | HU-CAP-175 | FT-CFG-01 · DEP-09 | R-01 |
| RQ-LEG-02-06 | HU-CAP-175 | D-18 | R-11 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-173 Registrar un reclamo en el Libro de Reclamaciones
- HU-CAP-174 Responder reclamos en el administrativo
- HU-CAP-175 Aceptar el aviso de privacidad

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005.

**Fuera de alcance**

- Atención de derechos ARCO desde el sistema (se define en ADR-005).
- Registro del banco de datos ante la autoridad (trámite fuera del sistema).

**Preguntas abiertas**

1. **Texto y plazo legal** — D-06, DEP-09.
2. **Plazo de conservación de datos** — D-18.

---

Generado por IA: BRD (NEC-CAP-087, 089; RN-CAP-014, 045, 071, 099), D-06, D-18 y el mockup — Revisado por: *(pendiente)*
