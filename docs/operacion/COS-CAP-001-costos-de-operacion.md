---
id: COS-CAP-001
tipo: costos
titulo: "Costos de operación de Caprichos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, ADR-009, ADR-010, ADR-011, ADR-012, DT-30, DT-31, DT-33, DT-34, DT-42, D-08, D-20, INV-CAP-001, REL-CAP-001]
tags: [costos, operacion, devops]
---

# COS-CAP-001 — Costos de operación de Caprichos

> Documento para que Kevin y José sepan **cuánto cuesta mantener el sistema** y qué se puede pasar de lo previsto. Los precios son **aproximados**, tomados de lo que se conoce a octubre de 2026, y deben **confirmarse en la página de cada proveedor** antes de contratar. No incluye el trabajo de desarrollo (las horas de José).

## 1. Resumen

| | Bajo | Medio | Alto |
|---|---|---|---|
| Pedidos de la carta o del bot al día | 10 | 30 | 80 |
| Dudas al bot de IA al día | 30 | 100 | 300 |
| **Costo fijo mensual** (VPS y copias; el dominio ya está pagado) | US$ 9.70 | US$ 9.70 | US$ 9.70 |
| Costo variable mensual (WhatsApp + IA) | US$ 6.90 | US$ 21.00 | US$ 57.00 |
| **Total mensual** | **US$ 16.60** | **US$ 30.70** | **US$ 66.70** |
| En soles (S/ 3.70 por US$) | S/ 61 | S/ 114 | S/ 247 |
| **Total anual** | US$ 176.04 | US$ 345.24 | US$ 777.24 |
| Costo por pedido de la carta o del bot | S/ 0.18 | S/ 0.12 | S/ 0.10 |

**Lectura:** lo más probable para el piloto es el escenario **Bajo a Medio**: entre **S/ 61 y S/ 114 al mes**. El costo fijo no cambia aunque haya más pedidos; lo que sube es WhatsApp.

## 2. Supuestos

| Supuesto | Valor | Dónde se cambia |
|---|---|---|
| Tipo de cambio | S/ 3.70 por US$ (supuesto) | Esta tabla |
| Plantilla de WhatsApp iniciada por el negocio | ~US$ 0.02 cada una (por confirmar con la calculadora de Meta, D-08) | D-08 |
| Mensajes por pedido de la carta | 1 plantilla: el primer mensaje del bot (RN-CAP-100). Lo demás ocurre dentro de las 24 h de respuesta del cliente y es gratis | RN-CAP-100 |
| Costo de IA por consulta | ~US$ 0.001 (modelo pequeño; por confirmar con el modelo elegido) | ADR-009 |
| Dominio `caprichos.pe` | **Ya pagado por 2 años.** Renovación después: ~US$ 36 al año (supuesto; confirmar en punto.pe) | INV-CAP-001 |
| Copias fuera del VPS | ~US$ 0.50 al mes pasados los 10 GB gratis (confirmar con B2 o R2) | ADR-012 |

## 3. Costos fijos mensuales

| Servicio | Para qué | Cómo cobra | Mensual |
|---|---|---|---|
| **VPS** Contabo Cloud VPS 6 (6 vCPU, 12 GB, 200 GB SSD, 2 snapshots), región EE. UU. Central, sin Auto Backup; contratado por 1 mes de prueba | Todo el sistema | Fijo | US$ 9.20 |
| **Dominio** `caprichos.pe` (punto.pe) | Dirección de la carta y del administrativo | **Pagado por 2 años** | US$ 0.00 (ya pagado) |
| **Copias** fuera del VPS (Cloudflare R2 o Backblaze B2) | Copia diaria de la base y las carpetas | Por GB al mes | ~US$ 0.50 |
| **Total fijo** | | | **US$ 9.70** (S/ 36) |

Cuando se cumplan los 2 años, el dominio vuelve a costar alrededor de **US$ 36 al año** (US$ 3 al mes si se reparte). Conviene guardar esa cifra para el presupuesto de 2028 y poner un recordatorio de renovación 90 días antes del vencimiento (PCN-CAP-001, escenario E16).

## 4. Costos variables

| Servicio | Qué cobra | Fórmula | Bajo | Medio | Alto |
|---|---|---|---|---|---|
| **WhatsApp Cloud API** (Meta) | Una plantilla por cada pedido de la carta que el bot inicia | pedidos al día × 30 × US$ 0.02 | US$ 6.00 | US$ 18.00 | US$ 48.00 |
| **OpenAI** (modelo pequeño) | Cada duda o «Pulir mensaje» | dudas al día × 30 × US$ 0.001 | US$ 0.90 | US$ 3.00 | US$ 9.00 |
| **Google Maps** (búsqueda de direcciones) | Solo si se pasa el cupo gratis | Cupo mensual gratis; tope diario configurado | US$ 0 | US$ 0 | US$ 0 |

Un pedido que **empieza el cliente** escribiendo al bot no paga plantilla: se responde dentro de las 24 horas y es gratis. Pagan los pedidos de la **carta**, donde el bot escribe primero.

## 5. Lo que es gratis

### 5.1 Open source (los instalamos nosotros: sin pago)

