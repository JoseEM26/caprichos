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

  it('sin ubicación del local: aviso con role alert y no deja marcar; historial sigue', async () => {
    miHoy.mockResolvedValue({ ...base, localConUbicacion: false });
    render(<MiAsistenciaView />);
    const aviso = await screen.findByTestId('aviso-sin-ubicacion');
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(aviso).toHaveTextContent('El administrador aún no configuró la ubicación del local. Todavía no puedes marcar; avísale.');
    expect(screen.getByRole('button', { name: 'Escanear QR' })).toBeDisabled();
    expect(miHistorial).toHaveBeenCalled();
  });

  it('con ubicación del local: sin aviso y puede marcar', async () => {
    miHoy.mockResolvedValue({ ...base, localConUbicacion: true });
    render(<MiAsistenciaView />);
    expect(await screen.findByRole('button', { name: 'Escanear QR' })).toBeEnabled();
    expect(screen.queryByTestId('aviso-sin-ubicacion')).toBeNull();
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

  it('sin turno hoy lo dice; igual puede marcar (el administrador la revisa)', async () => {
    miHoy.mockResolvedValue({ ...base, turno: null });
    render(<MiAsistenciaView />);
    expect(await screen.findByText('Hoy no tienes turno programado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escanear QR' })).toBeEnabled();
  });

  it('marcas múltiples: muestra cada marca con lo que se interpretó y la doble marca tachada; un solo botón', async () => {
    miHoy.mockResolvedValue({
      ...base,
      marcas: [
        { id: 1, tipo: 'ENTRADA', momento: '2026-11-06T14:00:00.000Z', estado: 'VALIDA', duplicada: false },
        { id: 2, tipo: 'ENTRADA', momento: '2026-11-06T14:01:00.000Z', estado: 'VALIDA', duplicada: true },
        { id: 3, tipo: 'SALIDA_ALMUERZO', momento: '2026-11-06T18:00:00.000Z', estado: 'VALIDA', duplicada: false },
      ],
      interpretacion: { estado: 'EN_CURSO', alertas: [] },
    });
    render(<MiAsistenciaView />);
    expect(await screen.findByText(/09:00 Entrada/)).toBeInTheDocument();
    expect(screen.getByText(/09:01 Entrada/)).toHaveStyle({ textDecoration: 'line-through' });
    expect(screen.getByText(/unida a la anterior/)).toBeInTheDocument();
    expect(screen.getByTestId('ultima-interpretacion')).toHaveTextContent('Salida a break');
    expect(screen.getByTestId('estado-hoy')).toHaveTextContent('Llevas 3 marcas hoy');
    expect(screen.getAllByRole('button', { name: 'Escanear QR' })).toHaveLength(1);
  });

  describe('aviso de datos una sola vez', () => {
    const sinAceptar = { ...base, consentimientoAceptado: false, consentimiento: { version: '2026-11', texto: 'Aviso de datos' } };
    const recorrido = async () => {
      const pista = { stop: vi.fn() };
      (navigator as any).mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [pista] }),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      };
      (navigator as any).geolocation = {
        getCurrentPosition: (ok: any) => ok({ coords: { latitude: -12, longitude: -77, accuracy: 5 } }),
        watchPosition: (ok: any) => { ok({ coords: { latitude: -12, longitude: -77, accuracy: 5 } }); return 1; },
        clearWatch: () => undefined,
      };
      delete (window as any).BarcodeDetector;
      Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
      HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: 1280, configurable: true });
      Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: 720, configurable: true });
      HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
        drawImage: vi.fn(),
        getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(4), width: w, height: h }),
      })) as any;
      HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,AAAA');
      jsqrMock.mockReturnValue({ data: 'CAPRICHOS-ASIST:123:abcdef' });
      fireEvent.click(await screen.findByRole('button', { name: 'Escanear QR' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Tomar selfie' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar marca' }));
    };

    it('tras un rechazo no relacionado recarga y el checkbox no reaparece', async () => {
      miHoy.mockResolvedValueOnce(sinAceptar).mockResolvedValue({ ...base, consentimientoAceptadoEn: '2026-11-06T13:00:00.000Z', textoConsentimiento: 'Aviso de datos' });
      marcarAsistencia.mockRejectedValue({ codigo: 'FUERA_DE_RADIO', mensaje: 'Estás lejos del local.' });
      render(<MiAsistenciaView />);
      fireEvent.click(await screen.findByRole('checkbox'));
      await recorrido();
      expect(await screen.findByText('Estás lejos del local.')).toBeInTheDocument();
      expect(miHoy).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('tras aceptar muestra «Aceptaste el aviso…» y Ver aviso despliega el texto', async () => {
      miHoy.mockResolvedValue({ ...base, consentimientoAceptadoEn: '2026-11-06T13:00:00.000Z', textoConsentimiento: 'Texto del aviso' });
      render(<MiAsistenciaView />);
      expect(await screen.findByTestId('aviso-aceptado')).toHaveTextContent(/Aceptaste el aviso de datos el/);
      expect(screen.queryByText(/Texto del aviso/)).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Ver aviso' }));
      expect(screen.getByText(/Texto del aviso/)).toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).toBeNull();
    });
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
