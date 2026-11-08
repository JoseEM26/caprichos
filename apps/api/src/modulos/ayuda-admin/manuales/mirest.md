---
modulo: mirest
titulo: Configuración del local
ruta: /admin/mirest
permiso: local/ver
roles: [ADMIN]
relacionados: [zonas, cocina, historial, caja, asistencia, pantallas, usuarios]
sugerencias:
  - ¿Dónde cambio el horario de atención del local?
  - ¿Dónde configuro Yape, Plin y los medios de pago?
  - ¿Cómo activo la alta demanda o pauso los pedidos?
  - ¿Cómo cambio las imágenes de la pantalla de ingreso?
  - ¿Dónde se configura cada cosa del sistema?
---
# Configuración del local

## Para que sirve
Es el centro de los ajustes del negocio: datos del local, horario, medios de pago, entrega y reparto, cocina, textos legales, chatbot de WhatsApp, inteligencia artificial, impresión y pantalla de ingreso, más una lista de parámetros finos. Se entra desde el menú Configuración, módulo "Configuración del local" (/admin/mirest). Es muy amplia, así que tiene un buscador ("Buscar un ajuste") y cada sección se abre con un enlace directo: /admin/mirest?tab=<sección>. Si además agregas &campo=<ajuste>, la pantalla baja hasta ese ajuste y lo resalta un momento. Relacionado con [[zonas]] (mapa de zonas), [[cocina]], [[caja]], [[asistencia]] (su configuración está en su propia pestaña), [[pantallas]] y [[usuarios]].

## Como se hace: llegar rápido a un ajuste
1. Abre Configuración del local y escribe en el buscador de arriba (por ejemplo "horario", "delivery gratis", "spam", "voucher", "impresora"). Elige el resultado: se abre la sección y se resalta el ajuste.
2. O elige la sección en el menú de la izquierda (en celular, en la lista tipo ajustes del teléfono). Las secciones están agrupadas: Mi local, Ventas y reparto, Comunicación con clientes, Equipos y dispositivos y Sistema.
3. Para llevar a otra persona a la misma sección, copia el enlace con ?tab= (por ejemplo /admin/mirest?tab=horario).

## Como se hace: guardar cambios en Configuración
1. En las pestañas de datos (Datos del local, Ubicación, Contacto, Redes, Empresa, Textos) edita y pulsa "Guardar cambios"; confirma con "Sí, guardar" en "¿Guardar la configuración del local?". "Descartar" devuelve los últimos datos guardados.
2. Las demás pestañas (Horario, Pagos, Reparto, Chatbot, Parámetros…) tienen su propio botón de guardar y su propio "Sí/No". Los cambios rigen para pedidos nuevos; los ya creados no se tocan.
3. El cambio queda en el historial ([[historial]]).

## Como se hace: saber en qué sección está cada cosa
1. Revisa la lista "Donde se configura cada cosa" de este manual: dice el problema y la sección exacta con su enlace directo.
2. Cada sección tiene su propio manual con los pasos: datos del local, horario, pagos, entrega y zonas, reparto, alta demanda, cocina, operación, propinas, reservas, verificación del celular, parámetros, chatbot, IA, impresión y pantalla de ingreso.

