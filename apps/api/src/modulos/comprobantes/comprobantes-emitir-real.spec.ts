jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ComprobantesService } from './comprobantes.service';
import { crearBaseFalsa, pedidoDePrueba } from './comprobantes.fake-db';

const simulada = (extra: any = {}) => ({
  id: 7n,
  pedido_id: 100n,
  tipo: 'FACTURA',
  serie: 'F002',
  numero: 5,
  numero_texto: 'F002-5',
  documento: '20601234567',
  razon_social: 'Inversiones Aybar S.A.C.',
  anulado_en: null,
  simulado: true,
  emisor: 'SIMULADO',
  facturacion_estado: 'EMITIDO_SUNAT',
  ...extra,
});

function montar(comprobantes: any[], proveedor = 'SUNAT', pedido: any = pedidoDePrueba(), sunatDisponible = true) {
  const base = crearBaseFalsa({ pedido: [pedido], comprobante: comprobantes, parametro: [{ clave: 'facturacion_proveedor', valor: proveedor }] });
  const auditoria = { registrar: jest.fn(async (r: any, db?: any) => { await (db ?? base.prisma).auditoria.create({ data: r }); }) } as any;
  const sunat = { disponible: () => sunatDisponible, generar: jest.fn(async (e: any) => ({ estado: e.tipo === 'BOLETA' ? 'PENDIENTE_RESUMEN' : 'EMITIDO_SUNAT', respuesta: 'ok', simulado: false })) } as any;
  const servicio = new ComprobantesService(base.prisma, auditoria, undefined, undefined, sunat);
  return { ...base, servicio, auditoria, sunat };
}

describe('emitirReal', () => {
  it('factura simulada: anula la vieja sin red, emite una nueva con la siguiente numeración y la envía a SUNAT', async () => {
    const { servicio, db, sunat, auditoria } = montar([simulada()]);
    const r = await servicio.emitirReal(7n, { partyId: 2n } as any);
    expect(db.comprobante[0]).toMatchObject({ baja_estado: 'ACEPTADA', anulado_motivo: 'Reemitido como comprobante real' });
    expect(db.comprobante[0].anulado_en).toBeInstanceOf(Date);
    const nueva = db.comprobante[1];
    expect(nueva).toMatchObject({ pedido_id: 100n, tipo: 'FACTURA', numero: 1, emisor: 'SUNAT', simulado: false, documento: '20601234567' });
    expect(nueva.anulado_en ?? null).toBeNull();
    expect(nueva.numero_texto).not.toBe('F002-5');
    expect(sunat.generar).toHaveBeenCalledTimes(1);
    expect(r.id).toBe(nueva.id.toString());
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'EMITIR_REAL', antes: expect.objectContaining({ comprobante_origen: 'F002-5' }) }), expect.anything());
  });

  it('boleta simulada: la nueva queda para el resumen diario', async () => {
    const { servicio, db } = montar([simulada({ tipo: 'BOLETA', serie: 'B002', numero_texto: 'B002-5' })], 'SUNAT', pedidoDePrueba({ comprobante_tipo: 'BOLETA', comprobante_doc: '12345678' }));
    await servicio.emitirReal(7n);
    expect(db.comprobante[1]).toMatchObject({ tipo: 'BOLETA', facturacion_estado: 'PENDIENTE_RESUMEN', simulado: false });
  });

  it('ya real: 409 y no toca nada', async () => {
    const { servicio, db } = montar([simulada({ simulado: false, emisor: 'SUNAT' })]);
    await expect(servicio.emitirReal(7n)).rejects.toMatchObject({ response: { codigo: 'COMPROBANTE_YA_REAL' } });
    expect(db.comprobante).toHaveLength(1);
  });

  it('proveedor no SUNAT (o SUNAT sin credenciales): 409 con mensaje claro', async () => {
    for (const m of [montar([simulada()], 'SIMULADO'), montar([simulada()], 'SUNAT', pedidoDePrueba(), false)]) {
      await expect(m.servicio.emitirReal(7n)).rejects.toMatchObject({
        response: { codigo: 'PROVEEDOR_NO_SUNAT', mensaje: 'Cambia el proveedor a SUNAT en Facturación primero' },
      });
      expect(m.db.comprobante).toHaveLength(1);
      expect(m.db.comprobante[0].anulado_en).toBeNull();
    }
  });

  it('anulado: se rechaza', async () => {
    const { servicio, db } = montar([simulada({ anulado_en: new Date() })]);
    await expect(servicio.emitirReal(7n)).rejects.toMatchObject({ response: { codigo: 'COMPROBANTE_ANULADO' } });
    expect(db.comprobante).toHaveLength(1);
  });

  it('si la emisión nueva falla, la vieja no queda anulada (transacción)', async () => {
    const { servicio, db } = montar([simulada()], 'SUNAT', pedidoDePrueba({ comprobante_doc: '123' }));
    await expect(servicio.emitirReal(7n)).rejects.toBeDefined();
    expect(db.comprobante).toHaveLength(1);
    expect(db.comprobante[0].anulado_en).toBeNull();
  });

  it('el barrido no duplica: el pedido queda con un solo comprobante vigente', async () => {
    const { servicio, db } = montar([simulada()]);
    await servicio.emitirReal(7n);
    expect(db.comprobante.filter((c: any) => !c.anulado_en)).toHaveLength(1);
  });
});
