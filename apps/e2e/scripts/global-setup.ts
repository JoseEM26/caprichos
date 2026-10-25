import { FullConfig } from '@playwright/test';
import { spawn, execSync } from 'child_process';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { PUERTO_API, PUERTO_FRONT, REDIS_DB, SLOT } from '../src/credenciales';
import { recrearBaseDatosTest, sembrarDatosPrueba } from './semilla-test';

const STACK_STATE_FILE = path.resolve(__dirname, SLOT ? `../.stack-pids-${SLOT}.json` : '../.stack-pids.json');

function esperarUrl(url: string, timeoutMs = 30000): Promise<void> {
  const inicio = Date.now();
  return new Promise((resolve, reject) => {
    const probar = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
        } else if (Date.now() - inicio > timeoutMs) {
          reject(new Error(`Timeout esperando ${url} (status: ${res.statusCode})`));
        } else {
          setTimeout(probar, 300);
        }
      });
      req.on('error', () => {
        if (Date.now() - inicio > timeoutMs) {
          reject(new Error(`Timeout esperando conexión con ${url}`));
        } else {
          setTimeout(probar, 300);
        }
      });
    };
    probar();
  });
}

export default async function globalSetup(config: FullConfig) {
  console.log('\n[E2E SETUP] 1. Recreando base de datos caprichos_test...');
  const dbUrl = await recrearBaseDatosTest();

  console.log('[E2E SETUP] 2. Sembrando datos fijos de prueba en caprichos_test...');
  const semilla = await sembrarDatosPrueba(dbUrl);
  console.log('[E2E SETUP]    ✓ Datos sembrados (usuarios de prueba, carta, stock, horarios, oferta 2x1).');

  // Guardar contraseñas ÚNICAMENTE en variables de entorno del proceso en memoria
  const mapaClaves: Record<string, string> = {};
  for (const [rol, datos] of Object.entries(semilla.credenciales)) {
    mapaClaves[rol] = datos.clave;
    process.env[`E2E_PASSWORD_${rol}`] = datos.clave;
  }
  process.env.E2E_PASSWORDS = JSON.stringify(mapaClaves);
  process.env.E2E_SUPERVISOR_PIN = semilla.supervisorPin;
  process.env.API_BASE_URL = `http://127.0.0.1:${PUERTO_API}`;
  process.env.FRONT_BASE_URL = `http://127.0.0.1:${PUERTO_FRONT}`;

  const rootDir = path.resolve(__dirname, '../../..');

  const apiLogPath = path.resolve(rootDir, `apps/e2e/.api-${SLOT}.log`);
  const webLogPath = path.resolve(rootDir, `apps/e2e/.web-${SLOT}.log`);
  const apiLogStream = fs.createWriteStream(apiLogPath, { flags: 'w' });
  const webLogStream = fs.createWriteStream(webLogPath, { flags: 'w' });

  console.log(`[E2E SETUP] 3. Levantando API compilada en puerto ${PUERTO_API}...`);
  try {
    execSync(`fuser -k ${PUERTO_API}/tcp ${PUERTO_FRONT}/tcp || true`, { stdio: 'ignore' });
  } catch {}
  const apiProcess = spawn('node', ['apps/api/dist/main.js'], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(PUERTO_API),
      NODE_ENV: 'test',
      DATABASE_URL: dbUrl,
      REDIS_URL: `redis://127.0.0.1:6389/${REDIS_DB}`,
      JWT_SECRET: 'secreto-test-jwt-super-seguro-min-32-chars!!',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  apiProcess.stdout?.pipe(apiLogStream);
  apiProcess.stderr?.pipe(apiLogStream);

  apiProcess.on('error', (err) => {
    console.error('[E2E API Error]', err);
  });

  console.log(`[E2E SETUP] 4. Levantando Front en puerto ${PUERTO_FRONT} (vite preview)...`);
  // Asegurar que apps/web/dist existe
  if (!fs.existsSync(path.resolve(rootDir, 'apps/web/dist/index.html'))) {
    console.log('[E2E SETUP] Compilando apps/web...');
    execSync('pnpm --filter @caprichos/web build', { cwd: rootDir, stdio: 'inherit' });
  }

  const webProcess = spawn(
    'pnpm',
    ['--filter', '@caprichos/web', 'preview', '--port', String(PUERTO_FRONT), '--host', '127.0.0.1'],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        API_TARGET_URL: `http://127.0.0.1:${PUERTO_API}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  webProcess.stdout?.pipe(webLogStream);
  webProcess.stderr?.pipe(webLogStream);

  webProcess.on('error', (err) => {
    console.error('[E2E WEB Error]', err);
  });

  console.log(`[E2E SETUP] 5. Esperando disponibilidad del stack (API :${PUERTO_API} y Front :${PUERTO_FRONT})...`);
  await Promise.all([
    esperarUrl(`http://127.0.0.1:${PUERTO_API}/salud`, 30000),
    esperarUrl(`http://127.0.0.1:${PUERTO_FRONT}`, 30000),
  ]);
  console.log(`[E2E SETUP]    ✓ Stack aislado listo y operativo en :${PUERTO_API} y :${PUERTO_FRONT}.`);

  // Guardar solo los PIDs para apagado en globalTeardown (NUNCA credenciales)
  fs.writeFileSync(
    STACK_STATE_FILE,
    JSON.stringify({
      apiPid: apiProcess.pid,
      webPid: webProcess.pid,
    }),
  );
}
