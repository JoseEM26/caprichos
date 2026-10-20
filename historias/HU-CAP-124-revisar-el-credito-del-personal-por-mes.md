---
id: HU-CAP-124
tipo: hu
titulo: "Revisar el crédito del personal por mes"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-013, FT-USR-03, RQ-USR-03-03, RQ-USR-03-04, RQ-USR-03-05, RQ-USR-03-08, HU-CAP-123, HU-CAP-125, ADR-001, ADR-011, ADR-014, ADR-004, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, usuarios, capa-a, ft-usr-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-124 | Título | Revisar el crédito del personal por mes |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-013 · FT-USR-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | revisar el crédito del personal por mes | saber cuánto consumió cada trabajador al cerrar el mes |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-USR-03 «Crédito del personal» (Debería tener, épica EP-CAP-013). Cubre los requerimientos: **RQ-USR-03-03** El consumo cargado a crédito se suma al mes del trabajador con su detalle. **RQ-USR-03-04** No hay plazos ni abonos en el crédito. **RQ-USR-03-05** El administrador ve por mes cuánto consumió cada trabajador y el detalle. **RQ-USR-03-08** El crédito no se da a clientes. | **Alcance.**<br>• El consumo cargado a crédito se suma al mes del trabajador con su detalle.<br>• No hay plazos ni abonos en el crédito.<br>• El administrador ve por mes cuánto consumió cada trabajador y el detalle.<br>• El crédito no se da a clientes. |
| **Problema.** Control claro de lo que consume el personal cada mes, sin cuadernos. | **Fuera de alcance.**<br>• HU-CAP-123: Registrar el consumo del personal a crédito.<br>• HU-CAP-125: Configurar el descuento del personal y exportar el mes.<br>• Descuento del pago al trabajador (fuera del sistema).<br>• Crédito a clientes (excluido, RN-CAP-058).<br>• Consumo a crédito desde la carta (D-09). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un consumo de S/ 28 el 15/10 | se cobra a crédito | el mes de octubre del trabajador suma S/ 28 con el pedido y sus productos (RQ-USR-03-03) |
| CA-2 | Créditos del personal | el administrador lo revisa | no hay botón de abono ni fechas de vencimiento (RQ-USR-03-04) |
| CA-3 | octubre | el administrador abre Créditos del personal | ve cada trabajador con su total y, al abrirlo, sus consumos (RQ-USR-03-05) |
| CA-4 | un pedido de un cliente | el cajero cobra | no aparece la opción de crédito (RQ-USR-03-08) |
| CA-5 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-USR-03 (RQ-USR-03-03, RQ-USR-03-04, RQ-USR-03-05, RQ-USR-03-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-058) El crédito es solo para el personal; el porcentaje se configura.<br>**RB-02** (RN-CAP-131) Sin plazo ni abonos; se suma al mes; solo en Pedidos y caja; no por la carta.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-006, RNF-CAP-009. | `auditoria` (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) · `Usuario` (DNI único, rol, activo, fecha de alta, huella de contraseña, debe cambiarla, foto) · `Rol` · `Permiso` (rol, módulo, acción) · `PinAdministrador` (huella) · `ConsumoPersonal` (usuario, mes, pedido, monto con descuento).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-123** (Registrar el consumo del personal a crédito) va antes, dentro de la misma feature.<br>• FT-CAJ-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Nuevo pedido ▸ Pedido del personal; Créditos del personal por mes (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-USR-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-USR-03 (requerimientos RQ-USR-03-03, RQ-USR-03-04, RQ-USR-03-05, RQ-USR-03-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
