import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PagoPersonalBloque } from '../componentes/PagoPersonalBloque';

vi.mock('../../pedidos/mediosCanal', async (orig) => ({
  ...(await orig<any>()),
  useMediosCanal: () => ({ medios: ['EFECTIVO'], presentacion: {} }),
}));

const base = { onModo: vi.fn(), medio: 'EFECTIVO', onMedio: vi.fn(), total: 26, pagaCon: '', onPagaCon: vi.fn(), puedeCobrarAhora: true, error: null, mostrarError: false };

describe('Pago del personal con delivery', () => {
  it('a crédito: avisa que el envío no lleva descuento y se paga aparte', () => {
    render(<PagoPersonalBloque {...base} modo="credito" envio={5} />);
    expect(screen.getByTestId('personal-aviso-envio').textContent).toMatch(/S\/ 5\.00.*no lleva descuento ni va a su crédito/);
  });

  it('pagar ahora: el envío va incluido, sin descuento', () => {
    render(<PagoPersonalBloque {...base} modo="ahora" envio={5} />);
    expect(screen.getByTestId('personal-aviso-envio').textContent).toMatch(/Incluye el envío \(S\/ 5\.00\)/);
  });

  it('sin delivery no hay aviso', () => {
    render(<PagoPersonalBloque {...base} modo="credito" />);
    expect(screen.queryByTestId('personal-aviso-envio')).toBeNull();
  });
});
