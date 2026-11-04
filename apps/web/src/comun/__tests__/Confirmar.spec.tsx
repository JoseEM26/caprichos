import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Confirmar } from '../Confirmar';

describe('Confirmar', () => {
  it('se monta en document.body (portal), fijo sobre la ventana, con rol dialog y aria-modal', () => {
    const { container } = render(
      <div style={{ overflow: 'auto', height: 100 }}>
        <Confirmar abierto titulo="¿Guardar?" alConfirmar={vi.fn()} alCancelar={vi.fn()} />
      </div>,
    );
    const dialogo = screen.getByRole('dialog', { name: '¿Guardar?' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(container.contains(dialogo)).toBe(false);
    expect(document.body.contains(dialogo)).toBe(true);
    const capa = dialogo.parentElement as HTMLElement;
    expect(capa.parentElement).toBe(document.body);
    expect(capa.style.position).toBe('fixed');
    expect(capa.style.zIndex).toBe('5000');
  });

  it('no se renderiza cuando abierto es false', () => {
    render(<Confirmar abierto={false} alConfirmar={vi.fn()} alCancelar={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('enfoca el botón principal al abrir', () => {
    render(<Confirmar abierto textoSi="Sí, guardar" alConfirmar={vi.fn()} alCancelar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Sí, guardar' })).toHaveFocus();
  });

  it('Esc cancela, salvo mientras carga', () => {
    const alCancelar = vi.fn();
    const { rerender } = render(<Confirmar abierto alConfirmar={vi.fn()} alCancelar={alCancelar} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(alCancelar).toHaveBeenCalledTimes(1);

    rerender(<Confirmar abierto cargando alConfirmar={vi.fn()} alCancelar={alCancelar} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(alCancelar).toHaveBeenCalledTimes(1);
  });

  it('el botón Sí llama a alConfirmar y el No a alCancelar', () => {
    const alConfirmar = vi.fn();
    const alCancelar = vi.fn();
    render(<Confirmar abierto alConfirmar={alConfirmar} alCancelar={alCancelar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, continuar' }));
    expect(alConfirmar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'No, cancelar' }));
    expect(alCancelar).toHaveBeenCalledTimes(1);
  });
});
