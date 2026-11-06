import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const reporteHoy = vi.fn();
vi.mock('../asistenciaApi', async (orig) => ({
  ...(await orig<any>()),
  reporteHoy: (...a: any[]) => reporteHoy(...a),
  listarMarcas: vi.fn(async () => []),
  obtenerConfigAsistencia: vi.fn(async () => ({ radioM: 10, toleranciaMin: 10, retencionDias: 90, precisionMaxM: 25, localLat: null, localLng: null })),
}));

import { AsistenciaAdminView } from '../AsistenciaAdminView';
import { csvDeFilas } from '../asistenciaApi';

describe('AsistenciaAdminView (solo administrador)', () => {
  it('muestra el día con estado por persona', async () => {
    reporteHoy.mockResolvedValue({
      jornada: '2026-11-06',
      filas: [
        { partyId: 7, nombre: 'Luis Pérez', turno: { entrada: '09:00', salida: '18:00', almuerzo: null }, estado: 'TARDANZA', alertas: [], entrada: '09:15', salida: null, trabajadaMin: 0, tardanzaMin: 15 },
      ],
    });
    render(<AsistenciaAdminView />);
    expect(await screen.findByText('Luis Pérez')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Tardanza')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reiniciar celular' })).toBeInTheDocument();
  });

  it('sin ubicación del local lo avisa y «Usar mi ubicación actual» llena las coordenadas con su precisión', async () => {
    reporteHoy.mockResolvedValue({ jornada: '2026-11-06', filas: [] });
    (navigator as any).geolocation = {
      getCurrentPosition: (ok: any) => ok({ coords: { latitude: -12.1, longitude: -77.02, accuracy: 45 } }),
    };
    render(<AsistenciaAdminView />);
    expect(await screen.findByTestId('aviso-sin-ubicacion')).toHaveTextContent('nadie podrá marcar');
    fireEvent.click(screen.getByRole('tab', { name: 'Configuración' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación actual' }));
    expect(await screen.findByText(/Precisión obtenida: 45 m/)).toHaveTextContent('peor que 30 m');
    expect(screen.getByRole('link', { name: 'Ver en Google Maps' })).toHaveAttribute('href', 'https://www.google.com/maps?q=-12.1,-77.02');
  });

  it('el CSV del mes escapa comas y comillas', () => {
    const csv = csvDeFilas([
      { partyId: 7, nombre: 'Pérez, Luis "L"', jornada: '2026-11-06', estado: 'CUMPLIO', programadaMin: 480, trabajadaMin: 470, tardanzaMin: 0, salioAntesMin: 0, extraMin: 0, alertas: [] },
    ]);
    const lineas = csv.trim().split('\n');
    expect(lineas[0]).toBe('persona,fecha,estado,programada_h,trabajada_h,tardanza_min,salio_antes_min,extra_min,alertas');
    expect(lineas[1]).toBe('"Pérez, Luis ""L""",2026-11-06,Cumplió,8.00,7.83,0,0,0,');
  });
});
