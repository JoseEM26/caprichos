---
id: HU-CAP-199
tipo: hu
titulo: "Revisar con mi PIN el detalle de un cierre que no cuadra"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-005, FT-CIE-02, RQ-CIE-02-05, HU-CAP-044, HU-CAP-045, HU-CAP-046, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, cierre-caja, capa-a, ft-cie-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-199 | Título | Revisar con mi PIN el detalle de un cierre que no cuadra |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-005 · FT-CIE-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | revisar con mi PIN el detalle por medio de pago y las ventas del día de un cierre que no cuadra | saber dónde está la diferencia de un cierre que no cuadra sin que el cajero vea los totales |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CIE-02 «Arqueo ciego y cierre con historial» (Debe tener, épica EP-CAP-005). Cubre el requerimiento: **RQ-CIE-02-05** Si no cuadra, la supervisora ve con su PIN el detalle por medio y el historial de ventas del día, y cerrar así requiere su PIN. | **Alcance.**<br>• Si no cuadra, la supervisora ve con su PIN el detalle por medio y el historial de ventas del día, y cerrar así requiere su PIN. |
| **Problema.** Un cierre del día que el cajero no puede acomodar, verificable por medio de pago, con un historial que el dueño puede revisar siempre. Hoy, en restaurant.pe, «sobra y falta a cada rato» y nunca cuadra en cero (acta 03). | **Fuera de alcance.**<br>• HU-CAP-044: Contar a ciegas el efectivo y las billeteras.<br>• HU-CAP-045: Cerrar la caja con sus validaciones.<br>• HU-CAP-046: Consultar e imprimir el historial de cierres.<br>• Apertura, movimientos y liquidación: FT-CIE-01.<br>• Verificar los pagos en la cuenta de Yape o Plin desde el sistema (se hace fuera, RN-CAP-078).<br>• Informes de ventas: FT-INF-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cierre que no cuadra | la supervisora escribe su PIN de 6 dígitos | ve «Efectivo: faltan S/ 4,00 · Yape: cuadra», las ventas del día y puede cerrar con la diferencia registrada; sin su PIN el cajero no puede cerrar (RQ-CIE-02-05) |
| CA-2 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-CIE-02 (RQ-CIE-02-05); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-61) Cierre ciego: el cajero solo ve «Cuadra» o «No cuadra»; el detalle lo ve la supervisora con su PIN.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-014, RNF-CAP-009, RNF-CAP-012, RNF-CAP-006. | `Caja` (fecha, apertura, estado abierta o cerrada, autor) · `MovimientoCaja` (ingreso o egreso, monto, motivo, anulado) · `Liquidacion` (repartidor, esperado, entregado, diferencia) · `Arqueo` (conteo por denominación) · `CierreMedio` (medio, sistema, visto, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-046** (Consultar e imprimir el historial de cierres) va antes, dentro de la misma feature.<br>• FT-USR-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cierre de caja ▸ arqueo ciego por denominación, resultado «Cuadra / No cuadra», detalle con PIN de la supervisora, historial de cierres (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CIE-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CIE-02 (requerimientos RQ-CIE-02-05, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
