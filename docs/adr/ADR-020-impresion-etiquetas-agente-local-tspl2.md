---
id: ADR-020
tipo: adr
titulo: "Impresión de etiquetas de vasos y empaques con agente local y protocolo TSPL2"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-27
relacionados: [ADR-002, ADR-007, ADR-008, ADR-013]
tags: [adr, impresion, etiquetas, agente-local, tspl2, usb, 4barcode]
---

# ADR-020: Impresión de etiquetas de vasos y empaques con agente local y protocolo TSPL2

- **Estado:** borrador (draft — la IA propone; aprueba y firma el líder técnico)
- **Amplía:** A **ADR-002** (Impresión con agente local ESC/POS), formalizando la arquitectura específica para impresión térmica de etiquetas autoadhesivas en envases mediante el protocolo TSPL2 y la cola de base de datos `print_job`.
- **Fecha:** 2026-10-27

---

## 1. Contexto

En el servicio de cafetería de Caprichos, cada pedido (ya sea solicitado desde la carta web, la mesa mediante mozo, la caja o el bot de WhatsApp) incluye productos personalizados (como frappés, bebidas frías o calientes con leches vegetales, jarabes o endulzantes especiales) que requieren etiquetado autoadhesivo inmediato en el vaso o empaque para evitar errores en barra y despacho.

En ADR-002 se adoptó un agente local para impresión de comandas térmicas continuas por protocolo ESC/POS. No obstante, la adquisición de la etiquetera física para la estación de Caja (**4BARCODE 4B-2054TH**, con etiquetas adhesivas troqueladas de 63.5 mm x 101.6 mm en formato vertical "Diseño 1") requería un tratamiento especializado:
1. Las impresoras de etiquetas autoadhesivas no emplean el flujo de texto continuo de ESC/POS, sino lenguajes de control de coordenadas bidimensionales (TSPL / TSPL2) para calibración de espaciado (*GAP*), densidad térmica y delimitación física por etiqueta.
2. Un navegador web estándar no puede enviar comandos binarios directos a un puerto USB de forma silenciosa e independiente de la sesión del usuario.
3. Se requería desacoplar totalmente a los clientes móviles y la API en la nube del hardware de la PC de Caja, permitiendo que cualquier canal encole trabajos sin riesgo de bloqueo si la impresora se queda sin papel o está apagada.

---

## 2. Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
|---|---|---|
| **Elegida:** **Cola en base de datos (`print_job`) en el servidor + Agente daemon en Node.js en PC de Caja con generador TSPL2 y conexión USB directa** | — | Adquisición de etiqueteras industriales Ethernet nativas compatibles con colas directas en la nube. |
| **Generación de documentos PDF y diálogo de impresión del navegador** | Bloquea la pantalla de Caja, exige confirmación manual en cada vaso, es incapaz de respetar márgenes térmicos milimétricos y no funciona en pedidos online o de WhatsApp. | Operación manual de muy bajo volumen (menos de 5 pedidos diarios). |
| **Controlador de impresión del sistema operativo (CUPS en Linux / Spooler Windows)** | Driver frágil ante actualizaciones, propenso a desconfiguración de márgenes en papel troquelado y difícil de supervisar de forma remota desde la API. | Si existiera soporte oficial y garantizado del fabricante para Linux sin controladores binarios propietarios. |
| **Emulación ESC/POS en la etiquetera** | La etiquetera 4BARCODE 4B-2054TH no responde adecuadamente a ESC/POS en papel autoadhesivo troquelado; produce avances de papel erráticos y pérdida de calibración del sensor GAP. | Uso exclusivo de rollos continuos de papel sin troquel autoadhesivo. |

---

## 3. Decisión

1. **Cola de Impresión Desacoplada en el Servidor (`print_job`):**
   - Implementada en `apps/api/src/modulos/impresion/` y respaldada por la tabla `print_job` (migración `20261027120000_print_job_etiquetas`).
   - Los pedidos que ingresan por salón, carta web, WhatsApp o caja encolan automáticamente sus etiquetas correspondientes sin consultar la disponibilidad física de la impresora.
   - El encolamiento es estrictamente idempotente: una clave única previene generar etiquetas duplicadas ante reintentos o confirmaciones concurrentes.
   - Ciclo de vida del trabajo: `PENDIENTE` -> `EN_PROCESO` -> `IMPRESO` (o `FALLIDO`).

