---
id: HU-CAP-065
tipo: hu
titulo: "Registrar una reserva con una o varias mesas"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-007, FT-SAL-03, RQ-SAL-03-01, RQ-SAL-03-02, RQ-SAL-03-03, HU-CAP-066, HU-CAP-067, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, salon, capa-a, ft-sal-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-065 | Título | Registrar una reserva con una o varias mesas |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-007 · FT-SAL-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-004** Mozos | registrar una reserva con una o varias mesas | guardar la mesa para un cliente que reservó por WhatsApp |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-SAL-03 «Reservas» (Debe tener, épica EP-CAP-007). Cubre los requerimientos: **RQ-SAL-03-01** Una reserva se registra en un solo formulario: nombre, teléfono, personas, hora exacta y mesas. **RQ-SAL-03-02** La hora debe estar dentro del horario del día y no haber pasado. **RQ-SAL-03-03** Los asientos de las mesas elegidas deben alcanzar para las personas. | **Alcance.**<br>• Una reserva se registra en un solo formulario: nombre, teléfono, personas, hora exacta y mesas.<br>• La hora debe estar dentro del horario del día y no haber pasado.<br>• Los asientos de las mesas elegidas deben alcanzar para las personas. |
| **Problema.** Que el equipo vea qué mesas están reservadas y a qué hora, sin libreta. | **Fuera de alcance.**<br>• HU-CAP-066: Ver la reserva en el plano, sentarla o dejar que venza.<br>• HU-CAP-067: Ver las reservas en el calendario del mes.<br>• Reservas desde la web (descartadas, DT-13).<br>• Solicitud de reserva desde el chatbot: FT-BOT-03.<br>• Cobro de garantía o adelanto por reservar (no pedido). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el formulario | el mozo completa todo y confirma | la reserva queda guardada con su autor (RQ-SAL-03-01) |
| CA-2 | un horario de 14:00 a 22:00 | se elige 22:30 o una hora ya pasada | no se puede guardar (RQ-SAL-03-02) |
| CA-3 | una reserva de 8 personas | se eligen las mesas 1 (4) y 2 (2) | se ve «Faltan 2 asientos» y no se guarda; al sumar la mesa 3 (2), sí (RQ-SAL-03-03) |

Origen: criterios de verificación de FT-SAL-03 (RQ-SAL-03-01, RQ-SAL-03-02, RQ-SAL-03-03); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-107) La reserva dura la tolerancia y se anula sola; es solo marca visual; hora válida; asientos suficientes.<br>**RNF aplicables:** RNF-CAP-019, RNF-CAP-008, RNF-CAP-012. | `Piso` (activo) · `ElementoPlano` (tipo, x, y, ancho, alto, giro) · `Mesa` (número, asientos, activa) · `PedidoMesa` (pedido ↔ varias mesas) · `Reserva` (nombre, teléfono, personas, hora, mesas, estado, tolerancia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-CFG-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Reservas (calendario del mes, agenda del día), plano con mesas reservadas (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-SAL-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-SAL-03 (requerimientos RQ-SAL-03-01, RQ-SAL-03-02, RQ-SAL-03-03, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
