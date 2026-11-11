# Agente Local de Impresión TSPL2 - Caprichos

Agente de fondo en Node.js que corre en la **PC de Caja** de la cafetería Caprichos. Se encarga de consumir de forma atómica los trabajos de impresión encolados por cualquier canal (carta web, cocina, caja, WhatsApp) e imprimirlos físicamente en la etiquetera térmica conectada por USB (**4BARCODE 4B-2054TH**, lenguaje TSPL2, etiquetas de 63.5 mm x 101.6 mm, Diseño 1 vertical).

---

## 0. Versión y release del programa

- **Esquema:** `0.1.<N>`, donde `N` es el número de ejecución del workflow `agente-windows.yml` (`github.run_number`), más el commit corto. Ejemplo: `Programa de impresión Caprichos v0.1.57 (ab12cd3)`.
- **Cómo se inyecta:** `scripts/bundle.mjs` (esbuild `--define`) toma `AGENTE_VERSION` y `AGENTE_COMMIT` del entorno; sin ellas (tests, `tsc`, `pnpm start`) vale `0.1.0-dev` / `dev`. La versión del `package.json` no se usa.
- **Ver la versión instalada en una PC:** `agente-impresion-windows.exe --version` (también `-v` o `version`); `--estado` y el arranque la incluyen en su primera línea. En la web: Configuración › Impresión › Fácil, cada PC muestra «Programa v0.1.N (commit)» con la insignia «Actualizado» o «Hay una versión nueva».
- **Última publicada:** el workflow sube `version-agente.json` (`{version, commit, fecha}`) junto al `.exe` a `~/caprichos-descargas/`; la API lo expone en `GET /api/agente-impresion/version` (variable `AGENTE_VERSION_RUTA` para cambiar el archivo). Sin archivo, la web no muestra insignia.
- **Release de GitHub:** en cada push a `main` el workflow crea el pre-release `agente-v0.1.N` con los dos binarios y `version-agente.json` (separado de los `v0.4.x` del sistema).
- Una PC con un `.exe` anterior a este esquema reporta `0.1.0` y se considera antigua: hay que instalar UNA vez el `.exe` nuevo para que desde entonces se vea la versión.

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
ExecStart=/usr/bin/node dist/entrada.js
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
4. Inicio automático: ya no hace falta `shell:startup` ni accesos directos; ver «Que arranque solo con Windows» abajo.

Para cambiar las impresoras o re-vincular: `agente-impresion-windows.exe configurar` (borra `agenteKey` del config para re-vincular).

### Que arranque solo con Windows

Ejecuta el `.exe` **una sola vez**. Al abrirlo (ya vinculado) el programa se registra solo para iniciar al iniciar sesión en Windows, en segundo plano y sin ventana, con la clave del usuario `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` (valor `CaprichosImpresion`). No pide permisos de administrador.

- Es idempotente: abrirlo otra vez no duplica nada. Si mueves el `.exe` o descargas una versión nueva en otra carpeta, al abrirlo (o al arrancar solo) la entrada se corrige a la ruta actual.
- Para quitarlo: `agente-impresion-windows.exe autoinicio desactivar`. Queda recordado en `config.json` (`autoinicioDesactivado`) y no se vuelve a registrar solo. Para ponerlo de nuevo: `autoinicio activar`. `autoinicio` a secas dice si está activado. (`--instalar-inicio` y `--quitar-inicio` hacen lo mismo.)
- En Linux/mac no usa el registro: en Linux crea el autostart del escritorio; el servicio `systemd` (sección 5) sigue siendo la opción para servidores.

### Comprobar el estado

`agente-impresion-windows.exe estado` (alias `diagnostico`, que además lista las impresoras que ve el equipo) no imprime nada; revisa:

```
✔ Iniciar con Windows: registrado
✔ Vinculado con Caprichos: sí (https://caprichos.pe)
✔ Conexión con el sistema: conectado · último latido 2026-11-10T10:00:00Z
✔ Versión 0.1.58 (al día)
✔ Etiquetera: ETIQUETERA Caja · instalada y en línea
✔ Ticketera: POS-80C · instalada y en línea
✔ Programa en marcha: sí (pid 4242, una sola instancia)
Todo en orden.
```

