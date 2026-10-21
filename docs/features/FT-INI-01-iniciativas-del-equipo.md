---
id: FT-INI-01
tipo: spec
titulo: "Iniciativas del equipo"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-022, FT-USR-04, FT-USR-01, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, ADR-012, DT-53, DT-49, RNF-CAP-009, RNF-CAP-014]
tags: [iniciativas, plt-03, ep-cap-022, ft-ini-01, deberia-tener]
---

# FT-INI-01 — Iniciativas del equipo

**PLT-03 · Feature · Catálogo de requerimientos** · Frente INICIATIVAS · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-INI-01 | Iniciativas del equipo | EP-CAP-022 Iniciativas del equipo |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (DT-53) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Una pantalla **Iniciativas** que ve todo el personal. Cualquiera sube una **queja**, una **mejora** o una **idea** indicando sobre qué parte es (carta web, pedidos y caja, cocina, reparto, almacén y compras u otro), un título corto, su comentario y, si quiere, una **captura** (imagen de hasta 5 MB). La lista muestra **quién la subió**, su rol y cuándo, con buscador y filtros por tipo, estado y «solo las mías». Cualquiera puede comentar. Solo el **administrador** cambia el estado: *Nueva*, *En revisión*, *Hecha* o *No por ahora*. Nada se borra ni se edita. Cada acción (subir, comentar, cambiar el estado) queda en el **Historial de acciones** con su IP (DT-49, ADR-014). El menú muestra al administrador cuántas iniciativas están sin revisar.

**Beneficio esperado.** Que las quejas y las ideas del equipo no se pierdan y que el dueño sepa quién las dijo y qué se hizo. Hipótesis medible: **Al menos 4 iniciativas por mes** y **80 % revisadas en 14 días** (propuestas).

**Usuarios / roles.** Cualquier persona del equipo con usuario (administrador, cajero, mozo, cocina, call center, almacén, producción o repartidor) (sube, mira y comenta) · ACT-CAP-001 Kevin Rosales, dueño y administrador (revisa y cambia el estado).

