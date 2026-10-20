---
id: FT-CAR-03
tipo: spec
titulo: "Más vendidos, Conócenos y opinión del cliente"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-001, FT-CAR-01, FT-CFG-01, FT-INF-03, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, NEC-CAP-032, NEC-CAP-033, NEC-CAP-039, RN-CAP-052, RN-CAP-061]
tags: [carta, plt-03, ep-cap-001, ft-car-03, deberia-tener]
---

# FT-CAR-03 — Más vendidos, Conócenos y opinión del cliente

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CARTA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CAR-03 | Más vendidos, Conócenos y opinión del cliente | EP-CAP-001 Carta virtual y catálogo |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (Acta 02 (15/10) y decisión del 17/10) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Tres piezas que completan la carta. (1) **Más vendidos del mes:** los productos más comprados del mes llevan estrellas (tres estrellas al primero, una a los dos siguientes); el ranking se calcula con las ventas del mes, se reinicia solo el día 1 y el mes anterior pasa a un historial; el administrador puede ocultar las estrellas (RN-CAP-052). (2) **Conócenos:** una página aparte con ubicación y mapa, horario por día, teléfono, WhatsApp, redes y fotos del local, todo leído de Configuración del local (NEC-CAP-033, NEC-CAP-042). (3) **«¿Cómo te fue?»:** un formulario al final de la carta para dejar un comentario, sugerencia, felicitación o queja, y un pie de página con ubicación, horario, contacto y redes; los mensajes llegan al administrativo y las quejas avisan al correo del dueño (NEC-CAP-039, RN-CAP-061).

**Beneficio esperado.** Ayuda al cliente a decidir (lo más pedido), da confianza (datos del local completos) y abre un canal directo de opinión sin depender de reseñas públicas. Hipótesis medible: **El ranking del mes coincide al 100 % con las ventas registradas**; **100 % de las quejas avisadas al correo del dueño** en el mismo día.

**Usuarios / roles.** ACT-CAP-006 Clientes (ven estrellas y Conócenos; dejan su opinión) · ACT-CAP-001 Kevin Rosales, dueño y administrador (recibe las quejas y oculta las estrellas si quiere).

