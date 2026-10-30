---
id: RB-CAP-012
tipo: guia
titulo: "Guía paso a paso: cómo hacer público el bot de WhatsApp y lista de pendientes para producción"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-27
relacionados: [RB-CAP-007, PLANTILLAS-WHATSAPP, PLAN-CHATBOT-OLAS, SEC-CAP-001, COS-CAP-001]
tags: [guia, whatsapp, meta, cloud-api, produccion, go-live, pendientes]
---

# Guía paso a paso: cómo hacer público el bot de WhatsApp y lista de pendientes para producción

| Campo | Valor |
|---|---|
| Cuándo usarlo | Para migrar el conector de WhatsApp desde la cuenta de pruebas de Meta al número comercial oficial del negocio en modo público (Live), y verificar la lista de control previa a la salida a producción |
| Tiempo esperado | Trámite de verificación comercial en Meta: 1 a 3 días hábiles · Configuración técnica final: menos de 30 minutos |
| Quién lo ejecuta | José Ángel Espinoza (técnico) en coordinación con Kevin (dueño / representante legal de Caprichos) |
| Módulos afectados | `apps/api/src/modulos/chatbot/`, Meta for Developers, Meta Business Suite, variables de entorno de producción |

---

## 1. Diferencia entre modo desarrollo (Pruebas) y modo Live (Público)

Actualmente, el chatbot de Caprichos opera en **Modo Desarrollo (Test)** con las siguientes limitaciones de Meta:
- **Restricción de destinatarios:** El número de prueba de Meta solo puede responder a un máximo de **5 números de teléfono registrados y verificados** previamente en la consola de Meta for Developers. Si cualquier otro cliente escribe, el bot recibe el mensaje pero no puede contestar.
- **Vigencia del token:** El token temporal de prueba caduca cada 24 horas y exige renovación manual.
- **Modo Live (Público):** Permite recibir y responder mensajes a cualquier comensal, iniciar conversaciones con plantillas de utilidad aprobadas, procesar pagos y reservas concurrentes sin limitaciones de destinatarios.

---

## 2. Paso a paso para hacer público el bot

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Paso 1:         │     │ Paso 2:         │     │ Paso 3:         │     │ Paso 4:         │
│ Documentación   │────►│ Verificación de │────►│ Alta de Número  │────►│ Token Permanente│
│ legal del dueño │     │ Empresa en Meta │     │ Oficial del Local     │ de Sistema      │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                                                 │
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐              │
│ Paso 7:         │     │ Paso 6:         │     │ Paso 5:         │              │
│ Pasar la App a  │◄────│ Webhook y Env   │◄────│ Aprobación de   │◄─────────────┘
│ Modo Live       │     │ de Producción   │     │ Plantillas      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Paso 1: Recopilación de documentación comercial
Para verificar el negocio ante Meta, Kevin debe preparar:
1. Ficha RUC activa y habida de la empresa o persona natural con negocio (SUNAT).
2. Recibo de servicios públicos reciente (luz, agua o telefonía fija/móvil) a nombre del titular donde figure la dirección comercial del local.
3. Licencia de funcionamiento municipal o documento de constitución.

