---
id: ADR-012
tipo: adr
titulo: "Archivos en el VPS, copias de seguridad y vigilancia del sistema"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, DT-31, DT-35, DT-44, DT-45, DT-46, DT-47, RNF-CAP-003, RNF-CAP-008]
tags: [adr, copias, vigilancia, archivos, g3]
---

# ADR-012: Archivos en el VPS, copias de seguridad y vigilancia del sistema

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

Hay pocas fotos (40 a 50 de productos, novedades y destacadas) y un comprobante de pago por cada pago con Yape, Plin o transferencia. El Auto Backup del VPS no protege si falla el proveedor. Para el piloto, José eligió una vigilancia simple y dejar Grafana para después (DT-31, DT-35, DT-44 a DT-47).

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** archivos en el disco del VPS (fotos públicas optimizadas, comprobantes privados), **copia diaria cifrada con restic** fuera del VPS, **Uptime Kuma**, **GlitchTip** y registros JSON; Grafana, Loki y Prometheus después del piloto | — | Que crezcan mucho las fotos (entonces, R2) o que haga falta historial de métricas. |
| Fotos en Cloudinary | Una cuenta más para pocas fotos; no apta para comprobantes. | Muchas fotos o transformaciones a demanda. |
| Solo el Auto Backup del VPS | Si el proveedor falla, se pierde todo. | Ninguno. |
| Grafana, Loki y Prometheus desde el inicio | Más piezas que mantener antes de tener tráfico real. | Después del piloto. |

## Decisión

1. **Archivos**: `/data/uploads/publico` (fotos; al subir se reducen a 1200 px y se pasan a WebP con sharp; se sirven con caché larga detrás de Cloudflare) y `/data/uploads/privado` (comprobantes de pago; solo por la API con autorización, ADR-005). Límite de 5 MB por archivo y solo imágenes.
2. **Copias**: cada día a las 03:00 de Lima, `pg_dump` de cada base más las dos carpetas, cifrado con **restic** y enviado a Backblaze B2 o Cloudflare R2; se guardan 30 diarias y 6 mensuales. Se suman al Auto Backup y al snapshot del proveedor. Cada 3 meses se prueba restaurar en pruebas (DT-47).
3. **Uptime Kuma**: revisa cada minuto la carta, la API (`/salud`), el WebSocket, el webhook de WhatsApp, el agente de impresión (último latido) y la copia del día; avisa por Telegram o WhatsApp.
4. **GlitchTip** (compatible con Sentry) en el VPS: errores de la API, el front y el bot, con filtro de DNI, teléfonos y tokens.
5. **Registros**: JSON con pino, con el identificador de solicitud y de pedido, rotados por Docker; se leen en Dokploy. Grafana, Loki y Prometheus quedan para después del piloto (DT-46) sin cambiar código.
6. **Mantenimiento**: parches de seguridad automáticos (Ansible), Renovate para dependencias e imágenes, Trivy en el CI.

## Consecuencias

- Obliga a:
  - Crear la cuenta de almacenamiento de copias (B2 o R2) y guardar la clave de restic fuera del VPS.
  - Revisar los avisos de Uptime Kuma y GlitchTip.
- Impide:
  - Subir videos al servidor (las novedades usan enlaces, FT-CON-03).
- Cuesta:
  - GlitchTip ~0,5 GB y Uptime Kuma ~0,1 GB de RAM; almacenamiento de copias en centavos al mes.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: menos de US$ 1 al mes en almacenamiento de copias.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: `archivo` (ruta, tipo, tamaño, público o privado, dueño del registro).
- Linaje: subidas desde el administrativo (fotos) y desde caja o el bot (comprobantes). **Sensible:** comprobantes de pago (ADR-005).
- Reglas de calidad: copia diaria verificada (Uptime Kuma); prueba de restauración trimestral.

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (DT-31, DT-35, DT-44, DT-45, DT-46, DT-47) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL
