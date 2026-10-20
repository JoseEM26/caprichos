---
id: HU-CAP-122
tipo: hu
titulo: "Autorizar una acción sensible con el PIN del administrador"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-013, FT-USR-02, RQ-USR-02-07, RQ-USR-02-08, HU-CAP-119, HU-CAP-120, HU-CAP-121, ADR-001, ADR-011, ADR-014, ADR-004, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, usuarios, capa-a, ft-usr-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-122 | Título | Autorizar una acción sensible con el PIN del administrador |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-013 · FT-USR-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | autorizar una acción sensible con el PIN del administrador | que las acciones delicadas no se hagan sin mi autorización |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-USR-02 «Roles, permisos y escritorio por rol» (Debe tener, épica EP-CAP-013). Cubre los requerimientos: **RQ-USR-02-07** Las acciones sensibles hechas por otro rol exigen el PIN del administrador. **RQ-USR-02-08** El administrador cambia su PIN, que se guarda como huella. | **Alcance.**<br>• Las acciones sensibles hechas por otro rol exigen el PIN del administrador.<br>• El administrador cambia su PIN, que se guarda como huella. |
| **Problema.** Que cada persona vea solo lo que necesita (NEC-CAP-010) y que los procesos y roles queden documentados (NEC-CAP-008). | **Fuera de alcance.**<br>• HU-CAP-119: Asignar un rol y ver solo mis módulos.<br>• HU-CAP-120: Ver mi escritorio según mi rol.<br>• HU-CAP-121: Editar la matriz de permisos por rol.<br>• Altas y primer ingreso: FT-USR-01.<br>• Permisos por usuario distintos a su rol (no pedido). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cajero que anula un pedido | confirma | se pide el PIN del administrador y sin él no se anula (RQ-USR-02-07) |
| CA-2 | el perfil del administrador | cambia su PIN de 4 a 6 dígitos | el nuevo vale y el anterior no (RQ-USR-02-08) |
| CA-3 | un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-USR-02 (RQ-USR-02-07, RQ-USR-02-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-094) Condiciones del crédito y ofertas solo las edita el administrador; anular por otro rol exige su PIN.<br>**RNF aplicables:** RNF-CAP-006, RNF-CAP-007, RNF-CAP-009. | `auditoria` (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) · `Usuario` (DNI único, rol, activo, fecha de alta, huella de contraseña, debe cambiarla, foto) · `Rol` · `Permiso` (rol, módulo, acción) · `PinAdministrador` (huella) · `ConsumoPersonal` (usuario, mes, pedido, monto con descuento).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-121** (Editar la matriz de permisos por rol) va antes, dentro de la misma feature.<br>• FT-CAJ-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Roles y permisos, escritorio de cada rol, selector de rol del mockup (`Admin.dc.html`); `analisis/modulos-y-roles.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-USR-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-USR-02 (requerimientos RQ-USR-02-07, RQ-USR-02-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
