# RB-CAP-014: WhatsApp con Evolution API (no oficial), Meta de respaldo

## Qué es
Evolution API es un servidor que se conecta a WhatsApp Web (librería Baileys) con un número normal. Caprichos puede usarlo como su ÚNICO número de WhatsApp. El WhatsApp oficial de Meta (Cloud API) sigue instalado como respaldo: un parámetro elige cuál se usa, sin redesplegar.

**Riesgo que se acepta:** WhatsApp no permite este uso. El número puede ser bloqueado. Por eso Caprichos aplica reglas anti-bloqueo (sección 5) y se puede volver a Meta en cualquier momento.

**Estado de entrega:** todo viene APAGADO. Meta es el proveedor activo hasta que un ADMIN cambie. Sin credenciales de Evolution, el adaptador funciona en modo simulado (solo log, nada sale a la red).

## 1. Qué cambia para el cliente con Evolution
- Menús en texto numerado. No hay botones, listas ni carruseles: el bot manda «1. Ver carta / 2. Pedir / Responde 1 o 2» y la respuesta «2» se convierte en el mismo botón que habría pulsado. Un texto normal posterior del bot cierra el menú (un «2» suelto después ya no se toma como opción). El menú dura 30 minutos.
- Sin plantillas ni ventana de 24 h: las plantillas salen como su texto libre equivalente del catálogo.
- Mensajes que el número manda por su cuenta (sin que el cliente acabe de escribir): SOLO avisos del pedido (recibido, listo, salió, llegó, entregado...) y la encuesta posventa. Todo lo demás (puntos ganados, bienvenida de puntos, cumpleaños, recordatorios de reserva y de pago, campañas, alertas al personal, códigos de cuenta) se bloquea: queda DESCARTADO en Mensajes › Salientes con el motivo «Bloqueado: ...». Las respuestas del bot a un mensaje del cliente siempre salen.
- Nunca se escribe primero a un número que jamás escribió al negocio (queda DESCARTADO, «sin contacto previo»).

## 2. Variables de entorno
En el `.env` de la API de Caprichos (nunca en Git; en producción por los secretos del ambiente):

| Variable | Para qué |
| :--- | :--- |
| `EVOLUTION_API_URL` | Dirección de Evolution vista desde la API, p. ej. `http://evolution-api:8080` |
| `EVOLUTION_API_KEY` | Clave maestra de Evolution (la misma del compose) |
| `EVOLUTION_INSTANCE` | Nombre de la instancia (sección 3), p. ej. `caprichos` |
| `EVOLUTION_WEBHOOK_TOKEN` | Token que Evolution manda al webhook; sin él se rechaza todo |

Si falta `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` o `EVOLUTION_INSTANCE`, el envío por Evolution es simulado.

## 3. Levantar Evolution (mismo VPS, contenedores aparte)
1. Copia `infra/compose/evolution.env.example` a un archivo FUERA de Git (por ejemplo `~/.aybar/evolution.env`, permisos 0600) y pon claves largas y distintas. El mismo `EVOLUTION_API_KEY` y `EVOLUTION_WEBHOOK_TOKEN` irán al `.env` de la API.
2. Ajusta `EVOLUTION_RED_API` si no es producción (por ejemplo `caprichos-demo_red_interna`): es la red interna del ambiente de la API, para que se vean entre sí.
3. Levanta:
   ```
   docker compose -p caprichos-evolution -f infra/compose/docker-compose.evolution.yml --env-file ~/.aybar/evolution.env up -d
   ```
   Crea su propia base y su propio Redis (volúmenes `caprichos_evolution_*`); no toca los de Caprichos. La imagen es `atendai/evolution-api` con versión fija (v2.2.3). No publica puertos.
4. Crea la instancia (una sola vez, desde el servidor):
   ```
   docker compose -p caprichos-evolution exec evolution-api sh -c 'wget -qO- --header="apikey: $AUTHENTICATION_API_KEY" --header="Content-Type: application/json" --post-data="{\"instanceName\":\"caprichos\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true}" http://127.0.0.1:8080/instance/create'
   ```
   El webhook global del compose ya apunta a `http://api:3000/whatsapp/evolution/webhook?token=...` con los eventos `messages.upsert` y `connection.update`.
5. Pon las variables de la sección 2 en la API y reinicia la API (despliegue normal). Aún sigue usando Meta.

## 4. Vincular el número por QR
1. Entra a Configuración › Chatbot › «Número de WhatsApp: Meta o Evolution» como ADMIN.
2. Si Evolution aparece «Desconectado», pulsa «Mostrar QR para vincular».
3. En el celular del negocio: WhatsApp › Dispositivos vinculados › Vincular un dispositivo › escanea el QR (vence en 1 minuto; si vence, vuelve a pulsar).
4. El estado pasa a «Conectado» (llega `connection.update`). Mantén ese celular con datos o wifi y WhatsApp abierto al menos una vez por semana.
5. Prueba con un mensaje desde otro celular al número: el bot debe responder con el menú numerado.