NestJS, React, Vite, TypeScript, pnpm, PostgreSQL, Prisma, Redis (o Valkey) con BullMQ, Socket.IO, Leaflet y OpenStreetMap, Dokploy, Docker, Ubuntu, UFW, fail2ban, Ansible, Uptime Kuma, GlitchTip, restic, Trivy, Renovate, pino, argon2, sharp y, después del piloto, Grafana, Loki y Prometheus. **Costo: S/ 0**; solo usan la RAM del VPS (unos 4 a 4,5 GB de 8).

### 5.2 Gratis con límites (servicios de una empresa)

| Servicio | Para qué | Límite gratis aproximado | Qué pasa si se pasa |
|---|---|---|---|
| GitHub (repositorio privado) | Código | Ilimitado | — |
| GitHub Actions | CI/CD | 2.000 minutos al mes en privados | Se usan unos 300 a 600; si faltara, centavos por minuto |
| GHCR (imágenes Docker) | Guardar imágenes | ~500 MB en privados | Se borran las imágenes viejas (dejar las últimas 10); si no, centavos por GB |
| Cloudflare (DNS, HTTPS, proxy, caché) | Dominio y protección | Plan gratuito | — |
| Cloudflare Access | Proteger el panel | Hasta 50 usuarios | — |
| Cloudflare R2 o Backblaze B2 | Copias | 10 GB gratis | ~US$ 0,015 a 0,02 por GB al mes extra |
| Google Maps Platform | Búsqueda de direcciones y mapa | Cupo gratis mensual por servicio | Se cobra por consulta; **el tope diario lo corta antes** |
| Telegram | Avisos al celular | Gratis | — |

## 6. Topes y alertas para que no haya sorpresas

| Servicio | Tope o alerta recomendado | Dónde se configura |
|---|---|---|
| OpenAI | Tope mensual de US$ 10; aviso al 80 % | Panel de OpenAI y `uso_externo` (ADR-009) |
| Google Maps | Tope diario de consultas y alerta de presupuesto de US$ 1 | Google Cloud (ADR-010) |
| WhatsApp (Meta) | Aviso interno si el gasto del mes pasa de US$ 30 | Administrativo (`uso_externo`) y panel de Meta |
| VPS | Sin variable: precio fijo | — |
| Copias | Aviso si el repositorio pasa de 20 GB | Uptime Kuma o el proveedor |

## 7. Pagos únicos del local (por cotizar)

Equipos que no son parte del sistema pero hacen falta para el piloto. **No hay precios inventados: se cotizan.**

| Equipo | Para qué | Ya existe | Costo |
|---|---|---|---|
| Ticketeras de comandas (red o USB) | Imprimir en cocina y barra | Por relevar (DEP-03) | *(por cotizar)* |
| Etiqueteras y rollos de etiquetas | Etiquetas por pedido, por área y por bebida | Por relevar (DEP-03) | *(por cotizar)* |
| Papel térmico | Comandas y comprobantes | Sí, hoy se usa | *(consumo mensual por medir)* |
| PC de caja siempre encendida | Agente de impresión | Sí | — |
| Tablets de mozo | Pedidos en mesa | Por confirmar | *(por cotizar)* |
| Pantallas o TV de cocina | Mostrar las comandas | 3 Smart TV (acta 02) | — |
| UPS (respaldo de energía) para router y PC de caja | Seguir trabajando en un corte corto | Por confirmar | *(por cotizar)* |
| Mini servidor del modo sin internet | Operar sin internet (DT-52) | Usa la PC de caja que ya existe; **sin hardware nuevo** | — |

## 8. Lo que Kevin ya paga hoy y podría reemplazarse

| Servicio actual | Qué hace | Se reemplaza por | Ahorro |
|---|---|---|---|
| Carta digital anterior (plan vencido) | Carta | La carta propia | *(por completar con Kevin)* |
| restaurant.pe | Caja y administración | El administrativo; se mantiene un mes para facturar (D-20) | *(por completar con Kevin)* |
| Servidor del bot actual | Chatbot | El módulo de bot del monolito | *(por completar con Kevin)* |
| Facturador electrónico | Boletas y facturas | Se mantiene (DT-11) | — |

## 9. Cuándo revisar estos números

| Señal | Qué hacer |
|---|---|
| Más de 80 pedidos de la carta al día | Revisar el gasto de WhatsApp y evaluar plantillas más baratas o pedir que inicie el cliente |
| RAM del VPS pasa de 6 GB en hora punta | Apagar pruebas fuera de horario; si no alcanza, pasar a un plan mayor del mismo proveedor |
| Copias pasan de 20 GB | Revisar retención (30 diarias y 6 mensuales) o mover las fotos a R2 |
| Un proveedor cambia sus precios | Actualizar este documento y avisar a Kevin |

## 10. Pendientes

- **Dominio ya pagado por 2 años:** anotar en INV-CAP-001 la fecha de vencimiento, a nombre de quién está y cuánto se pagó, para el recordatorio y para este documento.
- **Cuentas a nombre de quién:** Meta, Google Cloud, OpenAI y punto.pe piden tarjeta. Propuesta: a nombre del negocio, con José como administrador (D-08).
- **Precios exactos:** confirmar plantilla de WhatsApp en Perú, dominio `.pe`, plan del VPS y almacenamiento de copias antes de firmar este documento.
- **Cotizar** los equipos de la sección 7.

---

Generado por IA: costos estimados desde DT-30 a DT-47, ADR-009 a ADR-012 y RN-CAP-100; los precios se confirman con cada proveedor — Revisado por: (pendiente)
