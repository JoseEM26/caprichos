import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampanaNotificaciones } from '../CampanaNotificaciones';
import { useHorarioSonido } from '../useHorarioSonido';
import { hayQueSonar } from '../sonidoAviso';

const get = vi.fn();
vi.mock('../../../comun/api', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

const aviso = { id: '1', clave: 'n:1', titulo: 'Aviso', detalle: '', prioridad: 'ALTA', desde: null, modulo: 'caja', accion: 'Ir', leida: false, leidaEn: null } as never;

/** Mismo cableado que AdminShell: suena solo si el servidor dice que toca y hay avisos. */
function Prueba({ onSuena }: { onSuena: (v: boolean) => void }) {
  const h = useHorarioSonido();
  onSuena(h.suenaAhora && hayQueSonar([aviso]));
  return (
    <MemoryRouter>
      <CampanaNotificaciones
        notificaciones={[aviso]}
        sonidoSoportado={false}
        sonidoBloqueado={false}
        onMarcar={async () => true}
        onMarcarTodas={async () => {}}
        onActivarSonido={() => {}}
        textoSonidoPausa={h.suenaAhora ? null : h.texto}
      />
    </MemoryRouter>
  );
}

describe('sonido según horario de trabajo', () => {
  beforeEach(() => get.mockReset());

  it('fuera de horario: no suena y muestra el texto, la campanita sigue con su aviso', async () => {
    get.mockResolvedValue({ suenaAhora: false, texto: 'Sonido en pausa: fuera de tu horario (13:30–22:30)' });
    const suena = vi.fn();
    render(<Prueba onSuena={suena} />);
    await waitFor(() => expect(suena).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(await screen.findByText('Sonido en pausa: fuera de tu horario (13:30–22:30)')).toBeTruthy();
    expect(screen.getByText('Aviso')).toBeTruthy();
  });

  it('dentro de horario o sin horario: suena y no muestra texto', async () => {
    get.mockResolvedValue({ suenaAhora: true, texto: null });
    const suena = vi.fn();
    render(<Prueba onSuena={suena} />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(suena).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.queryByText(/Sonido en pausa/)).toBeNull();
  });
});
