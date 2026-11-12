import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { VentasTab } from '../ventas/VentasTab';
import { api } from '../../../comun/api';

vi.mock('../../../comun/socket', () => ({ useTiempoReal: vi.fn(), useEventos: vi.fn() }));

const filtros = { preset: '7d' as const, desde: '2026-11-05', hasta: '2026-11-11', modalidad: '', canal: '', turno: '' };

const prod = (nombre: string, unidades: number, monto: number | null, extra: Record<string, unknown> = {}) => ({ nombre, categoria: 'Postres', unidades, monto, pedidos: unidades, combo: false, ...extra });

const base = {
  generadoEn: '2026-11-11T20:00:00Z',
  rango: { desde: '2026-11-05', hasta: '2026-11-11', dias: 7 },
  truncado: false,
  limite: 5000,
  conDinero: true,
  pedidos: 20,
  ventas: { monto: 800, ticket: 40, envio: 30, descuento: 25, propinaAparte: 12 },
  porCanal: [
    { id: 'CAJA', pedidos: 12, monto: 400, ticket: 33.33, porcentaje: 50 },
    { id: 'CARTA', pedidos: 8, monto: 400, ticket: 50, porcentaje: 50 },
  ],
  porModalidad: [{ id: 'DELIVERY', pedidos: 8, monto: 400, ticket: 50, porcentaje: 50 }],
  porTurno: [{ id: 'TARDE', pedidos: 20, monto: 800, ticket: 40, porcentaje: 100 }],
  evolucion: {
    granularidad: 'dia',
    unidad: 'soles',
    periodos: ['2026-11-10', '2026-11-11'],
    canales: [{ id: 'CAJA', valores: [150, 250] }],
    medios: [{ id: 'YAPE', valores: [100, 200] }],
  },
  productos: {
    masVendidos: [prod('Torta', 9, 270), prod('Frappe', 5, 100)],
    menosVendidos: [prod('Galleta', 1, 4), prod('Café', 2, 10)],
    masMonto: [prod('Combo Dúo', 3, 300, { combo: true }), prod('Torta', 9, 270)],
    categorias: [{ nombre: 'Postres', unidades: 15, monto: 374 }],
    distintos: 4,
  },
  medios: {
    filas: [
      { id: 'YAPE', pagos: 10, monto: 300, porcentaje: 75 },
      { id: 'EFECTIVO', pagos: 5, monto: 100, porcentaje: 25 },
    ],
    pedidosSinCobro: 2,
  },
  ofertas: {
    pedidosConCombo: 3,
    aporteCombos: 120,
    porcentajeAporte: 15,
    combos: [{ nombre: 'Combo Dúo', unidades: 3, monto: 300, pedidos: 3 }],
    pedidosConDescuento: 4,
    descuentos: [{ tipo: 'CUPON', nombre: 'BIENVENIDA', pedidos: 4, monto: 25 }],
  },
};

const sinDinero = {
  ...base,
  conDinero: false,
  ventas: { monto: null, ticket: null, envio: null, descuento: null, propinaAparte: null },
  porCanal: base.porCanal.map((f) => ({ ...f, monto: null, ticket: null })),
  porModalidad: base.porModalidad.map((f) => ({ ...f, monto: null, ticket: null })),
  porTurno: base.porTurno.map((f) => ({ ...f, monto: null, ticket: null })),
  evolucion: { ...base.evolucion, unidad: 'pedidos' },
  productos: { ...base.productos, masMonto: [], masVendidos: base.productos.masVendidos.map((p) => ({ ...p, monto: null })), menosVendidos: base.productos.menosVendidos.map((p) => ({ ...p, monto: null })) },
  medios: { ...base.medios, filas: base.medios.filas.map((f) => ({ ...f, monto: null })) },
  ofertas: { ...base.ofertas, aporteCombos: null, combos: base.ofertas.combos.map((c) => ({ ...c, monto: null })), descuentos: base.ofertas.descuentos.map((x) => ({ ...x, monto: null })) },
};

const servidor = (r: unknown) =>
  vi.spyOn(api, 'get').mockImplementation(async () => {
    if (r instanceof Error) throw r;
    return r;
  });

describe('Pestaña Ventas', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('ADMIN: KPIs en soles, ranking de más vendidos y cambio a menos vendidos y por monto', async () => {
    servidor(base);
    render(<VentasTab filtros={filtros} esAdmin />);
    const mas = await screen.findByRole('list', { name: 'Productos más vendidos por unidades' });
    expect(within(mas).getByText('Torta')).toBeInTheDocument();
    expect([...document.querySelectorAll('.an-kpi__titulo')].map((e) => e.textContent)).toContain('Ticket promedio');
    fireEvent.click(screen.getByRole('button', { name: 'Menos vendidos' }));
    const menos = screen.getByRole('list', { name: 'Productos menos vendidos por unidades' });
    expect(within(menos).getAllByRole('listitem')[0]).toHaveTextContent('Galleta');
    fireEvent.click(screen.getByRole('button', { name: 'Por monto' }));
    const monto = screen.getByRole('list', { name: 'Productos por monto vendido' });
    expect(within(monto).getByText('Combo Dúo')).toBeInTheDocument();
    expect(within(monto).getByText(/combo/)).toBeInTheDocument();
  });

  it('canal, modalidad, turno, ofertas y medios con sus números escritos', async () => {
    servidor(base);
    render(<VentasTab filtros={filtros} esAdmin />);
    const canal = await screen.findByRole('list', { name: 'Ventas por canal' });
    expect(within(canal).getByText('Caja')).toBeInTheDocument();
    expect(within(canal).getByText(/Ticket promedio .*33.*12 pedidos/)).toBeInTheDocument();
    expect(within(canal).getByText('Ticket más alto')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Ventas por turno' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Combos vendidos' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /Descuentos dados/ })).toBeInTheDocument();
    expect(screen.getByText(/canibalización/)).toBeInTheDocument();
    const medios = screen.getByRole('list', { name: 'Proporción por medio de pago' });
    expect(within(medios).getByText('Yape')).toBeInTheDocument();
    expect(within(medios).getByText(/75 %/)).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: /Canales por día|Medios de pago por día/ }).length).toBe(2);
  });

  it('SUPERVISOR: sin soles en ninguna parte, con pedidos y unidades', async () => {
    servidor(sinDinero);
    const { container } = render(<VentasTab filtros={filtros} esAdmin={false} />);
    await screen.findByRole('list', { name: 'Productos más vendidos por unidades' });
    expect(screen.getByRole('note')).toHaveTextContent(/solo los ve el administrador/);
    expect([...container.querySelectorAll('.an-kpi__titulo')].map((e) => e.textContent)).not.toContain('Ticket promedio');
    expect(screen.queryByRole('button', { name: 'Por monto' })).toBeNull();
    expect(container.textContent).not.toMatch(/S\/\s?\d/);
    expect(screen.getByText('Pedidos por canal')).toBeInTheDocument();
  });

  it('vacío: sin ventas en el período', async () => {
    servidor({
      ...base,
      pedidos: 0,
      ventas: { monto: 0, ticket: null, envio: 0, descuento: 0, propinaAparte: 0 },
      porCanal: [],
      porModalidad: [],
      porTurno: [],
      evolucion: { ...base.evolucion, periodos: [], canales: [], medios: [] },
      productos: { masVendidos: [], menosVendidos: [], masMonto: [], categorias: [], distintos: 0 },
      medios: { filas: [], pedidosSinCobro: 0 },
      ofertas: { ...base.ofertas, pedidosConCombo: 0, aporteCombos: 0, porcentajeAporte: null, combos: [], descuentos: [], pedidosConDescuento: 0 },
    });
    render(<VentasTab filtros={filtros} esAdmin />);
    expect(await screen.findByText('No hubo combos ni descuentos en este período.')).toBeInTheDocument();
    expect(screen.getByText('Aún no hay cobros en este período.')).toBeInTheDocument();
    expect(screen.getAllByText('Sin ventas en este período.').length).toBeGreaterThan(0);
  });

  it('error con Reintentar y aviso de truncado', async () => {
    servidor(new Error('Fallo'));
    const { unmount } = render(<VentasTab filtros={filtros} esAdmin />);
    expect(await screen.findByText('No se pudieron calcular las ventas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();
    servidor({ ...base, truncado: true });
    render(<VentasTab filtros={filtros} esAdmin />);
    expect(await screen.findByText(/más de 5000 pedidos/)).toBeInTheDocument();
  });

  it('los filtros viajan en la consulta', async () => {
    const espia = servidor(base);
    render(<VentasTab filtros={{ ...filtros, canal: 'MOZO', turno: 'NOCHE', modalidad: 'MESA' }} esAdmin />);
    await screen.findByText('Productos');
    const url = String(espia.mock.calls[0][0]);
    expect(url).toContain('/admin/analisis/ventas?');
    expect(url).toContain('canal=MOZO');
    expect(url).toContain('turno=NOCHE');
    expect(url).toContain('modalidad=MESA');
  });
});
