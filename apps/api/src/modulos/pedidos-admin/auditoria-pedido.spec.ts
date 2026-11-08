import { armarEventosPedido, cargarAuditoriaPedido } from './auditoria-pedido';
import { lineasParaComprobante } from '../pedidos/lineas-combo.util';
import { calcularComprobante, aCentimos } from '../comprobantes/facturacion/facturacion.calculo';

const t = (hhmm: string) => new Date(`2026-11-08T${hhmm}:00.000-05:00`);
const nombre = (id: bigint | null) => ({ '1': 'Ana Pérez', '2': 'Luis Soto' } as Record<string, string>)[String(id)] ?? null;

describe('línea de tiempo del pedido (auditoría)', () => {
  it('ordena por hora, dice quién y por qué, y deja las cortesías como eventos propios', () => {
    const eventos = armarEventosPedido(
      {
        historial: [{ id: 1n, estado_anterior: null, estado_nuevo: 'COLA', motivo: null, por_party_id: 1n, en: t('14:00') }],
        auditoria: [
          { id: 9n, accion: 'EDITAR_PEDIDO', en: t('14:20'), party_id: 2n },
          { id: 10n, accion: 'VER_COMPROBANTE', en: t('14:21'), party_id: 2n },
          { id: 11n, accion: 'CAMBIAR_ESTADO', en: t('14:22'), party_id: 2n },
        ],
        cortesias: [
          { id: 5n, cantidad: 2, motivo: 'ERROR_COCINA', nota: 'se quemó', creado_en: t('14:32'), dada_por_party_id: 1n, pedidoLinea: { nombre: 'Frappe' } },
          { id: 6n, cantidad: 1, motivo: 'CUMPLEANOS', nota: null, creado_en: t('14:32'), dada_por_party_id: 1n, pedidoLinea: { nombre: 'Waffle' } },
        ],
      },
      nombre,
    );
    expect(eventos.map((e) => e.tipo)).toEqual(['estado', 'edicion', 'cortesia', 'cortesia']);
    expect(eventos[1]).toMatchObject({ titulo: 'Pedido editado', por: 'Luis Soto' });
    expect(eventos[2]).toMatchObject({ titulo: 'Cortesía: 2× Frappe', detalle: 'Error de cocina · se quemó', por: 'Ana Pérez' });
    expect(eventos[3].detalle).toBe('Cumpleaños');
  });

  it('cargarAuditoriaPedido: ficha por línea con quién, cuándo y motivo', async () => {
    const prisma: any = {
      auditoria: { findMany: jest.fn(async () => []) },
      cortesia: {
        findMany: jest.fn(async () => [
          { id: 5n, pedido_linea_id: 100n, cantidad: 1, valor_lista: 12, motivo: 'PRUEBA', nota: null, creado_en: t('14:32'), dada_por_party_id: 1n, producto: { nombre: 'Frappe' }, pedidoLinea: { nombre: 'Frappe' } },
        ]),
      },
      person: { findMany: jest.fn(async () => [{ party_id: 1n, nombres: 'Ana', apellidos: 'Pérez' }]) },
    };
    const r = await cargarAuditoriaPedido(prisma, 7n, []);
    expect(r.cortesiaPorLinea.get('100')).toMatchObject({ dada_por: 'Ana Pérez', motivo: 'PRUEBA', motivo_etiqueta: 'Prueba' });
    expect(r.eventos).toHaveLength(1);
  });
});

describe('cortesía y comprobante', () => {
  it('la línea gratis no sale en el comprobante y los montos siguen cuadrando con el total', () => {
    const lineas = [
      { nombre: 'Frappe', cantidad: 2, precio_unit: 10, subtotal: 20, es_cortesia: false },
      { nombre: 'Waffle', cantidad: 1, precio_unit: 0, subtotal: 0, es_cortesia: true },
    ];
    const salen = lineasParaComprobante(lineas);
    expect(salen.map((l) => l.nombre)).toEqual(['Frappe']);
    const r = calcularComprobante({
      igvPct: 18,
      lineas: salen.map((l) => ({ nombre: l.nombre, cantidad: l.cantidad, subtotalCents: aCentimos(l.subtotal) })),
      envioCents: 0,
      descuentoCents: 0,
      totalCents: 2000,
    });
    expect(r.totalCents).toBe(2000);
  });
});
