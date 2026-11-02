import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HistorialLaboral, lineaPeriodo } from '../HistorialLaboral';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() },
  ErrorApi: class extends Error {
    codigo = '';
  },
}));

const DATOS = {
  activo: true,
  enLicencia: false,
  tiempoTotal: '2 años 1 mes',
  vecesSalio: 1,
  periodos: [
    { id: '1', desde: '2024-07-02', hasta: '2025-03-15', abierto: false, duracion: '8 meses 13 días' },
    { id: '2', desde: '2025-06-20', hasta: null, abierto: true, duracion: '1 año 4 meses' },
  ],
};

describe('HistorialLaboral', () => {
  beforeEach(() => vi.clearAllMocks());

  it('formatea las líneas como en el historial: ingreso, salida o «Sigue», y duración', () => {
    expect(lineaPeriodo(DATOS.periodos[0], 0)).toBe('Ingresó 02/07/2024 · Salió 15/03/2025 · 8 meses 13 días');
    expect(lineaPeriodo(DATOS.periodos[1], 1)).toBe('Reingresó 20/06/2025 · Sigue · 1 año 4 meses');
  });

  it('muestra el tiempo total, las veces que salió y «En licencia» cuando corresponde', async () => {
    vi.mocked(api.get).mockResolvedValue({ ...DATOS, enLicencia: true });
    render(<HistorialLaboral usuarioId="5" esAdmin={false} />);
    expect(await screen.findByText('Tiempo total trabajado: 2 años 1 mes')).toBeInTheDocument();
    expect(screen.getByText('Veces que salió: 1')).toBeInTheDocument();
    expect(screen.getByText('En licencia')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Corregir/ })).not.toBeInTheDocument();
  });

  it('el ADMIN corrige un periodo: pide Sí/No antes de guardar y envía las fechas', async () => {
    vi.mocked(api.get).mockResolvedValue(DATOS);
    vi.mocked(api.patch).mockResolvedValue(DATOS);
    render(<HistorialLaboral usuarioId="5" esAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Corregir periodo 02/07/2024' }));
    fireEvent.change(screen.getByLabelText('Fecha de salida (vacío = sigue)'), { target: { value: '2025-03-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar fechas' }));
    expect(api.patch).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/usuarios/5/periodos/1', { desde: '2024-07-02', hasta: '2025-03-10' }),
    );
  });

  it('sin datos del servidor (respuesta que no es historial) no muestra nada', async () => {
    vi.mocked(api.get).mockResolvedValue([{ id: '7' }]);
    const { container } = render(<HistorialLaboral usuarioId="5" esAdmin={false} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
