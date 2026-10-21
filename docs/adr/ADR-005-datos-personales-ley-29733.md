---
id: ADR-005
tipo: adr
titulo: "Datos personales: consentimiento, enmascarado y conservación (Ley 29733)"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, D-18, R-11, RN-CAP-045, RN-CAP-071, RNF-CAP-008, DEP-09]
tags: [adr, datos-personales, seguridad, legal, g3]
---

# ADR-005: Datos personales: consentimiento, enmascarado y conservación (Ley 29733)

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

El sistema guarda DNI, nombre, teléfono, correo, cumpleaños, direcciones con ubicación y capturas de pago de clientes y del personal. La Ley 29733 exige consentimiento, finalidad, seguridad y atención de derechos. D-18 deja abierta la política; R-11 es el riesgo.

El texto del aviso de privacidad requiere revisión legal (DEP-09). Este ADR fija lo técnico.

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** consentimiento registrado por persona, mínimo necesario, DNI enmascarado en listas, comprobantes de pago privados, sin datos personales en la IA ni en la vigilancia, y plazos de conservación propuestos | — | Lo que diga la revisión legal (DEP-09). |
| Guardar todo sin plazo | Incumple el principio de proporcionalidad de la ley y crece el riesgo ante una filtración. | Ninguno. |
| No guardar datos del cliente (solo del pedido) | Impide recordar la dirección (RN-CAP-045) y los puntos (NEC-CAP-036). | Que Kevin renuncie a esas funciones. |

## Decisión

1. Sin `consent` vigente, los datos del cliente solo se usan **para ese pedido**: no se recuerdan ni suman puntos (RN-CAP-045, RN-CAP-066).
2. El DNI se muestra **enmascarado** (`4567****`) en listas y completo solo al rol `ADMIN` (RN-CAP-071). Las búsquedas por DNI exigen el número completo.
3. Las **capturas de pago** van en una carpeta privada (ADR-012), visibles solo para quien confirma pagos y el administrador, y se sirven por la API con autorización, nunca por una URL pública.
4. A la IA (ADR-009) se le envía solo la carta y la pregunta; nunca DNI, teléfono ni dirección. GlitchTip filtra DNI, teléfonos y tokens (ADR-012).
5. Conservación (propuesta, pendiente de revisión legal): capturas de pago 12 meses; datos de clientes sin pedidos en 24 meses, anonimizados; pedidos y cobros 5 años por razones contables, con los datos personales anonimizados pasados 24 meses.
6. Derechos: el administrador puede exportar y anonimizar los datos de una persona desde su ficha. La anonimización reemplaza nombre, documento y contactos y conserva los montos.
7. Las copias de seguridad van cifradas (restic, ADR-012). La transmisión va siempre por HTTPS (ADR-011).

## Consecuencias

- Obliga a:
  - Revisar con asesor legal el aviso de privacidad, los plazos y el registro del banco de datos ante la autoridad (DEP-09).
  - Un trabajo mensual de anonimización según los plazos.
- Impide:
  - Usar datos de clientes para fines no informados (por ejemplo, publicidad) sin un nuevo consentimiento.
- Cuesta:
  - Desarrollo de exportar y anonimizar.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: ninguno.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: `consent` (ADR-004) y `data_request` (pedido de derechos: tipo, persona, estado, fecha).
- Linaje: datos personales nacen en la carta, la caja, el bot y Usuarios; se leen en pedidos, reparto y cuentas; salen solo a Meta (teléfono, para WhatsApp) y Google (dirección escrita, para buscarla).
- Reglas de calidad: 0 clientes recordados sin `consent`; 0 DNI completos en listas.

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (D-18) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL
