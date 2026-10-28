---
id: RB-CAP-012
tipo: runbook
titulo: "Runbook: impresion de etiquetas sin conexion (PC de la etiquetera apagada, sin sesion o sin papel)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
relacionados: [RB-CAP-001, RB-CAP-002]
tags: [runbook, impresion, etiquetera, agente-local, operacion]
---

# RB-CAP-012: impresion de etiquetas sin conexion

## Cuando aplica
Las etiquetas de cada pedido se encolan al aceptarse el pedido en Caja. Las imprime el agente local (`apps/agente-local`) en la PC de la etiquetera. Si esa PC está apagada, sin el programa abierto, sin sesión, o la impresora está desconectada o sin papel, las etiquetas **no se pierden**: quedan en cola (`PENDIENTE`) y salen solas al reconectar, en orden.

## Que significa cada aviso
| Aviso | Donde aparece | Cuando sale | Que hacer |
| :--- | :--- | :--- | :--- |
| **Impresora de Caja sin conexion** (`IMPRESORA_SIN_CONEXION`) | Campana del panel, para CAJERO y ADMIN, con enlace a Caja | Al aceptar un pedido nuevo y el agente no tiene latido de los últimos 60 s, o la impresora no está lista | Revisar la PC de la etiquetera (lista abajo) |
| **Franja "Impresora sin conexion: N etiquetas en cola"** | Arriba de Pedidos y caja, con el boton Ir a Impresion | Mientras haya etiquetas en cola y el agente o la impresora tengan problema. Se oculta sola al reconectar | Igual que el aviso anterior |
| **Etiquetas sin imprimir** (WhatsApp y campana) | WhatsApp de los administradores que activaron sus alertas; campana de ADMIN | Cuando las etiquetas llevan más de `impresion_alerta_min` minutos (5 por defecto) en cola sin agente. Una sola vez por cada grupo de pendientes | Igual; si el aviso llega y la PC está encendida, revisar el programa de impresión |
| **Vencida** (en la pestaña Etiquetas) | Tarjeta de la etiqueta, con el motivo | Al reconectar, si el pedido fue anulado o la etiqueta esperó más de `impresion_vence_min` minutos (180 por defecto) | No sale sola. Si hace falta, pulsar Reimprimir en la tarjeta |
| **En cola / Imprimiendo / Impresa / Fallida** | Pestaña Etiquetas de cada pedido | Siempre, con el estado real de cada etiqueta | Fallida: ver el motivo; reimprimir cuando la impresora esté lista |

Parámetros (Configuración, Parámetros de operación): `impresion_alerta_min` (aviso por WhatsApp, 5 min) e `impresion_vence_min` (vencimiento, 180 min).

## Que revisar, en orden
1. La PC de la etiquetera está encendida y tiene red hacia la API.
2. El programa de impresión (agente local) está corriendo: como servicio, o abierto con sesión iniciada (ver instalación más abajo).
3. La impresora está encendida, con el cable USB conectado y con papel y cinta.
4. En Configuración, Impresión, el estado del agente debe decir conectado y la impresora lista. Si dice desconectada o sin papel, corregir eso primero.
5. Si el agente corre pero no imprime, en la PC ejecutar `pnpm --filter @caprichos/agente-local probar`. Si imprime 3 etiquetas de muestra, el problema estaba en la conexión con la API (revisar `AGENTE_KEY` y `API_URL`).

Al reconectar no hace falta hacer nada: el agente toma los pendientes en orden. Lo que quedó VENCIDA no sale; reimprimirlo desde la pestaña Etiquetas.

## Instalar el agente para que arranque solo (sin que el cajero inicie sesion)

### Linux con systemd: existe y está documentado
La instalación está descrita en `apps/agente-local/README.md`, sección 5. Es una unidad de sistema (`multi-user.target`) con `Restart=always`, así que arranca al encender la PC y no depende de que alguien inicie sesión. Pasos resumidos:
1. Crear `/etc/systemd/system/caprichos-agente.service` con el contenido de la sección 5 del README. Ajustar `User=` (el usuario debe pertenecer al grupo `lp`, ver sección 3 del README), `WorkingDirectory=`, `API_URL` y `AGENTE_KEY`.
2. Activar: `sudo systemctl daemon-reload && sudo systemctl enable --now caprichos-agente.service`.
3. Ver estado y logs: `sudo systemctl status caprichos-agente.service` y `journalctl -u caprichos-agente.service -f`.

Estado: documentado en el repo; **pendiente de comprobar en la PC real de Caja** (no se verificó en hardware).

### Windows con Tarea programada al iniciar el sistema: por probar
No existe instalación de Windows en el repo. El agente hoy usa `IMPRESORA_RUTA=/dev/usb/lp0` (ruta de Linux), así que en Windows habría que definir la ruta de la etiquetera (por ejemplo el nombre de dispositivo o un puerto compartido) y **esto no está probado**. Propuesta, por probar:
1. Instalar Node.js LTS y copiar el repo a `C:\caprichos`; compilar el agente (`pnpm --filter @caprichos/agente-local build`).
2. Definir las variables a nivel de equipo (ejecutar como administrador): `setx /M API_URL "https://api.caprichos.pe"`, `setx /M AGENTE_KEY "<llave>"` y `setx /M IMPRESORA_RUTA "<ruta de la etiquetera en Windows>"`.
3. Crear la tarea que arranca al encender, sin sesion:
   `schtasks /Create /TN "Caprichos Agente" /TR "\"C:\Program Files\nodejs\node.exe\" \"C:\caprichos\apps\agente-local\dist\index.js\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F`
4. Reiniciar la PC y comprobar que el agente aparece conectado en Configuración, Impresión, sin iniciar sesión.

## Como probar sin imprimir papel
- Impresora de muestra: `pnpm --filter @caprichos/agente-local probar` (3 etiquetas de muestra).
- Archivos TSPL para revisar: `pnpm --filter @caprichos/agente-local volcar`.

## Quien puede hacerlo
Reiniciar la PC, revisar la impresora y reimprimir: Cajero y Administrador. Instalar el servicio o cambiar la llave del agente: Administrador (la llave se crea y se desactiva en Configuración, Impresión).
