---
id: CFG-CAP-001
tipo: analisis
titulo: Configuración centralizada del local (una sola fuente de datos)
estado: draft
producto: caprichos
version: "0.1"
owner: "José Ángel Espinoza (desarrollo); validación pendiente de Kevin Rosales"
aprobadores: []
fecha: 2026-10-17
relacionados: [BRD-CAP-001]
tags: [configuracion, mockup, etapa-siguiente]
---

# Configuración centralizada del local

**Regla:** todo dato del negocio que el cliente ve o que el sistema usa se escribe **una sola vez** en el administrativo, en **Configuración del local**, y se refleja solo en la carta virtual, el chatbot y el resto del administrativo. Si cambia el teléfono, el horario o una red social, no hay que tocar nada más.

Estado: borrador. La IA propone; el humano aprueba. Los datos del mockup son de ejemplo.

## 1. Qué dato se edita dónde y quién lo usa

| Dato | Dónde se edita (Configuración del local) | Dónde se usa |
| :-- | :-- | :-- |
| Nombre, lema, descripción, distrito, barrio | Datos del local | Cabecera y pie de la carta, Conócenos, chatbot (nombre), vista previa del diseño |
| Dirección, referencia, enlace del mapa | Ubicación | Conócenos, pie, chatbot ("¿Dónde están ubicados?") |
| Teléfono y WhatsApp | Contacto | Conócenos, pie, botones de WhatsApp, chatbot |
| Horario de cada día (abierto o cerrado, abre, cierra) | Horario y fechas | Cabecera ("Abierto hasta…" o "Cerrado hoy"), Conócenos, pie, chatbot, horas de reserva |
| Fechas especiales (feriados, otro horario) | Horario y fechas | Igual que el horario; el día especial manda sobre el horario normal |
| Instagram, Facebook, TikTok | Redes sociales | Conócenos y pie |
| Yape, Plin, cuenta para transferir | Pagos | Pago de la carta y chatbot |
| Envío gratis desde, pedido mínimo | Entrega | Carrito y pie |
| Correo del dueño y grupo de WhatsApp del equipo | Avisos | Quejas del chatbot y de la carta |
| Razón social, RUC, dirección fiscal | Empresa | Comprobantes |
| Fotos del local (6 espacios) | Fotos del local | Conócenos (galería "Nuestro lugar") |

## 2. Lo que no se centraliza aquí (y por qué)

- **Teléfonos de clientes y de proveedores:** son datos de cada pedido, cliente o proveedor, no del local.
- **Cupones, promociones y combos:** Ofertas y descuentos.
- **Crédito del personal (porcentaje y plazo):** Créditos del personal.
- **Textos de la conversación del chatbot (persona Capri):** quedan en el diseño del chatbot; solo sus datos (nombre, ubicación, horario, pagos) vienen de la configuración.

## 3. Para la etapa siguiente (cuando aprueben el mockup)

- Una sola entidad "configuración del local" en la base de datos, con historial de cambios (quién y cuándo) y permiso solo para el administrador.
- La carta, el chatbot, las pantallas de cocina y el administrativo la leen por API; no se copian valores en el código.
- Cada cambio pide confirmación Sí/No y queda en auditoría.
- Las fotos van a un almacenamiento de archivos, no al navegador.
- Validar con Kevin: lista final de campos, horarios reales, números reales y qué redes se muestran.

## 4. Estado en el mockup (versión 65 del artifact)

Centralizado y probado: nombre, ubicación, contacto, horario por día con fechas especiales, redes, pagos, entrega, fotos del local. Probado solo en navegador de pruebas; el chatbot lee la configuración al abrirse.