Una línea con ✘ dice qué falla (ruta de inicio distinta, sin vincular, sin conexión, impresora no vista por el equipo o sin conexión, programa detenido). «Hay una versión nueva» se muestra pero no cuenta como fallo. El código de salida es 0 si todo está bien y 1 si algo falla, útil en scripts; `estado --json` entrega lo mismo en JSON, sin la llave. La conexión se prueba con una consulta ligera de solo lectura (no envía latidos ni toma trabajos); el último latido real sale del programa en marcha. Solo puede haber una instancia: un segundo programa avisa y se cierra.

### Copias, versión y cómo actualizar (comandos útiles)

Si se abre una versión nueva sin cerrar la anterior pueden quedar varias copias imprimiendo a la vez (tickets dobles). El bloqueo `agente.lock` solo conoce UNA copia, y solo existe desde el 08/11/2026 (commit 6985cc48): las versiones anteriores no lo tienen, y una copia con otra carpeta de datos (`AGENTE_CONFIG`, otro usuario de Windows) tiene su propio bloqueo. Por eso hay estos comandos (todos en español, sin administrador; el nombre del archivo es el que se descargó, p. ej. `agente-impresion-windows.exe`):

| Comando | Qué hace |
|---|---|
| `--version` (`-v`, `version`) | Una línea: `Programa de impresión Caprichos v0.1.N (commit)`. |
| `--estado` | Lo de siempre + «Versión en uso», «Última versión disponible» (o «No se pudo consultar» sin red), «Copias corriendo: N» (✘ si N > 1) e «Inicio con Windows: registrado desde <ruta>». |
| `--copias` (`copias`) | Lista TODAS las copias del programa corriendo (pid, versión si se sabe o «versión desconocida», hora de inicio, ruta), sin contar la ventana que ejecuta el comando. |
| `--detener-todo` (`detener-todo`) | Cierra todas las copias (la registrada con parada ordenada; las demás con `taskkill /F` o `Stop-Process`; en Linux SIGTERM y luego SIGKILL), limpia `agente.lock` y `detener.flag` huérfanos y dice qué cerró: «Cerré 4 copias: pid …». Avisa con ✘ si alguna no se pudo cerrar (otro usuario o permisos). |
| `autoinicio activar` / `desactivar` | Registra o quita el inicio con Windows. |

**Actualizar la versión:** 1) `agente-impresion-windows.exe --detener-todo`; 2) reemplaza el archivo en la carpeta fija (p. ej. `C:\Caprichos`); 3) ábrelo UNA vez (doble clic).

**Al arrancar** (modo normal o `--segundo-plano`) el programa nuevo, con el bloqueo ya tomado, busca otras copias del mismo ejecutable (mismo nombre de imagen; solo las de servicio, no `--estado`/`--copias`/`--version`) que arrancaron ANTES y las cierra, dejando en `agente.log`: «Había N copias del programa; cerré las anteriores». Si el bloqueo lo tiene una versión anterior (o sin versión), también la reemplaza; con la misma versión o una más nueva se respeta. Si dos copias nuevas arrancan a la vez, manda el bloqueo atómico y, para copias sin bloqueo, la más nueva cierra a la más vieja (nunca al revés). Nunca toca procesos de otro nombre ni de otros usuarios (si no tiene permiso, lo avisa en el log). Para desactivarlo: `--no-cerrar-otras` o la variable `CAPRICHOS_NO_CERRAR_OTRAS=1`.

Cómo se listan los procesos: Windows, PowerShell (`Get-CimInstance Win32_Process`) → `wmic` → `tasklist` (sin hora ni ruta); Linux, `/proc` (solo se ven los del mismo usuario).

