import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisorCapturaModal } from '../VisorCapturaModal';

describe('VisorCapturaModal', () => {
  it('no se muestra si abierto es false', () => {
    const { container } = render(
      <VisorCapturaModal
        abierto={false}
        fotoUrl="blob:http://localhost:5173/test"
        alCerrar={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('se muestra cuando abierto es true con título, código y botón Cerrar', () => {
    const onCerrar = vi.fn();
    render(
      <VisorCapturaModal
        abierto={true}
        fotoUrl="blob:http://localhost:5173/test"
        codigo="IN-0042"
        titulo="Detalle de iniciativa"
        alCerrar={onCerrar}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Visor de captura' })).toBeInTheDocument();
    expect(screen.getByText('Captura adjunta · IN-0042')).toBeInTheDocument();
    expect(screen.getByText('Detalle de iniciativa')).toBeInTheDocument();

    // Botón Cerrar en el pie
    const btnCerrar = screen.getByRole('button', { name: 'Cerrar' });
    expect(btnCerrar).toBeInTheDocument();
    fireEvent.click(btnCerrar);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('permite cerrar con tecla Escape', () => {
    const onCerrar = vi.fn();
    render(
      <VisorCapturaModal
        abierto={true}
        fotoUrl="blob:http://localhost:5173/test"
        alCerrar={onCerrar}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });
});
