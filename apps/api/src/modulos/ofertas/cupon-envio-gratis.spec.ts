jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));

import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { OfertasService } from './ofertas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';

// Miércoles 4 de noviembre de 2026 (Lima = UTC-5)
const A_LAS_14 = new Date('2026-11-04T19:00:00.000Z');
const A_LAS_18 = new Date('2026-11-04T23:00:00.000Z');

function cuponEnvio(extra: Record<string, unknown> = {}) {
  return {
    id: 5n,
    modo: 'COMPARTIDO',
    codigo_base: 'DELIVERYGRATIS',
    descripcion: null,
    descuento_tipo: 'ENVIO_GRATIS',
    descuento_valor: new Prisma.Decimal(0),
    compra_minima: null,
    categoria_id: null,
    producto_id: null,
    canales: ['CARTA', 'ADMIN'],
    requiere_cuenta: false,
    dias: [] as number[],
    hora_desde: new Date('1970-01-01T14:00:00.000Z'),
    hora_hasta: new Date('1970-01-01T18:00:00.000Z'),
    fecha_desde: null,
    fecha_hasta: null,
    tope_usos: 2,
    usos_actuales: 0,
    max_por_cliente: null,
    activo: true,
    ...extra,
  };
}

describe('cupón de envío gratis (ofertas)', () => {
  let service: OfertasService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      cuponEmitido: { findUnique: jest.fn().mockResolvedValue(null) },
      cupon: { findUnique: jest.fn() },
      cuponCanjeCompartido: { count: jest.fn().mockResolvedValue(0) },
      reglaAcumulacion: { upsert: jest.fn().mockResolvedValue({ id: 1, cupon_con_descuento: false, promo_con_descuento: false, cupones_por_comprobante: 1, texto_pie: null }) },
      oferta: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), create: jest.fn() },
      producto: { findMany: jest.fn().mockResolvedValue([]) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    prismaMock.$transaction = jest.fn(async (fn: any) => fn(prismaMock));
    const redisMock = {
      obtenerCliente: () => ({
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfertasService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();
    service = module.get(OfertasService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const calcular = (codigo = 'DELIVERYGRATIS', canal = 'CARTA') =>
    service.calcularDescuentosParaPedido({
      subtotal: 50,
      lineas: [{ productoId: 1n, cantidad: 2, subtotal: 50, precioUnitario: 25 }],
      canal,
      cuponCodigo: codigo,
    });

  it('dentro del horario del cupón: marca envío gratis, sin descuento de productos, y apunta al cupón', async () => {
    jest.useFakeTimers().setSystemTime(A_LAS_14);
    prismaMock.cupon.findUnique.mockResolvedValue(cuponEnvio());

    const res = await calcular();

    expect(res.envioGratisCupon).toBe(true);
    expect(res.descuentoTotal).toBe(0);
    expect(res.cuponId).toBe('5');
    expect(res.detalles[0]).toMatchObject({ tipo: 'CUPON', descuentoTipo: 'ENVIO_GRATIS', montoDescontado: 0 });
  });

  it('fuera del horario (18:00 ya no entra) el cupón se rechaza', async () => {
    jest.useFakeTimers().setSystemTime(A_LAS_18);
    prismaMock.cupon.findUnique.mockResolvedValue(cuponEnvio());

    await expect(calcular()).rejects.toMatchObject({ response: { codigo: 'CUPON_FUERA_DE_HORARIO' } });
  });

  it('sin horario el cupón vale todo el día', async () => {
    jest.useFakeTimers().setSystemTime(A_LAS_18);
    prismaMock.cupon.findUnique.mockResolvedValue(cuponEnvio({ hora_desde: null, hora_hasta: null }));

    expect((await calcular()).envioGratisCupon).toBe(true);
  });

  it('con el tope de usos agotado se rechaza', async () => {
    jest.useFakeTimers().setSystemTime(A_LAS_14);
    prismaMock.cupon.findUnique.mockResolvedValue(cuponEnvio({ usos_actuales: 2 }));

    await expect(calcular()).rejects.toMatchObject({ response: { codigo: 'CUPON_AGOTADO' } });
  });

  it('los cupones no se aceptan por chat: WhatsApp y el bot no aceptan el cupón de envío aunque tenga BOT', async () => {
    jest.useFakeTimers().setSystemTime(A_LAS_14);
    prismaMock.cupon.findUnique.mockResolvedValue(cuponEnvio({ canales: ['TODOS', 'BOT'] }));

    await expect(calcular('DELIVERYGRATIS', 'BOT')).rejects.toMatchObject({ response: { codigo: 'CUPON_NO_APLICA_CANAL' } });
    await expect(calcular('DELIVERYGRATIS', 'WHATSAPP')).rejects.toMatchObject({ response: { codigo: 'CUPON_NO_APLICA_CANAL' } });
  });

  it('se combina con un descuento automático, pero el cupón no descuenta productos (un cupón por pedido)', async () => {
    jest.useFakeTimers().setSystemTime(A_LAS_14);
    prismaMock.cupon.findUnique.mockResolvedValue(cuponEnvio());
    prismaMock.oferta.findMany.mockResolvedValue([
      {
        id: 1n,
        tipo: 'DESCUENTO',
        nombre: '10% en toda la carta',
        descuento_tipo: 'PORCENTAJE',
        descuento_valor: new Prisma.Decimal(10),
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
      },
    ]);

    const res = await calcular();

    expect(res.descuentoTotal).toBe(5); // solo el automático; el cupón no suma descuento
    expect(res.ofertaId).toBe('1');
    expect(res.envioGratisCupon).toBe(true);
  });

  it('un cupón de descuento normal sigue sin marcar envío gratis', async () => {
    jest.useFakeTimers().setSystemTime(A_LAS_14);
    prismaMock.cupon.findUnique.mockResolvedValue(
      cuponEnvio({ descuento_tipo: 'MONTO', descuento_valor: new Prisma.Decimal(5), canales: ['CARTA'] }),
    );

    const res = await calcular();

    expect(res.envioGratisCupon).toBe(false);
    expect(res.descuentoTotal).toBe(5);
  });

  describe('promo ENVIO_GRATIS en el servicio (alta y listado)', () => {
    it('al crear una promo de envío descarta descuento, lleva/paga y productos, y sale con BOT marcado por defecto', async () => {
      prismaMock.oferta.create.mockResolvedValue({ id: 9n });
      prismaMock.oferta.findUnique
        .mockResolvedValueOnce(null) // nombre libre
        .mockResolvedValueOnce({
          id: 9n, tipo: 'ENVIO_GRATIS', nombre: 'Delivery gratis de 2 a 6 pm', descripcion: null,
          lleva: null, paga: null, alcance_categoria_id: null, alcance_producto_id: null,
          descuento_tipo: null, descuento_valor: null, compra_minima: null, dias: [3],
          hora_desde: new Date('1970-01-01T14:00:00.000Z'), hora_hasta: new Date('1970-01-01T18:00:00.000Z'),
          fecha_desde: null, fecha_hasta: null, canales: ['CARTA', 'ADMIN'], limite_usos: null, usos_actuales: 0,
          no_suma_beneficios: false, mostrar_en_saludo_bot: false, solo_primera_compra: false, orden: 0,
          activo: false, visible_carta: true, creado_en: new Date(), imagen_archivo_id: null, imagen_archivo: null,
          categoria: null, producto: null, combosPrecio: [], combosParte: [],
        });

      await service.crearOferta({
        tipo: 'ENVIO_GRATIS',
        nombre: 'Delivery gratis de 2 a 6 pm',
        descuentoTipo: 'PORCENTAJE',
        descuentoValor: 10,
        lleva: 2,
        paga: 1,
        alcanceProductoId: 3,
        dias: [3],
        horaDesde: '14:00',
        horaHasta: '18:00',
      } as any);

      const data = prismaMock.oferta.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        tipo: 'ENVIO_GRATIS',
        descuento_tipo: null,
        descuento_valor: null,
        lleva: null,
        paga: null,
        alcance_producto_id: null,
        canales: ['CARTA', 'ADMIN', 'BOT'],
      });
    });

    it('la lista para el bot lista la promo de envío solo si tiene BOT', async () => {
      const base = { id: 9n, tipo: 'ENVIO_GRATIS', nombre: 'Envío', dias: [], hora_desde: null, hora_hasta: null, fecha_desde: null, fecha_hasta: null, activo: true, limite_usos: null, usos_actuales: 0, descripcion: null, lleva: null, paga: null, descuento_tipo: null, descuento_valor: null, compra_minima: null, orden: 0, creado_en: new Date(), no_suma_beneficios: false, mostrar_en_saludo_bot: false, solo_primera_compra: false, visible_carta: true, imagen_archivo: null, categoria: null, producto: null, combosPrecio: [], combosParte: [], alcance_categoria_id: null, alcance_producto_id: null, imagen_archivo_id: null };
      prismaMock.oferta.findMany.mockResolvedValueOnce([{ ...base, canales: ['CARTA', 'ADMIN'] }]);
      expect(await service.listarOfertas(undefined, true, 'WHATSAPP')).toHaveLength(0); // sin WhatsApp el bot ni la lista

      prismaMock.oferta.findMany.mockResolvedValueOnce([{ ...base, canales: ['CARTA', 'ADMIN', 'BOT'] }]);
      expect((await service.listarOfertas(undefined, true, 'BOT'))[0].vigenteAhora).toBe(true);
    });
  });
});
