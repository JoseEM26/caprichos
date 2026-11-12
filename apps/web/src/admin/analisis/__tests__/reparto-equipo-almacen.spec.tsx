import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RepartoTab } from '../reparto/RepartoTab';
import { EquipoTab } from '../equipo/EquipoTab';
import { AlmacenTab } from '../almacen/AlmacenTab';
import { PESTANAS_ANALISIS } from '../registro';
import { api } from '../../../comun/api';

vi.mock('../../../comun/socket', () => ({ useTiempoReal: vi.fn(), useEventos: vi.fn() }));

const filtros = { preset: 'hoy' as const, desde: '2026-11-11', hasta: '2026-11-11', modalidad: '', canal: '', turno: '' };

/** Responde por prefijo de ruta; un Error responde como fallo. */
function servidor(rutas: Record<string, unknown>) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    const clave = Object.keys(rutas).find((k) => url.startsWith(k));
    const r = clave ? rutas[clave] : undefined;
    if (r instanceof Error) throw r;
    return r as never;
  });
}

describe('registro', () => {
  it('Reparto, Equipo y Almacén están registrados con id único', () => {
    const ids = PESTANAS_ANALISIS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['reparto', 'equipo', 'almacen']));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* ---------------- Reparto ---------------- */
const zona = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  id,
  zona: nombre,
  activa: true,
  tarifa: 5,
  pedidos: 4,
  entregados: 3,
  minutosPromedio: 35,
  minutosMediana: 30,
  minutosP90: 50,
  metaMin: 40,
  semaforo: 'verde',
  porTurno: [0, 3, 1],
  ...extra,
});
const reparto = (extra: Record<string, unknown> = {}) => ({
  generadoEn: '2026-11-11T20:00:00Z',
  rango: { desde: '2026-11-11', hasta: '2026-11-11', dias: 1 },
  porPersonaVisible: true,
  truncado: false,
  limite: 5000,
  turnos: ['MANANA', 'TARDE', 'NOCHE'],
  totales: { pedidos: 6, sinZona: 1, entregas: 4 },
  zonas: [zona('1', 'Centro'), zona('2', 'Norte', { minutosPromedio: 70, semaforo: 'rojo', metaMin: 40 })],
  productividad: { repartidores: 1, entregas: 4, minutosPorEntrega: 18, horasTrabajadas: 2, entregasPorHora: 2, porPersona: [{ id: '7', nombre: 'Rep Uno', entregas: 4, minutosPorEntrega: 18, horasTrabajadas: 2, entregasPorHora: 2 }] },
  ...extra,
});
const rendir = (extra: Record<string, unknown> = {}) => ({
  generadoEn: '2026-11-11T20:00:00Z',
  ventanaDias: 92,
  porPersonaVisible: true,
  total: 85.5,
  repartidoresConSaldo: 1,
  pedidosPendientes: 3,
  desde: '2026-11-09T15:00:00Z',
  porPersona: [{ id: '7', nombre: 'Rep Uno', pendiente: 85.5, desde: '2026-11-09T15:00:00Z', pedidos: 3 }],
  ...extra,
});

