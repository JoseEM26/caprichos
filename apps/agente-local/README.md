# Agente Local de Impresión TSPL2 - Caprichos

Agente de fondo en Node.js que corre en la **PC de Caja** de la cafetería Caprichos. Se encarga de consumir de forma atómica los trabajos de impresión encolados por cualquier canal (carta web, cocina, caja, WhatsApp) e imprimirlos físicamente en la etiquetera térmica conectada por USB (**4BARCODE 4B-2054TH**, lenguaje TSPL2, etiquetas de 63.5 mm x 101.6 mm, Diseño 1 vertical).

---

## 1. Arquitectura y Funcionamiento

- **Consumo desacoplado:** Las demás terminales (cocina, mozos, carta web) no buscan impresoras locales ni dependen de la red física. Solamente encolan trabajos en la API del servidor (`print_job`).
- **Autenticación del agente:** Se autentica mediante la cabecera `Authorization: Bearer <llave>` validada contra una entidad `DeviceKey` (tipo `AGENTE`). Nunca usa JWT de personas ni credenciales de usuario.
- **Bucle de alta resiliencia:**
  1. `POST /api/agente-impresion/tomar` (cada 3 s): adquiere trabajos pendientes de forma atómica (`FOR UPDATE SKIP LOCKED`).
  2. Generación pura de TSPL2 en memoria con codificación Windows-1252.
  3. Envío directo al nodo de dispositivo (ej. `/dev/usb/lp0`).
  4. `POST /api/agente-impresion/resultado`: reporta `ok=true` o `ok=false` con el motivo del fallo (sin perder el trabajo ni dejarlo huérfano).
  5. `POST /api/agente-impresion/latido` (cada 20 s): informa si la impresora está `'lista'`, `'sin_papel'`, `'desconectada'` o con `'error'`.
  6. **Resistencia a fallos de red:** si el servidor o internet no responden, el agente no se cae; aplica reintentos con retroceso exponencial (*exponential backoff*) y reanuda solo al volver la conectividad.

---

## 2. Requisitos Previos e Instalación

### Requisitos del Sistema
- **Sistema Operativo:** Linux (Ubuntu, Debian, Linux Mint, etc.) en la PC de Caja.
- **Node.js:** Versión 22.x o 24.x LTS.
- **Gestor de paquetes:** `pnpm` (versión >= 9.x o 12.x).
- **Etiquetera USB:** 4BARCODE 4B-2054TH conectada a un puerto USB de la PC.

### Instalación de dependencias y compilación
En la carpeta raíz del proyecto Caprichos:
```bash
# Instalar dependencias del monorepo
pnpm install

# Compilar paquetes compartidos y el agente
pnpm --filter @caprichos/compartido build
pnpm --filter @caprichos/agente-local build
```

---

## 3. Permisos de Usuario para el Dispositivo USB (`/dev/usb/lp0`)

Por defecto en Linux, los puertos de impresora USB pertenecen al grupo del sistema `lp`. Para que el agente pueda escribir en `/dev/usb/lp0` sin privilegios de `root`:

### Paso 1: Agregar el usuario al grupo `lp`
Ejecutar en la terminal de la PC de Caja:
```bash
sudo usermod -a -G lp $USER
```
*(Es necesario cerrar sesión y volver a entrar o reiniciar la terminal para que surta efecto).*

### Paso 2: Regla `udev` permanente (Recomendado)
Para asegurar que cualquier impresora térmica USB reciba permisos de lectura y escritura al conectarse o reconectarse:

1. Crear el archivo `/etc/udev/rules.d/99-etiquetera-4barcode.rules`:
```bash
sudo nano /etc/udev/rules.d/99-etiquetera-4barcode.rules
```

2. Añadir la siguiente regla:
```udev
SUBSYSTEM=="usbmisc", KERNEL=="lp*", MODE="0666", GROUP="lp"
```

3. Recargar las reglas del sistema udev:
```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

---

## 4. Variables de Entorno

El agente se configura mediante variables de entorno en el sistema o en un archivo de entorno protegido:

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `API_URL` | URL base del servidor backend de Caprichos | `http://localhost:3000` |
| `AGENTE_KEY` | Llave secreta del dispositivo (`DeviceKey`) generada desde el panel administrativo | `""` (requerida para conectar con la API) |
| `IMPRESORA_RUTA` | Ruta al dispositivo de la etiquetera en Linux | `/dev/usb/lp0` |
| `INTERVALO_CONSULTA_MS`| Frecuencia de consulta de nuevos trabajos en milisegundos | `3000` (3 segundos) |
| `INTERVALO_LATIDO_MS` | Frecuencia de envío del latido de salud en milisegundos | `20000` (20 segundos) |
| `MAX_TRABAJOS_LOTE` | Número máximo de trabajos tomados por consulta (1 a 10) | `10` |

---

## 5. Configuración como Servicio de Arranque (`systemd`)

Para que el agente arranque automáticamente al encender la PC de Caja y se reinicie solo en caso de reinicio del sistema:

