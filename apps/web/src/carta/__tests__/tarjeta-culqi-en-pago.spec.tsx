import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TarjetasMedioPago, nombreMedio } from '../MediosPago';

describe('«Tarjeta / Yape en línea» en el paso de pago', () => {
  it('aparece como una tarjeta más cuando el medio CULQI está disponible y al elegirla avisa CULQI', () => {
    const alElegir = vi.fn();
    render(<TarjetasMedioPago medios={['YAPE', 'EFECTIVO', 'CULQI']} seleccionado={null} alElegir={alElegir} />);
    fireEvent.click(screen.getByText('Tarjeta / Yape en línea'));
    expect(alElegir).toHaveBeenCalledWith('CULQI');
    expect(nombreMedio('CULQI')).toBe('Tarjeta / Yape en línea');
  });

  it('sin el medio CULQI (pago en línea apagado) no se ofrece', () => {
    render(<TarjetasMedioPago medios={['YAPE', 'EFECTIVO']} seleccionado={null} alElegir={() => {}} />);
    expect(screen.queryByText('Tarjeta / Yape en línea')).toBeNull();
  });
});
