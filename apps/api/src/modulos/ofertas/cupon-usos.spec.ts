jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));
jest.mock('../acceso/acceso.guard', () => ({ AccesoGuard: class {} }));

import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { celularEnmascarado, usosDeCupon } from './cupon-usos';
import { lineasParaCupon } from './cupon-canje';
import { OfertasService } from './ofertas.service';
import { CuponesController } from './ofertas.controller';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';

const HOY = new Date('2027-03-19T20:00:00Z');
const ayer = new Date('2027-03-18T20:00:00Z');

const pedido = (extra: any = {}) => ({
  codigo: 'CP-100',
  canal: 'CAJA',
  estado: 'ENTREGADO',
  total: 37.5,
  descuento: 12.5,
  descuento_detalle: { tipo: 'CUPON', codigo: '25OFF', monto: 12.5 },
  cliente_nombre: 'Lucía Ejemplo',
  cliente_telefono: '987654321',
  cliente_party_id: 5n,
  ...extra,
});

function prismaFalso(modo: string, canjes: any[], emitidos: any[] = []) {
  return {
    cupon: { findUnique: jest.fn().mockResolvedValue({ id: 1n, modo, tope_usos: 10 }) },
    cuponCanjeCompartido: { findMany: jest.fn().mockResolvedValue(canjes) },
    cuponEmitido: { findMany: jest.fn().mockResolvedValue(emitidos) },
    person: { findMany: jest.fn().mockResolvedValue([{ party_id: 77n, nombres: 'Rosa', apellidos: 'Prueba' }]) },
  };
}

describe('celularEnmascarado', () => {
  it('deja el primer y los 3 últimos dígitos', () => {
    expect(celularEnmascarado('987654321')).toBe('9•••••321');
    expect(celularEnmascarado('+51 987 654 321')).toBe('9•••••321');
  });
  it('no muestra el relleno ni números raros', () => {
    expect(celularEnmascarado('999999999')).toBeNull();
    expect(celularEnmascarado('wa-user:PE.123')).toBeNull();
    expect(celularEnmascarado(null)).toBeNull();
  });
});

