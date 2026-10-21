---
id: ANA-CAP-033
tipo: analisis
titulo: "Impresión de tickets al aceptar un pedido (análisis técnico)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, analisis]
---

# Impresión de tickets al aceptar un pedido (análisis técnico)

> Borrador para revisión, por confirmar con Kevin. La decisión de arquitectura se formaliza después en un ADR (T3). Este análisis responde: ¿a qué se vincula la ticketera y cómo se conecta?

## 1. Requisito de negocio
Cuando caja **acepta** un pedido (carta web, chatbot, mesa o teléfono), se imprime sola la comanda en la ticketera de cocina, sin que nadie pulse "imprimir". Si hay delivery pagado, puede imprimirse además una copia para despacho. Si la impresión falla, caja debe enterarse y poder **reimprimir**.

## 2. Cómo lo hace hoy restaurant.pe (observado, solo lectura)
Del análisis de Ajustes > Impresoras (`legacy/web-anterior/administrativo/modulos/ajustes-a.md`):
- Un **servicio instalado en una PC Windows** del local (`PrinterRestaurant.PE`, `ServicioV5.msi`) recibe las órdenes del sistema y las manda a la impresora.
- La ticketera se registra con **nombre, IP fija, MAC, tipo de conexión** (red con socket directo **TCP puerto 9100**, USB/driver de Windows, serial) y **ancho de papel** (58 mm = 42 columnas; 80 mm = 48 columnas). Envía comandos **ESC/POS** sin pasar por el spooler de Windows. Algunas disparan la gaveta de dinero.
- Se enrutan por **área de producción** (cocina, barra), por **caja y tipo de comprobante** y por **estación de precuenta**. Hay botón **Probar** (ticket de calibración) y alerta "Error de impresora".

## 3. El problema técnico
Un sistema web en la nube **no puede** abrir una conexión TCP a `192.168.1.201:9100`: esa IP es de la red interna del local y el navegador no permite sockets crudos. Hace falta algo **dentro del local** que haga de puente.

## 4. Opciones

| Opción | Cómo funciona | Pros | Contras |
| :-- | :-- | :-- | :-- |
| **A. Agente local de impresión** (recomendada) | Un programa pequeño en una PC del local (puede ser la de caja) se conecta hacia la nube, recibe cada comanda y la envía por **TCP 9100 (ESC/POS)** a la IP de la ticketera. | Funciona con casi cualquier ticketera térmica de red; es lo que usa restaurant.pe; permite varias impresoras y reimprimir. | Requiere una PC encendida en el local y mantener el programa. |
| **B. Impresión en la nube** (Epson Server Direct Print, Star CloudPRNT) | La ticketera consulta cada pocos segundos a una URL del sistema y se imprime sola. | No necesita PC; menos piezas. | Solo en modelos compatibles; hay que verificar la marca y modelo. |
| **C. Imprimir desde el navegador** | Diálogo del navegador, WebUSB o Bluetooth. | Cero instalación. | No es automática o pide permiso cada vez; poco fiable para comandas de cocina. |
| **D. Servidor local en el local** | Todo el sistema corre en una PC del local. | Imprime directo por red. | Contradice el objetivo de un sistema web unificado; sin acceso remoto sencillo. |

**Recomendación:** A, o B si el modelo de ticketera la soporta. En ambos casos el sistema guarda la ticketera de cada área y decide a cuál va cada comanda.

## 4.1 Situación del local (por confirmar)
Según lo conversado, hay **una sola computadora en caja** donde se cobra, se registra la compra y está la ticketera. Eso encaja con la opción A: el agente local de impresión corre en **esa misma PC**, así no hace falta equipo extra. Si la ticketera está en la cocina y no en caja, se conecta por red a esa PC o se evalúa la opción B.

## 5. Respuesta corta a las preguntas
- **¿Se usa TCP?** Sí, en la opción A: el agente local abre una conexión TCP al **puerto 9100** de la ticketera (impresión directa "raw") y envía comandos ESC/POS. En la B no, la impresora consulta por HTTP.
- **¿Qué se conecta a la ticketera?** Una computadora del local en la misma red (opción A) o la propia ticketera hacia internet (opción B). La web nunca se conecta directo.
- **¿A qué se vincula?** A un área de producción (cocina, barra) y a una caja; por cada una se elige la impresora.

## 6. Qué se imprime
- **Comanda de cocina:** código del pedido, hora, modalidad, cliente o mesa, dirección y referencia si es delivery, productos con tamaño y opciones, nota para cocina y total. Ver el mockup (detalle del pedido > "Ticket impreso").
- **Etiquetas adhesivas** (reunión del 18/10): general del pedido, una por área (cada área en su etiquetera) y una por bebida con lo que contiene, para pegar dentro del vaso. Ver el mockup (detalle del pedido > Etiquetas). Hay una etiquetera por área, parecida a la ticketera de resumen pero de stickers.
- **Copia de despacho** (delivery): con dirección y medio de pago.
- **Prueba de impresión** al registrar la impresora.
- *Fuera de alcance:* boleta o factura electrónica (SUNAT), que se mantiene fuera del sistema nuevo según el BRD.

## 7. Comportamiento esperado
1. Caja acepta el pedido, y el sistema crea la orden de impresión.
2. El agente (o la ticketera) la toma e imprime en menos de unos segundos.
3. Si no hay respuesta, queda una **alerta "Error de impresora"** en notificaciones y el pedido **no se pierde**: sigue en la pantalla de cocina y se puede reimprimir.

## 8. Preguntas para Kevin
1. ¿Qué ticketera(s) tienen, marca y modelo? ¿Cuántas (cocina, barra, caja)?
2. ¿Ancho de papel: 58 mm o 80 mm? ¿Conexión: red (cable o Wi-Fi), USB o Bluetooth?
3. ¿Hay una PC siempre encendida en el local? ¿Con qué sistema operativo?
4. ¿Se imprime solo cocina, o también barra y una copia de delivery?
5. ¿Imprimir el ticket del cliente (precuenta) o solo la comanda?
6. ¿Abren la gaveta de dinero desde la ticketera?

---
Generado por IA a partir del análisis de restaurant.pe y el prototipo — Revisado por: (pendiente)
