# Avisos del sistema por correo

Los avisos al equipo salen por correo (Resend, remitente `avisos@caprichos.pe`) y ya no por WhatsApp.
Llegan al instante, salvo los de voucher y pedido sin confirmar, que solo salen cuando pasan 30 minutos sin atenderse.

## Qué avisos llegan

| Aviso | Cuándo |
|---|---|
| Falla de impresora | Al instante, cuando un trabajo de impresión falla |
| Etiquetas sin agente | Al instante, cuando hay etiquetas en cola y la PC de la etiquetera no responde |
| Stock bajo o agotado (insumos y productos) | Al instante, y una vez al día por insumo si sigue bajo |
| Calificación baja de un cliente | Al instante |
| Voucher sin revisar | Solo si pasan 30 minutos sin revisarse (el chat queda urgente) |
| Pedido sin confirmar en Caja | Solo si pasan 30 minutos sin confirmarse |

Cada caso se manda una sola vez por persona: si el mismo aviso se repite el mismo día, no llega otro correo.

No llegan por correo (siguen solo en la campana del panel): chat esperando asesor, chat liberado, cola de WhatsApp atrasada, voucher con IA y pedido nuevo.

## A quién llega

Cada persona tiene la casilla **«Recibir avisos del sistema por correo»** (en Usuarios, o en Mi perfil). Para que llegue, la persona debe tener correo registrado.

Por defecto la casilla viene encendida para ADMIN y SUPERVISOR, y apagada para el resto.

## Horario

- El correo llega solo a las personas con casilla que están **de turno** en ese momento (según su horario, sus coberturas y sus reemplazos).
- Cada persona puede tener el horario **24/7**. El ADMIN lo tiene por defecto (se puede quitar).
- Si nadie con casilla está de turno, el aviso va a las personas 24/7 con casilla.
- Si tampoco hay nadie, el aviso no sale por correo, pero queda registrado en el sistema.

## Activar el envío (una vez por ambiente)

1. Crear la clave en Resend y verificar el dominio `caprichos.pe` (ya está verificado).
2. Guardar la clave como secreto del ambiente, sin pegarla en ningún archivo:

   ```
   gh secret set RESEND_API_KEY --env demo --repo JoseEM26/caprichos
   gh secret set RESEND_API_KEY --env prod --repo JoseEM26/caprichos
   ```

   Al ejecutarlo, `gh` pide el valor y lo guarda cifrado.

3. Pasar la clave al `.env` del servidor y redesplegar con el mismo tag. Desde GitHub Actions (pestaña Actions > Deploy Caprichos por SSH > Run workflow), o por consola:

   ```
   # demo (desde la rama preprod)
   gh workflow run deploy.yml --repo JoseEM26/caprichos --ref preprod -f ambiente=demo -f accion=configurar-correo

   # producción (tag de main; exige escribir PRODUCCION)
   gh workflow run deploy.yml --repo JoseEM26/caprichos --ref main -f ambiente=prod -f tag=vX.Y.Z -f accion=configurar-correo -f confirmacion=PRODUCCION
   ```

   La acción lee `RESEND_API_KEY` del ambiente, la escribe en el `.env` sin mostrarla, redespliega, comprueba que la API la recibe y, si algo falla, restaura el `.env` anterior. Para ver el resultado: `gh run list --repo JoseEM26/caprichos --workflow deploy.yml`.

Mientras no haya clave, el sistema funciona igual: registra los correos como «simulados» y no envía nada.

## Dónde se ve lo enviado

La tabla `correo_envio` guarda cada envío (caso, destinatario, estado y error). Estados: `ENVIADO`, `SIMULADO`, `FALLIDO`, `SIN_DESTINO`.

## WhatsApp al equipo

Los avisos al equipo por WhatsApp quedan apagados: el parámetro `chatbot_avisos_equipo_activo` queda en `false`. El código sigue en el sistema por si se quiere volver a encender.
