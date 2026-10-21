---
id: EP-CAP-021
tipo: spec
titulo: "EP-CAP-021 Plataforma, despliegue y operación"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, FT-PLA-01, FT-PLA-02, FT-PLA-03, FT-PLA-04, FT-PLA-05, BRD-CAP-001, RMP-CAP-001, DT-51, ADR-011, ADR-012, ADR-001, RNF-CAP-003, DEP-02, R-06]
tags: [epica, plt-02, g1, plataforma, debe-tener]
---

# EP-CAP-021 — Plataforma, despliegue y operación

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-021 |
| NOMBRE | Plataforma, despliegue y operación |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debe tener |
| HORIZONTE | Ahora (primera ola de construcción) |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 20/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Todas las épicas de negocio necesitan un lugar donde correr: un repositorio, una forma de validar y publicar cada cambio, un servidor preparado, ambientes de pruebas y producción, copias de seguridad, vigilancia y mantenimiento. Las decisiones están tomadas (DT-30 y DT-36 a DT-47, ADR-011 y ADR-012), pero hasta ahora no tenían épica propia: sus tareas colgaban de una historia de la carta y nadie era dueño de requisitos como «restaurar el sistema en menos de una hora». Es una **épica habilitadora**: no la ve el cliente, pero sin ella no se puede entregar nada.

**Usuarios / segmentos**

- DEV (equipo de desarrollo y operación): quien construye y opera el sistema (hoy José Ángel Espinoza, DT-07)
- ACT-CAP-001: el dueño, que necesita que el sistema esté disponible y sus datos a salvo

**Evidencia**

- ADR-011 (VPS, Dokploy, Ansible, Cloudflare, CI/CD, ambientes) y ADR-012 (archivos, copias, vigilancia, mantenimiento).
- Decisiones DT-30, DT-31 y DT-35 a DT-47 en `analisis/decisiones.md`.
- RNF-CAP-003 (disponibilidad en horario de atención) y los casos PERF-06 y PERF-07 del plan de pruebas.
- R-06 (caída en hora punta) y R-10 del roadmap.

**Alineamiento estratégico**

- Habilita todas las épicas de la fase Ahora (piloto H1).
- OBJ-CAP-001 y OBJ-CAP-002 dependen de que el sistema esté en línea en horario de atención.

## 2 OBJETIVOS

**Objetivo de negocio**

Tener el sistema en línea en horario de atención, publicar cambios sin miedo y poder recuperarlo rápido si algo falla.

**Objetivo del usuario**

Que quien desarrolla publique un cambio con un tag, sepa al momento si algo se cae y pueda volver atrás o restaurar una copia siguiendo un runbook.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Disponibilidad en horario de atención | Por medir | ≥ 99,5 % mensual (RNF-CAP-003) | Uptime Kuma | Mensual |
| Tiempo para restaurar el sistema desde una copia | Por medir | < 1 hora (propuesta) | Prueba trimestral de restauración | Trimestral |
| Publicaciones a producción con vuelta atrás exitosa cuando hizo falta | Por medir | 100 % (propuesta) | Historial de despliegues de Dokploy | Por publicación |
| Días con copia diaria verificada | Por medir | 100 % (propuesta) | Uptime Kuma (latido de la copia) | Diaria |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Monorepo con pnpm y la base de la API (DT-36, ADR-001).
- CI en cada PR y publicación automática a pruebas y a producción con tag (DT-41).
- VPS preparado con Ansible, Dokploy, Cloudflare, firewall y ambientes aislados (DT-30, DT-39, DT-40, DT-42).
- Secretos fuera del repositorio (DT-43).
- Copia diaria cifrada fuera del VPS y restauración probada (DT-31, DT-47).
- Vigilancia con Uptime Kuma y errores con GlitchTip (DT-44, DT-45).
- Parches, Renovate, Trivy y rotación de claves (DT-47).
- Documentos de operación en `operacion/`: runbooks, plan de release, revisión de seguridad e inventario (DT-51).

**Fuera de alcance (OUT)**

- Grafana, Loki y Prometheus: después del piloto (DT-46).
- Alta disponibilidad con dos servidores (aceptado como riesgo, ADR-011).
- Modo sin internet: EP-CAP-019.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-PLA-01 | Monorepo y publicación automática | Debe tener | Redactada en draft: [`FT-PLA-01-monorepo-y-publicacion-automatica.md`](../features/FT-PLA-01-monorepo-y-publicacion-automatica.md) |
| FT-PLA-02 | Servidor, red, ambientes y secretos | Debe tener | Redactada en draft: [`FT-PLA-02-servidor-red-ambientes-y-secretos.md`](../features/FT-PLA-02-servidor-red-ambientes-y-secretos.md) |
| FT-PLA-03 | Copias y recuperación | Debe tener | Redactada en draft: [`FT-PLA-03-copias-y-recuperacion.md`](../features/FT-PLA-03-copias-y-recuperacion.md) |
| FT-PLA-04 | Vigilancia y alertas | Debe tener | Redactada en draft: [`FT-PLA-04-vigilancia-y-alertas.md`](../features/FT-PLA-04-vigilancia-y-alertas.md) |
| FT-PLA-05 | Seguridad y mantenimiento | Debe tener | Redactada en draft: [`FT-PLA-05-seguridad-y-mantenimiento.md`](../features/FT-PLA-05-seguridad-y-mantenimiento.md) |

**Supuestos**

- El VPS contratado (DT-30) está disponible y con acceso SSH.
- Hay una cuenta de almacenamiento para las copias (Backblaze B2 o Cloudflare R2).

**Restricciones**

- Un solo VPS de 8 GB (DT-30).
- Una sola persona opera el sistema: todo procedimiento debe estar escrito en un runbook.

**Dependencias y riesgos**

- DEP-02 Plataforma y hosting (resuelto por ADR-001 y ADR-011, pendiente de G3).
- Cambio de servidores de nombres de `caprichos.pe` en punto.pe (ADR-011).
- R-06 Caída de internet en hora punta.

**Criterios de éxito / salida**

- Un cambio pasa de un PR a pruebas sin pasos manuales y a producción con un tag.
- Se restauró una copia en el ambiente de pruebas en menos de una hora.
- Una caída de la API llega como aviso al celular en menos de dos minutos.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: Decisiones DT-30, DT-31, DT-35 a DT-47 y DT-51, ADR-001, ADR-011 y ADR-012 — Revisado por: *(pendiente)*
