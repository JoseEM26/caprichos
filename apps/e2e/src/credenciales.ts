import { execSync } from 'child_process';
import * as crypto from 'crypto';

export type RolPrueba = 'ADMIN' | 'CAJERO' | 'MOZO' | 'COCINA' | 'ALMACEN' | 'REPARTIDOR' | 'REPARTIDOR_2';

export const DNIS_POR_ROL: Record<RolPrueba, string> = {
  ADMIN: '20000001',
  CAJERO: '20000002',
  MOZO: '20000003',
  COCINA: '20000004',
  ALMACEN: '20000005',
  REPARTIDOR: '20000006',
  REPARTIDOR_2: '20000007',
};

const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz!@#$%&*';

export function generarClaveSegura(): string {
  const bytes = crypto.randomBytes(16);
  let res = '';
  for (let i = 0; i < 16; i++) {
    res += CHARSET[bytes[i] % CHARSET.length];
  }
  return res;
}

export function obtenerCredencialesPg(): {
  user: string;
  pass: string;
  host: string;
  port: number;
} {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) {
    try {
      const u = new URL(envUrl);
      return {
        user: decodeURIComponent(u.username || 'caprichos'),
        pass: decodeURIComponent(u.password || ''),
        host: u.hostname || '127.0.0.1',
        port: Number(u.port) || 5442,
      };
    } catch {
      // Ignorar error de parseo y fallback a docker
    }
  }

  try {
    const rawEnv = execSync(
      "docker inspect caprichos-pg-dev --format '{{range .Config.Env}}{{println .}}{{end}}'",
      { stdio: ['ignore', 'pipe', 'ignore'] },
    ).toString();

    const userMatch = rawEnv.match(/^POSTGRES_USER=(.*)$/m);
    const passMatch = rawEnv.match(/^POSTGRES_PASSWORD=(.*)$/m);

    const user = userMatch ? userMatch[1].trim() : 'caprichos';
    const pass = passMatch ? passMatch[1].trim() : '';

    return {
      user,
      pass,
      host: '127.0.0.1',
      port: 5442,
    };
  } catch (err: any) {
    throw new Error('No se pudieron leer las credenciales de caprichos-pg-dev');
  }
}

export function obtenerDbUrl(dbName = NOMBRE_DB): string {
  const creds = obtenerCredencialesPg();
  return `postgresql://${encodeURIComponent(creds.user)}:${encodeURIComponent(creds.pass)}@${creds.host}:${creds.port}/${dbName}?schema=public`;
}

export function obtenerDniRol(rol: RolPrueba): string {
  return DNIS_POR_ROL[rol];
}

export function obtenerClaveRol(rol: RolPrueba): string {
  if (process.env.E2E_PASSWORDS) {
    try {
      const mapa = JSON.parse(process.env.E2E_PASSWORDS);
      if (mapa[rol]) return mapa[rol];
    } catch {
      // fallback
    }
  }
  const variableIndividual = process.env[`E2E_PASSWORD_${rol}`];
  if (variableIndividual) return variableIndividual;

  throw new Error(`No se encontró en memoria la contraseña generada para el rol ${rol}`);
}

// Cada ranura (E2E_SLOT) tiene su propia base, puertos y base de Redis: permite correr suites en paralelo sin pisarse.
export const SLOT = Number(process.env.E2E_SLOT || 0);
export const NOMBRE_DB = SLOT ? `caprichos_test_${SLOT}` : 'caprichos_test';
export const PUERTO_API = 3100 + SLOT;
export const PUERTO_FRONT = 5273 + SLOT;
export const REDIS_DB = 2 + SLOT;