describe('Pestaña Reparto', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('zonas con promedio y semáforo, calor por turno y KPIs', async () => {
    servidor({ '/admin/analisis/reparto/por-rendir': rendir(), '/admin/analisis/reparto?': reparto() });
    render(<RepartoTab filtros={filtros} esAdmin />);
    const zonas = await screen.findByRole('list', { name: /Minutos promedio de entrega de cada zona/ });
    expect(within(zonas).getByText('Centro')).toBeInTheDocument();
    expect(within(zonas).getByText('Prom. 1 h 10 min')).toBeInTheDocument();
    expect(within(zonas).getAllByText('Más lenta')).toHaveLength(1);
    expect(screen.getByRole('region', { name: /Pedidos delivery por zona y turno/ })).toBeInTheDocument();
    expect(screen.getByText('1 sin zona guardada')).toBeInTheDocument();
    expect(screen.getByText('Entregas por hora trabajada')).toBeInTheDocument();
  });

  it('tocar una zona abre su detalle inline (no un modal)', async () => {
    servidor({ '/admin/analisis/reparto/por-rendir': rendir(), '/admin/analisis/reparto?': reparto() });
    render(<RepartoTab filtros={filtros} esAdmin />);
    const zonas = await screen.findByRole('list', { name: /Minutos promedio de entrega de cada zona/ });
    fireEvent.click(within(zonas).getByRole('button', { name: /Norte/ }));
    const detalle = screen.getByRole('region', { name: /Detalle: Norte/ });
    expect(within(detalle).getByText(/Promesa máxima de la zona: 40 min/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(detalle).getByRole('button', { name: /Cerrar detalle/ }));
    expect(screen.queryByRole('region', { name: /Detalle: Norte/ })).toBeNull();
  });

  it('efectivo por rendir: monto, desde cuándo y por repartidor (admin)', async () => {
    servidor({ '/admin/analisis/reparto/por-rendir': rendir(), '/admin/analisis/reparto?': reparto() });
    render(<RepartoTab filtros={filtros} esAdmin />);
    expect(await screen.findByText('S/ 85.50')).toBeInTheDocument();
    expect(screen.getByText('09/11 10:00')).toBeInTheDocument(); // 15:00Z = 10:00 Lima
    expect(screen.getByRole('link', { name: /Liquidar a Rep Uno/ })).toHaveAttribute('href', '/admin/cierre');
  });

  it('el supervisor no ve nombres de repartidores ni su tabla', async () => {
    servidor({
      '/admin/analisis/reparto/por-rendir': rendir({ porPersonaVisible: false, porPersona: null }),
      '/admin/analisis/reparto?': reparto({ porPersonaVisible: false, productividad: { ...reparto().productividad, porPersona: null } }),
    });
    render(<RepartoTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findAllByText(/lo ve solo el Administrador/)).not.toHaveLength(0);
    expect(screen.queryByText('Rep Uno')).toBeNull();
    expect(screen.queryByRole('table', { name: /por repartidor/ })).toBeNull();
  });

  it('nada por rendir y sin pedidos: estados vacíos claros, sin ceros inventados', async () => {
    servidor({
      '/admin/analisis/reparto/por-rendir': rendir({ total: 0, desde: null, porPersona: null, repartidoresConSaldo: 0, pedidosPendientes: 0 }),
      '/admin/analisis/reparto?': reparto({ zonas: [], totales: { pedidos: 0, sinZona: 0, entregas: 0 }, productividad: { repartidores: 0, entregas: 0, minutosPorEntrega: null, horasTrabajadas: null, entregasPorHora: null, porPersona: [] } }),
    });
    render(<RepartoTab filtros={filtros} esAdmin />);
    expect(await screen.findByText('Todo liquidado')).toBeInTheDocument();
    expect(screen.getByText('No hubo pedidos delivery con zona en este período.')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay entregas con repartidor en este período.')).toBeInTheDocument();
    expect(screen.getByText('Falta asistencia marcada')).toBeInTheDocument();
  });

  it('error al calcular: mensaje y Reintentar vuelve a pedir', async () => {
    const get = servidor({ '/admin/analisis/reparto/por-rendir': rendir(), '/admin/analisis/reparto?': new Error('boom') });
    render(<RepartoTab filtros={filtros} esAdmin />);
    expect(await screen.findByText('No se pudo calcular el reparto')).toBeInTheDocument();
    const antes = get.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(antes));
  });

  it('los filtros canal y turno viajan al API', async () => {
    const get = servidor({ '/admin/analisis/reparto/por-rendir': rendir(), '/admin/analisis/reparto?': reparto() });
    render(<RepartoTab filtros={{ ...filtros, canal: 'WHATSAPP', turno: 'NOCHE' }} esAdmin />);
    await screen.findByText('Entregas por zona');
    const url = get.mock.calls.map(([u]) => String(u)).find((u) => u.startsWith('/admin/analisis/reparto?'))!;
    expect(url).toContain('canal=WHATSAPP');
    expect(url).toContain('turno=NOCHE');
  });
});