2. **Agente Local Autónomo en la PC de Caja (`apps/agente-local`):**
   - Proceso daemon desarrollado en Node.js que se ejecuta en segundo plano en la PC de Caja conectada físicamente a la etiquetera por cable USB.
   - **Autenticación robusta de dispositivo:** Se comunica con la API mediante la cabecera `Authorization: Bearer <llave>` validada contra la entidad `DeviceKey` (tipo `AGENTE`). Nunca utiliza credenciales de usuario ni tokens JWT interactivos.
   - **Adquisición atómica de trabajos:** Consulta periódica (`POST /api/agente-impresion/tomar` cada 3 s) utilizando transacciones con bloqueo de fila (`FOR UPDATE SKIP LOCKED`), asegurando que ningún trabajo se procese por duplicado.
   - **Reporte de resultados y telemetría de salud:**
     - `POST /api/agente-impresion/resultado`: confirma la impresión exitosa o reporta el motivo técnico del fallo sin perder el registro.
     - `POST /api/agente-impresion/latido` (cada 20 s): notifica a la API el estado del dispositivo (`lista`, `sin_papel`, `desconectada`, `error`).
   - **Tolerancia a cortes de red:** Ante caídas de internet en el local, el agente aplica retroceso exponencial (*exponential backoff*) y reanuda el vaciado de la cola automáticamente al restablecerse la conectividad.

3. **Generador TSPL2 en Memoria (`apps/agente-local/src/tspl/`):**
   - Construcción binaria pura de comandos TSPL2 con codificación Windows-1252 para admitir tildes, virgulillas (ñ) y caracteres especiales en español.
   - Implementa tres formatos del "Diseño 1" vertical (etiqueta de 63.5 mm x 101.6 mm):
     a) **Etiqueta general del pedido:** resumen de cabecera, cliente, canal y relación de productos.
     b) **Etiqueta por área:** desglose específico para barra o cocina caliente.
     c) **Etiqueta individual por bebida o envase:** nombre del cliente, tipo de bebida (frappé, iced, frozen, caliente), personalización de envase, opciones elegidas e indicaciones especiales.

4. **Escritura a Dispositivo USB y Entornos de Prueba:**
   - **Modo físico real:** Escritura directa al nodo de dispositivo `/dev/usb/lp0` en Linux mediante permisos del grupo de sistema `lp` y reglas `udev` persistentes (`99-etiquetera-4barcode.rules`).
   - **Modo simulado / prueba:** Soporte para emulación en memoria (`impresoraMemoria.ts`) y volcado de comandos a archivo (`--volcar-archivo`).
   - **Condición operativa pendiente:** La lógica de generación TSPL2 y la gestión de cola han sido verificadas exhaustivamente mediante pruebas unitarias e integración en memoria; la validación final con el hardware físico de la etiquetera 4BARCODE conectada en el local se completará en la puesta en marcha en sitio.

5. **Supervisión y Reimpresión desde el Panel Web:**
   - Tarjeta informativa `TarjetaImpresionEtiquetas` en los módulos de Caja y Configuración local para auditar el estado del agente y los trabajos en cola.
   - En la vista de pedidos, la pestaña de etiquetas permite solicitar la reimpresión de cualquier trabajo mediante confirmación obligatoria con diálogo Sí/No, marcando la nueva etiqueta con la leyenda destacada `COPIA`.

---

## 4. Consecuencias

### Positivas
- **Impresión silenciosa y sin intervención:** El personal de caja no pierde tiempo abriendo cuadros de diálogo ni seleccionando impresoras.
- **Independencia de canal:** Los pedidos de WhatsApp y la carta en línea imprimen sus etiquetas en caja de manera completamente desatendida.
- **Precisión milimétrica:** El control nativo en TSPL2 garantiza que el texto y códigos encajen perfectamente en las etiquetas troqueladas sin descalibrar el cabezal térmico.
- **Resiliencia ante apagados:** Si la PC de Caja se apaga o la impresora se queda sin rollo, los trabajos quedan encolados en `PENDIENTE` y se imprimen secuencialmente al encenderse el equipo.

### Negativas / Mitigaciones
- **Dependencia de la PC de Caja encendida:** La impresión física no ocurre si la PC de Caja está apagada. *Mitigación:* Los trabajos no se pierden; la cola en base de datos retiene los trabajos pendientes indefinidamente hasta que el agente reporte latido activo.
- **Configuración de permisos en Linux:** El usuario de sistema de la PC de Caja requiere pertenecer al grupo `lp`. *Mitigación:* Documentado en el manual de operación con script de reglas `udev` para autoconfiguración.

---

## 5. Datos (Gobierno de Datos - Puerta F4)

- **Entidades afectadas:** Tabla `print_job` y tabla de autenticación de periféricos `device_key`.
- **Privacidad y Ley 29733:**
  - Las etiquetas solo imprimen el nombre de pila o apodo del cliente y el detalle de su pedido; nunca imprimen números de DNI, datos de pago bancario, direcciones completas ni contraseñas.
- **Retención:**
  - Los trabajos completados en `print_job` se conservan durante el turno diario para permitir reimpresiones inmediatas y se depuran en las rutinas de mantenimiento nocturno.

---

*Generado por IA: Borrador formal según especificación de docs-contrato.txt y directrices del proyecto Caprichos — Revisado por: (pendiente) — Aprueba: Technical Lead*