### Paso 2: Verificación de la empresa en Meta Business Suite
1. Ingresar a [Meta Business Settings → Centro de Seguridad](https://business.facebook.com/settings/security).
2. En la sección **Verificación del negocio**, presionar **Iniciar verificación**.
3. Ingresar la razón social exacta, dirección, teléfono comercial y sitio web oficial (`https://caprichos.pe`).
4. Adjuntar los documentos digitalizados del Paso 1.
5. Seleccionar el método de comprobación (código por correo de dominio propio `@caprichos.pe` o SMS al teléfono legal).
6. Esperar la validación de Meta (suele tardar entre 24 y 72 horas).

### Paso 3: Alta del número de teléfono oficial del local
> [!CAUTION]
> **ATENCIÓN AL MIGRAR NÚMEROS EXISTENTES:**
> Un número que ya esté registrado en la aplicación móvil de WhatsApp o WhatsApp Business **no puede conectarse directamente a la Cloud API**. Antes de conectarlo a Meta Cloud API, debe eliminarse la cuenta desde los ajustes de la aplicación WhatsApp en el teléfono físico (`Ajustes → Cuenta → Eliminar mi cuenta`). Esto borra los chats del teléfono pero libera el número en los servidores de Meta.

1. En [Meta Business Suite → Cuentas de WhatsApp](https://business.facebook.com/wa/manage/phone-numbers/):
2. Presionar **Agregar número de teléfono**.
3. Nombre visible del perfil de empresa: `Caprichos Cafetería`.
4. Categoría: `Restaurante / Cafetería`.
5. Descripción del perfil y horario oficial.
6. Elegir verificación mediante **SMS** o **Llamada de voz** al número del local.
7. Ingresar el código de 6 dígitos recibido.
8. Una vez verificado, copiar el **Phone Number ID** asignado al número real.

### Paso 4: Crear Usuario del Sistema y Token Permanente
1. En [Meta Business Settings → Usuarios del sistema](https://business.facebook.com/settings/system-users):
2. Agregar usuario con rol **Administrador**: `bot-caprichos-produccion`.
3. Presionar **Asignar activos**:
   - En **Apps**: asignar la aplicación `Caprichos Chatbot` con control total.
   - En **Cuentas de WhatsApp**: asignar la cuenta comercial de Caprichos con permisos de mensajería y administración.
4. Presionar **Generar nuevo token**:
   - Seleccionar la app oficial.
   - Vigencia del token: **Nunca caduca** (*Never*).
   - Permisos obligatorios: `whatsapp_business_messaging` y `whatsapp_business_management`.
5. Copiar el token generado inmediatamente en un gestor de contraseñas seguro (KeePass o similar). Meta no vuelve a mostrar este token.

### Paso 5: Aprobación de plantillas oficiales de Utilidad
Fuera de la ventana de 24 horas del cliente, Meta prohíbe el texto libre. Las plantillas deben darse de alta con categoría **UTILIDAD** en [Meta Business Suite → Plantillas de mensajes](https://business.facebook.com/wa/manage/message-templates/):
- `caprichos_delivery_en_camino`
- `caprichos_delivery_en_puerta`
- `caprichos_delivery_insistencia`
- `caprichos_delivery_espera_agotada`
- `caprichos_pago_confirmado`
- `caprichos_recojo_listo`
- `caprichos_encuesta_posventa`
- `caprichos_equipo_nuevo_pedido`
- `caprichos_equipo_alerta_almacen`

Consultar el catálogo exacto con textos y parámetros en [`PLANTILLAS-WHATSAPP.md`](./PLANTILLAS-WHATSAPP.md). Las plantillas de utilidad suelen aprobarse en menos de 15 minutos.

### Paso 6: Configurar variables y Webhook en el servidor de producción
En el archivo `/opt/caprichos/prod/.env`:
```env
WHATSAPP_TOKEN=EAAG...el_token_permanente_del_paso_4...
WHATSAPP_PHONE_ID=1092837465...id_del_paso_3...
WHATSAPP_VERIFY_TOKEN=token_secreto_alfanumerico_generado_al_azar
WHATSAPP_APP_SECRET=clave_secreta_de_la_app_en_meta_developers
```
En la consola de Meta for Developers:
- URL de webhook: `https://api.caprichos.pe/whatsapp/webhook`
- Verificar token y suscribir al campo `messages`.

### Paso 7: Conmutar la App a Modo Live (En vivo)
1. En [Meta for Developers](https://developers.facebook.com/apps/):
2. En la barra superior, cambiar el interruptor de **Desarrollo** a **En vivo** (*Live*).
3. Requisitos para pasar a Live:
   - Política de privacidad pública accesible (ej. `https://caprichos.pe/carta/legal/privacidad`).
   - Correo de contacto comercial.
   - Ícono oficial de la app (logo de Caprichos 1024x1024 px).
4. Guardar cambios. A partir de este momento, cualquier cliente que envíe un mensaje al número oficial será atendido por el bot.

---

## 3. Lista de pendientes críticos obligatorios antes de salir a producción

Antes de abrir el sistema al público general, deben resolverse los siguientes puntos de seguridad y negocio:

| # | Pendiente | Situación actual | Acción correctiva requerida | Responsable |
|---|---|---|---|---|
| 1 | **Horario de atención (24/7 de la demo)** | En el entorno demo se configuró el horario 24/7 para permitir pruebas de agentes y revisión a cualquier hora. | **Restaurar el horario real del local:** Lunes a Sábado de 14:00 a 22:00, con Domingo cerrado. Se configura en `apps/api/src/modulos/local/local.service.ts` o en los parámetros del local. Fuera de ese horario el bot debe informar honestamente que el local está cerrado y ofrecer ver la carta para mañana. | Técnico |
| 2 | **Contraseñas por defecto de usuarios** | Existen cuentas de prueba con claves genéricas (como `123456`, `NuevaClave2026`, DNI repetidos). | Cambiar inmediatamente la contraseña de todos los usuarios en la base de producción (`ADMIN`, `CAJERO`, `MOZO`, `COCINA`). Exigir contraseñas robustas de mínimo 10 caracteres. | Administrador |
| 3 | **Credenciales y llave SSH del bot antiguo** | En el disco del servidor existe la carpeta del bot previo (`legacy/capri-bot`), que contiene llaves SSH y contraseñas antiguas. | Rotar la contraseña de la base de datos si fue compartida con el bot legacy y revocar/eliminar las llaves SSH obsoletas de `~/.ssh/authorized_keys`. | Técnico |
| 4 | **Cuentas bancarias de transferencia real** | Hoy los textos de transferencia bancaria muestran datos de prueba. | Registrar los números reales de Cuenta Corriente, Cuenta Simple y Código de Cuenta Interbancario (CCI) del BCP, BBVA u otra entidad financiera a nombre de la empresa, además de los datos de Yape y Plin (`Maria Jose Morillo Ruiz`, `977503006`). | Dueño (Kevin) |
| 5 | **Revisión legal de términos y privacidad** | Los textos legales de la carta son borradores basados en la Ley 29733. | Revisión final por parte de Kevin o su asesor legal de los textos de Libro de Reclamaciones, Protección de Datos y Tratamiento de Información de Clientes. | Dueño + Legal |
| 6 | **Prueba de etiquetera térmica física** | El agente local de impresión TSPL2 está probado en código y archivos, pero no en la máquina física. | Realizar la prueba física en la PC de Caja con la impresora 4BARCODE 4B-2054TH conectada y calibrar el rollo de etiquetas de 63.5 mm x 101.6 mm según [RB-CAP-010](./RB-CAP-010-operar-agente-impresion-etiquetas.md). | Técnico + Caja |
| 7 | **Tope de gasto de OpenAI para chatbot** | Parámetro `chatbot_ia_tope_mensual_usd` establecido en US$ 20. | Confirmar con Kevin si se mantiene en US$ 20 mensuales o se ajusta según el volumen de ventas inicial. | Dueño + Técnico |
