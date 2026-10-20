---
id: HU-CAP-106
tipo: hu
titulo: "Crear una promoción «lleva N, paga M»"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-012, FT-OFE-01, RQ-OFE-01-04, RQ-OFE-01-07, HU-CAP-105, HU-CAP-107, HU-CAP-108, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, ofertas, capa-a, ft-ofe-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-106 | Título | Crear una promoción «lleva N, paga M» |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-012 · FT-OFE-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | crear una promoción «lleva N, paga M» | lanzar promociones como 3x2 cuando quiera |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-OFE-01 «Combos y promociones» (Debería tener, épica EP-CAP-012). Cubre los requerimientos: **RQ-OFE-01-04** Se crea una promoción «lleva N, paga M» con su contenido limitado. **RQ-OFE-01-07** Un combo sigue a la venta si falta un componente: se elige otro de la misma categoría. | **Alcance.**<br>• Se crea una promoción «lleva N, paga M» con su contenido limitado.<br>• Un combo sigue a la venta si falta un componente: se elige otro de la misma categoría. |
| **Problema.** Promociones que el dueño crea solo, y que cocina, stock e informes cuentan por producto y por combo. | **Fuera de alcance.**<br>• HU-CAP-105: Crear un combo con sus partes y precio por tamaño.<br>• HU-CAP-107: Definir la vigencia de una oferta.<br>• HU-CAP-108: Vender un combo con componentes agotados.<br>• Descuentos automáticos: FT-OFE-02.<br>• Cupones: FT-OFE-03.<br>• Cómo la carta muestra el precio tachado: FT-CAR-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | una 3x2 en donas | el cliente lleva 3 donas | se descuenta la más barata; con 2 donas no aplica y se avisa «Lleva 1 más y paga 2» (RQ-OFE-01-04) |
| CA-2 | un combo con el postre «Brownie» agotado | el cliente lo arma | el brownie aparece apagado y puede elegir otro postre de la categoría (RQ-OFE-01-07) |

Origen: criterios de verificación de FT-OFE-01 (RQ-OFE-01-04, RQ-OFE-01-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-034) Un combo sigue a la venta aunque falte un complemento.<br>**RB-02** (RN-CAP-055) Si falta un componente, se elige otro de la misma categoría.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-019, RNF-CAP-014. | `Oferta` (tipo combo, lleva N paga M, descuento; vigencia: días, horas, fechas, canal, límite) · `DescuentoAutomatico` (alcance, porcentaje o monto, mínimo) · `ReglaAcumulacion` · `Cupon` (modo único o compartido, tope, por cliente) · `CuponEmitido` (código al azar, pedido, estado, vencimiento) · `IntentoCupon`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-105** (Crear un combo con sus partes y precio por tamaño) va antes, dentro de la misma feature.<br>• FT-COC-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Ofertas y descuentos ▸ Nueva oferta (combo, lleva N paga M), vigencia (`Admin.dc.html`); `analisis/combos-y-opciones.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-OFE-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-OFE-01 (requerimientos RQ-OFE-01-04, RQ-OFE-01-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
