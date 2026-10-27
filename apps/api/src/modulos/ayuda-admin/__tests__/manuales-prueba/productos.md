---
modulo: productos
titulo: Productos
ruta: /admin/productos
permiso: catalogo/ver
roles: [ADMIN]
relacionados: [listas, stock, recetas, ofertas]
sugerencias:
  - ¿Cómo creo un producto?
  - ¿Cómo cambio el precio de un producto?
  - ¿Cómo agoto un producto temporalmente?
  - ¿Cómo desactivo un producto que ya no se vende?
---
# Productos

## Para que sirve
Permite administrar la carta completa del restaurante y pastelería, configurando nombres, categorías vinculadas a [[listas]], precios de venta, imágenes, presentaciones y estado de disponibilidad.

## Como se hace: Crear un producto
1. Entra a Productos desde el menú lateral y pulsa el botón Nuevo producto.
2. Completa los campos requeridos: nombre comercial, categoría, precio base y fotografía.
3. Define los tamaños, variantes o salsas si el producto los requiere.
4. Pulsa Guardar y confirma con Sí. Si más adelante el producto deja de venderse, se desactiva, nunca se elimina.
Antes: [[listas]]
Despues: [[stock]]
Ver tambien: [[recetas]]

## Como se hace: Agotar un producto temporalmente
1. Localiza el producto en la lista del catálogo.
2. Haz clic en el interruptor de estado Disponible para pasarlo a Agotado.
3. El cambio se reflejará inmediatamente en la carta pública y en el chatbot.
Ver tambien: [[cocina]]

## Errores y dudas comunes
Los productos con ventas históricas no pueden ser eliminados de la base de datos para no romper los informes financieros; siempre deben ser desactivados o marcados como agotados.

## Quien puede hacerlo
Esta pantalla es de uso exclusivo del Administrador. Los cajeros, repartidores y cocineros no pueden crear ni modificar precios o productos.
