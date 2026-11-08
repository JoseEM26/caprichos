jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn() } }));
import { ConflictException } from '@nestjs/common';
import 'reflect-metadata';
import { CreditosService } from './creditos.service';
import { CreditosController } from './creditos.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';

const admin = { partyId: '1', rol: 'ADMIN' } as any;
const hoy = new Date('2026-11-08T00:00:00Z');

describe('Créditos: check «Cobrado», marcar a mano y quién cobró', () => {
  let prisma: any;
  let auditoria: any;
  let service: CreditosService;

  const consumo = (id: number, extra: any = {}) => ({
    id: BigInt(id), party_id: 5n, pedido_id: BigInt(100 + id), fecha: hoy, monto: 21,
    pagado_en: null, pagado_por: null, pago_modo: null, pago_medio: null, pago_motivo: null, movimiento_caja_id: null,
    pedido: { codigo: `P-${id}`, lineas: [], descuento: 7, descuento_detalle: [] },
    ...extra,
  });

  beforeEach(() => {
    prisma = {
      consumoPersonal: { findMany: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
      person: { findMany: jest.fn().mockResolvedValue([{ party_id: 8n, nombres: 'Luis', apellidos: 'Mozo' }]) },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new CreditosService(prisma, auditoria);
  });

  it('la cuenta muestra Cobrado con quién cobró y medio; el pendiente excluye lo cobrado', async () => {
    prisma.consumoPersonal.findMany.mockResolvedValue([
      consumo(1, { pagado_en: new Date(), pagado_por: 8n, pago_modo: 'CAJA', pago_medio: 'EFECTIVO' }),
      consumo(2),
    ]);
    const r = await service.obtenerCuenta('5', new Date('2026-11-08T15:00:00Z'));
    expect(r.debeTotal).toBe(21);
    const cobrado = r.consumos.find((c: any) => c.pedidoCodigo === 'P-1')!;
    expect(cobrado).toMatchObject({ estadoPago: 'PAGADO', pagoMedio: 'EFECTIVO', cobradoPor: 'Luis Mozo' });
    expect(r.consumos.find((c: any) => c.pedidoCodigo === 'P-2')).toMatchObject({ estadoPago: 'PENDIENTE', cobradoPor: null });
  });

  it('marcar a mano: queda cobrado (PLANILLA, sin caja) y auditado', async () => {
    prisma.consumoPersonal.findUnique.mockResolvedValue(consumo(1));
    await service.marcarCobrado({ consumoId: 1, cobrado: true }, admin);
    expect(prisma.consumoPersonal.updateMany.mock.calls[0][0].data).toMatchObject({ pagado_por: 1n, pago_modo: 'PLANILLA' });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'MARCAR_COBRADO' }));
  });

  it('marcar uno ya cobrado: 409', async () => {
    prisma.consumoPersonal.findUnique.mockResolvedValue(consumo(1, { pagado_en: new Date() }));
    await expect(service.marcarCobrado({ consumoId: 1, cobrado: true }, admin)).rejects.toBeInstanceOf(ConflictException);
  });

  it('desmarcar: vuelve a Pendiente y se audita; si entró a caja en efectivo, 409', async () => {
    prisma.consumoPersonal.findUnique.mockResolvedValue(consumo(1, { pagado_en: new Date(), pago_modo: 'PLANILLA' }));
    await service.marcarCobrado({ consumoId: 1, cobrado: false }, admin);
    expect(prisma.consumoPersonal.update.mock.calls[0][0].data).toMatchObject({ pagado_en: null, pagado_por: null });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'DESMARCAR_COBRADO' }));
    prisma.consumoPersonal.findUnique.mockResolvedValue(consumo(2, { pagado_en: new Date(), movimiento_caja_id: 77n }));
    await expect(service.marcarCobrado({ consumoId: 2, cobrado: false }, admin)).rejects.toMatchObject({ response: { codigo: 'COBRO_EN_CAJA' } });
  });

  it('saldar, planilla y marcar-cobrado son solo de quien tiene creditos/saldar (ADMIN); ver sigue en creditos/ver', () => {
    const permiso = (m: string) => Reflect.getMetadata(CLAVE_PERMISO, (CreditosController.prototype as any)[m]);
    for (const m of ['saldar', 'planilla', 'marcarCobrado']) expect(permiso(m)).toEqual({ modulo: 'creditos', accion: 'saldar' });
    expect(permiso('cuenta')).toEqual({ modulo: 'creditos', accion: 'ver' });
  });
});
