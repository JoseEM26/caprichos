import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BotonCancelarEspera } from '../EsperaEntrega';
import type { PedidoReparto } from '../repartosApi';

const pedidoLlegado = (llegoHaceMin: number): PedidoReparto => ({
  id: '60',
  codigo: 'CP-0110',
  modalidad: 'DELIVERY',
  estado: 'EN_CAMINO',
  cliente_nombre: 'Kevin',
  creado_en: new Date().toISOString(),
  llego_en: new Date(Date.now() - llegoHaceMin * 60000).toISOString(),
  espera_max_min: 10,
  minutosEspera: 0,
  color: 'verde',
} as unknown as PedidoReparto);

describe('BotonCancelarEspera (cliente no salió)', () => {
  it('antes del tiempo: botón deshabilitado con cuántos minutos faltan', () => {
    const onCancelar = vi.fn();
    render(<BotonCancelarEspera pedido={pedidoLlegado(4)} onCancelar={onCancelar} />);

    const boton = screen.getByTestId('btn-cancelar-espera-60') as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    expect(boton).toHaveTextContent('podrás cancelar en 6 min');
    expect(screen.getByText('Esperando en la puerta: 4 de 10 min')).toBeInTheDocument();
    fireEvent.click(boton);
    expect(onCancelar).not.toHaveBeenCalled();
  });

  it('pasado el tiempo: botón habilitado y destacado, abre el reporte', () => {
    const onCancelar = vi.fn();
    const pedido = pedidoLlegado(11);
    render(<BotonCancelarEspera pedido={pedido} onCancelar={onCancelar} />);

    const boton = screen.getByTestId('btn-cancelar-espera-60') as HTMLButtonElement;
    expect(boton.disabled).toBe(false);
    expect(boton).toHaveTextContent('Cliente no salió: devolver a la tienda y reprogramar');
    fireEvent.click(boton);
    expect(onCancelar).toHaveBeenCalledWith(pedido);
  });

  it('sin «Llegué» no se muestra nada', () => {
    const { container } = render(
      <BotonCancelarEspera pedido={{ ...pedidoLlegado(0), llego_en: null }} onCancelar={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
