import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CapriFallback } from '../CapriFallback';
import { ESTADOS_CAPRI } from '../animaciones';

describe('CapriFallback.tsx', () => {
  it('renderiza con rol accesible img y la etiqueta aria obligatoria', () => {
    render(<CapriFallback estado="reposo" tamano={180} />);

    const elemento = screen.getByRole('img', { name: 'Capri, la asistente de Caprichos' });
    expect(elemento).toBeInTheDocument();
    expect(elemento).toHaveStyle({ width: '180px', height: '180px' });
  });

  it('renderiza todos los estados soportados con sus clases correspondientes', () => {
    ESTADOS_CAPRI.forEach((estado) => {
      const { unmount } = render(<CapriFallback estado={estado} />);
      const elemento = screen.getByRole('img');
      expect(elemento).toHaveClass(`capri-estado-${estado}`);
      unmount();
    });
  });

  it('muestra el texto Zzz en estado dormido', () => {
    render(<CapriFallback estado="dormido" />);
    const letrasZ = screen.getAllByText('Z');
    expect(letrasZ.length).toBeGreaterThanOrEqual(1);
  });

  it('ejecuta alHacerClic cuando se proporciona', () => {
    const alClic = vi.fn();
    render(<CapriFallback estado="reposo" alHacerClic={alClic} />);

    fireEvent.click(screen.getByRole('img'));
    expect(alClic).toHaveBeenCalledTimes(1);
  });
});
