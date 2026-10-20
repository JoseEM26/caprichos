---
id: HU-CAP-007
tipo: hu
titulo: "Ver la pausa y el tiempo de Alta demanda"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-001, FT-CAR-02, RQ-CAR-02-06, RQ-CAR-02-07, HU-CAP-005, HU-CAP-006, HU-CAP-008, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, D-01, DEP-02, DEP-06, R-01]
tags: [hu, carta, capa-a, ft-car-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-007 | Título | Ver la pausa y el tiempo de Alta demanda |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-001 · FT-CAR-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | ver la pausa y el tiempo de Alta demanda | saber cuánto demorará mi pedido o si hoy no reciben pedidos |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAR-02 «Disponibilidad en la carta: agotados, horario y pausa» (Debe tener, épica EP-CAP-001). Cubre los requerimientos: **RQ-CAR-02-06** Con la pausa de pedidos activa, la carta muestra un aviso y no recibe pedidos. **RQ-CAR-02-07** Con Alta demanda activa, la carta muestra el tiempo de entrega aumentado. | **Alcance.**<br>• Con la pausa de pedidos activa, la carta muestra un aviso y no recibe pedidos.<br>• Con Alta demanda activa, la carta muestra el tiempo de entrega aumentado. |
| **Problema.** Evita vender lo que no hay y recibir pedidos que no se pueden atender. Contribuye directamente a OBJ-CAP-002. | **Fuera de alcance.**<br>• HU-CAP-005: Ver si el local está abierto o cerrado.<br>• HU-CAP-006: Ver productos y opciones agotados.<br>• HU-CAP-008: Comprobar la disponibilidad al enviar el pedido.<br>• Cómo cocina marca agotados y activa Alta demanda: FT-COC-03.<br>• Cómo el administrador define horario y fechas especiales: FT-CFG-01.<br>• El cálculo de disponibilidad por stock: FT-STK-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | la Alta demanda con pausa activa | el cliente abre la carta | ve «Por ahora no estamos recibiendo pedidos» y no puede enviar; al apagar la pausa vuelve a recibir (RQ-CAR-02-06) |
| CA-2 | un tiempo prometido de 13 minutos y Alta demanda de +15 | el cliente ve el tiempo estimado | lee 28 minutos (RQ-CAR-02-07) |

Origen: criterios de verificación de FT-CAR-02 (RQ-CAR-02-06, RQ-CAR-02-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-113) Alta demanda suma minutos al tiempo prometido; la pausa de pedidos solo vale con Alta demanda activa.<br>**RNF aplicables:** RNF-CAP-019, RNF-CAP-002, RNF-CAP-003. | `Producto` (nombre, descripción, foto, categoría, precio, activo, orden) · `Categoria` · `Tamano` · `GrupoOpciones` (obligatorio, mínimo, máximo) · `Opcion` (precio extra) · `TipoVariante`/`Sabor` · `Combo`/`ParteCombo` · `Ranking` mensual · `MensajeCarta` (tipo, texto, estado atendido).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)* |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-006** (Ver productos y opciones agotados) va antes, dentro de la misma feature.<br>• FT-COC-03.<br>• FT-COC-03 · D-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ cabecera con estado abierto/cerrado, tarjeta de producto agotado, aviso de pausa (`Main.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAR-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-01 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAR-02 (requerimientos RQ-CAR-02-06, RQ-CAR-02-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
