import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { plusCodeParaMostrar } from '@caprichos/compartido';

vi.mock('../../../comun/mapa/MapaUbicacion', () => ({ MapaUbicacion: () => null }));
vi.mock('../cambioUbicacionApi', async (orig) => {
  const real: any = await orig();
  return { ...real, cambioUbicacionApi: { historial: vi.fn().mockResolvedValue({ cambios: [], editada: false }) } };
});
vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ tiene: () => false }) }));

import { SeccionUbicacionPedido } from '../SeccionUbicacionPedido';

describe('Código Plus en el detalle del pedido', () => {
  it('con lat/lng muestra el Código Plus y lo copia', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<SeccionUbicacionPedido pedidoId="7" codigo="CP-W007" estado="COLA" lat={-12.0701} lng={-77.0355} alActualizar={() => {}} />);
    const plus = plusCodeParaMostrar(-12.0701, -77.0355);
    expect(screen.getByTestId('codigo-plus').textContent).toContain(plus);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(plus));
  });

  it('sin coordenadas no muestra nada', () => {
    render(<SeccionUbicacionPedido pedidoId="7" codigo="CP-W007" estado="COLA" lat={null} lng={null} alActualizar={() => {}} />);
    expect(screen.queryByTestId('codigo-plus')).toBeNull();
  });
});
