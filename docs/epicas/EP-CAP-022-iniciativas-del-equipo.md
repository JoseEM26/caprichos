---
id: EP-CAP-022
tipo: spec
titulo: "EP-CAP-022 Iniciativas del equipo"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, DT-53, DT-49, ADR-014, RNF-CAP-009, FT-USR-04]
tags: [epica, plt-02, g1, iniciativas, deberia-tener]
---

# EP-CAP-022 — Iniciativas del equipo

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-022 |
| NOMBRE | Iniciativas del equipo |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | *(vacío — R16; DT-01)* |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debería tener |
| HORIZONTE | Siguiente (H2, supuesto D-19) |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Quien trabaja en el local ve a diario lo que falla o podría mejorar: una tablet sin batería, una etiqueta difícil de leer, un combo que se vendería más. Hoy eso se dice de pasada, se olvida o se pierde en un chat. Falta un lugar simple donde cualquiera del equipo deje su queja, su mejora o su idea, con una captura y su comentario, donde todos la vean y donde el dueño sepa quién la dijo y qué se hizo con ella.

**Usuarios / segmentos**

- EQUIPO: cualquier persona con usuario: sube, mira y comenta
- ACT-CAP-001: Kevin Rosales, dueño: revisa y decide el estado de cada iniciativa

**Evidencia**

- Pedido del desarrollador del 20/10/2026 (módulo «Iniciativas»), registrado como DT-53 en `analisis/decisiones.md`.
- Pantalla «Iniciativas» del mockup navegable (DT-04).
- DT-49 y ADR-014: todo cambio queda en el Historial de acciones.

**Alineamiento estratégico**

- Apoya la mejora continua del local sin sumar procesos nuevos.
- Reutiliza la auditoría (FT-USR-04) y las fotos privadas de ADR-012.

## 2 OBJETIVOS

**Objetivo de negocio**

Que las quejas, mejoras e ideas del equipo no se pierdan, que se sepa quién las dijo y que el dueño decida qué se hace con cada una.

**Objetivo del usuario**

Que cualquiera del equipo suba lo que ve en menos de un minuto, con su captura, y vea después qué pasó.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Iniciativas subidas por mes | Por medir | ≥ 4 (propuesta) | Tabla `iniciativa` | Mensual |
| Iniciativas revisadas (distintas de «Nueva») a los 14 días | Por medir | ≥ 80 % (propuesta) | Tabla `iniciativa` | Mensual |
| Personas distintas que subieron o comentaron | Por medir | ≥ 3 (propuesta) | Tablas `iniciativa` e `iniciativa_comentario` | Mensual |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Subir una iniciativa con tipo (queja, mejora o idea), área, título, comentario y una captura opcional.
- Lista que ven todos, con quién la subió, buscador y filtros por tipo, estado y «solo las mías».
- Comentarios de cualquiera del equipo.
- Estado que solo cambia el administrador: nueva, en revisión, hecha o no por ahora.
- Todo queda en el Historial de acciones con su IP (DT-49).

**Fuera de alcance (OUT)**

- Subir de forma anónima: siempre se muestra quién la subió.
- Votos, puntos o premios por iniciativa.
- Editar o borrar lo ya subido: no se borra; se comenta o se cambia su estado.
- Aviso por WhatsApp o correo al subir: se ve en el menú con el número de nuevas.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-INI-01 | Iniciativas del equipo | Debería tener | Redactada en draft: [`FT-INI-01-iniciativas-del-equipo.md`](../features/FT-INI-01-iniciativas-del-equipo.md) |

**Supuestos**

- Todo el personal tiene usuario propio (EP-CAP-013).
- La captura es una imagen de hasta 5 MB que se guarda en la carpeta privada del VPS (ADR-012).

**Restricciones**

- Sin borrado: una iniciativa solo cambia de estado (RN-CAP-014).
- Todo el personal ve todas las iniciativas y a su autor, por decisión del dueño (DT-53).

**Dependencias y riesgos**

- EP-CAP-013 Personal, usuarios y roles (usuarios y Historial de acciones).
- ADR-012 para guardar las capturas.
- R-01 alcance que crece.

**Criterios de éxito / salida**

- Un cajero sube una queja con captura y el administrador la ve en la lista con el nombre de quien la subió.
- Cada acción de iniciativas aparece en el Historial de acciones con su IP.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: Decisiones DT-53 y DT-49, ADR-014 y ADR-012 — Revisado por: *(pendiente)*
