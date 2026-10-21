---
id: HU-CAP-159
tipo: hu
titulo: "Configurar tiempos, tolerancias, porcentaje de puntos y descuento del personal"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-017, FT-CFG-02, RQ-CFG-02-04, RQ-CFG-02-05, HU-CAP-158, HU-CAP-160, ADR-001, ADR-011, ADR-014, ADR-010, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, configuracion, capa-a, ft-cfg-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-159 | Título | Configurar tiempos, tolerancias, porcentaje de puntos y descuento del personal |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-017 · FT-CFG-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | configurar tiempos, tolerancias, porcentaje de puntos y descuento del personal | ajustar la operación según lo que el local puede cumplir |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CFG-02 «Pagos, entrega y parámetros de operación» (Debe tener, épica EP-CAP-017). Cubre los requerimientos: **RQ-CFG-02-04** El dueño fija la tolerancia de reservas, el porcentaje de puntos y el descuento del personal. **RQ-CFG-02-05** El dueño edita los mensajes de WhatsApp y la encuesta posventa. | **Alcance.**<br>• El dueño fija la tolerancia de reservas, el porcentaje de puntos y el descuento del personal.<br>• El dueño edita los mensajes de WhatsApp y la encuesta posventa. |
| **Problema.** Ajustar la operación sin programador y con historial de quién cambió qué. | **Fuera de alcance.**<br>• HU-CAP-158: Configurar medios de pago y entrega.<br>• HU-CAP-160: Configurar mensajes, entregas fallidas y etiquetas.<br>• Datos, horario y fotos del local: FT-CFG-01.<br>• Zonas de reparto: FT-DEL-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | la tolerancia de 15 minutos | la cambia a 20 | las reservas nuevas vencen a los 20 (RQ-CFG-02-04) |
| CA-2 | el mensaje de confirmación | el dueño cambia el texto | los siguientes mensajes usan el nuevo (RQ-CFG-02-05) |
| CA-3 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-CFG-02 (RQ-CFG-02-04, RQ-CFG-02-05); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-059) Un dato del local tiene una sola fuente.<br>**RB-02** (RN-CAP-095) Envío gratis «más de 70» por defecto, configurable.<br>**RB-03** (RN-CAP-106) El porcentaje del descuento del personal se cambia en Configuración.<br>**RNF aplicables:** RNF-CAP-006, RNF-CAP-009, RNF-CAP-012. | `ConfiguracionLocal` (datos, ubicación, redes, Wi-Fi, términos, privacidad) · `HorarioDia` · `FechaEspecial` · `FotoLocal` · `Parametro` (clave, valor, historial con autor y fecha).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-158** (Configurar medios de pago y entrega) va antes, dentro de la misma feature.<br>• FT-SAL-03 · FT-CLI-02 · FT-USR-03.<br>• FT-BOT-02 · FT-ATN-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Configuración del local ▸ Pagos, Entrega, Operación, Mensajes, Impresión (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CFG-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-010, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CFG-02 (requerimientos RQ-CFG-02-04, RQ-CFG-02-05, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
