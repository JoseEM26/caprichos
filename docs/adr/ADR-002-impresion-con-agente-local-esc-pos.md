---
id: ADR-002
tipo: adr
titulo: "Impresión de comandas y etiquetas con un agente local ESC/POS"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, D-13, DT-29, DEP-03, R-08, RN-CAP-019, RN-CAP-020, RN-CAP-021, RNF-CAP-013]
tags: [adr, impresion, agente-local, esc-pos, g3]
---

# ADR-002: Impresión de comandas y etiquetas con un agente local ESC/POS

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

Al pasar un pedido a cocina deben imprimirse la comanda por área y tres tipos de etiqueta (NEC-CAP-013, NEC-CAP-060); si falla, caja recibe alerta y reimprime (RN-CAP-021). Un navegador no puede imprimir solo y en silencio en una ticketera.

El modelo y la conexión de las ticketeras del local aún no se conocen (D-13, DEP-03, R-08).

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** **agente local** en Node (`apps/agente-local`) instalado en la PC de caja, conectado a la API por WebSocket saliente, que imprime por **ESC/POS** en ticketeras de red o USB | — | Que las ticketeras no hablen ESC/POS o que no haya una PC siempre encendida. |
| QZ Tray desde el navegador | Requiere certificado y licencia para no mostrar avisos; depende de que el navegador de caja esté abierto. | Que no se pueda instalar un servicio en la PC de caja. |
| Impresión en la nube (PrintNode) | Costo mensual y depende de internet para imprimir en el mismo local. | Que no haya PC en el local. |
| Electron o Tauri como app de escritorio | Pesan más y hay que distribuir actualizaciones; la PWA ya cubre la interfaz (DT-29). | Que haga falta interfaz nativa además de imprimir. |

## Decisión

1. El agente es un **servicio de Windows o Linux** que arranca con la PC. Se conecta a la API por WebSocket saliente (no abre puertos en el local) con una **llave propia de dispositivo**, que el administrador puede revocar.
2. Cuando un pedido pasa a cocina, la API encola un **trabajo de impresión por área y por tipo** (comanda, etiqueta general, por área y por bebida) en BullMQ (ADR-007) y lo envía al agente. El agente responde «impreso» o «error».
3. Si no responde en 10 segundos o devuelve error, el trabajo queda «fallido» y caja recibe la alerta con «Reimprimir» (RN-CAP-021, RNF-CAP-013). La reimpresión crea un trabajo nuevo marcado como **COPIA**.
4. Cada área tiene asignada su impresora en Configuración del local (RN-CAP-020) y cada tipo de etiqueta se activa o desactiva allí (NEC-CAP-060).
5. En el ambiente de pruebas el agente **genera PDF** en lugar de imprimir (DT-39).
6. El agente es la base del modo sin internet (ADR-013).

## Consecuencias

- Obliga a:
  - Relevar modelo, conexión y ancho de papel de cada ticketera y etiquetera antes de construir (DEP-03).
  - Mantener una PC de caja encendida en horario de atención.
  - Probar la impresión con la ticketera real (criterio del BRD §6).
- Impide:
  - Imprimir si la PC de caja está apagada o sin red local.
- Cuesta:
  - Desarrollo del agente y su instalador.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: ninguno (sin licencias ni servicios de pago).

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: `print_job` (pedido, área, tipo, estado, intentos, impresora) y `device_key` (llave del agente y de la TV de cocina).
- Linaje: la API crea el trabajo y el agente actualiza su estado. Sin datos personales en la comanda de cocina (RN-CAP-023); la copia de despacho sí lleva dirección y teléfono.
- Reglas de calidad: 0 pedidos en cocina sin trabajo de impresión registrado.

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (D-13, DT-29) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL
