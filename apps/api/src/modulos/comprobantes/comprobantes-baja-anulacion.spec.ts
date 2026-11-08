jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ComprobantesService } from './comprobantes.service';
import { crearBaseFalsa, pedidoDePrueba } from './comprobantes.fake-db';

/**
 * H3: anular un cobro o un pedido da de baja la boleta/factura vigente sin depender de SUNAT, y un nuevo cobro
 * nunca reutiliza la boleta anterior.
 */
const fila = (extra: any = {}) => ({
  id: 7n,
  pedido_id: 100n,
  tipo: 'BOLETA',
  serie: 'B002',
  numero: 5,
  numero_texto: 'B002-5',
  anulado_en: null,
  facturacion_estado: 'EMITIDO_SUNAT',
  facturacion_intentos: 1,
  baja_estado: null,
  ...extra,
});

function montar(comprobantes: any[]) {
  const base = crearBaseFalsa({ pedido: [pedidoDePrueba()], comprobante: comprobantes });
  const auditoria = { registrar: jest.fn(async () => undefined) } as any;
  const servicio = new ComprobantesService(base.prisma, auditoria);
  return { ...base, servicio, auditoria };
}

describe('darDeBajaPorAnulacion', () => {
  it('boleta aceptada: pide la baja, queda anulada y devuelve el estado de la baja', async () => {
    const { servicio, db } = montar([fila()]);
    const baja = jest.spyOn(servicio, 'anularElectronico').mockResolvedValue({ baja_estado: 'PENDIENTE_RESUMEN' } as any);
    const r = await servicio.darDeBajaPorAnulacion(100n, 'Cobro anulado: error de monto');
    expect(baja).toHaveBeenCalledWith(7n, 'Cobro anulado: error de monto', undefined, undefined);
    expect(r).toEqual({ comprobante: 'B002-5', estado: 'PENDIENTE_RESUMEN' });
    expect(db.comprobante[0].anulado_en).toBeInstanceOf(Date);
  });

  it('SUNAT sin respuesta (503): la anulación no se cae, queda PENDIENTE_BAJA con su motivo y se audita', async () => {
    const { servicio, db, auditoria } = montar([fila()]);
    jest.spyOn(servicio, 'anularElectronico').mockRejectedValue(new Error('EMISOR_SIN_RESPUESTA'));
    const r = await servicio.darDeBajaPorAnulacion(100n, 'Cobro anulado: error de monto');
    expect(r?.estado).toBe('PENDIENTE_BAJA');
    expect(db.comprobante[0]).toMatchObject({ baja_estado: 'PENDIENTE_BAJA', baja_motivo: 'Cobro anulado: error de monto' });
    expect(db.comprobante[0].anulado_en).toBeInstanceOf(Date);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'BAJA_POR_ANULACION' }));
  });

  it('el reintento repite la baja pendiente con el motivo guardado', async () => {
    const { servicio } = montar([fila({ baja_estado: 'PENDIENTE_BAJA', baja_motivo: 'Error de monto', baja_en: new Date(), anulado_en: new Date() })]);
    const baja = jest.spyOn(servicio, 'anularElectronico').mockResolvedValue({} as any);
    expect(await servicio.reintentarBajasPendientes()).toBe(1);
    expect(baja).toHaveBeenCalledWith(7n, 'Error de monto');
  });

  it('boleta que nunca salió a SUNAT: se anula aquí, sin comunicación de baja', async () => {
    const { servicio, db } = montar([fila({ facturacion_estado: 'PENDIENTE_ENVIO', facturacion_intentos: 0 })]);
    const baja = jest.spyOn(servicio, 'anularElectronico');
    const r = await servicio.darDeBajaPorAnulacion(100n, 'Cobro anulado en caja');
    expect(baja).not.toHaveBeenCalled();
    expect(r?.estado).toBe('ANULADO_SIN_ENVIAR');
    expect(db.comprobante[0].anulado_en).toBeInstanceOf(Date);
  });

  it('pedido sin boleta/factura: no hace nada', async () => {
    const { servicio } = montar([]);
    expect(await servicio.darDeBajaPorAnulacion(100n, 'Cobro anulado en caja')).toBeNull();
  });

  it('re-cobro tras la anulación: emite una boleta nueva, no reutiliza la anterior', async () => {
    const { servicio, db, prisma } = montar([fila()]);
    jest.spyOn(servicio, 'anularElectronico').mockResolvedValue({ baja_estado: 'ACEPTADA' } as any);
    await servicio.darDeBajaPorAnulacion(100n, 'Cobro anulado: error de monto');
    await servicio.emitirParaPedido(100n, prisma as any);
    expect(db.comprobante).toHaveLength(2);
    expect(db.comprobante[1].anulado_en ?? null).toBeNull();
    expect(db.comprobante[1].numero_texto).not.toBe('B002-5');
  });
});
