jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ComprobantesService } from './comprobantes.service';
import { ComprobantesNocturnoService } from './comprobantes-nocturno.service';
import { crearBaseFalsa, pedidoDePrueba } from './comprobantes.fake-db';

// 23:10 en Lima del 1/3/2027 (UTC-5) y 15:00 del mismo día
const NOCHE = new Date('2027-03-02T04:10:00Z');
const TARDE = new Date('2027-03-01T20:00:00Z');
const hoy = new Date('2027-03-01T15:00:00Z');

function montar(pedidos: any[], extra: any = {}, parametros: any[] = []) {
  const base = crearBaseFalsa({
    pedido: pedidos,
    parametro: [{ clave: 'facturacion_envio_nocturno', valor: 'si' }, ...parametros],
    ...extra,
  });
  const auditoria = { registrar: jest.fn(async (r: any, db?: any) => { await (db ?? base.prisma).auditoria.create({ data: r }); }) } as any;
  const comprobantes = new ComprobantesService(base.prisma, auditoria);
  const nocturno = new ComprobantesNocturnoService(base.prisma, comprobantes, auditoria);
  return { ...base, comprobantes, nocturno, auditoria };
}

const cobrar = async (m: ReturnType<typeof montar>, id: bigint) => {
  const c: any = await m.comprobantes.emitirParaPedido(id);
  const fila = m.db.comprobante.find((f: any) => f.pedido_id === id && !f.anulado_en);
  if (fila) fila.creado_en = hoy;
  return c;
};

const boleta = (id: bigint) => pedidoDePrueba({ id, codigo: `P-${id}`, comprobante_tipo: 'BOLETA', comprobante_doc: '12345678', comprobante_razon: null });

