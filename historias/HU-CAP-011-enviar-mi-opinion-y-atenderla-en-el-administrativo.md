---
id: HU-CAP-011
tipo: hu
titulo: "Enviar mi opinión y atenderla en el administrativo"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-001, FT-CAR-03, RQ-CAR-03-06, RQ-CAR-03-07, RQ-CAR-03-08, HU-CAP-009, HU-CAP-010, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, DEP-02, DEP-04, DEP-06, R-01]
tags: [hu, carta, capa-a, ft-car-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-011 | Título | Enviar mi opinión y atenderla en el administrativo |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-001 · FT-CAR-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | enviar mi opinión desde la carta y que el local la atienda | contarle al local cómo me fue y que alguien atienda mi queja |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAR-03 «Más vendidos, Conócenos y opinión del cliente» (Debería tener, épica EP-CAP-001). Cubre los requerimientos: **RQ-CAR-03-06** El formulario «¿Cómo te fue?» recibe comentario, sugerencia, felicitación o queja, con nombre y contacto opcionales. **RQ-CAR-03-07** Una queja avisa al correo del dueño. **RQ-CAR-03-08** Los mensajes no se eliminan: se marcan como atendidos. | **Alcance.**<br>• El formulario «¿Cómo te fue?» recibe comentario, sugerencia, felicitación o queja, con nombre y contacto opcionales.<br>• Una queja avisa al correo del dueño.<br>• Los mensajes no se eliminan: se marcan como atendidos. |
| **Problema.** Ayuda al cliente a decidir (lo más pedido), da confianza (datos del local completos) y abre un canal directo de opinión sin depender de reseñas públicas. | **Fuera de alcance.**<br>• HU-CAP-009: Ver los más vendidos del mes con estrellas.<br>• HU-CAP-010: Ver la página Conócenos y el pie de la carta.<br>• Reseñas públicas en la carta (descartadas, DT-13).<br>• Encuesta posventa por WhatsApp y opiniones en Google Maps: FT-ATN-03.<br>• Cómo se cargan los datos y las fotos del local: FT-CFG-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el formulario | el cliente elige «Queja», escribe el texto y envía | ve un agradecimiento y el mensaje queda en el administrativo como «Nuevo» (RQ-CAR-03-06) |
| CA-2 | una queja recibida | se guarda | se envía un aviso al correo del dueño guardado en Configuración y una notificación en el administrativo (FT-INF-03) (RQ-CAR-03-07) |
| CA-3 | un mensaje nuevo | el administrador lo marca atendido con Sí/No | cambia de estado, guarda quién y cuándo, y no hay opción de borrarlo (RQ-CAR-03-08) |
| CA-4 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-CAR-03 (RQ-CAR-03-06, RQ-CAR-03-07, RQ-CAR-03-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-057) Las quejas del bot avisan por correo solo a Kevin.<br>**RB-02** (RN-CAP-061) Las quejas del formulario se avisan al correo del dueño; los mensajes no se eliminan, se marcan atendidos.<br>**RNF aplicables:** RNF-CAP-019, RNF-CAP-008, RNF-CAP-014. | `Producto` (nombre, descripción, foto, categoría, precio, activo, orden) · `Categoria` · `Tamano` · `GrupoOpciones` (obligatorio, mínimo, máximo) · `Opcion` (precio extra) · `TipoVariante`/`Sabor` · `Combo`/`ParteCombo` · `Ranking` mensual · `MensajeCarta` (tipo, texto, estado atendido).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-010** (Ver la página Conócenos y el pie de la carta) va antes, dentro de la misma feature.<br>• Correo del dueño (DEP-04).<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ estrellas en tarjetas, página Conócenos, formulario «¿Cómo te fue?» y pie (`Main.dc.html`); administrativo ▸ Mensajes de la carta (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAR-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAR-03 (requerimientos RQ-CAR-03-06, RQ-CAR-03-07, RQ-CAR-03-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
