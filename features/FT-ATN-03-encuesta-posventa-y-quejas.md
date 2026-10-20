---
id: FT-ATN-03
tipo: spec
titulo: "Encuesta posventa y quejas"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-015, FT-ATN-01, FT-CAR-03, FT-INF-03, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009, NEC-CAP-029, RN-CAP-042, RN-CAP-057]
tags: [atencion, plt-03, ep-cap-015, ft-atn-03, podria-tener]
---

# FT-ATN-03 — Encuesta posventa y quejas

**PLT-03 · Feature · Catálogo de requerimientos** · Frente ATENCION · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-ATN-03 | Encuesta posventa y quejas | EP-CAP-015 Atención por WhatsApp y posventa |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Podría tener** (NEC-CAP-029) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Dos horas después de la entrega, el bot envía una **encuesta corta** al cliente (NEC-CAP-029). Una opinión **positiva** invita a opinar en **Google Maps** con el enlace del local; una **negativa** se deriva a una persona y se avisa por WhatsApp a la gerencia y por correo a Kevin (RN-CAP-042, RN-CAP-057). El texto de la encuesta y su envío se configuran (NEC-CAP-087). Los resultados alimentan los informes (FT-INF-01).

**Beneficio esperado.** Más opiniones positivas públicas y quejas atendidas antes de que escalen. Hipótesis medible: **100 % de quejas avisadas a gerencia el mismo día**; **tasa de respuesta a la encuesta medida**.

**Usuarios / roles.** Chatbot de WhatsApp, sistema (envía la encuesta) · ACT-CAP-006 Clientes (responde) · ACT-CAP-001 Kevin Rosales, dueño y administrador (recibe las quejas).

**Pantallas de referencia.** Chatbot ▸ encuesta; Configuración del local ▸ Encuesta posventa (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-ATN-03-01 | A las 2 horas de entregado, el bot envía la encuesta. | Podría tener | NEC-CAP-029 · BRD §6 | Dado un pedido entregado a las 15:00, cuando son las 17:00, entonces el cliente recibe la encuesta con botones de 1 a 5. | Propuesto |
| RQ-ATN-03-02 | Una respuesta positiva invita a opinar en Google Maps. | Podría tener | RN-CAP-042 | Dado un 5, cuando el cliente responde, entonces recibe el agradecimiento y el enlace de Google Maps del local. | Propuesto |
| RQ-ATN-03-03 | Una respuesta negativa pasa a una persona y avisa a gerencia y al correo de Kevin. | Podría tener | RN-CAP-042 · RN-CAP-057 | Dado un 2, cuando el cliente responde, entonces el bot pide el motivo, el chat pasa a una persona y gerencia recibe el aviso. | Propuesto |
| RQ-ATN-03-04 | El texto, el tiempo de envío y si está activa se configuran. | Podría tener | NEC-CAP-087 | Dada la encuesta, cuando el administrador cambia el tiempo a 3 horas, entonces las siguientes se envían a las 3 horas. | Propuesto |
| RQ-ATN-03-05 | Un cliente recibe como máximo una encuesta por día. | Podría tener | Propuesta (calidad) | Dado un cliente con dos pedidos el mismo día, cuando se entregan, entonces recibe una sola encuesta. | Propuesto |

Prioridad *Podría tener* por la épica; depende de WhatsApp y del costo de plantillas (RN-CAP-100). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-015 | Costo | El uso de IA y de plantillas de WhatsApp se registra y tiene un tope mensual configurable. | Costo mensual visible · alerta al 80 % del tope (umbral propuesto) | Podría tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Podría tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-015 aplica porque la encuesta fuera de las 24 horas usa plantilla pagada.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-042 | Positiva a Google Maps; negativa a una persona con aviso a gerencia. | Acta 02 |
| RN-CAP-057 | Las quejas avisan por correo solo a Kevin y al grupo del equipo. | Acta 02 |
| RN-CAP-100 | Fuera de 24 horas el mensaje es plantilla y se cobra. | Costos |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-ATN-03-01 | HU-CAP-142 | DEP-12 | R-04 |
| RQ-ATN-03-02 | HU-CAP-142 | FT-CFG-01 | R-01 |
| RQ-ATN-03-03 | HU-CAP-143 | FT-ATN-01 · FT-INF-03 | R-01 |
| RQ-ATN-03-04 | HU-CAP-143 | FT-CFG-02 | R-01 |
| RQ-ATN-03-05 | HU-CAP-142 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-142 Responder la encuesta posventa
- HU-CAP-143 Atender una opinión negativa

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009.

**Fuera de alcance**

- Formulario «¿Cómo te fue?» de la carta: FT-CAR-03.
- Reseñas públicas en la carta (descartadas, DT-13).

**Preguntas abiertas**

1. **Grupo de WhatsApp del equipo para avisos** — RN-CAP-057 lo deja por definir.
2. **Escala de la encuesta** — propuesta: 1 a 5, con 4 y 5 como positivas.

---

Generado por IA: BRD (NEC-CAP-029, 087; RN-CAP-042, 057, 100) y el mockup — Revisado por: *(pendiente)*
