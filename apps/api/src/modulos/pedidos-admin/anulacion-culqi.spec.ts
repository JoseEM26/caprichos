jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../caja/caja.calculo', () => ({
  ...jest.requireActual('../caja/caja.calculo'),
  registrarEgresoDevolucionCajaHoy: jest.fn(async (_tx: any, monto: number) => ({ id: 900n, monto })),
}));
import { Prisma } from '@prisma/client';
import { registrarEgresoDevolucionCajaHoy } from '../caja/caja.calculo';
import { DevolucionCulqiService } from '../pagos-online/devolucion-culqi.service';
import { PagosOnlineService } from '../pagos-online/pagos-online.service';
import { AnulacionPagadoService } from './anulacion-pagado.service';
import { RevertirAnulacionService } from './revertir-anulacion.service';
import { sumarDevolucionesDigitales } from '../cierre/cierre.util';

const admin: any = { partyId: 1n, rol: 'ADMIN' };
const cajero: any = { partyId: 2n, rol: 'CAJERO' };
const pedido: any = { id: 50n, codigo: 'CP-C050', pago_estado: 'PAGADO', total: new Prisma.Decimal(40), envio: new Prisma.Decimal(0) };
const dtoCulqi: any = { estado: 'ANULADO', destinoDinero: 'DEVOLVER', devolucionMedio: 'CULQI' };

function montar(opts: { cobro?: any } = {}) {
  const egreso = registrarEgresoDevolucionCajaHoy as jest.Mock;
  egreso.mockClear();
  const intento: any = { id: 1n, pedido_id: 50n, monto_centimos: 4000, devuelto_centimos: 0, estado: 'APROBADO', culqi_cargo_id: 'chr_1', devoluciones: [] };
  const filas: any[] = [];
  const notificaciones: any[] = [];
  const prisma: any = {
    cobro: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(opts.cobro ?? null) },
    caja: { findUnique: jest.fn().mockResolvedValue({ estado: 'ABIERTA' }) },
    notificacion: { create: jest.fn(async (a: any) => notificaciones.push(a.data)) },
    pagoOnlineIntento: {
      findFirst: jest.fn(async () => (['APROBADO', 'DEVUELTO'].includes(intento.estado) ? intento : null)),
      findUnique: jest.fn(async () => ({ ...intento, pedido: { codigo: 'CP-C050', estado: 'ANULADO' } })),
      findUniqueOrThrow: jest.fn(async () => ({ ...intento })),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (where.devuelto_centimos !== undefined && where.devuelto_centimos !== intento.devuelto_centimos) return { count: 0 };
        if (typeof data.devuelto_centimos === 'number') intento.devuelto_centimos = data.devuelto_centimos;
        else if (data.devuelto_centimos?.decrement) intento.devuelto_centimos -= data.devuelto_centimos.decrement;
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }: any) => Object.assign(intento, data)),
    },
    devolucionPedido: {
      findUnique: jest.fn(async () => filas[0] ?? null),
      create: jest.fn(async ({ data }: any) => {
        const f = { id: 70n, creado_en: new Date(), estado: 'HECHA', pedido: { codigo: 'CP-C050' }, error: null, culqi_devolucion_id: null, culqi_intento_id: null, movimiento_caja_id: null, ...data };
        filas.push(f);
        return f;
      }),
      update: jest.fn(async ({ data }: any) => Object.assign(filas[0], data)),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const pasarela: any = { devolver: jest.fn().mockResolvedValue({ devolucionId: 'ref_abcdef123456' }), consultarCargo: jest.fn().mockResolvedValue(null) };
  const nucleo = new DevolucionCulqiService(prisma, pasarela);
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  const cobros: any = { anularCobro: jest.fn().mockResolvedValue({}), anularCobroCajaCerrada: jest.fn().mockResolvedValue({}) };
  const service = new AnulacionPagadoService(prisma, auditoria, cobros, undefined, undefined, nucleo);
  return { prisma, intento, filas, notificaciones, pasarela, nucleo, auditoria, cobros, service, egreso };
}
const cobroTarjeta = () => ({ id: 5n, caja: { estado: 'ABIERTA' }, pagos: [{ medio: 'TARJETA', monto: new Prisma.Decimal(40), propina: new Prisma.Decimal(0) }] });

