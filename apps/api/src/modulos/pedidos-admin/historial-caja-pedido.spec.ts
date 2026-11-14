import 'reflect-metadata';
jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn() } }));
import { NotFoundException } from '@nestjs/common';
import { HistorialCajaPedidoService } from './historial-caja-pedido.service';
import { enmascarar } from './historial-caja-pedido.util';
import { PedidosAdminController } from './pedidos-admin.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { MATRIZ } from '../acceso/permisos';

const d = (s: string) => new Date(s);

function armar() {
  const prisma: any = {
    pedido: { findUnique: jest.fn().mockResolvedValue({ id: 5n }) },
    pedidoEstadoHistorial: { findMany: jest.fn().mockResolvedValue([
      { id: 1n, estado_anterior: 'LISTO', estado_nuevo: 'ENTREGADO', motivo: null, por_party_id: 10n, en: d('2026-11-13T15:00:00Z') },
    ]) },
    cobro: { findMany: jest.fn().mockResolvedValue([
      { id: 7n, total: '25', cobrado_por: 11n, en: d('2026-11-13T14:00:00Z'), anulado_en: null, anulado_por: null, motivo_anulacion: null, pagos: [{ medio: 'YAPE', monto: '25' }] },
    ]) },
    comprobante: { findMany: jest.fn().mockResolvedValue([{ id: 3n }]) },
    voucherPago: { findMany: jest.fn().mockResolvedValue([]) },
    cortesia: { findMany: jest.fn().mockResolvedValue([]) },
    auditoria: { findMany: jest.fn().mockResolvedValue([
      { id: 9n, accion: 'CAMBIAR_COMPROBANTE', entidad: 'comprobante', motivo: 'Pidió factura', party_id: 12n, en: d('2026-11-13T14:30:00Z'), antes: { tipo: 'BOLETA' }, despues: { tipo: 'FACTURA', password: 'x', ruc: '20123456789' } },
      { id: 10n, accion: 'REGISTRAR_PAGO', entidad: 'pedido', motivo: null, party_id: 11n, en: d('2026-11-13T14:00:01Z'), antes: null, despues: null },
      { id: 11n, accion: 'VER_PDF_ELECTRONICO', entidad: 'comprobante', motivo: null, party_id: 11n, en: d('2026-11-13T14:40:00Z'), antes: null, despues: null },
    ]) },
    person: { findMany: jest.fn().mockResolvedValue([
      { party_id: 10n, nombres: 'Ana', apellidos: 'Ruiz' }, { party_id: 11n, nombres: 'Luis', apellidos: null }, { party_id: 12n, nombres: 'Eva', apellidos: 'Paz' },
    ]) },
  };
  return { prisma, svc: new HistorialCajaPedidoService(prisma) };
}

describe('HistorialCajaPedidoService', () => {
  it('mezcla fuentes en orden, con nombres, sin duplicar cobro ni lecturas, y enmascara', async () => {
    const { svc, prisma } = armar();
    const r = await svc.obtener('5');
    expect(r.eventos.map((e) => e.titulo)).toEqual([
      'Cobró S/ 25.00 con Yape', 'Cambió el comprobante a factura', 'Cambió el estado a entregado',
    ]);
    expect(r.eventos.map((e) => e.por)).toEqual(['Luis', 'Eva Paz', 'Ana Ruiz']);
    expect(r.eventos[1].motivo).toBe('Pidió factura');
    expect(JSON.stringify(r)).not.toContain('"x"');
    expect((r.eventos[1].despues as any).ruc).toBe('•••••••••77'.replace('77', '89'));
    expect(prisma.auditoria.findMany.mock.calls[0][0].where.OR[1]).toEqual({ entidad: 'comprobante', entidad_id: { in: [3n] } });
  });

  it('pedido inexistente: 404', async () => {
    const { svc, prisma } = armar();
    prisma.pedido.findUnique.mockResolvedValue(null);
    await expect(svc.obtener('5')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.obtener('abc')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cobro anulado genera un segundo evento con motivo', async () => {
    const { svc, prisma } = armar();
    prisma.cobro.findMany.mockResolvedValue([{ id: 7n, total: '25', cobrado_por: 11n, en: d('2026-11-13T14:00:00Z'), anulado_en: d('2026-11-13T16:00:00Z'), anulado_por: 10n, motivo_anulacion: 'Error', pagos: [] }]);
    const r = await svc.obtener('5');
    const ult = r.eventos[r.eventos.length - 1];
    expect(ult.titulo).toBe('Anuló el cobro de S/ 25.00');
    expect(ult.motivo).toBe('Error');
  });
});

describe('enmascarar', () => {
  it('oculta claves y tokens y deja 2 caracteres del documento', () => {
    expect(enmascarar({ token_acceso: 'abc', clave: 'z', dni: '12345678', n: { Password: 'q' } })).toEqual({ token_acceso: '••••', clave: '••••', dni: '••••••78', n: { Password: '••••' } });
  });
});

describe('Acceso al historial de Caja', () => {
  it('la ruta exige caja/auditoria_pedido, que solo tienen ADMIN y SUPERVISOR', () => {
    const meta = Reflect.getMetadata(CLAVE_PERMISO, PedidosAdminController.prototype.historialCaja);
    expect(meta).toEqual({ modulo: 'caja', accion: 'auditoria_pedido' });
    const con = Object.keys(MATRIZ).filter((rol) => MATRIZ[rol].includes('caja/auditoria_pedido')).sort();
    expect(con).toEqual(['ADMIN', 'SUPERVISOR']);
  });
});
