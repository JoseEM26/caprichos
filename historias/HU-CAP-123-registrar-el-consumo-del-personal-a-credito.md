---
id: HU-CAP-123
tipo: hu
titulo: "Registrar el consumo del personal a crédito"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-013, FT-USR-03, RQ-USR-03-01, RQ-USR-03-02, RQ-USR-03-06, HU-CAP-124, HU-CAP-125, ADR-001, ADR-011, ADR-014, ADR-004, ADR-008, D-09, DEP-02, DEP-06, R-01]
tags: [hu, usuarios, capa-a, ft-usr-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-123 | Título | Registrar el consumo del personal a crédito |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-013 · FT-USR-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | registrar el consumo del personal a crédito | que lo que consume el personal quede registrado en su mes |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-USR-03 «Crédito del personal» (Debería tener, épica EP-CAP-013). Cubre los requerimientos: **RQ-USR-03-01** El pedido del personal elige a un trabajador activo, solo en el local o para llevar. **RQ-USR-03-02** Se aplica el descuento del personal salvo a combos, promociones, docenas y lo que ya tiene descuento. **RQ-USR-03-06** Por la carta virtual no se consume crédito. | **Alcance.**<br>• El pedido del personal elige a un trabajador activo, solo en el local o para llevar.<br>• Se aplica el descuento del personal salvo a combos, promociones, docenas y lo que ya tiene descuento.<br>• Por la carta virtual no se consume crédito. |
| **Problema.** Control claro de lo que consume el personal cada mes, sin cuadernos. | **Fuera de alcance.**<br>• HU-CAP-124: Revisar el crédito del personal por mes.<br>• HU-CAP-125: Configurar el descuento del personal y exportar el mes.<br>• Descuento del pago al trabajador (fuera del sistema).<br>• Crédito a clientes (excluido, RN-CAP-058).<br>• Consumo a crédito desde la carta (D-09). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un trabajador desactivado | el cajero busca | no aparece; para un activo, no se ofrece delivery ni reserva (RQ-USR-03-01) |
| CA-2 | un pedido con un café de S/ 8 y un combo de S/ 22 | se aplica el 25 % | el café queda en S/ 6 y el combo en S/ 22 (RQ-USR-03-02) |
| CA-3 | un trabajador que pide en la carta con su cuenta | elige el pago | no aparece «Crédito del personal» (RQ-USR-03-06) |
| CA-4 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-USR-03 (RQ-USR-03-01, RQ-USR-03-02, RQ-USR-03-06); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-036) El personal consume a crédito con 25 % de descuento salvo combos y promociones; sin plazo.<br>**RB-02** (RN-CAP-106) Pedido del personal solo en el local o para llevar, solo usuarios activos; sin descuento en combos, promociones ni docenas.<br>**RB-03** (RN-CAP-131) Sin plazo ni abonos; se suma al mes; solo en Pedidos y caja; no por la carta.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-006, RNF-CAP-009. | `auditoria` (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) · `Usuario` (DNI único, rol, activo, fecha de alta, huella de contraseña, debe cambiarla, foto) · `Rol` · `Permiso` (rol, módulo, acción) · `PinAdministrador` (huella) · `ConsumoPersonal` (usuario, mes, pedido, monto con descuento).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-CAJ-03.<br>• D-09.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Nuevo pedido ▸ Pedido del personal; Créditos del personal por mes (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-USR-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-09 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-USR-03 (requerimientos RQ-USR-03-01, RQ-USR-03-02, RQ-USR-03-06, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
