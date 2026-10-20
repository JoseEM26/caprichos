---
id: HU-CAP-058
tipo: hu
titulo: "Dibujar el plano del local por piso"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-007, FT-SAL-01, RQ-SAL-01-01, RQ-SAL-01-02, RQ-SAL-01-03, RQ-SAL-01-08, HU-CAP-059, HU-CAP-060, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, D-16, DEP-02, DEP-06, DEP-08, R-01]
tags: [hu, salon, capa-a, ft-sal-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-058 | Título | Dibujar el plano del local por piso |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-007 · FT-SAL-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | dibujar el plano del local por piso | que el sistema muestre el local tal como es |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-SAL-01 «Plano del local» (Debe tener, épica EP-CAP-007). Cubre los requerimientos: **RQ-SAL-01-01** El administrador agrega mesas, cocina, barra, baños, paredes, entrada y otros elementos sobre una cuadrícula por piso. **RQ-SAL-01-02** Los elementos se mueven, giran y cambian de tamaño. **RQ-SAL-01-03** Los controles van arriba, el plano ocupa casi toda la pantalla y la cuadrícula tiene tamaño ajustable. **RQ-SAL-01-08** El plano muestra mesas, asientos y elementos en totales. | **Alcance.**<br>• El administrador agrega mesas, cocina, barra, baños, paredes, entrada y otros elementos sobre una cuadrícula por piso.<br>• Los elementos se mueven, giran y cambian de tamaño.<br>• Los controles van arriba, el plano ocupa casi toda la pantalla y la cuadrícula tiene tamaño ajustable.<br>• El plano muestra mesas, asientos y elementos en totales. |
| **Problema.** Que el mozo vea el local tal como es para elegir mesa, y que el dueño pueda cambiar la distribución sin programador. | **Fuera de alcance.**<br>• HU-CAP-059: Activar pisos y eliminar o desactivar elementos.<br>• HU-CAP-060: Copiar, pegar y restaurar el plano por defecto.<br>• Abrir pedidos en mesas: FT-SAL-02.<br>• Reservas: FT-SAL-03.<br>• Pantallas de TV para clientes (horizonte futuro). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el piso 1 | el administrador agrega una mesa de 4 asientos | aparece en la cuadrícula con el siguiente número libre (RQ-SAL-01-01) |
| CA-2 | la entrada de 4×1 | el administrador la gira | pasa a 1×4 en el mismo lugar si cabe (RQ-SAL-01-02) |
| CA-3 | la cuadrícula de 12×12 | el administrador la cambia a 16×12 | el plano muestra más cuadros y conserva los elementos (RQ-SAL-01-03) |
| CA-4 | el piso 1 | el administrador abre el plano | ve mesas, asientos totales y mesas activas (RQ-SAL-01-08) |

Origen: criterios de verificación de FT-SAL-01 (RQ-SAL-01-01, RQ-SAL-01-02, RQ-SAL-01-03, RQ-SAL-01-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-014) Los registros no se eliminan, salvo los elementos del plano; una mesa con pedidos o reservas se desactiva.<br>**RB-02** (RN-CAP-025) El mozo solo abre pedido en mesas libres; con más de un piso activo elige primero el piso.<br>**RB-03** (RN-CAP-068) Una mesa se elimina aunque se haya usado; no con un pedido abierto o reserva activa hoy.<br>**RNF aplicables:** RNF-CAP-004, RNF-CAP-012, RNF-CAP-009. | `Piso` (activo) · `ElementoPlano` (tipo, x, y, ancho, alto, giro) · `Mesa` (número, asientos, activa) · `PedidoMesa` (pedido ↔ varias mesas) · `Reserva` (nombre, teléfono, personas, hora, mesas, estado, tolerancia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • DEP-08 plano real (D-16).<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Pantallas y plano ▸ Plano del local (`Admin.dc.html`); `analisis/plano-del-local.md` y `.default.json`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-SAL-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-16 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-SAL-01 (requerimientos RQ-SAL-01-01, RQ-SAL-01-02, RQ-SAL-01-03, RQ-SAL-01-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
