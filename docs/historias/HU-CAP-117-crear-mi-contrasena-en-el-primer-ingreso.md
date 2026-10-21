---
id: HU-CAP-117
tipo: hu
titulo: "Crear mi contraseña en el primer ingreso"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-013, FT-USR-01, RQ-USR-01-04, RQ-USR-01-05, RQ-USR-01-06, RQ-USR-01-07, RQ-USR-01-10, HU-CAP-116, HU-CAP-118, HU-CAP-201, ADR-001, ADR-011, ADR-014, ADR-004, ADR-008, D-17, DEP-02, DEP-06, R-01, R-11]
tags: [hu, usuarios, capa-a, ft-usr-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-117 | Título | Crear mi contraseña en el primer ingreso |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-013 · FT-USR-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-004** Mozos | crear mi contraseña en el primer ingreso | que nadie más conozca mi contraseña |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-USR-01 «Usuarios y primer ingreso» (Debe tener, épica EP-CAP-013). Cubre los requerimientos: **RQ-USR-01-04** En el primer ingreso con la contraseña inicial no se entra al escritorio sin crear una nueva. **RQ-USR-01-05** La nueva contraseña tiene al menos 6 caracteres, es distinta de la inicial y se escribe dos veces igual. **RQ-USR-01-06** Hay botón para ver u ocultar la contraseña. **RQ-USR-01-07** Tras crear la contraseña se ofrece, sin obligar, una foto de perfil. **RQ-USR-01-10** Tras 5 intentos fallidos el ingreso se bloquea unos minutos. | **Alcance.**<br>• En el primer ingreso con la contraseña inicial no se entra al escritorio sin crear una nueva.<br>• La nueva contraseña tiene al menos 6 caracteres, es distinta de la inicial y se escribe dos veces igual.<br>• Hay botón para ver u ocultar la contraseña.<br>• Tras crear la contraseña se ofrece, sin obligar, una foto de perfil.<br>• Tras 5 intentos fallidos el ingreso se bloquea unos minutos. |
| **Problema.** Cada persona entra con su propio usuario, sin compartir claves, y el dueño sabe quién hizo qué. | **Fuera de alcance.**<br>• HU-CAP-116: Dar de alta y desactivar a un usuario.<br>• HU-CAP-118: Cambiar mi foto, cambiar mi contraseña y restablecer la de otros.<br>• HU-CAP-201: Definir los días y horas de trabajo de cada persona y quién cubre un descanso.<br>• Roles, permisos y escritorio: FT-USR-02.<br>• Crédito del personal: FT-USR-03.<br>• Registro de asistencia (horizonte futuro).<br>• Ingreso con Google o con código por SMS (no pedido). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un usuario nuevo | entra con 123456 | ve «Crea tu contraseña» y no puede ir a otra pantalla (RQ-USR-01-04) |
| CA-2 | la pantalla de primer ingreso | el usuario escribe «123456» o dos contraseñas distintas | no se acepta; con «café2026» dos veces, sí (RQ-USR-01-05) |
| CA-3 | el campo de contraseña | el usuario toca el ojo | ve el texto; otro toque lo oculta (RQ-USR-01-06) |
| CA-4 | la contraseña creada | aparece la foto de perfil | el usuario puede subirla o tocar «Ahora no» y entra al escritorio (RQ-USR-01-07) |
| CA-5 | 5 intentos errados | se intenta un sexto | se rechaza y se avisa cuánto falta (RQ-USR-01-10) |
| CA-6 | un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-USR-01 (RQ-USR-01-04, RQ-USR-01-05, RQ-USR-01-06, RQ-USR-01-07, RQ-USR-01-10); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-119) Con la inicial no se entra al escritorio; nueva de al menos 6, distinta y escrita dos veces; foto opcional.<br>**RB-02** (RN-CAP-120) Recomendado: caducidad de la inicial, límite de intentos, huella, restablecimiento por el administrador.<br>**RB-03** (D-17) Política de contraseñas del sistema real (propuesta: inicial que vence en 24 horas, 5 intentos, recuperación por el administrador).<br>**RNF aplicables:** RNF-CAP-007, RNF-CAP-006, RNF-CAP-009, RNF-CAP-008. | `auditoria` (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) · `Usuario` (DNI único, rol, activo, fecha de alta, huella de contraseña, debe cambiarla, foto) · `Rol` · `Permiso` (rol, módulo, acción) · `PinAdministrador` (huella) · `ConsumoPersonal` (usuario, mes, pedido, monto con descuento).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-116** (Dar de alta y desactivar a un usuario) va antes, dentro de la misma feature.<br>• D-17.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01, R-11 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Usuarios (pestaña Personal), primer ingreso, Mi perfil (`Admin.dc.html`); `analisis/primer-ingreso-y-contrasenas.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-USR-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-17 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-USR-01 (requerimientos RQ-USR-01-04, RQ-USR-01-05, RQ-USR-01-06, RQ-USR-01-07, RQ-USR-01-10, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
