import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgramadosCierre } from '../ProgramadosCierre';

describe('ProgramadosCierre', () => {
  it('identifica el adelanto y el pago completo como de pedido programado para 17/11', () => {
    render(
      <ProgramadosCierre
        datos={{
          total: 39,
          lista: [
            { pedidoId: '1', pedidoCodigo: 'CP-W100', programadoPara: '2026-11-17T22:00:00Z', tipo: 'COBRO', medios: ['EFECTIVO'], monto: 29 },
            { pedidoId: '2', pedidoCodigo: 'CP-W101', programadoPara: '2026-11-17T22:00:00Z', tipo: 'ADELANTO', medios: ['YAPE'], monto: 10 },
          ],
        }}
      />,
    );
    const filas = screen.getAllByTestId('programado-cierre-fila');
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('Pago completo de pedido programado para 17/11');
    expect(filas[1]).toHaveTextContent('Adelanto de pedido programado para 17/11');
    expect(screen.getByText('S/ 39.00')).toBeInTheDocument();
  });
  it('sin programados no se dibuja', () => {
    const { container } = render(<ProgramadosCierre datos={{ total: 0, lista: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
