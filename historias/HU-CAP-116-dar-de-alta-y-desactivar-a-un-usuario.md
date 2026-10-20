---
id: HU-CAP-116
tipo: hu
titulo: "Dar de alta y desactivar a un usuario"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-013, FT-USR-01, RQ-USR-01-01, RQ-USR-01-02, RQ-USR-01-03, RQ-USR-01-11, HU-CAP-117, HU-CAP-118, ADR-001, ADR-011, ADR-014, ADR-004, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, usuarios, capa-a, ft-usr-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-116 | Título | Dar de alta y desactivar a un usuario |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-013 · FT-USR-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | dar de alta y desactivar a un usuario | que cada persona del equipo entre con su propio usuario |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-USR-01 «Usuarios y primer ingreso» (Debe tener, épica EP-CAP-013). Cubre los requerimientos: **RQ-USR-01-01** El administrador da de alta a un usuario con nombre, DNI, teléfono, rol y fecha de alta. **RQ-USR-01-02** Un DNI no se repite entre usuarios. **RQ-USR-01-03** Un usuario se desactiva y se reactiva; no se elimina. **RQ-USR-01-11** La lista de usuarios se filtra por rol, estado y fechas de alta. | **Alcance.**<br>• El administrador da de alta a un usuario con nombre, DNI, teléfono, rol y fecha de alta.<br>• Un DNI no se repite entre usuarios.<br>• Un usuario se desactiva y se reactiva; no se elimina.<br>• La lista de usuarios se filtra por rol, estado y fechas de alta. |
| **Problema.** Cada persona entra con su propio usuario, sin compartir claves, y el dueño sabe quién hizo qué. | **Fuera de alcance.**<br>• HU-CAP-117: Crear mi contraseña en el primer ingreso.<br>• HU-CAP-118: Cambiar mi foto y restablecer contraseñas.<br>• Roles, permisos y escritorio: FT-USR-02.<br>• Crédito del personal: FT-USR-03.<br>• Registro de asistencia (horizonte futuro).<br>• Ingreso con Google o con código por SMS (no pedido). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el formulario | el administrador crea a «Ana, cajera» | queda activa con la contraseña inicial y la fecha de alta (RQ-USR-01-01) |
| CA-2 | un DNI ya usado | se crea otro usuario con él | no se acepta (RQ-USR-01-02) |
| CA-3 | Ana activa | el administrador la desactiva con Sí/No | no puede entrar y su historial se conserva; al reactivarla vuelve a entrar (RQ-USR-01-03) |
| CA-4 | 12 usuarios | el administrador filtra «Cajero» activos dados de alta en octubre | solo ve esos (RQ-USR-01-11) |
| CA-5 | un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |
| CA-6 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-USR-01 (RQ-USR-01-01, RQ-USR-01-02, RQ-USR-01-03, RQ-USR-01-11); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-098) Los usuarios no se eliminan; la contraseña inicial es común y se cambia en el primer ingreso; ninguna se guarda en texto.<br>**RNF aplicables:** RNF-CAP-007, RNF-CAP-006, RNF-CAP-009, RNF-CAP-008. | `auditoria` (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) · `Usuario` (DNI único, rol, activo, fecha de alta, huella de contraseña, debe cambiarla, foto) · `Rol` · `Permiso` (rol, módulo, acción) · `PinAdministrador` (huella) · `ConsumoPersonal` (usuario, mes, pedido, monto con descuento).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Usuarios (pestaña Personal), primer ingreso, Mi perfil (`Admin.dc.html`); `analisis/primer-ingreso-y-contrasenas.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-USR-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-USR-01 (requerimientos RQ-USR-01-01, RQ-USR-01-02, RQ-USR-01-03, RQ-USR-01-11, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
