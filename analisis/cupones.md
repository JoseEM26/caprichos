---
id: FLU-CAP-007
tipo: analisis
titulo: Cupones: códigos únicos, de un solo uso, y cómo se controlan
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza (desarrollo); validación pendiente de Kevin Rosales"
aprobadores: []
fecha: 2026-10-19
relacionados: [BRD-CAP-001, REG-CAP-001, FLU-CAP-006]
tags: [cupones, seguridad, fraude, comprobante, mockup, v176]
---

# Cupones: códigos únicos y de un solo uso

> Decisión del 19/10/2026, a raíz de una observación del dueño: el código impreso era `DUO20-0102` (el cupón más el número del pedido). Como es correlativo, cualquiera podía adivinar el siguiente (`DUO20-0103`), y no había nada que impidiera usar el mismo código varias veces.

## 1. Qué estaba mal (revisión)

| Problema | Cómo pasaba |
|---|---|
| **Código adivinable** | El sufijo era el número del pedido: correlativo y predecible. |
| **Cualquier sufijo valía** | El canje aceptaba `DUO20-` seguido de cualquier cosa (`DUO20-1`, `DUO20-9999`). |
| **Se podía repetir** | Un cupón impreso no tenía límite de usos ni se marcaba como usado: el mismo código servía una y otra vez. |
| **La fecha fija** | La validez de un cupón en Nuevo pedido se comparaba con una fecha fija (ya corregido en v175). |

## 2. Cómo funciona ahora

### 2.1 Dos modos de cupón (decisión del dueño, 19/10/2026)

Al crear un cupón se elige **cómo se entrega**:

| Modo | Cómo es el código | Dónde se entrega | Control |
|---|---|---|---|
| **Código único en el comprobante** (ej. DUO20, FRAPPE5, GRACIAS10) | Distinto en cada comprobante, al azar y de **un solo uso**: `DUO20-K7M2QX`. El nombre solo (`DUO20`) **no** sirve. | Se imprime al pie del comprobante; sirve para premiar la siguiente compra. | Un solo canje por código; vence a los N días de la compra; se puede anular. |
| **Código compartido con tope** (ej. BIENVENIDA, VERANO10) | El **mismo** para todos, escrito por el negocio: `VERANO10`. | **No se imprime** en el comprobante: se reparte en afiches, volantes, redes; el cliente lo escribe en la carta. | **Tope de usos** en total (se acaba al llegarlo), vigencia, compra mínima, canal y, si pide con su cuenta, **máximo por cliente**. |

**Por qué dos modos.** Un código único evita que un cupón se copie o se adivine, pero si alguien reparte fotos del mismo cupón solo el primero lo canjea y los demás se van con «ya se usó». Un código compartido con tope sí sirve para atraer gente nueva: cada persona que lo use compra algo, y el tope limita cuánto descuento se regala en total. Un código compartido **sin** tope no se permite (el tope es obligatorio) porque una persona podría usarlo todos los días.

En el formulario, al elegir «Código compartido con tope» el canal pasa a **carta web** (se puede cambiar) y se pide el tope; al elegir «Código único» se piden la frase del comprobante y los días de validez.

### 2.2 El código del cupón impreso (modo único)

- Formato: `NOMBRE-XXXXXX`, donde las 6 letras/números se generan **al azar** en el momento de imprimir el comprobante.
- Alfabeto de 32 caracteres, **sin 0, O, 1 ni I** para no confundirlos al leerlo. Hay unas **mil millones de combinaciones** por cupón, y no se relaciona con el número del pedido: ver uno no permite deducir otro.
- Cada código se guarda en un **registro de cupones emitidos** con: código, cupón base, pedido que lo emitió, fecha de emisión, fecha de vencimiento y su estado.
- **Reimprimir** el comprobante imprime **los mismos códigos** (no se emiten otros).
- Vence a los **N días de la compra** (los que diga el cupón, 15 de inicio), además de la vigencia general del cupón.

### 2.3 Estados de un cupón emitido

| Estado | Significa |
|---|---|
| **Vigente** | Se puede canjear. |
| **Canjeado** | Ya se usó (queda anotada la fecha y el pedido). No se puede volver a usar. |
| **Vencido** | Pasó su fecha de validez. |
| **Anulado** | El administrador lo anuló (se perdió, se copió o salió mal impreso). Queda en el historial. |

### 2.4 Qué responde el sistema al canjear