## Secciones de Configuración
- **Mi local**: [Datos del local](/admin/mirest?tab=local) (Nombre y lema de la carta); [Ubicación](/admin/mirest?tab=ubicacion) (Dirección y punto en el mapa); [Contacto](/admin/mirest?tab=contacto) (Teléfono y WhatsApp); [Horario y fechas](/admin/mirest?tab=horario) (Horario de cada día y fechas especiales); [Redes sociales](/admin/mirest?tab=redes) (Enlaces a las cuentas); [Empresa](/admin/mirest?tab=empresa) (Datos fiscales de los comprobantes).
- **Ventas y reparto**: [Pagos](/admin/mirest?tab=pagos) (Medios que se aceptan y datos de cobro); [Entrega](/admin/mirest?tab=entrega) (Envío gratis y pedido mínimo (se editan en Parámetros)); [Zonas de reparto (mapa)](/admin/mirest?tab=zonas) (Puntos que limitan cada zona); [Reparto y avisos al cliente](/admin/mirest?tab=reparto) (Colores del mapa, velocidad y máximo de pedidos); [Entregas fallidas](/admin/mirest?tab=fallas) (Espera, intentos y recargo (se editan en Parámetros)); [Alta demanda y pausa de pedidos](/admin/mirest?tab=demanda) (Minutos extra y pausa); [Cocina](/admin/mirest?tab=cocina) (Confirmación al despejar y minutos de preparación); [Operación](/admin/mirest?tab=operacion) (Invitado, propina, insumos, reseñas de Google y notificaciones).
- **Comunicación con clientes**: [Textos y mensajes](/admin/mirest?tab=textos) (Términos y privacidad); [Chatbot y seguridad](/admin/mirest?tab=chatbot) (Funciones, textos, anti-spam y privacidad); [Lectura de vouchers con IA](/admin/mirest?tab=vouchers) (Yape y Plin, tope mensual); [Asistente de ayuda con IA](/admin/mirest?tab=ayuda) (Capri e interruptor de IA).
- **Equipos y dispositivos**: [Impresión](/admin/mirest?tab=impresion) (Qué se imprime, equipos y cola); [Pantalla de ingreso](/admin/mirest?tab=ingreso) (Imágenes y frase del ingreso).
- **Sistema**: [Parámetros del sistema](/admin/mirest?tab=parametros) (Tiempos, reservas, avisos de WhatsApp, IA y alertas).
- **Fuera de esta pantalla**: la configuración de asistencia está en Asistencia, pestaña Configuración ([Configuración de asistencia](/admin/asistencia?pestana=config)).

