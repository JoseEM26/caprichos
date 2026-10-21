---
id: HU-CAP-201
tipo: hu
titulo: "Definir los días y horas de trabajo de cada persona y quién cubre un descanso"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-013, FT-USR-01, RQ-USR-01-14, RQ-USR-01-15, RQ-USR-01-16, HU-CAP-116, HU-CAP-117, HU-CAP-118, ADR-001, ADR-011, ADR-014, ADR-004, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, usuarios, capa-a, ft-usr-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-201 | Título | Definir los días y horas de trabajo de cada persona y quién cubre un descanso |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-013 · FT-USR-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | definir los días y horas de trabajo de cada persona y quién cubre un descanso | que cada aviso le llegue a quien de verdad está trabajando ese día y a esa hora |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-USR-01 «Usuarios y primer ingreso» (Debe tener, épica EP-CAP-013). Cubre los requerimientos: **RQ-USR-01-14** El administrador define el horario de trabajo de cada usuario: días de la semana y hora de entrada y salida de cada día. **RQ-USR-01-15** El administrador registra la cobertura de un día puntual: quién reemplaza a quién en su descanso. **RQ-USR-01-16** El sistema dice quién está de turno en cada rol en un momento dado, según horarios y coberturas. | **Alcance.**<br>• El administrador define el horario de trabajo de cada usuario: días de la semana y hora de entrada y salida de cada día.<br>• El administrador registra la cobertura de un día puntual: quién reemplaza a quién en su descanso.<br>• El sistema dice quién está de turno en cada rol en un momento dado, según horarios y coberturas. |
| **Problema.** Cada persona entra con su propio usuario, sin compartir claves, y el dueño sabe quién hizo qué. | **Fuera de alcance.**<br>• HU-CAP-116: Dar de alta y desactivar a un usuario.<br>• HU-CAP-117: Crear mi contraseña en el primer ingreso.<br>• HU-CAP-118: Cambiar mi foto, cambiar mi contraseña y restablecer la de otros.<br>• Roles, permisos y escritorio: FT-USR-02.<br>• Crédito del personal: FT-USR-03.<br>• Registro de asistencia (horizonte futuro).<br>• Ingreso con Google o con código por SMS (no pedido). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | Marvel | el administrador marca lunes a sábado de 15:00 a 23:00 y el domingo libre, y a la repostera de 06:00 a 12:00 | la ficha de cada uno muestra su horario y se guarda con Sí/No (RQ-USR-01-14) |
| CA-2 | el jueves 22/10 como descanso de Marvel | el administrador registra que lo cubre Jeffrey de 15:00 a 23:00 | ese día Jeffrey figura de turno en almacén y Marvel no (RQ-USR-01-15) |
| CA-3 | el jueves 22/10 a las 16:00 | el sistema busca a quién avisar en almacén | devuelve a Jeffrey; a las 07:00 no devuelve a nadie de almacén (RQ-USR-01-16) |
| CA-4 | un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |
| CA-5 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-USR-01 (RQ-USR-01-14, RQ-USR-01-15, RQ-USR-01-16); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-64) Cada usuario tiene su horario de trabajo y sus coberturas; los usuarios son personales.<br>**RNF aplicables:** RNF-CAP-007, RNF-CAP-006, RNF-CAP-009, RNF-CAP-008. | `auditoria` (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) · `Usuario` (DNI único, rol, activo, fecha de alta, huella de contraseña, debe cambiarla, foto) · `Rol` · `Permiso` (rol, módulo, acción) · `PinAdministrador` (huella) · `ConsumoPersonal` (usuario, mes, pedido, monto con descuento).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-118** (Cambiar mi foto, cambiar mi contraseña y restablecer la de otros) va antes, dentro de la misma feature.<br>• FT-ALM-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Usuarios (pestaña Personal), primer ingreso, Mi perfil (`Admin.dc.html`); `analisis/primer-ingreso-y-contrasenas.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-USR-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-USR-01 (requerimientos RQ-USR-01-14, RQ-USR-01-15, RQ-USR-01-16, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
