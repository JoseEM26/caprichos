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

const jsqrMock = vi.fn();
vi.mock('jsqr', () => ({ default: (...a: any[]) => jsqrMock(...a) }));

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

  describe('escáner QR por cámara', () => {
    const pista = { stop: vi.fn() };
    const abrir = async () => {
      render(<MiAsistenciaView />);
      fireEvent.click(await screen.findByRole('button', { name: 'Escanear QR' }));
    };
    beforeEach(() => {
      pista.stop.mockReset();
      miHoy.mockResolvedValue(base);
      delete (window as any).BarcodeDetector;
      Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
      HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: 1280, configurable: true });
      Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: 720, configurable: true });
      HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
        drawImage: vi.fn(),
        getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(4), width: w, height: h }),
      })) as any;
      jsqrMock.mockReset();
    });

    it('sin BarcodeDetector usa jsQR y avanza con el texto del QR tal cual', async () => {
      (navigator as any).mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [pista] }),
        enumerateDevices: vi.fn().mockResolvedValue([{ kind: 'videoinput' }, { kind: 'videoinput' }]),
      };
      (navigator as any).geolocation = { getCurrentPosition: () => undefined };
      jsqrMock.mockReturnValue({ data: 'CAPRICHOS-ASIST:123:abcdef' });
      await abrir();
      await waitFor(() => expect(screen.getByRole('heading', { name: '2. Ubicación' })).toBeInTheDocument(), { timeout: 2000 });
      expect(jsqrMock.mock.calls[0][1]).toBe(640); // fotograma reducido a 640 px de ancho
      expect(pista.stop).toHaveBeenCalled(); // cámara apagada al terminar
    });

    it('con varias cámaras ofrece «Cambiar cámara» y el código manual sigue visible', async () => {
      (navigator as any).mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [pista] }),
        enumerateDevices: vi.fn().mockResolvedValue([{ kind: 'videoinput' }, { kind: 'videoinput' }]),
      };
      jsqrMock.mockReturnValue(null);
      await abrir();
      fireEvent.click(await screen.findByRole('button', { name: 'Cambiar cámara' }));
      await waitFor(() => expect((navigator as any).mediaDevices.getUserMedia).toHaveBeenLastCalledWith({ video: { facingMode: 'user' }, audio: false }));
      expect(screen.getByText(/código de 6 dígitos/)).toBeInTheDocument();
    });

    it.each([
      ['NotAllowedError', /candado de la barra/],
      ['NotFoundError', /no tiene cámara/],
      ['NotReadableError', /ocupada/],
    ])('mensaje claro para %s', async (name, re) => {
      const e = new Error('x');
      e.name = name;
      (navigator as any).mediaDevices = { getUserMedia: vi.fn().mockRejectedValue(e) };
      await abrir();
      expect(await screen.findByTestId('error-camara')).toHaveTextContent(re);
    });

    it('contexto inseguro pide HTTPS', async () => {
      Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
      (navigator as any).mediaDevices = undefined;
      await abrir();
      expect(await screen.findByTestId('error-camara')).toHaveTextContent('HTTPS');
    });
  });
});