**Pantallas de referencia.** Iniciativas (menú Operación, para todos los roles) y el cuadro «Nueva iniciativa»; en el Historial de acciones aparece el módulo «iniciativas» (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-INI-01-01 | Cualquier persona con usuario sube una iniciativa con tipo (queja, mejora o idea), área, título de hasta 80 caracteres, comentario de hasta 600 y una captura opcional, previa confirmación Sí/No. | Debería tener | DT-53 · RN-CAP-015 | Dada una cajera con sesión, cuando completa el tipo, el área, el título y el comentario y responde «Sí» en la confirmación, entonces la iniciativa queda con código `IN-NNNN`, estado *Nueva*, su nombre, su rol y la fecha; si responde «No», no se guarda nada. | Propuesto |
| RQ-INI-01-02 | La captura es una imagen de hasta 5 MB que se guarda en la carpeta privada y solo la ven personas con sesión. | Debería tener | ADR-012 | Dada una captura de 8 MB, cuando se intenta subir, entonces se rechaza con un aviso de tamaño; dada una de 2 MB, se guarda y su dirección directa sin sesión responde 403. | Propuesto |
| RQ-INI-01-03 | El título y el comentario son obligatorios y se avisa qué falta antes de pedir confirmación. | Debería tener | DT-53 | Dado el cuadro sin título, cuando se pulsa «Subir iniciativa», entonces aparece «Escribe un título corto» y no se pide confirmación. | Propuesto |
| RQ-INI-01-04 | La lista muestra todas las iniciativas a todo el personal, con quién la subió, su rol, la fecha, el tipo, el área y el estado. | Debería tener | DT-53 | Dado un mozo con sesión, cuando abre Iniciativas, entonces ve las de todos, cada una con «Subida por <nombre> (<rol>)» y su estado, y ninguna pantalla de otro módulo queda abierta por esto. | Propuesto |
| RQ-INI-01-05 | La lista se puede buscar por título, texto, persona o área, y filtrar por tipo, por estado y por «solo las mías». | Debería tener | DT-53 | Dadas 30 iniciativas, cuando se filtra «Queja» y «En revisión», entonces solo aparecen las quejas en revisión y el contador dice cuántas son; con «Solo las mías» solo aparecen las del usuario. | Propuesto |
| RQ-INI-01-06 | Arriba se ven los contadores: total, nuevas, en revisión y hechas; la captura se ve pequeña en la lista y grande al abrir la iniciativa. | Debería tener | DT-53 | Dada una iniciativa con captura, cuando se pulsa «Ver y comentar», entonces la captura se muestra ampliada dentro del ancho de un celular de 360 px sin desplazamiento horizontal. | Propuesto |
| RQ-INI-01-07 | Cualquier persona con usuario comenta una iniciativa (hasta 400 caracteres); el comentario muestra su autor y fecha y no se edita ni se borra. | Debería tener | DT-53 · RN-CAP-014 | Dada una iniciativa abierta, cuando el cocinero escribe un comentario y pulsa «Comentar», entonces aparece al final con su nombre y su rol; un comentario vacío muestra «Escribe tu comentario». | Propuesto |
| RQ-INI-01-08 | Solo el administrador cambia el estado (Nueva, En revisión, Hecha, No por ahora), con confirmación Sí/No y sin saltos prohibidos. | Debería tener | DT-53 · RNF-CAP-006 | Dado un cajero, cuando intenta cambiar el estado por la API, entonces recibe 403 y el estado no cambia; dado el administrador, cuando responde «Sí» a pasar a *En revisión*, entonces el estado cambia y queda su nombre y la hora. | Propuesto |
| RQ-INI-01-09 | El menú muestra al administrador cuántas iniciativas están en estado *Nueva*. | Debería tener | DT-53 | Dadas 3 iniciativas nuevas, cuando el administrador abre el sistema, entonces el menú Iniciativas muestra el número 3; al pasar una a *En revisión*, muestra 2. | Propuesto |
| RQ-INI-01-10 | Subir, comentar y cambiar el estado quedan en el Historial de acciones con quién, cuándo, el antes y el después y la IP, en la misma transacción. | Debería tener | DT-49 · ADR-014 | Dada una iniciativa subida desde la tablet del mozo, cuando el administrador abre el Historial de acciones y filtra el módulo «iniciativas», entonces ve «Subió la iniciativa IN-NNNN» con el nombre del mozo y su IP. | Propuesto |
| RQ-INI-01-11 | Si el registro del historial falla, la acción no se guarda. | Debería tener | ADR-014 | Dada una falla al escribir en el historial, cuando se sube una iniciativa, entonces no se crea la iniciativa y se muestra un aviso para reintentar. | Propuesto |

Prioridad *Debería tener*: no bloquea el piloto; entra en H2 (supuesto D-19). Puede adelantarse porque reutiliza usuarios, fotos privadas y auditoría. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-004 | Usabilidad | Las pantallas se usan desde un celular sin desplazamiento horizontal. | Ancho mínimo 360 px · 0 pantallas con scroll horizontal (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-005 | Accesibilidad | Texto legible para personas mayores y botones fáciles de tocar. | Contraste WCAG AA · objetivos táctiles ≥ 44 px (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-009 y RNF-CAP-014 se cumplen con el historial de acciones y la regla de no borrar; la autorización por rol (RNF-CAP-006) se prueba en el requerimiento del cambio de estado.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| DT-53 | Todo el personal ve y comenta; solo el administrador cambia el estado; siempre se muestra quién la subió. | decisiones.md |
| RN-CAP-014 | Nada se borra ni se edita. | BRD |
| RN-CAP-015 | Toda acción que cambia datos pide confirmación Sí/No. | BRD |
| DT-49 | Cada acción queda en el Historial de acciones con su IP. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-INI-01-01 | HU-CAP-190 | EP-CAP-013 | R-01 |
| RQ-INI-01-02 | HU-CAP-190 | — | R-01 |
| RQ-INI-01-03 | HU-CAP-190 | — | R-01 |
| RQ-INI-01-04 | HU-CAP-191 | — | R-01 |
| RQ-INI-01-05 | HU-CAP-191 | — | R-01 |
| RQ-INI-01-06 | HU-CAP-191 | — | R-01 |
| RQ-INI-01-07 | HU-CAP-192 | — | R-01 |
| RQ-INI-01-08 | HU-CAP-193 | — | R-01 |
| RQ-INI-01-09 | HU-CAP-193 | — | R-01 |
| RQ-INI-01-10 | HU-CAP-194 | FT-USR-04 | R-01 |
| RQ-INI-01-11 | HU-CAP-194 | FT-USR-04 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-190 Subir una iniciativa con captura
- HU-CAP-191 Ver, buscar y filtrar las iniciativas del equipo
- HU-CAP-192 Comentar una iniciativa
- HU-CAP-193 Cambiar el estado de una iniciativa
- HU-CAP-194 Dejar cada acción en el Historial de acciones

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, ADR-012.

**Fuera de alcance**

- Subir de forma anónima: siempre se muestra quién la subió.
- Votos, puntos o premios por iniciativa.
- Aviso por WhatsApp o correo: solo el número en el menú.
- Convertir una iniciativa en tarea o en pedido de cambio: se hace fuera del sistema.

**Preguntas abiertas**

1. **¿Debe entrar en el piloto (H1) o en H2?** Propuesta: H2, porque no bloquea la operación (decisión de Kevin, pendiente).
2. **¿Un cajero puede ver quién sube quejas sobre él?** Por ahora sí, todos ven al autor (DT-53); si genera conflictos se puede limitar la vista al administrador (pendiente).

---

Generado por IA: DT-53, DT-49, ADR-012, ADR-014 y el mockup navegable — Revisado por: *(pendiente)*
