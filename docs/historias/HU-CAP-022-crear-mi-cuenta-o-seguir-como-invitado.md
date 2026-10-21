---
id: HU-CAP-022
tipo: hu
titulo: "Crear mi cuenta o seguir como invitado"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-003, FT-CLI-01, RQ-CLI-01-01, RQ-CLI-01-02, RQ-CLI-01-03, HU-CAP-023, HU-CAP-024, HU-CAP-025, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008, D-18, DEP-02, DEP-06, R-01, R-11]
tags: [hu, clientes, capa-a, ft-cli-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-022 | Título | Crear mi cuenta o seguir como invitado |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-003 · FT-CLI-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | crear mi cuenta o seguir como invitado | acumular puntos si quiero, sin que me obliguen a registrarme |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CLI-01 «Cuenta del cliente» (Debería tener, épica EP-CAP-003). Cubre los requerimientos: **RQ-CLI-01-01** La carta ofrece «Ingresar» con tres caminos: ingresar, crear cuenta o seguir como invitado. **RQ-CLI-01-02** Crear cuenta pide DNI, nombre, contraseña escrita dos veces, cumpleaños por calendario y aceptación; el correo es opcional. **RQ-CLI-01-03** Un DNI no puede tener dos cuentas. | **Alcance.**<br>• La carta ofrece «Ingresar» con tres caminos: ingresar, crear cuenta o seguir como invitado.<br>• Crear cuenta pide DNI, nombre, contraseña escrita dos veces, cumpleaños por calendario y aceptación; el correo es opcional.<br>• Un DNI no puede tener dos cuentas. |
| **Problema.** Conocer a los clientes frecuentes y habilitar el programa de puntos sin frenar la compra como invitado (NEC-CAP-024, NEC-CAP-036). | **Fuera de alcance.**<br>• HU-CAP-023: Ingresar a mi cuenta con DNI y contraseña.<br>• HU-CAP-024: Registrar a un cliente en el local y que cree su contraseña.<br>• HU-CAP-025: Buscar y editar clientes en caja.<br>• Puntos, canje y cupón de cumpleaños: FT-CLI-02.<br>• Niveles del programa (Platino, Súper Capricho): horizonte futuro (BRD §4).<br>• Recuperar la contraseña por correo o SMS: pendiente (D-17). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cliente sin sesión | toca «Ingresar» | ve las tres opciones y «Seguir como invitado» lo devuelve a la carta sin pedir nada (RQ-CLI-01-01) |
| CA-2 | el formulario | el cliente deja el correo vacío y acepta | la cuenta se crea; sin aceptación, sin cumpleaños (persona) o con las contraseñas distintas, no (RQ-CLI-01-02) |
| CA-3 | un DNI ya registrado | alguien intenta crear otra cuenta con él | ve «Ese DNI ya tiene cuenta» con la opción de ingresar (RQ-CLI-01-03) |

Origen: criterios de verificación de FT-CLI-01 (RQ-CLI-01-01, RQ-CLI-01-02, RQ-CLI-01-03); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-110) El cumpleaños se guarda como día y mes; obligatorio para personas.<br>**RNF aplicables:** RNF-CAP-007, RNF-CAP-008, RNF-CAP-006, RNF-CAP-009. | `Cliente` (DNI o RUC único, nombre, teléfono, correo opcional, cumpleaños día y mes, aceptación con fecha, huella de contraseña) · `MovimientoPuntos` (pedido, puntos, tipo suma o reversa, fecha).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-LEG-02 · D-18.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01, R-11 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ «Ingresar», crear cuenta, mi cuenta; administrativo ▸ Clientes y Usuarios ▸ pestaña Clientes (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CLI-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-18 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CLI-01 (requerimientos RQ-CLI-01-01, RQ-CLI-01-02, RQ-CLI-01-03, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
