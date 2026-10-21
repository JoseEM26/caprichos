---
id: HU-CAP-060
tipo: hu
titulo: "Copiar, pegar y restaurar el plano por defecto"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-007, FT-SAL-01, RQ-SAL-01-09, RQ-SAL-01-10, HU-CAP-058, HU-CAP-059, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, D-16, DEP-02, DEP-06, DEP-08, R-01]
tags: [hu, salon, capa-a, ft-sal-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-060 | Título | Copiar, pegar y restaurar el plano por defecto |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-007 · FT-SAL-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | copiar, pegar y restaurar el plano por defecto | respaldar el plano y volver al diseño documentado |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-SAL-01 «Plano del local» (Debe tener, épica EP-CAP-007). Cubre los requerimientos: **RQ-SAL-01-09** El diseño se copia como texto y se pega para restaurarlo. **RQ-SAL-01-10** El plano por defecto es el documentado para Caprichos. | **Alcance.**<br>• El diseño se copia como texto y se pega para restaurarlo.<br>• El plano por defecto es el documentado para Caprichos. |
| **Problema.** Que el mozo vea el local tal como es para elegir mesa, y que el dueño pueda cambiar la distribución sin programador. | **Fuera de alcance.**<br>• HU-CAP-058: Dibujar el plano del local por piso.<br>• HU-CAP-059: Activar pisos y eliminar o desactivar elementos.<br>• Abrir pedidos en mesas: FT-SAL-02.<br>• Reservas: FT-SAL-03.<br>• Pantallas de TV para clientes (horizonte futuro). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un plano | el administrador toca «Copiar» y luego pega ese texto en otro equipo | el plano queda igual; un texto inválido muestra un error y no cambia nada (RQ-SAL-01-09) |
| CA-2 | un sistema nuevo | se abre el plano | el piso 1 tiene 10 mesas con 38 asientos y la entrada horizontal a la derecha, y el piso 2 está desactivado (RQ-SAL-01-10) |

Origen: criterios de verificación de FT-SAL-01 (RQ-SAL-01-09, RQ-SAL-01-10); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-014) Los registros no se eliminan, salvo los elementos del plano; una mesa con pedidos o reservas se desactiva.<br>**RB-02** (RN-CAP-025) El mozo solo abre pedido en mesas libres; con más de un piso activo elige primero el piso.<br>**RB-03** (RN-CAP-068) Una mesa se elimina aunque se haya usado; no con un pedido abierto o reserva activa hoy.<br>**RNF aplicables:** RNF-CAP-004, RNF-CAP-012, RNF-CAP-009. | `Piso` (activo) · `ElementoPlano` (tipo, x, y, ancho, alto, giro) · `Mesa` (número, asientos, activa) · `PedidoMesa` (pedido ↔ varias mesas) · `Reserva` (nombre, teléfono, personas, hora, mesas, estado, tolerancia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-059** (Activar pisos y eliminar o desactivar elementos) va antes, dentro de la misma feature.<br>• D-16.<br>• DEP-08.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Pantallas y plano ▸ Plano del local (`Admin.dc.html`); `analisis/plano-del-local.md` y `.default.json`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-SAL-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-16 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-SAL-01 (requerimientos RQ-SAL-01-09, RQ-SAL-01-10, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
