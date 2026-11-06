import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const miHoy = vi.fn();
const miHistorial = vi.fn();
const marcarAsistencia = vi.fn();
const miPropinas = vi.fn();
vi.mock('../asistenciaApi', async (orig) => ({
  ...(await orig<any>()),
  miHoy: (...a: any[]) => miHoy(...a),
  miHistorial: (...a: any[]) => miHistorial(...a),
  marcarAsistencia: (...a: any[]) => marcarAsistencia(...a),
  miPropinas: (...a: any[]) => miPropinas(...a),
}));

import { MiAsistenciaView } from '../MiAsistenciaView';

const base = {
  jornada: '2026-11-06',
  ahora: '2026-11-06T13:00:00.000Z',
  turno: { entrada: '09:00', salida: '18:00', almuerzo: null },
  estado: 'SIN_EVALUAR',
  marcas: [],
  pendiente: 'ENTRADA',
  permitidas: ['ENTRADA'],
  consentimientoAceptado: true,
  consentimiento: null,
  dispositivoVinculado: true,
};

describe('MiAsistenciaView (celular)', () => {
  beforeEach(() => {
    miHoy.mockReset();
    miHistorial.mockReset().mockResolvedValue([]);
    marcarAsistencia.mockReset();
    miPropinas.mockReset().mockResolvedValue([]);
  });

  it('Mis propinas: muestra solo mi parte de los repartos aprobados o pagados', async () => {
    miHoy.mockResolvedValue(base);
    miPropinas.mockResolvedValue([
      { anio: 2026, mes: 10, estado: 'PAGADO', horas: 56, porcentaje: 46.67, monto: 70, pagadoEn: '2026-11-03T15:00:00Z', pagadoMedio: 'EFECTIVO' },
    ]);
    render(<MiAsistenciaView />);
    const bloque = await screen.findByRole('region', { name: 'Mis propinas' });
    expect(bloque).toHaveTextContent('octubre 2026');
    expect(bloque).toHaveTextContent('56.00 h · 46.67 %');
    expect(bloque).toHaveTextContent('S/ 70.00');
    expect(bloque).toHaveTextContent('Pagado (EFECTIVO)');
  });

  it('sin repartos aprobados no muestra nada de propinas', async () => {
    miHoy.mockResolvedValue(base);
    render(<MiAsistenciaView />);
    await screen.findByTestId('estado-hoy');
    expect(screen.queryByRole('region', { name: 'Mis propinas' })).toBeNull();
  });

  it('dice qué marca falta y ofrece el botón grande', async () => {
    miHoy.mockResolvedValue(base);
    render(<MiAsistenciaView />);
    expect(await screen.findByTestId('estado-hoy')).toHaveTextContent('Te falta marcar: Entrada');
    expect(screen.getByRole('button', { name: 'Escanear QR' })).toBeEnabled();
  });

  it('pide aceptar el aviso de datos personales la primera vez y bloquea marcar hasta aceptarlo', async () => {
    miHoy.mockResolvedValue({
      ...base,
      consentimientoAceptado: false,
      consentimiento: { version: '2026-11', texto: 'Aviso de datos' },
    });
    render(<MiAsistenciaView />);
    expect(await screen.findByText('Aviso de datos')).toBeInTheDocument();
    const boton = screen.getByRole('button', { name: 'Escanear QR' });
    expect(boton).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Escanear QR' })).toBeEnabled());
  });

  it('sin turno hoy lo dice y no ofrece marcar', async () => {
    miHoy.mockResolvedValue({ ...base, turno: null, pendiente: null, permitidas: [] });
    render(<MiAsistenciaView />);
    expect(await screen.findByText('Hoy no tienes turno programado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar' })).toBeDisabled();
  });
});
