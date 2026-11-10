jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
import { ForbiddenException } from '@nestjs/common';
import { CONFIG_EQUIPO_NUEVO, equipoAcepta, tiposDeConfig } from './ruteo-impresion';
import { destinoDeTrabajoParaCola } from './destinos-impresion';
import { empaquetarDetalleLatido } from './estado-impresion';
import { PedidosAdminController } from '../pedidos-admin/pedidos-admin.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { ImpresionService } from './impresion.service';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

const cfg = (c: any) => ({ ...CONFIG_EQUIPO_NUEVO, configurado: true, ...c });
// La Caja del dueño: ticket de pago y sticker general, NADA de comanda de salón
const CAJA_CFG = cfg({ ticketera: true, etiquetera: true, ticketPago: true, stickerGeneral: true });
const ahora = Date.now();
const latido = (impresoras: any[], hace = 5_000) => ({
  id: 1n,
  nombre: 'Caja',
  ultimo_latido: new Date(ahora - hace),
  latido_impresora: 'lista',
  latido_detalle: empaquetarDetalleLatido(null, impresoras),
});
const LISTAS = [
  { rol: 'ETIQUETERA', estado: 'lista', nombre: 'TSC TTP-244' },
  { rol: 'TICKETERA', estado: 'lista', nombre: 'EPSON TM-T20' },
];