## Donde se configura cada cosa
- Cambiar el nombre o el lema de la carta: [Nombre del local](/admin/mirest?tab=local&campo=local-nombre)
- Cambiar la dirección o el punto del local en el mapa: [Dirección del local](/admin/mirest?tab=ubicacion&campo=ubicacion-direccion)
- Cambiar el teléfono o el WhatsApp de contacto del local: [WhatsApp del local](/admin/mirest?tab=contacto&campo=contacto-whatsapp)
- Poner los enlaces de Instagram, Facebook o TikTok (redes sociales): [Redes sociales](/admin/mirest?tab=redes&campo=redes-instagram)
- Poner la razón social, el RUC o el ubigeo para facturar (datos fiscales de la empresa): [RUC de la empresa](/admin/mirest?tab=empresa&campo=empresa-ruc)
- Cambiar el horario de atención, cerrar un día o abrir más tarde: [Horario semanal](/admin/mirest?tab=horario&campo=horario-semanal)
- Registrar un feriado, vacaciones o un horario especial (fechas especiales): [Fechas especiales y feriados](/admin/mirest?tab=horario&campo=fechas-especiales)
- Encender o apagar efectivo, tarjeta, Yape, Plin o transferencia (medios de pago): [Medios de pago](/admin/mirest?tab=pagos&campo=pagos-pg-efe)
- Cambiar el número de Yape o Plin, o la cuenta bancaria para transferencias: [Número de Yape](/admin/mirest?tab=pagos&campo=pagos-yape)
- Cambiar el monto de envío gratis: [Monto de compra para envío gratis](/admin/mirest?tab=parametros&campo=parametros-envio-gratis-monto)
- Cambiar el pedido mínimo de delivery: [Pedido mínimo](/admin/mirest?tab=parametros&campo=parametros-pedido-minimo)
- Cambiar la tarifa, los minutos o el estado de una zona de reparto, o dibujar su área: [Zonas de reparto en el mapa](/admin/mirest?tab=zonas&campo=zonas-mapa)
- Cambiar el tiempo prometido de entrega que ve el cliente: [Tiempo prometido de entrega (base)](/admin/mirest?tab=parametros&campo=parametros-tiempo-prometido-min)
- Ajustar cómo se calcula el tiempo estimado de entrega (calles, empaque, paradas, redondeo): [Factor de calles](/admin/mirest?tab=parametros&campo=parametros-eta-factor-urbano)
- Activar la alta demanda, sumar minutos al tiempo de entrega o pausar los pedidos: [Minutos extra por alta demanda](/admin/mirest?tab=demanda&campo=demanda-minutos-extra)
- Cambiar el máximo de pedidos por repartidor (límite del repartidor): [Máximo de pedidos por repartidor](/admin/mirest?tab=parametros&campo=parametros-rep-max-pedidos)
- Cambiar los minutos de los colores amarillo, naranja y rojo del mapa de reparto: [Colores de espera del mapa de reparto (amarillo, naranja, rojo)](/admin/mirest?tab=reparto&campo=reparto-alertas-color)
- Cambiar los minutos de los colores naranja y rojo de las comandas de cocina y la lista de pedidos: [Pedido en naranja: minutos de espera (cocina y pedidos)](/admin/mirest?tab=parametros&campo=parametros-rep-naranja-min)
- Cambiar cuánto espera el repartidor en la puerta o la insistencia al cliente: [Espera máxima en la puerta](/admin/mirest?tab=parametros&campo=parametros-reparto-espera-max-min)
- Cambiar cuánto se cobra por reprogramar una entrega fallida o cuántas veces se reprograma: [Costo de volver a enviar un pedido](/admin/mirest?tab=parametros&campo=parametros-reprog-recargo-modo)
- Cambiar cuándo se envía la encuesta posventa, qué calificación es queja o los días de la ventana de respuesta: [Espera antes de enviar la encuesta](/admin/mirest?tab=parametros&campo=parametros-encuesta-espera-min)
- Cambiar el porcentaje de puntos del cliente o el descuento del personal a crédito: [Porcentaje de puntos para el cliente](/admin/mirest?tab=parametros&campo=parametros-puntos-porcentaje)
- Cambiar la tolerancia de las reservas (minutos que se espera al cliente) o el recordatorio de la reserva: [Tolerancia de reservas](/admin/mirest?tab=parametros&campo=parametros-reserva-tolerancia-min)
- Apagar o limitar las reservas desde la carta (botón Reservar, pendientes por celular, días, personas): [Reservar mesa desde la carta encendido](/admin/mirest?tab=parametros&campo=parametros-reserva-web-activa)
- Elegir cómo verifica el cliente su celular y a qué número escribe (verificación del celular): [Cómo verifica el cliente su celular al crear cuenta o recuperar la contraseña](/admin/mirest?tab=parametros&campo=parametros-verificacion-celular-modo)
- Encender la propina en la carta o en WhatsApp, o cambiar el tope de propina: [Propina opcional](/admin/mirest?tab=operacion&campo=operacion-propina-carta)
- Permitir pedir como invitado sin celular: [Pedir como invitado](/admin/mirest?tab=operacion&campo=operacion-carta-invitado)
- Activar el control de insumos y recetas (descuento al cobrar): [Control de insumos y recetas (descuento al cobrar)](/admin/mirest?tab=operacion&campo=operacion-control-almacen)
- Mostrar reseñas de Google en la carta: [Reseñas de Google en la carta](/admin/mirest?tab=operacion&campo=operacion-resenas-google)
- Apagar el sonido de los avisos o cambiar qué avisos suenan (notificaciones): [Notificaciones](/admin/mirest?tab=operacion)
- Pedir o no confirmación al despejar comandas en cocina: [Confirmar al despejar comandas](/admin/mirest?tab=cocina&campo=cocina-confirmar-despejar)
- Cambiar los minutos de preparación por defecto de un producto nuevo: [Minutos de preparación por defecto](/admin/mirest?tab=cocina&campo=cocina-minutos-preparacion-defecto)
- Editar los términos y condiciones o la política de privacidad de la carta: [Términos y condiciones](/admin/mirest?tab=textos&campo=textos-terminos)
- Pausar una función del chatbot (pedidos, cobro, reservas, cambios, promociones): [Funciones del bot](/admin/mirest?tab=chatbot&campo=chatbot-interruptores)
- Cambiar el saludo, la despedida u otros mensajes fijos del bot: [Mensaje de bienvenida del bot](/admin/mirest?tab=chatbot&campo=chatbot-texto-bienvenida)
- Configurar la protección contra spam y pedidos falsos del chatbot (bloqueos): [Protección contra spam](/admin/mirest?tab=chatbot&campo=chatbot-proteccion-spam)
- Anonimizar mensajes antiguos o atender derechos de datos del cliente (Ley 29733, privacidad): [Privacidad y datos personales](/admin/mirest?tab=chatbot&campo=chatbot-privacidad)
- Encender o apagar un aviso automático de WhatsApp al cliente (pedido recibido, listo, en camino, entregado, encuesta): [Aviso: pedido recibido desde la carta](/admin/mirest?tab=parametros&campo=parametros-whatsapp-aviso-recibido-activo)
- Cambiar los recordatorios de pago digital o las alertas de voucher sin revisar: [Recordatorio de comprobante de pago pendiente](/admin/mirest?tab=parametros&campo=parametros-chatbot-pago-recordatorio-activo)
- Encender o apagar el chatbot completo: [Chatbot de WhatsApp encendido](/admin/mirest?tab=parametros&campo=parametros-chatbot-activo)
- Encender o apagar la IA de Capri o ver su consumo: [IA de Capri](/admin/mirest?tab=ayuda&campo=ayuda-capri-interruptor)
- Configurar la lectura de vouchers de Yape y Plin con IA, su titular, números y tope: [Lectura de vouchers con IA](/admin/mirest?tab=vouchers&campo=vouchers-ia-interruptor)
- Encender o apagar stickers y comandas, o ver y reintentar la cola de impresión: [Sticker de bebida](/admin/mirest?tab=impresion&seccion=mapa&campo=mapa-impresion-bebida)
- Instalar el programa de impresión de la PC de Caja o crear llaves del agente: [Instalar el programa de impresión](/admin/mirest?tab=impresion&seccion=equipos&campo=impresion-instalar)
- Cambiar las imágenes o la frase de la pantalla de ingreso: [Imágenes del carrusel de ingreso](/admin/mirest?tab=ingreso&campo=ingreso-carrusel)
- Configurar la asistencia: ubicación del local, radio, tolerancia de tardanza, precisión del GPS y selfies: [Configuración de asistencia](/admin/asistencia?pestana=config)

## Errores y dudas comunes
- No encuentro un ajuste: usa el buscador de la parte superior; si no aparece, puede que tu usuario no tenga permiso para verlo (algunos solo se muestran como "solo lectura").
- Guardé y no cambió nada: faltó confirmar con "Sí, guardar" en el diálogo.
- Un ajuste dice "Se edita en Parámetros →": pulsa su enlace; lleva a la fila exacta.
- La pestaña "Pantalla de ingreso" no aparece: solo la ve quien tiene configuracion/editar (Administrador).
- Cambié algo y un pedido ya creado no cambió: es normal; los cambios rigen para pedidos nuevos.
- Cortesías y correo no se configuran en esta pantalla.

## Quien puede hacerlo
El acceso a Configuración del local requiere el permiso local/ver y corresponde al Administrador (ADMIN). Cambiar los datos requiere local/editar o configuracion/editar, también del Administrador. La alta demanda puede activarla además el personal de Cocina desde su pantalla (permiso cocina/demanda).
