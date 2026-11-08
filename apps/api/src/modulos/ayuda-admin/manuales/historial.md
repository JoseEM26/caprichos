---
modulo: historial
titulo: Historial de acciones
ruta: /admin/historial
permiso: auditoria/ver
roles: [ADMIN]
relacionados: [usuarios, caja, cierre, informes]
sugerencias:
  - ¿Cómo sé quién anuló un pedido o modificó un precio?
  - ¿Cómo busco las acciones realizadas en una fecha o por un usuario?
  - ¿Cómo descargo o copio los registros de auditoría a Excel?
  - ¿Para qué sirve el botón de verificar la cadena criptográfica?
---
# Historial de acciones

## Para que sirve
Muestra la bitácora inmutable de auditoría de Caprichos. Registra cada acción relevante ejecutada en el sistema (inicios de sesión, cobros en [[caja]], cierres de turno en [[cierre]], anulaciones, cambios en [[usuarios]] y datos para [[informes]]) junto con el usuario responsable, fecha, hora, IP y resultado.

## Como se hace: buscar y filtrar registros de auditoría
1. En la parte superior de la pantalla, utiliza el campo "Buscar" para encontrar palabras clave como un código de pedido, el nombre de un empleado o una acción concreta.
2. Utiliza los filtros desplegables para acotar la búsqueda:
   - "Módulo": filtra por área (Usuarios, Acceso, Caja, Pedidos, Cocina, Reparto, Auditoría, Configuración, Carta, Ofertas o Iniciativas).
   - "Tipo": filtra por categoría de evento (por ejemplo, cambios de seguridad, operaciones o consultas de datos).
   - "Resultado": elige entre "Todos", "Solo correctos" (operaciones exitosas) o "Solo rechazados" (intentos fallidos o sin permiso).
   - "Fecha": selecciona un rango indicando los campos "Desde" y "Hasta", o usa presets como hoy o esta semana.
3. Si deseas reiniciar todos los filtros a sus valores predeterminados, pulsa el botón "Limpiar filtros".
4. En la parte inferior puedes navegar entre páginas mediante los controles de paginación (20 registros por página).
Ver tambien: [[informes]]

## Como se hace: inspeccionar los detalles de una acción
1. En la tabla principal verás columnas con la fecha y hora exacta, el módulo, la acción ejecutada, el usuario y el estado (OK o Rechazado).
2. Haz clic sobre cualquier fila o pulsa el botón de despliegue al final para ver el detalle completo.
3. En el panel expandido se muestran los datos antes y después del cambio (si aplica), la dirección IP de origen, el tipo de dispositivo o navegador utilizado y el hash criptográfico SHA-256 de la entrada.
Ver tambien: [[usuarios]]

## Como se hace: verificar la integridad de la cadena y exportar a CSV
1. Para corroborar que ningún registro haya sido alterado, borrado o manipulado en la base de datos, pulsa el botón "Verificar integridad de la cadena".
2. El sistema recalculará y comprobará los hashes encadenados desde el primer bloque histórico y te mostrará el resultado: cadena válida o advertencia de discrepancia.
3. Para exportar la lista de registros a una hoja de cálculo, pulsa el botón "Copiar como CSV".
4. El sistema copiará el contenido formateado al portapapeles y mostrará el mensaje "Registros copiados al portapapeles como CSV". Luego podrás pegarlo directamente en Excel o Google Sheets.
Ver tambien: [[historial]]

## Errores y dudas comunes
- No puedo editar ni borrar un registro: los registros de auditoría son inmutables por diseño de seguridad y ley; nadie, ni siquiera el administrador, puede modificar o eliminar entradas del historial.
- Un pedido fue anulado y no sé quién fue: filtra por el módulo "pedidos" o "caja" y busca la palabra "anular"; allí verás el identificador del usuario que realizó la anulación y la hora exacta.

## Quien puede hacerlo
El acceso al Historial de acciones requiere el permiso auditoria/ver y está restringido de forma exclusiva al Administrador (ADMIN). Los cajeros, cocineros, mozos y repartidores no tienen acceso a la bitácora de auditoría.
