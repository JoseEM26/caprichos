---
id: HU-CAP-107
tipo: hu
titulo: "Definir la vigencia de una oferta"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-012, FT-OFE-01, RQ-OFE-01-05, RQ-OFE-01-06, RQ-OFE-01-07, RQ-OFE-01-08, HU-CAP-105, HU-CAP-106, HU-CAP-108, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, ofertas, capa-a, ft-ofe-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-107 | Título | Definir la vigencia de una oferta |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-012 · FT-OFE-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | definir la vigencia de una oferta | que una oferta solo valga en sus días, horas y canales |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-OFE-01 «Combos y promociones» (Debería tener, épica EP-CAP-012). Cubre los requerimientos: **RQ-OFE-01-05** Las ofertas comparten una vigencia opcional: días, horas, fechas, canal y límite. **RQ-OFE-01-06** Una oferta con límite de usos se desactiva sola al llegar al límite. **RQ-OFE-01-07** Una oferta se puede marcar «No suma puntos ni aplica cupones». **RQ-OFE-01-08** Un combo fuera de su vigencia no se ofrece en la carta ni en Nuevo pedido. | **Alcance.**<br>• Las ofertas comparten una vigencia opcional: días, horas, fechas, canal y límite.<br>• Una oferta con límite de usos se desactiva sola al llegar al límite.<br>• Una oferta se puede marcar «No suma puntos ni aplica cupones».<br>• Un combo fuera de su vigencia no se ofrece en la carta ni en Nuevo pedido. |
| **Problema.** Promociones que el dueño crea solo, y que cocina, stock e informes cuentan por producto y por combo. | **Fuera de alcance.**<br>• HU-CAP-105: Crear un combo con sus partes y precio por tamaño.<br>• HU-CAP-106: Crear una promoción «lleva N, paga M».<br>• HU-CAP-108: Vender un combo con componentes agotados.<br>• Descuentos automáticos: FT-OFE-02.<br>• Cupones: FT-OFE-03.<br>• Cómo la carta muestra el precio tachado: FT-CAR-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un combo vigente de lunes a viernes de 15:00 a 18:00 solo en la carta | un cliente lo busca un sábado o en el chatbot | no aparece (RQ-OFE-01-05) |
| CA-2 | una 2×1 limitada a los 10 primeros pedidos | se vende la décima | deja de ofrecerse en todos los canales y queda «Agotada por límite» (RQ-OFE-01-06) |
| CA-3 | una 2×1 de frappé marcada «No suma puntos ni aplica cupones» | un cliente con cuenta la compra | esa línea no suma puntos y no se le puede aplicar un cupón (FT-CLI-02, FT-OFE-03) (RQ-OFE-01-07) |
| CA-4 | un combo cuya fecha terminó ayer | el cajero abre Nuevo pedido | no aparece (RQ-OFE-01-08) |

Origen: criterios de verificación de FT-OFE-01 (RQ-OFE-01-05, RQ-OFE-01-06, RQ-OFE-01-07, RQ-OFE-01-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-070) Una promoción vale solo en sus días, horas, fechas y canales.<br>**RB-02** (DT-65) Un producto o una promoción puede marcarse «No suma puntos ni aplica cupones».<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-019, RNF-CAP-014. | `Oferta` (tipo combo, lleva N paga M, descuento; vigencia: días, horas, fechas, canal, límite) · `DescuentoAutomatico` (alcance, porcentaje o monto, mínimo) · `ReglaAcumulacion` · `Cupon` (modo único o compartido, tope, por cliente) · `CuponEmitido` (código al azar, pedido, estado, vencimiento) · `IntentoCupon`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-106** (Crear una promoción «lleva N, paga M») va antes, dentro de la misma feature.<br>• FT-CLI-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Ofertas y descuentos ▸ Nueva oferta (combo, lleva N paga M), vigencia (`Admin.dc.html`); `analisis/combos-y-opciones.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-OFE-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-OFE-01 (requerimientos RQ-OFE-01-05, RQ-OFE-01-06, RQ-OFE-01-07, RQ-OFE-01-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
