import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../comun/mapa/MapaUbicacion', () => ({
  MapaUbicacion: ({ punto, onCambiar }: any) => (
    <button type="button" data-testid="mapa" onClick={() => onCambiar?.({ lat: -12.05, lng: -76.97 })}>
      {punto ? `${punto.lat},${punto.lng}` : 'sin punto'}
    </button>
  ),
}));
vi.mock('../../../comun/mapa/BuscadorDireccion', () => ({ BuscadorDireccion: () => null }));
vi.mock('../../../comun/mapa/sedeDefecto', () => ({ SEDE_DEFECTO: { lat: 0, lng: 0 }, cargarSede: () => Promise.resolve({ lat: 0, lng: 0 }) }));
vi.mock('../cambioUbicacionApi', async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    cambioUbicacionApi: {
      previsualizar: vi.fn(),
      cambiar: vi.fn(),
      historial: vi.fn(),
      liquidarAjuste: vi.fn(),
      propuestasPendientes: vi.fn().mockResolvedValue([]),
      aprobarPropuesta: vi.fn(),
      rechazarPropuesta: vi.fn(),
    },
    propuestaUbicacionApi: { vigente: vi.fn().mockResolvedValue(null), proponer: vi.fn(), cancelar: vi.fn() },
  };
});

import { ModalCambiarUbicacion } from '../ModalCambiarUbicacion';
import { InsigniaDireccionEditada } from '../InsigniaDireccionEditada';
import { cambioUbicacionApi, textoDifEnvio } from '../cambioUbicacionApi';
import { BotonProponerUbicacion } from '../../repartos/BotonProponerUbicacion';
import { propuestaUbicacionApi } from '../cambioUbicacionApi';

const api = cambioUbicacionApi as any;
const propuestas = propuestaUbicacionApi as any;

describe('cambio de ubicación', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Caja ve antes y después con la diferencia y el saldo antes de confirmar', async () => {
    api.previsualizar.mockResolvedValue({
      zona: 'Z3', envioAnterior: 0, envioNuevo: 6, diferencia: 6, totalAnterior: 40, totalNuevo: 46,
      pagado: true, montoPagado: 40, ajuste: { tipo: 'SALDO', monto: 6 }, cambiaEnvio: true,
    });
    render(<ModalCambiarUbicacion pedidoId="7" codigoPedido="CP-W007" alCerrar={() => {}} alCambiar={() => {}} />);
    fireEvent.click(screen.getByTestId('mapa'));
    expect(await screen.findByText('+S/ 6.00')).toBeTruthy();
    expect(screen.getByText(/saldo por cobrar de S\/ 6.00/)).toBeTruthy();
    expect(screen.getByText('S/ 46.00')).toBeTruthy();
    expect(api.previsualizar).toHaveBeenCalledWith('7', -12.05, -76.97);
  });

  it('la insignia «Dirección editada» aparece como texto', () => {
    render(<InsigniaDireccionEditada />);
    expect(screen.getByText('Dirección editada')).toBeTruthy();
    expect(textoDifEnvio(-2.5)).toBe('-S/ 2.50');
    expect(textoDifEnvio(0)).toBe('Sin diferencia');
  });

  it('el repartidor usa su GPS y propone; la propuesta va con lat/lng y nota', async () => {
    const geo = { getCurrentPosition: vi.fn((ok: any) => ok({ coords: { latitude: -12.06, longitude: -76.98 } })) };
    Object.defineProperty(globalThis.navigator, 'geolocation', { value: geo, configurable: true });
    propuestas.proponer.mockResolvedValue({ id: '3', estado: 'PROPUESTA' });
    render(<BotonProponerUbicacion pedidoId="7" codigo="CP-W007" estado="EN_CAMINO" />);
    fireEvent.click(screen.getByRole('button', { name: /Proponer ubicación real del pedido/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mi ubicación actual' }));
    fireEvent.change(screen.getByPlaceholderText(/portón verde/), { target: { value: 'Casa azul' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));
    await waitFor(() =>
      expect(propuestas.proponer).toHaveBeenCalledWith('7', { lat: -12.06, lng: -76.98, nota: 'Casa azul' }),
    );
  });

  it('repartidor: avisa si la precisión del GPS es mala, muestra el mapa y la distancia al punto actual', async () => {
    const geo = { getCurrentPosition: vi.fn((ok: any) => ok({ coords: { latitude: -12.06, longitude: -76.98, accuracy: 180 } })) };
    Object.defineProperty(globalThis.navigator, 'geolocation', { value: geo, configurable: true });
    render(<BotonProponerUbicacion pedidoId="7" codigo="CP-W007" estado="LISTO" puntoActual={{ lat: -12.05, lng: -76.98 }} />);
    fireEvent.click(screen.getByRole('button', { name: /Proponer ubicación real del pedido/ }));
    expect(await screen.findByTestId('mapa')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mi ubicación actual' }));
    expect(await screen.findByText(/Precisión baja \(±180 m\)/)).toBeTruthy();
    expect(screen.getByTestId('distancia-propuesta').textContent).toMatch(/A \d+ m del punto actual del pedido/);
  });

  it('repartidor: puede proponer aunque el pedido no tuviera ubicación y hablar con el cliente antes', async () => {
    const alChatear = vi.fn();
    propuestas.proponer.mockResolvedValue({ id: '4', estado: 'PROPUESTA' });
    render(<BotonProponerUbicacion pedidoId="7" codigo="CP-W007" estado="LISTO" puntoActual={null} alChatear={alChatear} />);
    fireEvent.click(screen.getByRole('button', { name: /Proponer ubicación real del pedido/ }));
    fireEvent.click(await screen.findByTestId('mapa'));
    expect(screen.getByTestId('distancia-propuesta').textContent).toMatch(/todavía no tiene punto/);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));
    await waitFor(() => expect(propuestas.proponer).toHaveBeenCalledWith('7', { lat: -12.05, lng: -76.97, nota: undefined }));
    fireEvent.click(screen.getByRole('button', { name: 'Hablar con el cliente por WhatsApp' }));
    expect(alChatear).toHaveBeenCalled();
  });

  it('no muestra el botón de propuesta si el pedido ya no está en curso', () => {
    const { container } = render(<BotonProponerUbicacion pedidoId="7" codigo="CP-W007" estado="ENTREGADO" />);
    expect(container.textContent).toBe('');
  });
});
