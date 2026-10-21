---
id: EP-CAP-018
tipo: spec
titulo: "EP-CAP-018 Informes, indicadores y notificaciones"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-041, NEC-CAP-077, NEC-CAP-047, NEC-CAP-050]
tags: [epica, plt-02, g1, informes, podria-tener]
---

# EP-CAP-018 — Informes, indicadores y notificaciones

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-018 |
| NOMBRE | Informes, indicadores y notificaciones |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Podría tener |
| HORIZONTE | Después |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

El dueño no tiene números para decidir: ventas por canal, por medio de pago, por producto o por zona. Los avisos importantes (pedido por confirmar, stock bajo, impresora caída) se pierden porque no hay un lugar que los ordene.

**Usuarios / segmentos**

- ACT-CAP-001: el dueño, que revisa informes e indicadores
- ACT-CAP-002: todos los roles, que reciben notificaciones de su función

**Evidencia**

- NEC-CAP-041: estadística con gráficos y filtros.
- NEC-CAP-077: mapa de entregas.
- NEC-CAP-047 y NEC-CAP-050: filtros del administrativo.
- Mockup: Informes (23 informes con período y filtros), Indicadores, Mapa de entregas y Notificaciones (`analisis/registro-mockup.md` v189-v193).

**Alineamiento estratégico**

- OBJ-CAP-001, OBJ-CAP-002 y OBJ-CAP-003: medir los tres objetivos.

## 2 OBJETIVOS

**Objetivo de negocio**

Decidir con datos: qué se vende, por qué canal, con qué medio y dónde.

**Objetivo del usuario**

Que el dueño abra un informe, elija el período y lo descargue; que cada rol vea primero lo urgente.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Objetivos del BRD medidos con datos del sistema | Ninguno | Los tres (OBJ-CAP-001 a OBJ-CAP-003) | Informes del sistema | Mensual |
| Notificaciones urgentes sin atender después de 30 minutos | Por medir | Cero (propuesta) | Notificaciones | Semanal |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Informes con período (hoy, ayer, 7 días, desde-hasta) y filtros de canal, pago y modalidad, descargables para Excel.
- Indicadores y estadística con gráficos en el escritorio del administrador (NEC-CAP-041).
- Mapa de entregas con calor, zonas y radios desde la tienda (NEC-CAP-077).
- Notificaciones por rol con prioridad que sube con el tiempo, página propia e historial con filtros.

**Fuera de alcance (OUT)**

- Mapa de calor de ventas en tienda (horizonte futuro).
- Informes contables o tributarios.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-INF-01 | Informes con período y filtros | Podría tener | Redactada en draft: [`FT-INF-01-informes-con-periodo-y-filtros.md`](../features/FT-INF-01-informes-con-periodo-y-filtros.md) |
| FT-INF-02 | Indicadores y mapa de entregas | Podría tener | Redactada en draft: [`FT-INF-02-indicadores-y-mapa-de-entregas.md`](../features/FT-INF-02-indicadores-y-mapa-de-entregas.md) |
| FT-INF-03 | Notificaciones | Debería tener | Redactada en draft: [`FT-INF-03-notificaciones.md`](../features/FT-INF-03-notificaciones.md) |

**Supuestos**

- Hay historial suficiente de pedidos y cierres para los informes.

**Restricciones**

- Solo el administrador ve ventas e indicadores del negocio (RN-CAP-013).

**Dependencias y riesgos**

- Todas las épicas de la fase Ahora (fuente de los datos).

**Criterios de éxito / salida**

- El dueño saca la caja por medio de pago de los últimos 7 días y la descarga.
- Cada rol ve sus notificaciones ordenadas por urgencia.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §4 y §5 (NEC-CAP-041, NEC-CAP-047, NEC-CAP-050, NEC-CAP-077, RN-CAP-013) y `analisis/registro-mockup.md` v189-v193 — Revisado por: *(pendiente)*
