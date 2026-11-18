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

  it('por defecto va al final, como tarjeta cuadrada igual a las demás, sin insignia «Nuevo»', () => {
    render(<TarjetasMedioPago medios={['CULQI', 'EFECTIVO', 'YAPE']} seleccionado={null} alElegir={() => {}} />);
    const botones = screen.getAllByRole('button');
    expect(botones.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Yape'),
      expect.stringContaining('Efectivo'),
      expect.stringContaining('Tarjeta / Yape en línea'),
    ]);
    expect(botones[2].textContent).toContain('se confirma al instante, sin enviar captura');
    expect(screen.queryByTestId('insignia-opcion')).toBeNull();
    expect(screen.queryByText('Nuevo')).toBeNull();
    expect(botones[2].style.gridColumn).toBe('');
  });

  it('con la configuración del dueño: Yape grande con «Nuevo», orden propio y texto accesible con la insignia', () => {
    const presentacion = {
      CULQI: { orden: 1, tamano: 'normal', insignia: null },
      YAPE: { orden: 2, tamano: 'grande', insignia: 'Nuevo' },
      EFECTIVO: { orden: 3, tamano: 'normal', insignia: null },
    };
    render(<TarjetasMedioPago medios={['YAPE', 'EFECTIVO', 'CULQI']} presentacion={presentacion} seleccionado={null} alElegir={() => {}} />);
    const botones = screen.getAllByRole('button');
    expect(botones[0].textContent).toContain('Tarjeta / Yape en línea');
    expect(botones[1].getAttribute('aria-label')).toBe('Yape. Nuevo');
    expect(botones[1].style.gridColumn).toBe('1 / -1');
    expect(screen.getByTestId('insignia-opcion').textContent).toBe('Nuevo');
    expect(botones[2].style.gridColumn).toBe('');
  });

  it('sin el medio CULQI (pago en línea apagado) no se ofrece', () => {
    render(<TarjetasMedioPago medios={['YAPE', 'EFECTIVO']} seleccionado={null} alElegir={() => {}} />);
    expect(screen.queryByText('Tarjeta / Yape en línea')).toBeNull();
  });
});
