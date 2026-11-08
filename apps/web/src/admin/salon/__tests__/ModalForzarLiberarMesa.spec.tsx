import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ModalForzarLiberarMesa } from '../componentes/ModalForzarLiberarMesa';
import { CuadriculaPlano } from '../componentes/CuadriculaPlano';
import { salonApi } from '../api';
import { instalarPointerEvent } from './PolyfillPointer';

vi.mock('../../../comun/api', () => ({
  api: { post: vi.fn().mockResolvedValue({ ok: true }) },
}));

instalarPointerEvent();

const mesa: any = {
  id: '5',
  pisoId: '1',
  tipo: 'MESA',
  numero: 1,
  nombre: 'Mesa 1',
  asientos: 4,
  x: 1,
  y: 1,
  ancho: 2,
  alto: 2,
  activo: true,
  estado: 'OCUPADA',
  pedido: { id: '50', codigo: 'P-0050', mozo: 'Ana', total: 45.5, estado: 'PREPARANDO', lineas: [] },
};

describe('ModalForzarLiberarMesa', () => {
  it('muestra la mesa, el pedido que la ocupa y la explicacion', () => {
    render(<ModalForzarLiberarMesa mesa={mesa} alCerrar={vi.fn()} alForzar={vi.fn()} />);

    expect(screen.getByText('Mesa 1')).toBeTruthy();
    expect(screen.getByText('Pedido P-0050')).toBeTruthy();
    expect(screen.getByText('Estado: PREPARANDO')).toBeTruthy();
    expect(screen.getByText('Total: S/ 45.50')).toBeTruthy();
    expect(screen.getByText('Libera solo la mesa; el pedido no se anula ni se cobra.')).toBeTruthy();
  });

  it('no pide motivo: el botón está activo desde el inicio', () => {
    render(<ModalForzarLiberarMesa mesa={mesa} alCerrar={vi.fn()} alForzar={vi.fn()} />);
    expect(screen.queryByLabelText(/Motivo/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Liberar mesa' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('pide confirmacion Si/No; No vuelve sin liberar; Si llama a alForzar', async () => {
    const alForzar = vi.fn().mockResolvedValue(undefined);
    const alCerrar = vi.fn();
    render(<ModalForzarLiberarMesa mesa={mesa} alCerrar={alCerrar} alForzar={alForzar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Liberar mesa' }));

    expect(screen.getByRole('dialog', { name: '¿Liberar la mesa?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'No, volver' }));
    expect(alForzar).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: '¿Liberar la mesa?' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Liberar mesa' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sí, liberar mesa' }));
    });

    expect(alForzar).toHaveBeenCalledWith('5');
    // El cierre lo decide el padre (alForzar) tras el exito
    expect(alCerrar).not.toHaveBeenCalled();
  });

  it('si la API falla muestra el error y no cierra', async () => {
    const alForzar = vi.fn().mockRejectedValue(new Error('Servidor caído'));
    const alCerrar = vi.fn();
    render(<ModalForzarLiberarMesa mesa={mesa} alCerrar={alCerrar} alForzar={alForzar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Liberar mesa' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sí, liberar mesa' }));
    });

    expect(screen.getByRole('alert').textContent).toContain('Servidor caído');
    expect(alCerrar).not.toHaveBeenCalled();
  });
});

describe('Plano de mesas: mantener 2 s una mesa ocupada', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const elementos: any[] = [
    { id: '5', tipo: 'MESA', nombre: 'Mesa 1', x: 1, y: 1, ancho: 2, alto: 2, activo: true, numero: 1, asientos: 4 },
  ];

  const pulsar = (el: HTMLElement) => {
    fireEvent.pointerDown(el, { button: 0, clientX: 10, clientY: 10 });
  };

  it('mantener 2 s una mesa ocupada llama a alMantenerMesaSalon (antes de 2 s, no)', () => {
    const alMantener = vi.fn();
    render(
      <CuadriculaPlano
        columnas={10}
        filas={10}
        elementos={elementos}
        modoSalon
        mesasSalon={[mesa]}
        onSeleccionarMesaSalon={vi.fn()}
        alMantenerMesaSalon={alMantener}
      />,
    );
    pulsar(screen.getByTestId('elemento-plano-5'));
    act(() => vi.advanceTimersByTime(1500));
    expect(alMantener).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(700));
    expect(alMantener).toHaveBeenCalledTimes(1);
    expect(alMantener.mock.calls[0][0].id).toBe('5');
  });

  it('sin alMantenerMesaSalon, mantener no hace nada (el gesto de 3 s ya no existe)', () => {
    render(
      <CuadriculaPlano columnas={10} filas={10} elementos={elementos} modoSalon mesasSalon={[mesa]} onSeleccionarMesaSalon={vi.fn()} />,
    );
    pulsar(screen.getByTestId('elemento-plano-5'));
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('una mesa libre no se puede forzar', () => {
    const alMantener = vi.fn();
    render(
      <CuadriculaPlano
        columnas={10}
        filas={10}
        elementos={elementos}
        modoSalon
        mesasSalon={[{ ...mesa, estado: 'LIBRE', pedido: null }]}
        onSeleccionarMesaSalon={vi.fn()}
        alMantenerMesaSalon={alMantener}
      />,
    );
    pulsar(screen.getByTestId('elemento-plano-5'));
    act(() => vi.advanceTimersByTime(4000));
    expect(alMantener).not.toHaveBeenCalled();
  });
});

describe('salonApi.liberarMesaManual', () => {
  it('manda forzar=true solo cuando se pide la liberacion forzada', async () => {
    const { api } = await import('../../../comun/api');
    const post = api.post as any;
    post.mockClear();

    await salonApi.liberarMesaManual('5', undefined, true);
    expect(post).toHaveBeenLastCalledWith('/admin/salon/mesas/5/liberar', { forzar: true });

    await salonApi.liberarMesaManual('5', 'Limpieza terminada');
    expect(post).toHaveBeenLastCalledWith('/admin/salon/mesas/5/liberar', { motivo: 'Limpieza terminada' });
  });
});
