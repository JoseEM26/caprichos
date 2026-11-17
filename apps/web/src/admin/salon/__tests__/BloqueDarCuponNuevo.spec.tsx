import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BloqueDarCuponNuevo } from '../componentes/BloqueDarCuponNuevo';
import { ofertasApi } from '../../ofertas/ofertasApi';

const cupon = {
  id: '7',
  codigoBase: 'AMIGO15',
  descripcion: 'Para un amigo',
  descuentoTipo: 'PORCENTAJE',
  descuentoValor: 15,
  diasValidez: 10,
  quedan: 5,
  alcance: 'Toda la carta',
};

describe('BloqueDarCuponNuevo (ventana de nuevo pedido)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('plegado por defecto; al abrir lista el cupón con su valor, alcance y vigencia', async () => {
    vi.spyOn(ofertasApi, 'cuponesParaDar').mockResolvedValue({ cupones: [cupon], dado: null });
    render(<BloqueDarCuponNuevo cuponId={null} onCambiar={vi.fn()} />);
    const cabecera = await screen.findByRole('button', { name: /Dar un cupón a este cliente \(opcional\)/ });
    expect(cabecera).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Para un amigo/)).not.toBeInTheDocument();
    fireEvent.click(cabecera);
    expect(cabecera).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Para un amigo · 15 % DE DESCUENTO/)).toBeInTheDocument();
    expect(screen.getByText(/Toda la carta · válido 10 días desde que se da · quedan 5/)).toBeInTheDocument();
  });

  it('elegir un cupón muestra «Se imprimirá en el voucher de este cliente» y «Quitar» lo borra', async () => {
    vi.spyOn(ofertasApi, 'cuponesParaDar').mockResolvedValue({ cupones: [cupon], dado: null });
    const onCambiar = vi.fn();
    const { rerender } = render(<BloqueDarCuponNuevo cuponId={null} onCambiar={onCambiar} />);
    fireEvent.click(await screen.findByRole('button', { name: /Dar un cupón a este cliente/ }));
    fireEvent.click(screen.getByRole('button', { name: /Para un amigo/ }));
    expect(onCambiar).toHaveBeenCalledWith('7');

    rerender(<BloqueDarCuponNuevo cuponId="7" onCambiar={onCambiar} />);
    expect(screen.getByText('Se imprimirá en el voucher de este cliente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(onCambiar).toHaveBeenLastCalledWith(null);
  });

  it('sin cupones vigentes no muestra nada', async () => {
    vi.spyOn(ofertasApi, 'cuponesParaDar').mockResolvedValue({ cupones: [], dado: null });
    const { container } = render(<BloqueDarCuponNuevo cuponId={null} onCambiar={vi.fn()} />);
    await waitFor(() => expect(ofertasApi.cuponesParaDar).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('si la lista no carga, avisa sin romper la ventana', async () => {
    vi.spyOn(ofertasApi, 'cuponesParaDar').mockRejectedValue(new Error('red'));
    render(<BloqueDarCuponNuevo cuponId={null} onCambiar={vi.fn()} />);
    expect(await screen.findByText(/No se pudieron cargar los cupones/)).toBeInTheDocument();
  });
});
