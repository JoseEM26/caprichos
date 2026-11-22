jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { registerAsync: () => ({ module: class {} }) } }));
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import {
  celular9DelChat,
  condicionPedidosDelChat,
  enviarResumenPendienteDeCarta,
  pedidoDelChatPorCodigo,
  pedidoEsDelChat,
  telefonoDelChat,
} from '../servicios/pedidos-del-chat.util';
import { ORIGENES_RESPUESTA } from '../evolution/politica-evolution.service';

const pedidoCarta = (extra: Record<string, unknown> = {}) => ({
  id: 7n,
  codigo: 'CP-0123',
  canal: 'CARTA',
  estado: 'COLA',
  es_personal: false,
  cliente_telefono: '987654321', // la carta guarda 9 dígitos
  cliente_party_id: null,
  cliente_nombre: 'Rosa Pérez',
  total: 25,
  pago_estado: 'PENDIENTE',
  pago_preferido: 'YAPE',
  pago_metodo: 'YAPE',
  creado_en: new Date(),
  ...extra,
});

function montar(pedido: any, filas: any[] = []) {
  const prisma: any = {
    pedido: { findUnique: jest.fn().mockResolvedValue(pedido) },
    conversacion: { update: jest.fn().mockResolvedValue({}) },
    salienteWhatsapp: { findMany: jest.fn().mockResolvedValue(filas) },
  };
  const outbox: any = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
  return { prisma, outbox };
}

describe('Pedidos de este chat: todas las llaves', () => {
  it('chat con número: 51XXXXXXXXX contra los 9 dígitos de la carta (invitado)', () => {
    const chat = { telefono: '51987654321' };
    expect(celular9DelChat(chat)).toBe('987654321');
    expect(pedidoEsDelChat(chat, { cliente_telefono: '987654321' })).toBe(true);
    expect(pedidoEsDelChat(chat, { cliente_telefono: '912345678' })).toBe(false);
    expect(condicionPedidosDelChat(chat)).toEqual({ OR: [{ cliente_telefono: { endsWith: '987654321' } }] });
  });

  it('carta con sesión: el pedido sin teléfono se une por party', () => {
    const chat = { telefono: 'wa-user:1234@lid', party_id: 55n };
    expect(pedidoEsDelChat(chat, { cliente_telefono: null, cliente_party_id: 55n })).toBe(true);
    expect(pedidoEsDelChat(chat, { cliente_telefono: null, cliente_party_id: 56n })).toBe(false);
    expect(condicionPedidosDelChat(chat)).toEqual({ OR: [{ cliente_party_id: 55n }] });
  });

  it('chat LID con celular vinculado: usa el celular vinculado como teléfono', () => {
    const chat = { telefono: 'wa-user:1234@lid', celular_vinculado: '987654321' };
    expect(telefonoDelChat(chat)).toBe('51987654321');
    expect(pedidoEsDelChat(chat, { cliente_telefono: '987654321' })).toBe(true);
  });

  it('chat LID sin vincular: no tiene llaves', () => {
    const chat = { telefono: 'wa-user:1234@lid' };
    expect(telefonoDelChat(chat)).toBe('');
    expect(condicionPedidosDelChat(chat)).toBeNull();
    expect(pedidoEsDelChat(chat, { cliente_telefono: '987654321' })).toBe(false);
  });
});

describe('Chat LID sin vincular que da el código de su pedido de la carta', () => {
  it('vincula el celular del pedido al chat', async () => {
    const { prisma } = montar(pedidoCarta());
    const chat: any = { id: 1n, telefono: 'wa-user:1234@lid', celular_vinculado: null };
    const p = await pedidoDelChatPorCodigo(prisma, chat, 'CP-0123');
    expect(p?.codigo).toBe('CP-0123');
    expect(prisma.conversacion.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { celular_vinculado: '987654321' } });
    expect(chat.celular_vinculado).toBe('987654321');
  });

  it.each([
    ['pedido del bot', { canal: 'BOT' }],
    ['pedido viejo', { creado_en: new Date(Date.now() - 3 * 24 * 3_600_000) }],
    ['pedido sin celular', { cliente_telefono: null }],
    ['pedido del personal', { es_personal: true }],
  ])('no vincula: %s', async (_n, extra) => {
    const { prisma } = montar(pedidoCarta(extra));
    expect(await pedidoDelChatPorCodigo(prisma, { id: 1n, telefono: 'wa-user:1234@lid' }, 'CP-0123')).toBeNull();
    expect(prisma.conversacion.update).not.toHaveBeenCalled();
  });

  it('un chat con número distinto no se apropia del pedido de otro', async () => {
    const { prisma } = montar(pedidoCarta());
    expect(await pedidoDelChatPorCodigo(prisma, { id: 1n, telefono: '51911111111' }, 'CP-0123')).toBeNull();
  });
});

