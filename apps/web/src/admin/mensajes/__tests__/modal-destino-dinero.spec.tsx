import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalDestinoDinero } from '../ModalDestinoDinero';

const montar = (alElegir = vi.fn()) => {
  render(<ModalDestinoDinero codigoPedido="CP-7" enviando={false} error={null} alElegir={alElegir} alCerrar={vi.fn()} />);
  return alElegir;
};

describe('Cancelar desde Mensajes un pedido pagado: destino del dinero', () => {
  it('no deja aplicar sin elegir', () => {
    montar();
    expect(screen.getByRole('button', { name: /Aplicar cancelación/i })).toBeDisabled();
  });

  it('devolver por Yape pide medio, monto y código', () => {
    const elegir = montar();
    fireEvent.click(screen.getByLabelText(/Se devuelve al cliente/i));
    fireEvent.change(screen.getByLabelText(/Medio de la devolución/i), { target: { value: 'YAPE' } });
    fireEvent.change(screen.getByLabelText(/Monto devuelto/i), { target: { value: '30' } });
    expect(screen.getByRole('button', { name: /Aplicar cancelación/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Código de operación/i), { target: { value: 'OP9' } });
    fireEvent.click(screen.getByRole('button', { name: /Aplicar cancelación/i }));
    expect(elegir).toHaveBeenCalledWith({ destinoDinero: 'DEVOLVER', devolucionMedio: 'YAPE', devolucionMonto: 30, devolucionCodigo: 'OP9' });
  });

  it('reprogramar envía solo el destino', () => {
    const elegir = montar();
    fireEvent.click(screen.getByLabelText(/Se reprograma el pedido/i));
    fireEvent.click(screen.getByRole('button', { name: /Aplicar cancelación/i }));
    expect(elegir).toHaveBeenCalledWith({ destinoDinero: 'REPROGRAMAR' });
  });
});