describe('Anular un pedido pagado con Culqi: devolver por Culqi', () => {
  it('ADMIN: anula el cobro, deja la devolución CULQI y, ya anulado el pedido, pide el reembolso total a Culqi', async () => {
    const { service, filas, pasarela, intento, cobros } = montar({ cobro: cobroTarjeta() });
    expect(await service.resolver(pedido, dtoCulqi, 'Cliente no recibió', admin)).toBe('DEVUELTO');
    expect(cobros.anularCobro).toHaveBeenCalledTimes(1);
    expect(filas[0]).toMatchObject({ medio: 'CULQI', estado: 'PENDIENTE', culqi_intento_id: 1n, codigo_operacion: null });
    expect(pasarela.devolver).not.toHaveBeenCalled(); // el reembolso va DESPUÉS de anular el pedido
    await service.ejecutarCulqiAlAnular(50n, admin);
    expect(pasarela.devolver).toHaveBeenCalledWith({ cargoId: 'chr_1', montoCentimos: 4000, motivo: 'Cliente no recibió' });
    expect(filas[0]).toMatchObject({ estado: 'HECHA', culqi_devolucion_id: 'ref_abcdef123456', error: null });
    expect(intento).toMatchObject({ estado: 'DEVUELTO', devuelto_centimos: 4000 });
    expect(intento.devoluciones[0]).toMatchObject({ id: 'ref_abcdef123456', medio: 'CULQI', ref: 'dp:70' });
  });

  it('CAJERO: la devolución queda pendiente de aprobación, avisa al admin y no llama a Culqi; solo el admin la ejecuta', async () => {
    const { service, filas, pasarela, notificaciones } = montar({ cobro: cobroTarjeta() });
    await service.resolver(pedido, dtoCulqi, 'Cliente no recibió', cajero);
    expect(filas[0].estado).toBe('PENDIENTE_APROBACION');
    expect(notificaciones[0]).toMatchObject({ tipo: 'CULQI_DEVOLUCION_PENDIENTE', rol_destino: 'ADMIN' });
    await service.ejecutarCulqiAlAnular(50n, cajero);
    expect(pasarela.devolver).not.toHaveBeenCalled();
    await expect(service.ejecutarCulqi(50n, cajero)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
    await service.ejecutarCulqi(50n, admin);
    expect(pasarela.devolver).toHaveBeenCalledTimes(1);
    expect(filas[0]).toMatchObject({ estado: 'HECHA', autorizado_por_party_id: 1n });
  });

  it('si Culqi falla el pedido sigue anulado: PENDIENTE (aviso al admin), FALLIDA al fallar el reintento y HECHA al lograrse, sin devolver dos veces', async () => {
    const { service, filas, pasarela, notificaciones, intento } = montar({ cobro: cobroTarjeta() });
    pasarela.devolver.mockRejectedValue(new Error('Culqi caído'));
    await service.resolver(pedido, dtoCulqi, 'Cliente no recibió', admin);
    await service.ejecutarCulqiAlAnular(50n, admin);
    expect(filas[0]).toMatchObject({ estado: 'PENDIENTE', error: 'Culqi caído' });
    expect(notificaciones.some((n) => n.tipo === 'CULQI_DEVOLUCION_FALLIDA')).toBe(true);
    expect(intento.devuelto_centimos).toBe(0); // la reserva se liberó
    expect(await service.ejecutarCulqi(50n, admin)).toMatchObject({ estado: 'FALLIDA' });
    pasarela.devolver.mockResolvedValue({ devolucionId: 'ref_ok999999' });
    expect(await service.ejecutarCulqi(50n, admin)).toMatchObject({ estado: 'HECHA', culqiDevolucionId: 'ref_ok999999' });
    expect(intento.devuelto_centimos).toBe(4000);
  });

  it('idempotente: reintentar lo ya hecho no vuelve a llamar a Culqi, y la misma clave tampoco', async () => {
    const { service, pasarela, nucleo } = montar({ cobro: cobroTarjeta() });
    await service.resolver(pedido, dtoCulqi, 'Cliente no recibió', admin);
    await service.ejecutarCulqi(50n, admin);
    expect(await service.ejecutarCulqi(50n, admin)).toMatchObject({ yaHecha: true });
    const otra = await nucleo.reembolsar({ intentoId: 1n, montoCentimos: 4000, motivo: 'x', ref: 'dp:70' });
    expect(otra.repetido).toBe(true);
    expect(pasarela.devolver).toHaveBeenCalledTimes(1);
  });

  it('reintento tras fallo sin respuesta: si Culqi ya lo había devuelto, se registra sin pedirlo otra vez', async () => {
    const { service, filas, pasarela } = montar({ cobro: cobroTarjeta() });
    pasarela.devolver.mockRejectedValue(new Error('tiempo agotado'));
    await service.resolver(pedido, dtoCulqi, 'Cliente no recibió', admin);
    await service.ejecutarCulqi(50n, admin);
    pasarela.consultarCargo.mockResolvedValue({ devueltoCentimos: 4000 });
    pasarela.devolver.mockClear();
    expect(await service.ejecutarCulqi(50n, admin)).toMatchObject({ estado: 'HECHA' });
    expect(pasarela.devolver).not.toHaveBeenCalled();
    expect(filas[0].estado).toBe('HECHA');
  });

  it('sin pago Culqi aprobado no se ofrece: 409 SIN_PAGO_CULQI', async () => {
    const { service, intento } = montar({ cobro: cobroTarjeta() });
    intento.estado = 'RECHAZADO';
    await expect(service.resolver(pedido, dtoCulqi, 'Cliente no recibió', admin)).rejects.toMatchObject({ response: { codigo: 'SIN_PAGO_CULQI' } });
  });
});

describe('Pedido pagado con Culqi pero devuelto por otro medio (no se llama a Culqi)', () => {
  it('efectivo: egreso en la caja de hoy por todo el monto (el cobro era digital), devolución EFECTIVO y anotada en el intento; el cierre digital no la resta', async () => {
    const { service, filas, pasarela, egreso, intento } = montar({ cobro: cobroTarjeta() });
    await service.resolver(pedido, { estado: 'ANULADO', destinoDinero: 'DEVOLVER', devolucionMedio: 'EFECTIVO', devolucionMonto: 40 } as any, 'Cliente no recibió', cajero);
    expect(pasarela.devolver).not.toHaveBeenCalled();
    expect(egreso).toHaveBeenCalledWith(expect.anything(), 40, expect.stringContaining('CP-C050'));
    expect(filas[0]).toMatchObject({ medio: 'EFECTIVO', estado: 'HECHA', movimiento_caja_id: 900n });
    expect(intento.devuelto_centimos).toBe(4000);
    expect(intento.devoluciones[0]).toMatchObject({ medio: 'EFECTIVO', monto_centimos: 4000, movimiento_caja_id: '900' });
    // Cierre: lo de efectivo sale como egreso, no se resta de los medios digitales (sin doble resta)
    const dig = sumarDevolucionesDigitales([{ medio: 'EFECTIVO', monto_devuelto: 40, creado_en: new Date() }], new Date(0), new Date(Date.now() + 1000));
    expect(dig).toEqual({ yape: 0, plin: 0, transferencia: 0, tarjeta: 0 });
  });

  it('Yape: pide el código de operación, sin egreso ni llamada a Culqi; queda en devolucion_pedido y en el intento', async () => {
    const { service, filas, pasarela, egreso, intento } = montar({ cobro: cobroTarjeta() });
    await expect(service.resolver(pedido, { destinoDinero: 'DEVOLVER', devolucionMedio: 'YAPE', devolucionMonto: 40 } as any, 'Cliente no recibió', cajero)).rejects.toMatchObject({
      response: { codigo: 'CODIGO_OPERACION_REQUERIDO' },
    });
    await service.resolver(pedido, { destinoDinero: 'DEVOLVER', devolucionMedio: 'YAPE', devolucionMonto: 40, devolucionCodigo: 'OP-77' } as any, 'Cliente no recibió', cajero);
    expect(pasarela.devolver).not.toHaveBeenCalled();
    expect(egreso).not.toHaveBeenCalled();
    expect(filas[0]).toMatchObject({ medio: 'YAPE', codigo_operacion: 'OP-77', estado: 'HECHA' });
    expect(intento.devoluciones[0]).toMatchObject({ medio: 'YAPE' });
  });
});

describe('Camino de Pagos en línea (/devolver) y revertir', () => {
  it('escribe devolucion_pedido una sola vez y no duplica si ya existe; si la de Culqi estaba pendiente la marca HECHA', async () => {
    const { prisma, pasarela, nucleo, filas } = montar();
    const auditoria: any = { registrar: jest.fn() };
    const pagos = new PagosOnlineService(prisma, auditoria, { anularCobro: jest.fn() } as any, pasarela, undefined, nucleo);
    await pagos.devolver('1', { monto: 10, motivo: 'Devolución parcial', confirmar: true }, admin);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ medio: 'CULQI', estado: 'HECHA', culqi_intento_id: 1n });
    await pagos.devolver('1', { monto: 10, motivo: 'Otra parcial', confirmar: true }, admin);
    expect(filas).toHaveLength(1);
    expect(prisma.devolucionPedido.create).toHaveBeenCalledTimes(1);
    // una de la anulación que quedó pendiente se resuelve con este camino
    filas[0].estado = 'PENDIENTE';
    await pagos.devolver('1', { monto: 10, motivo: 'Tercera parcial', confirmar: true }, admin);
    expect(filas).toHaveLength(1);
    expect(filas[0].estado).toBe('HECHA');
  });

  it('no se revierte la anulación de un pedido con devolución por Culqi (hecha o sin completar)', async () => {
    for (const estado of ['HECHA', 'PENDIENTE']) {
      const prisma: any = {
        pedido: { findUnique: jest.fn().mockResolvedValue({ id: 50n, estado: 'ANULADO' }), count: jest.fn().mockResolvedValue(0) },
        devolucionPedido: { findUnique: jest.fn().mockResolvedValue({ medio: 'CULQI', estado }) },
      };
      const s = new RevertirAnulacionService(prisma, { registrar: jest.fn() } as any);
      await expect(s.revertir('50', 'Fue un error', admin)).rejects.toMatchObject({ response: { codigo: 'DEVOLUCION_CULQI_REGISTRADA' } });
    }
  });
});