describe('«Hola, mi pedido CP-XXXX»: resumen al instante, una sola vez', () => {
  const diferido = [{ estado: 'DESCARTADO', carga: { textoLibre: 'Recibimos tu pedido CP-0123. Sube tu voucher aquí.', etapa: 'RECIBIDO' } }];

  it('chat nuevo con número: reenvía el resumen descartado por la regla anti-baneo', async () => {
    const { prisma, outbox } = montar(pedidoCarta(), diferido);
    const ok = await enviarResumenPendienteDeCarta(prisma, outbox, { id: 1n, telefono: '51987654321' }, 'Hola, mi pedido CP-0123');
    expect(ok).toBe(true);
    const arg = outbox.encolar.mock.calls[0][0];
    expect(arg.telefono).toBe('51987654321');
    expect(arg.clave).toBe('pedido-7-RESUMEN-CHAT');
    expect(arg.carga.textoLibre).toContain('Sube tu voucher');
    // origen de respuesta: la política anti-baneo lo deja pasar
    expect(ORIGENES_RESPUESTA.has(arg.origen)).toBe(true);
    expect(outbox.despertar).toHaveBeenCalled();
  });

  it('chat LID: vincula y responde con el resumen', async () => {
    const { prisma, outbox } = montar(pedidoCarta(), diferido);
    const chat: any = { id: 2n, telefono: 'wa-user:999@lid' };
    expect(await enviarResumenPendienteDeCarta(prisma, outbox, chat, 'Hola, mi pedido cp-0123')).toBe(true);
    expect(chat.celular_vinculado).toBe('987654321');
    expect(outbox.encolar.mock.calls[0][0].telefono).toBe('51987654321');
  });

  it('si nunca se redactó el aviso: confirmación breve con cómo subir el voucher', async () => {
    const { prisma, outbox } = montar(pedidoCarta(), []);
    expect(await enviarResumenPendienteDeCarta(prisma, outbox, { id: 1n, telefono: '51987654321' }, 'mi pedido CP-0123')).toBe(true);
    expect(outbox.encolar.mock.calls[0][0].carga.textoLibre).toMatch(/voucher/);
  });

  it('una sola vez: si ya salió o está en cola no lo repite; la clave es idempotente', async () => {
    for (const estado of ['ENVIADO', 'PENDIENTE']) {
      const { prisma, outbox } = montar(pedidoCarta(), [{ estado, carga: { textoLibre: 'x' } }]);
      expect(await enviarResumenPendienteDeCarta(prisma, outbox, { id: 1n, telefono: '51987654321' }, 'CP-0123')).toBe(false);
      expect(outbox.encolar).not.toHaveBeenCalled();
    }
    const { prisma, outbox } = montar(pedidoCarta(), diferido);
    outbox.encolar.mockResolvedValue(false); // la clave ya existía (segundo mensaje del cliente)
    expect(await enviarResumenPendienteDeCarta(prisma, outbox, { id: 1n, telefono: '51987654321' }, 'CP-0123')).toBe(false);
  });

  it('no aplica sin código, con pedido de otro cliente ni anulado', async () => {
    const a = montar(pedidoCarta(), diferido);
    expect(await enviarResumenPendienteDeCarta(a.prisma, a.outbox, { id: 1n, telefono: '51987654321' }, 'hola')).toBe(false);
    const b = montar(pedidoCarta(), diferido);
    expect(await enviarResumenPendienteDeCarta(b.prisma, b.outbox, { id: 1n, telefono: '51911111111' }, 'CP-0123')).toBe(false);
    const c = montar(pedidoCarta({ estado: 'ANULADO' }), diferido);
    expect(await enviarResumenPendienteDeCarta(c.prisma, c.outbox, { id: 1n, telefono: '51987654321' }, 'CP-0123')).toBe(false);
  });
});