**Receta de prueba manual en Windows** (no se pudo probar en un Windows real desde el desarrollo; solo con funciones simuladas):
1. Copia el `.exe` nuevo a `C:\Caprichos` y otra copia (renombrada, mismo contenido) a `C:\Prueba`. Ábrelas con doble clic una tras otra: debe quedar UNA sola: el Administrador de tareas (pestaña Detalles) muestra un solo proceso con ese nombre; en agente.log (`--ver-logs`) aparece «Había 1 copia del programa; cerré las anteriores».
2. Abre una consola en `C:\Caprichos` (escribe `cmd` en la barra de direcciones) y ejecuta `agente-impresion-windows.exe --estado`: debe mostrar «Versión en uso», «Última versión disponible», «Copias corriendo: 1» e «Inicio con Windows: registrado desde C:\Caprichos\…».
3. Con una versión VIEJA (sin bloqueo) abierta a mano además de la nueva: `--copias` debe listarla con «versión desconocida»; `--estado` debe mostrar ✘ «Hay 2 copias…»; `--detener-todo` debe decir «Cerré 2 copias: pid …» y el Administrador de tareas no debe dejar ninguna.
4. Abre la versión nueva con `agente-impresion-windows.exe --no-cerrar-otras` junto a una vieja: no debe cerrarla.
5. Repite `--detener-todo` con el Administrador de tareas abierto: ninguna copia debe sobrevivir y `%APPDATA%\CaprichosAgente\agente.lock` no debe existir.

### Linux (binario autocontenido, sin Node)

El panel «Instalar programa de impresión» tiene la pestaña **Linux** con estos mismos comandos listos para copiar (con la URL del sitio):

```bash
curl -fL <sitio>/api/agente-impresion/descargar/linux -o ~/caprichos-impresion && chmod +x ~/caprichos-impresion
sudo usermod -aG lp $USER        # luego cerrar sesión y volver a entrar
ls -l /dev/usb/lp*               # deben verse lp0 y lp1 (etiquetera y ticketera)
~/caprichos-impresion configurar # pega el código de vinculación; lista /dev/usb/lp* y eliges etiquetera y ticketera
```

`configurar` guarda en `~/.config/CaprichosAgente/config.json` (respeta `XDG_CONFIG_HOME`; `AGENTE_CONFIG` lo cambia) con `etiquetera` y `ticketera` como rutas (`/dev/usb/lp0`, `/dev/usb/lp1`), igual que Windows guarda nombres. Enter = ninguna.

Arranque automático (systemd de usuario), `~/.config/systemd/user/caprichos-impresion.service`:

```ini
[Unit]
Description=Caprichos - programa de impresion
After=network-online.target

[Service]
ExecStart=%h/caprichos-impresion
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload && systemctl --user enable --now caprichos-impresion
loginctl enable-linger $USER          # arranca sin abrir sesión
journalctl --user -u caprichos-impresion -f
```

### Variables de entorno

`ETIQUETERA` y `TICKETERA` aceptan el nombre de la impresora (Windows) o la ruta del dispositivo (Linux, ej. `/dev/usb/lp1`). `IMPRESORA_RUTA` sigue valiendo como etiquetera. `TICKET_COLUMNAS=32` para papel de 58 mm (por defecto 48 = 80 mm). `AGENTE_CONFIG` cambia la ruta del archivo de configuración.

### Empaquetar (.exe y binario Linux)

`pnpm --filter @caprichos/agente-local empaquetar:linux` genera `dist-exe/agente-impresion-linux` (node22-linux-x64, ~74 MB). `pnpm --filter @caprichos/agente-local empaquetar:win` (usa `@yao-pkg/pkg`, nodo 22 para Windows x64; sale en `apps/agente-local/dist-exe/`). El workflow `.github/workflows/agente-windows.yml` construye ambos solo cuando cambia el agente y los sube a `~/caprichos-descargas/` del servidor, que la API monta en `/data/descargas` (`AGENTE_EXE_RUTA` y `AGENTE_LINUX_RUTA` cambian las rutas).

### Por qué no imprimía en la demo

El navegador no ve impresoras USB: solo este programa. Si no está instalado y vinculado en la PC del local, no hay latido, la API lo da por apagado y las etiquetas quedan en cola.
