import { NotFoundException } from '@nestjs/common';
import { construirLineaTiempo, totalSegDePedido, DatosLineaTiempo } from './linea-tiempo.util';
import { LineaTiempoService } from './linea-tiempo.service';

const t = (min: number) => new Date(Date.UTC(2026, 10, 9, 17, 0, 0) + min * 60000);
const base = (o: Partial<DatosLineaTiempo> = {}): DatosLineaTiempo => ({
  estado: 'ENTREGADO',
  modalidad: 'LLEVAR',
  creado_en: t(0),
  pasa_cocina_en: t(2),
  listo_en: t(12),
  entregado_mesa_en: null,
  entregado_en: t(20),
  anulado_en: null,
  tomado_en: null,
  salio_en: null,
  despachado_en: null,
  llego_en: null,
  cobro_mozo_en: null,
  lineas: [
    { area: 'Barra', listo_en: t(6) },
    { area: 'Cocina', listo_en: t(12) },
  ],
  historial: [],
  cobro_en: t(15),
  ...o,
});
const por = (r: ReturnType<typeof construirLineaTiempo>, codigo: string) => r.etapas.filter((e) => e.codigo === codigo);

describe('construirLineaTiempo', () => {
  it('pedido nuevo completo: una etapa de preparación por área y total', () => {
    const r = construirLineaTiempo(base());
    expect(por(r, 'EN_COLA')[0].duracionSeg).toBe(120);
    expect(por(r, 'PREPARACION').map((e) => [e.area, e.duracionSeg])).toEqual([['Barra', 240], ['Cocina', 600]]);
    expect(por(r, 'COBRADO')[0].duracionSeg).toBe(180); // listo 12 -> cobrado 15
    expect(por(r, 'ENTREGADO')[0].duracionSeg).toBe(300); // cobrado 15 -> entregado 20
    expect(r.totalSeg).toBe(1200);
    expect(r.completo).toBe(true);
    expect(r.etapas.every((e) => !e.estimada)).toBe(true);
  });

  it('pedido viejo sin hora por línea ni pasa_cocina_en: estimada o null, sin inventar', () => {
    const r = construirLineaTiempo(
      base({ pasa_cocina_en: null, lineas: [{ area: 'Cocina', listo_en: null }], cobro_en: null, historial: [{ estado_nuevo: 'PREPARANDO', en: t(3) }] }),
    );
    expect(por(r, 'EN_COLA')[0].duracionSeg).toBe(180); // del historial
    const prep = por(r, 'PREPARACION')[0];
    expect(prep.estimada).toBe(true);
    expect(prep.duracionSeg).toBe(540); // 3 -> listo del pedido 12
    expect(por(r, 'COBRADO')[0].duracionSeg).toBeNull();
    expect(r.completo).toBe(false);
    expect(r.totalSeg).toBe(1200);
  });

  it('sin ninguna marca de listo, la preparación queda null', () => {
    const r = construirLineaTiempo(base({ listo_en: null, lineas: [{ area: 'Cocina', listo_en: null }] }));
    expect(por(r, 'PREPARACION')[0].duracionSeg).toBeNull();
    expect(por(r, 'LISTO')[0].desde).toBeNull();
  });

  it('cobro de mozo sin cobro de caja cuenta como estimado', () => {
    const r = construirLineaTiempo(base({ cobro_en: null, cobro_mozo_en: t(14) }));
    expect(por(r, 'COBRADO')[0]).toMatchObject({ duracionSeg: 120, estimada: true });
  });

  it('cobrado antes de estar listo: el tramo es 0', () => {
    const r = construirLineaTiempo(base({ cobro_en: t(5) }));
    expect(por(r, 'COBRADO')[0].duracionSeg).toBe(0);
  });

  it('delivery: asignado, en ruta y entrega al cliente', () => {
    const r = construirLineaTiempo(
      base({ modalidad: 'DELIVERY', tomado_en: t(13), salio_en: t(16), llego_en: t(28), entregado_en: t(30) }),
    );
    expect(por(r, 'EN_RUTA').map((e) => [e.etiqueta, e.duracionSeg])).toEqual([
      ['Asignado al repartidor', 180],
      ['En ruta', 720],
    ]);
    expect(por(r, 'ENTREGADO')[0].duracionSeg).toBe(120);
    expect(r.totalSeg).toBe(1800);
  });

  it('mesa: entregado en mesa por el mozo', () => {
    const r = construirLineaTiempo(base({ modalidad: 'MESA', entregado_mesa_en: t(14), cobro_en: t(10) }));
    const e = por(r, 'ENTREGADO')[0];
    expect(e.etiqueta).toBe('Entregado en mesa');
    expect(e.duracionSeg).toBe(120); // desde el listo (12) hasta la mesa (14)
  });

  it('anulado: solo toma, cola y anulación', () => {
    const r = construirLineaTiempo(base({ estado: 'ANULADO', pasa_cocina_en: null, anulado_en: t(4), entregado_en: null }));
    expect(r.etapas.map((e) => e.codigo)).toEqual(['TOMADO', 'EN_COLA', 'ANULADO']);
    expect(r.totalSeg).toBe(240);
  });

  it('pedido abierto: total null', () => {
    expect(totalSegDePedido({ estado: 'PREPARANDO', creado_en: t(0), entregado_en: null, entregado_mesa_en: null, anulado_en: null })).toBeNull();
  });
});

describe('LineaTiempoService.obtener', () => {
  const pedido = (o: any = {}) => ({
    id: 7n, canal: 'MOZO', mesa_nombre: 'Mesa 4', party_id: 3n, repartidor_party_id: null,
    ...base({ modalidad: 'MESA' }),
    lineas: [{ listo_en: t(6), area: { nombre: 'Barra' } }],
    historial: [{ estado_nuevo: 'COLA', en: t(0), por_party_id: 3n }],
    cobros: [{ en: t(15) }],
    ...o,
  });
  const armar = (p: any) => {
    const prisma: any = {
      pedido: { findUnique: jest.fn().mockResolvedValue(p) },
      person: { findMany: jest.fn().mockResolvedValue([{ party_id: 3n, nombres: 'Ana', apellidos: 'Paz' }]) },
      userAccount: { findUnique: jest.fn().mockResolvedValue({ rol: 'MOZO' }) },
    };
    return new LineaTiempoService(prisma);
  };

  it('devuelve el contrato con quién atendió y la mesa', async () => {
    const r = await armar(pedido()).obtener('7');
    expect(r).toMatchObject({
      pedidoId: '7', canal: 'MOZO', modalidad: 'MESA', mesa: 'Mesa 4',
      atendidoPor: { partyId: '3', nombre: 'Ana Paz', rol: 'MOZO', en: t(0).toISOString() },
    });
    expect(r.etapas.length).toBeGreaterThan(3);
    expect(typeof r.completo).toBe('boolean');
  });

  it('canal de cliente: atendidoPor null (party_id es el cliente)', async () => {
    const r = await armar(pedido({ canal: 'CARTA' })).obtener('7');
    expect(r.atendidoPor).toBeNull();
  });

  it('404 si no existe o el id no es válido; repartidor ajeno no lo ve', async () => {
    await expect(armar(null).obtener('7')).rejects.toBeInstanceOf(NotFoundException);
    await expect(armar(pedido()).obtener('abc')).rejects.toBeInstanceOf(NotFoundException);
    await expect(armar(pedido({ repartidor_party_id: 9n })).obtener('7', { rol: 'REPARTIDOR', partyId: 1n } as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});
