---
modulo: mirest
titulo: Configuración: Impresión
ruta: /admin/mirest
seccion: impresion
activa_con: [tab=impresion]
permiso: local/ver
roles: [ADMIN]
relacionados: [caja, cocina, pantallas]
sugerencias:
  - ¿Cómo enciendo o apago el sticker de bebida o la comanda de salón?
  - ¿Cómo conecto el programa de impresión a la PC de Caja?
  - ¿Cómo reintento una etiqueta que falló?
  - ¿Cómo creo una llave para el agente de impresión?
---
# Configuración: Impresión

## Para que sirve
Gobierna qué se imprime (stickers de bebida y por área, comanda de salón), en qué equipo (etiquetera o ticketera) y el estado de las impresoras. La pestaña tiene tres secciones: Mapa (qué se imprime), Equipos y estado (el programa de impresión de la PC de Caja y sus llaves) y Cola y pruebas (trabajos pendientes y fallidos). Se usa desde [[caja]] y [[cocina]].

## Como se hace: encender o apagar lo que se imprime
1. En Configuración del local abre "Impresión" y la sección "Mapa" ([Impresión](/admin/mirest?tab=impresion); enlace directo a la sección: /admin/mirest?tab=impresion&seccion=mapa).
2. Enciende o apaga "Sticker de bebida", "Sticker por área" o "Comanda de salón" y confirma. El sticker por área viene apagado hasta que el dueño lo confirme.
3. El sticker de bebida sale por cada vaso en el equipo de Bebidas (o en Caja si no hay). La comanda de salón sale en la ticketera de Caja al aceptar un pedido de mesa o local; no sale para llevar ni delivery.

## Como se hace: conectar el programa de impresión a la PC de Caja
1. Abre la sección "Equipos y estado" (/admin/mirest?tab=impresion&seccion=equipos).
2. Descarga el programa de impresión (Windows o Linux) y vincúlalo con el código de un solo uso. Desde ahí eliges qué equipo es la etiquetera y cuál la ticketera.
3. El estado dice si el programa está conectado (último latido) y si la impresora está lista, sin papel, desconectada o con error. Sin conexión, las etiquetas se acumulan como pendientes. "Actualizar" vuelve a consultar.

## Como se hace: crear o desactivar una llave del agente
1. En "Llaves de acceso del agente de impresión" escribe un nombre para reconocer la PC (por ejemplo "Agente PC Caja 1") y pulsa "Crear llave".
2. Cópiala antes de cerrar el aviso: se muestra una sola vez.
3. Desactivar una llave deja a esa PC sin imprimir hasta darle una nueva. Solo el Administrador las crea o desactiva.

## Como se hace: reintentar trabajos fallidos y hacer pruebas
1. Abre la sección "Cola y pruebas" (/admin/mirest?tab=impresion&seccion=cola).
2. Los trabajos fallan tras 5 intentos; reintenta los fallidos cuando haya papel para que el agente los imprima de nuevo.
3. Las pruebas de impresión imprimen una pieza marcada PRUEBA para comprobar la etiquetera y la ticketera; no hacen ningún pedido.