1. Crear el archivo de unidad `/etc/systemd/system/caprichos-agente.service`:
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
Environment="AGENTE_KEY=tu_llave_de_dispositivo_secreta_aqui"
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

2. Activar e iniciar el servicio:
```bash
sudo systemctl daemon-reload
sudo systemctl enable caprichos-agente.service
sudo systemctl start caprichos-agente.service
```

3. Ver el estado y los registros en tiempo real:
```bash
sudo systemctl status caprichos-agente.service
journalctl -u caprichos-agente.service -f
```

---

## 6. Comandos y Modos de Prueba

El agente incluye comandos específicos para verificar su funcionamiento sin depender del servidor API ni arriesgar papel físico:

### A. Modo Prueba Física (`probar`)
Envía 3 etiquetas completas de ejemplo con datos falsos (1 General de pedido, 1 de Área Cocina y 1 de Vaso Bebida con nombre protagonista) a la etiquetera física conectada:
```bash
pnpm --filter @caprichos/agente-local probar
```
*(Si la impresora no está conectada o no hay permisos, informa diagnósticos claros sin abortos inesperados).*

### B. Modo Volcado a Archivo (`volcar`)
Genera el código TSPL2 puro y lo guarda en archivos `.tspl` en el directorio `./etiquetas-tspl/` para su inspección visual o pruebas con simuladores TSPL:
```bash
pnpm --filter @caprichos/agente-local volcar
```
Archivos generados:
- `etiqueta-general.tspl`: Marco doble, cabecera negra invertida, código PED-101, pill MESA 4, lista de productos y pie.
- `etiqueta-area.tspl`: Cabecera del área (COCINA), índice de área, productos compactos y notas.
- `etiqueta-bebida.tspl`: Nombre protagonista gigante (MARÍA ELENA), bebida (CAPPUCCINO VAINILLA), opciones y recuadro CONTIENE.

### C. Ejecución de Pruebas Automáticas (`test`)
Ejecuta la suite completa de pruebas unitarias y de integración simulada con Vitest:
```bash
pnpm --filter @caprichos/agente-local test
```

### D. Inicio Manual del Agente (`start`)
Inicia el bucle de impresión en primer plano para ver la salida en la consola:
```bash
pnpm --filter @caprichos/agente-local start
```

---

## 7. Dos máquinas: etiquetera y ticketera

El programa maneja **dos impresoras por rol**:

- **ETIQUETERA** (stickers, TSPL2): etiquetas del pedido.
- **TICKETERA** (térmica, ESC/POS 58 u 80 mm): ticket/voucher de pago, que la API encola al cobrar o registrar el pago como pagado (idempotente por pedido).

Cada latido (20 s) informa el estado de cada máquina (lista, no encontrada, sin papel, error). La API lo expone en `GET /admin/impresion/estado` (campo `impresoras`) y avisa por `impresion:estado`. Una máquina que no está lista **no toma trabajos**: los suyos esperan en la cola y salen al volver.

### Windows (recomendado)

1. En Caprichos, el aviso «Instalar programa de impresión» ofrece **Descargar el programa de impresión para Windows** (`/api/agente-impresion/descargar/windows`).
2. Abre el `.exe`. Pega el **código de vinculación** (un solo uso, 15 min) que genera el administrador en el mismo aviso. Tiene la forma `CODIGO@servidor`, así el mismo programa sirve para la demo y para producción según el código que pegues. No hay llaves ni secretos que copiar.
3. El asistente lista las impresoras de Windows: elige cuál es la etiquetera y cuál la ticketera (Enter = ninguna). Se guarda en `%APPDATA%\CaprichosAgente\config.json`.
4. Inicio automático (opcional): `Win + R` -> `shell:startup` y pon ahí un acceso directo al `.exe`.

Para cambiar las impresoras o re-vincular: `agente-impresion-windows.exe configurar` (borra `agenteKey` del config para re-vincular).

### Linux / variables de entorno

`ETIQUETERA` y `TICKETERA` aceptan el nombre de la impresora (Windows) o la ruta del dispositivo (Linux, ej. `/dev/usb/lp1`). `IMPRESORA_RUTA` sigue valiendo como etiquetera. `TICKET_COLUMNAS=32` para papel de 58 mm (por defecto 48 = 80 mm). `AGENTE_CONFIG` cambia la ruta del archivo de configuración.

### Empaquetar el .exe

`pnpm --filter @caprichos/agente-local empaquetar:win` (usa `@yao-pkg/pkg`, nodo 22 para Windows x64; sale en `apps/agente-local/dist-exe/`). El workflow `.github/workflows/agente-windows.yml` lo construye solo cuando cambia el agente y lo sube a `~/caprichos-descargas/` del servidor, que la API monta en `/data/descargas` (`AGENTE_EXE_RUTA` lo cambia).

### Por qué no imprimía en la demo

El navegador no ve impresoras USB: solo este programa. Si no está instalado y vinculado en la PC del local, no hay latido, la API lo da por apagado y las etiquetas quedan en cola.
