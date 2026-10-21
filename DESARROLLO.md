# Guía de Desarrollo Local — Plataforma Caprichos

Esta guía describe cómo configurar y levantar el entorno de desarrollo local de la plataforma digital de **Caprichos** (café artesanal en Lima).

---

## 1. Requisitos Previos

- **Node.js**: v24.x (ver `.nvmrc`)
- **pnpm**: v12.x
- **Docker** y **Docker Compose** (para PostgreSQL 16 y Redis 7)

---

## 2. Instalación en Pocos Pasos

### Paso 1: Instalar dependencias
En la raíz del proyecto, ejecuta:
```bash
pnpm install
```

### Paso 2: Generar el cliente de Prisma
Genera el cliente de Prisma para `@caprichos/api`:
```bash
pnpm --filter @caprichos/api prisma:generate
```

### Paso 3: Levantar la infraestructura local (PostgreSQL 16 y Redis 7)
Levanta los servicios de base de datos y colas con Docker Compose:
```bash
docker compose up -d postgres redis
```

Verifica que los contenedores estén saludables:
```bash
docker compose ps
```

### Paso 4: Variables de entorno
El proyecto incluye valores de entorno por defecto para desarrollo local. Si requieres personalizar puertos o credenciales, copia la plantilla:
```bash
cp .env.example .env
```
*(Nota de seguridad: Nunca coloques credenciales de producción ni claves reales en `.env`)*.

---

## 3. Ejecución en Modo Desarrollo

Puedes ejecutar los servicios individualmente o en conjunto:

### Iniciar la API NestJS:
```bash
pnpm dev:api
# o alternativamente:
pnpm --filter @caprichos/api start:dev
```
La API estará disponible en `http://localhost:3000`.

### Iniciar el Frontend Web (React + Vite):
```bash
pnpm dev:web
# o alternativamente:
pnpm --filter @caprichos/web dev
```
La aplicación web estará disponible en `http://localhost:5173`.

---

## 4. Endpoints de Verificación

Una vez levantada la API:

- **Salud del sistema (PostgreSQL + Redis):**
  ```bash
  curl http://localhost:3000/salud
  ```
  Respuesta esperada (HTTP 200 si todo está saludable; HTTP 503 si falla la base o Redis):
  ```json
  {
    "estado": "ok",
    "timestamp": "2026-10-20T...",
    "detalles": {
      "base": { "estado": "conectado" },
      "redis": { "estado": "conectado" }
    }
  }
  ```

- **Versión y commit desplegados:**
  ```bash
  curl http://localhost:3000/version
  ```
  Respuesta esperada:
  ```json
  {
    "version": "0.1.0",
    "commit": "dev-local",
    "ambiente": "development"
  }
  ```

---

## 5. Scripts de Verificación y Calidad

El monorepo cuenta con un contrato estricto de scripts en el `package.json` raíz:

| Comando | Acción |
|---|---|
| `pnpm lint` | Ejecuta ESLint en todos los paquetes y apps |
| `pnpm test` | Ejecuta las pruebas unitarias y de integración (Jest) |
| `pnpm build` | Compila `@caprichos/compartido`, `@caprichos/agente-local`, `@caprichos/api` y `@caprichos/web` |
| `pnpm check:deps` | Valida con `dependency-cruiser` que los módulos de la API no violen el encapsulamiento |

---

## 6. Levantar Todo con Docker Compose

Si deseas correr todo el stack completo (Postgres, Redis, API y Web) dentro de contenedores:
```bash
docker compose up -d
```
Para detener los servicios:
```bash
docker compose down
```
