import { CartaEventosController } from '../carta-eventos.controller';
import { CartaEventosService, LIMITE_POR_MINUTO, RETENCION_DIAS } from '../carta-eventos.service';

function montar(opts: { redisFalla?: boolean; baseFalla?: boolean } = {}) {
  let n = 0;
  const redis: any = {
    obtenerCliente: () => ({
      incr: async () => {
        if (opts.redisFalla) throw new Error('redis caído');
        return ++n;
      },
      expire: async () => 1,
      set: async () => 'OK',
      eval: async () => 1,
    }),
  };
  const create = jest.fn(async (a: any) => {
    if (opts.baseFalla) throw new Error('base caída');
    return a;
  });
  const prisma: any = {
    cartaEvento: { create, findFirst: jest.fn(async () => ({ dispositivo: 'MOVIL', con_sesion: true })), deleteMany: jest.fn(async () => ({ count: 4 })) },
  };
  return { s: new CartaEventosService(prisma, redis), prisma, create };
}

const bueno = { sesion: 'abcDEF123456', evento: 'VISITA', dispositivo: 'MOVIL', conSesion: false };

describe('CartaEventosService', () => {
  it('guarda solo los campos permitidos: sin celular, nombre, IP ni user-agent', async () => {
    const { s, create } = montar();
    await s.registrar({ ...bueno, telefono: '999111222', nombre: 'Ana', ip: '1.2.3.4', ua: 'Mozilla' } as any, '1.2.3.4');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toEqual({ sesion_id: 'abcDEF123456', evento: 'VISITA', dispositivo: 'MOVIL', con_sesion: false });
  });

  it('lista cerrada de eventos: PEDIDO o cualquier otro texto se ignora (el pedido lo enlaza solo el servidor)', async () => {
    const { s, create } = montar();
    for (const evento of ['PEDIDO', 'visita', 'DROP TABLE', '', 5, null, undefined]) await s.registrar({ ...bueno, evento });
    await s.registrar(null);
    await s.registrar('texto' as any);
    expect(create).not.toHaveBeenCalled();
  });

  it('valida el id de sesión (tamaño mínimo y caracteres) y el dispositivo; lo inválido no guarda datos libres', () => {
    const { s } = montar();
    expect(s.validar({ ...bueno, sesion: 'corto' })?.sesion).toBeNull();
    expect(s.validar({ ...bueno, sesion: 'x'.repeat(41) })?.sesion).toBeNull();
    expect(s.validar({ ...bueno, sesion: 'con espacios y <script>' })?.sesion).toBeNull();
    expect(s.validar({ ...bueno, dispositivo: 'Mozilla/5.0 (X11)' })?.dispositivo).toBe('DESCONOCIDO');
    expect(s.validar({ ...bueno, conSesion: 'true' })?.conSesion).toBe(false);
  });

  it('rate-limit: pasado el tope por minuto no guarda más', async () => {
    const { s, create } = montar();
    for (let i = 0; i < LIMITE_POR_MINUTO + 10; i++) await s.registrar(bueno, '9.9.9.9');
    expect(create).toHaveBeenCalledTimes(LIMITE_POR_MINUTO);
  });

  it('si Redis falla deja pasar; si la base falla no lanza (la carta nunca se entera)', async () => {
    const a = montar({ redisFalla: true });
    await expect(a.s.registrar(bueno)).resolves.toBeUndefined();
    expect(a.create).toHaveBeenCalledTimes(1);
    const b = montar({ baseFalla: true });
    await expect(b.s.registrar(bueno)).resolves.toBeUndefined();
  });

  it('el controlador responde sin cuerpo (204) y no relanza errores', async () => {
    const { s } = montar({ baseFalla: true });
    const c = new CartaEventosController(s);
    await expect(c.registrar(bueno as any, { ip: '1.1.1.1' } as any)).resolves.toBeUndefined();
    expect(Reflect.getMetadata('__httpCode__', CartaEventosController.prototype.registrar)).toBe(204);
  });

  it('enlazarPedido: hereda dispositivo y sesión del último evento y tolera el reintento idempotente', async () => {
    const { s, create } = montar();
    await s.enlazarPedido('42', 'abcDEF123456');
    expect(create.mock.calls[0][0].data).toMatchObject({ evento: 'PEDIDO', pedido_id: 42n, sesion_id: 'abcDEF123456', dispositivo: 'MOVIL', con_sesion: true });
    create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    await expect(s.enlazarPedido('42', 'abcDEF123456')).resolves.toBeUndefined();
    await s.enlazarPedido(43n, 'basura con espacios');
    expect(create.mock.calls[2][0].data).toMatchObject({ sesion_id: null, dispositivo: 'DESCONOCIDO', con_sesion: false });
  });

  it('retención: borra solo los eventos con más de 120 días', async () => {
    const { s, prisma } = montar();
    const ahora = new Date('2026-11-12T12:00:00Z');
    expect(await s.limpiar(ahora)).toBe(4);
    const corte: Date = prisma.cartaEvento.deleteMany.mock.calls[0][0].where.creado_en.lt;
    expect(RETENCION_DIAS).toBe(120);
    expect(Math.round((ahora.getTime() - corte.getTime()) / 86_400_000)).toBe(120);
  });
});
