---
id: HU-CAP-177
tipo: hu
titulo: "Consultar el Historial de acciones y el historial de cada ficha"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-013, FT-USR-04, RQ-USR-04-08, RQ-USR-04-09, RQ-USR-04-10, RQ-USR-04-11, HU-CAP-176, ADR-001, ADR-011, ADR-014, ADR-004, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, usuarios, capa-a, ft-usr-04, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-177 | Título | Consultar el Historial de acciones y el historial de cada ficha |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-013 · FT-USR-04 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | consultar el Historial de acciones y el historial de cada ficha | revisar qué pasó con un pedido, un precio o un usuario y responder ante un reclamo |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-USR-04 «Historial de acciones (auditoría)» (Debe tener, épica EP-CAP-013). Cubre los requerimientos: **RQ-USR-04-08** Solo el administrador ve la pantalla Historial de acciones. **RQ-USR-04-09** El historial se filtra por persona, módulo, acción, resultado y fechas, y se exporta a CSV. **RQ-USR-04-10** El antes y el después se muestran lado a lado, resaltando lo que cambió. **RQ-USR-04-11** Cada ficha tiene «Ver historial» con solo sus registros. | **Alcance.**<br>• Solo el administrador ve la pantalla Historial de acciones.<br>• El historial se filtra por persona, módulo, acción, resultado y fechas, y se exporta a CSV.<br>• El antes y el después se muestran lado a lado, resaltando lo que cambió.<br>• Cada ficha tiene «Ver historial» con solo sus registros. |
| **Problema.** Que el dueño pueda revisar cambios de precios, anulaciones, permisos y accesos sin depender de nadie, y responder ante un reclamo o una pérdida. | **Fuera de alcance.**<br>• HU-CAP-176: Registrar automáticamente cambios, accesos y lecturas sensibles.<br>• Registros técnicos y errores del sistema: ADR-012 (GlitchTip y registros JSON).<br>• El historial propio de dinero y stock (cobros, cierres, movimientos), que ya está en sus módulos.<br>• Auditoría de cada acción menor (estados de cocina, mensajes de chat). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cajero | abre la dirección del historial | ve «No tienes acceso» y el servidor no entrega datos (RQ-USR-04-08) |
| CA-2 | registros de un mes | el administrador filtra «Ana · caja · ANULAR» del 1 al 15 | ve solo esos y puede exportarlos; la exportación también queda registrada (RQ-USR-04-09) |
| CA-3 | un cambio de parámetros | el administrador abre el registro | ve los dos valores lado a lado y el campo cambiado resaltado (RQ-USR-04-10) |
| CA-4 | el producto capuchino | el administrador toca «Ver historial» | ve sus cambios de precio, foto y estado en orden (RQ-USR-04-11) |
| CA-5 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-USR-04 (RQ-USR-04-08, RQ-USR-04-09, RQ-USR-04-10, RQ-USR-04-11); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-013) Solo el administrador ve los datos del negocio.<br>**RB-02** (DT-49) Alcance, pantalla, inmutabilidad con huella y conservación de 2 años.<br>**RNF aplicables:** RNF-CAP-009, RNF-CAP-006, RNF-CAP-008, RNF-CAP-014, RNF-CAP-017. | `auditoria` (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) (categoría, módulo, acción, resultado, antes y después enmascarados, IP, dispositivo, huellas encadenadas) · `Usuario` (DNI único, rol, activo, fecha de alta, huella de contraseña, debe cambiarla, foto) · `Rol` · `Permiso` (rol, módulo, acción) · `PinAdministrador` (huella) · `ConsumoPersonal` (usuario, mes, pedido, monto con descuento).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-176** (Registrar automáticamente cambios, accesos y lecturas sensibles) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Configuración ▸ Historial de acciones, mockup v205 (el botón «Ver historial» de cada ficha aún no está en el mockup).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-USR-04 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-USR-04 (requerimientos RQ-USR-04-08, RQ-USR-04-09, RQ-USR-04-10, RQ-USR-04-11, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