describe('envío nocturno de boletas y facturas', () => {
  it('al cobrar, boleta y factura quedan POR_EMITIR_NOCHE sin serie ni número y sin llamar al emisor', async () => {
    const m = montar([boleta(1n), pedidoDePrueba({ id: 2n })]);
    await cobrar(m, 1n);
    await cobrar(m, 2n);
    expect(m.db.comprobante).toHaveLength(2);
    for (const c of m.db.comprobante) expect(c).toMatchObject({ facturacion_estado: 'POR_EMITIR_NOCHE', serie: null, numero: null, numero_texto: null });
    expect(m.db.secuencia).toEqual({});
  });

  it('el lote emite ambas con el emisor Simulado y asigna correlativos sin huecos', async () => {
    const m = montar([boleta(1n), boleta(3n), pedidoDePrueba({ id: 2n })]);
    for (const id of [1n, 2n, 3n]) await cobrar(m, id);
    const r = await m.nocturno.emitirLote(NOCHE);
    expect(r.emitidos).toBe(3);
    const b = m.db.comprobante.filter((c: any) => c.tipo === 'BOLETA').map((c: any) => c.numero_texto);
    expect(b).toEqual(['B002-000001', 'B002-000002']);
    expect(m.db.comprobante.find((c: any) => c.tipo === 'FACTURA')).toMatchObject({ numero_texto: 'F002-000001', facturacion_estado: 'EMITIDO_SUNAT' });
  });

  it('antes de la hora del lote no emite nada; es idempotente', async () => {
    const m = montar([boleta(1n)]);
    await cobrar(m, 1n);
    expect((await m.nocturno.emitirLote(TARDE)).emitidos).toBe(0);
    expect(m.db.comprobante[0].facturacion_estado).toBe('POR_EMITIR_NOCHE');
    expect((await m.nocturno.emitirLote(NOCHE)).emitidos).toBe(1);
    expect((await m.nocturno.emitirLote(NOCHE)).emitidos).toBe(0);
    expect(m.db.secuencia).toEqual({ B002: 1 });
  });

  it('la hora es un parámetro', async () => {
    const m = montar([boleta(1n)], {}, [{ clave: 'facturacion_hora_envio', valor: 16 }]);
    await cobrar(m, 1n);
    expect((await m.nocturno.emitirLote(TARDE)).emitidos).toBe(0); // 15:00
    expect((await m.nocturno.emitirLote(new Date('2027-03-01T21:30:00Z'))).emitidos).toBe(1); // 16:30
  });

  it('la hora acepta minutos (HH:MM)', async () => {
    const m = montar([boleta(1n)], {}, [{ clave: 'facturacion_hora_envio', valor: '16:45' }, { clave: 'facturacion_hora_resumen', valor: '17:30' }]);
    await cobrar(m, 1n);
    expect((await m.nocturno.emitirLote(new Date('2027-03-01T21:30:00Z'))).emitidos).toBe(0); // 16:30
    expect((await m.nocturno.emitirLote(new Date('2027-03-01T21:50:00Z'))).emitidos).toBe(1); // 16:50
  });

  it('«Emitir ahora» no espera la hora', async () => {
    const m = montar([boleta(1n)]);
    await cobrar(m, 1n);
    expect((await m.nocturno.emitirLote(TARDE, true)).emitidos).toBe(1);
    expect(m.db.comprobante[0].numero_texto).toBe('B002-000001');
  });

  it('cambio boleta a factura el mismo día: reemplaza sin enviar nada ni anular, y el número sale en la noche', async () => {
    const m = montar([boleta(1n)]);
    await cobrar(m, 1n);
    await m.nocturno.solicitarCambio('1', { tipo: 'FACTURA', doc: '20601234567', razon: 'Inversiones Aybar S.A.C.', motivo: 'Pidió factura' });
    expect((await m.nocturno.leerCambio('1'))?.tipo).toBe('FACTURA');
    await m.nocturno.emitirLote(NOCHE);
    expect(m.db.comprobante).toHaveLength(1);
    expect(m.db.comprobante[0]).toMatchObject({ tipo: 'FACTURA', documento: '20601234567', numero_texto: 'F002-000001', anulado_en: null });
    expect(m.db.comprobante[0].baja_estado ?? null).toBeNull();
    expect(m.db.secuencia).toEqual({ F002: 1 }); // ningún número de boleta quemado
    expect(m.db.pedido[0]).toMatchObject({ comprobante_tipo: 'FACTURA', comprobante_doc: '20601234567' });
    expect(m.db.comprobanteCambioPendiente).toHaveLength(0);
  });

  it('cambio factura a boleta', async () => {
    const m = montar([pedidoDePrueba({ id: 2n })]);
    await cobrar(m, 2n);
    await m.nocturno.solicitarCambio('2', { tipo: 'BOLETA', doc: '12345678', motivo: 'Cliente sin RUC' });
    await m.nocturno.emitirLote(NOCHE);
    expect(m.db.comprobante).toHaveLength(1);
    expect(m.db.comprobante[0]).toMatchObject({ tipo: 'BOLETA', numero_texto: 'B002-000001', documento: '12345678', razon_social: null });
  });

  it('simple a factura: crea el comprobante en la noche; factura a simple: no queda nada', async () => {
    const m = montar([pedidoDePrueba({ id: 5n, comprobante_tipo: 'SIMPLE', comprobante_doc: null, comprobante_razon: null }), pedidoDePrueba({ id: 6n })]);
    await cobrar(m, 5n);
    await cobrar(m, 6n);
    expect(m.db.comprobante).toHaveLength(1);
    await m.nocturno.solicitarCambio('5', { tipo: 'FACTURA', doc: '20601234567', razon: 'Inversiones Aybar S.A.C.', motivo: 'Ahora pide factura' });
    await m.nocturno.solicitarCambio('6', { tipo: 'SIMPLE', motivo: 'No quiso factura' });
    await m.nocturno.emitirLote(NOCHE);
    const vigentes = m.db.comprobante.filter((c: any) => !c.anulado_en);
    expect(vigentes).toHaveLength(1);
    expect(vigentes[0]).toMatchObject({ pedido_id: 5n, tipo: 'FACTURA', numero_texto: 'F002-000001' });
    expect(m.db.comprobante.find((c: any) => c.pedido_id === 6n).anulado_en).toBeTruthy();
  });

  it('doble cambio el mismo día deja solo el último', async () => {
    const m = montar([boleta(1n)]);
    await cobrar(m, 1n);
    await m.nocturno.solicitarCambio('1', { tipo: 'FACTURA', doc: '20601234567', razon: 'Inversiones Aybar S.A.C.', motivo: 'Primero factura' });
    await m.nocturno.solicitarCambio('1', { tipo: 'SIMPLE', motivo: 'Mejor sin comprobante' });
    expect(m.db.comprobanteCambioPendiente).toHaveLength(1);
    await m.nocturno.emitirLote(NOCHE);
    expect(m.db.comprobante.filter((c: any) => !c.anulado_en)).toHaveLength(0);
    expect(m.db.secuencia).toEqual({});
  });

  it('deshacer deja el comprobante como estaba; el mismo comprobante o sin motivo se rechaza', async () => {
    const m = montar([boleta(1n)]);
    await cobrar(m, 1n);
    await expect(m.nocturno.solicitarCambio('1', { tipo: 'BOLETA', doc: '12345678', motivo: 'Sin cambio real' })).rejects.toMatchObject({ response: { codigo: 'SIN_CAMBIO' } });
    await expect(m.nocturno.solicitarCambio('1', { tipo: 'SIMPLE', motivo: 'ya' })).rejects.toMatchObject({ response: { codigo: 'MOTIVO_REQUERIDO' } });
    await m.nocturno.solicitarCambio('1', { tipo: 'SIMPLE', motivo: 'Mejor simple' });
    await m.nocturno.deshacerCambio('1');
    await m.nocturno.emitirLote(NOCHE);
    expect(m.db.comprobante[0]).toMatchObject({ tipo: 'BOLETA', numero_texto: 'B002-000001' });
    expect(m.auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'DESHACER_CAMBIO_COMPROBANTE' }));
  });

  it('pedido anulado antes del envío: no se emite ni gasta número', async () => {
    const m = montar([boleta(1n)]);
    await cobrar(m, 1n);
    m.db.pedido[0].estado = 'ANULADO';
    const r = await m.nocturno.emitirLote(NOCHE);
    expect(r.emitidos).toBe(0);
    expect(m.db.comprobante[0].anulado_en).toBeTruthy();
    expect(m.db.secuencia).toEqual({});
  });

  it('un cambio pendiente de un pedido anulado se descarta', async () => {
    const m = montar([boleta(1n)]);
    await cobrar(m, 1n);
    await m.nocturno.solicitarCambio('1', { tipo: 'SIMPLE', motivo: 'Mejor simple' });
    m.db.pedido[0].estado = 'ANULADO';
    const r = await m.nocturno.emitirLote(NOCHE);
    expect(r.descartados).toBe(1);
    expect(m.db.comprobanteCambioPendiente).toHaveLength(0);
  });

  it('comprobante que ya había salido (anterior al envío nocturno): una sola baja y el nuevo', async () => {
    const enviada = { id: 9n, pedido_id: 1n, tipo: 'BOLETA', serie: 'B002', numero: 4, numero_texto: 'B002-000004', documento: '12345678', anulado_en: null, simulado: true, emisor: 'SIMULADO', facturacion_estado: 'EMITIDO_SUNAT', emision: 'EMITIDO', creado_en: hoy };
    const m = montar([boleta(1n)], { comprobante: [enviada] });
    await m.nocturno.solicitarCambio('1', { tipo: 'FACTURA', doc: '20601234567', razon: 'Inversiones Aybar S.A.C.', motivo: 'Pidió factura' });
    await m.nocturno.emitirLote(NOCHE);
    expect(m.db.comprobante[0]).toMatchObject({ baja_estado: 'ACEPTADA' });
    expect(m.db.comprobante[0].anulado_en).toBeTruthy();
    const nuevo = m.db.comprobante[1];
    expect(nuevo).toMatchObject({ tipo: 'FACTURA', anulado_en: null, facturacion_estado: 'EMITIDO_SUNAT' });
    expect(m.db.comprobante.filter((c: any) => c.baja_estado)).toHaveLength(1);
  });

  it('un cambio no se pide sobre un pedido sin cobrar', async () => {
    const m = montar([boleta(1n)]);
    m.db.pedido[0].pago_estado = 'PENDIENTE';
    await expect(m.nocturno.solicitarCambio('1', { tipo: 'SIMPLE', motivo: 'Mejor simple' })).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_COBRADO' } });
  });

  it('parámetro en no: se conserva el comportamiento actual (número y envío al cobrar)', async () => {
    const m = montar([boleta(1n)], {}, [{ clave: 'facturacion_envio_nocturno', valor: 'no' }]);
    // el parámetro 'no' va después del 'si' de montar(): la lectura toma el primero, así que se reemplaza
    m.db.parametro.splice(0, 1);
    await m.comprobantes.emitirParaPedido(1n);
    expect(m.db.comprobante[0]).toMatchObject({ numero_texto: 'B002-000001', facturacion_estado: 'EMITIDO_SUNAT' });
  });

  it('el ticket del cobro dice que se emite por la noche y no lleva número', async () => {
    const m = montar([boleta(1n)]);
    const { representacionDe } = await import('./facturacion/representacion');
    await cobrar(m, 1n);
    expect(representacionDe(m.db.comprobante[0]).titulo).toBe('Boleta: se emite hoy por la noche');
    expect(representacionDe({ tipo: 'FACTURA', facturacion_estado: 'POR_EMITIR_NOCHE' }).titulo).toContain('te llega por WhatsApp');
  });

  it('si una fila no se puede emitir, cuenta fallidos y no la deja a medias', async () => {
    const m = montar([boleta(1n)]);
    await cobrar(m, 1n);
    jest.spyOn(m.comprobantes, 'leerConfigFacturacion').mockResolvedValueOnce(await m.comprobantes.leerConfigFacturacion()).mockRejectedValue(new Error('boom'));
    const r = await m.nocturno.emitirLote(NOCHE, true);
    expect(r).toMatchObject({ emitidos: 0, fallidos: 1 });
    expect(m.db.comprobante[0]).toMatchObject({ facturacion_estado: 'POR_EMITIR_NOCHE', serie: null });
  });

  it('el mock aplica el CHECK: pasar a PENDIENTE_ENVIO sin número falla', async () => {
    const m = montar([boleta(1n)]);
    await cobrar(m, 1n);
    await expect(m.prisma.comprobante.updateMany({ where: { id: 1n }, data: { facturacion_estado: 'PENDIENTE_ENVIO' } })).rejects.toThrow(/ck_comprobante_numero_asignado/);
  });
});
