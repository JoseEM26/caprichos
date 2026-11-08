# Infraestructura de Pruebas End-to-End (E2E) - Caprichos

Este paquete contiene la infraestructura aislada y la suite de pruebas de extremo a extremo utilizando Playwright y Google Chrome.

## Arquitectura y Aislamiento

Las pruebas corren contra un stack completamente aislado para no interferir con el entorno de desarrollo del usuario:

- **Base de datos:** `caprichos_test` en el contenedor Docker `caprichos-pg-dev`. En cada ejecución, el script `globalSetup` realiza DROP/CREATE de `caprichos_test`, ejecuta `prisma migrate deploy` y carga una semilla determinista de prueba. Las bases `caprichos` y `caprichos_e2e` nunca son alteradas.
- **Credenciales:** Se leen en tiempo de ejecución desde `docker inspect caprichos-pg-dev` o variables de entorno del proceso. No se almacenan contraseñas en archivos de disco ni en repositorios.
- **API aislada:** Se levanta en el puerto `3100` apuntando a `caprichos_test` y a Redis en `redis://127.0.0.1:6389/2` (base de datos Redis 2, separada de la base 0 de desarrollo).
- **Frontend web aislado:** Se levanta en el puerto `5273` apuntando al backend en `:3100`.
- **Navegador:** Utiliza el binario de Google Chrome instalado en el sistema (`/usr/bin/google-chrome`).

## Cómo ejecutar las pruebas

Desde la raíz del monorepo:

```bash
# Ejecutar todas las pruebas e2e
pnpm e2e

# O mediante el filtro directo de pnpm
pnpm --filter @caprichos/e2e test
```

Para ejecutar una prueba específica:

```bash
pnpm --filter @caprichos/e2e test tests/humo.spec.ts
```

Para ver el reporte HTML generado:

```bash
pnpm --filter @caprichos/e2e exec playwright show-report playwright-report
```

## Usuarios y datos de la semilla

La semilla crea los siguientes datos mínimos en `caprichos_test`:

- **Roles y permisos:** Matriz oficial de permisos y roles del sistema.
- **Áreas y almacenes:** Barra, Cocina y Almacén central.
- **Categorías:** Cafetería, Waffles y Postres, Salados.
- **Productos:** 8 productos con precios configurados (ej. Café Americano S/ 10.00).
- **Insumos y recetas:** Insumo Café en grano con receta de 18 g por Café Americano y stock inicial en almacén y barra.
- **Ofertas:** Promoción 2x1 en Café Americano (tipo LLEVA_PAGA).
- **Horario:** Local abierto de 00:00 a 23:59 los 7 días de la semana.
- **Usuarios de prueba:**
  - ADMIN: DNI `20000001` (acceso total, sin código de supervisor).
  - CAJERO: DNI `20000002`.
  - MOZO: DNI `20000003`.
  - COCINA: DNI `20000004`.
  - ALMACEN: DNI `20000005`.
  - REPARTIDOR: DNI `20000006`.
  - Las contraseñas se generan de forma criptográfica en memoria en cada ejecución y se pasan a las pruebas vía `process.env.E2E_PASSWORDS`.

## Cómo agregar una prueba

1. Crear el archivo dentro de la carpeta correspondiente según el dominio:
   - `tests/pedido/`: Flujos de creación, atención y seguimiento de pedidos.
   - `tests/caja/`: Flujos de cobros, apertura, movimientos y arqueos de caja.
   - `tests/almacen/`: Flujos de stock, insumos y traslados.
   - `tests/roles/`: Permisos y accesos por rol.
2. Utilizar los helpers compartidos en `src`:

```typescript
import { test, expect } from '@playwright/test';
import { loginPorUi, loginPorApi, confirmarSiNo, obtenerStockInsumo } from '../src';

test('ejemplo de prueba', async ({ page }) => {
  // Iniciar sesión por UI con el rol deseado
  await loginPorUi(page, 'ADMIN');

  // Navegar e interactuar con la aplicación
  await page.goto('/admin/pedidos');

  // Si se abre un diálogo de confirmación:
  // await confirmarSiNo(page, 'si');

  // Si se desea verificar datos directamente en la base de datos de prueba:
  // const stock = await obtenerStockInsumo('Café en grano');
  // expect(stock).toBeGreaterThan(0);
});
```

## Ranuras para correr suites en paralelo

`E2E_SLOT=N pnpm e2e` usa la base `caprichos_test_N`, la API en `3100+N`, el front en `5273+N` y la base 2+N de Redis, y no pisa a otras ranuras. Sin la variable se usa la ranura 0 (`caprichos_test`, 3100, 5273).
