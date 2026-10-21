---
id: EP-CAP-016
tipo: spec
titulo: "EP-CAP-016 Administración de la carta y contenidos"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-011, NEC-CAP-012, NEC-CAP-016, NEC-CAP-030, NEC-CAP-042, NEC-CAP-044, NEC-CAP-045, NEC-CAP-058, NEC-CAP-067, NEC-CAP-082, NEC-CAP-106]
tags: [epica, plt-02, g1, contenidos, deberia-tener]
---

# EP-CAP-016 — Administración de la carta y contenidos

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-016 |
| NOMBRE | Administración de la carta y contenidos |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debería tener |
| HORIZONTE | Siguiente |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Cambiar un precio, una foto, el orden de la carta o una promoción del inicio requiere un programador. No hay un lugar para publicar novedades, fotos de clientes o decoración por fechas festivas, y las opciones de los productos (tamaños, leches, extras) están repetidas y mezcladas.

**Usuarios / segmentos**

- ACT-CAP-001: el dueño o quien él designe para la carta
- ACT-CAP-006: clientes, que ven el resultado

**Evidencia**

- NEC-CAP-011 y NEC-CAP-012: diseñador y decoración.
- NEC-CAP-016, NEC-CAP-058, NEC-CAP-067, NEC-CAP-082 y NEC-CAP-106: productos, listas y categorías.
- NEC-CAP-030, NEC-CAP-042, NEC-CAP-044 y NEC-CAP-045: novedades, fotos y destacadas.
- Mockup: Productos, Listas y categorías, Diseño de la carta, Novedades, Destacadas y Paleta.

**Alineamiento estratégico**

- NEC-CAP-011 Configurar la carta viéndola como el cliente.
- Autonomía del dueño sin programador.

## 2 OBJETIVOS

**Objetivo de negocio**

Que el dueño mantenga la carta y su publicidad al día sin programador.

**Objetivo del usuario**

Que el dueño vea la carta como el cliente mientras la cambia y publique cuando esté listo.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Cambios de carta que necesitaron programador | Por medir | Cero (propuesta) | Registro de cambios | Mensual |
| Novedades vencidas que siguen visibles | Por medir | Cero (RN-CAP-063) | Novedades | Semanal |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Productos nuevos, precios, fotos y agotados; tipos con sabores (NEC-CAP-058, NEC-CAP-082).
- Listas por categoría específica (tamaños, leches, endulzantes…) y categorías de la carta gestionables (RN-CAP-128 a RN-CAP-130).
- Diseñador de la carta en pantalla completa: orden, fotos, textos, ocultar, promociones del inicio y organización (NEC-CAP-011).
- Decoración festiva con su paleta (NEC-CAP-012).
- Diseñador de Novedades y publicidad, con vigencia, destacar y duplicar (NEC-CAP-044, NEC-CAP-051).
- Destacadas «Momentos Caprichos»: varias fotos, archivar y eliminar (NEC-CAP-045).
- Publicar o descartar con confirmación (RN-CAP-018).

**Fuera de alcance (OUT)**

- Datos del local: EP-CAP-017.
- Ofertas y cupones: EP-CAP-012.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-CON-01 | Productos, listas y categorías | Debería tener | Redactada en draft: [`FT-CON-01-productos-listas-y-categorias.md`](../features/FT-CON-01-productos-listas-y-categorias.md) |
| FT-CON-02 | Diseñador de la carta y decoración | Debería tener | Redactada en draft: [`FT-CON-02-disenador-de-la-carta-y-decoracion.md`](../features/FT-CON-02-disenador-de-la-carta-y-decoracion.md) |
| FT-CON-03 | Novedades y destacadas | Debería tener | Redactada en draft: [`FT-CON-03-novedades-y-destacadas.md`](../features/FT-CON-03-novedades-y-destacadas.md) |

**Supuestos**

- El dueño tiene fotos propias para productos y local (D-15).

**Restricciones**

- Los cambios se publican con una acción explícita (RN-CAP-018).
- Las opciones de producto no se eliminan: se desactivan.

**Dependencias y riesgos**

- DEP-05 Carta validada y fotos (D-15).

**Criterios de éxito / salida**

- El administrador cambia el orden, una foto y un precio, publica, y el cliente lo ve en la carta.
- Un producto o categoría creado en la sesión aparece al instante en el diseñador.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §4 y §5 (NEC-CAP-011, NEC-CAP-012, NEC-CAP-016, NEC-CAP-030, NEC-CAP-042, NEC-CAP-044, NEC-CAP-045, NEC-CAP-051, NEC-CAP-058, NEC-CAP-067, NEC-CAP-082, NEC-CAP-106, RN-CAP-018, RN-CAP-063, RN-CAP-128 a RN-CAP-130) y `analisis/registro-mockup.md` v191-v192 — Revisado por: *(pendiente)*
