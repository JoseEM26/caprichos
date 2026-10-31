import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UbicacionRapidaDelivery } from '../componentes/UbicacionRapidaDelivery';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

describe('UbicacionRapidaDelivery', () => {
  let onElegir: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onElegir = vi.fn();
  });

  it('muestra «Usar ubicacion de WhatsApp» solo si el cliente mandó ubicación en 24 h', async () => {
    vi.mocked(api.get).mockResolvedValue({ encontrada: true, lat: -12.07, lng: -77.04, direccionAprox: 'Jesús María' });
    render(<UbicacionRapidaDelivery telefono="987654321" onElegir={onElegir} />);
    const boton = await screen.findByRole('button', { name: 'Usar ubicacion de WhatsApp' });
    expect(api.get).toHaveBeenCalledWith('/admin/clientes/ubicacion-whatsapp/987654321');

    fireEvent.click(boton);
    expect(onElegir).toHaveBeenCalledWith({ lat: -12.07, lng: -77.04 }, 'Jesús María');
  });

  it('sin ubicación reciente no muestra el botón', async () => {
    vi.mocked(api.get).mockResolvedValue({ encontrada: false, lat: null, lng: null });
    render(<UbicacionRapidaDelivery telefono="987654321" onElegir={onElegir} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Usar ubicacion de WhatsApp' })).toBeNull();
  });

  it('si la consulta falla el botón no aparece y el campo sigue funcionando', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('sin red'));
    render(<UbicacionRapidaDelivery telefono="987654321" onElegir={onElegir} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Usar ubicacion de WhatsApp' })).toBeNull();
    expect(screen.getByLabelText('Pegar coordenadas o enlace de Google Maps')).toBeInTheDocument();
  });

  it('sin celular válido no consulta', () => {
    render(<UbicacionRapidaDelivery telefono={null} onElegir={onElegir} />);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('el campo pega coordenadas y pone el punto en el mapa', () => {
    vi.mocked(api.get).mockResolvedValue({ encontrada: false });
    render(<UbicacionRapidaDelivery telefono={null} onElegir={onElegir} />);
    const campo = screen.getByLabelText('Pegar coordenadas o enlace de Google Maps');
    const boton = screen.getByRole('button', { name: 'Poner en el mapa' });
    expect((boton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(campo, { target: { value: 'https://www.google.com/maps/@-12.0123,-76.9456,17z' } });
    fireEvent.click(boton);
    expect(onElegir).toHaveBeenCalledWith({ lat: -12.0123, lng: -76.9456 });
  });

  it('acepta coordenadas separadas por espacio', () => {
    render(<UbicacionRapidaDelivery telefono={null} onElegir={onElegir} />);
    fireEvent.change(screen.getByLabelText('Pegar coordenadas o enlace de Google Maps'), { target: { value: '-12.0123 -76.9456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Poner en el mapa' }));
    expect(onElegir).toHaveBeenCalledWith({ lat: -12.0123, lng: -76.9456 });
  });

  it('un texto sin coordenadas muestra el aviso y no pone nada en el mapa', () => {
    render(<UbicacionRapidaDelivery telefono={null} onElegir={onElegir} />);
    fireEvent.change(screen.getByLabelText('Pegar coordenadas o enlace de Google Maps'), { target: { value: 'https://maps.app.goo.gl/abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Poner en el mapa' }));
    expect(screen.getByRole('alert').textContent).toBe('Pega las coordenadas o un enlace largo de Google Maps');
    expect(onElegir).not.toHaveBeenCalled();
  });
});
