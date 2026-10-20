---
id: ADR-010
tipo: adr
titulo: "Mapas: Google Places para elegir la dirección y Leaflet con zonas propias"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, DT-34, D-03, NEC-CAP-049, NEC-CAP-059, RN-CAP-103, RN-CAP-122, DEP-07]
tags: [adr, mapas, delivery, zonas, g3]
---

# ADR-010: Mapas: Google Places para elegir la dirección y Leaflet con zonas propias

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

El delivery necesita: ubicación actual del cliente (NEC-CAP-049), buscar la dirección que dicta el cliente (NEC-CAP-059), calcular la zona y el envío solos (RN-CAP-103) y un mapa de entregas (NEC-CAP-077). Nominatim encuentra peor las direcciones de Lima. Los términos de Google no permiten mostrar resultados de Places sobre un mapa que no sea de Google. José eligió la combinación (DT-34).

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** **Google Places + mapa de Google** donde se elige la dirección; **Leaflet + OpenStreetMap** en lo interno; la **zona se calcula en el propio sistema** (punto dentro de polígono) | — | Que la cuota gratis de Google no alcance o cambie de precio. |
| Todo con Google Maps | Gasta más cuota sin necesidad en mapas internos. | Que se quiera una sola apariencia. |
| Todo con Nominatim y Leaflet | Peor búsqueda en Lima y sin autocompletar. | Que no se quiera dar tarjeta a Google. |

## Decisión

1. En la carta, Nuevo pedido y «Ubicar pedido»: botón «Usar mi ubicación actual» (geolocalización del navegador), buscador con **Places Autocomplete** (con token de sesión) y **mapa de Google** con pin movible.
2. Se guardan latitud, longitud, dirección escrita, referencia y el enlace `https://www.google.com/maps?q=lat,lng` para el repartidor (NEC-CAP-009).
3. La **zona** se calcula en la API con el algoritmo de punto dentro de polígono (`packages/compartido`) sobre las zonas activas (RN-CAP-122); nunca se le pregunta al cliente (RN-CAP-103). Fuera de cobertura no se guarda como delivery.
4. Las zonas se editan como lista de puntos con validación; si son inválidas, se conserva la zona anterior (RN-CAP-122).
5. Mapa de entregas, zonas y radios con **Leaflet + teselas de OpenStreetMap**, respetando su política de uso, con atribución.
6. Protección del gasto en Google Cloud: tope diario de consultas por API, alerta de presupuesto de US$ 1 y claves restringidas por dominio (navegador) y por IP (servidor). Si se llega al tope, la búsqueda se apaga y se puede **tocar el mapa** para marcar el punto.

## Consecuencias

- Obliga a:
  - Crear la cuenta de Google Cloud con tarjeta y configurar topes y alertas antes de publicar.
  - Mostrar «Powered by Google» donde se usa Places.
- Impide:
  - Guardar resultados de Places como base de direcciones propia más allá del pedido y del cliente.
- Cuesta:
  - Dentro de la cuota gratis mensual de Google para un local (por verificar al activar la cuenta).
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: US$ 0 esperado, con tope que lo garantiza.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: `zona_reparto` (código, polígono en JSONB, tarifa, activa) y los campos de ubicación en `contact_mechanism` y en la entrega del pedido.
- Linaje: la ubicación nace en el navegador del cliente o del asesor; Google recibe el texto buscado. **Dato personal:** la ubicación del cliente (ADR-005).
- Reglas de calidad: 0 delivery confirmados sin punto y zona (RN-CAP-104).

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (DT-34, D-03) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL
