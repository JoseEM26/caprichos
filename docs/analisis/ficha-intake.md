---
id: INT-CAP-001
tipo: spec
titulo: Ficha de intake — plataforma digital de Caprichos (carta virtual, módulo administrativo y chatbot)
estado: approved
producto: caprichos
version: "1.1"
owner: "Kevin Rosales (negocio)"
aprobadores: ["José Ángel Espinoza (Product Owner)"]
fecha: 2026-10-13
relacionados: [BRD-CAP-001, INI-CAP-002]
tags: [intake, g0, t3]
---

# Ficha de Intake (T-INTAKE) - G0

- Ticket: *(pendiente — R13; lo asigna el tablero y se registra aquí y en `relacionados`)*
- Solicitante: Kevin Rosales, Caprichos (cliente)
- Problema: Caprichos opera con herramientas separadas y sin integrarse: una
  carta digital anterior en OlaClick (plan vencido, solo lectura), un sistema
  POS/administrativo (restaurant.pe) y un chatbot de WhatsApp ("Capri") que, ante la palabra "Carta",
  devuelve el enlace de la carta digital de restaurant.pe y empuja a pedir por la
  web; ofrece compartir fotos de la carta, pero no toma el pedido. (En la reunión
  Kevin mencionó además un bot con IA que falló el domingo 11 de octubre y
  generó quejas de clientes.) El pedido por WhatsApp
  no se une a la base de datos: no valida stock, no pasa por caja ni llega a las
  pantallas de cocina. Parte de los clientes (personas mayores) no maneja bien
  la web. Los procesos son empíricos, sin manual de operaciones, y el tiempo de
  entrega actual es de 20 a 25 minutos.
- Valor esperado: un sistema unificado con tres líneas de producto sobre una
  misma base de datos: (1) carta virtual con carrito y checkout; (2) módulo
  administrativo con stock de insumos en tiempo real, recetas con margen de
  utilidad y pantallas de cocina; (3) chatbot de WhatsApp que toma el pedido
  completo con las mismas opciones que la web (variantes, leche, endulzante,
  cremas y adicionales), sobre la API de WhatsApp Business *(supuesto: se cree que
  ya cuentan con ella; por confirmar con Kevin)*. El pedido por chatbot lo acepta el cajero y recién
  entonces aparece en cocina y empiezan a correr los tiempos. Meta de negocio
  declarada: bajar el tiempo de entrega de 20-25 min a 13 min como máximo.
  Las líneas base y metas se fijan en el BRD §2 *(por medir)*.
- Alcance añadido tras la reunión (por confirmar con Kevin): siete roles con
  escritorio propio y acceso solo a lo que les corresponde (incluido el
  repartidor, con Waze o Google Maps); administración visual de la carta
  (orden, fotos, textos, precios, promociones) con publicación explícita;
  decoración festiva temporal con paleta propia; nada se elimina (solo
  desactivar) y toda acción pide confirmación Sí/No. Detalle en el BRD
  (NEC-CAP-010 a 016, RN-CAP-013 a 026); se incluye la impresión automática de la comanda en la ticketera de red al aceptar un pedido (análisis en `impresion-tickets.md`) y la pantalla de cocina en TV (análisis en `pantalla-cocina.md`). El prototipo de UX vive aparte, en un artifact.
- Alcance añadido tras la segunda reunión, 14 de octubre (acta 02; por confirmar
  con Kevin): pedido simple en la carta (productos primero, datos al final, sin
  fecha ni correo obligatorio, Yape y Plin visibles, pago confirmado por WhatsApp,
  dirección recordada por teléfono con ubicación actual y mapa); pantallas de cocina por
  área (bebidas, postres, salados) con los combos repartidos; control de mesas
  sin pedidos duplicados y reservas por WhatsApp; chatbot de botones con IA solo
  para dudas, reservas, asesor humano y posventa con opiniones; almacén con
  entradas, salidas, merma y descuento por receta; puntos de fidelidad, crédito
  del personal con 25 % de descuento y nota de venta por defecto. Modo sin internet:
  el cliente prefiere tenerlo; se propone una base de datos local con
  sincronización posterior, como fase aparte (ver la propuesta en el prototipo).
  Las reservas por WhatsApp son solicitudes que aprueba el personal.
  Detalle en el BRD (NEC-CAP-017 a 031, RN-CAP-028 a 046) y en
  `analisis/iniciativas-acta-02.md` (INI-CAP-002).
- Tipo: **T3** (asignan PO y TL juntos) - motivo: producto nuevo que integra POS,
  stock, cocina y un canal de WhatsApp, y maneja datos de clientes y cobros.
- Owner de negocio: Kevin Rosales
- Duplicado de ítem existente: no, según el equipo *(a confirmar contra el tablero)*
- Correo de formalización: borrador en `gates/<ticket>/G0.md`, sección 1;
  **pendiente de crear y de envío** (falta el ticket)
- Generado por IA: sí - Revisado por: *(pendiente)*

**Artefactos que exige T3** (matriz del marco): Ficha de Intake · BRD ·
Functional Spec · UX con user flow y mockup en Figma · ADR · HU con DoR · Test
Plan con regresión y performance · Release Plan individual · Deployment Plan ·
Migration Plan · Rollback Plan específico y probado · Aprobación de negocio ·
Postmortem al cierre del release. Revisores por PR: **2**. Aprobación de
negocio: **PO + Stakeholder + TL**.