describe('ruteo por configuración: cada máquina solo recibe lo que se le asignó', () => {
  it('la comanda de salón no asignada no la toma nadie ni la acepta la Caja', () => {
    expect(equipoAcepta(CAJA_CFG, 'TICKET_COMANDA_SALON', [null])).toBe(false);
    expect(equipoAcepta(CAJA_CFG, 'TICKET_PAGO', [null])).toBe(true);
  });

  it('tomarTrabajos filtra por tipo configurado, no por tener la ticketera encendida', () => {
    const t = tiposDeConfig(CAJA_CFG, ['ETIQUETERA', 'TICKETERA']);
    expect(t).toEqual(expect.arrayContaining(['TICKET_PAGO', 'ETIQUETA_GENERAL']));
    expect(t).not.toContain('TICKET_COMANDA_SALON');
    expect(t).not.toContain('TICKET_COMANDA_AREA');
    expect(t).not.toContain('ETIQUETA_BEBIDA');
    expect(tiposDeConfig(cfg({ ...CAJA_CFG, pausado: true }), ['TICKETERA'])).toEqual([]);
    expect(tiposDeConfig(CAJA_CFG, ['TICKETERA'])).not.toContain('ETIQUETA_GENERAL');
  });

  it('la toma real manda a SQL solo esos tipos', async () => {
    const prisma: any = {
      printJob: { updateMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((f: any) => f(prisma)),
    };
    const s = new ImpresionService(prisma);
    (s as any).equipos = { configDe: jest.fn(async () => CAJA_CFG) };
    jest.spyOn(s, 'vencerTrabajosObsoletos').mockResolvedValue(0);
    await s.tomarTrabajos(5, 1n, ['TICKETERA']);
    const tipos = prisma.$queryRaw.mock.calls[0].slice(1).find((a: any) => Array.isArray(a));
    expect(tipos).toEqual(['TICKET_PAGO', 'TICKET_CIERRE']);
  });
});

describe('destino de un trabajo en la cola (computadora, impresora, estado)', () => {
  const ctx = (config: any, conectado = true) => ({ equipos: [{ id: 1n, areaId: null, conectado, config }], areaBebidasId: null });
  const job = (extra: any = {}) => ({ tipo: 'TICKET_COMANDA_SALON', estado: 'PENDIENTE', pedido_id: 9n, area_id: null, payload: {}, destino_equipo_id: null, device_key_id: null, ...extra });

  it('comanda de salón sin ninguna computadora que la imprima: «Sin impresora asignada» con el motivo (no «en cola»)', () => {
    const d = destinoDeTrabajoParaCola(job(), ctx(CAJA_CFG), new Map([['1', latido(LISTAS) as any]]), ahora);
    expect(d.sinImpresora).toBe(true);
    expect(d.equipoNombre).toBeNull();
    expect(d.motivoSinImpresora).toMatch(/Ninguna computadora tiene activado «Comanda de salón»/);
    expect(d.textoEspera).toMatch(/^Sin impresora asignada/);
  });

  it('apuntado a una PC que ya no lo tiene activado también es «sin impresora» (huérfano)', () => {
    const d = destinoDeTrabajoParaCola(job({ destino_equipo_id: 1n }), ctx(CAJA_CFG), new Map([['1', latido(LISTAS) as any]]), ahora);
    expect(d.sinImpresora).toBe(true);
    expect(d.motivoSinImpresora).toMatch(/«Caja» ya no tiene activado/);
  });

  it('en cola de una PC conectada: dice cuál computadora, la impresora y hace cuánto latió', () => {
    const d = destinoDeTrabajoParaCola(job({ tipo: 'TICKET_PAGO', destino_equipo_id: 1n }), ctx(CAJA_CFG), new Map([['1', latido(LISTAS) as any]]), ahora);
    expect(d).toMatchObject({ sinImpresora: false, equipoNombre: 'Caja', conectado: true, impresoraNombre: 'EPSON TM-T20', impresoraRol: 'TICKETERA' });
    expect(d.textoEspera).toBe('Esperando su turno en la computadora «Caja» (conectada hace 5 s).');
  });

  it('PC apagada: lo dice y desde cuándo', () => {
    const d = destinoDeTrabajoParaCola(job({ tipo: 'TICKET_PAGO', destino_equipo_id: 1n }), ctx(CAJA_CFG, false), new Map([['1', latido(LISTAS, 3_600_000) as any]]), ahora);
    expect(d.conectado).toBe(false);
    expect(d.textoEspera).toMatch(/«Caja», que está apagada o sin el programa \(sin conexión desde las/);
  });

  it('PC conectada con la ticketera sin reconocer: lo dice', () => {
    const d = destinoDeTrabajoParaCola(job({ tipo: 'TICKET_PAGO', destino_equipo_id: 1n }), ctx(CAJA_CFG), new Map([['1', latido([LISTAS[0]]) as any]]), ahora);
    expect(d.textoEspera).toMatch(/su ticketera no está lista: Aún no elegiste la impresora/);
  });
});

describe('descarte seguro de lo que nadie imprime', () => {
  const admin: any = { partyId: '1', roles: ['ADMIN'], rol: 'ADMIN' };
  const armar = () => {
    const prisma: any = { printJob: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) } };
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const s = new ImpresionService(prisma, auditoria as any);
    const reasignar = jest.fn().mockResolvedValue(0);
    (s as any).equipos = { reasignarPendientes: reasignar };
    return { s, prisma, auditoria, reasignar };
  };

  it('reubica primero, marca DESCARTADO con motivo (no borra) y audita', async () => {
    const { s, prisma, auditoria, reasignar } = armar();
    const r = await s.descartarSinImpresora('Comanda salón que Caja no imprime', admin, '1.1.1.1');
    expect(reasignar).toHaveBeenCalled();
    expect(prisma.printJob.updateMany).toHaveBeenCalledWith({
      where: { estado: 'PENDIENTE', pedido_id: { not: null }, destino_equipo_id: null },
      data: { estado: 'DESCARTADO', error: 'Descartada: Comanda salón que Caja no imprime' },
    });
    expect(r.descartadas).toBe(3);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'DESCARTAR_SIN_IMPRESORA', motivo: 'Comanda salón que Caja no imprime' }));
  });

  it('sin motivo usa uno por defecto; un mozo no puede', async () => {
    const { s, prisma } = armar();
    await s.descartarSinImpresora(undefined, admin);
    expect(prisma.printJob.updateMany.mock.calls[0][0].data.error).toMatch(/Sin impresora asignada/);
    await expect(s.descartarSinImpresora('x', { partyId: '2', roles: ['MOZO'], rol: 'MOZO' } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('endpoint de destinos y reimpresión sin doble clic', () => {
  let service: ImpresionService;
  let equipos: any[];
  let dks: any[];
  let prisma: any;
  const pedido = {
    id: 9n, codigo: 'PED-9', estado: 'ENTREGADO', modalidad: 'LLEVAR', total: 20, subtotal: 20, cliente_nombre: 'Rosa', creado_en: new Date(), planPago: [], cobros: [],
    lineas: [{ id: 2n, cantidad: 1, nombre: 'Café', area_id: 7n, area: { nombre: 'Bebidas' }, producto: { categoria: { nombre: 'Bebidas' } }, opcionesElegidas: [], sabores: [], subtotal: 20, precio_unit: 20 }],
  };
  const TODO_ON = cfg({ ticketera: true, etiquetera: true, ticketPago: true, comandaSalon: true, stickerGeneral: true, stickerBebidaAreas: ['7'] });

  beforeEach(() => {
    let n = 100n;
    equipos = [{ id: 1n, areaId: null, conectado: true, config: TODO_ON }];
    dks = [latido(LISTAS)];
    prisma = {
      printJob: { create: jest.fn(async () => ({ id: n++ })), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido) },
      deviceKey: { findMany: jest.fn(async () => dks) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      comprobante: { findFirst: jest.fn().mockResolvedValue(null) },
      cuponEmitido: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    service = new ImpresionService(prisma, { registrar: jest.fn() } as any);
    (service as any).equipos = { contexto: jest.fn(async () => ({ equipos, areaBebidasId: 7n })) };
  });
  const por = (r: any, tipo: string) => r.destinos.find((d: any) => d.tipo === tipo);

  it('todo conectado y reconocido: disponible con equipo e impresora', async () => {
    const r = await service.destinosPedido(9);
    expect(r.destinos.map((d) => d.tipo)).toEqual(['todo', 'stickers_todos', 'sticker_general', 'sticker_area', 'sticker_bebida', 'ticket_cocina', 'ticket_pago']);
    expect(por(r, 'ticket_pago')).toMatchObject({ disponible: true, equipo: 'Caja', impresora: 'EPSON TM-T20', conectada: true, motivo: null, cantidad: 1 });
    expect(por(r, 'sticker_general')).toMatchObject({ disponible: true, impresora: 'TSC TTP-244', cantidad: 1 });
  });

  it('PC desconectada: ninguna opción disponible y el motivo lo dice', async () => {
    equipos[0].conectado = false;
    dks = [latido(LISTAS, 3_600_000)];
    const r = await service.destinosPedido(9);
    expect(por(r, 'ticket_pago')).toMatchObject({ disponible: false, conectada: false });
    expect(por(r, 'ticket_pago').motivo).toMatch(/apagada o sin el programa/);
  });

  it('impresora no reconocida: se deshabilita solo lo de esa máquina', async () => {
    dks = [latido([LISTAS[1]])]; // el programa no reporta la etiquetera
    const r = await service.destinosPedido(9);
    expect(por(r, 'sticker_general')).toMatchObject({ disponible: false, conectada: false });
    expect(por(r, 'sticker_general').motivo).toMatch(/Aún no elegiste la impresora/);
    expect(por(r, 'ticket_pago').disponible).toBe(true);
    expect(por(r, 'todo').disponible).toBe(false);
  });

  it('sin máquina asignada (la comanda de salón no está activa en ninguna): cantidad 0 y motivo', async () => {
    equipos[0].config = cfg({ ...TODO_ON, comandaSalon: false });
    pedido.modalidad = 'MESA';
    (pedido as any).mesa_nombre = '3';
    const r = await service.destinosPedido(9);
    pedido.modalidad = 'LLEVAR';
    expect(por(r, 'ticket_cocina')).toMatchObject({ disponible: false, cantidad: 0, equipo: null, impresora: null });
    expect(por(r, 'ticket_cocina').motivo).toMatch(/Ninguna PC tiene encendido este papel/);
  });

  it('ya en cola: no se ofrece y lo explica', async () => {
    prisma.printJob.findMany.mockResolvedValue([{ tipo: 'TICKET_PAGO', payload: {} }]);
    const r = await service.destinosPedido(9);
    expect(por(r, 'ticket_pago')).toMatchObject({ disponible: false, cantidad: 0 });
    expect(por(r, 'ticket_pago').motivo).toMatch(/Ya hay una copia esperando/);
  });

  it('el endpoint pide el mismo permiso que reimprimir y delega', async () => {
    expect(Reflect.getMetadata(CLAVE_PERMISO, PedidosAdminController.prototype.destinosImpresion)).toEqual({ modulo: 'pedidos', accion: 'cambiar_estado' });
    const ctrl = new (PedidosAdminController as any)();
    ctrl.impresionService = { destinosPedido: jest.fn().mockResolvedValue({ destinos: [] }) };
    await ctrl.destinosImpresion('9');
    expect(ctrl.impresionService.destinosPedido).toHaveBeenCalledWith('9');
  });

  it('doble clic: la misma reimpresión en menos de 15 s avisa «Ya se envió hace N s» y no duplica', async () => {
    await service.reimprimirPedido(9, { tipo: 'ticket_pago' });
    expect(prisma.printJob.create).toHaveBeenCalledTimes(1);
    const err: any = await service.reimprimirPedido(9, { tipo: 'ticket_pago' }).catch((e) => e);
    expect(err.getStatus()).toBe(409);
    expect(err.getResponse()).toMatchObject({ codigo: 'REIMPRESION_REPETIDA', mensaje: expect.stringMatching(/^Ya se envió hace \d+ s, espera a que salga$/) });
    expect(prisma.printJob.create).toHaveBeenCalledTimes(1);
  });

  it('«Imprimir otra copia igual» lo anula; otra opción u otro pedido no se bloquea; pasados 15 s vuelve a dejar', async () => {
    await service.reimprimirPedido(9, { tipo: 'ticket_pago' });
    await service.reimprimirPedido(9, { tipo: 'ticket_pago', otra_copia: true });
    await service.reimprimirPedido(9, { tipo: 'stickers', sub: 'general' });
    expect(prisma.printJob.create).toHaveBeenCalledTimes(3);
    (service as any).reimpresionIdentica.set('9|ticket_pago|', Date.now() - 16_000);
    await service.reimprimirPedido(9, { tipo: 'ticket_pago' });
    expect(prisma.printJob.create).toHaveBeenCalledTimes(4);
  });

  it('la vista previa no cuenta como envío', async () => {
    await service.reimprimirPedido(9, { tipo: 'ticket_pago', vista_previa: true });
    await expect(service.reimprimirPedido(9, { tipo: 'ticket_pago' })).resolves.toBeTruthy();
  });
});
