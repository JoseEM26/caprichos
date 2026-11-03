jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OfertasService } from './ofertas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';

const base = {
  tipo: 'DESCUENTO',
  descuento_tipo: 'PORCENTAJE',
  descuento_valor: new Prisma.Decimal(25),
  alcance_categoria_id: null,
  alcance_producto_id: null,
  compra_minima: null,
  dias: [],
  hora_desde: null,
  hora_hasta: null,
  fecha_desde: null,
  fecha_hasta: null,
  canales: ['CARTA'],
  limite_usos: null,
  usos_actuales: 0,
  activo: true,
  orden: 0,
  mostrar_en_saludo_bot: false,
  solo_primera_compra: false,
  descripcion: null,
};

describe('Oferta de primera compra y saludo del bot', () => {
  let service: OfertasService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      oferta: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
      producto: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
      reglaAcumulacion: { upsert: jest.fn().mockResolvedValue({ id: 1, cupon_con_descuento: false, promo_con_descuento: false }) },
      customerAccount: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      contactMechanism: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findFirst: jest.fn().mockResolvedValue(null) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        OfertasService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { obtenerCliente: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn(), incr: jest.fn(), expire: jest.fn() }) } },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();
    service = modulo.get(OfertasService);
  });

  const cuentaCon = (telefono: string | null) => prisma.customerAccount.findFirst.mockResolvedValue({ telefono });
  const primera = (extra: object = {}) => ({ ...base, id: 7n, nombre: '25% primera compra', solo_primera_compra: true, ...extra });
  const lineaA = { productoId: 10n, categoriaId: 1n, cantidad: 1, subtotal: 100, precioUnitario: 100 };
  const lineaB = { productoId: 20n, categoriaId: 2n, cantidad: 1, subtotal: 50, precioUnitario: 50 };

  describe('clienteEsPrimeraCompra (celular, no nombre)', () => {
    it('no aplica si la cuenta no tiene celular verificado', async () => {
      cuentaCon(null);
      expect(await service.clienteEsPrimeraCompra(1n)).toBe(false);
    });

    it('no aplica si otra cuenta o un invitado con el mismo celular tiene un pedido válido', async () => {
      cuentaCon('987654321');
      prisma.customerAccount.findMany.mockResolvedValue([{ party_id: 2n }]);
      prisma.pedido.findFirst.mockResolvedValue({ id: 5n });
      expect(await service.clienteEsPrimeraCompra(1n)).toBe(false);
      const where = prisma.pedido.findFirst.mock.calls[0][0].where;
      expect(where.estado).toEqual({ not: 'ANULADO' });
      expect(where.OR).toContainEqual({ cliente_telefono: { in: ['987654321', '51987654321'] } });
    });

    it('aplica si el celular no tiene pedidos válidos', async () => {
      cuentaCon('987654321');
      expect(await service.clienteEsPrimeraCompra(1n)).toBe(true);
    });
  });

  describe('calcularDescuentosParaPedido', () => {
    it('aplica solo con sesión y celular elegible, sobre lo que no está en promoción', async () => {
      cuentaCon('987654321');
      // Promo automática 10% en categoría 1 (línea A ya tiene promo); la primera compra va sobre B
      prisma.oferta.findMany
        .mockResolvedValueOnce([
          { ...base, id: 1n, nombre: '10% Frappés', descuento_valor: new Prisma.Decimal(10), alcance_categoria_id: 1n },
          primera(),
        ])
        .mockResolvedValueOnce([]);
      const res = await service.calcularDescuentosParaPedido({
        subtotal: 150,
        lineas: [lineaA, lineaB],
        canal: 'CARTA',
        clientePartyId: 1n,
        clienteConSesion: true,
      });
      expect(res.ofertaId).toBe('7');
      expect(res.descuentoTotal).toBe(12.5);
    });

    it('no aplica sin sesión iniciada en la carta aunque el celular sea elegible', async () => {
      cuentaCon('987654321');
      prisma.oferta.findMany.mockResolvedValueOnce([primera()]).mockResolvedValueOnce([]);
      const res = await service.calcularDescuentosParaPedido({ subtotal: 150, lineas: [lineaA, lineaB], canal: 'CARTA', clientePartyId: 1n, clienteConSesion: false });
      expect(res.descuentoTotal).toBe(0);
      expect(prisma.pedido.findFirst).not.toHaveBeenCalled();
    });

    it('no aplica a líneas de combo', async () => {
      cuentaCon('987654321');
      prisma.oferta.findMany
        .mockResolvedValueOnce([primera()])
        .mockResolvedValueOnce([{ alcance_producto_id: 10n }, { alcance_producto_id: 20n }]);
      const res = await service.calcularDescuentosParaPedido({ subtotal: 150, lineas: [lineaA, lineaB], canal: 'CARTA', clientePartyId: 1n, clienteConSesion: true });
      expect(res.descuentoTotal).toBe(0);
    });

    it('no aplica si el celular ya tuvo un pedido válido', async () => {
      cuentaCon('987654321');
      prisma.pedido.findFirst.mockResolvedValue({ id: 9n });
      prisma.oferta.findMany.mockResolvedValueOnce([primera()]).mockResolvedValueOnce([]);
      const res = await service.calcularDescuentosParaPedido({ subtotal: 150, lineas: [lineaA, lineaB], canal: 'CARTA', clientePartyId: 1n, clienteConSesion: true });
      expect(res.descuentoTotal).toBe(0);
    });
  });

  describe('promoParaSaludo', () => {
    const ahora = new Date('2026-11-02T15:00:00-05:00');

    it('devuelve null si ninguna promoción está marcada para el saludo', async () => {
      prisma.oferta.findMany.mockResolvedValueOnce([]);
      expect(await service.promoParaSaludo(ahora)).toBeNull();
    });

    it('devuelve la de menor orden vigente con el texto aprobado y la URL de la carta', async () => {
      process.env.CARTA_URL_PUBLICA = 'https://caprichos.pe/';
      prisma.oferta.findMany.mockResolvedValueOnce([
        { ...primera({ id: 3n, nombre: 'vencida', mostrar_en_saludo_bot: true, orden: 0, fecha_hasta: new Date('2026-10-31') }) },
        { ...primera({ id: 4n, nombre: 'primera', mostrar_en_saludo_bot: true, orden: 1, fecha_hasta: new Date('2026-12-02') }) },
        { ...primera({ id: 5n, nombre: 'otra', mostrar_en_saludo_bot: true, orden: 2 }) },
      ]);
      const res = await service.promoParaSaludo(ahora);
      expect(res).toEqual({
        titulo: 'primera',
        texto: '25 % de descuento en tu primera compra en nuestra carta online. No aplica a promociones ni combos.',
        enlaceCarta: 'https://caprichos.pe',
      });
      delete process.env.CARTA_URL_PUBLICA;
    });

    it('busca solo promociones de tipo DESCUENTO activas y marcadas', async () => {
      prisma.oferta.findMany.mockResolvedValueOnce([]);
      await service.promoParaSaludo(ahora);
      expect(prisma.oferta.findMany.mock.calls[0][0].where).toEqual({ mostrar_en_saludo_bot: true, activo: true, tipo: 'DESCUENTO' });
    });
  });

  describe('reglas al crear la oferta', () => {
    it('rechaza una vigencia de más de un mes', async () => {
      await expect(
        service.crearOferta({ tipo: 'DESCUENTO', nombre: 'x', descuentoTipo: 'PORCENTAJE', descuentoValor: 25, soloPrimeraCompra: true, fechaDesde: '2026-11-02', fechaHasta: '2027-01-15' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza la primera compra sin fecha de fin', async () => {
      await expect(
        service.crearOferta({ tipo: 'DESCUENTO', nombre: 'x', descuentoTipo: 'PORCENTAJE', descuentoValor: 25, soloPrimeraCompra: true } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza la primera compra en un combo o 2x1', async () => {
      await expect(
        service.crearOferta({ tipo: 'LLEVA_PAGA', nombre: 'x', lleva: 2, paga: 1, soloPrimeraCompra: true, fechaDesde: '2026-11-02', fechaHasta: '2026-12-02' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('fuerza el canal solo carta y acepta exactamente un mes', async () => {
      const creada = { id: 7n, nombre: 'x', tipo: 'DESCUENTO', descripcion: null, lleva: null, paga: null, alcance_categoria_id: null, alcance_producto_id: null,
        descuento_tipo: 'PORCENTAJE', descuento_valor: new Prisma.Decimal(25), compra_minima: null, dias: [], hora_desde: null, hora_hasta: null,
        fecha_desde: null, fecha_hasta: new Date('2026-12-02'), canales: ['CARTA'], limite_usos: null, usos_actuales: 0, no_suma_beneficios: false,
        mostrar_en_saludo_bot: false, solo_primera_compra: true, orden: 0, activo: false, creado_en: new Date(), imagen_archivo_id: null,
        categoria: null, producto: null, imagen_archivo: null, combosPrecio: [], combosParte: [] };
      prisma.$transaction.mockImplementation(async (cb: any) =>
        cb({ oferta: { create: jest.fn().mockResolvedValue({ id: 7n }), findUnique: jest.fn().mockResolvedValue(creada) }, comboPrecio: {}, comboParte: {} }),
      );
      const res = await service.crearOferta({ tipo: 'DESCUENTO', nombre: 'x', descuentoTipo: 'PORCENTAJE', descuentoValor: 25, soloPrimeraCompra: true, canales: ['ADMIN'], fechaDesde: '2026-11-02', fechaHasta: '2026-12-02' } as any);
      expect(res.canales).toEqual(['CARTA']);
      expect(res.soloPrimeraCompra).toBe(true);
    });
  });
});
