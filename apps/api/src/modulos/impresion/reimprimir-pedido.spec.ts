jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
import { HttpException } from '@nestjs/common';
import { CONFIG_EQUIPO_NUEVO } from './ruteo-impresion';
import { PedidosAdminController } from '../pedidos-admin/pedidos-admin.controller';
import { MATRIZ } from '../acceso/permisos';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { ImpresionService } from './impresion.service';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

const cfg = (c: any) => ({ ...CONFIG_EQUIPO_NUEVO, configurado: true, ...c });
const CAJA = { id: 1n, areaId: null, conectado: true, config: cfg({ ticketera: true, etiquetera: true, ticketPago: true, comandaSalon: true, stickerGeneral: true, stickerAreas: ['5'], stickerBebidaAreas: ['7'] }) };

const pedido = (extra: any = {}) => ({
  id: 9n,
  codigo: 'PED-9',
  estado: 'ENTREGADO',
  modalidad: 'LLEVAR',
  total: 20,
  subtotal: 20,
  cliente_nombre: 'Rosa',
  creado_en: new Date(),
  planPago: [],
  cobros: [],
  lineas: [
    { id: 1n, cantidad: 1, nombre: 'Dona', area_id: 5n, area: { nombre: 'Cocina' }, producto: { categoria: { nombre: 'Postres' } }, opcionesElegidas: [], sabores: [], subtotal: 10, precio_unit: 10 },
    { id: 2n, cantidad: 1, nombre: 'Café', area_id: 7n, area: { nombre: 'Bebidas' }, producto: { categoria: { nombre: 'Bebidas' } }, opcionesElegidas: [], sabores: [], subtotal: 10, precio_unit: 10 },
  ],
  ...extra,
});

