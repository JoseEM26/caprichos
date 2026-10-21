---
id: FT-PLA-04
tipo: spec
titulo: "Vigilancia y alertas"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-01, FT-PLA-03, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DT-44, DT-45, DT-46, RNF-CAP-003, RNF-CAP-008]
tags: [plataforma, plt-03, ep-cap-021, ft-pla-04, debe-tener]
---

# FT-PLA-04 — Vigilancia y alertas

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PLATAFORMA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-PLA-04 | Vigilancia y alertas | EP-CAP-021 Plataforma, despliegue y operación |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (DT-44 · DT-45 · DT-46) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** **Uptime Kuma** revisa cada minuto la carta, la API (`/salud`), el WebSocket, el webhook de WhatsApp, el agente de impresión (último latido) y la copia del día, y **avisa al celular** por Telegram o WhatsApp si algo cae (DT-44). **GlitchTip** recibe los errores de la API, el front y el bot, sin DNI, teléfonos ni tokens (DT-45). Los **registros** JSON (pino) se leen en el panel de Dokploy y se rotan para no llenar el disco; Grafana, Loki y Prometheus quedan para después del piloto (DT-46). Qué hacer cuando algo se cae está en `operacion/RB-CAP-003`.

**Beneficio esperado.** Enterarse de una caída antes que el cliente y saber qué falló. Hipótesis medible: **Aviso en menos de 2 minutos** ante una caída de la API; **disponibilidad medida** cada mes (RNF-CAP-003).

**Usuarios / roles.** Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD) (recibe los avisos y resuelve) · ACT-CAP-001 Kevin Rosales, dueño y administrador (puede recibir el aviso de caída general).

**Pantallas de referencia.** No tiene pantallas de negocio: se opera desde GitHub, el panel de Dokploy, Uptime Kuma y GlitchTip (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-PLA-04-01 | Uptime Kuma revisa cada minuto la carta, la API, el WebSocket, el webhook de WhatsApp, el agente de impresión y la copia del día. | Debe tener | DT-44 | Dados los 6 monitores, cuando se apaga la API en pruebas, entonces su monitor pasa a rojo en el minuto siguiente. | Propuesto |
| RQ-PLA-04-02 | Una caída llega como aviso al celular y la recuperación también. | Debe tener | DT-44 | Dada la API caída, cuando pasan 2 minutos, entonces llega el aviso al celular configurado; al volver, llega «recuperado» con la duración. | Propuesto |
| RQ-PLA-04-03 | Uptime Kuma mide la disponibilidad mensual en horario de atención. | Debería tener | RNF-CAP-003 | Dado el fin de mes, cuando se revisa el reporte, entonces se ve el porcentaje de disponibilidad de la carta y de la API. | Propuesto |
| RQ-PLA-04-04 | Los errores de la API, el front y el bot llegan a GlitchTip sin DNI, teléfonos, contraseñas ni tokens. | Debe tener | DT-45 · RNF-CAP-008 | Dado un error al cobrar con el DNI 00000012 en la solicitud, cuando se revisa en GlitchTip, entonces el DNI aparece enmascarado y no hay tokens. | Propuesto |
| RQ-PLA-04-05 | Los registros JSON llevan el número de solicitud y de pedido y se rotan para no llenar el disco. | Debe tener | DT-46 | Dado un día de hora punta, cuando se revisa el disco, entonces los registros de Docker no superan el tamaño configurado y se puede buscar por número de pedido. | Propuesto |
| RQ-PLA-04-06 | Qué hacer cuando un servicio se cae está escrito en RB-CAP-003. | Debe tener | DT-51 | Dada la API caída, cuando se sigue RB-CAP-003, entonces se identifica la causa con los registros y se vuelve a levantar o se vuelve a la versión anterior. | Propuesto |

Prioridad *Debe tener* para el piloto: una caída en hora punta tiene que avisarse sola. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-003 | Disponibilidad | La carta, el administrativo y el chatbot están en línea durante el horario de atención. | ≥ 99,5 % mensual en horario · medición: monitoreo externo (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-003 se mide con Uptime Kuma.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| DT-44 | Uptime Kuma con avisos al celular. | decisiones.md |
| DT-45 | GlitchTip en el VPS, sin datos personales. | decisiones.md |
| DT-46 | Grafana, Loki y Prometheus después del piloto. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-PLA-04-01 | HU-CAP-186 | — | R-01 |
| RQ-PLA-04-02 | HU-CAP-186 | — | R-01 |
| RQ-PLA-04-03 | HU-CAP-186 | — | R-01 |
| RQ-PLA-04-04 | HU-CAP-187 | — | R-01 |
| RQ-PLA-04-05 | HU-CAP-187 | — | R-01 |
| RQ-PLA-04-06 | HU-CAP-187 | operacion/RB-CAP-003 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-186 Recibir un aviso en el celular si algo se cae
- HU-CAP-187 Capturar errores y revisar registros

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.

**Fuera de alcance**

- Paneles de métricas con historial (después del piloto, DT-46).

**Preguntas abiertas**

1. **¿A qué celular y por qué canal llegan los avisos?** Propuesta: Telegram al celular de José; el aviso de caída general también a Kevin.

---

Generado por IA: DT-44, DT-45, DT-46, ADR-012 y DT-51 — Revisado por: *(pendiente)*
