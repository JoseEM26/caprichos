import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalCobrar } from '../ModalCobrar';
import { pedidosApi } from '../pedidosApi';
import { api } from '../../../comun/api';

const pedido: any = {
  id: '77', codigo: 'CP-T001', estado: 'ACEPTADO', total: 45, descuento: 5, propina: 0, pago_estado: 'PENDIENTE',
  pago_metodo: 'YAPE', pago_preferido: 'YAPE', modalidad: 'RECOGER', planPago: [], items: [],
};

describe('Caja ve «Sin descuento <promo>: total S/ X» antes de cobrar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue({ medios: ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'] });
  });

  it('con el medio de la promo no hay aviso; al cambiar a otro medio aparece, el total sube y se cobra confirmando', async () => {
    const promo = vi
      .spyOn(pedidosApi, 'promoPorMedio')
      .mockImplementation(async (_id, medios) =>
        medios.includes('YAPE') ? { quita: null } : { quita: { ofertaId: '9', nombre: '10 % con Yape', descuento: 5, totalAnterior: 45, totalNuevo: 50 } },
      );
    const cobrar = vi.fn().mockResolvedValue({});
    render(<ModalCobrar pedido={pedido} alCerrar={() => {}} alCobrarExitoso={() => {}} cobrar={cobrar} />);
    await waitFor(() => expect(promo).toHaveBeenCalledWith('77', ['YAPE']));
    expect(screen.queryByTestId('aviso-sin-descuento')).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: 'Efectivo' }));
    const aviso = await screen.findByTestId('aviso-sin-descuento');
    expect(aviso.textContent).toContain('Sin descuento 10 % con Yape: total S/ 50.00');
  });
});