describe('reimprimirPedido (reimpresión rápida desde Caja)', () => {
  let prisma: any;
  let auditoria: any;
  let service: ImpresionService;
  let equipos: any[];

  beforeEach(() => {
    equipos = [CAJA];
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    let n = 100n;
    prisma = {
      printJob: {
        create: jest.fn(async () => ({ id: n++ })),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido()) },
      deviceKey: { findMany: jest.fn().mockResolvedValue([{ id: 1n, nombre: 'Caja' }]) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      comprobante: { findFirst: jest.fn().mockResolvedValue(null) },
      cuponEmitido: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    service = new ImpresionService(prisma, auditoria);
    (service as any).equipos = { contexto: jest.fn(async () => ({ equipos, areaBebidasId: 7n })) };
  });
  const creados = () => prisma.printJob.create.mock.calls.map((c: any) => c[0].data);

  it('«todo» encola ticket + comanda + stickers como copia en la máquina correcta y resume por PC', async () => {
    const r: any = await service.reimprimirPedido(9, { tipo: 'todo' }, { partyId: '3' } as any, '1.1.1.1');
    const tipos = creados().map((d: any) => d.tipo);
    expect(tipos[0]).toBe('TICKET_PAGO'); // tickets primero
    expect(tipos).toEqual(expect.arrayContaining(['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA']));
    expect(creados().every((d: any) => d.copia === true && d.estado === 'PENDIENTE' && d.destino_equipo_id === 1n)).toBe(true);
    expect(r.stickers + r.tickets).toBe(r.cantidad);
    expect(r.porMaquina).toEqual(expect.arrayContaining([expect.objectContaining({ equipo: 'Caja', rol: 'TICKETERA', tickets: 1 }), expect.objectContaining({ rol: 'ETIQUETERA' })]));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REIMPRIMIR_PEDIDO', despues: expect.objectContaining({ tipo: 'todo' }) }));
  });

  it('la vista previa no encola ni audita pero dice qué saldría y dónde', async () => {
    const r: any = await service.reimprimirPedido(9, { tipo: 'todo', vista_previa: true });
    expect(prisma.printJob.create).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
    expect(r.vistaPrevia).toBe(true);
    expect(r.papeles.length).toBe(r.cantidad);
    expect(r.papeles[0].equipo).toBe('Caja');
  });

  it('ticket_pago sin Cobro sale como pre-cuenta', async () => {
    await service.reimprimirPedido(9, { tipo: 'ticket_pago' });
    expect(creados()).toHaveLength(1);
    expect(creados()[0].payload.marca).toMatch(/PRE-CUENTA/);
  });

  it('ticket_pago con Cobro reimprime lo existente: sin marca y sin emitir comprobante', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ cobros: [{ anulado_en: null, en: new Date(), pagos: [{ medio: 'EFECTIVO', monto: 20 }] }] }));
    prisma.comprobante.findFirst.mockResolvedValue({ tipo: 'BOLETA', numero_texto: 'B001-5', anulado_en: null });
    await service.reimprimirPedido(9, { tipo: 'ticket_pago' });
    expect(creados()[0].payload.marca).toBeUndefined();
    expect(creados()[0].payload.comprobante).toMatchObject({ numero: 'B001-5' });
    expect(prisma.comprobante.create).toBeUndefined(); // nada se emite: solo se lee
  });

  it('pedido anulado: exige confirmación y luego marca ANULADO en tickets', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ estado: 'ANULADO', modalidad: 'MESA', mesa_nombre: '3' }));
    await expect(service.reimprimirPedido(9, { tipo: 'ticket_cocina' })).rejects.toMatchObject({ response: { codigo: 'ANULADO_REQUIERE_CONFIRMACION' } });
    const prev: any = await service.reimprimirPedido(9, { tipo: 'ticket_cocina', vista_previa: true });
    expect(prev.exigeConfirmacionAnulado).toBe(true);
    await service.reimprimirPedido(9, { tipo: 'todo', confirmar_anulado: true });
    const tickets = creados().filter((d: any) => d.tipo.startsWith('TICKET'));
    expect(tickets.length).toBeGreaterThan(0);
    expect(tickets.every((d: any) => d.payload.marca === 'ANULADO')).toBe(true);
  });

  it('pedido del personal y en espera de mesa también se reimprimen', async () => {
    prisma.pedido.findUnique.mockResolvedValue(
      pedido({ es_personal: true, modalidad: 'MESA', mesa_nombre: 'En espera #2', consumoPersonal: { pagado_en: null, party: { persona: { nombres: 'Rosa', apellidos: 'P' } } } }),
    );
    const r: any = await service.reimprimirPedido(9, { tipo: 'todo' });
    expect(r.ok).toBe(true);
    const pago = creados().find((d: any) => d.tipo === 'TICKET_PAGO');
    expect(pago.payload.personal).toBeTruthy();
    expect(pago.payload.marca).toBeUndefined();
    expect(creados().some((d: any) => d.tipo === 'TICKET_COMANDA_SALON')).toBe(true);
  });

  it('PC sin configurar: omite con motivo y no crea trabajos', async () => {
    equipos = [{ ...CAJA, config: { ...CONFIG_EQUIPO_NUEVO } }];
    const r: any = await service.reimprimirPedido(9, { tipo: 'todo' });
    expect(prisma.printJob.create).not.toHaveBeenCalled();
    expect(r.cantidad).toBe(0);
    expect(r.omitidos.length).toBeGreaterThan(0);
    expect(r.omitidos.some((o: any) => /sin configurar/.test(o.motivo))).toBe(true);
  });

  it('modalidad sin regla para ese papel: omitido con motivo', async () => {
    const r: any = await service.reimprimirPedido(9, { tipo: 'ticket_cocina' }); // LLEVAR: la comanda de salón no aplica
    expect(r.omitidos[0].motivo).toMatch(/Mapa de impresión.*LLEVAR/);
  });

  it('lo que ya está en cola no se duplica', async () => {
    prisma.printJob.findMany.mockResolvedValue([{ tipo: 'TICKET_PAGO', payload: {} }]);
    const r: any = await service.reimprimirPedido(9, { tipo: 'ticket_pago' });
    expect(prisma.printJob.create).not.toHaveBeenCalled();
    expect(r.yaEnCola).toHaveLength(1);
    expect(r.mensaje).toBe('Ya está en cola');
  });

  it('stickers con sub-opción general solo encola el general', async () => {
    await service.reimprimirPedido(9, { tipo: 'stickers', sub: 'general' });
    expect(creados().map((d: any) => d.tipo)).toEqual(['ETIQUETA_GENERAL']);
  });

  it('límite de abuso: la sexta reimpresión en un minuto da 429', async () => {
    for (let i = 0; i < 5; i++) await service.reimprimirPedido(9, { tipo: 'ticket_pago', otra_copia: true });
    const err: any = await service.reimprimirPedido(9, { tipo: 'ticket_pago', otra_copia: true }).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    // la vista previa no cuenta
    await expect(service.reimprimirPedido(9, { tipo: 'ticket_pago', vista_previa: true })).resolves.toBeTruthy();
  });

  it('pedido inexistente: 404', async () => {
    prisma.pedido.findUnique.mockResolvedValue(null);
    await expect(service.reimprimirPedido(9, { tipo: 'todo' })).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_ENCONTRADO' } });
  });

  it('el endpoint exige pedidos/cambiar_estado (el guard responde 403 sin él) y delega en el servicio', async () => {
    const meta = Reflect.getMetadata(CLAVE_PERMISO, PedidosAdminController.prototype.reimprimirPedido);
    expect(meta).toEqual({ modulo: 'pedidos', accion: 'cambiar_estado' });
    const impresion = { reimprimirPedido: jest.fn().mockResolvedValue({ ok: true }) };
    const ctrl = new (PedidosAdminController as any)();
    ctrl.impresionService = impresion;
    await ctrl.reimprimirPedido('9', { tipo: 'todo' }, { usuario: { partyId: '1' }, ip: '2.2.2.2' });
    expect(impresion.reimprimirPedido).toHaveBeenCalledWith('9', { tipo: 'todo' }, { partyId: '1' }, '2.2.2.2');
  });

  describe('imprimirPrecuenta (mozo / tablet)', () => {
    it('mesa sin cobro: encola la PRE-CUENTA en la PC con «Ticket de pago»', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedido({ modalidad: 'MESA', estado: 'ABIERTO', mesa_nombre: 'Mesa 3' }));
      const r: any = await service.imprimirPrecuenta(9, false, { partyId: '3' } as any);
      expect(creados()).toHaveLength(1);
      expect(creados()[0]).toMatchObject({ tipo: 'TICKET_PAGO', destino_equipo_id: 1n, estado: 'PENDIENTE' });
      expect(creados()[0].payload.marca).toMatch(/PRE-CUENTA/);
      expect(r.porMaquina[0]).toMatchObject({ equipo: 'Caja', conectado: true });
    });

    it('PC sin conexión: queda pendiente y lo dice; sin PC con Ticket de pago: no encola y da el motivo', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedido({ modalidad: 'MESA', estado: 'ABIERTO' }));
      equipos = [{ ...CAJA, conectado: false }];
      const r: any = await service.imprimirPrecuenta(9, false);
      expect(creados()).toHaveLength(1);
      expect(r.porMaquina[0].conectado).toBe(false);
      prisma.printJob.create.mockClear();
      (service as any).reimpresionIdentica.clear(); // lo repetido en 15 s se rechaza aparte
      equipos = [{ ...CAJA, config: cfg({ ticketera: true, ticketPago: false }) }];
      const r2: any = await service.imprimirPrecuenta(9, false);
      expect(prisma.printJob.create).not.toHaveBeenCalled();
      expect(r2.omitidos[0].motivo).toMatch(/Mapa de impresión/);
    });

    it('no duplica si ya está en cola', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedido({ modalidad: 'MESA', estado: 'ABIERTO' }));
      prisma.printJob.findMany.mockResolvedValue([{ tipo: 'TICKET_PAGO', payload: {} }]);
      const r: any = await service.imprimirPrecuenta(9, false);
      expect(prisma.printJob.create).not.toHaveBeenCalled();
      expect(r.yaEnCola).toHaveLength(1);
    });

    it('pedido cobrado o anulado no tiene precuenta (400)', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedido({ cobros: [{ anulado_en: null }] }));
      await expect(service.imprimirPrecuenta(9, false)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_YA_COBRADO' } });
      prisma.pedido.findUnique.mockResolvedValue(pedido({ estado: 'ANULADO' }));
      await expect(service.imprimirPrecuenta(9, false)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_VIGENTE' } });
    });

    it('el endpoint pide su permiso propio, que tienen MOZO y CAJERO y no COCINA', async () => {
      expect(Reflect.getMetadata(CLAVE_PERMISO, PedidosAdminController.prototype.imprimirPrecuenta)).toEqual({ modulo: 'pedidos', accion: 'imprimir_precuenta' });
      for (const r of ['ADMIN', 'SUPERVISOR', 'CAJERO', 'MOZO']) expect(MATRIZ[r]).toContain('pedidos/imprimir_precuenta');
      for (const r of ['COCINA', 'ALMACEN', 'REPARTIDOR']) expect(MATRIZ[r]).not.toContain('pedidos/imprimir_precuenta');
      expect(MATRIZ.MOZO).not.toContain('pedidos/cambiar_estado');
    });
  });
});