## Ajustes: Impresión
- **Sticker de bebida**: Enciende o apaga el sticker que sale por cada vaso con bebida. Afecta a todos los pedidos que llevan bebidas y se imprime en el equipo que atiende Bebidas, o en Caja si no hay. Ejemplo: Apagado: los vasos ya no salen con sticker; el resto de tickets sigue igual. Permiso: configuracion/editar. [Sticker de bebida](/admin/mirest?tab=impresion&seccion=mapa&campo=mapa-impresion-bebida)
- **Sticker por área**: Enciende o apaga un sticker por cada área con productos (Salados, Postres…), para que cada área lo reciba en su equipo. Bebidas no lleva este sticker: ya sale uno por cada vaso. Viene apagado hasta que el dueño lo confirme. Permiso: configuracion/editar. [Sticker por área](/admin/mirest?tab=impresion&seccion=mapa&campo=mapa-impresion-area)
- **Comanda de salón**: Enciende o apaga la comanda que sale en la ticketera de Caja al aceptar un pedido de mesa o local, con cada línea, tamaño, opciones y notas. No sale para llevar ni delivery. Permiso: configuracion/editar. [Comanda de salón](/admin/mirest?tab=impresion&seccion=mapa&campo=mapa-impresion-comanda)
- **Estado del agente de impresión de la PC de Caja**: Dice si el programa de la PC de Caja está conectado (último latido) y si la impresora está lista, sin papel, desconectada o con error. Si está sin conexión, las etiquetas se acumulan como pendientes. [Estado del agente de impresión de la PC de Caja](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-agente)
- **Instalar o vincular el programa de impresión**: Descarga el programa para la PC de Caja (Windows o Linux) y lo vincula con un código de un solo uso. Sirve también para elegir qué equipo es la etiquetera y cuál la ticketera. [Instalar o vincular el programa de impresión](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-instalar)
- **Actualizar estado del agente y la cola**: Vuelve a consultar el estado del agente, de la impresora y de la cola de trabajos. No cambia ninguna configuración. [Actualizar estado del agente y la cola](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-actualizar)
- **Llaves de acceso del agente de impresión**: Claves que autorizan a una PC a imprimir las etiquetas del local. Solo el Administrador las crea o desactiva. Desactivar una llave deja a esa PC sin imprimir hasta darle una nueva. Permiso: ADMIN. [Llaves de acceso del agente de impresión](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-llaves)
- **Nombre de la nueva llave del agente**: Nombre para reconocer en la lista a qué PC pertenece la llave que vas a crear. No afecta la impresión. Ejemplo: Agente PC Caja 1. Permiso: ADMIN. [Nombre de la nueva llave del agente](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-llave-nombre)
- **Crear llave de agente**: Genera una llave nueva para conectar una PC de Caja. Se muestra una sola vez: cópiala antes de cerrar el aviso, porque no se puede volver a ver. Permiso: ADMIN. [Crear llave de agente](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-llave-crear)
- **Cola de trabajos pendientes y fallidos**: Etiquetas esperando imprimirse y trabajos que fallaron tras 5 intentos. Desde aquí se reintentan los fallidos para que el agente los imprima de nuevo. Los avisos por demora se ajustan en Parámetros (impresion_alerta_min, impresion_vence_min). Ejemplo: 3 pendientes y 1 fallido: reintenta el fallido cuando haya papel. [Cola de trabajos pendientes y fallidos](/admin/mirest?tab=impresion&seccion=cola&campo=impresion-cola)
- **Pruebas de impresión de la etiquetera y la ticketera**: Imprimen una pieza de ejemplo marcada como PRUEBA para comprobar que la máquina está bien conectada. No hacen ningún pedido. Ejemplo: Si la etiquetera no sale, haz una prueba y revisa el motivo que aparece debajo. [Pruebas de impresión de la etiquetera y la ticketera](/admin/mirest?tab=impresion&seccion=cola&campo=impresion-pruebas)
- **Aviso por WhatsApp de etiquetas sin imprimir** (impresion_alerta_min): Minutos con etiquetas en cola sin que la impresora de Caja las tome (PC apagada, sin sesión o sin conexión) antes de avisar a los administradores. Avisa una vez por tanda. Ejemplo: Con 5: si hay una etiqueta esperando 5 minutos, los administradores reciben el aviso. [Aviso por WhatsApp de etiquetas sin imprimir](/admin/mirest?tab=parametros&campo=parametros-impresion-alerta-min)
- **Vencimiento de etiquetas no impresas** (impresion_vence_min): Minutos en cola a partir de los cuales una etiqueta automática ya no se imprime sola al reconectar la impresora: queda VENCIDA y se reimprime a mano. Los pedidos anulados también vencen. Una reimpresión manual sale igual. Ejemplo: Con 180: al reconectar tras 4 horas, las etiquetas viejas no salen solas. [Vencimiento de etiquetas no impresas](/admin/mirest?tab=parametros&campo=parametros-impresion-vence-min)

## Errores y dudas comunes
- Las etiquetas no salen: revisa en "Equipos y estado" si el agente está conectado y la impresora lista; si no, se acumulan como pendientes.
- Una etiqueta vieja no salió sola al reconectar: pasó el vencimiento ("Vencimiento de etiquetas no impresas") y quedó VENCIDA; se reimprime a mano.
- Perdí la llave: no se puede volver a ver; crea una nueva y desactiva la anterior.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El administrador no escribe código de supervisor: el sistema lo autoriza solo y el cambio queda en el historial de auditoría. Encender o apagar lo que se imprime requiere configuracion/editar; crear llaves, solo ADMIN.
