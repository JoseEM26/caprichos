---
id: ADR-007
tipo: adr
titulo: "Colas de trabajo, tareas programadas y bloqueos con Redis y BullMQ"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, DT-28, RNF-CAP-010, R-09, RN-CAP-024, RN-CAP-102, RN-CAP-133]
tags: [adr, redis, bullmq, concurrencia, g3]
---

# ADR-007: Colas de trabajo, tareas programadas y bloqueos con Redis y BullMQ

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

Hay trabajos que no deben frenar al usuario (imprimir, enviar mensajes de WhatsApp, responder al webhook de Meta en menos de 5 segundos) y tareas programadas (encuesta a las 2 horas, vencer reservas, «agotado por hoy» a las 00:00, recordatorio de pedido por confirmar, anonimización mensual).

Hay operaciones que dos personas pueden hacer a la vez: abrir una mesa, tomar un reparto, tomar un chat, confirmar un pedido, canjear un cupón (RNF-CAP-010, R-09). José eligió Redis con BullMQ (DT-28).

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** **Redis 7 + BullMQ** para colas y tareas programadas; Redis también para los bloqueos cortos, el límite de intentos y el adaptador de Socket.IO | — | Que Redis sea la única pieza que falle seguido (entonces, cola en PostgreSQL). |
| Cola en PostgreSQL (pg-boss) y bloqueos con `FOR UPDATE` | Funciona, pero el límite de intentos y el adaptador de Socket.IO pedirían Redis igual. | Quitar Redis para ahorrar una pieza. |
| RabbitMQ o Kafka | Excesivo para un local; Kafka pide más de 1 GB de RAM. | Varios locales o integración con otros sistemas. |

## Decisión

1. Colas: `impresion`, `whatsapp-salida`, `whatsapp-entrada` (el webhook responde 200 de inmediato y encola), `ia`, `notificaciones` y `mantenimiento`. Reintentos con espera creciente; los trabajos fallidos quedan visibles.
2. Tareas programadas (zona `America/Lima`): vencer reservas pasada la tolerancia (RN-CAP-107), reactivar «agotado por hoy» a las 00:00 (RN-CAP-085), recordatorio de pedido por confirmar (D-05), encuesta posventa (FT-ATN-03), ranking mensual el día 1 (RN-CAP-052), liberar chats inactivos (RN-CAP-102), anonimización (ADR-005) y copias (ADR-012).
3. Bloqueos cortos con `SET NX PX` (de 5 a 30 segundos) para mesa, reparto, chat y confirmación. **La base es la garantía final**: índices únicos parciales y `UPDATE` condicionales (ADR-003). Si dos llegan a la vez, uno gana y el otro recibe 409 con un mensaje claro.
4. Límite de intentos con contadores en Redis: ingreso (5 intentos, D-17) y cupones (5 intentos / 5 minutos, V11).
5. Redis con persistencia AOF y `maxmemory` de 256 MB. Una instancia por ambiente (DT-39).

## Consecuencias

- Obliga a:
  - Que todo trabajo sea idempotente: reintentar no imprime ni envía dos veces sin marcarlo.
- Impide:
  - Guardar en Redis datos que no se puedan reconstruir.
- Cuesta:
  - 50 a 100 MB de RAM.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: ninguno.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: ninguna persistente (los trabajos viven en Redis; su resultado se guarda en la tabla de negocio, como `print_job`).
- Linaje: la API encola y los procesadores de la misma API consumen.
- Reglas de calidad: 0 trabajos fallidos sin atender más de 1 hora (alerta de vigilancia).

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (DT-28) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL
