---
modulo: mirest
titulo: Configuración: Datos del local
ruta: /admin/mirest
seccion: datos-local
activa_con: [tab=local, tab=ubicacion, tab=contacto, tab=redes, tab=empresa]
permiso: local/ver
roles: [ADMIN]
relacionados: [zonas, comprobantes, caja]
sugerencias:
  - ¿Cómo cambio el nombre o el lema que sale en la carta?
  - ¿Dónde cambio la dirección y el punto del local en el mapa?
  - ¿Cómo cambio el WhatsApp o el teléfono de contacto del local?
  - ¿Dónde pongo la razón social y el RUC para los comprobantes?
  - ¿Cómo agrego los enlaces de Instagram, Facebook y TikTok?
---
# Configuración: Datos del local

## Para que sirve
Reúne los datos básicos del negocio que usan la carta virtual, el chatbot de WhatsApp y los comprobantes. Son cinco pestañas de Configuración del local, todas con el mismo botón "Guardar cambios": Datos del local (nombre y lema), Ubicación (dirección y punto en el mapa), Contacto (teléfono y WhatsApp), Redes sociales y Empresa (razón social, RUC, dirección fiscal y ubigeo para facturar). Lo que guardas aquí se ve de inmediato en la carta y en los comprobantes. Los comprobantes los emite [[comprobantes]] y las zonas de entrega se miden desde el punto del local ([[zonas]]).

## Como se hace: cambiar el nombre y el lema del local
1. Entra a Configuración del local y elige la pestaña "Datos del local" (enlace directo: [Datos del local](/admin/mirest?tab=local)).
2. Escribe el nombre en "Nombre del local" (es obligatorio) y, si quieres, el lema en "Lema (debajo del nombre)": hasta 80 caracteres.
3. Pulsa "Guardar cambios". Aparece "¿Guardar la configuración del local?"; pulsa "Sí, guardar". Con "No, cancelar" no se guarda nada.
4. Si te equivocas antes de guardar, pulsa "Descartar" y confirma: vuelven los últimos datos guardados.

## Como se hace: poner la dirección y el punto del local en el mapa
1. Abre la pestaña "Ubicación" ([Ubicación](/admin/mirest?tab=ubicacion)).
2. Escribe la dirección completa en "Dirección" (obligatoria). Es la que lee el cliente en la carta y la que imprimen los comprobantes.
3. Marca el punto exacto del local en el mapa o escribe a mano la Latitud (entre -90 y 90) y la Longitud (entre -180 y 180). Desde ese punto se mide el delivery.
4. Pulsa "Guardar cambios" y confirma con "Sí, guardar".

## Como se hace: cambiar el teléfono y el WhatsApp de contacto
1. Abre la pestaña "Contacto" ([Contacto](/admin/mirest?tab=contacto)).
2. En "Teléfono que se muestra" escribe el número visible en el pie de la carta (no puede quedar vacío).
3. En "WhatsApp" escribe solo números, con código de país y sin espacios ni guiones, por ejemplo 51987654321. A ese número escribe el cliente desde el botón de WhatsApp de la carta.
4. Pulsa "Guardar cambios" y confirma con "Sí, guardar".

## Como se hace: agregar las redes sociales
1. Abre la pestaña "Redes sociales" ([Redes sociales](/admin/mirest?tab=redes)).
2. Escribe el nombre que se ve en Instagram (por ejemplo @caprichos) y los enlaces completos de Instagram, Facebook y TikTok. Si dejas uno vacío, ese botón no aparece.
3. Pulsa "Guardar cambios" y confirma con "Sí, guardar".

## Como se hace: registrar los datos fiscales de la empresa
1. Abre la pestaña "Empresa" ([Empresa](/admin/mirest?tab=empresa)).
2. Escribe la Razón social (hasta 150 caracteres), el RUC (11 dígitos que empiezan con 10, 15, 17 o 20), la Dirección fiscal (hasta 200 caracteres) y el Ubigeo del domicilio fiscal (6 dígitos, por ejemplo 150132 para San Juan de Lurigancho).
3. Pulsa "Guardar cambios" y confirma con "Sí, guardar".
4. Si falta la razón social o el RUC, el comprobante avisa "Falta razón social" o "Falta RUC" y no imprime datos de ejemplo.
Antes: [[caja]]
Despues: [[comprobantes]]

