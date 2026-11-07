# Guía: subir los datos de WhatsApp al servidor con la acción «Configurar WhatsApp»

Para quien administra el sistema (José Ángel Espinoza, con Kevin como dueño). Sirve para que el servidor use el número oficial del local sin entrar al servidor y sin pasar ningún secreto por el chat.

## 1. Qué datos hacen falta y de dónde salen

| Dato (nombre del secreto) | Dónde sale en Meta |
|---|---|
| `WHATSAPP_PHONE_ID` | Meta for Developers › tu app › WhatsApp › Configuración de la API › debajo del número. Para el +51 977 503 006 («Caprichos Campoy») es `1486799844506773` (no es secreto). |
| `WHATSAPP_TOKEN` | Token **permanente** de un «Usuario del sistema» (business.facebook.com/settings › Usuarios › Usuarios del sistema). Permisos: `whatsapp_business_messaging` y `whatsapp_business_management`; expiración «Nunca»; con control total sobre la app y la cuenta de WhatsApp «Caprichos Campoy». |
| `WHATSAPP_VERIFY_TOKEN` | Una frase larga que **tú inventas** (16 a 128 caracteres, sin espacios ni comilla simple). Nunca la pegues en el chat; usa una nueva si ya la mostraste. |
| `WHATSAPP_APP_SECRET` | Configuración de la app › Básica › «Clave secreta de la app» › Mostrar. |

## 2. Guardar cada dato como secreto de GitHub (sin que quede en ningún historial)

En la terminal, uno por uno. El comando **pide el valor oculto**: lo escribes o pegas ahí, no en el chat.

```
gh secret set WHATSAPP_VERIFY_TOKEN --env prod --repo JoseEM26/caprichos
gh secret set WHATSAPP_PHONE_ID     --env prod --repo JoseEM26/caprichos
gh secret set WHATSAPP_TOKEN        --env prod --repo JoseEM26/caprichos
gh secret set WHATSAPP_APP_SECRET   --env prod --repo JoseEM26/caprichos
```

Para la demo, lo mismo cambiando `--env prod` por `--env demo` (con el número de prueba de Meta).

Puedes subir primero solo la frase del webhook y después el resto: la acción escribe **solo los secretos que existan** y deja las demás variables como están.

## 3. Lanzar la acción

- **Producción** (el flujo exige un tag que esté en `main` y que ya contenga esta acción, y la confirmación):
  ```
  gh workflow run deploy.yml -f ambiente=prod -f accion=configurar-whatsapp -f tag=<tag-de-main> -f confirmacion=PRODUCCION
  ```
- **Demo** (se lanza desde la rama `preprod`):
  ```
  gh workflow run deploy.yml --ref preprod -f ambiente=demo -f accion=configurar-whatsapp
  ```

Qué hace: copia fechada del `.env` (permisos 600) → escribe solo las variables recibidas entre comillas simples → redespliega con el **mismo tag** → comprueba que la API responde y que el contenedor recibe cada valor con la misma longitud (sin mostrarlo) → si subiste la frase del webhook, prueba la verificación del webhook de Meta y dice **«Webhook: OK (el servidor valida el token)»** → si algo falla, restaura la copia y vuelve a desplegar. Nunca imprime valores, solo longitudes.

## 4. Después, en Meta

1. Configurar webhooks: URL `https://caprichos.pe/whatsapp/webhook` (demo: `https://demo.caprichos.pe/whatsapp/webhook`) y la **misma frase** del paso 2 › Verificar y guardar. Suscribe el campo `messages`.
2. Pulsa «Suscribir webhooks» **solo** en la cuenta del 977 («Caprichos Campoy»). **No** en la del 914 (es otra cuenta y mezclaría sus mensajes con este sistema).
3. Publica la app (modo Live): mientras no esté publicada Meta solo entrega webhooks de prueba.
4. Crea las plantillas en la cuenta de mensajes **2981580212199269** (las del documento «Plantillas de WhatsApp para crear en Meta»).
5. En Configuración › Parámetros del sistema, pon el 977 en «Número de verificación de WhatsApp» (`verificacion_whatsapp_numero`).

## 5. Cómo comprobar que quedó

- En el resumen de la ejecución de la acción debe aparecer «Webhook: OK».
- En Configuración › Chatbot/WhatsApp, el estado de conexión debe decir **Meta** (no «Simulado»).
- Manda un mensaje de prueba desde el panel de Meta (remitente +51 977 503 006).

## 6. Seguridad

- La frase del webhook que se mostró alguna vez en un chat **no debe usarse**: crea otra.
- El número 977, al registrarse en la API de Meta, deja de funcionar en la aplicación de WhatsApp del celular.
- Si algo sale mal, la acción restaura la copia del `.env` y redespliega; la copia queda en el servidor como `.env.bak-<fecha>`.
