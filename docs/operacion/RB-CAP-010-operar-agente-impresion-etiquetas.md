---
id: RB-CAP-010
tipo: runbook
titulo: "Runbook: operación y mantenimiento del agente local de impresión de etiquetas TSPL2"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-27
relacionados: [RB-CAP-003, INV-CAP-001, PCN-CAP-001]
tags: [runbook, impresion, etiquetas, tspl2, agente-local, caja, hardware]
---

# RB-CAP-010 — Operación y mantenimiento del agente local de impresión de etiquetas TSPL2

| Campo | Valor |
|---|---|
| Cuándo usarlo | Para poner en marcha, monitorear o diagnosticar el servicio de impresión de etiquetas térmicas en la PC de Caja de la cafetería Caprichos |
| Tiempo esperado | Instalación y alta de servicio: 10 a 15 minutos · Diagnóstico o reinicio de servicio: menos de 2 minutos |
| Quién lo ejecuta | Personal técnico o cajero con acceso a la consola de la PC de Caja |
| Riesgo | Medio: si el agente no corre, las comandas no se imprimen en sticker físico (aunque permanecen visibles en las pantallas de Cocina) |
| Documentación técnica | [README del Agente Local](../../apps/agente-local/README.md) |

---

## 1. Arquitectura y flujo de impresión

El sistema de impresión utiliza un modelo desacoplado mediante una cola en base de datos (`print_job`) para que la carta web, el chatbot y las comandas de mozo nunca dependan de la red local ni del estado de la impresora.

```
┌────────────────────────────────────────────────────────┐
│             NUBE / SERVIDOR (API NESTJS)               │
│                                                        │
│  [Carta Web] [Mozo] [WhatsApp] [Caja]                  │
│       │        │        │        │                     │
│       ▼        ▼        ▼        ▼                     │
│  Encolan trabajo en tabla `print_job` (Estado: PENDIENTE)
│       ▲                                                │
└───────┼────────────────────────────────────────────────┘
        │ Polling seguro cada 3s (Bearer AGENTE_KEY)
        │ FOR UPDATE SKIP LOCKED
┌───────┴────────────────────────────────────────────────┐
│             PC DE CAJA (LOCAL CAPRICHOS)               │
│                                                        │
│  Agente Local Node.js (`apps/agente-local`)           │
│  - Generador TSPL2 nativo (Windows-1252)               │
│  - Envío directo al nodo `/dev/usb/lp0`                │
│  - Latido periódico cada 20s (Estado de hardware)     │
│       │                                                │
│       ▼ Conexión USB directa                           │
│  Impresora Térmica 4BARCODE 4B-2054TH                  │
│  (Etiquetas 63.5 mm x 101.6 mm / 2.5" x 4")            │
└────────────────────────────────────────────────────────┘
```

> [!WARNING]
> **ESTADO DE PRUEBAS DE HARDWARE:**
> La generación del código TSPL2, la cola transaccional atómica, las pruebas unitarias y el volcado a archivos están 100% implementados y verificados. Sin embargo, **el sistema NO ha sido probado aún con la etiquetera física real conectada** en el local de Caprichos. Toda puesta en marcha inicial debe validar primero la calibración del rollo de papel.

---

## 2. Tipos de etiqueta generados (Diseño 1 Vertical)

El sistema genera automáticamente tres clases de etiquetas en formato TSPL2 puro:

1. **Etiqueta General de Pedido:**
   - Marco doble exterior, cabecera negra invertida con nombre del negocio, número de comanda (`PED-101`), tipo de entrega (`MESA 4`, `DELIVERY` o `RECOJO`), lista compacta de productos y pie de página con fecha/hora.
2. **Etiqueta por Área (Cocina / Barra):**
   - Encabezado destacado del área (`COCINA`), correlativo del área, lista de productos asignados y notas de preparación destacadas.
3. **Etiqueta por Vaso de Bebida:**
   - Diseñada especialmente para bebidas (`FRAPPES`, `ICED`, `FROZEN`, `CALIENTES`).
   - Muestra el **Nombre Protagonista** del comensal en tamaño gigante, el producto, personalizaciones y recuadro de advertencia `CONTIENE`.

---

## 3. Puesta en marcha inicial en la PC de Caja

### Requisitos previos:
- PC de Caja con Linux (Ubuntu/Debian) encendida permanentemente.
- Cable USB de la impresora conectado a la PC.
- Usuario operativo `caja` o similar agregado al grupo `lp`:
  ```bash
  sudo usermod -a -G lp $USER
  ```

