jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));
jest.mock('../acceso/acceso.guard', () => ({ AccesoGuard: class {} }));

import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { celularEnmascarado, usosDeCupon } from './cupon-usos';
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
  it('canje compartido: canal CAJA y aplicado_por = partyId del operador', async () => {
    const tx: any = {
      cupon: { update: jest.fn() },
      cuponCanjeCompartido: { create: jest.fn() },
      pedido: { update: jest.fn() },
    };
    const prisma: any = {
      pedido: { findUnique: jest.fn().mockResolvedValue({ id: 9n, subtotal: 50, envio: 0, puntos_canjeados: 0, cliente_party_id: 5n }) },
      $transaction: (fn: any) => fn(tx),
    };
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
    jest.spyOn(servicio, 'validarCuponParaCarta').mockResolvedValue({ cupon: { id: '5', emitidoId: null, descuentoCalculado: 12.5 } } as any);

    await servicio.canjearCuponEnCaja({ codigo: '25off', pedidoId: 9 }, { partyId: 77n });

    expect(tx.cuponCanjeCompartido.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cupon_id: 5n, pedido_id: 9n, canal: 'CAJA', aplicado_por: 77n }),
    });
  });
});
