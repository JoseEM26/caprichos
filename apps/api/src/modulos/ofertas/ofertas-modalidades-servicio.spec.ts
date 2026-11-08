jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));

import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OfertasService } from './ofertas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';

describe('OfertasService con modalidad', () => {
  let service: OfertasService;
  let prisma: any;
  const db = (id: bigint, extra: Record<string, unknown> = {}) => ({
    id, tipo: 'DESCUENTO', nombre: `Oferta ${id}`, dias: [], canales: ['CARTA', 'ADMIN', 'BOT'], modalidades: [], activo: true, creado_en: new Date(),
    descuento_tipo: 'PORCENTAJE', descuento_valor: 10, hora_desde: null, hora_hasta: null, fecha_desde: null, fecha_hasta: null, limite_usos: null,
    usos_actuales: 0, compra_minima: null, alcance_categoria_id: null, alcance_producto_id: null, solo_primera_compra: false, no_suma_beneficios: false,
    combosPrecio: [], combosParte: [], ...extra,
  });
  beforeEach(async () => {
    prisma = {
      oferta: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      producto: { findMany: jest.fn().mockResolvedValue([]) },
      opcionRequiere: { findMany: jest.fn().mockResolvedValue([]) },
      auditoria: { findMany: jest.fn().mockResolvedValue([]) },
      person: { findMany: jest.fn().mockResolvedValue([]) },
      reglaAcumulacion: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({ id: 1, cupon_con_descuento: false, promo_con_descuento: false, cupones_por_comprobante: 1, texto_pie: null }), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
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
    service = mod.get(OfertasService);
  });

  it('listarOfertas: sin modalidad salen todas con su lista; con modalidad solo las que valen', async () => {
    prisma.oferta.findMany.mockResolvedValue([db(1n), db(2n, { modalidades: ['COMER_LOCAL'] }), db(3n, { modalidades: ['LLEVAR', 'DELIVERY'] })]);
    const todas = await service.listarOfertas(undefined, false, 'CARTA', true);
    expect(todas.map((o) => o.id)).toEqual(['1', '2', '3']);
    expect(todas[1].modalidades).toEqual(['COMER_LOCAL']);
    expect((await service.listarOfertas(undefined, false, 'CARTA', true, 'DELIVERY')).map((o) => o.id)).toEqual(['1', '3']);
    expect((await service.listarOfertas(undefined, false, 'ADMIN', true, 'MESA')).map((o) => o.id)).toEqual(['1', '2']);
  });

  it('descuento automático: no se aplica si el pedido es de una modalidad excluida', async () => {
    const lineas = [{ productoId: 1n, categoriaId: 1n, cantidad: 1, subtotal: 100, precioUnitario: 100 }];
    prisma.oferta.findMany.mockResolvedValue([db(5n, { modalidades: ['COMER_LOCAL'] })]);
    const delivery = await service.calcularDescuentosParaPedido({ subtotal: 100, lineas, canal: 'CARTA', modalidad: 'DELIVERY' });
    expect(delivery.descuentoTotal).toBe(0);
    const mesa = await service.calcularDescuentosParaPedido({ subtotal: 100, lineas, canal: 'CARTA', modalidad: 'MESA' });
    expect(mesa.descuentoTotal).toBe(10);
    const sin = await service.calcularDescuentosParaPedido({ subtotal: 100, lineas, canal: 'CARTA' });
    expect(sin.descuentoTotal).toBe(10);
  });

  it('combo por id con modalidad no válida: OFERTA_NO_APLICA_MODALIDAD con el nombre; vacía = todas', async () => {
    const combo = (modalidades: string[]) => db(9n, { tipo: 'COMBO', nombre: 'Combo Salón', modalidades, combosParte: [] });
    prisma.oferta.findUnique.mockResolvedValue(combo(['COMER_LOCAL']));
    await expect(service.resolverPartesCombo(9, [], 1, 'CARTA', null, 'DELIVERY')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.resolverPartesCombo(9, [], 1, 'CARTA', null, 'DELIVERY')).rejects.toMatchObject({
      response: { codigo: 'OFERTA_NO_APLICA_MODALIDAD', mensaje: expect.stringContaining('Combo Salón') },
    });
    await expect(service.resolverPartesCombo(9, [], 1, 'CARTA', null, 'MESA')).resolves.toBeDefined();
    prisma.oferta.findUnique.mockResolvedValue(combo([]));
    await expect(service.resolverPartesCombo(9, [], 1, 'CARTA', null, 'DELIVERY')).resolves.toBeDefined();
  });
});
