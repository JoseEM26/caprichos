---
id: EP-CAP-014
tipo: spec
titulo: "EP-CAP-014 Chatbot: pedido y pago por WhatsApp"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-004, NEC-CAP-007, NEC-CAP-028, NEC-CAP-090, RN-CAP-005, RN-CAP-049, RN-CAP-101]
tags: [epica, plt-02, g1, chatbot, deberia-tener]
---

# EP-CAP-014 — Chatbot: pedido y pago por WhatsApp

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-014 |
| NOMBRE | Chatbot: pedido y pago por WhatsApp |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debería tener |
| HORIZONTE | Siguiente |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

El bot actual («Capri») solo entrega el enlace de la carta y no toma el pedido. Un bot con IA falló el 11 de octubre, generó quejas y gastó casi US$ 10 en tres días. Los clientes que no manejan la web no tienen cómo pedir con todas las opciones.

**Usuarios / segmentos**

- ACT-CAP-006: clientes que piden por WhatsApp, incluidas personas mayores
- ACT-CAP-002: cajero/a, que aprueba el pago

**Evidencia**

- NEC-CAP-004, NEC-CAP-007 y NEC-CAP-028.
- NEC-CAP-090: pago por WhatsApp automatizado.
- RN-CAP-005, RN-CAP-049 y RN-CAP-101.
- Acta 02 y `capri-bot/`.

**Alineamiento estratégico**

- NEC-CAP-004 Pedir por WhatsApp con todas las opciones.
- R-04 y R-07 Errores y costo de la IA.

## 2 OBJETIVOS

**Objetivo de negocio**

Vender por WhatsApp con las mismas reglas que la carta, sin errores que generen quejas y con un costo de IA controlado.

**Objetivo del usuario**

Que el cliente pida tocando botones, sin escribir, y sepa cómo pagar.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Pedidos completos tomados por el bot | Por medir | Por definir (propuesta) | Registro del bot | Semanal |
| Quejas por errores del bot | Por medir | Cero (NEC-CAP-007) | Formulario y consola de mensajes | Semanal |
| Costo mensual de la IA del bot | US$ 10 en 3 días con el bot actual (acta 02) | Por definir con el dueño (propuesta) | Facturación del proveedor de IA | Mensual |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Pedido por botones con las mismas opciones, precios y reglas que la carta (RN-CAP-005).
- Delivery o recojo con ubicación y costo de envío.
- Pago por WhatsApp: el bot pide el medio, envía los datos y recibe la captura; una persona aprueba (NEC-CAP-090, RN-CAP-101).
- IA solo para dudas y recomendaciones, consultando la disponibilidad real (RN-CAP-049).
- Promociones y descuentos que aplican en el chatbot.
- No recibe pedidos fuera de horario ni en pausa (NEC-CAP-085).

**Fuera de alcance (OUT)**

- La consola de chats y la atención por una persona: EP-CAP-015.
- Preferencias guardadas del cliente (horizonte futuro).

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-BOT-01 | Pedido por botones | Debería tener | Redactada en draft: [`FT-BOT-01-pedido-por-botones.md`](../features/FT-BOT-01-pedido-por-botones.md) |
| FT-BOT-02 | Pago por WhatsApp con aprobación | Debería tener | Redactada en draft: [`FT-BOT-02-pago-por-whatsapp-con-aprobacion.md`](../features/FT-BOT-02-pago-por-whatsapp-con-aprobacion.md) |
| FT-BOT-03 | IA para dudas y recomendaciones | Debería tener | Redactada en draft: [`FT-BOT-03-ia-para-dudas-y-recomendaciones.md`](../features/FT-BOT-03-ia-para-dudas-y-recomendaciones.md) |

**Supuestos**

- El negocio usa la API oficial de WhatsApp con un chip exclusivo (BRD §7).

**Restricciones**

- El bot no cambia pedidos ni manda a cocina por sí solo (RN-CAP-101, RN-CAP-105).
- El primer mensaje después de un pedido de la carta es una plantilla de pago (RN-CAP-100, D-08).

**Dependencias y riesgos**

- DEP-12 Acceso a la cuenta de WhatsApp (D-08).
- R-04 Errores del canal.
- R-07 Costo de la IA.

**Criterios de éxito / salida**

- El chatbot completa un pedido con las mismas opciones que la carta y lo entrega a caja.
- Un pedido con Yape deja el chat en «Validar pago» y, al aprobarlo, aparece en cocina.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §1, §4, §5 y §7 (NEC-CAP-004, NEC-CAP-007, NEC-CAP-028, NEC-CAP-085, NEC-CAP-090, RN-CAP-005, RN-CAP-049, RN-CAP-100, RN-CAP-101, RN-CAP-105) y el acta 02 — Revisado por: *(pendiente)*
