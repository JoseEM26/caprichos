import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PagosTab } from '../PagosTab';
import { api } from '../../../comun/api';

const pagos = {
  efectivo: { activo: true },
  tarjeta: { activo: true },
  yape: { activo: true, numero: '900000000', titular: 'Ana Prueba' },
  plin: { activo: true, numero: '900000000', titular: 'Ana Prueba' },
  transferencia: { activo: true, banco: 'BCP', cuenta: '191-00000000-0-00', cci: '', titular: 'Ana Prueba' },
};

describe('Configuración › Pagos: CCI de la transferencia', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('se escribe el CCI y viaja al guardar junto a banco, cuenta y titular', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(pagos);
    const put = vi.spyOn(api, 'put').mockResolvedValue(pagos);
    render(<PagosTab puedeEditar />);
    const campo = await screen.findByPlaceholderText('Ej: 002 191 000000000000 00');
    fireEvent.change(campo, { target: { value: '002-191-000000000000-00' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    const confirmar = screen.queryByRole('button', { name: /^(sí|confirmar|aceptar)/i });
    if (confirmar) fireEvent.click(confirmar);
    await waitFor(() => expect(put).toHaveBeenCalled());
    const cuerpo = put.mock.calls[0][1] as any;
    expect(cuerpo.transferencia).toMatchObject({ banco: 'BCP', cuenta: '191-00000000-0-00', cci: '002-191-000000000000-00', titular: 'Ana Prueba' });
  });
});
