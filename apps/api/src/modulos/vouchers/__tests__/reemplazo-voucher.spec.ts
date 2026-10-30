jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { VouchersService } from '../vouchers.service';
import { VouchersIaService } from '../vouchers-ia.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { PagoPlanService } from '../../pedidos/pago-plan.service';
import { obtenerFechaHoraLima } from '../../local/local.util';

const file = { buffer: Buffer.from('imagen-test'), mimetype: 'image/jpeg' } as any;

describe('reemplazo de vouchers (historial sin borrar, reglas por rol y medio)', () => {
  let service: VouchersService;
  let prisma: any;
  let auditoria: any;

  const pedidoBase = (extra: any = {}) => ({
    id: 50n,
    codigo: 'CP-W021',
    total: 17,
    pago_preferido: 'YAPE',
    pago_metodo: 'YAPE',
    estado: 'COLA',
    modalidad: 'LLEVAR',
    pago_estado: 'PENDIENTE',
    pago_coordinado_en: null,
    party_id: 10n,
    planPago: [],
    ...extra,
  });

  beforeEach(async () => {
    prisma = {
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findUnique: jest.fn().mockResolvedValue(pedidoBase()), update: jest.fn() },
      pedidoPagoPlan: { deleteMany: jest.fn(), createMany: jest.fn() },
      person: {
        findMany: jest.fn().mockResolvedValue([{ party_id: 10n, nombres: 'Ana Maria', apellidos: 'Perez Lopez' }]),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      voucherPago: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 200n, creado_en: new Date(), ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      notificacion: { create: jest.fn().mockResolvedValue({ id: 1n, titulo: 't' }) },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const iaMock = {
      analizarVoucher: jest.fn().mockResolvedValue({
        sinLectura: false,
        extraido: {
          legible: true,
          monto: 17,
          moneda: 'PEN',
          operacion: 'OP-1',
          fecha: obtenerFechaHoraLima().fechaIso,
          hora: '12:00',
          titular: 'Maria Jose M.',
          destinoNumero: '977503006',
          medioDetectado: 'YAPE',
          confianza: 0.95,
        },
      }),
      estaParametroVoucherIaActivo: jest.fn().mockResolvedValue(true),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VouchersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ArchivosService, useValue: { subirArchivo: jest.fn().mockResolvedValue({ id: '900' }) } },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: VouchersIaService, useValue: iaMock },
        { provide: PagoPlanService, useValue: new PagoPlanService() },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();
    service = module.get(VouchersService);
  });

  const mozo = { partyId: 10n, rol: 'MOZO', debeCambiar: false };
  const cajero = { partyId: 20n, rol: 'CAJERO', debeCambiar: false };
  const vigente = (extra: any = {}) => ({ id: 100n, creado_en: new Date(), reemplazado_en: null, ...extra });

  it('mozo: con Caja ya aprobado el pago recibe 409 VOUCHER_CAMBIO_BLOQUEADO con el mensaje nuevo', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedidoBase({ estado: 'PREPARANDO', pago_estado: 'COORDINADO' }));
    prisma.voucherPago.findMany.mockResolvedValue([vigente()]);
    const err = await service.subirYProcesar(file, { pedidoId: '50', medio: 'YAPE' }, mozo).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(409);
    expect(err.getResponse().codigo).toBe('VOUCHER_CAMBIO_BLOQUEADO');
    expect(err.getResponse().mensaje).toBe('Caja ya aprobó el pago de este pedido; pide a Caja que cambie el voucher');
    expect(prisma.voucherPago.create).not.toHaveBeenCalled();
  });

  it('mozo: en COLA o en cocina con pago pendiente sí puede cambiar el voucher', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedidoBase({ estado: 'PREPARANDO' }));
    prisma.voucherPago.findMany.mockResolvedValue([vigente()]);
    await service.subirYProcesar(file, { pedidoId: '50', medio: 'YAPE' }, mozo);
    expect(prisma.voucherPago.create).toHaveBeenCalled();
  });

  it('mozo: con Caja ya aprobado no puede subir el primer voucher (409)', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedidoBase({ pago_estado: 'COORDINADO' }));
    prisma.voucherPago.findMany.mockResolvedValue([]);
    const err = await service.subirYProcesar(file, { pedidoId: '50', medio: 'YAPE' }, mozo).catch((e) => e);
    expect(err.getResponse().codigo).toBe('VOUCHER_CAMBIO_BLOQUEADO');
    expect(prisma.voucherPago.create).not.toHaveBeenCalled();
  });

  it('quitar: el mozo retira su voucher sin borrarlo (marca retirado y reemplazado_en)', async () => {
    prisma.voucherPago.findUnique.mockResolvedValue({ id: 100n, pedido_id: 50n, reemplazado_en: null });
    await service.quitarVoucher('100', undefined, mozo, '1.2.3.4');
    expect(prisma.voucherPago.updateMany).toHaveBeenCalledWith({
      where: { id: 100n, reemplazado_en: null },
      data: expect.objectContaining({ retirado: true, reemplazado_en: expect.any(Date), reemplazado_por: 10n }),
    });
    expect(prisma.voucherPago.delete).toBeUndefined();
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'QUITAR_VOUCHER' }));
  });

  it('quitar: con Caja ya aprobado el mozo recibe 409', async () => {
    prisma.voucherPago.findUnique.mockResolvedValue({ id: 100n, pedido_id: 50n, reemplazado_en: null });
    prisma.pedido.findUnique.mockResolvedValue(pedidoBase({ pago_estado: 'COORDINADO' }));
    const err = await service.quitarVoucher('100', undefined, mozo).catch((e) => e);
    expect(err.getResponse().codigo).toBe('VOUCHER_CAMBIO_BLOQUEADO');
    expect(prisma.voucherPago.updateMany).not.toHaveBeenCalled();
  });

  it('quitar: el mozo no quita vouchers de pedidos ajenos', async () => {
    prisma.voucherPago.findUnique.mockResolvedValue({ id: 100n, pedido_id: 50n, reemplazado_en: null });
    prisma.pedido.findUnique.mockResolvedValue(pedidoBase({ party_id: 99n }));
    await expect(service.quitarVoucher('100', undefined, mozo)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('quitar: Caja exige motivo de al menos 5 caracteres', async () => {
    prisma.voucherPago.findUnique.mockResolvedValue({ id: 100n, pedido_id: 50n, reemplazado_en: null });
    const err = await service.quitarVoucher('100', 'no', cajero).catch((e) => e);
    expect(err.getResponse().codigo).toBe('MOTIVO_CAMBIO_REQUERIDO');
  });

  it('quitar: un voucher ya retirado no se vuelve a quitar', async () => {
    prisma.voucherPago.findUnique.mockResolvedValue({ id: 100n, pedido_id: 50n, reemplazado_en: new Date() });
    await expect(service.quitarVoucher('100', undefined, mozo)).rejects.toBeInstanceOf(ConflictException);
  });

  it('mozo: reemplaza mientras no esta en cocina, marca el anterior y no lo borra', async () => {
    prisma.voucherPago.findMany.mockResolvedValue([vigente()]);
    await service.subirYProcesar(file, { pedidoId: '50', medio: 'YAPE' }, mozo);
    expect(prisma.voucherPago.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reemplaza_a: 100n, motivo_cambio: null }) }),
    );
    expect(prisma.voucherPago.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [100n] }, reemplazado_en: null },
      data: expect.objectContaining({ reemplazado_en: expect.any(Date), reemplazado_por: 10n }),
    });
    expect(prisma.voucherPago.delete).toBeUndefined();
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REEMPLAZAR_VOUCHER' }));
  });

  it('cajero: cambio tardío exige motivo de al menos 5 caracteres', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedidoBase({ estado: 'PREPARANDO', pago_estado: 'COORDINADO' }));
    prisma.voucherPago.findMany.mockResolvedValue([vigente()]);
    const err = await service.subirYProcesar(file, { pedidoId: '50', medio: 'YAPE', motivoCambio: 'mal' }, cajero).catch((e) => e);
    expect(err.getResponse().codigo).toBe('MOTIVO_CAMBIO_REQUERIDO');
    expect(prisma.voucherPago.create).not.toHaveBeenCalled();
  });

  it('cajero: con motivo reemplaza aunque el pedido esté en cocina, y guarda el motivo', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedidoBase({ estado: 'PREPARANDO', pago_estado: 'COORDINADO' }));
    prisma.voucherPago.findMany.mockResolvedValue([vigente()]);
    await service.subirYProcesar(file, { pedidoId: '50', medio: 'YAPE', motivoCambio: 'Foto borrosa, se reenvio' }, cajero);
    expect(prisma.voucherPago.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ motivo_cambio: 'Foto borrosa, se reenvio' }) }),
    );
  });

  it('cajero: un voucher de un pedido ya PAGADO no se cambia', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedidoBase({ estado: 'ENTREGADO', pago_estado: 'PAGADO' }));
    prisma.voucherPago.findMany.mockResolvedValue([vigente()]);
    const err = await service.subirYProcesar(file, { pedidoId: '50', medio: 'YAPE', motivoCambio: 'motivo largo' }, cajero).catch((e) => e);
    expect(err.getResponse().codigo).toBe('VOUCHER_CAMBIO_BLOQUEADO');
  });

  it('por medio: la captura de Plin busca solo vigentes de Plin (no reemplaza la de Yape)', async () => {
    await service.subirYProcesar(file, { pedidoId: '50', medio: 'PLIN' }, mozo);
    expect(prisma.voucherPago.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ reemplazado_en: null, medio: 'PLIN' }) }),
    );
  });

  it('por medio: compara la captura contra el renglón de su medio del plan', async () => {
    prisma.pedido.findUnique.mockResolvedValue(
      pedidoBase({
        total: 17,
        planPago: [
          { medio: 'EFECTIVO', monto: 0 },
          { medio: 'YAPE', monto: 10 },
          { medio: 'PLIN', monto: 7 },
        ],
      }),
    );
    await service.subirYProcesar(file, { pedidoId: '50', medio: 'PLIN' }, mozo);
    // La captura (S/17) no coincide con el renglón de Plin (S/7): el semáforo no puede dar CONFIABLE
    const data = prisma.voucherPago.create.mock.calls[0][0].data;
    expect(data.semaforo).not.toBe('CONFIABLE');
  });

  it('plan del mozo: se guarda antes de la captura y audita; bloqueado si el pago ya está aprobado', async () => {
    const plan = [
      { medio: 'EFECTIVO', monto: 7 },
      { medio: 'YAPE', monto: 10 },
    ];
    await service.guardarPlanMozo('50', plan, mozo, '1.2.3.4');
    expect(prisma.pedidoPagoPlan.deleteMany).toHaveBeenCalledWith({ where: { pedido_id: 50n } });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'GUARDAR_PLAN_PAGO' }));

    prisma.pedido.findUnique.mockResolvedValue(pedidoBase({ pago_estado: 'COORDINADO' }));
    const err = await service.guardarPlanMozo('50', plan, mozo).catch((e) => e);
    expect(err.getResponse().codigo).toBe('PLAN_BLOQUEADO');
  });

  it('plan del mozo: no toca pedidos ajenos', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedidoBase({ party_id: 99n }));
    await expect(service.guardarPlanMozo('50', [{ medio: 'YAPE', monto: 17 }], mozo)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('historial: el mozo solo ve sus pedidos y nunca semáforo ni archivo', async () => {
    prisma.voucherPago.findMany.mockResolvedValue([
      { id: 200n, archivo_id: 900n, subido_por: 10n, semaforo: 'CONFIABLE', medio: 'YAPE', creado_en: new Date(), reemplazado_en: null, motivo_cambio: 'motivo prueba' },
      { id: 100n, archivo_id: 800n, subido_por: 10n, semaforo: 'ILEGIBLE', medio: 'YAPE', creado_en: new Date(), reemplazado_en: new Date(), motivo_cambio: null },
    ]);
    const res = await service.historialPedido('50', mozo);
    expect(res.items[0]).toEqual(
      expect.objectContaining({ id: '200', estado: 'VIGENTE', subidoPor: 'Ana P.', legible: true, medio: 'YAPE', motivoCambio: 'motivo prueba' }),
    );
    expect(res.items[1]).toEqual(expect.objectContaining({ id: '100', estado: 'REEMPLAZADO', legible: false }));
    prisma.voucherPago.findMany.mockResolvedValue([
      { id: 300n, archivo_id: 700n, subido_por: 10n, semaforo: 'CONFIABLE', medio: 'PLIN', creado_en: new Date(), reemplazado_en: new Date(), retirado: true, motivo_cambio: null },
    ]);
    const quitados = await service.historialPedido('50', mozo);
    expect(quitados.items[0]).toEqual(expect.objectContaining({ id: '300', estado: 'RETIRADO' }));
    for (const it of res.items as any[]) {
      expect(it).not.toHaveProperty('semaforo');
      expect(it).not.toHaveProperty('archivoId');
    }
  });

  it('historial: el mozo no ve pedidos de otro', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedidoBase({ party_id: 99n }));
    await expect(service.historialPedido('50', mozo)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('historial: cajero ve semáforo y archivoId', async () => {
    prisma.voucherPago.findMany.mockResolvedValue([
      { id: 200n, archivo_id: 900n, subido_por: null, semaforo: 'OBSERVADO', medio: 'PLIN', creado_en: new Date(), reemplazado_en: null, motivo_cambio: null },
    ]);
    const res = await service.historialPedido('50', cajero);
    expect(res.items[0]).toEqual(expect.objectContaining({ semaforo: 'OBSERVADO', archivoId: '900', medio: 'PLIN' }));
  });
});