**Pantallas de referencia.** Carta ▸ estrellas en tarjetas, página Conócenos, formulario «¿Cómo te fue?» y pie (`Main.dc.html`); administrativo ▸ Mensajes de la carta (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CAR-03-01 | Los tres productos más vendidos del mes llevan estrellas: tres al primero y una a cada uno de los otros dos. | Debería tener | RN-CAP-052 · NEC-CAP-032 | Dadas las ventas del mes con A (40), B (30) y C (20) como los más vendidos, cuando el cliente abre la carta, entonces A lleva tres estrellas y B y C una. | Propuesto |
| RQ-CAR-03-02 | El ranking se reinicia solo el día 1 y el mes anterior pasa al historial. | Debería tener | RN-CAP-052 | Dado el cambio de mes a las 00:00 de Lima, cuando el cliente abre la carta el día 1, entonces no hay estrellas hasta que haya ventas del mes, y el ranking de octubre queda en el historial del administrativo. | Propuesto |
| RQ-CAR-03-03 | El administrador puede ocultar y volver a mostrar las estrellas. | Podría tener | RN-CAP-052 | Dadas las estrellas visibles, cuando el administrador las oculta con confirmación Sí/No, entonces la carta deja de mostrarlas sin perder el ranking. | Propuesto |
| RQ-CAR-03-04 | La página Conócenos muestra ubicación con mapa, horario por día, teléfono, WhatsApp, redes y fotos del local. | Debería tener | NEC-CAP-033 · NEC-CAP-042 | Dada la configuración del local completa, cuando el cliente abre Conócenos, entonces ve cada dato tal como está en Configuración del local y el botón de mapa abre la ubicación. | Propuesto |
| RQ-CAR-03-05 | Conócenos no tiene datos escritos a mano: todo se lee de Configuración del local. | Debe tener | RN-CAP-059 | Dado que el administrador cambia el teléfono en Configuración del local, cuando el cliente abre Conócenos y el pie, entonces ve el teléfono nuevo en los dos sitios. | Propuesto |
| RQ-CAR-03-06 | El formulario «¿Cómo te fue?» recibe comentario, sugerencia, felicitación o queja, con nombre y contacto opcionales. | Debería tener | NEC-CAP-039 | Dado el formulario, cuando el cliente elige «Queja», escribe el texto y envía, entonces ve un agradecimiento y el mensaje queda en el administrativo como «Nuevo». | Propuesto |
| RQ-CAR-03-07 | Una queja avisa al correo del dueño. | Debería tener | RN-CAP-061 · RN-CAP-057 | Dada una queja recibida, cuando se guarda, entonces se envía un aviso al correo del dueño guardado en Configuración y una notificación en el administrativo (FT-INF-03). | Propuesto |
| RQ-CAR-03-08 | Los mensajes no se eliminan: se marcan como atendidos. | Debe tener | RN-CAP-061 · RN-CAP-014 | Dado un mensaje nuevo, cuando el administrador lo marca atendido con Sí/No, entonces cambia de estado, guarda quién y cuándo, y no hay opción de borrarlo. | Propuesto |
| RQ-CAR-03-09 | El pie de la carta muestra ubicación, horario, contacto y redes. | Debería tener | NEC-CAP-039 | Dada la carta, cuando el cliente llega al final, entonces ve el pie con los datos de Configuración del local y enlaces a WhatsApp y redes. | Propuesto |

Prioridad *Debería tener* por la épica (acta 02 y decisión del 17/10); RQ-CAR-03-05 y 08 son *Debe tener* porque aplican reglas generales (RN-CAP-059 y RN-CAP-014). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-008 aplica porque el formulario puede recibir nombre y teléfono; RNF-CAP-019 por el reinicio del ranking a las 00:00 de Lima.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-052 | Los más comprados del mes se marcan con estrellas; el ranking se reinicia el día 1 y el anterior pasa al historial; se pueden ocultar. | Acta 02 (15/10) |
| RN-CAP-057 | Las quejas del bot avisan por correo solo a Kevin. | Acta 02 |
| RN-CAP-059 | Un dato del local tiene una sola fuente: Configuración del local. | Decisión del 17/10 |
| RN-CAP-061 | Las quejas del formulario se avisan al correo del dueño; los mensajes no se eliminan, se marcan atendidos. | Decisión del 17/10 |
| RN-CAP-062 | Solo el administrador sube o quita fotos del local, con confirmación. | Decisión del 17/10 |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CAR-03-01 | HU-CAP-009 | Registro de ventas (FT-CAJ-02) | R-01 |
| RQ-CAR-03-02 | HU-CAP-009 | — | R-01 |
| RQ-CAR-03-03 | HU-CAP-009 | — | R-01 |
| RQ-CAR-03-04 | HU-CAP-010 | FT-CFG-01 · DEP-04 | R-01 |
| RQ-CAR-03-05 | HU-CAP-010 | FT-CFG-01 | R-01 |
| RQ-CAR-03-06 | HU-CAP-011 | — | R-01 |
| RQ-CAR-03-07 | HU-CAP-011 | Correo del dueño (DEP-04) | R-01 |
| RQ-CAR-03-08 | HU-CAP-011 | — | R-01 |
| RQ-CAR-03-09 | HU-CAP-010 | FT-CFG-01 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-009 Ver los más vendidos del mes con estrellas
- HU-CAP-010 Ver la página Conócenos y el pie de la carta
- HU-CAP-011 Enviar mi opinión y atenderla en el administrativo

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006.

**Fuera de alcance**

- Reseñas públicas en la carta (descartadas, DT-13).
- Encuesta posventa por WhatsApp y opiniones en Google Maps: FT-ATN-03.
- Cómo se cargan los datos y las fotos del local: FT-CFG-01.

**Preguntas abiertas**

1. **¿El ranking cuenta unidades o importe?** El BRD dice «más comprados». Propuesta: unidades vendidas, sin contar combos como un solo producto (pendiente de Kevin).
2. **¿Los productos de un combo cuentan para el ranking?** Propuesta: sí, cada producto elegido dentro del combo suma una unidad.

---

Generado por IA: BRD (NEC-CAP-032, 033, 039, 042; RN-CAP-052, 057, 059, 061, 062) y el mockup de la carta y del administrativo — Revisado por: *(pendiente)*
