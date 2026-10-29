# Direcciones de delivery del cliente con cuenta

Contrato para los agentes web (mozo, carta) y WhatsApp. Migración: `20261108100000_cliente_direccion_y_pedido_cliente`.

## Cliente identificado en el pedido

- `pedido.cliente_party_id` (BigInt, nullable): cliente con cuenta del pedido. `null` = invitado.
- Cliente de un pedido, para puntos, historial y cupones: `cliente_party_id ?? party_id` solo si el canal es CARTA, WHATSAPP o BOT. En MOZO y CAJA, `party_id` es el party del personal, nunca el cliente.

## Crear pedido de mozo con DNI

`POST /admin/pedidos` (canal MOZO o CAJA) acepta `clienteDni?: string` (8 dígitos).

- Con DNI de cuenta activa: el pedido guarda `cliente_party_id`, la dirección queda en su libreta y el cliente suma puntos al cobrarse.
- DNI sin cuenta: `404 { codigo: "CLIENTE_NO_ENCONTRADO" }`. El mozo puede reintentar sin `clienteDni` (invitado).
- Sin `clienteDni`: invitado.
- En carta (`POST /pedidos`) y WhatsApp el campo se ignora. Carta usa la cookie `cp_cliente`; WhatsApp usa el teléfono de quien escribe.

## Buscar cliente por DNI (mozo)

`GET /admin/clientes/por-dni/:dni` — permiso `pedidos/crear` o `clientes/ver`.

- DNI que no tiene 8 dígitos exactos: `400 { codigo: "DNI_INVALIDO" }`.
- Más de 20 búsquedas por minuto y usuario: `429 { codigo: "DEMASIADAS_BUSQUEDAS" }`.

Encontrado:
```json
{
  "encontrado": true,
  "party": "100",
  "dniMascara": "4521****",
  "nombre": "Ana",
  "telefono": "987654321",
  "puntos": 12.5,
  "direcciones": [
    { "id": "7", "direccion": "Av. Las Palmeras 123", "referencia": "Portón azul",
      "lat": -12.046374, "lng": -77.042793, "alias": null, "usos": 3,
      "ultimoUsoEn": "2026-10-20T15:04:00.000Z", "origen": "CARTA" }
  ]
}
```
No encontrado: `{ "encontrado": false }`.

## Libreta de direcciones (cuenta de la carta)

Cookie `cp_cliente` requerida.

- `GET /carta/cuenta/direcciones` → `{ "direcciones": [ ...hasta 5, más reciente primero... ] }`. Sin sesión: `{ "direcciones": [] }`.
- `DELETE /carta/cuenta/direcciones/:id` → `{ "ok": true }`. Sin sesión: `401 SESION_REQUERIDA`. Ajena o ya quitada: `404 DIRECCION_NO_ENCONTRADA`.

Forma de cada dirección: `id`, `direccion`, `referencia`, `lat`, `lng`, `alias`, `usos`, `ultimoUsoEn`, `origen`.

## Reglas

- Se guarda una dirección por pedido delivery con cliente identificado (carta, WhatsApp o DNI del mozo). Es parte de la misma transacción del pedido.
- Duplicado: mismo texto normalizado (minúsculas, espacios simples) o mismo punto con lat/lng a 5 decimales. Si existe, suma `usos`, actualiza `ultimoUsoEn` y `referencia`.
- Sin texto ni coordenadas no se guarda nada. Si solo hay coordenadas, el texto es `Punto en el mapa <lat>, <lng>`.
- `origen` es el canal de captura: `CARTA`, `MOZO` (incluye CAJA) o `WHATSAPP` (incluye BOT). Los valores `MAPA` y `ESCRITA` están permitidos en la base pero hoy no se escriben.
- Nada se borra. Desactivar pone `activo = false`.
