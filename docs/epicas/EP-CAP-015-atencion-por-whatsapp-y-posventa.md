---
id: EP-CAP-015
tipo: spec
titulo: "EP-CAP-015 Atención por WhatsApp y posventa"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-029, NEC-CAP-083, NEC-CAP-091, NEC-CAP-093, NEC-CAP-098, RN-CAP-102]
tags: [epica, plt-02, g1, atencion, deberia-tener]
---

# EP-CAP-015 — Atención por WhatsApp y posventa

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-015 |
| NOMBRE | Atención por WhatsApp y posventa |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debería tener |
| HORIZONTE | Siguiente |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Cuando una persona del equipo responde por WhatsApp, el bot sigue contestando y se cruzan los mensajes. No hay un lugar donde ver los chats pendientes, y las opiniones de los clientes después de la entrega no se piden ni se atienden.

**Usuarios / segmentos**

- ACT-CAP-002: cajero/a y call center, que atienden chats
- ACT-CAP-006: clientes que escriben después de pedir
- ACT-CAP-001: el dueño, que recibe las quejas

**Evidencia**

- NEC-CAP-083, NEC-CAP-091 y NEC-CAP-098: consola de mensajes con dueño único.
- NEC-CAP-093: cambios después del pedido.
- NEC-CAP-029 y RN-CAP-042: encuesta posventa.
- Mockup: Mensajes de WhatsApp.

**Alineamiento estratégico**

- NEC-CAP-007 Respuestas consistentes con la marca.
- Reputación en Google Maps.

## 2 OBJETIVOS

**Objetivo de negocio**

Atender cada chat sin cruces entre el bot y la persona, y convertir las buenas experiencias en reseñas.

**Objetivo del usuario**

Que el equipo vea los chats pendientes y tome uno con un toque; que el cliente pida cambios sin llamar.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Chats con respuesta del bot mientras los atendía una persona | Por medir | Cero (RN-CAP-102) | Consola de mensajes | Semanal |
| Clientes que responden la encuesta posventa | Por medir | 20 % (propuesta) | Registro de encuestas | Mensual |
| Quejas sin atender en 24 horas | Por medir | Cero (propuesta) | Consola y correo del dueño | Semanal |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Consola de chats con aspecto de WhatsApp: pendientes, filtros, respuestas rápidas y pantalla completa (NEC-CAP-083, NEC-CAP-098).
- Cada chat tiene un solo dueño (bot o persona); tomar y soltar el chat (RN-CAP-102).
- Aviso de «hablar con una persona» con nombre y teléfono (RN-CAP-048).
- Cambios después del pedido: el bot registra la solicitud y avisa a un asesor (RN-CAP-105).
- Encuesta posventa: positivas a Google Maps; negativas a una persona y aviso a gerencia (RN-CAP-042, RN-CAP-057).
- Pulir el mensaje antes de enviarlo, opcional (RN-CAP-111).

**Fuera de alcance (OUT)**

- El pedido y el pago por el bot: EP-CAP-014.
- Formulario «¿Cómo te fue?» de la carta: EP-CAP-001.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-ATN-01 | Consola de chats con dueño único | Debería tener | Redactada en draft: [`FT-ATN-01-consola-de-chats-con-dueno-unico.md`](../features/FT-ATN-01-consola-de-chats-con-dueno-unico.md) |
| FT-ATN-02 | Cambios después del pedido y derivación | Debería tener | Redactada en draft: [`FT-ATN-02-cambios-despues-del-pedido-y-derivacion.md`](../features/FT-ATN-02-cambios-despues-del-pedido-y-derivacion.md) |
| FT-ATN-03 | Encuesta posventa y quejas | Podría tener | Redactada en draft: [`FT-ATN-03-encuesta-posventa-y-quejas.md`](../features/FT-ATN-03-encuesta-posventa-y-quejas.md) |

**Supuestos**

- Las personas del equipo atienden desde la computadora de caja o su celular.

**Restricciones**

- Pulir el mensaje nunca envía solo (RN-CAP-111).

**Dependencias y riesgos**

- DEP-12 Acceso a WhatsApp (D-08).

**Criterios de éxito / salida**

- Mientras una persona atiende un chat, el bot no responde aunque el cliente escriba.
- A las 2 horas de la entrega el cliente recibe la encuesta y una queja llega al dueño.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §5 (NEC-CAP-029, NEC-CAP-083, NEC-CAP-091, NEC-CAP-093, NEC-CAP-098, RN-CAP-042, RN-CAP-048, RN-CAP-057, RN-CAP-102, RN-CAP-105, RN-CAP-111) y el mockup de Mensajes — Revisado por: *(pendiente)*
