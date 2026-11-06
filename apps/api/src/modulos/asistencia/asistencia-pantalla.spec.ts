// El guard arrastra @nestjs/jwt (ESM); aquí solo importan decoradores y rutas.
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

import { NotFoundException } from '@nestjs/common';
import { AsistenciaService } from './asistencia.service';
import { CLAVE_ENLACE_PANTALLA } from './asistencia.pantalla';
import { slotDe } from './asistencia.qr';

// Enlace público de la pantalla: token válido, inválido, regenerado, desactivado.

const AHORA = new Date('2026-11-06T13:00:10Z');
const JWT = 'secreto-prueba';

function servicio() {
  const filas = new Map<string, { clave: string; valor: any }>();
  const prisma: any = {
    parametro: {
      findUnique: async ({ where }: any) => filas.get(where.clave) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existe = filas.get(where.clave);
        const fila = existe ? { ...existe, valor: update.valor } : { clave: where.clave, valor: create.valor };
        filas.set(where.clave, fila);
        return fila;
      },
      deleteMany: async ({ where }: any) => {
        filas.delete(where.clave);
        return { count: 1 };
      },
    },
  };
  const config: any = { get: (_k: string, def: string) => (_k === 'JWT_SECRET' ? JWT : def) };
  const auditoria: any = { registrar: async () => undefined };
  const svc = new AsistenciaService(prisma, config, auditoria);
  return { svc, filas };
}

// El token se extrae de la ruta que devuelve el servicio: /asistencia/pantalla/<token>
const tokenDe = (ruta: string) => ruta.replace('/asistencia/pantalla/', '');

describe('enlace público de la pantalla del local', () => {
  it('token válido devuelve el QR de la ranura vigente, igual que la pantalla admin', async () => {
    const { svc } = servicio();
    const { ruta } = await svc.generarEnlacePantalla();
    const r = await svc.qrPantallaPublica(tokenDe(ruta), AHORA);
    expect(r.slot).toBe(slotDe(AHORA.getTime()));
    expect(r.qr).toMatch(/^data:image\/png;base64,/);
    expect(r.codigo).toMatch(/^\d{3} \d{3}$/);
    expect(Object.keys(r).sort()).toEqual(['ahora', 'cambiaEn', 'codigo', 'qr', 'slot', 'ventanaSeg']);
  });

  it('token inválido, o sin enlace activo, responde 404 sin pistas', async () => {
    const { svc } = servicio();
    await expect(svc.qrPantallaPublica('cualquiera', AHORA)).rejects.toBeInstanceOf(NotFoundException);
    const { ruta } = await svc.generarEnlacePantalla();
    await expect(svc.qrPantallaPublica(tokenDe(ruta) + 'x', AHORA)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.qrPantallaPublica('', AHORA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('regenerar invalida el enlace anterior', async () => {
    const { svc } = servicio();
    const viejo = tokenDe((await svc.generarEnlacePantalla()).ruta);
    const nuevo = tokenDe((await svc.generarEnlacePantalla()).ruta);
    expect(nuevo).not.toBe(viejo);
    await expect(svc.qrPantallaPublica(viejo, AHORA)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.qrPantallaPublica(nuevo, AHORA)).resolves.toMatchObject({ slot: slotDe(AHORA.getTime()) });
  });

  it('desactivar deja el enlace sin efecto y el estado en inactivo', async () => {
    const { svc } = servicio();
    const token = tokenDe((await svc.generarEnlacePantalla()).ruta);
    expect(await svc.estadoEnlacePantalla()).toMatchObject({ activo: true });
    await svc.desactivarEnlacePantalla();
    expect(await svc.estadoEnlacePantalla()).toEqual({ activo: false, generadoEn: null });
    await expect(svc.qrPantallaPublica(token, AHORA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('en la BD solo queda el sha256 del token, nunca el token en claro', async () => {
    const { svc, filas } = servicio();
    const { ruta } = await svc.generarEnlacePantalla();
    const token = tokenDe(ruta);
    const guardado = JSON.stringify(filas.get(CLAVE_ENLACE_PANTALLA)?.valor);
    expect(guardado).not.toContain(token);
    expect(guardado).toMatch(/"tokenHash":"[0-9a-f]{64}"/);
    expect(token.length).toBeGreaterThanOrEqual(43); // 32 bytes en base64url
  });
});

// Prefijos que Traefik manda a la API: /admin y /carta. Por eso la app móvil y el QR público cuelgan de ellos.
describe('rutas de asistencia que llegan a la API', () => {
  const { PATH_METADATA } = require('@nestjs/common/constants');
  const { AsistenciaController } = require('./asistencia.controller');
  const { AsistenciaPantallaPublicaController } = require('./asistencia-pantalla.controller');
  const { PropinasMiController } = require('../propinas/propinas-reparto.controller');

  it('Mi asistencia y marcar cuelgan de admin/asistencia', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AsistenciaController)).toBe('admin/asistencia');
    expect(Reflect.getMetadata(PATH_METADATA, PropinasMiController)).toBe('admin/asistencia');
  });

  it('el QR público cuelga de /carta', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AsistenciaPantallaPublicaController)).toBe('carta/asistencia-pantalla');
  });
});
