---
id: FT-CFG-01
tipo: spec
titulo: "Datos del local, horario y fechas especiales"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-017, FT-CFG-02, FT-CAR-02, FT-CAR-03, FT-SAL-03, ADR-001, ADR-011, ADR-014, ADR-010, ADR-012, NEC-CAP-038, NEC-CAP-042, RN-CAP-059, RN-CAP-060]
tags: [configuracion, plt-03, ep-cap-017, ft-cfg-01, debe-tener]
---

# FT-CFG-01 — Datos del local, horario y fechas especiales

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CONFIGURACION · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CFG-01 | Datos del local, horario y fechas especiales | EP-CAP-017 Configuración del local |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-038 · RN-CAP-059) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Toda la información del local se administra en **un solo módulo**, Configuración del local, y se refleja en la carta, el chatbot y el administrativo (NEC-CAP-038, RN-CAP-059): nombre, logo, RUC, dirección, **ubicación de la tienda** (con «usar mi ubicación actual», búsqueda o enlace de Google Maps), teléfono, WhatsApp, correo del dueño, redes, Wi-Fi, términos y privacidad, y **fotos del local** (NEC-CAP-042). El **horario por día** y las **fechas especiales** (feriados cerrados u horarios distintos) deciden si el local aparece abierto y qué horas se ofrecen para reservar; una fecha especial manda sobre el horario normal (RN-CAP-060). Solo el administrador sube o quita fotos, con confirmación (RN-CAP-062). El módulo Ajustes se quitó: sus datos útiles viven aquí (NEC-CAP-055).

**Beneficio esperado.** Un dato se escribe una sola vez y no hay teléfonos ni horarios distintos en cada canal (DT-20). Hipótesis medible: **0 datos del local escritos a mano fuera de Configuración** (revisión de pantallas).

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (mantiene la configuración).

**Pantallas de referencia.** Administrativo ▸ Configuración del local ▸ Datos, Ubicación, Horario, Fechas especiales, Fotos (`Admin.dc.html`); `analisis/configuracion-centralizada.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CFG-01-01 | El administrador edita nombre, logo, RUC, dirección, teléfono, WhatsApp, correo, redes, Wi-Fi, términos y privacidad. | Debe tener | NEC-CAP-038 · NEC-CAP-087 | Dado el formulario, cuando cambia el WhatsApp con Sí/No, entonces la carta, el chatbot y los mensajes usan el nuevo número. | Propuesto |
| RQ-CFG-01-02 | La ubicación de la tienda se fija con ubicación actual, búsqueda o enlace de Google Maps. | Debe tener | NEC-CAP-038 · NEC-CAP-087 | Dado el panel de ubicación, cuando el administrador pega un enlace de Google Maps, entonces se leen latitud y longitud y se ve el pin; con «Usar mi ubicación actual» se toma la del equipo. | Propuesto |
| RQ-CFG-01-03 | Un dato del local tiene una sola fuente: ninguna otra pantalla lo escribe. | Debe tener | RN-CAP-059 · DT-20 | Dado el teléfono cambiado, cuando se revisan Conócenos, el pie, el bot y el comprobante, entonces todos muestran el nuevo. | Propuesto |
| RQ-CFG-01-04 | El horario se define por día de la semana. | Debe tener | RN-CAP-060 · NEC-CAP-038 | Dado el lunes cerrado y de martes a domingo de 14:00 a 22:00, cuando un cliente abre la carta un lunes, entonces ve «Cerrado». | Propuesto |
| RQ-CFG-01-05 | Las fechas especiales (cerrado u horario distinto) mandan sobre el horario normal. | Debe tener | RN-CAP-060 | Dado el 25/12 cerrado, cuando es 25/12, entonces la carta y el bot no reciben pedidos y Reservas no ofrece horas. | Propuesto |
| RQ-CFG-01-06 | Solo el administrador sube y quita fotos del local, con Sí/No. | Debería tener | NEC-CAP-042 · RN-CAP-062 | Dado un cajero, cuando abre la configuración, entonces no puede tocar las fotos; el administrador quita una con confirmación. | Propuesto |
| RQ-CFG-01-07 | Las fotos del local aparecen en sus espacios de la carta y Conócenos. | Debería tener | NEC-CAP-042 | Dadas 4 fotos, cuando el cliente abre Conócenos, entonces las ve en la galería. | Propuesto |

Prioridad por NEC-CAP-038 (E1). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-019 aplica al horario y las fechas especiales.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-059 | Un dato del local tiene una sola fuente: Configuración del local. | Decisión del 17/10 |
| RN-CAP-060 | Horario por día y fechas especiales; la fecha especial manda. | Decisión del 17/10 |
| RN-CAP-062 | Solo el administrador sube o quita fotos, con Sí/No. | Decisión del 17/10 |
| DT-20 | Un dato del local se escribe una sola vez. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CFG-01-01 | HU-CAP-155 | DEP-04 (D-15) | R-01 |
| RQ-CFG-01-02 | HU-CAP-155 | — | R-01 |
| RQ-CFG-01-03 | HU-CAP-155 | — | R-01 |
| RQ-CFG-01-04 | HU-CAP-156 | D-04 | R-01 |
| RQ-CFG-01-05 | HU-CAP-156 | — | R-01 |
| RQ-CFG-01-06 | HU-CAP-157 | — | R-01 |
| RQ-CFG-01-07 | HU-CAP-157 | FT-CAR-03 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-155 Editar los datos y la ubicación del local
- HU-CAP-156 Definir horario por día y fechas especiales
- HU-CAP-157 Subir y quitar fotos del local

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-010, ADR-012.

**Fuera de alcance**

- Pagos, entrega, zonas y parámetros de operación: FT-CFG-02.

**Preguntas abiertas**

1. **Datos reales del negocio** — D-15, DEP-04.
2. **Horario** — D-04.

---

Generado por IA: BRD (NEC-CAP-038, 042, 055, 087; RN-CAP-059, 060, 062), DT-20, `analisis/configuracion-centralizada.md` y el mockup — Revisado por: *(pendiente)*
