import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useSubidaArchivo } from '../useSubidaArchivo';
import { IndicadorSubida } from '../IndicadorSubida';

vi.mock('../api', () => ({
  ErrorApi: class extends Error {
    constructor(_codigo: string, mensaje: string) {
      super(mensaje);
    }
  },
}));
import { ErrorApi } from '../api';

/** Componente de prueba: una operación que el test resuelve o rechaza a mano. */
function Prueba({ operacion }: { operacion: () => Promise<unknown> }) {
  const subida = useSubidaArchivo<unknown>();
  return (
    <div>
      <button type="button" onClick={() => void subida.ejecutar(operacion)}>
        Subir
      </button>
      <IndicadorSubida estado={subida.estado} error={subida.error} onReintentar={subida.reintentar} />
    </div>
  );
}

describe('useSubidaArchivo + IndicadorSubida', () => {
  it('muestra «Subiendo imagen…» mientras viaja y «Foto guardada» solo cuando el servidor respondió', async () => {
    let resolver!: () => void;
    const operacion = vi.fn(() => new Promise<void>((r) => (resolver = r)));
    render(<Prueba operacion={operacion} />);

    fireEvent.click(screen.getByRole('button', { name: 'Subir' }));
    expect(await screen.findByText('Subiendo imagen…')).toBeTruthy();
    expect(screen.queryByText('Foto guardada')).toBeNull();

    await act(async () => resolver());
    expect(await screen.findByText('Foto guardada')).toBeTruthy();
    expect(screen.queryByText('Subiendo imagen…')).toBeNull();
  });

  it('no admite un segundo envío mientras la subida está en curso', async () => {
    let resolver!: () => void;
    const operacion = vi.fn(() => new Promise<void>((r) => (resolver = r)));
    render(<Prueba operacion={operacion} />);

    fireEvent.click(screen.getByRole('button', { name: 'Subir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subir' }));
    expect(operacion).toHaveBeenCalledTimes(1);

    await act(async () => resolver());
  });

  it('si falla, muestra el error con Reintentar y reintenta la misma operación', async () => {
    const operacion = vi
      .fn()
      .mockRejectedValueOnce(new ErrorApi('ERROR_RED', 'Se cortó la conexión'))
      .mockResolvedValueOnce(undefined);
    render(<Prueba operacion={operacion} />);

    fireEvent.click(screen.getByRole('button', { name: 'Subir' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Se cortó la conexión');
    expect(screen.queryByText('Foto guardada')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Foto guardada')).toBeTruthy();
    expect(operacion).toHaveBeenCalledTimes(2);
  });

  it('un error que no es de la API usa un mensaje claro', async () => {
    render(<Prueba operacion={() => Promise.reject(new Error('boom'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Subir' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/No se pudo subir la imagen/));
  });
});