| Lo que se escribe | Respuesta |
|---|---|
| Código correcto y vigente | Se aplica el descuento (si cumple mínimo, categoría, canal, cuenta y la regla de acumulación). |
| El mismo código por segunda vez | «Este cupón ya se usó el 19/10 en el pedido CP-0109.» |
| Un código vencido | «Este cupón venció el 09/10.» |
| Un código anulado | «Este cupón fue anulado.» |
| `DUO20` (sin la parte única) | «Este cupón se canjea con el código completo impreso en el comprobante.» |
| `DUO20-0102`, `DUO20-9999` o cualquier código inventado | «Ese cupón no existe o está desactivado.» (no se dice si «casi» existe). |
| Mayúsculas o minúsculas, con espacios | Da igual: `duo20-k7m2qx` equivale a `DUO20-K7M2QX`. |

Un cupón se marca como **canjeado cuando se envía el pedido**, no al escribirlo, y vale en la carta, en Nuevo pedido (mozo, caja) con la misma regla.

### 2.5 Protección contra adivinar (carta virtual)

Tras **5 intentos fallidos** seguidos, la carta bloquea el campo del cupón por **5 minutos**. Con mil millones de combinaciones y ese freno, adivinar un código no es práctico.

## 3. Qué ve el administrador (Ofertas y descuentos ▸ Cupones)

- **Tarjetas** de cupones, y cada una dice si **sale en el comprobante** (y en qué puesto), si es imprimible pero **no cabe** por el límite, o si es **compartido** (no se imprime). Los compartidos muestran **cuántos usos quedan** con una barra y pasan a **Agotado** al llegar al tope. También cuántos códigos se emitieron, cuántos se canjearon y cuántos siguen vigentes.
- **«Así sale el comprobante»**: un ejemplo del comprobante en vertical, con los cupones uno debajo de otro y el pie, el resumen («En cada comprobante salen 2 cupones sorteados al azar entre los 3 de código único activos») y la lista de los que entran al sorteo, con el atajo para cambiar cuántos salen en Reglas.
- **Cupones emitidos** (botón): lista con búsqueda por código o pedido y filtros (vigentes, canjeados, vencidos, anulados), y el botón **Anular** para los vigentes.
- **Cifras** arriba: cupones activos, emitidos con código, canjeados y vigentes por canjear.
- **Historial de cambios** (botón): se abre en una **ventana grande** (no en un cuadro pequeño) con todos los movimientos, lo más reciente primero, en letra legible. Se puede **buscar** (cupón, código, pedido o persona) y **filtrar** por tipo: emisiones, canjes, creaciones, ediciones, activar/desactivar, orden y límite, y anulaciones; cada fila lleva una etiqueta de color.

## 4. Qué cupones salen en el comprobante (decisión del dueño, 19/10/2026)

Hay cupones que **no se imprimen** (los de código compartido, como BIENVENIDA o CUMPLE25) y cupones de **código único** que sí. El comprobante lleva como máximo **N** cupones (Reglas ▸ «Cupones por comprobante»).

- En cada comprobante se **sortean al azar N cupones entre los de código único activos**. Es un sorteo simple: no se evita que un mismo cupón salga en varios comprobantes seguidos (al dueño no le importa).
- Dentro de un mismo comprobante no se repite el cupón (salen N distintos). Si hay menos cupones activos que N, salen todos; si no hay ninguno, el comprobante no lleva cupones.
- El sorteo se hace **una sola vez por pedido**, al imprimir el comprobante, y se guarda: si se **reimprime**, salen los mismos cupones con los mismos códigos.
- Ya no hay «puesto» ni orden: las flechas ↑ ↓ de las tarjetas se quitaron porque el orden no influye. Cada tarjeta dice «Entra al sorteo del comprobante (salen 2 al azar de 3)», y la vista previa muestra un ejemplo con los cupones que entran al sorteo.
- Con 12 comprobantes de prueba y 5 cupones activos, cada cupón salió entre 4 y 6 veces.

## 5. Datos de ejemplo de la maqueta (para probar)

| Código | Estado | Para qué sirve probarlo |
|---|---|---|
| `DUO20-K7M2QX` | Vigente | Canjearlo una vez; la segunda vez sale «ya se usó». |
| `FRAPPE5-9PWD4H` | Canjeado | Ver el mensaje de cupón ya usado. |
| `GRACIAS10-B3N8TA` | Vencido | Ver el mensaje de vencido. |

Al imprimir el comprobante de otro pedido se generan códigos nuevos, distintos cada vez.

## 6. Limitaciones y pendientes

- En la maqueta los códigos al azar los genera el navegador; en el sistema real los genera el servidor con un generador criptográfico y valida el canje allí (para que no se pueda usar un cupón desde dos lugares a la vez).
- Los cupones solo se imprimen en el comprobante del local; los pedidos web y de WhatsApp no emiten cupones.
- El bloqueo de 5 intentos está solo en la carta; Nuevo pedido lo usa personal identificado.
- El máximo **por cliente** de un cupón compartido solo se puede controlar cuando el cliente pide **con su cuenta** (DNI); si pide como invitado, no se sabe quién es y solo rige el tope total.
