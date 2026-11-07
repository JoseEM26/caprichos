import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalPorPasos } from '../ModalPorPasos';

function Caso({ alFinalizar = vi.fn(), alCerrar = vi.fn() }: { alFinalizar?: () => void; alCerrar?: () => void }) {
  const campo = { valor: '' };
  return (
    <ModalPorPasos
      titulo="Asistente"
      alCerrar={alCerrar}
      alFinalizar={alFinalizar}
      textoFinalizar="Listo"
      resumen={<p>resumen-final</p>}
      pasos={[
        { id: '1', titulo: 'Primero', contenido: <input aria-label="nombre" onChange={(e) => (campo.valor = e.target.value)} />, validar: () => (campo.valor ? null : 'Falta el nombre.') },
        { id: '2', titulo: 'Segundo', contenido: <p>contenido-2</p> },
      ]}
    />
  );
}

describe('ModalPorPasos', () => {
  it('no avanza si el paso no valida y muestra el progreso', () => {
    render(<Caso />);
    expect(screen.getByRole('dialog', { name: 'Asistente' })).toBeInTheDocument();
    expect(screen.getByText(/Paso 1 de 3 · Primero/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Falta el nombre.');
    expect(screen.getByText(/Paso 1 de 3/)).toBeInTheDocument();
  });

  it('recorre los pasos, muestra el resumen y finaliza', async () => {
    const fin = vi.fn();
    render(<Caso alFinalizar={fin} />);
    fireEvent.change(screen.getByLabelText('nombre'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('contenido-2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('resumen-final')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    await waitFor(() => expect(fin).toHaveBeenCalled());
  });

  it('Atrás vuelve y Cancelar/Esc cierran', () => {
    const cerrar = vi.fn();
    render(<Caso alCerrar={cerrar} />);
    fireEvent.change(screen.getByLabelText('nombre'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByText(/Paso 1 de 3/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(cerrar).toHaveBeenCalledTimes(2);
  });
});
