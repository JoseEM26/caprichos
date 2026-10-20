---
id: HU-CAP-157
tipo: hu
titulo: "Subir y quitar fotos del local"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-017, FT-CFG-01, RQ-CFG-01-06, RQ-CFG-01-07, HU-CAP-155, HU-CAP-156, ADR-001, ADR-011, ADR-014, ADR-010, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, configuracion, capa-a, ft-cfg-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-157 | Título | Subir y quitar fotos del local |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-017 · FT-CFG-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | subir y quitar fotos del local | mostrar el local en la carta |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CFG-01 «Datos del local, horario y fechas especiales» (Debe tener, épica EP-CAP-017). Cubre los requerimientos: **RQ-CFG-01-06** Solo el administrador sube y quita fotos del local, con Sí/No. **RQ-CFG-01-07** Las fotos del local aparecen en sus espacios de la carta y Conócenos. | **Alcance.**<br>• Solo el administrador sube y quita fotos del local, con Sí/No.<br>• Las fotos del local aparecen en sus espacios de la carta y Conócenos. |
| **Problema.** Un dato se escribe una sola vez y no hay teléfonos ni horarios distintos en cada canal (DT-20). | **Fuera de alcance.**<br>• HU-CAP-155: Editar los datos y la ubicación del local.<br>• HU-CAP-156: Definir horario por día y fechas especiales.<br>• Pagos, entrega, zonas y parámetros de operación: FT-CFG-02. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cajero | abre la configuración | no puede tocar las fotos; el administrador quita una con confirmación (RQ-CFG-01-06) |
| CA-2 | 4 fotos | el cliente abre Conócenos | las ve en la galería (RQ-CFG-01-07) |
| CA-3 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |
| CA-4 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-CFG-01 (RQ-CFG-01-06, RQ-CFG-01-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-062) Solo el administrador sube o quita fotos, con Sí/No.<br>**RNF aplicables:** RNF-CAP-006, RNF-CAP-019, RNF-CAP-009, RNF-CAP-012. | `ConfiguracionLocal` (datos, ubicación, redes, Wi-Fi, términos, privacidad) · `HorarioDia` · `FechaEspecial` · `FotoLocal` · `Parametro` (clave, valor, historial con autor y fecha).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-156** (Definir horario por día y fechas especiales) va antes, dentro de la misma feature.<br>• FT-CAR-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Configuración del local ▸ Datos, Ubicación, Horario, Fechas especiales, Fotos (`Admin.dc.html`); `analisis/configuracion-centralizada.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CFG-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-010, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CFG-01 (requerimientos RQ-CFG-01-06, RQ-CFG-01-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