## 5. Conmutar entre Meta y Evolution
- Pantalla: el mismo bloque, botón «Cambiar a Evolution» o «Volver a Meta», con confirmación Sí/No. Solo ADMIN. Queda en auditoría (módulo `whatsapp_proveedor`, acción `conmutar`, con el valor anterior y el nuevo).
- Equivalente: parámetro `whatsapp_proveedor` = `META` (defecto) o `EVOLUTION`. El cambio rige en menos de 15 segundos, sin redesplegar.
- Los mensajes ya en cola salen por el proveedor activo al momento de enviarse. Los webhooks de Meta y de Evolution pueden convivir.
- Para volver atrás ante cualquier problema: «Volver a Meta». Meta sigue necesitando sus credenciales y plantillas vigentes.

## 6. Reglas anti-bloqueo (solo con Evolution) y valores por defecto
Todas se editan en la misma pantalla (solo ADMIN, auditado) o en `parametro`. «0 = sin tope» en los topes.

| Parámetro | Defecto | Efecto |
| :--- | :--- | :--- |
| `evolution_limite_minuto` / `_hora` / `_dia` | 3 / 30 / 150 | Máximo de avisos proactivos enviados. Lo que excede espera (1 min, 10 min, 60 min) y sale después; no se pierde. |
| `evolution_pausa_min_seg` / `_max_seg` | 2 / 6 | Pausa aleatoria entre cualquier envío (los envíos salen de a uno). |
| `evolution_escribiendo_ms_por_caracter` | 40 | Tiempo de «escribiendo…» antes de cada texto (mín. 1 s, máx. 8 s). |
| `evolution_horario_desde` / `_hasta` | 9 / 22 | Horas de Lima en que pueden salir proactivos; fuera de horario esperan. |
| `evolution_exigir_contacto_previo` | si | No se escribe primero a quien nunca escribió. |
| `evolution_max_enlaces` | 1 | Enlaces por mensaje; los demás se reemplazan por «(enlace omitido)». |
| `evolution_max_texto_identico` | 2 | Si el mismo texto se repite más de esto en una hora, se cambia el saludo. |
| `evolution_origenes_permitidos` | `AVISO_PEDIDO,ENCUESTA` | Orígenes del outbox que pueden salir como proactivos. Agregar uno a esta lista es asumir más riesgo. |
| `evolution_pausado` | no | Pausa manual del envío (botón «Pausar envío»). |

Pausa automática: si Evolution reporta `connection.update` con cierre y el motivo es baneo o sesión revocada (401, 403, `banned`, `logged_out`), o un envío falla con un error de bloqueo, `evolution_pausado` pasa a `si`. Con el número desconectado, los proactivos esperan. En cada desconexión (solo en el cambio de estado) se crea una notificación para los ADMIN en la campanita: «WhatsApp: número desconectado».

## 7. Si el número se desconecta o lo bloquean
1. Revisa la campanita y el estado en la pantalla.
2. Desconexión simple: «Mostrar QR para vincular» y escanear de nuevo. Los avisos en espera salen solos.
3. Si el envío quedó en pausa por baneo: no insistas con el mismo número. Cambia a «Volver a Meta» para no dejar de atender, y recién después decide si se reintenta, se reanuda («Reanudar envío») o se usa otro número.
4. Revisa Mensajes › Salientes: los DESCARTADOS «Bloqueado» son esperados; los PENDIENTES con «Tope» o «Fuera de horario» salen solos.

## 8. Qué no hace Evolution
- No hay carruseles ni imágenes por tarjeta: el carrusel sale como lista numerada.
- No hay estados de entrega (entregado/leído) de Evolution en el panel; un mensaje figura «Enviado» cuando Evolution lo aceptó.
- Si WhatsApp entrega un mensaje con identificador interno (`@lid`) y sin número visible, se ignora (no hay a quién responder).
- Los adjuntos (voucher, nota de voz, documento) se descargan desde Evolution con la misma validación de tipo y tamaño que con Meta.

## 9. Pruebas rápidas
- Webhook sin token o con token equivocado: responde 401.
- Mensaje propio, de grupo o de estado: se ignora.
- Un «2» tras un menú de 3 opciones: el bot actúa como si se hubiera pulsado la segunda opción.
- Cambiar a Evolution sin credenciales: los envíos quedan en modo simulado (log `[EVOLUTION SIMULADO]`).
