---
id: HU-CAP-195
tipo: hu
titulo: "Ver cuántos puntos gano y canjearlos en mi pedido"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-003, FT-CLI-02, RQ-CLI-02-10, RQ-CLI-02-11, RQ-CLI-02-12, RQ-CLI-02-13, HU-CAP-026, HU-CAP-027, HU-CAP-028, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, clientes, capa-a, ft-cli-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-195 | Título | Ver cuántos puntos gano y canjearlos en mi pedido |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-003 · FT-CLI-02 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | ver los puntos que gano al terminar el pedido y canjear mis puntos en él | pagar menos con lo que ya acumulé y saber cuánto gano en cada compra |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CLI-02 «Puntos y beneficio de cumpleaños» (Debería tener, épica EP-CAP-003). Cubre los requerimientos: **RQ-CLI-02-10** Al terminar el pedido, el cliente con cuenta ve los puntos de esta compra y su total; el invitado ve cuánto ganaría y la opción de ingresar, sin que lo bloquee. **RQ-CLI-02-11** En el pedido, el cliente con cuenta escribe cuántos puntos usar, ve sus disponibles y lo que queda, y toca «Aplicar». **RQ-CLI-02-12** No se canjean más puntos que el saldo ni más que el total del pedido; anular un pedido devuelve los puntos canjeados. **RQ-CLI-02-13** En caja, el canje se hace con el DNI del cliente y su contraseña, que escribe el propio cliente. | **Alcance.**<br>• Al terminar el pedido, el cliente con cuenta ve los puntos de esta compra y su total; el invitado ve cuánto ganaría y la opción de ingresar, sin que lo bloquee.<br>• En el pedido, el cliente con cuenta escribe cuántos puntos usar, ve sus disponibles y lo que queda, y toca «Aplicar».<br>• No se canjean más puntos que el saldo ni más que el total del pedido; anular un pedido devuelve los puntos canjeados.<br>• En caja, el canje se hace con el DNI del cliente y su contraseña, que escribe el propio cliente. |
| **Problema.** Fidelizar a los clientes frecuentes con un programa simple que se entiende en soles, sin obligar a nadie a registrarse. Kevin lo considera «generoso» y «vale la pena para mantener la fidelidad» (acta 03). | **Fuera de alcance.**<br>• HU-CAP-026: Sumar puntos al cobrar un pedido con cuenta.<br>• HU-CAP-027: Ver mi saldo e historial de puntos.<br>• HU-CAP-028: Recibir mi cupón de cumpleaños.<br>• Crear y gestionar la cuenta: FT-CLI-01.<br>• Niveles del programa: horizonte futuro.<br>• Cómo se configura el cupón de cumpleaños como cupón: FT-OFE-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cliente con 1,50 puntos que pide S/ 70 | termina | ve «Por esta compra acumulas 3,50 puntos · Tendrás 5,00»; un invitado ve «Ingresa y gana 3,50 puntos con este pedido» y puede seguir sin ingresar (RQ-CLI-02-10) |
| CA-2 | un cliente con 3,50 puntos y un pedido de S/ 20 | escribe 2 en «¿Cuántos puntos deseas usar?» | ve «Te quedan 1,50» y al tocar «Aplicar» el total baja a S/ 18,00 (RQ-CLI-02-11) |
| CA-3 | un saldo de 3,50 | el cliente escribe 5 | ve «Solo tienes 3,50 puntos» y no se aplica; si el pedido con 2 puntos canjeados se anula, el saldo vuelve a subir 2 y el historial muestra la devolución (RQ-CLI-02-12) |
| CA-4 | un cliente con cuenta en el local | el cajero toca «Usar puntos» en el cobro | el cliente escribe su contraseña en la pantalla de caja y el cajero indica cuántos puntos usar; sin contraseña solo se suman puntos (RQ-CLI-02-13) |

Origen: criterios de verificación de FT-CLI-02 (RQ-CLI-02-10, RQ-CLI-02-11, RQ-CLI-02-12, RQ-CLI-02-13); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-071) Sumar puntos requiere solo el DNI; ver o canjear requiere la contraseña.<br>**RB-02** (DT-55) Puntos como saldo, porcentaje general, excepciones marcadas, resumen al terminar y canje en el pedido.<br>**RNF aplicables:** RNF-CAP-009, RNF-CAP-011, RNF-CAP-019. | `Cliente` (DNI o RUC único, nombre, teléfono, correo opcional, cumpleaños día y mes, aceptación con fecha, huella de contraseña) · `MovimientoPuntos` (pedido, puntos, tipo suma o reversa, fecha).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-028** (Recibir mi cupón de cumpleaños) va antes, dentro de la misma feature.<br>• FT-CAJ-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ saldo en la cabecera, resumen al terminar el pedido, «Usar mis puntos», Mi cuenta, campanita; administrativo ▸ Clientes ▸ puntos, cobro (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CLI-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CLI-02 (requerimientos RQ-CLI-02-10, RQ-CLI-02-11, RQ-CLI-02-12, RQ-CLI-02-13, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
