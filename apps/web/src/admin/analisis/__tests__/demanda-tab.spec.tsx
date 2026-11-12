import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DemandaTab } from '../demanda/DemandaTab';
import { api } from '../../../comun/api';

vi.mock('../../../comun/socket', () => ({ useTiempoReal: vi.fn(), useEventos: vi.fn() }));

const filtros = { preset: 'hoy' as const, desde: '2026-11-11', hasta: '2026-11-11', modalidad: '', canal: '', turno: '' };

const valores = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
valores[2][15] = 7;
valores[4][19] = 3;

const base = {
  generadoEn: '2026-11-11T20:00:00Z',
  rango: { desde: '2026-11-11', hasta: '2026-11-11', dias: 1 },
  truncado: false,
  limite: 5000,
  pedidos: { entran: 14, validos: 10 },
  mapa: { dias: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'], valores, pico: { dia: 'Miércoles', hora: 15, pedidos: 7 } },
  cumplimiento: { evaluados: 4, cumplieron: 3, porcentaje: 75, retrasoPromedioMin: 8, deliverySinPromesa: 2, otrasModalidadesSinDato: 5, sinDato: false },
  anulados: {
    n: 4,
    porcentaje: 28.6,
    rechazados: 1,
    minutos: { promedio: 6, mediana: 5 },
    motivos: [
      { motivo: 'Cliente se arrepintió', n: 3, porcentaje: 75 },
      { motivo: 'Sin motivo escrito', n: 1, porcentaje: 25 },
    ],
    etapas: [{ etapa: 'En preparación', n: 4, porcentaje: 100 }],
    quienes: [{ nombre: 'Ana Paz', n: 4 }],
  },
};

const vivo = {
  generadoEn: '2026-11-11T20:00:00Z',
  meta: 15,
  total: 3,
  areas: [
    { nombre: 'Cocina', enCola: 3, masAntiguaMin: 30, promedioMin: 20, meta: 15, semaforo: 'rojo' },
    { nombre: 'Barra', enCola: 0, masAntiguaMin: null, promedioMin: null, meta: 15, semaforo: 'sin_dato' },
  ],
};

function servidor(principal: unknown, enVivo: unknown = vivo) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url.startsWith('/admin/analisis/demanda/vivo')) return enVivo;
    if (principal instanceof Error) throw principal;
    return principal;
  });
}

describe('Pestaña Demanda', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('con datos: KPIs, mapa de calor con números, cumplimiento y anulados', async () => {
    const espia = servidor(base);
    render(<DemandaTab filtros={filtros} esAdmin={false} />);
    const mapa = await screen.findByRole('region', { name: /Pedidos por día de la semana y hora/ });
    expect(within(mapa).getByText('7')).toBeInTheDocument();
    expect(within(mapa).getByText('Miércoles')).toBeInTheDocument();
    expect(screen.getByText('Miércoles 15h')).toBeInTheDocument();
    expect(screen.getAllByText('75 %').length).toBeGreaterThan(0);
    expect(screen.getByText('3 de 4 delivery')).toBeInTheDocument();
    const motivos = screen.getByRole('list', { name: 'Motivos de anulación' });
    expect(within(motivos).getByText('Cliente se arrepintió')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /Etapa en que se anuló/ })).toBeInTheDocument();
    expect(String(espia.mock.calls.find((c) => !String(c[0]).includes('vivo'))?.[0])).toContain('desde=2026-11-11');
  });

  it('carga en vivo por área con semáforo; el área sin cola dice «Sin cola»', async () => {
    servidor(base);
    render(<DemandaTab filtros={filtros} esAdmin={false} />);
    const lista = await screen.findByRole('list', { name: 'Pedidos en cola por área de cocina' });
    expect(within(lista).getByText('3 pedidos')).toBeInTheDocument();
    expect(within(lista).getByText('Más antigua: 30 min')).toBeInTheDocument();
    expect(within(lista).getByText('Sin cola')).toBeInTheDocument();
    expect(within(lista).getByText('Pasada de la meta')).toBeInTheDocument();
  });

  it('«Quién anula» abre un detalle inline (no modal) y se cierra', async () => {
    servidor(base);
    render(<DemandaTab filtros={filtros} esAdmin={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Quién anula' }));
    const detalle = screen.getByRole('region', { name: 'Detalle: Quién anuló' });
    expect(within(detalle).getByText('Ana Paz')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(detalle).getByRole('button', { name: /Cerrar detalle/ }));
    expect(screen.queryByRole('region', { name: /Detalle: Quién/ })).toBeNull();
  });

  it('sin datos de cumplimiento dice «Sin dato» y explica por qué, no 0 %', async () => {
    servidor({ ...base, cumplimiento: { ...base.cumplimiento, evaluados: 0, cumplieron: 0, porcentaje: null, sinDato: true } });
    render(<DemandaTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText(/Solo el delivery guarda un tiempo prometido|solo el delivery guarda un tiempo prometido/i)).toBeInTheDocument();
    expect(screen.getByText('Aún no hay delivery con tiempo prometido')).toBeInTheDocument();
    expect(screen.queryByText('0 %')).toBeNull();
  });

  it('vacío: sin pedidos ni anulados muestra mensajes y no revienta', async () => {
    servidor({
      ...base,
      pedidos: { entran: 0, validos: 0 },
      mapa: { ...base.mapa, valores: Array.from({ length: 7 }, () => Array<number>(24).fill(0)), pico: null },
      anulados: { ...base.anulados, n: 0, porcentaje: null, rechazados: 0, motivos: [], etapas: [], quienes: [] },
    });
    render(<DemandaTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText('No hubo pedidos en este período.')).toBeInTheDocument();
    expect(screen.getByText('No hubo pedidos anulados en este período.')).toBeInTheDocument();
  });

  it('error: muestra el mensaje con Reintentar', async () => {
    servidor(new Error('Fallo del servidor'));
    render(<DemandaTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText('No se pudo calcular la demanda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });

  it('avisa cuando se leyeron solo los pedidos más recientes', async () => {
    servidor({ ...base, truncado: true });
    render(<DemandaTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText(/más de 5000 pedidos/)).toBeInTheDocument();
  });

  it('los filtros viajan en la consulta', async () => {
    const espia = servidor(base);
    render(<DemandaTab filtros={{ ...filtros, modalidad: 'DELIVERY', canal: 'CARTA', turno: 'NOCHE' }} esAdmin={false} />);
    await screen.findByText('Cuándo piden');
    const url = String(espia.mock.calls.find((c) => !String(c[0]).includes('vivo'))?.[0]);
    expect(url).toContain('modalidad=DELIVERY');
    expect(url).toContain('canal=CARTA');
    expect(url).toContain('turno=NOCHE');
  });
});
