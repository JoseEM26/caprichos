---
id: HU-CAP-024
tipo: hu
titulo: "Registrar a un cliente en el local y que cree su contraseña"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-003, FT-CLI-01, RQ-CLI-01-06, RQ-CLI-01-07, HU-CAP-022, HU-CAP-023, HU-CAP-025, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008, D-17, DEP-02, DEP-06, R-01]
tags: [hu, clientes, capa-a, ft-cli-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-024 | Título | Registrar a un cliente en el local y que cree su contraseña |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-003 · FT-CLI-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | registrar a un cliente en el local y que cree su contraseña | que un cliente sin cuenta empiece a sumar puntos desde el local |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CLI-01 «Cuenta del cliente» (Debería tener, épica EP-CAP-003). Cubre los requerimientos: **RQ-CLI-01-06** Quien atiende registra a un cliente en el local o pide en su nombre solo con su DNI. **RQ-CLI-01-07** Un cliente registrado en el local crea su contraseña en la carta. | **Alcance.**<br>• Quien atiende registra a un cliente en el local o pide en su nombre solo con su DNI.<br>• Un cliente registrado en el local crea su contraseña en la carta. |
| **Problema.** Conocer a los clientes frecuentes y habilitar el programa de puntos sin frenar la compra como invitado (NEC-CAP-024, NEC-CAP-036). | **Fuera de alcance.**<br>• HU-CAP-022: Crear mi cuenta o seguir como invitado.<br>• HU-CAP-023: Ingresar a mi cuenta con DNI y contraseña.<br>• HU-CAP-025: Buscar y editar clientes en caja.<br>• Puntos, canje y cupón de cumpleaños: FT-CLI-02.<br>• Niveles del programa (Platino, Súper Capricho): horizonte futuro (BRD §4).<br>• Recuperar la contraseña por correo o SMS: pendiente (D-17). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cliente sin cuenta en el local | el cajero lo registra con DNI, nombre, cumpleaños y aceptación | queda creado sin contraseña y puede crearla después en la carta (RQ-CLI-01-06) |
| CA-2 | un cliente sin contraseña | entra a «Ingresar», escribe su DNI y confirma un dato (cumpleaños) | crea su contraseña y entra (RQ-CLI-01-07) |
| CA-3 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-CLI-01 (RQ-CLI-01-06, RQ-CLI-01-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-066) La cuenta es opcional; crear cuenta exige aceptar que se guarden los datos.<br>**RB-02** (RN-CAP-071) El DNI se guarda con aceptación, se enmascara en listas; sumar puntos requiere solo el DNI; ver o canjear requiere contraseña.<br>**RB-03** (RN-CAP-083 (1.ª)) El documento de un cliente no se cambia al editar; el cajero no edita puntos, pedidos ni crédito (id repetido, O1).<br>**RNF aplicables:** RNF-CAP-007, RNF-CAP-008, RNF-CAP-006, RNF-CAP-009. | `Cliente` (DNI o RUC único, nombre, teléfono, correo opcional, cumpleaños día y mes, aceptación con fecha, huella de contraseña) · `MovimientoPuntos` (pedido, puntos, tipo suma o reversa, fecha).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-023** (Ingresar a mi cuenta con DNI y contraseña) va antes, dentro de la misma feature.<br>• FT-CAJ-03.<br>• D-17.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ «Ingresar», crear cuenta, mi cuenta; administrativo ▸ Clientes y Usuarios ▸ pestaña Clientes (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CLI-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-17 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CLI-01 (requerimientos RQ-CLI-01-06, RQ-CLI-01-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
