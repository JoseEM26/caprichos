---
id: CHK-CAP-001
tipo: checklist
titulo: "Requisitos para subir Caprichos a producción"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-27
relacionados: [ADR-011, ADR-015, ADR-016, ADR-017, RB-CAP-005, RB-CAP-007, RB-CAP-008, RB-CAP-009, REL-CAP-001, PLANTILLAS-WHATSAPP, GUIA-hacer-publico-el-bot-de-whatsapp]
tags: [operacion, produccion, checklist, meta, whatsapp]
---

# Requisitos para subir Caprichos a producción

Lista única de todo lo que debe estar hecho **antes** de abrir el sistema a clientes reales. Hoy solo existe la **demo** (`caprichos.pe`, rama `ola-1`); el entorno de producción real se crea al final. Marcar cada punto con fecha y persona cuando se cumpla. Lo que depende de Meta puede empezarse antes: no cuesta y tarda días.

## 1. Meta y WhatsApp (empezar ya)

- [ ] **Número real** del negocio, que no esté en WhatsApp normal ni en WhatsApp Business (si lo está, eliminar esa cuenta primero). Recibe un código por SMS o llamada.
- [ ] **Verificación del negocio** en Meta (documentos del RUC o razón social). Tarda de 2 a 10 días. Sin ella no se pasa a producción ni suben los límites de envío.
- [ ] **Nombre visible** del negocio aprobado por Meta.
- [ ] **Método de pago** cargado en Meta (algunos mensajes se cobran).
- [ ] **13 plantillas aprobadas** (categoría Utilidad, idioma español, nombre y variables idénticos a `apps/api/src/modulos/chatbot/catalogo/plantillas.catalogo.ts`; textos sugeridos en `PLANTILLAS-WHATSAPP.md`):
  - [ ] `caprichos_delivery_en_camino`
  - [ ] `caprichos_delivery_llegado`
  - [ ] `caprichos_delivery_insistencia`
  - [ ] `caprichos_delivery_reprogramacion`
  - [ ] `caprichos_pago_confirmado`
  - [ ] `caprichos_pedido_listo_recojo`
  - [ ] `caprichos_encuesta_posventa`
  - [ ] `caprichos_reabrir_conversacion`
  - [ ] `caprichos_reserva_confirmada`
  - [ ] `caprichos_reserva_recordatorio`
  - [ ] `caprichos_reserva_actualizacion`
  - [ ] `caprichos_equipo_nuevo_pedido`
  - [ ] `caprichos_equipo_alerta_almacen`
  - [ ] `aviso_interno` (alertas a administradores)
- [ ] **App de Meta en modo Live**, con política de privacidad pública, ícono y categoría.
- [ ] **Webhook** apuntando a la dirección de producción (`/whatsapp/webhook`), con el campo `messages` activo.
- [ ] En el servidor de producción: `Phone Number ID` del número real, token permanente del usuario del sistema, `WHATSAPP_APP_SECRET` y token de verificación (solo por variables de entorno, nunca en Git).
- [ ] Probar con un celular que no sea del equipo: hola, pedido, pago, reserva, cambio de pedido y «asesor».

## 2. Legal y datos reales

- [ ] Política de privacidad y términos **sin texto de ejemplo**: titular, RUC, direcciones, correo y WhatsApp para derechos ARCO, banco de datos personales (inscripción ANPDP), terceros que reciben datos (Meta, Google, OpenAI, servidor), plazos de conservación, reembolsos, entrega y reservas (`apps/api/prisma/seed-legal.ts`).
- [ ] Mencionar en la privacidad que la foto del voucher se envía a OpenAI para leerla (solo la imagen, sin nombre ni teléfono).
- [ ] Libro de reclamaciones y datos del local (horarios, teléfono, redes, serie de comprobantes).
- [ ] **Horario real** del local: la demo está abierta 24 horas solo para pruebas; restaurar 14:00 a 22:00 con el domingo cerrado.
- [ ] **Medios de pago reales**: Yape y Plin (977503006, María José Morillo Ruiz) ya configurados; falta la cuenta y el CCI reales de la transferencia bancaria.

