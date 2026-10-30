---
modulo: mascota
titulo: Mascota Capri
ruta: /admin/mascota
permiso: mascota/ver
roles: [ADMIN]
relacionados: [disenador, novedades, paleta]
sugerencias:
  - ¿Cómo cambio la ropa o el aspecto de Capri?
  - ¿Cómo activo el tema de Halloween o Navidad para la mascota?
  - ¿Cómo vuelvo a los colores originales de Capri?
  - ¿Por qué no veo los cambios reflejados en la carta?
---
# Mascota Capri

## Para que sirve
Permite personalizar la apariencia visual de Capri, la mascota oficial y asistente virtual de Caprichos. Desde este módulo se pueden ajustar los colores de la piel, ojos, cabello, uniforme (color principal, delantal y ribetes), tipo de gorro y accesorios festivos, así como gestionar los temas de temporada como Halloween, Navidad, Fiestas Patrias, San Valentín, Día de la Madre, Año Nuevo y Verano. Toda modificación guardada aquí es heredada automáticamente en la carta pública, en la página de presentación de la mascota y en el panel de ayuda administrativa conectado con [[disenador]], [[novedades]] y [[paleta]].

## Como se hace: cambiar la apariencia base de Capri
1. En el menú de navegación, ingresa a "Mascota Capri" dentro de la sección de Configuración.
2. En la columna derecha, selecciona la pestaña "Aspecto Base".
3. En la sección "Tono de Piel", pulsa uno de los 6 tonos sugeridos o usa el selector libre de color hexadecimal.
4. En "Cabello", elige el color y selecciona uno de los cuatro peinados disponibles: "Colitas" (estilo clásico), "Suelto", "Trenza" o "Moño".
5. En "Color de Ojos", ajusta el color del iris y la pupila.
6. En "Uniforme", define los colores del cuerpo principal, el delantal y el ribete dorado de los botones y el cuello.
7. En "Gorro", selecciona el estilo deseado ("Gorro de Chef", "Gorro de Bruja", "Gorro Navideño", "Corona Real", "Sombrero Veraniego" o "Sin Gorro") y su color.
8. En "Accesorios", activa o desactiva los complementos disponibles como calabaza, bufanda, corazón, bandera, lazo, estrellas, guirnalda, antifaz o bigote.
9. Observa el resultado inmediatamente en la vista previa interactiva de la izquierda en 3D o 2D.
10. Pulsa el botón "Guardar cambios" y en la ventana emergente confirma seleccionando "Sí, guardar".
Ver tambien: [[paleta]]

## Como se hace: configurar temas y temporadas
1. En la columna derecha del editor, pulsa en la pestaña "Temporadas y Modo".
2. En "Modo de visualización", elige entre:
   - "Automático por fecha": el sistema activa el tema festivo cuyo rango de fechas coincida con el día actual según la hora oficial de Lima. Si dos temas coinciden, se aplica el de menor duración por ser más específico.
   - "Manual forzado": permite fijar un tema específico permanentemente (o mantener el diseño "Normal" sin temporada) sin importar la fecha del calendario.
3. En la lista de temporadas (Halloween, Navidad, Fiestas Patrias, San Valentín, Día de la Madre, Año Nuevo y Verano), puedes editar las fechas de inicio ("Desde") y fin ("Hasta") en formato mes-día (MM-DD), o activar y desactivar temas con su casilla de verificación.
4. Para previsualizar cómo se verá un tema sin guardarlo aún, pulsa el botón "Ver este tema". La vista previa de la izquierda mostrará el aspecto resultante con una etiqueta indicativa.
5. Pulsa "Guardar cambios" y confirma con "Sí, guardar".
Antes: [[novedades]]
Ver tambien: [[disenador]]

## Como se hace: restablecer a valores de fabrica
1. Si deseas deshacer todas las personalizaciones y regresar a la vestimenta original de Caprichos (uniforme naranja con delantal negro, gorro de chef crema y fechas de temporada predeterminadas), pulsa el botón "Restablecer de fábrica" en la parte inferior.
2. Aparecerá la ventana de confirmación "¿Restablecer Capri a los valores de fábrica?".
3. Pulsa "Sí, restablecer" para aplicar la restauración.
Despues: [[mascota]]

## Errores y dudas comunes
- Mis cambios no aparecen en la carta virtual: asegúrate de haber presionado "Guardar cambios" y confirmado la acción. Una vez guardado, el nuevo aspecto se sincroniza con el servidor y se actualiza en la carta pública sin necesidad de recargarla manualmente.
- No puedo editar ni guardar cambios: este módulo permite la visualización a usuarios con permiso mascota/ver, pero la modificación requiere el permiso específico mascota/editar (reservado para administradores). Si aparece la insignia "Modo solo lectura", contacta al administrador del sistema.
- En la vista previa se ve un tema diferente al guardado: comprueba si tienes activo el botón "Ver este tema"; si es así, presiona "Volver a hoy" para regresar a la vista del tema activo según el calendario.

## Quien puede hacerlo
La visualización de la mascota Capri y sus temas de temporada requiere el permiso mascota/ver, mientras que la modificación y guardado de cambios requiere el permiso mascota/editar, reservados para el rol de Administrador [ADMIN]. Los usuarios sin permisos de edición accederán al módulo en modo de solo lectura.

## Quien puede hacerlo
El módulo requiere el permiso mascota/ver para visualizar la configuración y el aspecto actual de la mascota Capri, mientras que la modificación y el restablecimiento de fábrica exigen el permiso mascota/editar, reservado exclusivamente para usuarios con el rol Administrador (ADMIN).
