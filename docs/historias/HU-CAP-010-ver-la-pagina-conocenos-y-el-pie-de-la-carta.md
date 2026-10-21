---
id: HU-CAP-010
tipo: hu
titulo: "Ver la página Conócenos y el pie de la carta"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-001, FT-CAR-03, RQ-CAR-03-04, RQ-CAR-03-05, RQ-CAR-03-09, RQ-CAR-03-10, HU-CAP-009, HU-CAP-011, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, DEP-02, DEP-04, DEP-06, R-01]
tags: [hu, carta, capa-a, ft-car-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-010 | Título | Ver la página Conócenos y el pie de la carta |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-001 · FT-CAR-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | ver la página Conócenos y el pie de la carta | saber dónde queda el local, su horario y cómo contactarlo |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAR-03 «Más vendidos, Conócenos y opinión del cliente» (Debería tener, épica EP-CAP-001). Cubre los requerimientos: **RQ-CAR-03-04** La página Conócenos muestra ubicación con mapa, horario por día, teléfono, WhatsApp, redes y fotos del local. **RQ-CAR-03-05** Conócenos no tiene datos escritos a mano: todo se lee de Configuración del local. **RQ-CAR-03-09** El pie de la carta muestra ubicación, horario, contacto y redes. **RQ-CAR-03-10** Conócenos ofrece solo un enlace «Ver nuestras reseñas en Google» a la ficha del local; la carta no copia reseñas, nombres ni fotos de quienes las escribieron. | **Alcance.**<br>• La página Conócenos muestra ubicación con mapa, horario por día, teléfono, WhatsApp, redes y fotos del local.<br>• Conócenos no tiene datos escritos a mano: todo se lee de Configuración del local.<br>• El pie de la carta muestra ubicación, horario, contacto y redes.<br>• Conócenos ofrece solo un enlace «Ver nuestras reseñas en Google» a la ficha del local; la carta no copia reseñas, nombres ni fotos de quienes las escribieron. |
| **Problema.** Ayuda al cliente a decidir (lo más pedido), da confianza (datos del local completos) y abre un canal directo de opinión sin depender de reseñas públicas. | **Fuera de alcance.**<br>• HU-CAP-009: Ver los más vendidos del mes con estrellas.<br>• HU-CAP-011: Enviar mi opinión y atenderla en el administrativo.<br>• Reseñas públicas en la carta (descartadas, DT-13) y reseñas de Google Maps con nombre o foto (descartadas por datos personales, DT-66).<br>• Encuesta posventa por WhatsApp y opiniones en Google Maps: FT-ATN-03.<br>• Cómo se cargan los datos y las fotos del local: FT-CFG-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | la configuración del local completa | el cliente abre Conócenos | ve cada dato tal como está en Configuración del local y el botón de mapa abre la ubicación (RQ-CAR-03-04) |
| CA-2 | que el administrador cambia el teléfono en Configuración del local | el cliente abre Conócenos y el pie | ve el teléfono nuevo en los dos sitios (RQ-CAR-03-05) |
| CA-3 | la carta | el cliente llega al final | ve el pie con los datos de Configuración del local y enlaces a WhatsApp y redes (RQ-CAR-03-09) |
| CA-4 | el enlace de Google Maps cargado en Configuración del local | el cliente toca «Ver nuestras reseñas en Google» | se abre la ficha del local en Google Maps; en la carta no aparece ninguna reseña, nombre ni foto de terceros (RQ-CAR-03-10) |

Origen: criterios de verificación de FT-CAR-03 (RQ-CAR-03-04, RQ-CAR-03-05, RQ-CAR-03-09, RQ-CAR-03-10); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-059) Un dato del local tiene una sola fuente: Configuración del local.<br>**RB-02** (DT-66) No se muestran reseñas de Google con nombre o foto (Ley 29733 y términos de Google); solo un enlace a la ficha, hasta una revisión legal.<br>**RNF aplicables:** RNF-CAP-019, RNF-CAP-008, RNF-CAP-014. | `Producto` (nombre, descripción, foto, categoría, precio, activo, orden) · `Categoria` · `Tamano` · `GrupoOpciones` (obligatorio, mínimo, máximo) · `Opcion` (precio extra) · `TipoVariante`/`Sabor` · `Combo`/`ParteCombo` · `Ranking` mensual · `MensajeCarta` (tipo, texto, estado atendido).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-009** (Ver los más vendidos del mes con estrellas) va antes, dentro de la misma feature.<br>• FT-CFG-01 · DEP-04.<br>• FT-CFG-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ estrellas en tarjetas, página Conócenos, formulario «¿Cómo te fue?» y pie (`Main.dc.html`); administrativo ▸ Mensajes de la carta (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAR-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAR-03 (requerimientos RQ-CAR-03-04, RQ-CAR-03-05, RQ-CAR-03-09, RQ-CAR-03-10, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
