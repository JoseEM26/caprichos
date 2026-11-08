import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { api } from '../../../comun/api';
import { HorarioTab } from '../HorarioTab';

const SEMANA = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
  dia_semana: d, dia: `D${d}`, abre: '14:00', cierra: '22:00', cerrado: false,
}));

function simular(estado: any) {
  return vi.spyOn(api, 'get').mockImplementation((async (ruta: string) => {
    if (ruta === '/carta/estado') {
      if (estado instanceof Error) throw estado;
      return estado;
    }
    return SEMANA;
  }) as any);
}

describe('HorarioTab: indicador «Ahora»', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a las 11:00 con apertura 14:00 muestra Cerrado y cuándo abre', async () => {
    simular({ abierta: false, texto: 'Abrimos hoy a las 14:00', abre: '14:00', cierra: '22:00' });
    render(<HorarioTab puedeEditar />);
    await waitFor(() =>
      expect(screen.getByTestId('horario-estado-ahora').textContent).toContain('Ahora: Cerrado · Abrimos hoy a las 14:00'),
    );
  });

  it('dentro del horario muestra Abierto hasta la hora de cierre', async () => {
    simular({ abierta: true, texto: 'Abierto', abre: '14:00', cierra: '22:00' });
    render(<HorarioTab puedeEditar />);
    await waitFor(() =>
      expect(screen.getByTestId('horario-estado-ahora').textContent).toContain('Ahora: Abierto hasta las 22:00'),
    );
  });

  it('si no se puede leer el estado, no dice Abierto', async () => {
    simular(new Error('red'));
    render(<HorarioTab puedeEditar />);
    await waitFor(() =>
      expect(screen.getByTestId('horario-estado-ahora').textContent).toContain('no se pudo verificar'),
    );
  });

  it('guarda los 7 días y vuelve a leer el estado', async () => {
    const get = simular({ abierta: false, texto: 'Abrimos hoy a las 14:00', abre: '14:00', cierra: '22:00' });
    const put = vi.spyOn(api, 'put').mockResolvedValue(SEMANA as any);
    render(<HorarioTab puedeEditar />);
    await waitFor(() => screen.getByLabelText(/Apertura D2/i));
    fireEvent.change(screen.getByLabelText(/Apertura D2/i), { target: { value: '15:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar horario/i }));
    const confirmar = await screen.findByRole('button', { name: /^(Sí|Si)/i });
    fireEvent.click(confirmar);
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect((put.mock.calls[0][1] as any[]).map((x) => x.dia_semana)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(get.mock.calls.filter((c) => c[0] === '/carta/estado').length).toBeGreaterThanOrEqual(2);
  });
});
