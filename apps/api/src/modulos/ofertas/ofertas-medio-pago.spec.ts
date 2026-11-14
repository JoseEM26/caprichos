jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OfertasService } from './ofertas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { evaluarQuitaPromoMedio, aplicarQuitaPromoMedio, errorPromoSeQuita } from './promo-medio.util';
import { ofertaIncluyeCanal, ofertaIncluyeMedios, canalOferta } from './ofertas.util';
import { lineaPromo } from '../chatbot/conversacion/bienvenida.util';

const promo = (extra: object = {}) => ({
  id: 7n, tipo: 'DESCUENTO', nombre: '10 % con Yape', descuento_tipo: 'PORCENTAJE', descuento_valor: new Prisma.Decimal(10),
  alcance_categoria_id: null, alcance_categoria_ids: [], alcance_producto_id: null, compra_minima: null, dias: [], hora_desde: null,
  hora_hasta: null, fecha_desde: null, fecha_hasta: null, canales: ['CARTA', 'CAJA', 'MOZO', 'BOT'], modalidades: [], medios_pago: ['YAPE'],
  limite_usos: null, usos_actuales: 0, activo: true, orden: 0, solo_primera_compra: false, descripcion: null, ...extra,
});
const linea = { productoId: 10n, categoriaId: 1n, cantidad: 1, subtotal: 100, precioUnitario: 100 };