/* ---------------- Equipo ---------------- */
const lista = (items: unknown[] = [], total = items.length) => ({ total, antiguo: items.length ? '2026-11-10T15:00:00Z' : null, items });
const hueco = (id: number, codigo: string) => ({ id, codigo, canal: 'CAJA', modalidad: 'RECOGER', estado: 'LISTO', pagoEstado: 'PENDIENTE', total: 20, fecha: '2026-11-10T15:00:00Z' });
const huecos = (extra: Record<string, unknown> = {}) => ({
  generadoEn: '2026-11-11T20:00:00Z',
  limiteFilas: 50,
  sinCobrar: lista([hueco(1, 'CP-1')]),
  sinTerminar: lista([hueco(2, 'CP-2'), hueco(3, 'CP-3')]),
  entregadosSinCobrar: lista(),
  ...extra,
});
const grupo = (extra: Record<string, unknown> = {}) => ({ personas: 1, pedidos: 10, ticketPromedio: 42.5, minutosPromedio: 25, minutosMediana: 22, ...extra });
const equipo = (extra: Record<string, unknown> = {}) => ({
  generadoEn: '2026-11-11T20:00:00Z',
  rango: { desde: '2026-11-11', hasta: '2026-11-11', dias: 1 },
  porPersonaVisible: true,
  truncado: false,
  limite: 5000,
  asistencia: {
    porDia: [
      { fecha: '2026-11-10', programadas: 5, presentes: 5, tardanzas: 2, faltas: 0, minutosTarde: 25 },
      { fecha: '2026-11-11', programadas: 5, presentes: 4, tardanzas: 0, faltas: 1, minutosTarde: 0 },
    ],
    totales: { presentes: 9, tardanzas: 2, faltas: 1, puntualidadPct: 77.8, minutosTarde: 25 },
  },
  productividad: { mozos: grupo(), cajeros: grupo({ pedidos: 20 }) },
  personas: {
    asistencia: [{ id: '5', nombre: 'Ana Mozo', dias: 5, tardanzas: 2, minutosTarde: 25, faltas: 0 }],
    mozos: [{ id: '5', nombre: 'Ana Mozo', pedidos: 10, ticketPromedio: 42.5, minutosPromedio: 25 }],
    cajeros: [{ id: '6', nombre: 'Caro Caja', pedidos: 20, ticketPromedio: 30, minutosPromedio: 12 }],
  },
  ...extra,
});

