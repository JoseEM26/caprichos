import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { plusCodeParaMostrar } from '@caprichos/compartido';
import { TarjetaUbicacion } from '../TarjetaUbicacion';
import { MapaUbicacion } from '../../../comun/mapa/MapaUbicacion';

vi.mock('../../../comun/mapa/MapaUbicacion', () => ({
  MapaUbicacion: vi.fn(() => null),
}));

const base = { lat: -12.0701, lng: -77.0355 };

describe('TarjetaUbicacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el mapa de solo lectura centrado en el punto', () => {
    render(<TarjetaUbicacion ubicacion={base} />);
    const props = vi.mocked(MapaUbicacion).mock.calls[0][0] as any;
    expect(props.punto).toEqual(base);
    expect(props.soloLectura).toBe(true);
  });

  it('muestra las coordenadas con seis decimales', () => {
    render(<TarjetaUbicacion ubicacion={base} />);
    expect(screen.getByText('-12.070100, -77.035500')).toBeInTheDocument();
  });

  it('usa dirección, luego dirección aproximada y luego nombre como texto principal', () => {
    const { rerender } = render(<TarjetaUbicacion ubicacion={{ ...base, direccion: 'Av. Brasil 1234', direccionAprox: 'Jesús María' }} />);
    expect(screen.getByText('Av. Brasil 1234')).toBeInTheDocument();
    expect(screen.getByText('Aprox.: Jesús María')).toBeInTheDocument();

    rerender(<TarjetaUbicacion ubicacion={{ ...base, direccionAprox: 'Jesús María' }} />);
    expect(screen.getByText('Jesús María')).toBeInTheDocument();

    rerender(<TarjetaUbicacion ubicacion={{ ...base, nombre: 'Casa de Ana' }} />);
    expect(screen.getByText('Casa de Ana')).toBeInTheDocument();

    rerender(<TarjetaUbicacion ubicacion={base} />);
    expect(screen.getByText('Ubicación sin dirección')).toBeInTheDocument();
  });

  it('el enlace abre Google Maps en una pestaña nueva con rel seguro', () => {
    render(<TarjetaUbicacion ubicacion={base} />);
    const enlace = screen.getByRole('link', { name: 'Abrir en Google Maps' });
    expect(enlace.getAttribute('href')).toBe('https://www.google.com/maps?q=-12.0701,-77.0355');
    expect(enlace.getAttribute('target')).toBe('_blank');
    expect(enlace.getAttribute('rel')).toContain('noopener');
  });

  it('copia las coordenadas y avisa «Copiado»', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<TarjetaUbicacion ubicacion={base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar coordenadas' }));
    await waitFor(() => expect(screen.getByText('Copiado')).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith('-12.070100, -77.035500');
  });

  it('muestra el Código Plus y lo copia con «Copiar código»', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<TarjetaUbicacion ubicacion={base} />);
    const plus = plusCodeParaMostrar(base.lat, base.lng);
    expect(plus).toMatch(/^[2-9CFGHJMPQRVWX]{4}\+[2-9CFGHJMPQRVWX]{2} Lima$/);
    expect(screen.getByTestId('codigo-plus').textContent).toContain(`Código Plus: ${plus}`);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(plus));
  });

  it('si el portapapeles falla lo dice', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    render(<TarjetaUbicacion ubicacion={base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar coordenadas' }));
    await waitFor(() => expect(screen.getByText('No se pudo copiar')).toBeInTheDocument());
  });
});
