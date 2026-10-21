---
id: HU-CAP-023
tipo: hu
titulo: "Ingresar a mi cuenta con DNI y contraseña"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-003, FT-CLI-01, RQ-CLI-01-04, RQ-CLI-01-05, RQ-CLI-01-11, HU-CAP-022, HU-CAP-024, HU-CAP-025, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008, D-17, DEP-02, DEP-06, R-01]
tags: [hu, clientes, capa-a, ft-cli-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-023 | Título | Ingresar a mi cuenta con DNI y contraseña |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-003 · FT-CLI-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | ingresar a mi cuenta con DNI y contraseña | ver mis puntos y que mis pedidos me los sumen |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CLI-01 «Cuenta del cliente» (Debería tener, épica EP-CAP-003). Cubre los requerimientos: **RQ-CLI-01-04** El cliente ingresa con DNI y contraseña y ve su nombre y sus puntos. **RQ-CLI-01-05** Tras 5 intentos fallidos de contraseña, el ingreso se bloquea unos minutos. **RQ-CLI-01-11** El personal usa la misma cuenta del administrativo para pedir y suma puntos. | **Alcance.**<br>• El cliente ingresa con DNI y contraseña y ve su nombre y sus puntos.<br>• Tras 5 intentos fallidos de contraseña, el ingreso se bloquea unos minutos.<br>• El personal usa la misma cuenta del administrativo para pedir y suma puntos. |
| **Problema.** Conocer a los clientes frecuentes y habilitar el programa de puntos sin frenar la compra como invitado (NEC-CAP-024, NEC-CAP-036). | **Fuera de alcance.**<br>• HU-CAP-022: Crear mi cuenta o seguir como invitado.<br>• HU-CAP-024: Registrar a un cliente en el local y que cree su contraseña.<br>• HU-CAP-025: Buscar y editar clientes en caja.<br>• Puntos, canje y cupón de cumpleaños: FT-CLI-02.<br>• Niveles del programa (Platino, Súper Capricho): horizonte futuro (BRD §4).<br>• Recuperar la contraseña por correo o SMS: pendiente (D-17). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cliente con cuenta | ingresa con su DNI y contraseña | la cabecera muestra su nombre y su saldo de puntos (RQ-CLI-01-04) |
| CA-2 | un DNI con 5 contraseñas erradas seguidas | se intenta una sexta | se rechaza y se avisa cuánto falta para reintentar (RQ-CLI-01-05) |
| CA-3 | un trabajador con usuario | pide para sí mismo | el pedido se asocia a su cuenta y suma puntos al cobrarse (FT-CLI-02) (RQ-CLI-01-11) |

Origen: criterios de verificación de FT-CLI-01 (RQ-CLI-01-04, RQ-CLI-01-05, RQ-CLI-01-11); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-071) El DNI se guarda con aceptación, se enmascara en listas; sumar puntos requiere solo el DNI; ver o canjear requiere contraseña.<br>**RB-02** (RN-CAP-120) Recomendado: límite de intentos y contraseñas solo como huella.<br>**RNF aplicables:** RNF-CAP-007, RNF-CAP-008, RNF-CAP-006, RNF-CAP-009. | `Cliente` (DNI o RUC único, nombre, teléfono, correo opcional, cumpleaños día y mes, aceptación con fecha, huella de contraseña) · `MovimientoPuntos` (pedido, puntos, tipo suma o reversa, fecha).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-022** (Crear mi cuenta o seguir como invitado) va antes, dentro de la misma feature.<br>• FT-CLI-02.<br>• D-17.<br>• FT-USR-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ «Ingresar», crear cuenta, mi cuenta; administrativo ▸ Clientes y Usuarios ▸ pestaña Clientes (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CLI-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-17 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CLI-01 (requerimientos RQ-CLI-01-04, RQ-CLI-01-05, RQ-CLI-01-11, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
