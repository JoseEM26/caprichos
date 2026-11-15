import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AnalisisView } from '../AnalisisView';
import * as sesionModulo from '../../../comun/sesion';
import { api } from '../../../comun/api';

vi.mock('../../../comun/socket', () => ({ useTiempoReal: vi.fn(), useEventos: vi.fn() }));

const ventasBase: any = {
  generadoEn: '2026-11-11T20:00:00Z', rango: { desde: '2026-11-05', hasta: '2026-11-11', dias: 7 }, truncado: false, limite: 5000, conDinero: true,
  ventas: { monto: 800, ticket: 40, envio: 30, descuento: 25, propinaAparte: 12 },
  porCanal: [], porModalidad: [], porTurno: [],
  evolucion: { granularidad: 'dia', unidad: 'soles', periodos: [], canales: [], medios: [] },
  productos: { masVendidos: [], menosVendidos: [], masMonto: [], categorias: [], distintos: 0 },
  medios: { filas: [], pedidosSinCobro: 0 },
  ofertas: { pedidosConCombo: 0, aporteCombos: 0, porcentajeAporte: 0, combos: [], pedidosConDescuento: 0, descuentos: [] },
};

const Url = () => {
  const l = useLocation();
  return <output data-testid="url">{l.pathname + l.search}</output>;
};

describe('Análisis: los filtros cambian URL, chips y consulta (montado como en la app)', () => {
  let get: any;
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '7', nombres: 'A', rol: 'ADMIN', roles: ['ADMIN'] },
      permisos: [],
      tiene: () => true,
    } as any);
    get = vi.spyOn(api, 'get').mockImplementation(() => new Promise(() => {}) as any);
  });
  const urls = () => get.mock.calls.map(([u]: unknown[]) => String(u));

  for (const pestana of ['tiempos', 'ventas', 'productos', 'demanda']) {
    it(`pestaña ${pestana}: Ayer, Canal y Elegir fechas`, async () => {
      window.history.replaceState(null, '', `/admin/analisis?pestana=${pestana}`);
    render(
        <BrowserRouter>
          <Routes>
            <Route path="/admin/analisis" element={<AnalisisView />} />
          </Routes>
          <Url />
        </BrowserRouter>,
      );
      await waitFor(() => expect(urls().some((u: string) => u.includes(`/analisis/${pestana}?`))).toBe(true));
      get.mock.calls.length = 0;
      fireEvent.click(screen.getByRole('button', { name: 'Ayer' }));
      expect(screen.getByTestId('url').textContent).toContain('periodo=ayer');
      expect(screen.getByRole('button', { name: 'Ayer' })).toHaveAttribute('aria-pressed', 'true');
      await waitFor(() => expect(urls().length).toBeGreaterThan(0));
      const m = /desde=([\d-]+)&hasta=([\d-]+)/.exec(urls().at(-1)!)!;
      expect(m[1]).toBe(m[2]);

      const canal = screen.queryByLabelText('Canal');
      if (canal) {
        get.mock.calls.length = 0;
        fireEvent.change(canal, { target: { value: 'CAJA' } });
        expect(screen.getByTestId('url').textContent).toContain('canal=CAJA');
        await waitFor(() => expect(urls().some((u: string) => u.includes('canal=CAJA'))).toBe(true));
      }

      get.mock.calls.length = 0;
      fireEvent.click(screen.getByRole('button', { name: 'Elegir fechas' }));
      fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-02' } });
      fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01-05' } });
      expect(screen.getByTestId('url').textContent).toContain('desde=2026-01-02');
      await waitFor(() => expect(urls().some((u: string) => u.includes('desde=2026-01-02&hasta=2026-01-05'))).toBe(true));
    });
  }

  it('Ventas con datos: cambiar Canal y período cambia lo que se ve (también desde otra sección)', async () => {
    const r = (pedidos: number) => ({ ...ventasBase, pedidos });
    get.mockRestore();
    get = vi.spyOn(api, 'get').mockImplementation(async (u: string) => (u.includes('canal=CAJA') ? r(3) : u.includes('desde=2026-01-02') ? r(5) : r(20)) as any);
    window.history.replaceState(null, '', '/admin/analisis?pestana=ventas');
    render(
      <BrowserRouter>
        <Routes>
          <Route path="/admin/analisis" element={<AnalisisView />} />
        </Routes>
      </BrowserRouter>,
    );
    expect(await screen.findByText('20')).toBeInTheDocument();
    const chips = screen.getAllByRole('button', { name: /Medios|Ofertas|Evolución/i });
    if (chips[0]) fireEvent.click(chips[0]);
    fireEvent.change(screen.getByLabelText('Canal'), { target: { value: 'CAJA' } });
    expect(await screen.findByText('3')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Canal'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Elegir fechas' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-02' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01-05' } });
    expect(await screen.findByText('5')).toBeInTheDocument();
  });

  it('al cambiar un filtro no se queda el dato del filtro anterior: muestra «Calculando» y, si el servidor falla, el error', async () => {
    let resolver: (v: unknown) => void = () => {};
    get.mockRestore();
    get = vi.spyOn(api, 'get').mockImplementation((u: string) => {
      if (u.includes('canal=CAJA')) return new Promise((r) => (resolver = r)) as any;
      if (u.includes('canal=BOT')) return Promise.reject(new Error('Falló el servidor')) as any;
      return Promise.resolve({ ...ventasBase, pedidos: 20 }) as any;
    });
    window.history.replaceState(null, '', '/admin/analisis?pestana=ventas');
    render(
      <BrowserRouter>
        <Routes>
          <Route path="/admin/analisis" element={<AnalisisView />} />
        </Routes>
      </BrowserRouter>,
    );
    expect(await screen.findByText('20')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Canal'), { target: { value: 'CAJA' } });
    expect(await screen.findByText(/Calculando las ventas/)).toBeInTheDocument();
    expect(screen.queryByText('20')).not.toBeInTheDocument();
    resolver({ ...ventasBase, pedidos: 3 });
    expect(await screen.findByText('3')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Canal'), { target: { value: 'BOT' } });
    expect(await screen.findByText(/No se pudieron calcular las ventas/)).toBeInTheDocument();
  });
});
