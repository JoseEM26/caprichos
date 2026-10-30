import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { api } from '../../../comun/api';
import { MapaUbicacion } from '../../../comun/mapa/MapaUbicacion';

vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }),
}));
vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../../../comun/mapa/MapaUbicacion', () => ({
  MapaUbicacion: vi.fn(() => null),
}));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn(async () => []),
}));

/** Props con las que el mapa del delivery se dibujó por última vez */
function ultimoMapa() {
  const llamadas = vi.mocked(MapaUbicacion).mock.calls;
  return llamadas[llamadas.length - 1][0] as any;
}

function abrirDelivery() {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />);
  fireEvent.click(screen.getByRole('button', { name: /Delivery/ }));
}

describe('ModalNuevoPedidoMesa: mapa del delivery muestra la sede', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue({ categorias: [] } as any);
  });

  it('pasa la sede de /carta/local como local al mapa y lo centra en ella', async () => {
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      if (ruta === '/carta/local') {
        return { nombre: 'Caprichos Campoy', direccion: 'Jr. Test 1', lat: -12.5, lng: -77.1 };
      }
      return { items: [] };
    });
    abrirDelivery();

    await waitFor(() =>
      expect(ultimoMapa().local).toEqual({
        lat: -12.5,
        lng: -77.1,
        nombre: 'Caprichos Campoy',
        direccion: 'Jr. Test 1',
      }),
    );
    expect(ultimoMapa().ajustarA).toBe('local');
    expect(api.get).toHaveBeenCalledWith('/carta/local');
    expect(screen.getByText('El icono de la tienda es la sede (Caprichos).')).toBeInTheDocument();
  });

  it('si /carta/local falla usa la sede por defecto de la carta', async () => {
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      if (ruta === '/carta/local') throw new Error('sin red');
      return { items: [] };
    });
    abrirDelivery();

    await waitFor(() =>
      expect(ultimoMapa().local).toEqual({
        lat: -12.0196436,
        lng: -76.963255,
        nombre: 'Caprichos',
        direccion: 'Av. Principal 123',
      }),
    );
  });
});
