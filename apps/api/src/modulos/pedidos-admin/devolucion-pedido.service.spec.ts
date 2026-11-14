jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Prisma } from '@prisma/client';
import { DevolucionPedidoService } from './devolucion-pedido.service';

/** Código de error de Nest (el cuerpo va en getResponse). */
const codigoDe = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (e: any) {
    return String(e.getResponse().codigo);
  }
  return '';
};

describe('DevolucionPedidoService', () => {
  const usuario = { partyId: '9', rol: 'CAJERO' } as any;

  const pedidoBase = {
    id: 7n,
    codigo: 'CP-7',
    estado: 'ANULADO',
    pago_estado: 'PAGADO',
    total: 50,
    envio: 5,
    pago_metodo: 'YAPE',
    devolucion: null,
    comprobante: [] as any[],
  };

  const construir = (
    sobrescribe: Partial<typeof pedidoBase> = {},
    opciones: { cajaAbierta?: boolean; baja?: () => Promise<any>; cuentaCancelado?: number; createFalla?: unknown } = {},
  ) => {
    const cajaAbierta = opciones.cajaAbierta ?? true;
    const cajaFila = cajaAbierta ? { id: 1n, estado: 'ABIERTA' } : null;
    const tx = {
      $queryRaw: jest.fn(),
      caja: { findUnique: jest.fn().mockResolvedValue(cajaFila) },
      movimientoCaja: { create: jest.fn().mockResolvedValue({ id: 99n }) },
      devolucionPedido: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          if (opciones.createFalla) throw opciones.createFalla;
          return { id: 5n, creado_en: new Date('2026-11-04T15:00:00Z'), ...data };
        }),
      },
    };
    const prisma = {
      pedido: {
        findUnique: jest.fn().mockResolvedValue({ ...pedidoBase, ...sobrescribe }),
        count: jest.fn().mockResolvedValue(opciones.cuentaCancelado ?? 1),
      },
      caja: { findUnique: jest.fn().mockResolvedValue(cajaFila) },
      comprobante: { findUnique: jest.fn().mockResolvedValue({ baja_estado: null }) },
      party: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    const auditoria = { registrar: jest.fn() };
    const comprobantes = {
      anularElectronico: jest.fn().mockImplementation(opciones.baja ?? (async () => ({ baja_estado: 'ACEPTADA' }))),
    };
    const servicio = new DevolucionPedidoService(prisma as any, auditoria as any, comprobantes as any);
    return { servicio, prisma, tx, auditoria, comprobantes };
  };

  describe('sugerencia', () => {
    it('sugiere lo pagado menos el envío y muestra el medio original', async () => {
      const { servicio } = construir();
      const s = await servicio.sugerencia('7');
      expect(s).toMatchObject({ montoPagado: 50, montoEnvio: 5, montoSugerido: 45, medioOriginal: 'YAPE', comprobante: null });
    });

    it('rechaza un pedido que no está pagado', async () => {
      const { servicio } = construir({ pago_estado: 'PENDIENTE' });
      expect(await codigoDe(servicio.sugerencia('7'))).toBe('PEDIDO_SIN_PAGO');
    });

    it('rechaza un pedido que no fue cancelado por no recibir', async () => {
      const { servicio } = construir({}, { cuentaCancelado: 0 });
      expect(await codigoDe(servicio.sugerencia('7'))).toBe('PEDIDO_NO_DEVOLVIBLE');
    });
  });

  describe('registrar: validaciones', () => {
    it('rechaza un monto mayor a lo pagado', async () => {
      const { servicio } = construir();
      expect(await codigoDe(servicio.registrar('7', { montoDevuelto: 60, medio: 'EFECTIVO' }, usuario, 1n))).toBe('MONTO_SUPERA_PAGADO');
    });

    it('rechaza más de dos decimales', async () => {
      const { servicio } = construir();
      expect(await codigoDe(servicio.registrar('7', { montoDevuelto: 45.555, medio: 'EFECTIVO' }, usuario, 1n))).toBe('MONTO_INVALIDO');
    });

    it('rechaza un medio digital sin código de operación', async () => {
      const { servicio } = construir();
      expect(await codigoDe(servicio.registrar('7', { montoDevuelto: 45, medio: 'YAPE' }, usuario, 1n))).toBe('CODIGO_OPERACION_REQUERIDO');
    });

    it('pide motivo cuando el monto difiere del sugerido', async () => {
      const { servicio } = construir();
      expect(await codigoDe(servicio.registrar('7', { montoDevuelto: 40, medio: 'EFECTIVO' }, usuario, 1n))).toBe('MOTIVO_REQUERIDO');
      expect(await codigoDe(servicio.registrar('7', { montoDevuelto: 40, medio: 'EFECTIVO', motivo: 'corto' }, usuario, 1n))).toBe('MOTIVO_REQUERIDO');
    });

    it('no pide motivo si el monto es el sugerido', async () => {
      const { servicio, tx } = construir();
      await servicio.registrar('7', { montoDevuelto: 45, medio: 'EFECTIVO' }, usuario, 1n);
      expect(tx.devolucionPedido.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ monto_devuelto: 45, motivo: null }) }),
      );
    });

    it('acepta otro monto con motivo de al menos 10 caracteres', async () => {
      const { servicio, tx } = construir();
      await servicio.registrar(
        '7',
        { montoDevuelto: 30, medio: 'YAPE', codigoOperacion: ' 123456 ', motivo: 'Volvió a pedir, solo se cobró delivery' },
        usuario,
        1n,
      );
      expect(tx.devolucionPedido.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ monto_devuelto: 30, codigo_operacion: '123456', movimiento_caja_id: null }),
        }),
      );
    });
  });

  describe('registrar: efectos', () => {
    it('en efectivo registra un egreso en la caja de hoy con el motivo del código', async () => {
      const { servicio, tx } = construir();
      await servicio.registrar('7', { montoDevuelto: 45, medio: 'EFECTIVO' }, usuario, 1n);
      expect(tx.movimientoCaja.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ caja_id: 1n, tipo: 'EGRESO', motivo: 'Devolución CP-7' }) }),
      );
      expect(tx.devolucionPedido.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ movimiento_caja_id: 99n, codigo_operacion: null }) }),
      );
    });

    it('en efectivo sin caja abierta de hoy responde con un error claro y no registra nada', async () => {
      const { servicio, tx, comprobantes } = construir({}, { cajaAbierta: false });
      const error = await servicio.registrar('7', { montoDevuelto: 45, medio: 'EFECTIVO' }, usuario, 1n).catch((e) => e);
      expect(error.getResponse()).toMatchObject({ codigo: 'CAJA_CERRADA', mensaje: 'Abre la caja para devolver en efectivo' });
      expect(tx.devolucionPedido.create).not.toHaveBeenCalled();
      expect(comprobantes.anularElectronico).not.toHaveBeenCalled();
    });

    it('en digital no toca la caja', async () => {
      const { servicio, tx } = construir({}, { cajaAbierta: false });
      await servicio.registrar('7', { montoDevuelto: 45, medio: 'PLIN', codigoOperacion: 'PL-1' }, usuario, 1n);
      expect(tx.movimientoCaja.create).not.toHaveBeenCalled();
    });

    it('no permite dos devoluciones del mismo pedido (ya registrada o carrera en la base)', async () => {
      const { servicio } = construir({ devolucion: { id: 1n } as any });
      expect(await codigoDe(servicio.registrar('7', { montoDevuelto: 45, medio: 'EFECTIVO' }, usuario, 1n))).toBe('DEVOLUCION_YA_REGISTRADA');

      const carrera = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '6.0.0' });
      const { servicio: s2 } = construir({}, { createFalla: carrera });
      expect(await codigoDe(s2.registrar('7', { montoDevuelto: 45, medio: 'YAPE', codigoOperacion: 'X1' }, usuario, 1n))).toBe(
        'DEVOLUCION_YA_REGISTRADA',
      );
    });

    it('da de baja el comprobante vigente y guarda su estado', async () => {
      const { servicio, tx, comprobantes } = construir({ comprobante: [{ id: 33n, tipo: 'BOLETA', numero_texto: 'B002-1', baja_estado: null }] });
      const r = await servicio.registrar('7', { montoDevuelto: 45, medio: 'EFECTIVO' }, usuario, 1n, '10.0.0.1');
      expect(comprobantes.anularElectronico).toHaveBeenCalledWith(33n, expect.stringContaining('CP-7'), usuario, '10.0.0.1');
      expect(tx.devolucionPedido.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ comprobante_baja_estado: 'ACEPTADA' }) }),
      );
      expect(r.avisoComprobante).toBeNull();
    });

    it('si la baja falla, la devolución se registra igual y avisa que consulte al contador', async () => {
      const { servicio, tx } = construir(
        { comprobante: [{ id: 33n, tipo: 'FACTURA', numero_texto: 'F002-1', baja_estado: null }] },
        { baja: async () => { throw new Error('fuera de plazo'); } },
      );
      const r = await servicio.registrar('7', { montoDevuelto: 45, medio: 'EFECTIVO' }, usuario, 1n);
      expect(tx.devolucionPedido.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ comprobante_baja_estado: 'NO_ANULADO' }) }),
      );
      expect(r.avisoComprobante).toBe('Consulta al contador por el comprobante');
    });

    it('registra la autorización de quien aprobó y audita la devolución', async () => {
      const { servicio, tx, auditoria } = construir();
      await servicio.registrar('7', { montoDevuelto: 45, medio: 'EFECTIVO' }, usuario, 4n);
      expect(tx.devolucionPedido.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ por_party_id: 9n, autorizado_por_party_id: 4n }) }),
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ categoria: 'CAMBIO', modulo: 'pedidos', accion: 'DEVOLUCION_PEDIDO' }),
      );
    });
  });

  describe('No corresponde devolver', () => {
    const conUpdate = (c: ReturnType<typeof construir>, count = 1) => {
      (c.prisma.pedido as any).updateMany = jest.fn().mockResolvedValue({ count });
      return c;
    };
    it('solo ADMIN o SUPERVISOR', async () => {
      const { servicio } = conUpdate(construir());
      await expect(servicio.descartar('7', 'la caja ya cuadró con este pago', usuario)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN_SUPERVISOR' } });
    });
    it('exige motivo de 10 letras', async () => {
      const { servicio } = conUpdate(construir());
      await expect(servicio.descartar('7', 'corto', { partyId: '1', rol: 'ADMIN' } as any)).rejects.toMatchObject({ response: { codigo: 'MOTIVO_REQUERIDO' } });
    });
    it('marca el pedido sin mover dinero ni caja y lo audita', async () => {
      const c = conUpdate(construir());
      await c.servicio.descartar('7', 'la caja ya cuadró con este pago', { partyId: '1', rol: 'SUPERVISOR' } as any);
      expect((c.prisma.pedido as any).updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7n, devolucion_descartada_en: null } }));
      expect(c.prisma.$transaction).not.toHaveBeenCalled();
      expect(c.comprobantes.anularElectronico).not.toHaveBeenCalled();
      expect(c.auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'DEVOLUCION_NO_CORRESPONDE' }));
    });
    it('si ya tiene devolución registrada, no se descarta', async () => {
      const { servicio } = conUpdate(construir({ devolucion: { id: 1n } as any }));
      await expect(servicio.descartar('7', 'la caja ya cuadró con este pago', { partyId: '1', rol: 'ADMIN' } as any)).rejects.toMatchObject({ response: { codigo: 'DEVOLUCION_YA_REGISTRADA' } });
    });
  });
});
