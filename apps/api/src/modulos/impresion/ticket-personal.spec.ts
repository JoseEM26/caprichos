import { lineasTicketPago } from '@caprichos/compartido';
import { ImpresionService } from './impresion.service';
import { construirTicketPago } from './constructor-etiquetas';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

const pedidoPersonal = (extra: any = {}) => ({
  id: 9n,
  codigo: 'PED-9',
  total: 15,
  subtotal: 20,
  descuento: 5,
  modalidad: 'MESA',
  es_personal: true,
  comprobante_tipo: 'BOLETA',
  cliente_nombre: 'Rosa Pérez',
  descuento_detalle: [{ tipo: 'PERSONAL', nombre: 'Descuento del personal 25%', montoDescontado: 5 }],
  lineas: [{ cantidad: 2, nombre: 'Café', tamano: null, subtotal: 20, precio_unit: 10 }],
  planPago: [],
  cobros: [],
  consumoPersonal: { pagado_en: null, party: { persona: { nombres: 'Rosa', apellidos: 'Pérez' } } },
  ...extra,
});

const texto = (t: any) => lineasTicketPago(t, 48).map((l) => l.texto).join('\n');
const plano = (t: any) => texto(t).replace(/\s*\n\s*/g, ' ');

describe('ticket de consumo del personal', () => {
  it('lleva leyenda, descuento, total, trabajador y «cargado a su crédito»; nunca boleta electrónica', () => {
    const t = construirTicketPago(pedidoPersonal(), {}, { tipo: 'BOLETA', numero_texto: 'B001-1', facturacion_estado: 'EMITIDO_SUNAT' });
    const out = texto(t);
    expect(t.documento).toEqual({ tipo: 'SIMPLE' });
    expect(t.comprobante).toBeNull();
    expect(out).toContain('CONSUMO DE PERSONAL');
    expect(out).toContain('Descuento del personal 25%');
    expect(out).toMatch(/TOTAL\s+S\/ 15\.00/);
    expect(out).toContain('Trabajador: Rosa Pérez');
    expect(plano(t)).toContain('Cargado a su crédito: se paga en su cuenta semanal');
    expect(out).not.toMatch(/ELECTR[ÓO]NICA|Hash|SIMULADO/i);
  });

  it('si el trabajador ya pagó dice «Pagado ahora»', () => {
    const t = construirTicketPago(pedidoPersonal({ consumoPersonal: { pagado_en: new Date(), party: null } }), {});
    expect(texto(t)).toContain('Pagado ahora');
    expect(texto(t)).not.toContain('Cargado a su crédito');
  });

  it('total 0 se imprime sin problema', () => {
    const t = construirTicketPago(pedidoPersonal({ total: 0, subtotal: 0, descuento: 0, descuento_detalle: [] }), {});
    expect(texto(t)).toMatch(/TOTAL\s+S\/ 0\.00/);
  });

  it('un pedido normal no cambia: sin leyenda de personal', () => {
    const t = construirTicketPago(pedidoPersonal({ es_personal: false, consumoPersonal: null, comprobante_tipo: 'SIMPLE' }), {});
    expect(texto(t)).not.toContain('CONSUMO DE PERSONAL');
  });
});

describe('cupón en el ticket', () => {
  it('sin cupón real no hay sección, título ni separador sobrante', () => {
    const t = construirTicketPago(pedidoPersonal({ es_personal: false, consumoPersonal: null }), {});
    const out = texto(t);
    expect(out).not.toMatch(/cup[oó]n|siguiente capricho|pr[oó]xima compra/i);
    expect(out).not.toContain('\n\n');
  });

  it('con un cupón real se imprime su código y vigencia', () => {
    const t = construirTicketPago(pedidoPersonal({ es_personal: false, consumoPersonal: null }), {}, null, null, null, {
      codigo: 'VUELVE-ABC1',
      descripcion: '10% en tu próxima compra',
      vence: '30/11/2026',
    });
    const out = texto(t);
    expect(out).toContain('Tu cupón para tu próxima compra');
    expect(out).toContain('VUELVE-ABC1');
    expect(out).toContain('Vence 30/11/2026');
  });
});

