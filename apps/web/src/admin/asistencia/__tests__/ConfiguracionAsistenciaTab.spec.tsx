import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../comun/mapa/MapaUbicacion', () => ({ MapaUbicacion: () => <div data-testid="mapa" /> }));
vi.mock('../../../comun/mapa/BuscadorDireccion', () => ({ BuscadorDireccion: () => null }));

const obtener = vi.fn();
const guardar = vi.fn();
vi.mock('../asistenciaApi', async (orig) => ({
  ...(await orig<any>()),
  obtenerConfigAsistencia: (...a: any[]) => obtener(...a),
  guardarConfigAsistencia: (...a: any[]) => guardar(...a),
  estadoEnlacePantalla: vi.fn(async () => ({ activo: false, generadoEn: null })),
}));
const feriados = vi.fn();
const editarFer = vi.fn();
vi.mock('../planillaApi', async (orig) => ({
  ...(await orig<any>()),
  listarFeriados: (...a: any[]) => feriados(...a),
  editarFeriado: (...a: any[]) => editarFer(...a),
}));

import { ConfiguracionAsistenciaTab } from '../ConfiguracionAsistenciaTab';

const cfg = {
  radioM: 10, toleranciaMin: 5, multiplicadorExtra: 1.25, netflixSemanal: 1.64, diasMesDefecto: 24, horasDiaDefecto: 9, retencionDias: 90,
  dobleMarcaMin: 3, solicitudDiasMax: 7, precisionMaxM: 25, localLat: -12.05, localLng: -77.04,
};

describe('ConfiguracionAsistenciaTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtener.mockResolvedValue({ ...cfg });
    guardar.mockImplementation(async (c: any) => c);
    feriados.mockResolvedValue([{ id: 1, fecha: '2026-12-25', nombre: 'Navidad', recargo: 2, activo: true }]);
  });

  it('una sola página con índice y secciones plegables, sin el campo antiguo de tardanza pagada', async () => {
    const { container } = render(<ConfiguracionAsistenciaTab onError={() => undefined} onOk={() => undefined} />);
    await screen.findByText('Penalidad por tardanza (%)');
    const indice = screen.getByRole('navigation', { name: 'Secciones de la configuración' });
    for (const t of ['Horario y tolerancia', 'Ubicación del local', 'Selfies y marcado', 'Pago y valor hora', 'Quién marca', 'Feriados', 'Pantalla del QR']) {
      expect(within(indice).getByRole('link', { name: t })).toBeInTheDocument();
    }
    expect(container.querySelectorAll('details.pl-seccion').length).toBeGreaterThanOrEqual(7);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(container.textContent).not.toMatch(/Tardanza pagada|50 ?%/);
  });

  it('guarda la penalidad por tardanza (100 por defecto) y rechaza valores fuera de 0 a 500', async () => {
    const onError = vi.fn();
    render(<ConfiguracionAsistenciaTab onError={onError} onOk={() => undefined} />);
    const campo = await screen.findByLabelText(/Penalidad por tardanza/);
    expect(campo).toHaveAttribute('placeholder', '100');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ tardanzaPenalidadPct: 100 })));
    expect(guardar.mock.calls[0][0].pagoTardanzaPct).toBeUndefined();

    fireEvent.change(campo, { target: { value: '150' } });
    expect(screen.getByTestId('ejemplo-penalidad')).toHaveTextContent('S/ 7.50');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    await waitFor(() => expect(guardar).toHaveBeenLastCalledWith(expect.objectContaining({ tardanzaPenalidadPct: 150 })));

    guardar.mockClear();
    fireEvent.change(campo, { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(guardar).not.toHaveBeenCalled();
    expect(onError).toHaveBeenLastCalledWith('La penalidad por tardanza va de 0 a 500 %.');
  });

  it('lee la penalidad ya guardada', async () => {
    obtener.mockResolvedValue({ ...cfg, tardanzaPenalidadPct: 0 });
    render(<ConfiguracionAsistenciaTab onError={() => undefined} onOk={() => undefined} />);
    expect(await screen.findByLabelText(/Penalidad por tardanza/)).toHaveValue(0);
  });

  it('Feriados vive aquí: abre la sección, lista los feriados y permite desactivar uno', async () => {
    editarFer.mockResolvedValue({});
    const { container } = render(<ConfiguracionAsistenciaTab onError={() => undefined} onOk={() => undefined} />);
    await screen.findByText('Penalidad por tardanza (%)');
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Feriados' }));
    expect((container.querySelector('#cfg-feriados') as HTMLDetailsElement).open).toBe(true);
    // el contenido pesado se monta al abrir el <details> (en el navegador lo dispara el evento toggle)
    fireEvent(container.querySelector('#cfg-feriados')!, new Event('toggle'));
    expect(await screen.findByText('Navidad')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Agregar feriado' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(editarFer).toHaveBeenCalledWith(1, { activo: false }));
  });
});
