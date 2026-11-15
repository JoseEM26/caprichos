# RB-CAP-014: WhatsApp con Evolution API (no oficial), Meta de respaldo

## Qué es
Evolution API es un servidor que se conecta a WhatsApp Web (librería Baileys) con un número normal. Caprichos puede usarlo como su ÚNICO número de WhatsApp. El WhatsApp oficial de Meta (Cloud API) sigue instalado como respaldo: un parámetro elige cuál se usa, sin redesplegar.

**Riesgo que se acepta:** WhatsApp no permite este uso. El número puede ser bloqueado. Por eso Caprichos aplica reglas anti-bloqueo (sección 5) y se puede volver a Meta en cualquier momento.

**Estado de entrega:** todo viene APAGADO. Meta es el proveedor activo hasta que un ADMIN cambie. Sin credenciales de Evolution, el adaptador funciona en modo simulado (solo log, nada sale a la red).

## 1. Qué cambia para el cliente con Evolution
- Menús en texto numerado. No hay botones, listas ni carruseles: el bot manda «1. Ver carta / 2. Pedir / Responde 1 o 2» y la respuesta «2» se convierte en el mismo botón que habría pulsado. Un texto normal posterior del bot cierra el menú (un «2» suelto después ya no se toma como opción). El menú dura 30 minutos.
- Igualito a Meta (decisión del 15/11): rige la MISMA ventana de 24 h. Solo se escribe libre si el cliente pidió o escribió en las últimas 24 h; fuera de eso, lo que en Meta iría por plantilla sale con EL MISMO TEXTO de esa plantilla, con sus variables puestas (una sola función: `textoDePlantilla`, con prueba por cada plantilla del catálogo). Lo que no tiene plantilla se descarta, igual que en Meta.
- Mismos avisos que Meta: rigen los mismos interruptores `whatsapp_aviso_*`. Ya no hay una lista corta de orígenes: `evolution_origenes_permitidos` queda vacío (= todos los de Meta); si un ADMIN escribe una lista, solo salen esos. Las respuestas del bot a un mensaje del cliente siempre salen.
- Solo dentro del HORARIO DE TRABAJO DEL LOCAL (el de Configuración › Local: horario por día y fechas especiales). Lo que cae fuera de horario se DESCARTA (motivo «Descartado: ... fuera del horario»), no se manda al día siguiente; las respuestas a un mensaje del cliente sí salen. `evolution_horario_desde/hasta` quedan solo de respaldo si no se puede leer el horario del local (o hay una pausa por alta demanda).
- Menos mensajes: si el pedido ya está pagado cuando se recibe, «recibimos tu pedido» y «pago confirmado» salen en UN solo mensaje (el pago confirmado no sale aparte; también si el pago se confirma cuando «recibido» aún espera en la cola). Si el pago se confirma después, siguen siendo dos. El delivery no se junta (su aviso «aceptado» dice que ya lo preparan). Rige igual con Meta.
- Reacciones en vez de texto: al voucher recibido se reacciona ✅ y a un «gracias / ok / listo / 👍» se reacciona ❤️ (si el cliente tiene un pedido de hoy y el bot no está en medio de una pregunta). Con Evolution usa `POST /message/sendReaction/{instancia}` (API v2); con Meta, `type: reaction`. Si la reacción falla, se contesta con texto como antes. La lista blanca `WHATSAPP_SOLO_NUMEROS` también corta las reacciones.
- Sin bot (apagado, o chat en manos de una persona): si un cliente escribe FUERA DE HORARIO se le responde UNA vez (máx. 1 cada 12 h) con el texto de «fuera de horario» del bot (`chatbot_texto_fuera_horario`), cuándo abrimos y el enlace de la carta; si saluda sin pedido activo, se le da la bienvenida con el enlace a la carta (máx. 1 cada 12 h). Con el bot activo no cambia nada: el bot ya saluda con su bienvenida y avisa el horario. Rige con Meta y con Evolution.
- Nunca se escribe primero a un número que jamás escribió al negocio (queda DESCARTADO, «sin contacto previo»). Excepciones: los avisos del pedido también salen si ese celular hizo un pedido en las últimas 24 h (p. ej. por la carta web), y el código, la reserva, la cuenta creada y los avisos al equipo no lo exigen (los pidió el cliente o son del personal).

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
   Crea su propia base y su propio Redis (volúmenes `caprichos_evolution_*`); no toca los de Caprichos. La imagen es `evoapicloud/evolution-api` con versión fija (v2.2.3). No publica puertos.
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
| `evolution_limite_minuto` / `_hora` / `_dia` | 3 / 60 / 350 | Máximo de mensajes enviados. Lo que excede espera (1 min, 10 min, 60 min) y sale después; no se pierde. Con 60 por hora el tope de la hora manda (1 por minuto en promedio); 3 por minuto deja pasar un pico corto sin estrangularlo, por eso no se subió a 5. |
| `evolution_pausa_min_seg` / `_max_seg` | 2 / 6 | Pausa aleatoria entre cualquier envío (los envíos salen de a uno). |
| `evolution_escribiendo_ms_por_caracter` | 40 | Tiempo de «escribiendo…» antes de cada texto (mín. 1 s, máx. 8 s). |
| `evolution_horario_desde` / `_hasta` | 9 / 22 | Solo respaldo (ver arriba): horas de Lima que se usan si no se puede leer el horario del local. |
| `evolution_exigir_contacto_previo` | si | No se escribe primero a quien nunca escribió. |
| `evolution_max_enlaces` | 1 | Enlaces por mensaje; los demás se reemplazan por «(enlace omitido)». |
| `evolution_max_texto_identico` | 2 | Si el mismo texto se repite más de esto en una hora, se cambia el saludo. |
| `evolution_origenes_permitidos` | (vacío) | Vacío = los mismos avisos que Meta. Con valores, lista blanca de orígenes del outbox. |
| `evolution_fallos_seguidos` / `_ventana_min` | 5 / 10 | Pausa automática: esa cantidad de fallos de envío seguidos dentro de esos minutos (0 = no pausar solo). |
| `evolution_pausado` | no | Pausa manual del envío (botón «Pausar envío»). |

