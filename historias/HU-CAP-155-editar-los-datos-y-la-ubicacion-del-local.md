---
id: HU-CAP-155
tipo: hu
titulo: "Editar los datos y la ubicación del local"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-017, FT-CFG-01, RQ-CFG-01-01, RQ-CFG-01-02, RQ-CFG-01-03, HU-CAP-156, HU-CAP-157, ADR-001, ADR-011, ADR-014, ADR-010, ADR-012, D-15, DEP-02, DEP-04, DEP-06, R-01]
tags: [hu, configuracion, capa-a, ft-cfg-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-155 | Título | Editar los datos y la ubicación del local |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-017 · FT-CFG-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | editar los datos y la ubicación del local | que la carta, el bot y el administrativo muestren los mismos datos |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CFG-01 «Datos del local, horario y fechas especiales» (Debe tener, épica EP-CAP-017). Cubre los requerimientos: **RQ-CFG-01-01** El administrador edita nombre, logo, RUC, dirección, teléfono, WhatsApp, correo, redes, Wi-Fi, términos y privacidad. **RQ-CFG-01-02** La ubicación de la tienda se fija con ubicación actual, búsqueda o enlace de Google Maps. **RQ-CFG-01-03** Un dato del local tiene una sola fuente: ninguna otra pantalla lo escribe. | **Alcance.**<br>• El administrador edita nombre, logo, RUC, dirección, teléfono, WhatsApp, correo, redes, Wi-Fi, términos y privacidad.<br>• La ubicación de la tienda se fija con ubicación actual, búsqueda o enlace de Google Maps.<br>• Un dato del local tiene una sola fuente: ninguna otra pantalla lo escribe. |
| **Problema.** Un dato se escribe una sola vez y no hay teléfonos ni horarios distintos en cada canal (DT-20). | **Fuera de alcance.**<br>• HU-CAP-156: Definir horario por día y fechas especiales.<br>• HU-CAP-157: Subir y quitar fotos del local.<br>• Pagos, entrega, zonas y parámetros de operación: FT-CFG-02. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el formulario | cambia el WhatsApp con Sí/No | la carta, el chatbot y los mensajes usan el nuevo número (RQ-CFG-01-01) |
| CA-2 | el panel de ubicación | el administrador pega un enlace de Google Maps | se leen latitud y longitud y se ve el pin; con «Usar mi ubicación actual» se toma la del equipo (RQ-CFG-01-02) |
| CA-3 | el teléfono cambiado | se revisan Conócenos, el pie, el bot y el comprobante | todos muestran el nuevo (RQ-CFG-01-03) |
| CA-4 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |
| CA-5 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-CFG-01 (RQ-CFG-01-01, RQ-CFG-01-02, RQ-CFG-01-03); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-059) Un dato del local tiene una sola fuente: Configuración del local.<br>**RB-02** (DT-20) Un dato del local se escribe una sola vez.<br>**RNF aplicables:** RNF-CAP-006, RNF-CAP-019, RNF-CAP-009, RNF-CAP-012. | `ConfiguracionLocal` (datos, ubicación, redes, Wi-Fi, términos, privacidad) · `HorarioDia` · `FechaEspecial` · `FotoLocal` · `Parametro` (clave, valor, historial con autor y fecha).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • DEP-04 (D-15).<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Configuración del local ▸ Datos, Ubicación, Horario, Fechas especiales, Fotos (`Admin.dc.html`); `analisis/configuracion-centralizada.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CFG-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-010, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-15 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CFG-01 (requerimientos RQ-CFG-01-01, RQ-CFG-01-02, RQ-CFG-01-03, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
