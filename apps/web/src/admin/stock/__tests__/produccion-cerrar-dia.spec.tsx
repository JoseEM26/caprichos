import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProduccionAlmacenTab } from '../ProduccionAlmacenTab';

// Los hijos hacen sus propias llamadas a la API: aquí solo interesa el botón de cierre
vi.mock('../ExistenciasTab', () => ({ ExistenciasTab: () => null }));
vi.mock('../MovimientosTab', () => ({ MovimientosTab: () => null }));
vi.mock('../ModalMovimiento', () => ({ ModalMovimiento: () => null }));
vi.mock('../../almacen/ModalRegistrarProduccion', () => ({ ModalRegistrarProduccion: () => null }));
vi.mock('../../almacen/ModalCerrarDia', () => ({
  ModalCerrarDia: ({ abierto }: { abierto: boolean }) => (abierto ? <div>FLUJO DE CIERRE CON CONTEO</div> : null),
}));

describe('Producción y almacén: Cerrar el día', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('abre el cierre real con conteo y no muestra el texto de merma automática', () => {
    render(<ProduccionAlmacenTab insumos={[]} lugares={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar el día (sobrantes a merma)' }));

    expect(screen.getByText('FLUJO DE CIERRE CON CONTEO')).toBeInTheDocument();
    expect(screen.queryByText(/registrado en merma/i)).not.toBeInTheDocument();
  });
});