## 3. Seguridad y accesos

- [ ] Quitar las claves de ejemplo `123456` de los usuarios de la demo; en producción cada persona con su DNI y clave propia (`debeCambiar` activo).
- [ ] Cambiar la clave del administrador local `11223344`; no reutilizar datos de la demo.
- [ ] Rotar la llave SSH `ssh-key-2026-08-13.key` del bot antiguo y su contraseña; endurecer SSH y firewall de la VPS (RB-CAP-005 de rotación de claves).
- [ ] Código del supervisor (TOTP) configurado por el administrador real.
- [ ] Administradores con **número de WhatsApp confirmado** para recibir alertas (Usuarios, bloque «Alertas por WhatsApp»).
- [ ] Revisar que ningún secreto esté en el repositorio (el hook `secret-scanner` debe pasar).

## 4. Infraestructura y despliegue

- [ ] **Entorno de producción real**: dominio propio, base de datos propia, Redis y volumen de archivos propios, separados de la demo (ADR-015, RB-CAP-004).
- [ ] Despliegue solo por `workflow_dispatch` con **tag semántico** (`vX.Y.Z`) integrado en `main` y confirmación literal «PRODUCCION».
- [ ] Despliegue **sin corte** probado en producción con la sonda (`docs/scripts/sonda-salud.sh`): cero fallos (RB-CAP-008). Migraciones siempre aditivas (expand/contract).
- [ ] Respaldos de la base y de los archivos con prueba de restauración (RB-CAP-002, PCN-CAP-001).
- [ ] Vigilancia y aviso si un servicio cae (RB-CAP-003).
- [ ] Actualizar las acciones de GitHub Actions cuando haya versiones con Node 24 (hoy solo es un aviso).
- [ ] Cerrar el túnel `cloudflared` de pruebas y limpiar datos `ZZ-PRUEBA` de la demo.

## 5. IA y costos

- [ ] `OPENAI_API_KEY` puesta en el servidor de producción solo como variable de entorno.
- [ ] Decidir qué IA se activa: `voucher_ia_activo` (lectura de vouchers, sin tope de gasto), `chatbot_ia_activo` (dudas del bot) y `ayuda_ia_activo` (ayuda de Capri). Cada una tiene su interruptor y empieza apagada.
- [ ] Revisar el consumo del mes en Configuración y fijar una alerta de gasto en la cuenta de OpenAI (los vouchers no tienen tope).
- [ ] La IA **nunca aprueba pagos, reservas, cambios ni documentos**: Caja o Administrador decide siempre.

## 6. Operación del local

- [ ] **Etiquetera real** probada en la PC de Caja (calibración de etiquetas, contraste, fin de papel, USB): llave del agente, `probar` y `volcar` (RB-CAP-010). Aún no probada con equipo físico.
- [ ] Capacitación del equipo: Caja (aprobar o rechazar vouchers, cierre con vouchers por revisar), mozos (foto obligatoria del voucher) y administradores (alertas por WhatsApp).
- [ ] Aprobación de Kevin del diseño de Capri y del texto de los avisos.
- [ ] Probar con los datos reales: un pedido de cada tipo (recojo, delivery, mesa), pago digital con voucher, reserva y reclamo.

## 7. Pruebas finales (go/no-go)

- [ ] Suites completas en verde (API y web) y compilación de producción.
- [ ] Arranque real de la API compilada, sin ciclos de módulos.
- [ ] Pruebas e2e de delivery y de roles (pendientes de ampliar).
- [ ] Prueba de los avisos de producción: voucher sin revisar a los 5 y 15 minutos llega por WhatsApp a un administrador confirmado.
- [ ] Decisión go/no-go con el dueño y plan de vuelta atrás (REL-CAP-001, RB-CAP-001).