describe('usosDeCupon COMPARTIDO', () => {
  const canjes = [
    { en: HOY, canal: 'CAJA', aplicado_por: 77n, pedido: pedido() },
    { en: ayer, canal: 'CARTA', aplicado_por: null, pedido: pedido({ codigo: 'CP-101', cliente_party_id: null, cliente_telefono: null, cliente_nombre: 'Invitado' }) },
    { en: ayer, canal: 'MOZO', aplicado_por: 77n, pedido: pedido({ codigo: 'CP-102', estado: 'ANULADO', cliente_party_id: 5n }) },
  ];

  it('resumen: descuento total sin anulados, clientes distintos, quedan', async () => {
    const r = await usosDeCupon(prismaFalso('COMPARTIDO', canjes), '1', 1, 10, HOY);
    expect(r.resumen).toMatchObject({ usos: 3, tope: 10, quedan: 7, descuentoTotal: 25, clientesDistintos: 1, anulados: 1 });
  });

  it('por trabajador: nombre, usos y soles (el anulado cuenta uso pero no soles)', async () => {
    const r = await usosDeCupon(prismaFalso('COMPARTIDO', canjes), '1', 1, 10, HOY);
    expect(r.porTrabajador).toEqual([
      { partyId: '77', nombre: 'Rosa Prueba', usos: 2, soles: 12.5 },
      { partyId: null, nombre: 'Sin trabajador (carta o canje antiguo)', usos: 1, soles: 12.5 },
    ]);
  });

  it('por día: 30 días con ceros', async () => {
    const r = await usosDeCupon(prismaFalso('COMPARTIDO', canjes), '1', 1, 10, HOY);
    expect(r.porDia).toHaveLength(30);
    expect(r.porDia.at(-1)).toEqual({ dia: '2027-03-19', usos: 1, soles: 12.5 });
    expect(r.porDia.at(-2)).toEqual({ dia: '2027-03-18', usos: 2, soles: 12.5 });
    expect(r.porDia[0].usos).toBe(0);
  });

  it('historial: más reciente primero, celular enmascarado, «Sin cuenta», anulado marcado y paginado', async () => {
    const r = await usosDeCupon(prismaFalso('COMPARTIDO', canjes), '1', 1, 2, HOY);
    expect(r.historial).toMatchObject({ total: 3, pagina: 1, tamano: 2, totalPaginas: 2 });
    expect(r.historial.items[0]).toMatchObject({ pedidoCodigo: 'CP-100', canal: 'CAJA', aplicadoPor: 'Rosa Prueba', cliente: { nombre: 'Lucía Ejemplo', celular: '9•••••321' }, totalPedido: 37.5, descuento: 12.5, anulado: false });
    expect(r.historial.items[1].cliente).toEqual({ nombre: null, celular: null, sinCuenta: true });
    const p2 = await usosDeCupon(prismaFalso('COMPARTIDO', canjes), '1', 2, 2, HOY);
    expect(p2.historial.items).toHaveLength(1);
    expect(p2.historial.items[0]).toMatchObject({ pedidoCodigo: 'CP-102', anulado: true });
  });

  it('cupón que no existe: 404', async () => {
    const p = prismaFalso('COMPARTIDO', []);
    p.cupon.findUnique.mockResolvedValue(null);
    await expect(usosDeCupon(p, '9', 1, 10, HOY)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('usosDeCupon UNICO_COMPROBANTE', () => {
  it('cuenta emitidos, canjeados, vencidos y anulados y usa el pedido de canje', async () => {
    const emitidos = [
      { estado: 'CANJEADO', canjeado_en: HOY, creado_en: ayer, pedidoCanje: pedido() },
      { estado: 'VIGENTE', vence_en: new Date('2027-01-01T00:00:00Z'), creado_en: ayer, pedidoCanje: null },
      { estado: 'VENCIDO', creado_en: ayer, pedidoCanje: null },
      { estado: 'ANULADO', creado_en: ayer, pedidoCanje: null },
      { estado: 'VIGENTE', vence_en: new Date('2027-12-01T00:00:00Z'), creado_en: ayer, pedidoCanje: null },
    ];
    const prisma = prismaFalso('UNICO_COMPROBANTE', [], emitidos);
    const r = await usosDeCupon(prisma, '1', 1, 10, HOY);
    expect(prisma.cuponCanjeCompartido.findMany).not.toHaveBeenCalled();
    expect(r.resumen).toMatchObject({ emitidos: 5, canjeados: 1, vencidos: 2, anulados: 1, usos: 1, descuentoTotal: 12.5 });
    expect(r.historial.items).toHaveLength(1);
  });
});

describe('GET /admin/cupones/:id/usos', () => {
  it('pide cupones/ver y delega en el servicio', async () => {
    const meta = Reflect.getMetadata(CLAVE_PERMISO, CuponesController.prototype.usosDelCupon);
    expect(meta).toEqual({ modulo: 'cupones', accion: 'ver' });
  });
});

describe('canjearCuponEnCaja guarda quién y por qué canal', () => {
  const armar = async (pedido: any, cupon: any, tx: any) => {
    const prisma: any = { pedido: { findUnique: jest.fn().mockResolvedValue(pedido) }, $transaction: (fn: any) => fn(tx) };
    const mod = await Test.createTestingModule({
      providers: [
        OfertasService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { obtenerCliente: () => ({}) } },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();
    const servicio = mod.get(OfertasService);
    jest.spyOn(servicio, 'validarCuponParaCarta').mockResolvedValue({ cupon } as any);
    return servicio;
  };
  const txBase = () => ({
    pedido: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    cupon: { findUnique: jest.fn().mockResolvedValue({ tope_usos: null }), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    cuponCanjeCompartido: { create: jest.fn() },
    cuponEmitido: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  });
  const pedidoBase = { id: 9n, subtotal: 50, envio: 0, total: 50, descuento: 0, puntos_canjeados: 0, estado: 'COLA', pago_estado: 'PENDIENTE', pago_metodo: 'EFECTIVO', cliente_party_id: 5n, lineas: [] };

  it('canje compartido: canal CAJA y aplicado_por = partyId del operador', async () => {
    const tx: any = txBase();
    const servicio = await armar(pedidoBase, { id: '5', emitidoId: null, descuentoCalculado: 12.5 }, tx);
    await servicio.canjearCuponEnCaja({ codigo: '25off', pedidoId: 9 }, { partyId: 77n });
    expect(tx.cuponCanjeCompartido.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cupon_id: 5n, pedido_id: 9n, canal: 'CAJA', aplicado_por: 77n }),
    });
  });

  it('cupón emitido: canal MOZO y canjeado_por del operador; descuenta del total (con envío)', async () => {
    const tx: any = txBase();
    const servicio = await armar({ ...pedidoBase, envio: 4, total: 54 }, { id: '5', emitidoId: '3', descuentoCalculado: 10, canales: ['MOZO'], tipo: 'MONTO' }, tx);
    const r = await servicio.canjearCuponEnCaja({ codigo: 'abc', pedidoId: 9, canal: 'MOZO' }, { partyId: 77n });
    expect(tx.cuponEmitido.updateMany).toHaveBeenCalledWith({ where: { id: 3n, estado: 'VIGENTE' }, data: expect.objectContaining({ estado: 'CANJEADO', canjeado_canal: 'MOZO', canjeado_por: 77n, pedido_canje_id: 9n }) });
    expect(r).toMatchObject({ canjeado: true, descuento: 10, totalActualizado: 44 });
  });

  it.each([
    ['ya cobrado', { pago_estado: 'PAGADO' }, 'ya está cobrado'],
    ['cobrado por el mozo', { cobro_mozo_en: new Date() }, 'ya está cobrado'],
    ['del personal', { es_personal: true }, 'del personal'],
    ['con promoción', { descuento: 5, total: 45 }, 'promoción'],
  ])('no se aplica a un pedido %s', async (_n, extra, texto) => {
    const tx: any = txBase();
    const servicio = await armar({ ...pedidoBase, ...extra }, { id: '5', emitidoId: null, descuentoCalculado: 10 }, tx);
    await expect(servicio.canjearCuponEnCaja({ codigo: 'X', pedidoId: 9 }, {})).rejects.toMatchObject({ response: { mensaje: expect.stringContaining(texto) } });
    expect(tx.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('cupón por medio de pago: no vale si el pedido se paga con otro medio', async () => {
    const tx: any = txBase();
    const servicio = await armar(pedidoBase, { id: '5', emitidoId: null, descuentoCalculado: 10, mediosPago: ['YAPE'] }, tx);
    await expect(servicio.canjearCuponEnCaja({ codigo: 'X', pedidoId: 9 }, {})).rejects.toMatchObject({ response: { mensaje: expect.stringContaining('YAPE') } });
  });

  it('dos canjes a la vez del mismo código: el segundo falla y no deja el descuento', async () => {
    const tx: any = txBase();
    tx.cuponEmitido.updateMany.mockResolvedValue({ count: 0 });
    const servicio = await armar(pedidoBase, { id: '5', emitidoId: '3', descuentoCalculado: 10 }, tx);
    await expect(servicio.canjearCuponEnCaja({ codigo: 'X', pedidoId: 9 }, {})).rejects.toMatchObject({ response: { codigo: 'CUPON_YA_CANJEADO' } });
  });

  it('cupón compartido en su último cupo: si otro lo gastó antes, se agota', async () => {
    const tx: any = txBase();
    tx.cupon.findUnique.mockResolvedValue({ tope_usos: 10 });
    tx.cupon.updateMany.mockResolvedValue({ count: 0 });
    const servicio = await armar(pedidoBase, { id: '5', emitidoId: null, descuentoCalculado: 10 }, tx);
    await expect(servicio.canjearCuponEnCaja({ codigo: 'X', pedidoId: 9 }, {})).rejects.toMatchObject({ response: { codigo: 'CUPON_AGOTADO' } });
  });
});

describe('lineasParaCupon', () => {
  it('deja fuera cortesías, cargos libres, combos y productos que no suman beneficios', () => {
    const l = (x: any) => ({ producto_id: 1n, cantidad: 1, subtotal: 10, producto: { categoria_id: 2n }, ...x });
    const r = lineasParaCupon({ lineas: [l({}), l({ es_cortesia: true }), l({ cargo_libre: true }), l({ oferta_id: 3n }), l({ linea_combo_id: 4n }), l({ producto: { no_suma_beneficios: true } })] });
    expect(r).toHaveLength(1);
  });
});
