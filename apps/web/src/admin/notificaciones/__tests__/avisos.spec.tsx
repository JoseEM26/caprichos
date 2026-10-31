import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AvisosEmergentes, DURACION_AVISO_MS, useTituloContador } from '../AvisosNotificaciones';
import { CampanaNotificaciones } from '../CampanaNotificaciones';
import { CADA_SONIDO_MS, hayQueSonar, reiniciarSonidoParaPruebas, useSonidoAvisos } from '../sonidoAviso';
import type { NotificacionAdmin } from '../../useNotificaciones';

const aviso = (over: Partial<NotificacionAdmin> & { clave: string; titulo: string }): NotificacionAdmin => ({
  id: over.clave,
  detalle: 'Detalle del aviso',
  prioridad: 'MEDIA',
  desde: new Date().toISOString(),
  modulo: 'caja',
  accion: 'Ir a Caja',
  leida: false,
  leidaEn: null,
  ...over,
});

/** Contexto de audio de mentira: cuenta osciladores para saber cuándo sonó */
function instalarAudioFalso(estado: 'running' | 'suspended') {
  const osciladores: unknown[] = [];
  class FakeAudioContext {
    state: 'running' | 'suspended' = estado;
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {
      this.state = 'running';
    });
    createOscillator = vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      osciladores.push(osc);
      return osc;
    });
    createGain = vi.fn(() => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }));
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  return { osciladores };
}

function quitarAudioFalso() {
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
}

describe('sonido de los avisos', () => {
  beforeEach(() => {
    reiniciarSonidoParaPruebas();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    quitarAudioFalso();
  });

  function Prueba({ notificaciones }: { notificaciones: NotificacionAdmin[] }) {
    const s = useSonidoAvisos(hayQueSonar(notificaciones));
    return <div>{s.bloqueado ? 'bloqueado' : 'libre'}</div>;
  }

  it('suena al momento y luego cada ~15 s mientras haya un aviso no leído de prioridad media o alta', async () => {
    const { osciladores } = instalarAudioFalso('running');
    const lista = [aviso({ clave: 'n:1', titulo: 'Pedido nuevo CP-W015', prioridad: 'ALTA' })];
    render(<Prueba notificaciones={lista} />);
    // un aviso sonoro son dos tonos
    expect(osciladores.length).toBe(2);

    await act(async () => {
      vi.advanceTimersByTime(CADA_SONIDO_MS);
    });
    expect(osciladores.length).toBe(4);

    await act(async () => {
      vi.advanceTimersByTime(CADA_SONIDO_MS);
    });
    expect(osciladores.length).toBe(6);
  });

  it('se detiene cuando todos los avisos quedan leídos', async () => {
    const { osciladores } = instalarAudioFalso('running');
    const { rerender } = render(<Prueba notificaciones={[aviso({ clave: 'n:1', titulo: 'Reserva nueva', prioridad: 'MEDIA' })]} />);
    expect(osciladores.length).toBe(2);

    rerender(<Prueba notificaciones={[aviso({ clave: 'n:1', titulo: 'Reserva nueva', prioridad: 'MEDIA', leida: true })]} />);
    await act(async () => {
      vi.advanceTimersByTime(CADA_SONIDO_MS * 3);
    });
    expect(osciladores.length).toBe(2);
  });

  it('los avisos de prioridad baja no hacen sonar', async () => {
    const { osciladores } = instalarAudioFalso('running');
    render(<Prueba notificaciones={[aviso({ clave: 'n:2', titulo: 'Consumo', prioridad: 'BAJA' })]} />);
    await act(async () => {
      vi.advanceTimersByTime(CADA_SONIDO_MS * 2);
    });
    expect(osciladores.length).toBe(0);
  });

  it('con el audio bloqueado muestra el estado bloqueado hasta el primer gesto del usuario', async () => {
    vi.useRealTimers();
    instalarAudioFalso('suspended');
    render(<Prueba notificaciones={[]} />);
    expect(screen.getByText('bloqueado')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'a' });
    });
    await waitFor(() => expect(screen.getByText('libre')).toBeInTheDocument());
  });
});

