jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class { emitirAdmin() {} } }));
jest.mock('../acceso/acceso.guard', () => ({ AccesoGuard: class {} }));

import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { OfertasService } from './ofertas.service';
import { CuponesController } from './ofertas.controller';
import { ValidarCuponCajaDto } from './dto/validar-cupon-caja.dto';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { MATRIZ } from '../acceso/permisos';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';

const lineas = [{ productoId: '10', cantidad: 2, subtotal: 50, precioUnitario: 25 }];

const cupon = (extra: any = {}) => ({
  id: 5n,
  modo: 'COMPARTIDO',
  codigo_base: 'VERANO10',
  descripcion: null,
  descuento_tipo: 'PORCENTAJE',
  descuento_valor: new Prisma.Decimal(10),
  compra_minima: null,
  categoria_id: null,
  producto_id: null,
  canales: [],
  requiere_cuenta: false,
  max_por_cliente: null,
  tope_usos: null,
  usos_actuales: 0,
  activo: true,
  dias: [],
  hora_desde: null,
  hora_hasta: null,
  ...extra,
});

describe('Cupón en Nuevo pedido de caja y mozo (solo validar)', () => {
  let service: OfertasService;
  let prisma: any;
  let canalVisto: string[];

  beforeEach(async () => {
    canalVisto = [];
    prisma = {
      oferta: { findMany: jest.fn().mockResolvedValue([]) },
      producto: { findMany: jest.fn().mockResolvedValue([{ id: 10n, categoria_id: 1n, no_suma_beneficios: false }]) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      reglaAcumulacion: {
        upsert: jest.fn().mockResolvedValue({ id: 1, cupon_con_descuento: false, promo_con_descuento: false }),
      },
      cupon: { findUnique: jest.fn().mockResolvedValue(null) },
      cuponEmitido: { findUnique: jest.fn().mockResolvedValue(null) },
      cuponCanjeCompartido: { count: jest.fn().mockResolvedValue(0) },
    };
    const redis = { get: jest.fn().mockResolvedValue(null), del: jest.fn(), incr: jest.fn().mockResolvedValue(1), expire: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        OfertasService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { obtenerCliente: () => redis } },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();
    service = mod.get(OfertasService);
    const original = service.calcularDescuentosParaPedido.bind(service);
    jest.spyOn(service, 'calcularDescuentosParaPedido').mockImplementation((p: any) => {
      canalVisto.push(p.canal);
      return original(p);
    });
  });

  it('cupón válido: devuelve el descuento calculado con las reglas del pedido', async () => {
    prisma.cupon.findUnique.mockResolvedValue(cupon());
    const r = await service.validarCuponParaCaja({ codigo: ' verano10 ', canal: 'MOZO', lineas });
    expect(r).toMatchObject({ valido: true, codigo: 'VERANO10', descuento: 5, envioGratis: false });
    expect(canalVisto).toEqual(['MOZO']);
  });

  it('sin canal usa CAJA', async () => {
    prisma.cupon.findUnique.mockResolvedValue(cupon());
    await service.validarCuponParaCaja({ codigo: 'VERANO10', lineas });
    expect(canalVisto).toEqual(['CAJA']);
  });

  it('código que no existe: error claro', async () => {
    await expect(service.validarCuponParaCaja({ codigo: 'NADA', lineas })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cupón emitido vencido', async () => {
    prisma.cuponEmitido.findUnique.mockResolvedValue({
      id: 9n,
      estado: 'EMITIDO',
      vence_en: new Date('2020-01-01'),
      cupon: cupon({ modo: 'UNICO_COMPROBANTE' }),
    });
    await expect(service.validarCuponParaCaja({ codigo: 'ABC', lineas })).rejects.toMatchObject({
      response: { codigo: 'CUPON_VENCIDO' },
    });
  });

  it('cupón emitido ya canjeado no se puede usar de nuevo', async () => {
    prisma.cuponEmitido.findUnique.mockResolvedValue({ id: 9n, estado: 'CANJEADO', cupon: cupon() });
    await expect(service.validarCuponParaCaja({ codigo: 'ABC', lineas })).rejects.toMatchObject({
      response: { codigo: 'CUPON_YA_CANJEADO' },
    });
  });

  it('compra mínima no alcanzada', async () => {
    prisma.cupon.findUnique.mockResolvedValue(cupon({ compra_minima: new Prisma.Decimal(80) }));
    await expect(service.validarCuponParaCaja({ codigo: 'VERANO10', lineas })).rejects.toMatchObject({
      response: { codigo: 'COMPRA_MINIMA_NO_ALCANZADA' },
    });
  });

  it('tope de usos agotado', async () => {
    prisma.cupon.findUnique.mockResolvedValue(cupon({ tope_usos: 3, usos_actuales: 3 }));
    await expect(service.validarCuponParaCaja({ codigo: 'VERANO10', lineas })).rejects.toMatchObject({
      response: { codigo: 'CUPON_AGOTADO' },
    });
  });

  it('canal: un cupón de envío gratis solo para la carta no vale en caja', async () => {
    prisma.cupon.findUnique.mockResolvedValue(cupon({ descuento_tipo: 'ENVIO_GRATIS', canales: ['CARTA'] }));
    await expect(service.validarCuponParaCaja({ codigo: 'VERANO10', lineas })).rejects.toMatchObject({
      response: { codigo: 'CUPON_NO_APLICA_CANAL' },
    });
  });

  it('envío gratis válido en caja: descuento 0 y envioGratis', async () => {
    prisma.cupon.findUnique.mockResolvedValue(cupon({ descuento_tipo: 'ENVIO_GRATIS', canales: [] }));
    const r = await service.validarCuponParaCaja({ codigo: 'VERANO10', lineas });
    expect(r).toMatchObject({ valido: true, descuento: 0, envioGratis: true });
  });

  it('acumulación: con una promoción mayor y sin acumular, el cupón no suma', async () => {
    prisma.cupon.findUnique.mockResolvedValue(cupon());
    prisma.oferta.findMany.mockResolvedValue([
      {
        id: 1n,
        tipo: 'DESCUENTO',
        nombre: '50% todo',
        descuento_tipo: 'PORCENTAJE',
        descuento_valor: new Prisma.Decimal(50),
        alcance_categoria_id: null,
        alcance_producto_id: null,
        compra_minima: null,
        solo_primera_compra: false,
        dias: [],
        hora_desde: null,
        hora_hasta: null,
        fecha_desde: null,
        fecha_hasta: null,
        canales: [],
        limite_usos: null,
        usos_actuales: 0,
        activo: true,
      },
    ]);
    await expect(service.validarCuponParaCaja({ codigo: 'VERANO10', lineas })).rejects.toMatchObject({
      response: { codigo: 'CUPON_NO_SUMA' },
    });
  });

  it('el DTO exige código y al menos una línea', async () => {
    const mal = plainToInstance(ValidarCuponCajaDto, { codigo: '', lineas: [] });
    expect((await validate(mal)).length).toBeGreaterThan(0);
    const bien = plainToInstance(ValidarCuponCajaDto, { codigo: 'X', canal: 'CAJA', lineas });
    expect(await validate(bien, { whitelist: true })).toHaveLength(0);
    expect(bien.lineas[0].cantidad).toBe(2);
  });

  describe('permisos del endpoint POST /admin/cupones/validar', () => {
    const meta = Reflect.getMetadata(CLAVE_PERMISO, CuponesController.prototype.validarEnCaja);
    it('pide pedidos/crear', () => expect(meta).toEqual({ modulo: 'pedidos', accion: 'crear' }));
    it.each(['ADMIN', 'CAJERO', 'MOZO', 'SUPERVISOR'])('%s puede', (rol) =>
      expect(MATRIZ[rol]).toContain('pedidos/crear'));
    it.each(['COCINA', 'REPARTIDOR', 'ALMACEN'])('%s no puede', (rol) =>
      expect(MATRIZ[rol] ?? []).not.toContain('pedidos/crear'));
  });
});
