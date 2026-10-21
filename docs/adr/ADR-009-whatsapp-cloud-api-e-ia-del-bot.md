---
id: ADR-009
tipo: adr
titulo: "Chatbot con la API oficial de WhatsApp (Cloud API) e IA de OpenAI acotada"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, D-08, DT-32, DT-33, DT-18, R-04, R-07, RN-CAP-049, RN-CAP-100, RN-CAP-101, DEP-12]
tags: [adr, chatbot, whatsapp, ia, g3]
---

# ADR-009: Chatbot con la API oficial de WhatsApp (Cloud API) e IA de OpenAI acotada

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

El chatbot toma pedidos por botones, escribe al cliente tras un pedido de la carta, recibe capturas de pago, toma reservas, deriva a una persona y hace la encuesta (EP-CAP-014, EP-CAP-015). La IA solo responde dudas (DT-18). El bot actual usa OpenAI y gastó casi US$ 10 en 3 días (R-07), y tuvo errores con clientes (R-04).

Kevin ya usa la API oficial de Meta (BRD §7); falta el acceso a la cuenta (DEP-12). José eligió Cloud API y OpenAI con modelo pequeño (DT-32, DT-33).

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** **WhatsApp Cloud API** directo, con webhook en la API; flujo por **botones y listas interactivas** en el módulo `bot`; **OpenAI con un modelo pequeño** solo para dudas, recomendaciones y «Pulir mensaje», con tope de gasto | — | Que el costo de IA o la calidad de respuestas empeore (cambiar de proveedor está aislado detrás de un puerto). |
| Proveedor intermediario (360dialog o Twilio) | Cuota mensual extra por lo que la API directa ya da. | Que el alta con Meta se complique. |
| Librería no oficial (Baileys) | Viola los términos de WhatsApp: el número puede ser bloqueado. | Ninguno para un negocio. |
| Claude Haiku como IA | Válido; se eligió seguir con el proveedor que ya conocen. | Que OpenAI invente datos o suba de precio. |

## Decisión

1. **Webhook** `POST /api/v1/whatsapp/webhook` con verificación de firma `X-Hub-Signature-256`; responde 200 de inmediato y encola el mensaje (ADR-007).
2. Cada **conversación tiene un dueño**: `BOT` o una persona (RN-CAP-102). Con dueño persona, el bot no responde. El flujo del bot es una máquina de estados por conversación (inicio → categorías → producto → opciones → carrito → entrega → pago → confirmado) que usa el mismo cálculo de precios de `packages/compartido` (RN-CAP-005).
3. Plantillas aprobadas por Meta para el primer mensaje tras un pedido de la carta, para el recordatorio y para la encuesta (RN-CAP-100). Se registra el costo estimado de cada envío.
4. El bot **no confirma pagos** ni manda a cocina: la captura queda en «Validar pago» y una persona decide (RN-CAP-101).
5. **IA detrás del puerto `AsistenteIA`** con adaptador de OpenAI. Recibe solo la carta vigente, la disponibilidad y la pregunta, nunca datos personales (ADR-005). Instrucción fija: no inventar precios ni promociones; si no sabe, derivar. Tope mensual configurable con aviso al 80 % y corte al 100 % (R-07). El modelo exacto se fija al construir.
6. Pruebas usa el **número de prueba de Meta** (DT-39).

## Consecuencias

- Obliga a:
  - Que Kevin dé acceso a la cuenta de Meta y apruebe las plantillas (DEP-12).
  - Registrar el costo mensual de plantillas e IA.
- Impide:
  - Que el bot cierre pedidos o pagos sin una persona.
- Cuesta:
  - Plantillas de WhatsApp por conversación iniciada por el negocio (tarifa de Perú por confirmar, D-08) y uso de OpenAI con tope.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: variable por uso: plantillas de Meta e IA de OpenAI, con tope.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: `conversacion`, `mensaje_chat`, `carrito_bot`, `solicitud_reserva`, `comprobante_pago`, `uso_ia`, `uso_plantilla`.
- Linaje: Meta → webhook → cola → bot; salidas por la API de Meta. **Datos personales:** teléfono y nombre del perfil de WhatsApp, capturas de pago (ADR-005). A OpenAI solo va texto sin datos personales.
- Reglas de calidad: 0 pedidos del bot con precio distinto al de la carta; 0 respuestas del bot en chats con dueño persona.

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (D-08, DT-32, DT-33, DT-18) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL
