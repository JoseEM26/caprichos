jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ConflictException, BadRequestException } from '@nestjs/common';
import { CreditosService } from './creditos.service';
import { fechaDiaLima, fechaLima } from './descuento-personal';

const admin = { partyId: '1', rol: 'ADMIN' } as any;
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('Cuenta semanal y mensual del personal (hora de Lima)', () => {
  let prisma: any;
  let tx: any;
  let auditoria: any;
  let impresion: any;
  let service: CreditosService;

  const consumo = (id: number, fecha: string, monto: number, pagado = false, party = 5) => ({
    id: BigInt(id),
    party_id: BigInt(party),
    pedido_id: BigInt(100 + id),
    fecha: d(fecha),
    monto,
    pagado_en: pagado ? new Date() : null,
    pago_modo: pagado ? 'CAJA' : null,
    pedido: { codigo: `P-${id}`, lineas: [], descuento: 5, descuento_detalle: [] },
  });

  beforeEach(() => {
    tx = {
      caja: { findFirst: jest.fn().mockResolvedValue({ id: 3n }) },
      movimientoCaja: { create: jest.fn().mockResolvedValue({ id: 77n }) },
      consumoPersonal: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    prisma = {
      consumoPersonal: { findMany: jest.fn(), updateMany: jest.fn() },
      person: { findUnique: jest.fn().mockResolvedValue({ nombres: 'Rosa', apellidos: 'Pérez' }) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    impresion = { reimprimirEtiqueta: jest.fn().mockResolvedValue({ ok: true }), encolarTicketPedido: jest.fn() };
    service = new CreditosService(prisma, auditoria, undefined, impresion);
  });

  it('la fecha del consumo es el día de Lima aunque en UTC ya sea mañana', () => {
    // 22:30 del domingo 8/11 en Lima = lunes 9/11 03:30 UTC
    const ahora = new Date('2026-11-09T03:30:00Z');
    expect(fechaLima(ahora)).toEqual({ y: 2026, m: 10, d: 8 });
    expect(fechaDiaLima(ahora).toISOString()).toBe('2026-11-08T00:00:00.000Z');
  });

  it('la semana va de lunes a domingo y cruza de mes: domingo noche en Lima sigue en la semana vieja', () => {
    const r = service.calcularRangoSemana(0, new Date('2026-11-09T03:30:00Z'));
    expect(r.inicio.toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(r.fin.toISOString()).toBe('2026-11-08T00:00:00.000Z');
    const cruce = service.calcularRangoSemana(0, new Date('2026-12-02T15:00:00Z'));
    expect(cruce.inicio.toISOString()).toBe('2026-11-30T00:00:00.000Z');
    expect(cruce.fin.toISOString()).toBe('2026-12-06T00:00:00.000Z');
    expect(service.calcularRangoMes(0, new Date('2026-12-02T15:00:00Z')).inicio.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('totales de «debe» por semana y por mes: solo cuenta lo pendiente', async () => {
    // hoy = miércoles 2/12/2026 (Lima). Semana 30/11–6/12; mes diciembre.
    prisma.consumoPersonal.findMany.mockResolvedValue([
      consumo(1, '2026-12-02', 10), // semana y mes, pendiente
      consumo(2, '2026-11-30', 20), // semana (lunes, mes anterior), pendiente
      consumo(3, '2026-12-01', 5, true), // semana y mes, ya pagado
      consumo(4, '2026-11-10', 8), // mes anterior pendiente: solo en debeTotal
    ]);
    const c = await service.obtenerCuenta(5, new Date('2026-12-02T15:00:00Z'));
    expect(c.semana).toMatchObject({ total: 35, debe: 30 });
    expect(c.mes).toMatchObject({ total: 15, debe: 10 });
    expect(c.debeTotal).toBe(38);
    expect(c.resumen).toBe('Debe esta semana: S/ 30.00 · Este mes: S/ 10.00');
    expect(c.consumos.map((x) => x.estadoPago)).toEqual(['PENDIENTE', 'PENDIENTE', 'PAGADO', 'PENDIENTE']);
  });

  it('saldar en efectivo crea UN ingreso de caja por el total, marca pagados, audita y reimprime el ticket', async () => {
    prisma.consumoPersonal.findMany.mockResolvedValue([consumo(1, '2026-12-02', 10), consumo(2, '2026-12-01', 20)]);
    const r = await service.saldar({ consumoIds: ['1', '2'], medio: 'efectivo' }, admin, '1.1.1.1');
    expect(r).toMatchObject({ ok: true, total: 30, cantidad: 2, movimientoCajaId: '77' });
    expect(tx.movimientoCaja.create).toHaveBeenCalledTimes(1);
    expect(tx.movimientoCaja.create.mock.calls[0][0].data).toMatchObject({ caja_id: 3n, tipo: 'INGRESO', monto: 30 });
    expect(tx.movimientoCaja.create.mock.calls[0][0].data.motivo).toContain('Pago de crédito del personal');
    const marca = tx.consumoPersonal.updateMany.mock.calls[0][0];
    expect(marca.where.pagado_en).toBeNull();
    expect(marca.data).toMatchObject({ pago_modo: 'CAJA', pago_medio: 'EFECTIVO', pagado_por: 1n });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'SALDAR_CONSUMOS', modulo: 'creditos' }));
    expect(impresion.reimprimirEtiqueta).toHaveBeenCalledTimes(2);
  });

  it('saldar con medio digital no mueve el efectivo de la caja', async () => {
    prisma.consumoPersonal.findMany.mockResolvedValue([consumo(1, '2026-12-02', 10)]);
    tx.consumoPersonal.updateMany.mockResolvedValue({ count: 1 });
    await service.saldar({ consumoIds: ['1'], medio: 'YAPE' }, admin);
    expect(tx.movimientoCaja.create).not.toHaveBeenCalled();
  });

  it('saldar un consumo ya pagado responde 409 y no toca nada (sin doble cobro)', async () => {
    prisma.consumoPersonal.findMany.mockResolvedValue([consumo(1, '2026-12-02', 10, true)]);
    await expect(service.saldar({ consumoIds: ['1'], medio: 'EFECTIVO' }, admin)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('si otro lo pagó entre medio la transacción falla (409) y no queda ingreso suelto', async () => {
    prisma.consumoPersonal.findMany.mockResolvedValue([consumo(1, '2026-12-02', 10), consumo(2, '2026-12-01', 20)]);
    tx.consumoPersonal.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.saldar({ consumoIds: ['1', '2'], medio: 'EFECTIVO' }, admin)).rejects.toMatchObject({ response: { codigo: 'YA_PAGADO' } });
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('saldar en efectivo sin caja abierta pide abrirla', async () => {
    prisma.consumoPersonal.findMany.mockResolvedValue([consumo(1, '2026-12-02', 10)]);
    tx.caja.findFirst.mockResolvedValue(null);
    await expect(service.saldar({ consumoIds: ['1'], medio: 'EFECTIVO' }, admin)).rejects.toMatchObject({ response: { codigo: 'CAJA_CERRADA' } });
  });

  it('saldar por pedido (pagar ahora al crear el pedido) resuelve su consumo', async () => {
    prisma.consumoPersonal.findMany
      .mockResolvedValueOnce([{ id: 1n }])
      .mockResolvedValueOnce([consumo(1, '2026-12-02', 10)]);
    tx.consumoPersonal.updateMany.mockResolvedValue({ count: 1 });
    const r = await service.saldar({ pedidoIds: ['101'], medio: 'EFECTIVO' }, admin);
    expect(r.total).toBe(10);
  });

  it('no mezcla trabajadores en un mismo pago', async () => {
    prisma.consumoPersonal.findMany.mockResolvedValue([consumo(1, '2026-12-02', 10, false, 5), consumo(2, '2026-12-02', 10, false, 6)]);
    await expect(service.saldar({ consumoIds: ['1', '2'], medio: 'EFECTIVO' }, admin)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('planilla: marca el periodo como pagado SIN mover caja y exige motivo', async () => {
    await expect(service.marcarPeriodoPlanilla({ desde: '2026-11-30', hasta: '2026-12-06', motivo: ' ' }, admin)).rejects.toBeInstanceOf(BadRequestException);
    prisma.consumoPersonal.findMany.mockResolvedValue([{ id: 1n, monto: 10 }, { id: 2n, monto: 20 }]);
    prisma.consumoPersonal.updateMany.mockResolvedValue({ count: 2 });
    const r = await service.marcarPeriodoPlanilla({ desde: '2026-11-30', hasta: '2026-12-06', motivo: 'Planilla semana 49' }, admin);
    expect(r).toMatchObject({ ok: true, cantidad: 2, total: 30 });
    expect(prisma.consumoPersonal.updateMany.mock.calls[0][0].data).toMatchObject({ pago_modo: 'PLANILLA', pago_motivo: 'Planilla semana 49' });
    expect(tx.movimientoCaja.create).not.toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'MARCAR_PLANILLA', motivo: 'Planilla semana 49' }));
  });

  it('planilla sin nada pendiente responde 409', async () => {
    prisma.consumoPersonal.findMany.mockResolvedValue([]);
    await expect(service.marcarPeriodoPlanilla({ desde: '2026-11-30', hasta: '2026-12-06', motivo: 'Planilla' }, admin)).rejects.toMatchObject({ response: { codigo: 'NADA_PENDIENTE' } });
  });
});
