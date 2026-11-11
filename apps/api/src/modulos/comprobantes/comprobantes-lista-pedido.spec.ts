jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ComprobantesService } from './comprobantes.service';
import { crearBaseFalsa, pedidoDePrueba } from './comprobantes.fake-db';

const comp = (extra: any) => ({
  id: 1n, pedido_id: 100n, tipo: 'BOLETA', serie: 'B002', numero: 1, numero_texto: 'B002-1', documento: '12345678',
  razon_social: null, emision: 'EMITIDO', anulado_en: null, facturacion_estado: 'EMITIDO_SUNAT', creado_en: new Date('2026-11-10T15:00:00Z'), ...extra,
});

function montar(comprobantes: any[], archivos: any[] = []) {
  const base = crearBaseFalsa({
    pedido: [pedidoDePrueba(), { ...pedidoDePrueba(), id: 101n, codigo: 'P-EXTRA', pedido_origen_id: 100n }],
    comprobante: comprobantes,
    comprobanteArchivo: archivos,
  });
  return new ComprobantesService(base.prisma, { registrar: jest.fn() } as any);
}

describe('listarPorPedido', () => {
  it('vigente primero, anulado después, con extras y banderas de archivos', async () => {
    const s = montar(
      [
        comp({ id: 1n, numero: 1, numero_texto: 'B002-1', anulado_en: new Date(), baja_estado: 'ACEPTADA', creado_en: new Date('2026-11-10T16:00:00Z') }),
        comp({ id: 2n, numero: 2, numero_texto: 'B002-2' }),
        comp({ id: 3n, pedido_id: 101n, tipo: 'FACTURA', serie: 'F002', numero: 1, numero_texto: 'F002-1', documento: '20123456789', creado_en: new Date('2026-11-10T17:00:00Z') }),
      ],
      [{ comprobante_id: 2n, tipo: 'XML' }],
    );
    const r = await s.listarPorPedido('100', { rol: 'CAJERO' } as any);
    expect(r.elementos.map((e: any) => e.numero_texto)).toEqual(['F002-1', 'B002-2', 'B002-1']);
    const b2 = r.elementos.find((e: any) => e.numero_texto === 'B002-2');
    expect(b2).toMatchObject({ tiene_xml: true, tiene_cdr: false, documento: '12****78' });
    expect(r.elementos.find((e: any) => e.numero_texto === 'F002-1')).toMatchObject({ codigo_pedido: 'P-EXTRA', documento: '20****89' });
  });

  it('ADMIN ve el documento completo; sin comprobantes devuelve lista vacía', async () => {
    const s = montar([comp({})]);
    expect((await s.listarPorPedido('100', { rol: 'ADMIN' } as any)).elementos[0].documento).toBe('12345678');
    expect((await montar([]).listarPorPedido('100', { rol: 'ADMIN' } as any)).elementos).toEqual([]);
  });
});
