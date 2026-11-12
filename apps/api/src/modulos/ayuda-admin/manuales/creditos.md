---
modulo: creditos
titulo: Créditos del personal
ruta: /admin/creditos
permiso: creditos/ver
roles: [ADMIN]
relacionados: [caja, usuarios, asistencia]
sugerencias:
  - Como consulto los consumos que el personal tiene pendientes
  - Como descargo el reporte de consumos para la planilla
  - Como cambio el periodo de consulta entre semana o mes
  - Cual es el porcentaje de descuento que se aplica al personal
---
# Créditos del personal

## Para que sirve
Modulo de seguimiento y control de los consumos a credito realizados por los colaboradores del local registrados en [[usuarios]]. Totaliza los consumos cobrados bajo esta modalidad en [[caja]] con descuento de personal para su deduccion en la planilla de pagos semanal o mensual.

## Como se hace: Consultar los consumos por semana o por mes
1. En la barra superior, elegir el tipo de periodo: Semana, Mes o Rango personalizado.
2. Si se elige Semana, usar los botones Semana anterior o Semana siguiente para desplazarse entre semanas de trabajo.
3. Si se elige Mes, usar Mes anterior o Mes siguiente para navegar entre los meses del ano.
4. La pantalla actualizara automaticamente las tarjetas de resumen: Total del periodo a descontar, Total de consumos registrados y Colaboradores con consumo activo.
Ver tambien: [[caja]]

## Como se hace: Ver el desglose de consumos de un colaborador
1. En la tabla principal de personal, ubicar la fila del colaborador registrado en [[usuarios]].
2. La fila muestra el Rol, la cantidad de consumos del periodo y el Total en soles.
3. Pulsar sobre la fila o en el boton Ver detalle para desplegar el acordeon.
4. Se listaran todos los pedidos consumidos en [[caja]] con su fecha, codigo de pedido, platos solicitados y monto correspondiente con descuento aplicado.
Antes: [[caja]]
Ver tambien: [[usuarios]]

## Como se hace: Saber si un consumo ya fue cobrado y por que planilla
1. Cada consumo muestra Pendiente o Cobrado (con fecha, quien cobro y el medio). Es el mismo dato que usa la Planilla de [[asistencia]]: un consumo cobrado en una planilla pagada dice Planilla y el periodo (por ejemplo Planilla 2026-11-02 a 2026-11-08).
2. Para descontar consumos del sueldo, ve a Asistencia, Planilla, abre a la persona y marca los consumos que se cobran en ese pago; al Marcar pagado quedan Cobrados aqui. Los de periodos anteriores sin cobrar aparecen tambien ahi.
3. Un consumo cobrado por planilla no se desmarca desde Creditos: reabre ese periodo en la Planilla (con motivo) y vuelve a Pendiente. Los consumos que marcaste a mano con Ya se le descontó si se desmarcan aqui.
Ver tambien: [[asistencia]]

## Como se hace: Exportar el reporte a Excel para recursos humanos o contabilidad
1. Seleccionar el periodo que se desea liquidar (semana o mes cerrado).
2. Pulsar el boton Descargar Excel en la parte superior derecha.
3. El sistema descargara un archivo en formato Excel o CSV listo para el calculo de descuentos en planilla para su conciliacion con [[informes]].
4. Aparecera un mensaje de confirmacion indicando el nombre del archivo descargado.
Ver tambien: [[informes]]

## Errores y dudas comunes
- El porcentaje de descuento aplicado a los consumos del personal (por ejemplo, 25%) lo define el Administrador en la configuracion general del sistema y se muestra en la cabecera informativa.
- Los consumos de credito solo se generan cuando al cobrar un pedido en caja se marca como Consumo de personal y se vincula al usuario del colaborador activo.
- Si un colaborador no figura en la lista, verificar que su usuario este registrado y activo en el sistema.

## Quien puede hacerlo
- Unicamente el rol Administrador tiene acceso a consultar y exportar los Creditos del personal.
- El personal no administrador no tiene acceso a este modulo por razones de privacidad salarial y control contable.
- Descuento del equipo en la carta virtual: si un trabajador con usuario activo inicia sesion en la carta con su cuenta de cliente (el celular sale de la cuenta, nunca de lo que se escribe en el pedido), la carta le aplica su mismo porcentaje de personal (25 % o el de su ficha) y le muestra Tienes 25 % de descuento por ser parte del equipo Caprichos. Sin sesion iniciada no se aplica ni se muestra nada. Solo es descuento: el pedido NO se carga a su credito, se paga como cualquier pedido de cliente y no aparece en este modulo. No se suma con otras promociones sobre la misma linea, no aplica a combos, promociones ni productos que no suman beneficios. Un pedido con este descuento no suma puntos ni permite canjearlos. Si el usuario esta inactivo o la cuenta no es de un trabajador, no se aplica nada ni se muestra nada. La carta reconoce al trabajador por su persona (si su cuenta de cliente es la misma persona que su usuario) o por su celular (con o sin +51, espacios o guiones); tambien por un vinculo que el Administrador hace en Usuarios (Vincular su cuenta de cliente). Si no lo reconoce, revisa que su usuario tenga celular o vincula su cuenta de cliente en [[usuarios]].
