import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { IndicadoresView } from '../IndicadoresView';
import { rangoDePreset } from '../FiltrosIndicadores';
import { api } from '../../../comun/api';
import { hoyLima, sumarDias } from '../../analisis/comun/fechas';

const Ubicacion = () => <div data-testid="busqueda">{useLocation().search}</div>;

const indicadores = {
  categoriasDisponibles: ['Frappes', 'Waffles'],
  metas: [{ n: 'Reclamos de delivery', meta: 'Meta: menos de 2 por semana', v: '1', w: '30%', bar: 'x', ok: true }],
  topActual: [],
  topHistorial: [],
  promocionesVendidas: [],
  productosDescontados: [],
};

const urls = (parte: string) => (api.get as any).mock.calls.map((c: any[]) => String(c[0])).filter((u: string) => u.includes(parte));

function montar(entrada = '/admin/indicadores') {
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <IndicadoresView />
      <Ubicacion />
    </MemoryRouter>,
  );
}

describe('Indicadores: filtros generales', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/informes/indicadores')) return indicadores as any;
      return { rango: {}, resumen: { enviadas: 0, respondidas: 0 }, distribucion: [], tendencia: [], porModalidad: [], items: [], total: 0, pagina: 1, limite: 8, totalPaginas: 0 } as any;
    });
  });

  it('por defecto pide Este mes a los indicadores y a las encuestas', async () => {
    montar();
    const { desde, hasta } = rangoDePreset('mes', hoyLima());
    await waitFor(() => expect(urls('/informes/indicadores').length).toBeGreaterThan(0));
    expect(urls('/informes/indicadores')[0]).toContain(`desde=${desde}&hasta=${hasta}`);
    await waitFor(() => expect(urls('/estadisticas/encuestas').length).toBeGreaterThan(0));
    expect(urls('/estadisticas/encuestas')[0]).toContain(`desde=${desde}`);
  });

  it('cambiar el periodo y el canal recarga todos los cuadros y queda en la dirección', async () => {
    montar();
    await screen.findByText('Reclamos de delivery');
    fireEvent.click(screen.getByRole('button', { name: 'Ayer' }));
    const ayer = sumarDias(hoyLima(), -1);
    await waitFor(() => expect(urls('/informes/indicadores').some((u) => u.includes(`desde=${ayer}&hasta=${ayer}`))).toBe(true));
    await waitFor(() => expect(urls('/estadisticas/encuestas').some((u) => u.includes(`desde=${ayer}`))).toBe(true));
    expect(screen.getByTestId('busqueda').textContent).toContain('periodo=ayer');

    fireEvent.change(screen.getByLabelText('Canal'), { target: { value: 'CARTA' } });
    await waitFor(() => expect(urls('/informes/indicadores').some((u) => u.includes('canal=CARTA'))).toBe(true));
    await waitFor(() => expect(urls('/estadisticas/encuestas').some((u) => u.includes('canal=CARTA'))).toBe(true));
    expect(screen.getByTestId('busqueda').textContent).toContain('canal=CARTA');
    // Reclamos no se filtra por canal: lo avisa en vez de ignorarlo
    expect((await screen.findAllByText(/No aplica el filtro de canal/)).length).toBeGreaterThan(0);
  });

  it('lee los filtros de la dirección y Limpiar filtros los quita', async () => {
    montar('/admin/indicadores?periodo=hoy&modalidad=DELIVERY&categoria=Waffles');
    const hoy = hoyLima();
    await waitFor(() => expect(urls('/informes/indicadores').some((u) => u.includes(`desde=${hoy}&hasta=${hoy}`) && u.includes('modalidad=DELIVERY') && u.includes('categoria=Waffles'))).toBe(true));
    expect(screen.getByLabelText('Tipo de pedido')).toHaveValue('DELIVERY');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(screen.getByTestId('busqueda').textContent).toBe(''));
    expect(screen.getByLabelText('Tipo de pedido')).toHaveValue('');
  });

  it('Personalizado muestra desde y hasta; un rango invertido avisa y no consulta', async () => {
    montar('/admin/indicadores?periodo=rango&desde=2026-11-10&hasta=2026-11-01');
    expect(await screen.findByRole('alert')).toHaveTextContent(/fecha inicial/i);
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(urls('/informes/indicadores')).toHaveLength(0);
  });

  it('muestra el error con reintento si falla la carga', async () => {
    (api.get as any).mockRejectedValue(new Error('caído'));
    montar();
    expect(await screen.findByText(/No pudimos cargar los indicadores/i)).toBeInTheDocument();
  });
});
