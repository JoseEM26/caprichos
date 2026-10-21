---
id: HU-CAP-045
tipo: hu
titulo: "Cerrar la caja con sus validaciones"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-005, FT-CIE-02, RQ-CIE-02-07, RQ-CIE-02-08, HU-CAP-044, HU-CAP-046, HU-CAP-199, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, cierre-caja, capa-a, ft-cie-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-045 | Título | Cerrar la caja con sus validaciones |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-005 · FT-CIE-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | cerrar la caja con sus validaciones | cerrar la caja solo cuando no queda nada pendiente |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CIE-02 «Arqueo ciego y cierre con historial» (Debe tener, épica EP-CAP-005). Cubre los requerimientos: **RQ-CIE-02-07** No se puede cerrar con pedidos sin cobrar o por confirmar. **RQ-CIE-02-08** No se puede cerrar con efectivo de repartidores sin liquidar. | **Alcance.**<br>• No se puede cerrar con pedidos sin cobrar o por confirmar.<br>• No se puede cerrar con efectivo de repartidores sin liquidar. |
| **Problema.** Un cierre del día que el cajero no puede acomodar, verificable por medio de pago, con un historial que el dueño puede revisar siempre. Hoy, en restaurant.pe, «sobra y falta a cada rato» y nunca cuadra en cero (acta 03). | **Fuera de alcance.**<br>• HU-CAP-044: Contar a ciegas el efectivo y las billeteras.<br>• HU-CAP-046: Consultar e imprimir el historial de cierres.<br>• HU-CAP-199: Revisar con mi PIN el detalle de un cierre que no cuadra.<br>• Apertura, movimientos y liquidación: FT-CIE-01.<br>• Verificar los pagos en la cuenta de Yape o Plin desde el sistema (se hace fuera, RN-CAP-078).<br>• Informes de ventas: FT-INF-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido por confirmar | el cajero intenta cerrar | ve la lista de pendientes y el cierre no procede (RQ-CIE-02-07) |
| CA-2 | un repartidor con S/ 40 por liquidar | el cajero intenta cerrar | ve «Falta liquidar a …» y no puede (RQ-CIE-02-08) |
| CA-3 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-CIE-02 (RQ-CIE-02-07, RQ-CIE-02-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-079) No se cierra con pedidos sin cobrar o por confirmar.<br>**RB-02** (RN-CAP-097) La caja no se cierra con efectivo de repartidores sin liquidar.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-014, RNF-CAP-009, RNF-CAP-012, RNF-CAP-006. | `Caja` (fecha, apertura, estado abierta o cerrada, autor) · `MovimientoCaja` (ingreso o egreso, monto, motivo, anulado) · `Liquidacion` (repartidor, esperado, entregado, diferencia) · `Arqueo` (conteo por denominación) · `CierreMedio` (medio, sistema, visto, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-044** (Contar a ciegas el efectivo y las billeteras) va antes, dentro de la misma feature.<br>• FT-CAJ-01.<br>• FT-CIE-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cierre de caja ▸ arqueo ciego por denominación, resultado «Cuadra / No cuadra», detalle con PIN de la supervisora, historial de cierres (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CIE-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CIE-02 (requerimientos RQ-CIE-02-07, RQ-CIE-02-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
