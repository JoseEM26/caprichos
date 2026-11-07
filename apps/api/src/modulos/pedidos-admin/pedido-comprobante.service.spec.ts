import { ConflictException } from '@nestjs/common';
import { PedidoComprobanteService } from './pedido-comprobante.service';

/** Mensaje de la excepción de Nest (el cuerpo va en getResponse). */
const mensajeDe = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (e: any) {
    return String(e.getResponse().mensaje);
  }
  return '';
};

describe('PedidoComprobanteService.cambiar (PATCH comprobante)', () => {
  const pedidoBase = {
    id: 5n,
    codigo: 'CP-W005',
    estado: 'COLA',
    pago_estado: 'PENDIENTE',
    total: 40,
    comprobante_tipo: 'NOTA_VENTA',
    comprobante_doc: null as string | null,
    comprobante_razon: null as string | null,
    comprobante_direccion: null as string | null,
  };

  const construir = (sobrescribe: Partial<typeof pedidoBase> = {}, comprobante: any = null, conteo = 1) => {
    const prisma = {
      pedido: {
        findUnique: jest.fn().mockResolvedValue({ ...pedidoBase, ...sobrescribe }),
        updateMany: jest.fn().mockResolvedValue({ count: conteo }),
      },
      comprobante: { findFirst: jest.fn().mockResolvedValue(comprobante) },
    };
    const auditoria = { registrar: jest.fn() };
    return { servicio: new PedidoComprobanteService(prisma as any, auditoria as any), prisma, auditoria };
  };

  it('cambia a factura válida y audita con el RUC enmascarado', async () => {
    const { servicio, prisma, auditoria } = construir();
    const res = await servicio.cambiar(
      '5',
      { tipo: 'FACTURA', doc: '20123456789', razon: 'Acme SAC', direccion: ' Av. Uno 123 ' },
      { partyId: '9' } as any,
      '10.0.0.2',
    );
    expect(res.comprobante_tipo).toBe('FACTURA');
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { comprobante_tipo: 'FACTURA', comprobante_doc: '20123456789', comprobante_razon: 'Acme SAC', comprobante_direccion: 'Av. Uno 123' },
      }),
    );
    const registro = auditoria.registrar.mock.calls[0][0];
    expect(registro.accion).toBe('CAMBIAR_COMPROBANTE');
    expect(registro.antes).toEqual({ tipo: 'NOTA_VENTA', documento: null, razon: null, direccion: null });
    expect(registro.despues.documento).toBe('20****89');
    expect(JSON.stringify(registro, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('20123456789');
  });

  it('boleta sin DNI hasta 700 se acepta; con DNI se enmascara en la auditoría', async () => {
    const { servicio, auditoria } = construir({ total: 50 });
    await servicio.cambiar('5', { tipo: 'BOLETA' });
    await servicio.cambiar('5', { tipo: 'BOLETA', doc: '12345678' });
    expect(auditoria.registrar.mock.calls[1][0].despues.documento).toBe('12****78');
  });

  it('boleta sin DNI por más de S/ 700 se cambia sin bloquear: la exige el cobro', async () => {
    const { servicio, prisma } = construir({ total: 900 });
    await servicio.cambiar('5', { tipo: 'BOLETA' });
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ comprobante_tipo: 'BOLETA', comprobante_doc: null }) }));
  });

  it('cambia a comprobante simple: borra documento, razón y dirección aunque lleguen', async () => {
    const { servicio, prisma } = construir({ comprobante_tipo: 'FACTURA', comprobante_doc: '20123456789', comprobante_razon: 'Acme SAC' });
    await servicio.cambiar('5', { tipo: 'SIMPLE', doc: '12345678', razon: 'X', direccion: 'Y' });
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { comprobante_tipo: 'SIMPLE', comprobante_doc: null, comprobante_razon: null, comprobante_direccion: null } }),
    );
  });

  it('pedido ya cobrado: 409 y no escribe', async () => {
    const { servicio, prisma } = construir({ pago_estado: 'PAGADO' });
    await expect(servicio.cambiar('5', { tipo: 'BOLETA' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('cobrado entre la lectura y la escritura: 409', async () => {
    const { servicio } = construir({}, null, 0);
    await expect(servicio.cambiar('5', { tipo: 'BOLETA' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('con comprobante ya emitido: 409 con el número', async () => {
    const { servicio, prisma } = construir({}, { tipo: 'NOTA_VENTA', numero_texto: 'NV01-000003' });
    expect(await mensajeDe(servicio.cambiar('5', { tipo: 'BOLETA' }))).toMatch(/NV01-000003/);
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('valida RUC de 10 dígitos y razón social obligatoria', async () => {
    const { servicio } = construir();
    expect(await mensajeDe(servicio.cambiar('5', { tipo: 'FACTURA', doc: '1234567890', razon: 'X' }))).toMatch(/RUC/);
    expect(await mensajeDe(servicio.cambiar('5', { tipo: 'FACTURA', doc: '20123456789', razon: '  ' }))).toMatch(/razón social/);
  });
});
