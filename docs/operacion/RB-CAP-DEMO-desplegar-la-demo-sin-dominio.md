---
id: RB-CAP-DEMO
tipo: runbook
titulo: "Runbook: desplegar la demo de Caprichos sin dominio con HTTPS real"
estado: listo
producto: caprichos
version: "3.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-24
relacionados: [ADR-011, ADR-012, ADR-015, RB-CAP-001, RB-CAP-004, RB-CAP-005, INV-CAP-001]
tags: [runbook, demo, vps, traefik, compose, sslip, ssl, devops]
---

# RB-CAP-DEMO — Desplegar y Operar la Demo sin Dominio (Docker Compose + Traefik Autónomo)

| Campo | Valor |
|---|---|
| **Cuándo usarlo** | Para publicar o actualizar la demo de Caprichos en el VPS de Contabo, antes de activar el dominio oficial. |
| **Tiempo estimado** | 15 minutos la primera vez; 3 minutos para cada actualización o migración. |
| **Quién lo ejecuta** | José Ángel Espinoza, o el operador técnico con acceso SSH al VPS. |
| **Resultado** | `https://207-244-232-127.sslip.io` con certificado Let's Encrypt, detrás del proxy Traefik autónomo (ADR-015). |

---

## 1. Datos del servidor

| Dato | Valor |
|---|---|
| IP pública | `207.244.232.127` |
| Host de la demo | `207-244-232-127.sslip.io` (sslip.io resuelve automáticamente a la IP pública) |
| Usuario SSH | `deploy` (sudo sin contraseña; sin acceso directo de root) |
| Llave SSH | `~/.ssh/id_ed25519_caprichos_vps` |
| Sistema | Ubuntu 24.04, 6 vCPU, 12 GB de RAM, Docker CE |
| Esquema de red | Proxy perimetral Traefik (`caprichos-proxy-traefik`) en `caprichos-proxy-net`. |

Variables de sesión para terminal:
```bash
export SSH_HOST=207.244.232.127
export SSH_USER=deploy
export SSH_KEY=~/.ssh/id_ed25519_caprichos_vps
export DOMINIO_BASE=207-244-232-127.sslip.io
```

---

## 2. Firewall UFW para la Demo

La demo requiere que 80 y 443 estén abiertos a cualquier IP (para Let's Encrypt y acceso de clientes externos):
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw route allow proto tcp from any to any port 80,443
```
(Gestionado automáticamente en Ansible fijando `proxy_cloudflare: false`).

---

## 3. Si la demo ya está corriendo con Dokploy (Migración sin corte)

Si la demo ya está en ejecución bajo `/opt/caprichos-demo` y `dokploy-traefik`, ejecute el script de migración transparente:

```bash
ssh -i $SSH_KEY $SSH_USER@$SSH_HOST
cd /opt/caprichos/scripts
sudo ./migrar-demo-actual.sh
```

El script:
1. Realiza un respaldo previo obligatorio de PostgreSQL y subidas en `/opt/caprichos/respaldos/pre-migracion-*/`.
2. Preserva los volúmenes existentes intactos (`caprichos_demo_postgres_data`, etc.).
3. Traspasa el `.env` con las contraseñas que coinciden con los datos.
4. Detiene `dokploy-traefik` y arranca `caprichos-proxy-traefik`.
5. Levanta la demo con el nuevo esquema Compose.
6. Si algo falla, revierte automáticamente con `./migrar-demo-actual.sh --rollback`.

---

## 4. Despliegue Limpio de la Demo (Primera vez en servidor virgen)

1. En el VPS, dentro de `/opt/caprichos/demo`:
   ```bash
   cp /opt/caprichos/compose/.env.example /opt/caprichos/demo/.env
   chmod 600 /opt/caprichos/demo/.env
   ```
2. Iniciar el proxy Traefik autónomo:
   ```bash
   cd /opt/caprichos/proxy
   docker compose up -d
   ```
3. Ejecutar el script de despliegue:
   ```bash
   cd /opt/caprichos/scripts
   ./desplegar.sh demo <tag>
   ```
4. Cargar la semilla inicial limpia:
   ```bash
   docker compose -f /opt/caprichos/compose/docker-compose.base.yml -f /opt/caprichos/compose/docker-compose.demo.yml exec api tsx prisma/seed-demo.ts
   ```
5. Generar los usuarios iniciales (una sola vez):
   ```bash
   docker compose -f /opt/caprichos/compose/docker-compose.base.yml -f /opt/caprichos/compose/docker-compose.demo.yml exec api tsx prisma/seed-usuarios-demo.ts
   ```

---

## 5. Operación Diaria de la Demo

| Tarea | Comando en `/opt/caprichos/scripts` |
|---|---|
| **Ver estado y recursos** | `./estado.sh demo` |
| **Ver registros de API** | `./logs.sh demo api` |
| **Ver registros de Traefik** | `./logs.sh proxy` |
| **Actualizar a nueva versión** | `./desplegar.sh demo <NUEVO_TAG>` (con rollback automático si falla) |
| **Forzar vuelta atrás manual** | `./volver-atras.sh demo <TAG_ANTERIOR>` |
| **Generar copia de seguridad** | `./respaldar.sh demo` |
| **Probar restauración** | `./restaurar.sh demo <archivo.sql.gz> --prueba-local` |

---

## 6. Verificación Externa

Desde tu máquina local:
```bash
curl -sI https://207-244-232-127.sslip.io/salud
curl -sI https://207-244-232-127.sslip.io/ | grep -i "x-robots-tag"
```
Esperado: HTTP 200, certificado Let's Encrypt válido y cabecera `X-Robots-Tag: noindex, nofollow, noarchive`.

---

*Actualizado a versión 3.0: Eliminación completa de Dokploy e integración con Traefik autónomo y Docker Compose (ADR-015).*