describe('promoción por medio de pago', () => {
  let service: OfertasService;
  let prisma: any;
  let medioCfg: unknown;

  beforeEach(async () => {
    medioCfg = undefined;
    prisma = {
      oferta: { findMany: jest.fn().mockResolvedValue([promo()]), findUnique: jest.fn(), update: jest.fn() },
      producto: { findMany: jest.fn().mockResolvedValue([]) },
      reglaAcumulacion: { upsert: jest.fn().mockResolvedValue({ id: 1, cupon_con_descuento: false, promo_con_descuento: false }) },
      parametro: { findUnique: jest.fn().mockImplementation(({ where }: any) => (where.clave === 'medios_pago_canal' && medioCfg ? Promise.resolve({ valor: medioCfg }) : Promise.resolve(null))) },
      $transaction: jest.fn(),
    };
    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        OfertasService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { obtenerCliente: () => ({}) } },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();
    service = modulo.get(OfertasService);
  });

  const calcular = (canal: string, medios?: string[]) =>
    service.calcularDescuentosParaPedido({ subtotal: 100, lineas: [linea], canal, medios });

  it('aplica solo si el pedido se paga con el medio de la promo', async () => {
    expect((await calcular('CARTA', ['YAPE'])).descuentoTotal).toBe(10);
    expect((await calcular('CARTA', ['EFECTIVO'])).descuentoTotal).toBe(0);
    // sin medio elegido todavía: no aplica (conservador)
    expect((await calcular('CARTA')).descuentoTotal).toBe(0);
    expect((await calcular('CARTA', [])).descuentoTotal).toBe(0);
  });

  it('una promo sin medios vale con cualquiera (incluso sin elegir)', async () => {
    prisma.oferta.findMany.mockResolvedValue([promo({ medios_pago: [] })]);
    expect((await calcular('CARTA', ['EFECTIVO'])).descuentoTotal).toBe(10);
    expect((await calcular('CARTA')).descuentoTotal).toBe(10);
  });

  it('pago dividido: solo aplica si TODO el pedido se paga con medios de la lista', async () => {
    prisma.oferta.findMany.mockResolvedValue([promo({ medios_pago: ['YAPE', 'PLIN'] })]);
    expect((await calcular('CARTA', ['YAPE', 'PLIN'])).descuentoTotal).toBe(10);
    expect((await calcular('CARTA', ['YAPE', 'EFECTIVO'])).descuentoTotal).toBe(0);
    expect(ofertaIncluyeMedios(['YAPE'], ['YAPE', 'PLIN'])).toBe(false);
  });

  it('canal MOZO distinto de CAJA: una promo solo de Caja no vale en el mozo y al revés', async () => {
    prisma.oferta.findMany.mockResolvedValue([promo({ canales: ['CAJA'] })]);
    expect((await calcular('CAJA', ['YAPE'])).descuentoTotal).toBe(10);
    expect((await calcular('MOZO', ['YAPE'])).descuentoTotal).toBe(0);
    prisma.oferta.findMany.mockResolvedValue([promo({ canales: ['MOZO'] })]);
    expect((await calcular('MOZO', ['YAPE'])).descuentoTotal).toBe(10);
    expect((await calcular('CAJA', ['YAPE'])).descuentoTotal).toBe(0);
  });

  it('ADMIN histórico vale en CAJA y MOZO (y la migración lo convierte a los dos)', () => {
    expect(ofertaIncluyeCanal(['CARTA', 'ADMIN'], 'CAJA')).toBe(true);
    expect(ofertaIncluyeCanal(['CARTA', 'ADMIN'], 'MOZO')).toBe(true);
    expect(canalOferta('MOZO')).toBe('MOZO');
    expect(canalOferta('CAJA')).toBe('CAJA');
  });

  it('si el medio de la promo está apagado en ese canal, la promo no se ofrece ahí (ni se aplica)', async () => {
    medioCfg = { CARTA: { YAPE: false } };
    expect((await calcular('CARTA', ['YAPE'])).descuentoTotal).toBe(0);
    // en Caja sigue encendido
    expect((await calcular('CAJA', ['YAPE'])).descuentoTotal).toBe(10);
    // listado: vigenteAhora false en la carta y true en Caja
    prisma.oferta.findMany.mockResolvedValue([{ ...promo(), creado_en: new Date(), combosPrecio: [], combosParte: [], imagen_archivo: null, categoria: null, producto: null }]);
    const enCarta = await service.listarOfertas(undefined, true, 'CARTA');
    expect(enCarta[0].vigenteAhora).toBe(false);
    const enCaja = await service.listarOfertas(undefined, true, 'CAJA');
    expect(enCaja[0].vigenteAhora).toBe(true);
  });

  it('crear/editar: medios_pago solo en Descuento y Lleva y paga', async () => {
    await expect(
      service.crearOferta({ tipo: 'ENVIO_GRATIS', nombre: 'Envío', mediosPago: ['YAPE'] } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('la línea del bot dice la condición: «10 % de descuento pagando con Yape»', () => {
    expect(lineaPromo({ nombre: 'Yape', tipo: 'DESCUENTO', descuentoTipo: 'PORCENTAJE', descuentoValor: 10, mediosPago: ['YAPE'] })).toBe('• Yape — 10 % de descuento pagando con Yape');
    expect(lineaPromo({ nombre: 'Doble', tipo: 'DESCUENTO', descuentoTipo: 'PORCENTAJE', descuentoValor: 10, mediosPago: ['YAPE', 'PLIN'] })).toContain('pagando con Yape o Plin');
    expect(lineaPromo({ nombre: 'Normal', tipo: 'DESCUENTO', descuentoTipo: 'PORCENTAJE', descuentoValor: 10, mediosPago: [] })).toBe('• Normal — 10 % de descuento');
  });
});

describe('cambio de medio al cobrar: el descuento se quita y el total sube', () => {
  const pedido = (extra: object = {}) => ({
    id: 5n, oferta_id: 7n, subtotal: 100, descuento: 10, envio: 0, puntos_canjeados: 0, total: 90,
    descuento_detalle: [{ tipo: 'DESCUENTO', id: '7', nombre: '10 % con Yape', montoDescontado: 10 }], ...extra,
  });
  const db = (medios: string[]) => ({ oferta: { findUnique: jest.fn().mockResolvedValue({ id: 7n, nombre: '10 % con Yape', medios_pago: medios }) } });

  it('con el medio de la promo no cambia nada; con otro, calcula el total nuevo', async () => {
    expect(await evaluarQuitaPromoMedio(db(['YAPE']), pedido(), ['YAPE'])).toBeNull();
    const q = await evaluarQuitaPromoMedio(db(['YAPE']), pedido(), ['EFECTIVO']);
    expect(q).toMatchObject({ nombre: '10 % con Yape', descuento: 10, totalAnterior: 90, totalNuevo: 100 });
    expect(errorPromoSeQuita(q!).getResponse()).toMatchObject({ codigo: 'PROMO_SE_QUITA', mensaje: 'Sin descuento 10 % con Yape: total S/ 100.00', totalNuevo: 100 });
  });

  it('pago dividido con un medio fuera de la lista también quita el descuento', async () => {
    expect(await evaluarQuitaPromoMedio(db(['YAPE']), pedido(), ['YAPE', 'EFECTIVO'])).not.toBeNull();
    expect(await evaluarQuitaPromoMedio(db(['YAPE', 'PLIN']), pedido(), ['YAPE', 'PLIN'])).toBeNull();
  });

  it('sin promo en el pedido, o promo sin condición de medio, o descuento del cupón: nada que quitar', async () => {
    expect(await evaluarQuitaPromoMedio(db(['YAPE']), pedido({ oferta_id: null }), ['EFECTIVO'])).toBeNull();
    expect(await evaluarQuitaPromoMedio(db([]), pedido(), ['EFECTIVO'])).toBeNull();
  });

  it('con otros descuentos (personal/puntos) solo se devuelve el de la promo y el total respeta los puntos canjeados', async () => {
    const p = pedido({ descuento: 15, puntos_canjeados: 5, total: 80, descuento_detalle: [{ tipo: 'DESCUENTO', id: '7', montoDescontado: 10 }, { tipo: 'PERSONAL', id: 'x', montoDescontado: 5 }] });
    const q = await evaluarQuitaPromoMedio(db(['YAPE']), p, ['TARJETA']);
    expect(q).toMatchObject({ descuento: 10, totalAnterior: 80, totalNuevo: 90 });
  });

  it('aplicar: sube el total, saca la promo del detalle, devuelve el uso y borra el plan viejo', async () => {
    const tx: any = {
      pedido: { update: jest.fn() },
      oferta: { update: jest.fn().mockResolvedValue({}) },
      pedidoPagoPlan: { deleteMany: jest.fn() },
    };
    const q = (await evaluarQuitaPromoMedio(db(['YAPE']), pedido(), ['EFECTIVO']))!;
    const r = await aplicarQuitaPromoMedio(tx, pedido(), q);
    expect(tx.pedido.update).toHaveBeenCalledWith({ where: { id: 5n }, data: expect.objectContaining({ descuento: 0, total: 100, oferta_id: null, descuento_detalle: [] }) });
    expect(tx.oferta.update).toHaveBeenCalledWith({ where: { id: 7n }, data: { usos_actuales: { decrement: 1 } } });
    expect(tx.pedidoPagoPlan.deleteMany).toHaveBeenCalledWith({ where: { pedido_id: 5n } });
    expect(r.total).toBe(100);
  });
});
