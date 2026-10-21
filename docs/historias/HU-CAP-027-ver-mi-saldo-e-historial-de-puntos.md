---
id: HU-CAP-027
tipo: hu
titulo: "Ver mi saldo e historial de puntos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-003, FT-CLI-02, RQ-CLI-02-05, RQ-CLI-02-08, HU-CAP-026, HU-CAP-028, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, clientes, capa-a, ft-cli-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-027 | Título | Ver mi saldo e historial de puntos |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-003 · FT-CLI-02 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | ver mi saldo e historial de puntos | saber cuántos puntos tengo y de dónde vienen |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CLI-02 «Puntos y beneficio de cumpleaños» (Debería tener, épica EP-CAP-003). Cubre los requerimientos: **RQ-CLI-02-05** El cliente ve su saldo en la cabecera y su historial de puntos en Mi cuenta, con contraseña. **RQ-CLI-02-08** El cajero no edita puntos. | **Alcance.**<br>• El cliente ve su saldo en la cabecera y su historial de puntos en Mi cuenta, con contraseña.<br>• El cajero no edita puntos. |
| **Problema.** Fidelizar a los clientes frecuentes con un programa simple, sin obligar a nadie a registrarse. | **Fuera de alcance.**<br>• HU-CAP-026: Sumar puntos al cobrar un pedido con cuenta.<br>• HU-CAP-028: Recibir mi cupón de cumpleaños.<br>• Crear y gestionar la cuenta: FT-CLI-01.<br>• Niveles del programa: horizonte futuro.<br>• Cómo se configura el cupón de cumpleaños como cupón: FT-OFE-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cliente que ingresó | abre Mi cuenta | ve su saldo y cada movimiento con fecha, pedido y puntos (RQ-CLI-02-05) |
| CA-2 | la ficha de un cliente abierta por el cajero | busca cómo editar puntos | no hay opción (RQ-CLI-02-08) |

Origen: criterios de verificación de FT-CLI-02 (RQ-CLI-02-05, RQ-CLI-02-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-071) Sumar puntos requiere solo el DNI; ver o canjear requiere la contraseña.<br>**RNF aplicables:** RNF-CAP-009, RNF-CAP-011, RNF-CAP-019. | `Cliente` (DNI o RUC único, nombre, teléfono, correo opcional, cumpleaños día y mes, aceptación con fecha, huella de contraseña) · `MovimientoPuntos` (pedido, puntos, tipo suma o reversa, fecha).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-026** (Sumar puntos al cobrar un pedido con cuenta) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ saldo en la cabecera, Mi cuenta, campanita; administrativo ▸ Clientes ▸ puntos (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CLI-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CLI-02 (requerimientos RQ-CLI-02-05, RQ-CLI-02-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
