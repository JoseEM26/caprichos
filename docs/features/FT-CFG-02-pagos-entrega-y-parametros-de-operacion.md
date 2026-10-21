---
id: FT-CFG-02
tipo: spec
titulo: "Pagos, entrega y parámetros de operación"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-017, FT-CFG-01, FT-DEL-01, FT-COC-02, FT-USR-03, FT-CLI-02, ADR-001, ADR-011, ADR-014, ADR-010, ADR-012, NEC-CAP-087, NEC-CAP-094]
tags: [configuracion, plt-03, ep-cap-017, ft-cfg-02, debe-tener]
---

# FT-CFG-02 — Pagos, entrega y parámetros de operación

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CONFIGURACION · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CFG-02 | Pagos, entrega y parámetros de operación | EP-CAP-017 Configuración del local |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-087) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El dueño cambia solo los parámetros de operación (NEC-CAP-087): **medios de pago** aceptados con sus datos (número de Yape y Plin, cuenta para transferencia), **tiempo de entrega prometido**, envío gratis y pedido mínimo, **tolerancia de reservas**, **puntos por sol**, **descuento del personal** (NEC-CAP-094), mensajes de WhatsApp, encuesta posventa, entregas fallidas (tiempos, intentos, recargo), **tipos de etiqueta** activos, área de cocina de cada categoría y zonas atendidas. Cada cambio pide confirmación y queda en el historial.

**Beneficio esperado.** Ajustar la operación sin programador y con historial de quién cambió qué. Hipótesis medible: **100 % de parámetros de NEC-CAP-087 editables desde el administrativo**.

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (cambia los parámetros).

**Pantallas de referencia.** Administrativo ▸ Configuración del local ▸ Pagos, Entrega, Operación, Mensajes, Impresión (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CFG-02-01 | El dueño activa los medios de pago y edita sus datos. | Debe tener | NEC-CAP-087 · RN-CAP-011 | Dado Plin desactivado, cuando el cliente elige pago, entonces no lo ve; el número de Yape editado aparece en el mensaje del bot. | Propuesto |
| RQ-CFG-02-02 | El dueño fija el tiempo de entrega prometido. | Debe tener | NEC-CAP-087 · D-01 | Dado 13 minutos, cuando lo cambia a 30, entonces la carta y el bot muestran 30. | Propuesto |
| RQ-CFG-02-03 | El dueño fija envío gratis («más de» o «desde») y pedido mínimo. | Debe tener | RN-CAP-095 · RN-CAP-008 | Dado «más de S/ 70», cuando lo cambia a «desde S/ 70», entonces un pedido de S/ 70 tiene envío gratis. | Propuesto |
| RQ-CFG-02-04 | El dueño fija la tolerancia de reservas, los puntos por sol y el descuento del personal. | Debe tener | NEC-CAP-087 · NEC-CAP-094 | Dada la tolerancia de 15 minutos, cuando la cambia a 20, entonces las reservas nuevas vencen a los 20. | Propuesto |
| RQ-CFG-02-05 | El dueño edita los mensajes de WhatsApp y la encuesta posventa. | Debería tener | NEC-CAP-087 | Dado el mensaje de confirmación, cuando el dueño cambia el texto, entonces los siguientes mensajes usan el nuevo. | Propuesto |
| RQ-CFG-02-06 | El dueño configura entregas fallidas: tiempo, intentos, recargo y recomendación. | Debería tener | NEC-CAP-104 | Dados 2 intentos, cuando cambia a 3, entonces la recomendación de volver sale al tercero. | Propuesto |
| RQ-CFG-02-07 | El dueño activa o desactiva cada tipo de etiqueta. | Debería tener | NEC-CAP-060 | Dada la etiqueta por bebida, cuando se desactiva, entonces deja de imprimirse. | Propuesto |
| RQ-CFG-02-08 | Cada cambio de parámetro pide Sí/No y queda en el historial. | Debe tener | RN-CAP-015 · RNF-CAP-009 | Dado un cambio del tiempo prometido, cuando se confirma, entonces el historial muestra el valor anterior, el nuevo, quién y cuándo. | Propuesto |

Prioridad por NEC-CAP-087 (E1). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-006 aplica: solo el administrador cambia parámetros.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-059 | Un dato del local tiene una sola fuente. | Decisión del 17/10 |
| RN-CAP-095 | Envío gratis «más de 70» por defecto, configurable. | Delivery |
| RN-CAP-106 | El porcentaje del descuento del personal se cambia en Configuración. | Personal |
| V1 a V11 | Valores del prototipo, configurables y por confirmar. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CFG-02-01 | HU-CAP-158 | — | R-01 |
| RQ-CFG-02-02 | HU-CAP-158 | D-01 | R-01 |
| RQ-CFG-02-03 | HU-CAP-158 | D-02 · D-03 | R-01 |
| RQ-CFG-02-04 | HU-CAP-159 | FT-SAL-03 · FT-CLI-02 · FT-USR-03 | R-01 |
| RQ-CFG-02-05 | HU-CAP-159 | FT-BOT-02 · FT-ATN-03 | R-01 |
| RQ-CFG-02-06 | HU-CAP-160 | FT-DEL-03 | R-01 |
| RQ-CFG-02-07 | HU-CAP-160 | FT-COC-02 | R-01 |
| RQ-CFG-02-08 | HU-CAP-158 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-158 Configurar medios de pago y entrega
- HU-CAP-159 Configurar tiempos, tolerancias, puntos y descuento del personal
- HU-CAP-160 Configurar mensajes, entregas fallidas y etiquetas

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-010, ADR-012.

**Fuera de alcance**

- Datos, horario y fotos del local: FT-CFG-01.
- Zonas de reparto: FT-DEL-01.

**Preguntas abiertas**

1. **Valores iniciales** — D-01, D-02, D-03.

---

Generado por IA: BRD (NEC-CAP-060, 087, 094, 104; RN-CAP-008, 011, 015, 059, 095, 106), V1 a V11 y el mockup de Configuración — Revisado por: *(pendiente)*