## Ajustes: Datos del local, ubicación, contacto, redes y empresa
- **Nombre del local** (local_datos.nombre): Nombre que ve el cliente en la cabecera de la carta, como titular al pagar con Yape o Plin, en los comprobantes y cuando el bot habla del local. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: Caprichos. valor por defecto Caprichos. [Nombre del local](/admin/mirest?tab=local&campo=local-nombre)
- **Lema debajo del nombre** (local_datos.lema): Frase corta que sale bajo el nombre en la cabecera de la carta. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: Cafetería artesanal. valor por defecto Cafetería artesanal, rango hasta 80 caracteres. [Lema debajo del nombre](/admin/mirest?tab=local&campo=local-lema)
- **Dirección del local** (local_datos.direccion): Dirección que lee el cliente en la carta (pie, Conócenos, Novedades) y en los comprobantes; el bot la da cuando preguntan dónde queda. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: Av. Campoy 123, San Juan de Lurigancho. [Dirección del local](/admin/mirest?tab=ubicacion&campo=ubicacion-direccion)
- **Latitud de la tienda** (local_datos.lat): Coordenada norte-sur del local, el punto desde donde se mide el delivery. Se marca en el mapa o se escribe. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: -12.0147. valor por defecto -12.0196, rango -90 a 90. [Latitud de la tienda](/admin/mirest?tab=ubicacion&campo=ubicacion-lat)
- **Longitud de la tienda** (local_datos.lng): Coordenada este-oeste del local, el punto desde donde se mide el delivery. Se marca en el mapa o se escribe. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: -76.966. valor por defecto -76.9633, rango -180 a 180. [Longitud de la tienda](/admin/mirest?tab=ubicacion&campo=ubicacion-lng)
- **WhatsApp del local** (local_datos.whatsapp): Número al que escribe el cliente desde el botón de WhatsApp de la carta (enlace wa.me). Solo números, con código de país. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: 51987654321. rango Solo dígitos, con código de país (51 para Perú). [WhatsApp del local](/admin/mirest?tab=contacto&campo=contacto-whatsapp)
- **Teléfono que se muestra** (local_datos.telefono): Teléfono visible en el pie de la carta, en Conócenos, como número de Yape o Plin si ese medio no tiene el suyo, y en los comprobantes. No puede quedar vacío. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: 987 654 321. [Teléfono que se muestra](/admin/mirest?tab=contacto&campo=contacto-telefono)
- **Nombre que se ve en Instagram** (local_datos.redes.instagramNombre): Texto del enlace de Instagram en el pie de la carta. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: @caprichos. [Nombre que se ve en Instagram](/admin/mirest?tab=redes&campo=redes-instagram-nombre)
- **Enlace de Instagram** (local_datos.redes.instagram): Enlace al que llega el cliente al tocar Instagram en el pie, Conócenos o Novedades de la carta. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: https://www.instagram.com/caprichos. [Enlace de Instagram](/admin/mirest?tab=redes&campo=redes-instagram)
- **Enlace de Facebook** (local_datos.redes.facebook): Enlace al que llega el cliente al tocar Facebook en la carta. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: https://www.facebook.com/caprichos. [Enlace de Facebook](/admin/mirest?tab=redes&campo=redes-facebook)
- **Enlace de TikTok** (local_datos.redes.tiktok): Enlace al que llega el cliente al tocar TikTok en la carta. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: https://www.tiktok.com/@caprichos. [Enlace de TikTok](/admin/mirest?tab=redes&campo=redes-tiktok)
- **Razón social** (local_datos.razon_social): Nombre legal que imprimen los comprobantes. Si falta, el comprobante avisa «Falta razón social» y no imprime ningún dato de ejemplo. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: Mi Negocio S.A.C. rango hasta 150 caracteres. Riesgo alto: toca dinero o deja de atender clientes. [Razón social](/admin/mirest?tab=empresa&campo=empresa-razon-social)
- **RUC de la empresa** (local_datos.ruc): RUC de 11 dígitos que imprimen los comprobantes. Si falta, el comprobante avisa «Falta RUC» y no imprime ningún dato de ejemplo. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: 20601234567. rango 11 dígitos, empieza con 10, 15, 17 o 20. Riesgo alto: toca dinero o deja de atender clientes. [RUC de la empresa](/admin/mirest?tab=empresa&campo=empresa-ruc)
- **Ubigeo del domicilio fiscal** (local_datos.ubigeo): Código de 6 dígitos del distrito del domicilio fiscal (150132 para San Juan de Lurigancho). Lo usa la facturación electrónica directa a SUNAT. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: 150132. rango 6 dígitos. [Ubigeo del domicilio fiscal](/admin/mirest?tab=empresa&campo=empresa-ubigeo)
- **Dirección fiscal** (local_datos.direccion_fiscal): Dirección registrada en SUNAT; sale en los comprobantes junto a la razón social y el RUC. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: Av. Los Olivos 456, Lima. rango hasta 200 caracteres. [Dirección fiscal](/admin/mirest?tab=empresa&campo=empresa-direccion-fiscal)

## Errores y dudas comunes
- "El nombre del local es obligatorio", "La dirección es obligatoria" o "El teléfono es obligatorio": son los tres datos que no pueden quedar vacíos al guardar.
- "El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20": revisa que no haya espacios ni letras.
- "El ubigeo debe tener 6 dígitos": escribe solo los 6 números del distrito.
- "La latitud debe ser un número entre -90 y 90" o "La longitud debe ser un número entre -180 y 180": usa punto decimal, por ejemplo -12.0147.
- "El lema no puede pasar de 80 caracteres": acórtalo.
- Los cambios no aparecen: faltó pulsar "Guardar cambios" y confirmar con "Sí, guardar".
- Los valores de ejemplo (Av. Principal 123, 999999999) no cuentan como datos reales: reemplázalos por los verdaderos.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El administrador no escribe código de supervisor: el sistema lo autoriza solo y el cambio queda en el historial de auditoría.
