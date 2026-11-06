import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalConPestanas } from '../ModalConPestanas';

const pestanas = [
  { id: 'a', etiqueta: 'Uno', insignia: 3, contenido: <input aria-label="campo-a" /> },
  { id: 'b', etiqueta: 'Dos', contenido: <p>texto-b</p> },
  { id: 'c', etiqueta: 'Tres', contenido: <p>texto-c</p>, persistente: false },
];

describe('ModalConPestanas', () => {
  it('tiene roles de diálogo, tablist y tabpanel y muestra la insignia', () => {
    render(<ModalConPestanas titulo="Mi modal" pestanas={pestanas} alCerrar={() => {}} pie={<button>Aceptar</button>} />);
    expect(screen.getByRole('dialog', { name: 'Mi modal' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /Uno/ })).toHaveTextContent('3');
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeInTheDocument();
  });

  it('cambia con clic y con flechas, conserva el estado de las pestañas persistentes', () => {
    render(<ModalConPestanas titulo="M" pestanas={pestanas} alCerrar={() => {}} />);
    fireEvent.change(screen.getByLabelText('campo-a'), { target: { value: 'hola' } });
    fireEvent.keyDown(screen.getByRole('tab', { name: /Uno/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Dos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('texto-b')).toBeVisible();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Dos' }), { key: 'ArrowLeft' });
    expect((screen.getByLabelText('campo-a') as HTMLInputElement).value).toBe('hola');
    fireEvent.keyDown(screen.getByRole('tab', { name: /Uno/ }), { key: 'End' });
    expect(screen.getByText('texto-c')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Dos' }));
    expect(screen.queryByText('texto-c')).not.toBeInTheDocument(); // no persistente
  });

  it('Esc y la X cierran; bloquearCierre lo impide', () => {
    const cerrar = vi.fn();
    const { rerender } = render(<ModalConPestanas titulo="M" pestanas={pestanas} alCerrar={cerrar} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(cerrar).toHaveBeenCalledTimes(2);
    rerender(<ModalConPestanas titulo="M" pestanas={pestanas} alCerrar={cerrar} bloquearCierre />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(cerrar).toHaveBeenCalledTimes(2);
  });

  it('atrapa el foco con Tab y lo devuelve al cerrar', () => {
    const abre = document.createElement('button');
    document.body.appendChild(abre);
    abre.focus();
    const { unmount } = render(<ModalConPestanas titulo="M" pestanas={pestanas} alCerrar={() => {}} pie={<button>Último</button>} />);
    expect(screen.getByRole('tab', { name: /Uno/ })).toHaveFocus();
    const ultimo = screen.getByRole('button', { name: 'Último' });
    ultimo.focus();
    fireEvent.keyDown(ultimo, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    unmount();
    expect(abre).toHaveFocus();
    abre.remove();
  });
});
