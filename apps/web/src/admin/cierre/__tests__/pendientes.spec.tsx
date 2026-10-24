import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { PendientesCobroCierre } from '../PendientesCobroCierre';
import { cierreApi, PendienteCobro } from '../cierreApi';
import { ErrorApi } from '../../../comun/api';

const pendiente: PendienteCobro = {
  id: 74,
  codigo: 'CP-W062',
  canal: 'CARTA',
  modalidad: 'RECOGER',
  estado: 'ENTREGADO',
  total: 42,
  fecha: '2026-10-23T20:21:00.000Z',
};

function Host({ esAdmin, inicial = [] }: { esAdmin: boolean; inicial?: PendienteCobro[] }) {
  const [lista, setLista] = useState<PendienteCobro[]>(inicial);
  return (
    <PendientesCobroCierre esAdmin={esAdmin} pendientes={lista} setPendientes={setLista} alCambiarTurno={vi.fn()} />
  );
}

describe('Caja y cierres: pedidos sin cobrar que impiden cerrar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('el cajero no ve la lista sin el PIN de supervisor; con PIN correcto la ve y puede cobrar o anular', async () => {
    const listar = vi.spyOn(cierreApi, 'listarPendientesDeCobro').mockResolvedValue([pendiente]);
    render(<Host esAdmin={false} />);

    expect(screen.queryByText('CP-W062', { exact: false })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('PIN del supervisor'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver pedidos' }));

    await waitFor(() => expect(screen.getByText('CP-W062', { exact: false })).toBeInTheDocument());
    expect(listar).toHaveBeenCalledWith('123456');
    expect(screen.getByRole('button', { name: 'Cobrar ahora' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anular con motivo' })).toBeInTheDocument();
  });

  it('un PIN con menos de 6 dígitos no llama a la API', () => {
    const listar = vi.spyOn(cierreApi, 'listarPendientesDeCobro');
    render(<Host esAdmin={false} />);

    fireEvent.change(screen.getByLabelText('PIN del supervisor'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver pedidos' }));

    expect(listar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('6 dígitos');
  });

  it('un PIN bloqueado muestra el mensaje del servidor y no deja ver la lista', async () => {
    vi.spyOn(cierreApi, 'listarPendientesDeCobro').mockRejectedValue(
      new ErrorApi('PIN_BLOQUEADO', 'Demasiados intentos fallidos de PIN de supervisor. Espera 5 minutos.', 403),
    );
    render(<Host esAdmin={false} />);

    fireEvent.change(screen.getByLabelText('PIN del supervisor'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver pedidos' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Espera 5 minutos'));
    expect(screen.queryByRole('button', { name: 'Cobrar ahora' })).not.toBeInTheDocument();
  });

  it('el admin ve de entrada los pedidos y el bloque desaparece cuando no queda ninguno', () => {
    const { unmount } = render(<Host esAdmin inicial={[pendiente]} />);
    expect(screen.getByText('CP-W062', { exact: false })).toBeInTheDocument();
    expect(screen.queryByLabelText('PIN del supervisor')).not.toBeInTheDocument();
    unmount();

    render(<Host esAdmin inicial={[]} />);
    expect(screen.queryByText(/Pedidos sin cobrar/)).not.toBeInTheDocument();
  });
});
