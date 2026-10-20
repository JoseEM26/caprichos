---
id: ADR-004
tipo: adr
titulo: "Modelo de personas y organizaciones con el patrón Party simple"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, DT-26, D-18, NEC-CAP-057, RN-CAP-071, RN-CAP-072, RN-CAP-098]
tags: [adr, party, datos, personas, g3]
---

# ADR-004: Modelo de personas y organizaciones con el patrón Party simple

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

En Caprichos una misma persona cumple varios papeles: un trabajador también compra y suma puntos con la misma cuenta (NEC-CAP-057, RN-CAP-072); un cliente puede ser persona (DNI) o empresa (RUC) (FT-LEG-01); el proveedor es una empresa (FT-COM-01); un cliente tiene varios teléfonos y direcciones; el trabajador se desactiva sin borrarse (RN-CAP-098); y la aceptación de datos personales es por persona (FT-LEG-02).

Referencia del patrón: `UPN/base-datos-upn/docs/proyecto-final/02-modelo-datos/patron-party.md` (Silverston, *The Data Model Resource Book*, vol. 1). José eligió la versión simple (DT-26).

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** **Party simple**: `party`, `person`, `organization`, `party_identifier`, `contact_mechanism`, `consent` y `party_role` con detalle por rol; **sin** `party_relationship` | — | Que aparezcan vínculos entre partes con vigencia (vendedor de un proveedor con historial, empresa cliente con varios autorizados, avales). |
| Party completo con `party_relationship` | Hoy solo tendría un uso (proveedor → su vendedor), que se resuelve con un contacto. | Los casos de la fila anterior. |
| Tablas separadas por rol (`cliente`, `usuario`, `proveedor`) | Duplica a la persona que es trabajador y cliente, y los puntos quedan en dos lugares; obliga a tener el DNI como clave. | Ninguno previsible. |

## Decisión

1. `party` (id, tipo `PERSONA` u `ORGANIZACION`, estado) con subtipos `person` (nombres, apellidos, cumpleaños como día y mes, RN-CAP-110) y `organization` (razón social, nombre comercial).
2. `party_identifier` (tipo `DNI`, `RUC` o `CE`, número, **único por tipo y número**). Es **opcional**: un cliente que solo dejó su teléfono existe sin documento y lo agrega al crear su cuenta.
3. `contact_mechanism` (tipo `TELEFONO`, `WHATSAPP`, `CORREO` o `DIRECCION`; valor; para direcciones, latitud, longitud, referencia y zona; marca de principal). Un teléfono se busca normalizado a +51.
4. `consent` (party, texto y versión aceptados, fecha, canal) para cumplir la Ley 29733 (ADR-005).
5. `party_role` (party, rol `CLIENTE`, `TRABAJADOR` o `PROVEEDOR`, desde, hasta) con **índice único parcial**: un solo rol vigente por persona y tipo. Detalle por rol: `customer_detail` (puntos, tarifa especial de envío), `employee_detail` (descuento del personal) y `supplier_detail` (días de crédito, cuenta de pago).
6. **El rol de negocio no es el rol del sistema**: `user_account` (party, rol del sistema `ADMIN`, `CAJERO`, `COCINA`, `MOZO`, `CALLCENTER`, `ALMACEN` o `REPARTIDOR`, huella de contraseña, activo) para el personal, y `customer_account` (party, huella de contraseña) para la cuenta opcional del cliente (ADR-008).
7. Los **pedidos copian** nombre, teléfono y dirección del momento: un pedido viejo no cambia si el cliente actualiza sus datos.
8. Vistas `vw_clientes`, `vw_personal` y `vw_proveedores` para que las pantallas consulten sin repetir las uniones.

## Consecuencias

- Obliga a:
  - Dar de alta a un trabajador creando su `party` (o reusando la existente por DNI), su rol `TRABAJADOR` y su `user_account`.
  - Cerrar vigencias (`hasta`) en lugar de borrar.
- Impide:
  - Usar el DNI o el RUC como clave primaria.
- Cuesta:
  - Más uniones en las consultas, resueltas con vistas.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: ninguno.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: `party`, `person`, `organization`, `party_identifier`, `contact_mechanism`, `consent`, `party_role`, `customer_detail`, `employee_detail`, `supplier_detail`, `user_account`, `customer_account`. Dueño: Caprichos.
- Linaje: alta por la carta (cuenta), caja (cliente), Usuarios (personal) y Compras (proveedor). **Datos personales:** DNI, nombres, teléfono, correo, cumpleaños y direcciones con ubicación (ADR-005).
- Reglas de calidad: 0 documentos repetidos; 0 personas con dos roles vigentes del mismo tipo; 100 % de clientes con cuenta con `consent`.

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (DT-26, D-18) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL
