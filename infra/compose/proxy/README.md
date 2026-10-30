# Proxy Traefik Autónomo — Caprichos

Este directorio (`infra/compose/proxy/`) contiene la definición del proxy perimetral de Caprichos, sustituyendo formalmente al contenedor `dokploy-traefik` gestionado por Dokploy.

---

## 1. Justificación de Elección: Traefik vs Caddy

Se evaluó **Traefik v3** frente a **Caddy**:
- **Por qué Traefik:**
  1. **Compatibilidad total con el stack actual:** Toda la infraestructura existente en `infra/demo/` ya define etiquetas declarativas de Traefik (`traefik.http.routers.*`, `middlewares`, `ratelimit`, etc.). Traefik interpreta estas etiquetas de forma nativa desde el socket Docker sin requerir sidecars ni plugins de terceros.
  2. **Descubrimiento dinámico sin recargas de proceso:** Traefik detecta el encendido, apagado y actualización de contenedores a través de eventos de Docker, sin necesitar renderizar archivos de configuración ni reiniciar servicios proxy.
  3. **Gestión ACME (Let's Encrypt) nativa:** Soporta desafío HTTP y TLS-ALPN con almacenamiento seguro en volumen (`acme.json`), tanto para subdominios dinámicos (`sslip.io`) como para dominios propios (`caprichos.pe`).
  4. **Compatibilidad con Cloudflare:** Configuración directa de `forwardedHeaders.trustedIPs` con los rangos CIDR oficiales de Cloudflare (IPv4 e IPv6), preservando la IP real del cliente para auditoría y rate limiting.
  5. **Modo dual de certificados:** Permite operar con Let's Encrypt hoy, o cargar un Certificado de Origen de Cloudflare montando `certs/` sin cambiar la arquitectura de contenedores.
- **Por qué no Caddy:** Aunque Caddy es excelente y ligero, en entornos basados en Docker Compose requiere plugins externos (como `caddy-docker-proxy`) para configuración basada en etiquetas, o el mantenimiento manual de un `Caddyfile` estático que debe ser actualizado cada vez que cambian rutas o ambientes.

---

## 2. Procedimiento de Coexistencia y Transición sin Corte

Actualmente el VPS corre Dokploy con `dokploy-traefik` ocupando los puertos 80 y 443. Para migrar sin corte perceptible:

### Paso 1: Crear la red externa compartida
```bash
docker network create caprichos-proxy-net 2>/dev/null || true
```

### Paso 2: Preparar archivos del proxy en el servidor
Copiar `infra/compose/proxy/` a `/opt/caprichos/proxy/` en el VPS.
```bash
cd /opt/caprichos/proxy
cp .env.example .env
chmod 600 .env
```

### Paso 3: Conmutación de tráfico
1. Detener el contenedor de Dokploy:
   ```bash
   docker stop dokploy-traefik
   ```
2. Inmediatamente iniciar el proxy autónomo:
   ```bash
   docker compose up -d
   ```
3. Verificar en los logs que Traefik haya adquirido los puertos 80 y 443 y comience a atender tráfico:
   ```bash
   docker compose logs -f
   ```

### Vuelta atrás de emergencia (Rollback)
Si el nuevo proxy presentase cualquier anomalía:
```bash
docker compose down
docker start dokploy-traefik
```
El tiempo de corte en ambos sentidos es de menos de 2 segundos.

---

## 3. Desactivación de Docker Swarm (`docker swarm leave`)

Dokploy inicializa Docker en modo Swarm para desplegar sus propios servicios internos. 

### ¿Es necesario dejar Swarm?
Docker Compose funciona perfectamente tanto en Docker standalone como en hosts donde Swarm esté inicializado (siempre que los contenedores no utilicen la malla de enrutamiento ingress de Swarm en los mismos puertos).
Sin embargo, **para eliminar dependencias residuales de Dokploy a largo plazo**, se recomienda ejecutar:
```bash
docker swarm leave --force
```

### Riesgos y Precauciones de `docker swarm leave --force`:
- **Destrucción de servicios de Dokploy:** Al ejecutar `swarm leave`, todos los servicios definidos como `docker service` (incluyendo Dokploy, su panel web y redes overlay como `dokploy-network`) se detienen y desaparecen de inmediato.
- **Momento correcto para ejecutarlo:** Solo debe ejecutarse **después** de haber migrado la demo, staging y producción al nuevo esquema de Docker Compose y haber comprobado que ningún servicio depende de Dokploy.
- **Una vez ejecutado:** La máquina queda en modo Docker estándar limpio, con menor consumo de memoria y sin procesos en segundo plano de orquestación de clúster.

---

## 4. Cloudflare: Let's Encrypt vs Certificado de Origen

- **Fase 1 (Actual - Sin dominio o sslip.io):**
  Traefik utiliza el resolver `letsencrypt` mediante desafío HTTP (`entryPoint: web`). El tráfico llega directo al VPS (puertos 80 y 443 abiertos en UFW).
- **Fase 2 (Con dominio caprichos.pe y Cloudflare Proxied):**
  - Si se utiliza **Full (strict)** con Let's Encrypt: Cloudflare debe permitir pasar el tráfico de verificación ACME hacia el origen (por defecto Cloudflare pasa `/.well-known/acme-challenge/`).
  - Si se utiliza **Certificado de Origen de Cloudflare (Recomendado según ADR-011):**
    1. Se genera un Origin Certificate con 15 años de validez en Cloudflare para `*.caprichos.pe` y `caprichos.pe`.
    2. Se guardan en `/opt/caprichos/proxy/certs/caprichos_origin_cert.pem` y `caprichos_origin_key.pem`.
    3. Se descomenta el bloque en `/opt/caprichos/proxy/dynamic/tls.yml`.
    4. Se restringen los puertos 80/443 en UFW exclusivamente a las IPs de Cloudflare (`proxy_cloudflare: true` en Ansible).
