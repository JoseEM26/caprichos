---
id: RB-CAP-005
tipo: runbook
titulo: "Runbook: desplegar, actualizar y volver atrás con Docker Compose"
estado: listo
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-24
relacionados: [ADR-011, ADR-012, ADR-015, RB-CAP-004, RB-CAP-DEMO, INV-CAP-001]
tags: [runbook, compose, deploy, rollback, devops]
---

# RB-CAP-005 — Desplegar, Actualizar y Volver Atrás con Docker Compose

| Campo | Valor |
|---|---|
| **Cuándo usarlo** | Para realizar despliegues de nuevas versiones, actualizaciones programadas, diagnósticos o rollbacks de emergencia en Demo, Staging o Producción. |
| **Tiempo estimado** | 2 a 5 minutos por despliegue. |
| **Quién lo ejecuta** | GitHub Actions (automático) o el operador técnico mediante SSH. |
| **Referencia** | ADR-015: Docker Compose y GitHub Actions por SSH. |

---

## 1. Esquema de Despliegue por Ambiente

| Ambiente | Disparador GitHub Actions | Dominio Principal | Proyecto Docker | Aislamiento SEO |
|---|---|---|---|---|
| **Demo** | Push a `ola-1` | `207-244-232-127.sslip.io` | `caprichos-demo` | `noindex, nofollow` |
| **Staging** | Push a `main` | `staging.caprichos.pe` | `caprichos-staging` | `noindex, nofollow` |
| **Producción** | Tag `v*` (ej. `v0.3.0`) + Aprobación manual | `caprichos.pe` <br> `admin.caprichos.pe` <br> `api.caprichos.pe` | `caprichos-prod` | **Indexable** (SEO activo) |

---

## 2. Método Automático: Despliegue mediante GitHub Actions

El repositorio cuenta con el flujo automatizado `.github/workflows/deploy.yml`:

1. **Staging / Demo:**
   - Hacer push a `ola-1` (demo) o crear PR y unir a `main` (staging).
   - El workflow compila con Buildx, escanea con Trivy, sube a GHCR, conecta por SSH al VPS y corre `desplegar.sh <ambiente> <sha>`.
2. **Producción:**
   - Crear un tag anotado de versión:
     ```bash
     git tag -a v0.3.0 -m "release: version v0.3.0 para produccion"
     git push origin v0.3.0
     ```
   - En GitHub, ir a la pestaña **Actions** > **Deploy Caprichos por SSH**.
   - El job entrará en pausa solicitando **Review deployments** en el ambiente `production`.
   - El líder técnico revisa el cambio y hace clic en **Approve and deploy**.
   - El job despliega en el VPS y notifica el resultado en el Job Summary.

---

## 3. Método Manual en el Servidor (Consola SSH)

Para operar directamente en el VPS:

```bash
ssh -i ~/.ssh/id_ed25519_caprichos_vps deploy@207.244.232.127
cd /opt/caprichos/scripts
```

### 3.1 Desplegar una nueva versión
```bash
./desplegar.sh <demo|staging|prod> <tag>
# Ejemplo:
./desplegar.sh prod v0.3.0
```
**Garantía de despliegue sin corte (Zero-Downtime):**
1. **Migraciones aditivas (Expand/Contract):** Ejecuta `prisma migrate deploy` en un contenedor efímero aislado antes de tocar los contenedores en ejecución. Toda migración debe ser aditiva (agregar tablas o columnas opcionales/con default) para garantizar la compatibilidad hacia atrás durante la coexistencia de versiones. Si la migración falla, **no toca la aplicación en ejecución**.
2. **Rolling Rollout progresivo:** Mediante `docker-rollout` (o escala nativa a 2 instancias sin `container_name` fijo), levanta el nuevo contenedor de la API junto al antiguo. Traefik no le envía tráfico hasta que `/salud` responde HTTP 200 (`healthy`).
3. **Apagado ordenado (SIGTERM):** Una vez que el nuevo contenedor está activo, el antiguo recibe SIGTERM y dispone de 30 segundos (`stop_grace_period: 30s`) para procesar solicitudes y colas en curso antes de detenerse. A continuación se realiza el mismo procedimiento con el frontend Web.
4. **Protección automática ante fallos:** Si el nuevo contenedor no queda saludable en 60 segundos, se elimina automáticamente, se conserva el contenedor original intacto y se ejecuta rollback automático a la versión previa sin corte de servicio.

### 3.2 Forzar Vuelta Atrás Manual (Rollback)
Si después de un despliegue exitoso se detecta un error funcional:
```bash
./volver-atras.sh <demo|staging|prod> [tag_anterior]
# Ejemplo:
./volver-atras.sh prod v0.2.9
```
El script reconfigura el `.env` a la versión previa, ejecuta rolling rollout a la versión anterior y valida su salud mediante IDs dinámicos.

### 3.3 Verificación y Diagnóstico
```bash
# Diagnóstico completo de todos los ambientes y el proxy:
./estado.sh

# Diagnóstico de un solo ambiente:
./estado.sh prod
```
Verifica:
- Estado `Up (healthy)`.
- Uso de CPU y Memoria (límites respetados).
- Respuesta HTTP del endpoint `/salud`.
- **Aislamiento de base de datos:** confirma que PostgreSQL (5432) y Redis (6379) no estén expuestos hacia internet.

### 3.4 Seguimiento de Registros (Logs)
```bash
# Ver registros de Traefik (proxy perimetral y certificados):
./logs.sh proxy

# Ver registros de la API en producción:
./logs.sh prod api

# Ver registros de todos los servicios de staging:
./logs.sh staging
```

---

## 4. Respaldos y Restauración de Datos

### 4.1 Generar Respaldo Inmediato
```bash
./respaldar.sh <demo|staging|prod>
```
Genera:
- Volcado de PostgreSQL (`.sql.gz`) con permisos `0600`.
- Empaquetado del volumen de subidas (`.tar.gz`).
- Rotación automática (conserva 7 días locales).
- Sincronización cifrada con Restic si `/opt/caprichos/restic.env` está configurado.

### 4.2 Probar un Respaldo sin tocar datos (Modo Aislado)
```bash
./restaurar.sh prod /opt/caprichos/respaldos/prod/db_prod_20261024_030000.sql.gz --prueba-local
```
Levanta un contenedor efímero temporal, inyecta el volcado, valida el conteo de tablas y destruye el contenedor de prueba sin tocar la base real.

### 4.3 Restaurar Respaldo en Producción
```bash
./restaurar.sh prod /opt/caprichos/respaldos/prod/db_prod_20261024_030000.sql.gz --confirmar
```

---

## 5. Procedimiento ante Emergencias

| Síntoma | Causa probable | Solución inmediata |
|---|---|---|
| Contenedores en bucle de reinicio | Error fatal en arranque de API o variable faltante | `./logs.sh prod api` -> `./volver-atras.sh prod <tag_anterior>` |
| Error 502 Bad Gateway en navegador | API no responde o caída de base de datos | `./estado.sh prod` -> revisar si PostgreSQL o Redis están sanos |
| Certificado SSL expirado o inválido | Fallo de renovación Let's Encrypt | `./logs.sh proxy` -> comprobar puertos 80/443 en firewall |
| Migración de Prisma bloqueada | Bloqueo de tabla por consulta lenta | Conectar con `psql` -> cancelar consulta bloqueadora -> reintentar despliegue |
