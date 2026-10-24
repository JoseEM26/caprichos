---
id: RB-CAP-DEMO
tipo: runbook
titulo: "Runbook: desplegar la demo de Caprichos sin dominio con HTTPS real"
estado: listo
producto: caprichos
version: "2.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-24
relacionados: [ADR-011, ADR-012, RB-CAP-001, RB-CAP-004, INV-CAP-001]
tags: [runbook, demo, vps, traefik, dokploy, sslip, ssl, devops]
---

# RB-CAP-DEMO — Desplegar la demo sin dominio, con HTTPS real

| Campo | Valor |
|---|---|
| **Cuándo usarlo** | Para publicar la demo de Caprichos en el VPS de Contabo, antes de activar el dominio oficial. |
| **Tiempo estimado** | 20 minutos la primera vez; 5 minutos para cada actualización. |
| **Quién lo ejecuta** | José Ángel Espinoza, o el operador técnico con acceso SSH al VPS. |
| **Resultado** | `https://207-244-232-127.sslip.io` con certificado Let's Encrypt, detrás del Traefik que ya usa Dokploy. |

---

## 1. Datos del servidor

| Dato | Valor |
|---|---|
| IP pública | `207.244.232.127` |
| Host de la demo | `207-244-232-127.sslip.io` (sslip.io resuelve la IP y Let's Encrypt emite el certificado; no hace falta DNS) |
| Usuario SSH | `deploy` (sudo sin contraseña; no hay login directo de root) |
| Llave SSH | `~/.ssh/id_ed25519_caprichos_vps` en tu equipo |
| Sistema | Ubuntu 24.04, 6 vCPU, 11 GB de RAM, Docker 29 en modo Swarm |
| Ya instalado | Dokploy. Su Traefik (`dokploy-traefik`) ocupa los puertos 80 y 443 y enruta por la red `dokploy-network`. |

**Regla importante:** no puede haber un segundo proxy en 80 y 443. La demo no trae proxy propio: entra por el Traefik de Dokploy mediante etiquetas.

Variables para la sesión de terminal (en tu equipo):
```bash
export SSH_HOST=207.244.232.127
export SSH_USER=deploy
export SSH_KEY=~/.ssh/id_ed25519_caprichos_vps
export DOMINIO_BASE=207-244-232-127.sslip.io
```

---

## 2. Paso 1 — Abrir el firewall (una sola vez, lo hace el operador con sudo)

Ansible dejó 80 y 443 solo para Cloudflare. La demo necesita abrirlos a cualquiera, en dos sentidos:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Tráfico que entra a los contenedores publicados (Traefik): pasa por la cadena DOCKER-USER
sudo ufw route allow proto tcp from any to any port 80,443
```

Después, revisa el estado sin cambiar nada:
```bash
ssh -i $SSH_KEY $SSH_USER@$SSH_HOST 'bash -s' < ./infra/demo/preparar-vps.sh
```
(El script solo lee. Si quieres que aplique las reglas que falten: `ssh ... 'bash -s -- --aplicar' < ./infra/demo/preparar-vps.sh`. Nunca quita reglas.)

> **No verificado todavía en el VPS real:** la regla `route` es la que Docker necesita con UFW; el paso 5 (prueba desde fuera) confirma que el tráfico llega.

---

## 3. Paso 2 — Enviar las imágenes al VPS

Se construyen en tu equipo con los `Dockerfile` del repositorio y se transfieren por SSH, sin registro externo:
```bash
SSH_HOST=$SSH_HOST SSH_USER=$SSH_USER SSH_KEY=$SSH_KEY ./infra/demo/construir-y-enviar.sh
```
La etiqueta es el commit corto de git (por ejemplo `99c76ad`) y además `demo`.

---

## 4. Paso 3 — Desplegar la demo

```bash
SSH_HOST=$SSH_HOST SSH_USER=$SSH_USER SSH_KEY=$SSH_KEY DOMINIO_BASE=$DOMINIO_BASE \
  ./infra/demo/desplegar.sh --remote
```

El script copia los archivos a `/opt/caprichos-demo` y ahí:

1. Genera el archivo `.env` con contraseñas de PostgreSQL, Redis y JWT creadas con OpenSSL, permisos 600. **Ese archivo vive solo en el VPS.**
2. Comprueba que existan `dokploy-network` y `dokploy-traefik` en ejecución.
3. Levanta PostgreSQL y Redis (solo en la red interna; no se publican puertos).
4. Aplica las migraciones (`prisma migrate deploy`).
5. Carga la semilla limpia: carta, zonas, insumos, plano y configuración legal. No crea usuarios.
6. Levanta web y API, y comprueba `https://<dominio>/salud` a través de Traefik.

Si algo falla, el script se detiene y dice qué paso falló.

---

## 5. Paso 4 — Crear los accesos de demostración (una sola vez)

```bash
ssh -i $SSH_KEY $SSH_USER@$SSH_HOST
cd /opt/caprichos-demo
./crear-usuarios-demo.sh
```

Se crea un usuario por rol (ADMIN, CAJERO, MOZO, COCINA, ALMACEN, REPARTIDOR), cada uno con una contraseña aleatoria de 16 caracteres. **Se muestran una sola vez en la terminal.** No se guardan en el servidor, en el repositorio ni en informes. Copia las credenciales en un gestor de contraseñas antes de cerrar la terminal.

Al primer ingreso, cada usuario debe cambiar su contraseña.

Si pierdes una contraseña, vuelve a ejecutar el script: restablece las contraseñas de los seis usuarios.

---

## 6. Direcciones de la demo

| Qué | Dirección |
|---|---|
| Carta virtual | `https://207-244-232-127.sslip.io/` |
| Panel administrativo | `https://207-244-232-127.sslip.io/admin` |
| Aviso de versión demo | `https://207-244-232-127.sslip.io/demo` |
| Salud del sistema | `https://207-244-232-127.sslip.io/salud` |

**Carta cerrada fuera de horario.** La carta pública aplica el horario del local (hoy abre a las 14:00). Fuera de ese horario el catálogo se ve, pero no se pueden enviar pedidos, y eso es correcto. Para una demo abierta a cualquier hora, cambia el horario en **Configuración > Local** del panel de admin.

---

## 7. Paso 5 — Prueba desde fuera

Desde tu equipo, sin usar `--resolve`:
```bash
curl -s https://207-244-232-127.sslip.io/salud
curl -sI https://207-244-232-127.sslip.io/ | grep -i "x-robots-tag\|strict-transport"
curl -s https://207-244-232-127.sslip.io/robots.txt
```
Lo esperado: JSON de salud, cabeceras `noindex` y HSTS, y `Disallow: /`.

Si el certificado tarda unos minutos, el primer acceso puede dar aviso de certificado: espera un poco y vuelve a intentar.

---

## 8. Fotos de productos

Las fotos se suben desde el panel de administración (módulo de catálogo). Ese flujo ya se probó con la API (`POST /admin/archivos` devuelve la URL pública y se sirve por `/archivos/...`). No versiones fotos pesadas en git. Usa JPEG o WebP de máximo 1200 px de ancho.

---

## 9. Operación diaria (en `/opt/caprichos-demo`)

| Tarea | Comando |
|---|---|
| Estado y recursos | `./estado.sh` |
| Registros de la API / web / bases | `./logs.sh api`, `./logs.sh web`, `./logs.sh postgres` |
| Registros del proxy (rutas y certificados) | `./logs.sh traefik` |
| Actualizar a una versión nueva | Desde tu equipo: `construir-y-enviar.sh`; luego en el VPS: `./actualizar.sh <COMMIT>` |
| Volver a la versión anterior | `./actualizar.sh <COMMIT_ANTERIOR>` (si la salud falla, lo hace solo) |
| Copia de seguridad | `./respaldar.sh` (volcado de PostgreSQL y de fotos, en `respaldos/`, 7 días) |
| Apagar sin borrar datos | `docker compose -f docker-compose.demo.yml down` (**sin** `-v`) |
| Encender de nuevo | `docker compose -f docker-compose.demo.yml up -d` |

**Nunca borres el archivo `.env` del VPS.** Sin él, las contraseñas nuevas no coinciden con la base de datos existente, y `desplegar.sh` se niega a generar otro.

Las copias de `respaldos/` contienen datos de clientes. Se crean con permisos restringidos y nunca van al repositorio.

---

## 10. Qué se verificó y qué no

**Verificado en esta máquina (prueba local con la misma configuración):**
- Migraciones y semilla limpia sobre PostgreSQL 16.
- Compose completo, con un Traefik 3.6.25 en el mismo puerto de entrada y resolver de certificados con el mismo nombre (`letsencrypt`) y red `dokploy-network`.
- Rutas: `/`, `/admin` (HTML para el navegador, JSON para la API), `/api/salud`, `/salud`, `/demo`, `/robots.txt`, `/reclamos` (GET y POST), `/carta`, `/socket.io`, `/archivos`.
- Login con cambio de contraseña inicial, pedido de ejemplo (201), subida de foto (201, sirve 200), websocket Socket.IO abierto.
- Límite de intentos de ingreso: 429 tras la ráfaga.
- Postgres y Redis sin puertos publicados.
- Capturas de la carta y del admin servidas por el compose (`/tmp/f1shots/desp-carta.png`, `desp-admin.png`, `desp-aviso.png`).

**No verificado (requiere el VPS real):**
- Emisión del certificado de Let's Encrypt para `207-244-232-127.sslip.io`.
- Que la regla `ufw route` deje pasar el tráfico desde internet hacia Traefik.
- Convivencia real con el `dokploy-traefik` de producción (la prueba local usa un Traefik de réplica).
- Redes `dokploy-network` en modo Swarm con `docker compose` normal.

---

## 11. Lo que falta para PRODUCCIÓN

Según **ADR-011**, **ADR-012** y **INV-CAP-001**:

- [ ] **Dominio y DNS:** apuntar `caprichos.pe` a Cloudflare. Cuando esté activo, cambia `DOMINIO_BASE` y redespliega; las reglas de Traefik no cambian.
- [ ] **Cloudflare:** proxy naranja, cifrado Full (strict) y Cloudflare Access para el panel de Dokploy.
- [ ] **Dokploy como orquestador:** pasar la demo y producción a Dokploy en lugar de `docker compose` manual.
- [ ] **CI/CD con GitHub Actions y GHCR:** `deploy-prod.yml` y `deploy-staging.yml`, con imágenes `ghcr.io/...` en lugar de `docker save | ssh`.
- [ ] **Copias remotas cifradas con restic** a Backblaze B2 o Cloudflare R2, con programación diaria.
- [ ] **Limitar el tamaño de subidas en Traefik** (hoy el límite lo pone la API, no el proxy).
- [ ] **Credenciales de negocio reales:** WhatsApp, OpenAI y Google Maps.
- [ ] **Datos reales:** cuentas de Yape, Plin y transferencia; precios y fotos finales.
- [ ] **Revisión legal** de los textos según la Ley N.° 29733.
- [ ] **Corregir en la web:** la llamada a `/ofertas/cupones/validar` no tiene ruta en la API (la API expone `/admin/cupones`).
