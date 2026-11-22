import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CancelarPedido } from '../CancelarPedido';
import { api } from '../../comun/api';

const props = { codigo: 'CP-T1', token: 'tok', anulado: false, terminado: false, onCancelado: vi.fn() };

describe('CancelarPedido', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('cancelable: pide confirmación y llama a la API con el token', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true } as any);
    render(<CancelarPedido {...props} cancelable={{ puede: true }} />);
    fireEvent.click(screen.getByText('Cancelar pedido'));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sí, cancelar'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/carta/pedidos/CP-T1/cancelar?t=tok', {}));
    await waitFor(() => expect(props.onCancelado).toHaveBeenCalled());
  });

  it('«No» cierra la confirmación sin cancelar', () => {
    const post = vi.spyOn(api, 'post');
    render(<CancelarPedido {...props} cancelable={{ puede: true }} />);
    fireEvent.click(screen.getByText('Cancelar pedido'));
    fireEvent.click(screen.getByText('No'));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText('Cancelar pedido')).toBeTruthy();
  });

  it('no cancelable: sin botón, con el motivo corto', () => {
    render(<CancelarPedido {...props} cancelable={{ puede: false, mensaje: 'Tu pago está en revisión, escríbenos y lo vemos contigo.' }} />);
    expect(screen.queryByText('Cancelar pedido')).toBeNull();
    expect(screen.getByTestId('no-cancelable').textContent).toMatch(/en revisión/);
  });

  it('anulado o terminado: no muestra nada', () => {
    const { container } = render(<CancelarPedido {...props} anulado cancelable={{ puede: false, mensaje: 'x' }} />);
    expect(container.innerHTML).toBe('');
  });
});
