jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../../comprobantes/comprobantes.service', () => ({ ComprobantesService: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { CobrosService } from '../cobros.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { SalonService } from '../../salon/salon.service';
import { ComprobantesService } from '../../comprobantes/comprobantes.service';
import { UsuarioAutenticado } from '../../acceso/acceso.tipos';
import { CobrarDto, SinVoucherDto } from '../dto/cobrar.dto';
import { HttpException, HttpStatus } from '@nestjs/common';
import { validate } from 'class-validator';

describe('CobrosService - Exigencia de voucher para el MOZO (vch-api)', () => {
  let service: CobrosService;
  let prismaMock: any;
  let redisClientMock: any;
  let redisServiceMock: any;
  let auditoriaMock: any;

  const mozoUsuario: UsuarioAutenticado = {
    partyId: 10n,
    rol: 'MOZO',
    debeCambiar: false,
  };

  const cajeroUsuario: UsuarioAutenticado = {
    partyId: 20n,
    rol: 'CAJERO',
    debeCambiar: false,
  };

  const cajaAbiertaMock = {
    id: 1n,
    estado: 'ABIERTA',
    fecha: new Date(),
  };

  const pedidoMock = {
    id: 100n,
    total: 50.0,
    estado: 'ENTREGADO',
    pago_estado: 'PENDIENTE',
    comprobante_tipo: 'BOLETA',
    es_personal: false,
    cobros: [],
  };

  beforeEach(async () => {
    redisClientMock = {
      get: jest.fn().mockResolvedValue(null),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    };

    redisServiceMock = {
      obtenerCliente: jest.fn().mockReturnValue(redisClientMock),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };



    prismaMock = {
      caja: {
        findUnique: jest.fn().mockResolvedValue(cajaAbiertaMock),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      pedido: {
        findUnique: jest.fn().mockResolvedValue(pedidoMock),
        update: jest.fn().mockResolvedValue({ id: 100n, pago_estado: 'PAGADO' }),
      },
      parametro: {
        findUnique: jest.fn().mockResolvedValue({ clave: 'voucher_mozo_obligatorio', valor: true }),
      },
      voucherPago: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      cobro: {
        create: jest.fn().mockResolvedValue({
          id: 500n,
          pedido_id: 100n,
          caja_id: 1n,
          total: 50.0,
          cobrado_por: 10n,
          credito_personal: false,
          en: new Date(),
          pagos: [],
        }),
      },
      userAccount: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CobrosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
        { provide: SalonService, useValue: { liberarMesasDePedido: jest.fn() } },
        { provide: ComprobantesService, useValue: { emitirParaPedido: jest.fn(), firmarPorPedido: jest.fn(), transmitirEnSegundoPlano: jest.fn() } },
      ],
    }).compile();

    service = module.get<CobrosService>(CobrosService);
  });

  const dtoCobroDigitalYape: CobrarDto = {
    pedidoId: '100',
    pagos: [{ medio: 'YAPE', monto: 50.0 }],
  };

  const dtoCobroDigitalPlin: CobrarDto = {
    pedidoId: '100',
    pagos: [{ medio: 'PLIN', monto: 50.0 }],
  };

  const dtoCobroEfectivo: CobrarDto = {
    pedidoId: '100',
    pagos: [{ medio: 'EFECTIVO', monto: 50.0, recibido: 50.0 }],
  };

  it('el MOZO cobra con Yape SIN voucher: la captura es opcional, cobra y audita «sin captura»', async () => {
    prismaMock.voucherPago.findFirst.mockResolvedValue(null);

    const res = await service.cobrar(dtoCobroDigitalYape, mozoUsuario);

    expect(res.id).toBe('500');
    expect(prismaMock.cobro.create).toHaveBeenCalled();
    expect(auditoriaMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'COBRAR_SIN_VOUCHER' }),
    );
  });

  it('un voucher ILEGIBLE no cuenta como comprobante pero tampoco frena: cobra sin captura', async () => {
    prismaMock.voucherPago.findFirst.mockResolvedValue(null);

    const res = await service.cobrar(dtoCobroDigitalPlin, mozoUsuario);

    expect(res.id).toBe('500');
    expect(prismaMock.voucherPago.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ semaforo: { not: 'ILEGIBLE' } }) }),
    );
    expect(prismaMock.cobro.create).toHaveBeenCalled();
  });

  it('el motivo corto (menos de 5 caracteres) lo rechaza la validación del DTO antes de llegar al cobro', async () => {
    const dto = Object.assign(new SinVoucherDto(), { motivo: 'no' });
    const errores = await validate(dto);

    expect(errores.map((e) => e.property)).toContain('motivo');
    expect(prismaMock.cobro.create).not.toHaveBeenCalled();
  });

  it('permite el cobro al MOZO si existe un voucher legible para el pedido', async () => {
    prismaMock.voucherPago.findFirst.mockResolvedValue({
      id: 1n,
      pedido_id: 100n,
      semaforo: 'CONFIABLE',
      extraido: { legible: true, monto: 50.0 },
    });

    const res = await service.cobrar(dtoCobroDigitalYape, mozoUsuario);
    expect(res).toBeDefined();
    expect(res.id).toBe('500');
  });

  it('el MOZO puede cobrar en EFECTIVO sin requerir voucher', async () => {
    prismaMock.voucherPago.findFirst.mockResolvedValue(null);

    const res = await service.cobrar(dtoCobroEfectivo, mozoUsuario);
    expect(res).toBeDefined();
    expect(res.id).toBe('500');
  });

  it('el CAJERO cobra con Yape sin foto: queda auditado «sin captura»', async () => {
    prismaMock.voucherPago.findFirst.mockResolvedValue(null);

    const res = await service.cobrar(dtoCobroDigitalYape, cajeroUsuario);
    expect(res.id).toBe('500');
    expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'COBRAR_SIN_VOUCHER' }));
  });

  it('el CAJERO cobra con Yape si ya hay foto del pedido', async () => {
    prismaMock.voucherPago.findFirst.mockResolvedValue({ id: 1n, pedido_id: 100n, semaforo: 'SIN_LECTURA', extraido: null });

    const res = await service.cobrar(dtoCobroDigitalYape, cajeroUsuario);
    expect(res.id).toBe('500');
  });

  it('el parámetro voucher_mozo_obligatorio no tiene efecto: ni obligatorio ni consultado', async () => {
    prismaMock.parametro.findUnique.mockResolvedValue({ clave: 'voucher_mozo_obligatorio', valor: true });
    prismaMock.voucherPago.findFirst.mockResolvedValue(null);

    const res = await service.cobrar(dtoCobroDigitalYape, mozoUsuario);
    expect(res.id).toBe('500');
    expect(prismaMock.parametro.findUnique).not.toHaveBeenCalled();
  });
});
