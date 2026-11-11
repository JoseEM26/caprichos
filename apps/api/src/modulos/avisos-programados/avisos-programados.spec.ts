jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { PcImpresionAvisoService } from './pc-impresion-aviso.service';
import { ChatSinResponderAvisoService } from './chat-sin-responder-aviso.service';
import { enteroEnRango, interruptorEncendido, recortar, aMinutosLima } from './avisos-programados.util';
import { agenteConectado, LATIDO_VIGENTE_MS } from '../impresion';

describe('utilidades de avisos programados', () => {
  it('recortar deja una sola línea y máximo N caracteres', () => {
    expect(recortar('hola\n\n  mundo', 50)).toBe('hola mundo');
    expect(recortar('x'.repeat(130), 120)).toHaveLength(120);
  });
  it('enteroEnRango cae al defecto si falta o se sale del rango', () => {
    expect(enteroEnRango(undefined, 15, 5, 120)).toBe(15);
    expect(enteroEnRango(4, 15, 5, 120)).toBe(15);
    expect(enteroEnRango(30, 15, 5, 120)).toBe(30);
    expect(enteroEnRango('abc', 15, 5, 120)).toBe(15);
  });
  it('interruptorEncendido: encendido salvo "no" o false', () => {
    expect([undefined, 'si', true, 'SI'].every(interruptorEncendido)).toBe(true);
    expect(['no', ' No ', false].some(interruptorEncendido)).toBe(false);
  });
  it('aMinutosLima', () => expect(aMinutosLima('08:30')).toBe(510));
  it('«en línea» es exactamente la regla de la pantalla de impresión: latido de 60 s o menos', () => {
    expect(LATIDO_VIGENTE_MS).toBe(60_000);
    const ahora = Date.now();
    expect(agenteConectado(new Date(ahora - 60_000), ahora)).toBe(true);
    expect(agenteConectado(new Date(ahora - 60_001), ahora)).toBe(false);
  });
});

describe('PcImpresionAvisoService (con mocks)', () => {
  const ahora = new Date('2031-03-04T13:20:00.000Z'); // 08:20 en Lima
  function armar(params: Record<string, unknown> = {}, caja: any = { id: 1n, estado: 'ABIERTA' }) {
    const marcas = new Map<string, any>();
    const prisma: any = {
      parametro: { findUnique: async ({ where }: any) => (where.clave in params ? { valor: params[where.clave] } : null) },
      caja: { findUnique: async () => caja },
      auditoria: { findFirst: async () => ({ en: new Date('2031-03-04T13:00:00.000Z') }) },
      avisoMarca: {
        findUnique: async ({ where }: any) => marcas.get(where.clave) ?? null,
        create: async ({ data }: any) => {
          if (marcas.has(data.clave)) throw Object.assign(new Error('dup'), { code: 'P2002' });
          marcas.set(data.clave, data);
        },
        update: async ({ where, data }: any) => Object.assign(marcas.get(where.clave), data),
      },
      deviceKey: {
        findMany: async () => [
          { id: 1n, nombre: 'PC Uno', activo: true, ultimo_latido: new Date(ahora.getTime() - 5000), configImpresion: { etiquetera: true } },
          { id: 2n, nombre: 'PC Dos', activo: true, ultimo_latido: new Date(ahora.getTime() - 3600_000), configImpresion: { ticketera: true }, area: { nombre: 'Cocina' } },
        ],
      },
    };
    const avisos = { avisar: jest.fn().mockResolvedValue(null) };
    return { svc: new PcImpresionAvisoService(prisma, {} as any, avisos as any), avisos };
  }
  it('1 de 2 en línea: un correo con el equipo que falta y su función', async () => {
    const { svc, avisos } = armar();
    expect(await svc.revisar(ahora)).toMatchObject({ accion: 'enviado', enLinea: 1, vinculados: 2, faltan: ['PC Dos'] });
    expect(avisos.avisar.mock.calls[0][0].texto).toContain('PC Dos (ticketera y área Cocina): sin señal desde las 07:20 (hace 60 min)');
  });
  it('interruptor apagado o caja sin abrir: nada', async () => {
    const a = armar({ aviso_pc_impresion_activo: 'no' });
    expect(await a.svc.revisar(ahora)).toEqual({ accion: 'apagado' });
    const b = armar({}, null);
    expect(await b.svc.revisar(ahora)).toEqual({ accion: 'sin_caja' });
    expect(a.avisos.avisar).not.toHaveBeenCalled();
    expect(b.avisos.avisar).not.toHaveBeenCalled();
  });
});

describe('ChatSinResponderAvisoService (con mocks)', () => {
  const ahora = new Date('2031-03-04T17:00:00.000Z'); // 12:00 en Lima
  function armar(filas: any[], estado: any = { abierta: true, motivo: 'OK', abre: '08:00', cierra: '22:00' }) {
    const prisma: any = {
      parametro: { findUnique: async () => null },
      $queryRaw: jest.fn().mockResolvedValue(filas),
      avisoMarca: { findMany: async () => [], count: async () => 0, create: async () => ({}) },
    };
    const avisos = { avisar: jest.fn().mockResolvedValue(null) };
    const local = { obtenerEstadoCartaSeguro: jest.fn().mockResolvedValue(estado) };
    const svc = new ChatSinResponderAvisoService(prisma, {} as any, avisos as any, local as any, { get: () => undefined } as any);
    return { svc, prisma, avisos };
  }
  const fila = (extra: any = {}) => ({
    id: 1n, telefono: '900000001', nombre_contacto: null, identificador_tipo: 'TELEFONO', motivo_derivacion: null,
    mid: 5n, en: new Date(ahora.getTime() - 20 * 60_000), tipo: 'TEXTO', contenido: { texto: 'Hola' }, ...extra,
  });
  it('fuera de horario ni consulta la base de chats', async () => {
    const { svc, prisma, avisos } = armar([fila()], { abierta: false, motivo: 'HORARIO', abre: '08:00', cierra: '11:00' });
    expect((await svc.revisar(ahora)).accion).toBe('fuera_de_horario');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(avisos.avisar).not.toHaveBeenCalled();
  });
  it('un chat bloqueado por spam no avisa; uno normal sí, con enlace relativo si no hay dominio configurado', async () => {
    const { svc, avisos } = armar([fila({ id: 2n, motivo_derivacion: 'BLOQUEADO_SPAM' }), fila()]);
    const r = await svc.revisar(ahora);
    expect(r.individuales).toBe(1);
    expect(avisos.avisar.mock.calls[0][0].texto).toContain('Abrir el chat: /admin/mensajes?telefono=900000001');
  });
  it('la pausa por alta demanda sigue siendo horario de atención', async () => {
    const { svc } = armar([fila()], { abierta: false, motivo: 'PAUSA', abre: null, cierra: null });
    expect((await svc.revisar(ahora)).individuales).toBe(1);
  });
});