Pausa automática (con Evolution como proveedor activo): si hay N fallos de envío seguidos (red caída, 5xx, 401/403; un 400 por «número sin WhatsApp» no cuenta), si la instancia se desconecta (`connection.update` con cierre; un cierre 515 de reinicio no cuenta) o si hay señal de baneo (401, 403, `banned`, `logged_out`), pasa todo solo esto: `evolution_pausado` = `si`, `whatsapp_proveedor` = `META` (si Meta tiene `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`; si no, solo se pausa y los avisos esperan), queda en la auditoría (módulo `whatsapp_proveedor`, acción `pausa_automatica`) y se avisa a los ADMIN por el canal de avisos internos (campanita, y WhatsApp/correo si están activos). Ocurre una sola vez; un ADMIN lo devuelve a Evolution a mano («Reanudar envío» y «Cambiar a Evolution»). Con Meta activo, una desconexión solo avisa a la campanita.

## 7. Si el número se desconecta o lo bloquean
1. Revisa la campanita y el estado en la pantalla.
2. Desconexión simple: «Mostrar QR para vincular» y escanear de nuevo. Los avisos en espera salen solos.
3. Si el envío quedó en pausa por baneo: no insistas con el mismo número. Cambia a «Volver a Meta» para no dejar de atender, y recién después decide si se reintenta, se reanuda («Reanudar envío») o se usa otro número.
4. Revisa Mensajes › Salientes: los DESCARTADOS «Fuera del horario» o «sin contacto previo» son esperados; los PENDIENTES con «Tope» salen solos.
5. Si Evolution se pausó solo, los avisos ya salen por Meta: arregla el número con calma y vuelve a Evolution a mano.

## 8. Qué no hace Evolution
- No hay carruseles ni imágenes por tarjeta: el carrusel sale como lista numerada.
- El contador de consumo de WhatsApp cuenta también los envíos de Evolution (se registran en `whatsapp_mensaje`, sin campo de proveedor).
- No hay estados de entrega (entregado/leído) de Evolution en el panel; un mensaje figura «Enviado» cuando Evolution lo aceptó.
- Si WhatsApp entrega un mensaje con identificador interno (`@lid`) y sin número visible, se ignora (no hay a quién responder).
- Los adjuntos (voucher, nota de voz, documento) se descargan desde Evolution con la misma validación de tipo y tamaño que con Meta.

## 9. Pruebas rápidas
- Webhook sin token o con token equivocado: responde 401.
- Mensaje propio, de grupo o de estado: se ignora.
- Un «2» tras un menú de 3 opciones: el bot actúa como si se hubiera pulsado la segunda opción.
- Cambiar a Evolution sin credenciales: los envíos quedan en modo simulado (log `[EVOLUTION SIMULADO]`).

## 10. Pre-producción (demo): cómo se prueba sin escribir a clientes reales
- La demo tiene una copia de datos reales: la variable `WHATSAPP_SOLO_NUMEROS` (lista de celulares `51XXXXXXXXX` separados por coma) limita TODO envío (Evolution y Meta) a esos números. Cualquier otro destino se descarta como OMITIDO (en Mensajes › Salientes figura DESCARTADO, motivo «DESTINO_FUERA_DE_LISTA_BLANCA»). En el compose de la demo, sin valor, queda «ninguno» y no sale nada.
- Los avisos automáticos de la demo siguen apagados (`whatsapp_aviso_*_activo`, lo deja así `clonar-prod-a-demo`): el apagado se evalúa antes de encolar, por lo que Evolution lo respeta igual que Meta.
- Instalación: acción `instalar-evolution` del workflow (solo demo, rama preprod; input `numeros_prueba` o secreto `WHATSAPP_SOLO_NUMEROS`). Crea `/opt/caprichos/evolution/evolution.env` (0600) y la instancia `caprichos`; Evolution no publica puertos: el QR se pide a la API de Caprichos (Configuración › Chatbot › WhatsApp).
- Con `evolution_exigir_contacto_previo = si`, el número de prueba debe escribir primero al número de Evolution para recibir avisos.
