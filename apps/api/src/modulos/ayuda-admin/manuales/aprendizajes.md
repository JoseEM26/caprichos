---
modulo: aprendizajes
titulo: Aprendizajes del bot
ruta: /admin/aprendizajes
permiso: aprendizajes/ver
roles: [ADMIN]
relacionados: [mensajes, mirest, notificaciones, analisis]
sugerencias:
  - Que son las propuestas del bot y de donde salen
  - Como apruebo una respuesta para que el bot la use
  - Por que descarte una propuesta y como la recupero
  - Como quito una respuesta que el bot ya aprendio
  - Cuanto gasta en IA el aprendizaje de cada noche
  - Como analizo todo el historial de chats una sola vez
---
# Aprendizajes del bot

## Para que sirve
Cada noche el bot revisa los chats de ayer que una persona tuvo que atender, busca las dudas que se repiten y propone una respuesta. Tu decides si sirve: solo lo que apruebas lo usa el bot. Es solo para el Administrador. Los chats se leen desde [[mensajes]] y el bot que responde se configura en [[mirest]] (Chatbot de WhatsApp).

## Como se hace: Revisar y aprobar una propuesta
1. Entra a Aprendizajes. Cuando hay propuestas nuevas te llega un aviso en la campanita.
2. En la pestana Pendientes, lee la pregunta, la respuesta propuesta, cuantas veces se repitio y los extractos de chats que la respaldan. Los extractos estan sin nombres, celulares, documentos, correos ni direcciones.
3. Si hace falta, corrige la pregunta, la respuesta o las frases. El boton Mejorar reescribe la respuesta con la voz carinosa de Capri y puede sugerir frases; revisala antes de aprobar y usa Deshacer para volver a tu texto. Tiene un limite de 30 usos por hora.
4. Pulsa Aprobar. La respuesta queda vigente y el bot la usa en sus dudas desde ese momento.
Ver tambien: [[notificaciones]]

## Como se hace: Descartar o retirar
1. Para descartar una propuesta pendiente, pulsa Descartar y escribe el motivo (minimo 5 caracteres). Queda en la pestana Descartadas con quien la descarto.
2. Para quitar algo que el bot ya aprendio, ve a Conocimiento vigente, pulsa Retirar y escribe el motivo. El bot deja de usarlo enseguida.
3. Toda aprobacion, descarte y retiro queda en el historial de auditoria.

## Como se hace: Analizar todo el historial una sola vez
1. En el resumen, pulsa Analizar historial. El trabajo corre en segundo plano y no tienes que esperar en la pantalla.
2. Recorre los dias con chats atendidos por una persona, del mas antiguo hasta ayer, y no repite los dias ya procesados.
3. Tiene su propio tope de gasto (10 dolares por corrida). Si se alcanza, se detiene y queda por seguir otro dia.
4. Al terminar recibes un solo aviso con el total de propuestas.

## Reglas importantes
- Los precios, el stock y los horarios nunca los aprende el bot: si una respuesta aprobada contradice los datos del sistema, mandan los datos del sistema.
- Nada personal sale hacia la IA: antes de enviarse, el sistema reemplaza celulares, documentos, correos, direcciones y nombres.
- Aparecen todos los casos, desde 1 repeticion, y primero los mas repetidos. Si prefieres ver solo los que se repiten mas, sube el minimo de repeticiones en los parametros del sistema.
- El gasto de IA de cada noche tiene un tope de 3 dolares. Si se alcanza, la noche queda en estado Tope y se retoma al dia siguiente.
- El ajuste de hora, topes y repeticiones esta en los parametros del sistema (la clave de OpenAI esta en [[mirest]]).

## Errores y dudas
- No aparecen propuestas: puede que ninguna duda se haya repetido, que la noche haya quedado sin IA (falta la clave de OpenAI) o en Tope. Mira el estado de las ultimas noches en el resumen.
- Una noche con error: pulsa Ejecutar ahora para repetirla.
- Aprobe algo por error: retiralo desde Conocimiento vigente con su motivo.

## Quien puede hacerlo
Solo el Administrador (permisos aprendizajes/ver para mirar y aprendizajes/aprobar para aprobar, descartar, retirar y ejecutar). Ningun otro rol los recibe.