describe('Pestaña Equipo', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('tablero de huecos: tres conteos y enlaces a la acción', async () => {
    servidor({ '/admin/analisis/equipo/huecos': huecos(), '/admin/analisis/equipo?': equipo() });
    render(<EquipoTab filtros={filtros} esAdmin />);
    expect(await screen.findByText('Pedidos sin cobrar')).toBeInTheDocument();
    expect(screen.getByText('Entregados sin cobrar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cobrar el pedido CP-1/ })).toHaveAttribute('href', '/admin/cierre');
    fireEvent.click(screen.getByText(/Pedidos sin terminar \(2\)/));
    expect(screen.getByRole('link', { name: /Abrir el pedido CP-2/ })).toHaveAttribute('href', '/admin/caja');
    expect(screen.getByText('Ninguno')).toBeInTheDocument();
  });

  it('sin huecos: mensaje de todo en orden', async () => {
    servidor({ '/admin/analisis/equipo/huecos': huecos({ sinCobrar: lista(), sinTerminar: lista() }), '/admin/analisis/equipo?': equipo() });
    render(<EquipoTab filtros={filtros} esAdmin />);
    expect(await screen.findByText(/No hay huecos/)).toBeInTheDocument();
  });

  it('puntualidad por día y KPIs; el admin ve el detalle por persona', async () => {
    servidor({ '/admin/analisis/equipo/huecos': huecos(), '/admin/analisis/equipo?': equipo() });
    render(<EquipoTab filtros={filtros} esAdmin />);
    const dias = await screen.findByRole('list', { name: /Tardanzas de cada día/ });
    expect(within(dias).getByText('2 tardanzas')).toBeInTheDocument();
    expect(screen.getByText('77,8 %')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Puntualidad por persona' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Mozos' })).toBeInTheDocument();
    expect(screen.getAllByText('Ana Mozo').length).toBeGreaterThan(0);
  });

  it('el supervisor ve solo agregados: ningún nombre ni tabla por persona', async () => {
    servidor({ '/admin/analisis/equipo/huecos': huecos(), '/admin/analisis/equipo?': equipo({ porPersonaVisible: false, personas: null }) });
    render(<EquipoTab filtros={filtros} esAdmin={false} />);
    await screen.findByRole('list', { name: /Tardanzas de cada día/ });
    expect(screen.queryByText('Ana Mozo')).toBeNull();
    expect(screen.queryByRole('table', { name: 'Puntualidad por persona' })).toBeNull();
    expect(screen.getAllByText(/lo ve solo el Administrador/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Ticket promedio', { selector: '.an-kpi__titulo' })).toHaveLength(2);
  });

  it('sin asistencia ni pedidos: estados vacíos y Sin dato', async () => {
    servidor({
      '/admin/analisis/equipo/huecos': huecos(),
      '/admin/analisis/equipo?': equipo({
        asistencia: { porDia: [], totales: { presentes: 0, tardanzas: 0, faltas: 0, puntualidadPct: null, minutosTarde: 0 } },
        productividad: { mozos: grupo({ pedidos: 0, personas: 0, ticketPromedio: null }), cajeros: grupo({ pedidos: 0, personas: 0, ticketPromedio: null }) },
      }),
    });
    render(<EquipoTab filtros={filtros} esAdmin />);
    expect(await screen.findByText('No hay asistencia ni horarios en este período.')).toBeInTheDocument();
    expect(screen.getByText('Ningún mozo registró pedidos en este período.')).toBeInTheDocument();
    expect(screen.getByText('No hubo cobros en este período.')).toBeInTheDocument();
  });

  it('error en el resumen: mensaje y Reintentar; el tablero de huecos sigue visible', async () => {
    servidor({ '/admin/analisis/equipo/huecos': huecos(), '/admin/analisis/equipo?': new Error('boom') });
    render(<EquipoTab filtros={filtros} esAdmin />);
    expect(await screen.findByText('No se pudo calcular el equipo')).toBeInTheDocument();
    expect(screen.getByText('Pedidos sin cobrar')).toBeInTheDocument();
  });

  it('las fechas viajan al API', async () => {
    const get = servidor({ '/admin/analisis/equipo/huecos': huecos(), '/admin/analisis/equipo?': equipo() });
    render(<EquipoTab filtros={{ ...filtros, desde: '2026-11-01', hasta: '2026-11-11' }} esAdmin />);
    await screen.findByText('Asistencia y puntualidad');
    const url = get.mock.calls.map(([u]) => String(u)).find((u) => u.startsWith('/admin/analisis/equipo?'))!;
    expect(url).toContain('desde=2026-11-01');
    expect(url).toContain('hasta=2026-11-11');
  });
});

/* ---------------- Almacén ---------------- */
const insumo = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  id,
  nombre,
  unidad: 'L',
  stock: 20,
  minimo: 10,
  consumoRango: 40,
  consumoDiario: 4,
  diasRestantes: 5,
  seAcabaEl: '2026-11-16',
  estado: 'PRONTO',
  bajoMinimo: false,
  ...extra,
});
const almacen = (extra: Record<string, unknown> = {}) => ({
  generadoEn: '2026-11-11T20:00:00Z',
  rango: { desde: '2026-11-02', hasta: '2026-11-11', dias: 10 },
  almacenActivo: true,
  umbralPocas: 5,
  insumos: {
    truncado: false,
    limite: 500,
    items: [
      insumo('1', 'Leche'),
      insumo('2', 'Canela', { stock: 0, estado: 'AGOTADO', diasRestantes: 0, seAcabaEl: null }),
      insumo('3', 'Vainilla', { consumoRango: 0, consumoDiario: null, diasRestantes: null, seAcabaEl: null, estado: 'SIN_CONSUMO' }),
    ],
  },
  mermas: {
    truncado: false,
    limite: 3000,
    registros: 4,
    costoTotal: 16,
    items: [
      { tipo: 'INSUMO', nombre: 'Leche', unidad: 'L', veces: 3, cantidad: 4, costo: 16, motivos: [{ motivo: 'se venció', veces: 2 }] },
      { tipo: 'PRODUCTO', nombre: 'Dona', unidad: null, veces: 1, cantidad: 3, costo: null, motivos: [{ motivo: 'se cayó', veces: 1 }] },
    ],
  },
  terminados: {
    truncado: false,
    limite: 200,
    items: [
      { id: '10', nombre: 'Dona', unidades: 3, vendidasRango: 20, ventaDiaria: 2, diasRestantes: 1.5, agotado: false, pocas: true },
      { id: '11', nombre: 'Galleta', unidades: 40, vendidasRango: 5, ventaDiaria: 0.5, diasRestantes: 80, agotado: false, pocas: false },
    ],
  },
  ...extra,
});

