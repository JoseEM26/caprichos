import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AvisoControlAlmacen } from '../AvisoControlAlmacen';
import { stockApi, EstadoControlAlmacen } from '../stockApi';
import { TarjetaControlAlmacenConfiguracion } from '../../configuracion/TarjetaControlAlmacenConfiguracion';

function estado(over: Partial<EstadoControlAlmacen>): EstadoControlAlmacen {
  return { activo: false, insumosConReceta: 0, insumosSinStock: 0, productosEnRiesgo: 0, productosControlados: 0, ...over };
}

describe('Control de almacén: insumos aparte de los productos con stock propio', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('con el interruptor apagado el aviso solo habla de insumos y no sugiere que el conteo de productos esté apagado', async () => {
    vi.spyOn(stockApi, 'estadoControl').mockResolvedValue(estado({ activo: false }));
    render(<AvisoControlAlmacen />);
    const aviso = await screen.findByTestId('aviso-control-almacen');
    expect(aviso).toHaveTextContent('Control de insumos apagado.');
    expect(aviso).not.toHaveTextContent(/productos con stock propio/);
    expect(aviso).not.toHaveTextContent(/no se agotan/);
  });

  it('si hay productos controlados, el aviso apagado lo aclara', async () => {
    vi.spyOn(stockApi, 'estadoControl').mockResolvedValue(estado({ activo: false, productosControlados: 3 }));
    render(<AvisoControlAlmacen />);
    const aviso = await screen.findByTestId('aviso-control-almacen');
    expect(aviso).toHaveTextContent('3 productos con stock propio (donas, galletas) siguen controlándose');
  });

  it('con un solo producto controlado usa el singular', async () => {
    vi.spyOn(stockApi, 'estadoControl').mockResolvedValue(estado({ activo: false, productosControlados: 1 }));
    render(<AvisoControlAlmacen />);
    expect(await screen.findByTestId('aviso-control-almacen')).toHaveTextContent(
      'El producto con stock propio (donas, galletas) sigue controlándose',
    );
  });

  it('encendido no muestra el aviso', async () => {
    vi.spyOn(stockApi, 'estadoControl').mockResolvedValue(estado({ activo: true, productosControlados: 2 }));
    render(<AvisoControlAlmacen />);
    await waitFor(() => expect(stockApi.estadoControl).toHaveBeenCalled());
    expect(screen.queryByTestId('aviso-control-almacen')).toBeNull();
  });

  it('la tarjeta de Configuración explica que gobierna solo insumos y cuenta los productos controlados', async () => {
    vi.spyOn(stockApi, 'estadoControl').mockResolvedValue(estado({ activo: true, productosControlados: 2 }));
    render(<TarjetaControlAlmacenConfiguracion esAdmin={true} />);
    expect(await screen.findByText(/gobierna solo los insumos y las recetas/i)).toBeInTheDocument();
    expect(screen.getByTestId('control-almacen-productos')).toHaveTextContent(
      'funciona aparte: 2 productos controlan su stock con la casilla',
    );
  });

  it('la tarjeta sin productos con casilla lo dice', async () => {
    vi.spyOn(stockApi, 'estadoControl').mockResolvedValue(estado({ activo: false, productosControlados: 0 }));
    render(<TarjetaControlAlmacenConfiguracion esAdmin={true} />);
    expect(await screen.findByTestId('control-almacen-productos')).toHaveTextContent('Ningún producto la tiene marcada todavía');
  });
});
