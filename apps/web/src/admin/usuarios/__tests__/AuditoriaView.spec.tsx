import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AuditoriaView } from '../AuditoriaView';
import * as sesionModulo from '../../../comun/sesion';
import * as apiModulo from '../../../comun/api';

const respuesta = (pagina = 1) => ({
  total: 45,
  pagina,
  limite: 20,
  paginas: 3,
  datos: [],
  conteos: { categoria: { CAMBIO: 30, ACCESO: 10, LECTURA_SENSIBLE: 5 }, resultado: { OK: 40, RECHAZADO: 5 } },
});

describe('AuditoriaView filtros al servidor', () => {
  let get: ReturnType<typeof vi.fn>;
  const ultima = () => new URLSearchParams(String(get.mock.calls.at(-1)![0]).split('?')[1]);
  const irPagina2 = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /página siguiente/i }));
    await waitFor(() => expect(ultima().get('pagina')).toBe('2'));
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: () => true } as any);
    get = vi.fn().mockImplementation(async (url: string) => respuesta(Number(new URLSearchParams(url.split('?')[1]).get('pagina'))));
    vi.spyOn(apiModulo.api, 'get').mockImplementation(get as any);
  });

  async function elegir(combo: RegExp, opcion: RegExp) {
    fireEvent.click(screen.getByRole('button', { name: combo }));
    fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: opcion }));
  }

  it('Tipo, Resultado y Fecha llegan al servidor y reinician la página; conteos reales', async () => {
    render(<AuditoriaView />);
    await waitFor(() => expect(get).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole('button', { name: /^Tipo/ }));
    expect(within(await screen.findByRole('listbox')).getByRole('option', { name: /Cambios/ })).toHaveTextContent('30');
    fireEvent.click(screen.getByRole('button', { name: /^Tipo/ }));

    await irPagina2();
    await elegir(/^Tipo/, /Lecturas sensibles/);
    await waitFor(() => expect(ultima().get('categoria')).toBe('LECTURA_SENSIBLE'));
    expect(ultima().get('pagina')).toBe('1');

    await irPagina2();
    await elegir(/^Resultado/, /Rechazados/);
    await waitFor(() => expect(ultima().get('resultado')).toBe('RECHAZADO'));
    expect(ultima().get('pagina')).toBe('1');

    await irPagina2();
    await elegir(/^Fecha/, /Hoy/);
    await waitFor(() => expect(ultima().get('desde')).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    expect(ultima().get('desde')).toBe(ultima().get('hasta'));
    expect(ultima().get('pagina')).toBe('1');
  });

  it('Desde, Hasta y búsqueda (con debounce) llegan al servidor', async () => {
    const { container } = render(<AuditoriaView />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    const fechas = container.querySelectorAll('input[type="date"]');
    fireEvent.change(fechas[0], { target: { value: '2026-10-05' } });
    await waitFor(() => expect(ultima().get('desde')).toBe('2026-10-05'));
    fireEvent.change(fechas[1], { target: { value: '2026-10-06' } });
    await waitFor(() => expect(ultima().get('hasta')).toBe('2026-10-06'));
    fireEvent.change(screen.getByLabelText(/buscar en el historial/i), { target: { value: 'anular' } });
    await waitFor(() => expect(ultima().get('busqueda')).toBe('anular'));
    expect(ultima().get('pagina')).toBe('1');
  });
});
