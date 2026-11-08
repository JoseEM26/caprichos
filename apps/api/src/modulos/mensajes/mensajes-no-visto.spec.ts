jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
  JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class MockJwtModule {} }) },
}));

import { MensajesController } from './mensajes.controller';
import { MensajesService } from './mensajes.service';

const ahora = Date.now();
const hace = (min: number) => new Date(ahora - min * 60000);
const base = (id: bigint, extra: any) => ({
  id, telefono: `99900000${id}`, party_id: null, duenio: 'BOT', urgente: false, estado: 'ABIERTA',
  tomado_por: null, ultima_actividad: hace(1), party: null, visto_en: null, marcado_no_visto: false,
  identificador_tipo: 'TELEFONO', ...extra,
});
const msg = (autor: string, min: number) => ({
  autor, direccion: autor === 'CLIENTE' ? 'ENTRA' : 'SALE', tipo: 'TEXTO', contenido: { texto: 'x' }, en: hace(min),
});

describe('MensajesService · chats no vistos', () => {
  let prisma: any;
  let auditoria: any;
  let eventos: any;
  let service: MensajesService;
  const usuario = { partyId: 10n, rol: 'ADMIN', debeCambiar: false };

  beforeEach(() => {
    prisma = {
      conversacion: {
        findMany: jest.fn().mockResolvedValue([
          // 1: pide persona y el cliente escribió después de la última vista -> sin ver (1)
          base(1n, { urgente: true, visto_en: hace(10), mensajes: [msg('CLIENTE', 2)] }),
          // 2: pide persona pero ya se abrió después del mensaje -> visto
          base(2n, { urgente: true, visto_en: hace(1), mensajes: [msg('CLIENTE', 5)] }),
          // 3: visto, pero marcado a mano -> sin ver aunque no haya mensajes nuevos
          base(3n, { visto_en: hace(1), marcado_no_visto: true, mensajes: [msg('BOT', 3)] }),
          // 4: con el bot, sin marca -> visto
          base(4n, { visto_en: hace(1), mensajes: [msg('BOT', 3)] }),
        ]),
        findUnique: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(where.id === 1n ? base(1n, { tomadoPorUsuario: null }) : null),
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      pedido: { findMany: jest.fn().mockResolvedValue([]) },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    eventos = { emitirAdmin: jest.fn() };
    service = new MensajesService(prisma, auditoria, { enviarTexto: jest.fn() } as any, eventos);
  });

  it('cuenta y filtra los chats sin ver (mensajes nuevos o marca manual)', async () => {
    const todos = await service.listar('todos');
    expect(todos.conteos.sinVer).toBe(2);
    const c1 = todos.chats.find((c) => c.id === '1')!;
    expect(c1.sinLeer).toBe(1);
    expect(todos.chats.find((c) => c.id === '2')!.sinLeer).toBe(0);
    expect(todos.chats.find((c) => c.id === '3')!.marcadoNoVisto).toBe(true);
    expect(typeof c1.fecha).toBe('string');

    const nv = await service.listar('novistos');
    expect(nv.chats.map((c) => c.id).sort()).toEqual(['1', '3']);
  });

  it('marcarNoVisto guarda la marca compartida, audita y avisa en vivo', async () => {
    await expect(service.marcarNoVisto('1', usuario, '1.1.1.1')).resolves.toEqual({ ok: true });
    expect(prisma.conversacion.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { marcado_no_visto: true } });
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: 'mensajes', accion: 'MARCAR_NO_VISTO', entidadId: 1n }),
    );
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizado', { id: '1' });
  });

  it('marcarVisto limpia la marca, fija visto_en y no toca la última actividad', async () => {
    await service.marcarVisto('1', usuario);
    const arg = prisma.conversacion.update.mock.calls[0][0];
    expect(arg.data.marcado_no_visto).toBe(false);
    expect(arg.data.visto_en).toBeInstanceOf(Date);
    expect(arg.data.ultima_actividad).toBeUndefined();
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizado', { id: '1' });
  });

  it('un chat que no existe da CHAT_NO_ENCONTRADO', async () => {
    await expect(service.marcarNoVisto('99', usuario)).rejects.toMatchObject({
      response: { codigo: 'CHAT_NO_ENCONTRADO' },
    });
  });

  it('los endpoints piden el permiso mensajes/ver', () => {
    for (const fn of [MensajesController.prototype.visto, MensajesController.prototype.noVisto]) {
      const meta = Reflect.getMetadataKeys(fn).map((k) => Reflect.getMetadata(k, fn));
      expect(JSON.stringify(meta)).toContain('"ver"');
    }
  });
});
