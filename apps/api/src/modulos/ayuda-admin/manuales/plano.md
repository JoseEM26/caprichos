---
modulo: plano
titulo: Plano del local
ruta: /admin/plano
permiso: plano/ver
roles: [ADMIN, MOZO, CALLCENTER]
relacionados: [caja, reservas, cocina, pantallas, cierre]
sugerencias:
  - Como veo que mesas estan libres u ocupadas en cada piso
  - Como abro un pedido en una mesa desde el plano
  - Como envio a Caja el cobro de una mesa con voucher de Yape o Plin
  - Como agrego o muevo una mesa en el salon
---
# Plano del local

## Para que sirve
Representa el mapa interactivo en dos dimensiones del salón de Caprichos por pisos (Piso 1, Piso 2, Terraza). Permite a los mozos y personal de atención ver en tiempo real qué mesas están libres u ocupadas, abrir nuevos pedidos para [[caja]], coordinar comandas con [[cocina]], subir fotos de vouchers digitales para auditoria en [[cierre]], verificar disponibilidad para [[reservas]] y diseñar la distribución física de mesas y [[pantallas]].

## Como se hace: consultar mesas y abrir un pedido (Mozos y Cajeros)
1. En la parte superior, pulsa en la pestaña del piso que deseas atender (por ejemplo "Piso 1" o "Piso 2").
2. En la cuadrícula observarás cada mesa identificada por su número y color: las mesas libres se muestran en verde claro ("LIBRE"), mientras que las mesas con clientes se indican en tono vino u oscuro ("OCUPADA").
3. Para abrir una comanda en una mesa desocupada, haz clic sobre la mesa.
4. Se abrirá la ventana "Nuevo pedido en mesa". Selecciona los productos de la carta que solicita el cliente, anota comentarios si es necesario y pulsa el botón "Confirmar pedido". La comanda viajará a las pantallas de cocina y la mesa pasará a estado ocupada.
5. Para consultar el consumo acumulado de una mesa ocupada o imprimir su cuenta, toca la mesa y pulsa "Cobrar mesa (enviar a Caja)" (ver abajo). Imprimir la precuenta no la cobra.
Antes: [[plano]]
Despues: [[caja]]
Ver tambien: [[cocina]]

## Como se hace: enviar a Caja el cobro de una mesa (Mozos)
El mozo no cobra: cobra Caja. El mozo toma la foto del voucher en la mesa y envía el cobro a Caja, que lo revisa y lo cobra.
1. Abre el plano y toca la mesa ocupada. En la tarjeta de la mesa pulsa "Cobrar mesa (enviar a Caja)": se abre su cuenta (precuenta).
2. En "Medio de pago en mesa", elige Efectivo, Yape, Plin o Transferencia.
3. Si es digital, aparece la foto del voucher. Toma la foto o sube el archivo. La imagen se lee al instante.
4. Si dice "Este voucher no se lee bien. Vuelve a tomar la foto", toma otra foto. El mozo solo ve si se lee o no: no ve montos ni semáforos.
5. Efectivo no necesita foto. Pulsa "Enviar a Caja" y confirma con Sí. Aparece "Enviado a Caja, ellos lo revisan."
6. Caja recibe un aviso en la campana y el pedido aparece en Pedidos y caja con la foto ya enlazada. Si no hay foto legible, Caja pide la foto o resuelve el cobro con su excepción.
7. El cobro no queda pagado por el mozo: el pedido sigue por cobrar hasta que Caja lo registra.
Antes: [[plano]]
Despues: [[caja]]
Ver tambien: [[cierre]]

## Errores y dudas comunes
- Si el voucher no se lee, el mozo toma otra foto. Si no hay foto, el mozo igual envía el cobro a Caja y Caja resuelve (foto o excepción con código del supervisor).
- El mozo no ve el semáforo de confianza: por diseño, la vista del mozo sólo comprueba que la imagen sea legible para no demorar la atención en sala; la auditoría financiera se realiza en el arqueo de Cierre de caja.
- No me aparecen los botones para agregar o mover mesas: solo los administradores con el permiso plano/editar pueden modificar la estructura física del salón; los mozos y call center solo tienen acceso en modo consulta y toma de pedidos.
- Una mesa sigue figurando ocupada cuando los clientes ya se fueron: la mesa se libera automáticamente al registrar el cobro final en caja, o manualmente si el cajero o mozo autorizado pulsa "Liberar o marcar mesa".

## Quien puede hacerlo
- Pueden ver el plano, tomar comandas y cobrar mesas los roles Administrador (ADMIN), Mozo (MOZO) y Call Center (CALLCENTER). El rol Mozo cuenta con el permiso vouchers/subir para registrar las fotografías de comprobantes en sala.
- La edición de la cuadrícula, agregar o borrar mesas y cambiar pisos está reservada exclusivamente para el Administrador (ADMIN) mediante el permiso plano/editar.
