import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const STACK_STATE_FILE = path.resolve(__dirname, process.env.E2E_SLOT ? `../.stack-pids-${process.env.E2E_SLOT}.json` : '../.stack-pids.json');

export default async function globalTeardown(config: FullConfig) {
  console.log('\n[E2E TEARDOWN] Apagando stack aislado...');
  if (fs.existsSync(STACK_STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STACK_STATE_FILE, 'utf8'));
      if (data.apiPid) {
        try {
          process.kill(data.apiPid, 'SIGTERM');
        } catch { /* el proceso pudo terminar antes; se ignora */ }
      }
      if (data.webPid) {
        try {
          process.kill(data.webPid, 'SIGTERM');
        } catch { /* el proceso pudo terminar antes; se ignora */ }
      }
      try {
        const slot = Number(process.env.E2E_SLOT || 0);
        const pApi = 3100 + slot;
        const pFront = 5273 + slot;
        execSync(`fuser -k ${pApi}/tcp ${pFront}/tcp || true`, { stdio: 'ignore' });
      } catch { /* fuser falla si no hay procesos en el puerto; se ignora */ }
    } catch { /* limpieza best-effort del entorno e2e; no debe cortar el apagado */ }
    try {
      fs.unlinkSync(STACK_STATE_FILE);
    } catch { /* el archivo de estado puede no existir */ }
  }
  console.log('[E2E TEARDOWN] Stack apagado correctamente.');
}
