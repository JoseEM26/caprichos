import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as soporte from '../../../mascota/soporteWebGL';
import { salonEjemplo } from './datosEjemplo';

const obtener = vi.fn();
vi.mock('../salonVivoApi', () => ({ salonVivoApi: { obtener: (...a: unknown[]) => obtener(...a) } }));
vi.mock('../../../comun/socket', () => ({ useTiempoReal: vi.fn(), useEventos: vi.fn() }));

const motor = { actualizar: vi.fn(), camara: vi.fn(), tema: vi.fn(), hora: vi.fn(() => 'Noche'), sonido: vi.fn(() => true), voz: vi.fn(), saludar: vi.fn(), bailar: vi.fn(), destruir: vi.fn() };
vi.mock('../Escena3D', () => ({
  default: ({ piso, datos, onMotor }: any) => {
    // Escena de mentira: sin WebGL ni three; avisa que está lista con el motor simulado
    setTimeout(() => onMotor(motor), 0);
    return <div data-testid="escena">{piso.nombre}:{datos?.mesas.length}</div>;
  },
}));

import { SalonVivoView } from '../SalonVivoView';

describe('SalonVivoView', () => {
  beforeEach(() => { obtener.mockResolvedValue(salonEjemplo()); Object.values(motor).forEach((f) => (f as any).mockClear?.()); });
  afterEach(() => vi.restoreAllMocks());

  it('con WebGL dibuja la escena con el piso real y maneja la cámara, la temática y el modo ligero', async () => {
    vi.spyOn(soporte, 'tieneSoporteWebGL').mockReturnValue(true);
    vi.spyOn(soporte, 'prefiereMovimientoReducido').mockReturnValue(false);
    render(<SalonVivoView />);
    expect(await screen.findByTestId('escena')).toHaveTextContent('Piso 1:2');
    await waitFor(() => expect(motor.hora).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Cocina' }));
    expect(motor.camara).toHaveBeenCalledWith('cocina');
    fireEvent.click(screen.getByRole('button', { name: 'Saludar' }));
    expect(motor.saludar).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sonido ambiente' }));
    expect(motor.sonido).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('tab', { name: 'Temática' }));
    fireEvent.click(screen.getByRole('button', { name: /Halloween/ }));
    expect(motor.tema).toHaveBeenCalledWith('halloween');
    fireEvent.click(screen.getByRole('button', { name: 'Modo ligero' }));
    expect(screen.getByRole('button', { name: 'Modo ligero' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sin WebGL deja el panel funcionando y avisa en lugar del 3D', async () => {
    vi.spyOn(soporte, 'tieneSoporteWebGL').mockReturnValue(false);
    render(<SalonVivoView />);
    expect(await screen.findByText(/no puede mostrar el salón en 3D/)).toBeTruthy();
    expect(screen.queryByTestId('escena')).toBeNull();
    expect(screen.getByLabelText('Pedidos en cocina')).toBeTruthy();
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('si falla la carga muestra el error', async () => {
    vi.spyOn(soporte, 'tieneSoporteWebGL').mockReturnValue(false);
    obtener.mockRejectedValue(new Error('Sin permiso'));
    render(<SalonVivoView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin permiso');
  });
});