### Procedimiento:
1. Clonar el repositorio y compilar los paquetes:
   ```bash
   git clone <url-del-repo> /home/caja/caprichos
   cd /home/caja/caprichos
   pnpm install
   pnpm --filter @caprichos/compartido build
   pnpm --filter @caprichos/agente-local build
   ```

2. Generar la llave de dispositivo (`DeviceKey`):
   - Entrar al panel administrativo de Caprichos como Administrador: `/admin/configuracion`.
   - Generar una nueva llave de dispositivo tipo **AGENTE** para la PC de Caja y copiar el token secreto.

3. Crear el servicio de sistema `systemd` en `/etc/systemd/system/caprichos-agente.service`:
   ```ini
   [Unit]
   Description=Caprichos - Agente Local de Impresion TSPL2
   After=network.target

   [Service]
   Type=simple
   User=caja
   WorkingDirectory=/home/caja/caprichos/apps/agente-local
   Environment="NODE_ENV=production"
   Environment="API_URL=https://api.caprichos.pe"
   Environment="AGENTE_KEY=token_secreto_generado_en_paso_2"
   Environment="IMPRESORA_RUTA=/dev/usb/lp0"
   Environment="INTERVALO_CONSULTA_MS=3000"
   Environment="INTERVALO_LATIDO_MS=20000"
   ExecStart=/usr/bin/node dist/index.js
   Restart=always
   RestartSec=5
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```

4. Habilitar y arrancar el servicio:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable caprichos-agente.service
   sudo systemctl start caprichos-agente.service
   ```

---

## 4. Diagnóstico y comandos de prueba

Para validar el funcionamiento del agente sin imprimir pedidos de clientes:

### A. Prueba de impresión física (3 etiquetas de muestra):
Envía 1 etiqueta general, 1 de cocina y 1 de vaso con datos de prueba:
```bash
cd /home/caja/caprichos
pnpm --filter @caprichos/agente-local probar
```

### B. Modo de volcado a archivo (sin gastar papel):
Genera los archivos `.tspl` en la carpeta `./etiquetas-tspl/`:
```bash
pnpm --filter @caprichos/agente-local volcar
```
Permite inspeccionar los comandos TSPL2 brutos o abrirlos en simuladores en línea.

### C. Verificar el estado del servicio:
```bash
sudo systemctl status caprichos-agente.service
```

### D. Ver registros de ejecución en vivo:
```bash
journalctl -u caprichos-agente.service -f
```

---

## 5. Operación diaria y reimpresión desde el panel

En el panel administrativo (`/admin/pedidos`):
1. **Pestaña Etiquetas:** Al abrir cualquier comanda, la pestaña *Etiquetas* muestra la vista previa fiel de las tres clases de etiquetas con los datos reales del pedido.
2. **Reimpresión de emergencia:** Si un sticker se atascó, se dañó o se terminó el papel durante una comanda, el cajero puede presionar el botón **Reimprimir etiquetas**.
3. **Confirmación obligatoria:** Por seguridad para no desperdiciar insumos térmicos, la acción exige siempre una **confirmación Sí/No** en pantalla antes de reencolar el trabajo en `print_job`.

---

## 6. Resolución de problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Permiso denegado al escribir en `/dev/usb/lp0` | El usuario no pertenece al grupo `lp` | Ejecutar `sudo usermod -a -G lp $USER` o configurar la regla udev permanente según la sección 3 del README del agente. |
| El agente reporta error 401 Unauthorized | La variable `AGENTE_KEY` es incorrecta o expiró | Generar una nueva llave de dispositivo tipo `AGENTE` en el panel administrativo y actualizar `/etc/systemd/system/caprichos-agente.service`. |
| La impresora parpadea en rojo y no avanza | Fin de rollo o descalibración del sensor de etiquetas | Recargar el rollo y mantener presionado el botón de alimentación (*feed*) de la 4BARCODE durante 3 segundos hasta escuchar dos pitidos para autocalibrar el salto de etiqueta. |
| Las etiquetas salen desfasadas o cortadas a la mitad | Tamaño de etiqueta configurado diferente al rollo físico | Validar que el rollo colocado sea de 63.5 mm x 101.6 mm (2.5" x 4"). El generador TSPL2 asume esta dimensión fija. |
