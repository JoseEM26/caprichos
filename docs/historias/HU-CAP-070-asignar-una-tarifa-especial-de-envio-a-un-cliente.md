---
id: HU-CAP-070
tipo: hu
titulo: "Asignar una tarifa especial de envío a un cliente"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-008, FT-DEL-01, RQ-DEL-01-06, RQ-DEL-01-07, HU-CAP-068, HU-CAP-069, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, D-02, DEP-02, DEP-06, R-01]
tags: [hu, delivery, capa-a, ft-del-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-070 | Título | Asignar una tarifa especial de envío a un cliente |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-008 · FT-DEL-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | asignar una tarifa especial de envío a un cliente | dar un envío especial a clientes frecuentes |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-DEL-01 «Zonas de reparto y tarifas» (Debe tener, épica EP-CAP-008). Cubre los requerimientos: **RQ-DEL-01-06** El envío es gratis cuando los productos pasan del monto configurado. **RQ-DEL-01-07** El administrador asigna a un cliente una tarifa especial de monto fijo o porcentaje. | **Alcance.**<br>• El envío es gratis cuando los productos pasan del monto configurado.<br>• El administrador asigna a un cliente una tarifa especial de monto fijo o porcentaje. |
| **Problema.** Un envío cobrado igual en todos los canales, calculado solo con el punto, sin que el cliente tenga que conocer las zonas. | **Fuera de alcance.**<br>• HU-CAP-068: Calcular el envío por la zona del punto.<br>• HU-CAP-069: Editar, apagar y tarifar las zonas.<br>• Cómo el cliente da su ubicación: FT-PED-02.<br>• Mapa de calor de entregas: FT-INF-02.<br>• Crear zonas nuevas (excluido por NEC-CAP-100). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | «más de S/ 70» | los productos suman S/ 70,10 | el envío es S/ 0; el administrador puede cambiar a «desde S/ 70» (RQ-DEL-01-06) |
| CA-2 | un cliente con envío fijo de S/ 2 y otro con 50 % | cada uno pide a Z5 (S/ 6) | pagan S/ 2 y S/ 3; si sus productos pasan de S/ 70, ambos pagan S/ 0 (RQ-DEL-01-07) |
| CA-3 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-DEL-01 (RQ-DEL-01-06, RQ-DEL-01-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-095) Envío gratis «más de 70» por defecto, configurable.<br>**RB-02** (RN-CAP-109) Tarifa especial: el fijo prevalece sobre el porcentaje y el gratis sobre ambos; solo el administrador la edita.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-006, RNF-CAP-009. | `ZonaReparto` (código, polígono de puntos, tarifa, activa) · `TarifaEspecialCliente` (fijo o porcentaje) · `AsignacionReparto` (pedido, repartidor, hora de toma, salida, entrega) · `IncidenteEntrega` (motivo, intento, hora) · `Coordinacion` (estado, cierre, recargo).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-069** (Editar, apagar y tarifar las zonas) va antes, dentro de la misma feature.<br>• D-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Configuración del local ▸ Entrega y zonas; Clientes ▸ tarifa especial (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-DEL-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-02 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-DEL-01 (requerimientos RQ-DEL-01-06, RQ-DEL-01-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
