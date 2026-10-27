---
modulo: plano
titulo: Plano del local
ruta: /admin/plano
permiso: plano/ver
roles: [ADMIN, MOZO, CALLCENTER]
relacionados: [caja, reservas, cocina, pantallas]
sugerencias:
  - ¿Cómo veo qué mesas están libres u ocupadas en cada piso?
  - ¿Cómo abro un pedido en una mesa desde el plano?
  - ¿Cómo agrego o muevo una mesa en el salón?
  - ¿Quién puede cambiar el diseño del plano y mover elementos?
---
# Plano del local

## Para que sirve
Representa el mapa interactivo en dos dimensiones del salón de Caprichos por pisos (Piso 1, Piso 2, Terraza). Permite a los mozos y personal de atención ver en tiempo real qué mesas están libres u ocupadas, abrir nuevos pedidos para [[caja]], coordinar comandas con [[cocina]], verificar disponibilidad para [[reservas]] y diseñar la distribución física de mesas y [[pantallas]].

## Como se hace: consultar mesas y abrir un pedido (Mozos y Cajeros)
1. En la parte superior, pulsa en la pestaña del piso que deseas atender (por ejemplo "Piso 1" o "Piso 2").
2. En la cuadrícula observarás cada mesa identificada por su número y color: las mesas libres se muestran en verde claro ("LIBRE"), mientras que las mesas con clientes se indican en tono vino u oscuro ("OCUPADA").
3. Para abrir una comanda en una mesa desocupada, haz clic sobre la mesa.
4. Se abrirá la ventana "Nuevo pedido en mesa". Selecciona los productos de la carta que solicita el cliente, anota comentarios si es necesario y pulsa el botón "Confirmar pedido". La comanda viajará a las pantallas de cocina y la mesa pasará a estado ocupada.
5. Para consultar el consumo acumulado de una mesa ocupada o imprimir su cuenta, pulsa sobre la mesa y selecciona "Ver precuenta".
Antes: [[plano]]
Despues: [[caja]]
Ver tambien: [[cocina]]

## Como se hace: agregar, mover y girar elementos en el plano (Administrador)
1. Si cuentas con el permiso de edición (rol Administrador), verás la barra de herramientas con los elementos disponibles: "Mesa cuadrada", "Mesa redonda", "Barra", "Caja", "Puerta", "Baño", "Columna", "Escalera" y "Pared".
2. Selecciona la herramienta que deseas colocar y haz clic sobre la celda vacía de la cuadrícula donde irá el objeto.
3. Para reubicar un elemento existente, arrástralo directamente a su nueva posición en la cuadrícula.
4. Para inspeccionarlo, haz clic sobre el objeto. En el panel de propiedades podrás modificar su nombre o número (por ejemplo "Mesa 12"), cambiar sus dimensiones de ancho y alto, o pulsar el botón "Girar 90°" para rotar su orientación.
5. Para retirar un mueble u objeto del plano, selecciónalo y pulsa "Eliminar elemento". En el cuadro de confirmación "¿Eliminar elemento?", confirma con "Sí, eliminar" o cancela con "No, conservar".
Ver tambien: [[plano]]

## Como se hace: cambiar de piso o activar y desactivar áreas
1. Haz clic sobre la pestaña del piso deseado para cambiar la vista de la cuadrícula.
2. Si un piso o terraza estará cerrado temporalmente, el administrador puede pulsar el botón "Desactivar piso". Se abrirá la ventana "¿Desactivar piso?", donde se confirma con "Sí, desactivar". El piso quedará oculto para el personal de salón hasta que se pulse "Activar piso".
Ver tambien: [[reservas]]

## Como se hace: copiar y aplicar un diseño de plano
1. En la esquina superior derecha, pulsa en la sección "Guardar o cambiar el diseño".
2. Para hacer un respaldo del diseño actual de mesas, pulsa el botón "Copiar diseño". El código de distribución en formato JSON se copiará a tu portapapeles.
3. Para cargar una distribución preparada previamente, pega el texto JSON en el área correspondiente y pulsa "Aplicar diseño". Aparecerá la ventana de confirmación "¿Aplicar este nuevo diseño al plano?". Pulsa "Sí, aplicar" o "No, cancelar".
Ver tambien: [[historial]]

## Errores y dudas comunes
- No me aparecen los botones para agregar o mover mesas: solo los administradores con el permiso plano/editar pueden modificar la estructura física del salón; los mozos y call center solo tienen acceso en modo consulta y toma de pedidos.
- Una mesa sigue figurando ocupada cuando los clientes ya se fueron: la mesa se libera automáticamente al registrar el cobro final en caja, o manualmente si el cajero o mozo autorizado pulsa "Liberar mesa".
- Código de supervisor: el diseño del plano no solicita código de supervisor; utiliza confirmaciones Sí/No.

## Quien puede hacerlo
Pueden ver el plano y su estado en tiempo real los roles Administrador (ADMIN), Mozo (MOZO) y Call Center (CALLCENTER) mediante el permiso plano/ver. La edición de la cuadrícula, agregar o borrar mesas y cambiar pisos está reservada exclusivamente para el Administrador (ADMIN) mediante el permiso plano/editar.
