# Caprichos — Orquestación Docker Compose por Ambiente

Este directorio contiene las definiciones de infraestructura mediante Docker Compose para la plataforma Caprichos en sus tres ambientes: **Demo**, **Staging (Pruebas)** y **Producción**.

---

## 1. Arquitectura de Archivos

- `docker-compose.base.yml`: Definición común (límites de memoria, healthchecks formales, red interna aislada, red perimetral de proxy y configuración de volúmenes).
- `docker-compose.demo.yml`: Sobrescritura para el ambiente de demostración (proyecto `caprichos-demo`, etiquetas de Traefik para `sslip.io`, cabecera `X-Robots-Tag: noindex`).
- `docker-compose.staging.yml`: Sobrescritura para pruebas (proyecto `caprichos-staging`, dominio `staging.caprichos.pe`, cabecera `noindex`).
- `docker-compose.prod.yml`: Sobrescritura para producción (proyecto `caprichos-prod`, dominios `caprichos.pe`, `admin.caprichos.pe`, `api.caprichos.pe`, SEO habilitado sin noindex, rate-limit en login y rutas públicas, exige etiqueta inmutable sin `:latest`).
- `.env.example`: Plantilla de variables de entorno para el servidor.

---

## 2. Invocación y Comandos

Cada ambiente combina la base con su sobrescritura correspondiente:

### Demo
```bash
docker compose -f docker-compose.base.yml -f docker-compose.demo.yml config
docker compose -f docker-compose.base.yml -f docker-compose.demo.yml up -d
```

### Staging
```bash
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml config
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml up -d
```

### Producción
```bash
TAG=v0.3.0 docker compose -f docker-compose.base.yml -f docker-compose.prod.yml config
TAG=v0.3.0 docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d
```

Los scripts en `infra/compose/scripts/` automatizan estas invocaciones mediante `./desplegar.sh <ambiente> <tag>`, `./volver-atras.sh <ambiente>`, etc.