describe('ImpresionService: ticket del personal', () => {
  let prisma: any;
  let auditoria: any;
  let service: ImpresionService;
  const flags: Record<string, unknown> = {};

  beforeEach(() => {
    for (const k of Object.keys(flags)) delete flags[k];
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      printJob: {
        upsert: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 55n }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      pedido: { findUnique: jest.fn().mockResolvedValue(pedidoPersonal()) },
      parametro: {
        findUnique: jest.fn(({ where }: any) => Promise.resolve(where.clave in flags ? { valor: flags[where.clave] } : null)),
        findMany: jest.fn().mockResolvedValue([]),
      },
      comprobante: { findFirst: jest.fn().mockResolvedValue(null) },
      cuponEmitido: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new ImpresionService(prisma, auditoria);
  });

  it('encolarTicketPedido arma el ticket del personal sin Cobro ni comprobante, con clave idempotente', async () => {
    await service.encolarTicketPedido(9n);
    await service.encolarTicketPedido(9n);
    const llamadas = prisma.printJob.upsert.mock.calls;
    expect(llamadas).toHaveLength(2);
    for (const [arg] of llamadas) {
      expect(arg.where).toEqual({ clave_idempotencia: '9-TICKET_PAGO' });
      expect(arg.update).toEqual({});
      expect(arg.create.tipo).toBe('TICKET_PAGO');
      expect(arg.create.payload.personal).toMatchObject({ trabajador: 'Rosa Pérez', pagado: false });
      expect(arg.create.payload.comprobante).toBeNull();
    }
  });

  it('al encolar las etiquetas de un pedido del personal sale también su ticket (una sola clave aunque se repita)', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ ...pedidoPersonal(), lineas: [] });
    const espia = jest.spyOn(service, 'encolarTicketPedido').mockResolvedValue();
    await service.encolarEtiquetasPedido(9n);
    await service.encolarEtiquetasPedido(9n);
    expect(espia).toHaveBeenCalledTimes(2);
    expect(espia).toHaveBeenCalledWith(9n);
  });

  it('un pedido normal no dispara el ticket al encolar etiquetas (sale al cobrar)', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ ...pedidoPersonal({ es_personal: false }), lineas: [] });
    const espia = jest.spyOn(service, 'encolarTicketPedido').mockResolvedValue();
    await service.encolarEtiquetasPedido(9n);
    expect(espia).not.toHaveBeenCalled();
  });

  it('reimprimir crea un ticket nuevo (copia) sin necesitar un Cobro y lo audita', async () => {
    const r = await service.reimprimirEtiqueta(9, { tipo: 'TICKET_PAGO' } as any, { partyId: '3' } as any, '1.1.1.1');
    expect(r).toMatchObject({ ok: true, cantidad: 1 });
    const data = prisma.printJob.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ tipo: 'TICKET_PAGO', copia: true, estado: 'PENDIENTE' });
    expect(data.payload.personal).toBeTruthy();
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REIMPRIMIR_TICKET_PEDIDO', modulo: 'impresion', ip: '1.1.1.1' }));
  });

  it('reimprimir no duplica si el ticket ya está en cola', async () => {
    prisma.printJob.count.mockResolvedValue(1);
    const r: any = await service.reimprimirEtiqueta(9, { tipo: 'ticket' } as any);
    expect(r.cantidad).toBe(0);
    expect(prisma.printJob.create).not.toHaveBeenCalled();
  });

  it('cupón: interruptor apagado (por defecto) no consulta ni imprime nada; encendido sin cupón real tampoco', async () => {
    expect(await service.cuponParaTicket({ id: 9n })).toBeNull();
    expect(prisma.cuponEmitido.findFirst).not.toHaveBeenCalled();
    flags.impresion_cupon_en_ticket = 'SI';
    expect(await service.cuponParaTicket({ id: 9n })).toBeNull();
    expect(prisma.cuponEmitido.findFirst).toHaveBeenCalledTimes(1);
    const where = prisma.cuponEmitido.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ pedido_origen_id: 9n, estado: 'VIGENTE', cupon: { activo: true } });
  });

  it('cupón: encendido y con cupón real vigente se devuelve', async () => {
    flags.impresion_cupon_en_ticket = 'SI';
    prisma.cuponEmitido.findFirst.mockResolvedValue({ codigo: 'VUELVE-1', vence_en: new Date('2026-12-01T12:00:00Z'), cupon: { descripcion: '10%' } });
    expect(await service.cuponParaTicket({ id: 9n })).toMatchObject({ codigo: 'VUELVE-1', descripcion: '10%' });
  });
});
