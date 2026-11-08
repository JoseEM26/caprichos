import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { PendientesCobroCierre } from '../PendientesCobroCierre';
import type { PendienteCobro } from '../cierreApi';

const pendiente: PendienteCobro = {
  id: 74,
  codigo: 'CP-W062',
  canal: 'CARTA',
  modalidad: 'RECOGER',
  estado: 'ENTREGADO',
  total: 42,
  fecha: '2026-10-23T20:21:00.000Z',
};

function Host({ inicial = [] }: { inicial?: PendienteCobro[] }) {
  const [lista, setLista] = useState<PendienteCobro[]>(inicial);
  return <PendientesCobroCierre pendientes={lista} setPendientes={setLista} alCambiarTurno={vi.fn()} />;
}

describe('Caja y cierres: pedidos sin cobrar que impiden cerrar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('quien cierra la caja ve la lista de entrada, sin ningún código, y puede cobrar o anular', () => {
    render(<Host inicial={[pendiente]} />);

    expect(screen.getByText('CP-W062', { exact: false })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Código del supervisor/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver pedidos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cobrar ahora' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anular con motivo' })).toBeInTheDocument();
  });

  it('el bloque desaparece cuando no queda ninguno', () => {
    render(<Host inicial={[]} />);
    expect(screen.queryByText(/Pedidos sin cobrar/)).not.toBeInTheDocument();
  });
});
