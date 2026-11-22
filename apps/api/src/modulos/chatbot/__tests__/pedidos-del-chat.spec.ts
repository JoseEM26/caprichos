jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { registerAsync: () => ({ module: class {} }) } }));
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import {
  celular9DelChat,
  claveCortaPedido,
  condicionPedidosDelChat,
  enviarResumenPendienteDeCarta,
  extraerCelularTexto,
  extraerClavePedido,
  pedidoDelChatPorCodigo,
  pedidoEsDelChat,
  telefonoDelChat,
} from '../servicios/pedidos-del-chat.util';
import { ORIGENES_RESPUESTA } from '../evolution/politica-evolution.service';

const CLAVE = claveCortaPedido(7n);
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
    const p = await pedidoDelChatPorCodigo(prisma, chat, 'CP-0123', CLAVE);
    expect(p?.codigo).toBe('CP-0123');
    expect(prisma.conversacion.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { celular_vinculado: '987654321' } });
    expect(chat.celular_vinculado).toBe('987654321');
  });

  it('sin clave o con clave errada: no vincula ni devuelve el pedido', async () => {
    for (const clave of [undefined, null, '', 'AAAAA']) {
      const { prisma } = montar(pedidoCarta());
      expect(await pedidoDelChatPorCodigo(prisma, { id: 1n, telefono: 'wa-user:1234@lid' }, 'CP-0123', clave)).toBeNull();
      expect(prisma.conversacion.update).not.toHaveBeenCalled();
    }
  });

  it('clave válida en un pedido personal: es suyo (código + clave)', async () => {
    const { prisma } = montar(pedidoCarta({ es_personal: true }));
    expect(await pedidoDelChatPorCodigo(prisma, { id: 1n, telefono: 'wa-user:1234@lid' }, 'CP-0123', CLAVE)).not.toBeNull();
  });
  it('caso del dueño: «Hola, mi pedido CP-0123 (clave XXXXX)» con pedido personal, chat con otro número', async () => {
    const { prisma } = montar(pedidoCarta({ es_personal: true, cliente_telefono: null }));
    const texto = `Hola, mi pedido CP-0123 (clave ${CLAVE})`;
    expect(extraerClavePedido(texto)).toBe(CLAVE);
    expect(await pedidoDelChatPorCodigo(prisma, { id: 1n, telefono: '51912345678' }, 'CP-0123', extraerClavePedido(texto))).not.toBeNull();
  });

  it('celular coincidente: basta el código, sin clave', async () => {
    const { prisma } = montar(pedidoCarta());
    expect((await pedidoDelChatPorCodigo(prisma, { id: 1n, telefono: '51987654321' }, 'CP-0123'))?.codigo).toBe('CP-0123');
  });

  it('la clave es corta, sin O/0/I/1 y distinta por pedido', () => {
    expect(CLAVE).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(claveCortaPedido(8n)).not.toBe(CLAVE);
  });

  it('un chat con número distinto no se apropia del pedido de otro', async () => {
    const { prisma } = montar(pedidoCarta());
    expect(await pedidoDelChatPorCodigo(prisma, { id: 1n, telefono: '51911111111' }, 'CP-0123')).toBeNull();
    expect((await pedidoDelChatPorCodigo(prisma, { id: 1n, telefono: '51911111111' }, 'CP-0123', CLAVE))?.codigo).toBe('CP-0123');
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
    expect(await enviarResumenPendienteDeCarta(prisma, outbox, chat, `Hola, mi pedido cp-0123 (clave ${CLAVE.toLowerCase()})`)).toBe(true);
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
    b.prisma.pedido.count = jest.fn().mockResolvedValue(0);
    expect(await enviarResumenPendienteDeCarta(b.prisma, b.outbox, { id: 1n, telefono: '51911111111' }, 'CP-0123')).toBe(false);
    const c = montar(pedidoCarta({ estado: 'ANULADO' }), diferido);
    expect(await enviarResumenPendienteDeCarta(c.prisma, c.outbox, { id: 1n, telefono: '51987654321' }, 'CP-0123')).toBe(false);
  });

  it('código ajeno sin clave desde un chat con número: respuesta corta, sin datos del pedido', async () => {
    const { prisma, outbox } = montar(pedidoCarta(), diferido);
    prisma.pedido.count = jest.fn().mockResolvedValue(1);
    expect(await enviarResumenPendienteDeCarta(prisma, outbox, { id: 1n, telefono: '51911111111' }, 'Hola, mi pedido CP-0123')).toBe(true);
    const arg = outbox.encolar.mock.calls[0][0];
    expect(arg.telefono).toBe('51911111111');
    expect(arg.carga.textoLibre).toMatch(/botón de la carta/);
    expect(JSON.stringify(arg)).not.toMatch(/987654321|Rosa|Yape/);
  });

  it('LID sin clave: no vincula ni responde (lo contesta el motor)', async () => {
    const { prisma, outbox } = montar(pedidoCarta(), diferido);
    prisma.pedido.count = jest.fn().mockResolvedValue(1);
    expect(await enviarResumenPendienteDeCarta(prisma, outbox, { id: 2n, telefono: 'wa-user:999@lid' }, 'Hola, mi pedido CP-0123')).toBe(false);
    expect(prisma.conversacion.update).not.toHaveBeenCalled();
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('acepta códigos CP-W### de la carta', async () => {
    const { prisma, outbox } = montar(pedidoCarta({ codigo: 'CP-W382' }), diferido);
    expect(await enviarResumenPendienteDeCarta(prisma, outbox, { id: 1n, telefono: '51987654321' }, 'Hola, mi pedido CP-W382')).toBe(true);
    expect(prisma.pedido.findUnique).toHaveBeenCalledWith({ where: { codigo: 'CP-W382' } });
  });
});

describe('Pedido del equipo (descuento) y chat LID: código + celular', () => {
  const lid = () => ({ id: 1n, telefono: 'wa-user:1234@lid', celular_vinculado: null as string | null });
  it('extrae el celular del texto sin confundirlo con el código', () => {
    expect(extraerCelularTexto('CP-W435 987 654 321')).toBe('987654321');
    expect(extraerCelularTexto('mi pedido CP-0123 +51 987654321')).toBe('987654321');
    expect(extraerCelularTexto('CP-W435')).toBeNull();
  });
  it('pedido personal: con código + su celular se ve y vincula el chat; sin celular no', async () => {
    const pedido = pedidoCarta({ es_personal: true, canal: 'CARTA' });
    const { prisma } = montar(pedido);
    expect(await pedidoDelChatPorCodigo(prisma, lid(), 'CP-0123', null, null)).toBeNull();
    expect(await pedidoDelChatPorCodigo(prisma, lid(), 'CP-0123', null, '912345678')).toBeNull();
    const chat = lid();
    expect(await pedidoDelChatPorCodigo(prisma, chat, 'CP-0123', null, '987654321')).toBe(pedido);
    expect(chat.celular_vinculado).toBe('987654321');
  });
});