describe('aviso grande', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const conRuta = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

  it('aparece con un aviso nuevo, se cierra solo a los ~8 s y no muestra lo que ya estaba antes', async () => {
    const onMarcar = vi.fn(async () => true);
    const previas = [aviso({ clave: 'n:1', titulo: 'Ya estaba' })];
    const { rerender } = render(conRuta(<AvisosEmergentes notificaciones={previas} listo onMarcar={onMarcar} />));
    expect(screen.queryByText('Ya estaba')).not.toBeInTheDocument();

    rerender(conRuta(<AvisosEmergentes notificaciones={[...previas, aviso({ clave: 'n:2', titulo: 'Pedido nuevo CP-W015', prioridad: 'ALTA' })]} listo onMarcar={onMarcar} />));
    expect(screen.getByText('Pedido nuevo CP-W015')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(DURACION_AVISO_MS);
    });
    // se está yendo (animación) y luego desaparece
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.queryByText('Pedido nuevo CP-W015')).not.toBeInTheDocument();
    expect(onMarcar).not.toHaveBeenCalled();
  });

  it('con varios avisos los pone en cola: uno a la vez, ninguno se pierde', async () => {
    const onMarcar = vi.fn(async () => true);
    const { rerender } = render(conRuta(<AvisosEmergentes notificaciones={[]} listo onMarcar={onMarcar} />));
    rerender(
      conRuta(
        <AvisosEmergentes
          notificaciones={[aviso({ clave: 'n:1', titulo: 'Primero', prioridad: 'ALTA' }), aviso({ clave: 'n:2', titulo: 'Segundo' })]}
          listo
          onMarcar={onMarcar}
        />,
      ),
    );
    expect(screen.getByText('Primero')).toBeInTheDocument();
    expect(screen.queryByText('Segundo')).not.toBeInTheDocument();
    expect(screen.getByText('+1 más en cola')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByText('Segundo')).toBeInTheDocument();
  });

  it('Marcar leída lo marca para el usuario y lo quita en el acto', async () => {
    const onMarcar = vi.fn(async () => true);
    const { rerender } = render(conRuta(<AvisosEmergentes notificaciones={[]} listo onMarcar={onMarcar} />));
    rerender(conRuta(<AvisosEmergentes notificaciones={[aviso({ clave: 'n:7', titulo: 'Reserva nueva para 8 personas' })]} listo onMarcar={onMarcar} />));

    fireEvent.click(screen.getByRole('button', { name: 'Marcar leída' }));
    expect(onMarcar).toHaveBeenCalledWith('n:7', true);
    expect(screen.queryByText('Reserva nueva para 8 personas')).not.toBeInTheDocument();
  });

  it('con movimiento reducido no usa animación de salida', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (q: string) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList,
    );
    const onMarcar = vi.fn(async () => true);
    const { rerender } = render(conRuta(<AvisosEmergentes notificaciones={[]} listo onMarcar={onMarcar} />));
    rerender(conRuta(<AvisosEmergentes notificaciones={[aviso({ clave: 'n:3', titulo: 'Sin movimiento' })]} listo onMarcar={onMarcar} />));
    const tarjeta = screen.getByRole('status');
    expect(tarjeta.className).not.toContain('cp-aviso-entra');
    expect(tarjeta.style.transition).toBe('none');
    act(() => {
      vi.advanceTimersByTime(DURACION_AVISO_MS);
    });
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.queryByText('Sin movimiento')).not.toBeInTheDocument();
  });
});

describe('título de la pestaña y campanita', () => {
  afterEach(() => {
    document.title = '';
  });

  function Titulo({ total }: { total: number }) {
    useTituloContador(total);
    return null;
  }

  it('pone el contador delante del título mientras haya no leídas', () => {
    document.title = 'Panel de Caprichos';
    const { rerender } = render(<Titulo total={3} />);
    expect(document.title).toBe('(3) Panel de Caprichos');
    rerender(<Titulo total={0} />);
    expect(document.title).toBe('Panel de Caprichos');
  });

  it('la campanita muestra la insignia y las no leídas van antes que las leídas, con Leída / No leída', () => {
    const onMarcar = vi.fn(async () => true);
    const lista = [
      aviso({ clave: 'n:10', titulo: 'Atendida', prioridad: 'ALTA', leida: true, leidaEn: new Date().toISOString() }),
      aviso({ clave: 'n:11', titulo: 'Pedido nuevo CP-W016', prioridad: 'ALTA' }),
      aviso({ clave: 'n:12', titulo: 'Stock bajo', prioridad: 'MEDIA' }),
    ];
    // la lista llega ya ordenada desde el servidor: no leídas primero, leídas al final
    const ordenada = [lista[1], lista[2], lista[0]];
    render(
      <MemoryRouter>
        <CampanaNotificaciones
          notificaciones={ordenada}
          sonidoSoportado={false}
          sonidoBloqueado={false}
          onMarcar={onMarcar}
          onMarcarTodas={vi.fn(async () => {})}
          onActivarSonido={vi.fn()}
        />
      </MemoryRouter>,
    );

    const campana = screen.getByRole('button', { name: 'Notificaciones: 2 sin leer' });
    expect(campana).toHaveTextContent('2');
    fireEvent.click(campana);

    const panel = screen.getByRole('dialog', { name: 'Notificaciones' });
    const texto = panel.textContent ?? '';
    expect(texto.indexOf('Pedido nuevo CP-W016')).toBeLessThan(texto.indexOf('Stock bajo'));
    expect(texto.indexOf('Stock bajo')).toBeLessThan(texto.indexOf('Atendida'));

    expect(screen.getAllByRole('button', { name: 'Leída' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'No leída' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Marcar todas leídas' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Leída' })[0]);
    expect(onMarcar).toHaveBeenCalledWith('n:11', true);
  });
});