describe('Pestaña Almacén', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('insumos con días que duran y cuándo se acaban, sin consumo como tal', async () => {
    servidor({ '/admin/analisis/almacen': almacen() });
    render(<AlmacenTab filtros={filtros} esAdmin />);
    const barras = await screen.findByRole('list', { name: /Días que dura cada insumo/ });
    expect(within(barras).getByText('5 d · hasta el 16/11')).toBeInTheDocument();
    expect(within(barras).getAllByText('Agotado').length).toBeGreaterThan(0);
    expect(within(barras).getByText('Sin consumo')).toBeInTheDocument();
  });

  it('tocar un insumo abre su detalle inline', async () => {
    servidor({ '/admin/analisis/almacen': almacen() });
    render(<AlmacenTab filtros={filtros} esAdmin />);
    const barras = await screen.findByRole('list', { name: /Días que dura cada insumo/ });
    fireEvent.click(within(barras).getByRole('button', { name: /Leche/ }));
    const detalle = screen.getByRole('region', { name: /Detalle: Leche/ });
    expect(within(detalle).getByText(/Consumió 40 L en el período/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mermas con costo y motivo; productos sin costo muestran la cantidad', async () => {
    servidor({ '/admin/analisis/almacen': almacen() });
    render(<AlmacenTab filtros={filtros} esAdmin />);
    const m = await screen.findByRole('list', { name: /Mermas por insumo o producto/ });
    expect(within(m).getByText('S/ 16.00')).toBeInTheDocument();
    expect(within(m).getByText(/3 veces · se venció/)).toBeInTheDocument();
    expect(within(m).getByText('3')).toBeInTheDocument();
  });

  it('productos terminados con pocas unidades se destacan; los que tienen de sobra no', async () => {
    servidor({ '/admin/analisis/almacen': almacen() });
    render(<AlmacenTab filtros={filtros} esAdmin />);
    const t = await screen.findByRole('list', { name: /Unidades que quedan/ });
    expect(within(t).getByText('Dona')).toBeInTheDocument();
    expect(within(t).getByText('3 u.')).toBeInTheDocument();
    expect(within(t).queryByText('Galleta')).toBeNull();
  });

  it('Control de almacén apagado: aviso claro en vez de gráficos vacíos; los terminados siguen', async () => {
    servidor({ '/admin/analisis/almacen': almacen({ almacenActivo: false, insumos: null, mermas: { truncado: false, limite: 3000, registros: 0, costoTotal: null, items: [] } }) });
    render(<AlmacenTab filtros={filtros} esAdmin />);
    expect(await screen.findByRole('heading', { name: 'Control de almacén apagado' })).toBeInTheDocument();
    expect(screen.queryByText('Cuánto dura cada insumo')).toBeNull();
    expect(screen.getByText('Productos terminados con pocas unidades')).toBeInTheDocument();
  });

  it('sin mermas ni productos con conteo: estados vacíos', async () => {
    servidor({
      '/admin/analisis/almacen': almacen({
        insumos: { truncado: false, limite: 500, items: [] },
        mermas: { truncado: false, limite: 3000, registros: 0, costoTotal: null, items: [] },
        terminados: { truncado: false, limite: 200, items: [] },
      }),
    });
    render(<AlmacenTab filtros={filtros} esAdmin />);
    expect(await screen.findByText('No hay insumos activos.')).toBeInTheDocument();
    expect(screen.getByText('No se registró ninguna merma en este período.')).toBeInTheDocument();
    expect(screen.getByText('Ningún producto lleva conteo de unidades.')).toBeInTheDocument();
  });

  it('error: mensaje y Reintentar', async () => {
    const get = servidor({ '/admin/analisis/almacen': new Error('boom') });
    render(<AlmacenTab filtros={filtros} esAdmin />);
    expect(await screen.findByText('No se pudo calcular el almacén')).toBeInTheDocument();
    const antes = get.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(antes));
  });
});
