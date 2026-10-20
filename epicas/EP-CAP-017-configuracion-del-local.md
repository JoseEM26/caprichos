---
id: EP-CAP-017
tipo: spec
titulo: "EP-CAP-017 Configuración del local"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-038, NEC-CAP-087, RN-CAP-059, RN-CAP-060]
tags: [epica, plt-02, g1, configuracion, debe-tener]
---

# EP-CAP-017 — Configuración del local

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-017 |
| NOMBRE | Configuración del local |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debe tener |
| HORIZONTE | Ahora |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Los datos del negocio (teléfono, horario, pagos, dirección, redes) están repetidos en la web, el bot y los avisos, y cuando cambian quedan distintos en cada lugar. El dueño depende de un programador para cambiarlos.

**Usuarios / segmentos**

- ACT-CAP-001: el dueño, que mantiene los datos
- ACT-CAP-006: clientes, que ven horario, contacto y pagos

**Evidencia**

- NEC-CAP-038 y NEC-CAP-087.
- RN-CAP-059 y RN-CAP-060.
- `analisis/configuracion-centralizada.md`.
- Mockup: Configuración del local, con la ubicación actual de la tienda (v195).

**Alineamiento estratégico**

- DT-20 Un dato del local se escribe una sola vez.
- NEC-CAP-087 El dueño cambia solo sus datos.

## 2 OBJETIVOS

**Objetivo de negocio**

Que cada dato del negocio tenga una sola fuente y se cambie sin programador.

**Objetivo del usuario**

Que el dueño cambie un horario, un número de Yape o la ubicación y lo vea al instante en la carta y en el chatbot.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Datos del local repetidos en más de un lugar | Por medir | Cero (DT-20) | Revisión de configuración | Por cambio |
| Cambios de datos que necesitaron programador | Por medir | Cero (propuesta) | Registro de cambios | Mensual |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Datos del local, ubicación, contacto, horario por día y fechas especiales, redes, pagos aceptados, logo, operación, entrega, avisos, empresa y textos (NEC-CAP-038).
- Ubicación actual de la tienda: desde el dispositivo, la dirección, un enlace de Google Maps o coordenadas.
- El horario y las fechas especiales deciden si el local aparece abierto (RN-CAP-060).
- Guardar con confirmación y aviso de cambios sin guardar.

**Fuera de alcance (OUT)**

- Zonas de reparto y tarifas: EP-CAP-008.
- Diseño y contenidos de la carta: EP-CAP-016.
- Textos legales con revisión: EP-CAP-020.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-CFG-01 | Datos del local, horario y fechas especiales | Debe tener | Redactada en draft: [`FT-CFG-01-datos-del-local-horario-y-fechas-especiales.md`](../features/FT-CFG-01-datos-del-local-horario-y-fechas-especiales.md) |
| FT-CFG-02 | Pagos, entrega y parámetros de operación | Debe tener | Redactada en draft: [`FT-CFG-02-pagos-entrega-y-parametros-de-operacion.md`](../features/FT-CFG-02-pagos-entrega-y-parametros-de-operacion.md) |

**Supuestos**

- El dueño mantiene sus propios datos.

**Restricciones**

- Toda acción que cambia datos pide confirmación (RN-CAP-015).

**Dependencias y riesgos**

- DEP-04 Datos del negocio (D-15).
- D-04 Horario real.

**Criterios de éxito / salida**

- El dueño cambia el horario y la carta muestra «Cerrado» fuera de él sin otra acción.
- Un cambio de número de Yape aparece igual en la carta y en el chatbot.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §5 (NEC-CAP-038, NEC-CAP-087, RN-CAP-059, RN-CAP-060), `analisis/configuracion-centralizada.md` y el mockup de Configuración del local — Revisado por: *(pendiente)*
