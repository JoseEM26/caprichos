---
id: HU-CAP-026
tipo: hu
titulo: "Sumar puntos al cobrar un pedido con cuenta"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-003, FT-CLI-02, RQ-CLI-02-01, RQ-CLI-02-02, RQ-CLI-02-03, RQ-CLI-02-04, RQ-CLI-02-05, RQ-CLI-02-08, HU-CAP-027, HU-CAP-028, HU-CAP-195, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008, D-25, DEP-02, DEP-06, R-01]
tags: [hu, clientes, capa-a, ft-cli-02, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-026 | Título | Sumar puntos al cobrar un pedido con cuenta |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-003 · FT-CLI-02 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | sumar puntos al cobrar un pedido con cuenta | que cada compra pagada me sume puntos una sola vez |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CLI-02 «Puntos y beneficio de cumpleaños» (Debería tener, épica EP-CAP-003). Cubre los requerimientos: **RQ-CLI-02-01** Al cobrarse un pedido con cuenta se suma una sola vez el porcentaje configurado del total, con dos decimales. **RQ-CLI-02-02** Los productos marcados «No suma puntos ni aplica cupones» y los pedidos con cupón no suman puntos. **RQ-CLI-02-03** Un pedido como invitado no suma puntos. **RQ-CLI-02-04** Anular un pedido cobrado resta los puntos que había sumado. **RQ-CLI-02-05** Quien atiende suma puntos con solo el DNI del cliente. **RQ-CLI-02-08** El porcentaje de puntos se cambia en Configuración del local y vale desde ese momento. | **Alcance.**<br>• Al cobrarse un pedido con cuenta se suma una sola vez el porcentaje configurado del total, con dos decimales.<br>• Los productos marcados «No suma puntos ni aplica cupones» y los pedidos con cupón no suman puntos.<br>• Un pedido como invitado no suma puntos.<br>• Anular un pedido cobrado resta los puntos que había sumado.<br>• Quien atiende suma puntos con solo el DNI del cliente.<br>• El porcentaje de puntos se cambia en Configuración del local y vale desde ese momento. |
| **Problema.** Fidelizar a los clientes frecuentes con un programa simple que se entiende en soles, sin obligar a nadie a registrarse. Kevin lo considera «generoso» y «vale la pena para mantener la fidelidad» (acta 03). | **Fuera de alcance.**<br>• HU-CAP-027: Ver mi saldo e historial de puntos.<br>• HU-CAP-028: Recibir mi cupón de cumpleaños.<br>• HU-CAP-195: Ver cuántos puntos gano y canjearlos en mi pedido.<br>• Crear y gestionar la cuenta: FT-CLI-01.<br>• Niveles del programa: horizonte futuro.<br>• Cómo se configura el cupón de cumpleaños como cupón: FT-OFE-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido de S/ 70,00 de un cliente con cuenta y 5 % | se cobra | suma 3,50 puntos; si se reimprime o se vuelve a abrir, no suma otra vez (RQ-CLI-02-01) |
| CA-2 | un pedido con un 2×1 de frappé marcado «No suma puntos» (S/ 15) y un sándwich de S/ 20, con 5 % | se cobra | suma 1,00 punto (solo por el sándwich); un pedido pagado con cupón no suma (RQ-CLI-02-02) |
| CA-3 | un pedido sin cuenta | se cobra | no se suman puntos a nadie (RQ-CLI-02-03) |
| CA-4 | un pedido que sumó 37 puntos | se anula con su motivo | el saldo baja 37 y el historial muestra la reversa (RQ-CLI-02-04) |
| CA-5 | un cliente con cuenta que paga en el local | el cajero escribe su DNI en el pedido | el pedido se asocia y suma al cobrarse, sin pedir contraseña (RQ-CLI-02-05) |
| CA-6 | 5 % | el administrador lo cambia a 3 % con Sí/No | los pedidos cobrados desde entonces suman el 3 % y los anteriores no cambian; el cambio queda en el Historial de acciones (RQ-CLI-02-08) |
| CA-7 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-CLI-02 (RQ-CLI-02-01, RQ-CLI-02-02, RQ-CLI-02-03, RQ-CLI-02-04, RQ-CLI-02-05, RQ-CLI-02-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-071) Sumar puntos requiere solo el DNI; ver o canjear requiere la contraseña.<br>**RB-02** (RN-CAP-072) Los puntos se suman al cobrarse el pedido, una sola vez; el personal también suma.<br>**RB-03** (V8) Se gana el 5 % del total con cuenta (configurable); 1 punto = S/ 1.<br>**RB-04** (DT-55) Puntos como saldo, porcentaje general, excepciones marcadas, resumen al terminar y canje en el pedido.<br>**RNF aplicables:** RNF-CAP-009, RNF-CAP-011, RNF-CAP-019. | `Cliente` (DNI o RUC único, nombre, teléfono, correo opcional, cumpleaños día y mes, aceptación con fecha, huella de contraseña) · `MovimientoPuntos` (pedido, puntos, tipo suma o reversa, fecha).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-CAJ-02 · D-25.<br>• FT-CON-01 · FT-OFE-01.<br>• FT-CAJ-02.<br>• FT-CFG-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ saldo en la cabecera, resumen al terminar el pedido, «Usar mis puntos», Mi cuenta, campanita; administrativo ▸ Clientes ▸ puntos, cobro (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CLI-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-25 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CLI-02 (requerimientos RQ-CLI-02-01, RQ-CLI-02-02, RQ-CLI-02-03, RQ-CLI-02-04, RQ-CLI-02-05, RQ-CLI-02-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
