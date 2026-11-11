import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const miHoy = vi.fn();
const marcarAsistencia = vi.fn();
const marcarManual = vi.fn();
const miPropinas = vi.fn();
const miResumen = vi.fn();
const miCalendario = vi.fn();
const miPlanilla = vi.fn();
const miInconsistencias = vi.fn();
vi.mock('../miCalendarioApi', () => ({
  miCalendario: (...a: any[]) => miCalendario(...a),
  miPlanilla: (...a: any[]) => miPlanilla(...a),
}));
vi.mock('../correccionesApi', async (orig) => ({
  ...(await orig<any>()),
  miInconsistencias: (...a: any[]) => miInconsistencias(...a),
  misSolicitudes: vi.fn().mockResolvedValue([]),
}));
vi.mock('../asistenciaApi', async (orig) => ({
  ...(await orig<any>()),
  miHoy: (...a: any[]) => miHoy(...a),
  marcarAsistencia: (...a: any[]) => marcarAsistencia(...a),
  marcarManual: (...a: any[]) => marcarManual(...a),
  miPropinas: (...a: any[]) => miPropinas(...a),
  miResumen: (...a: any[]) => miResumen(...a),
}));
vi.mock('jsqr', () => ({ default: vi.fn().mockReturnValue(null) }));

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
  localConUbicacion: true,
};
const gps = { coords: { latitude: -12, longitude: -77, accuracy: 7 } };
const pista = { stop: vi.fn() };

function prepararDispositivo(camara?: any) {
  (navigator as any).mediaDevices = {
    getUserMedia: camara ?? vi.fn().mockResolvedValue({ getTracks: () => [pista] }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  };
  (navigator as any).geolocation = { getCurrentPosition: (ok: any) => ok(gps) };
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
}

const pestana = (n: RegExp | string) => screen.getByRole('tab', { name: n });
const paso = () => screen.getByTestId('ma-anuncio').textContent;

/** Llega hasta «Confirmar» con código escrito, GPS y selfie tomada. */
async function hastaConfirmar() {
  fireEvent.click(await screen.findByRole('button', { name: /^Entrada/ }));
  fireEvent.change(screen.getByLabelText(/código de 6 dígitos/), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Tomar selfie' }));
  await screen.findByTestId('resumen-marca');
}

describe('Mi asistencia en pestañas', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    miHoy.mockReset().mockResolvedValue(base);
    marcarAsistencia.mockReset();
    marcarManual.mockReset();
    miPropinas.mockReset().mockResolvedValue([]);
    miResumen.mockReset().mockResolvedValue(null);
    miCalendario.mockReset().mockResolvedValue({ desde: '2026-11-01', hasta: '2026-11-30', dias: [] });
    miPlanilla.mockReset().mockResolvedValue({});
    miInconsistencias.mockReset().mockResolvedValue([]);
    prepararDispositivo();
  });

  describe('pestañas', () => {
    it('arranca en Marcar, con 4 pestañas y roles tablist/tab/tabpanel', async () => {
      render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      expect(screen.getByRole('tablist', { name: 'Secciones de Mi asistencia' })).toBeInTheDocument();
      expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Marcar', 'Período', 'Calendario', 'Pagos']);
      expect(pestana('Marcar')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { name: 'Marcar' })).toBeVisible();
    });

    it('cambia con el clic y con las flechas del teclado', async () => {
      render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      fireEvent.click(pestana('Pagos'));
      expect(pestana('Pagos')).toHaveAttribute('aria-selected', 'true');
      fireEvent.keyDown(pestana('Pagos'), { key: 'ArrowRight' });
      expect(pestana('Marcar')).toHaveAttribute('aria-selected', 'true');
      fireEvent.keyDown(pestana('Marcar'), { key: 'ArrowLeft' });
      expect(pestana('Pagos')).toHaveAttribute('aria-selected', 'true');
    });

    it('la franja de estado de hoy se ve en todas las pestañas', async () => {
      render(<MiAsistenciaView />);
      for (const n of ['Marcar', 'Período', 'Calendario', 'Pagos']) {
        fireEvent.click(await screen.findByRole('tab', { name: new RegExp(n) }));
        expect(screen.getByTestId('estado-hoy')).toHaveTextContent('Te falta marcar: Entrada');
        expect(screen.getByText('Tu turno: 09:00 a 18:00')).toBeVisible();
      }
    });

    it('fuera de Marcar la franja ofrece «Ir a marcar»', async () => {
      render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      expect(screen.queryByRole('button', { name: 'Ir a marcar' })).toBeNull();
      fireEvent.click(pestana('Pagos'));
      fireEvent.click(screen.getByRole('button', { name: 'Ir a marcar' }));
      expect(pestana('Marcar')).toHaveAttribute('aria-selected', 'true');
    });

    it('conserva lo escrito y el paso del marcado al cambiar de pestaña', async () => {
      render(<MiAsistenciaView />);
      fireEvent.click(await screen.findByRole('button', { name: /^Entrada/ }));
      fireEvent.change(screen.getByLabelText(/código de 6 dígitos/), { target: { value: '654321' } });
      fireEvent.click(pestana('Calendario'));
      expect(screen.getAllByRole('tabpanel', { hidden: true })[0]).not.toBeVisible();
      fireEvent.click(pestana('Marcar'));
      expect(screen.getByLabelText(/código de 6 dígitos/)).toHaveValue('654321');
      expect(paso()).toContain('Escanea el QR');
    });

    it('apaga la cámara al salir de Marcar', async () => {
      pista.stop.mockReset();
      render(<MiAsistenciaView />);
      fireEvent.click(await screen.findByRole('button', { name: /^Entrada/ }));
      await waitFor(() => expect((navigator as any).mediaDevices.getUserMedia).toHaveBeenCalled());
      fireEvent.click(pestana('Pagos'));
      await waitFor(() => expect(pista.stop).toHaveBeenCalled());
    });

    it('recuerda la última pestaña en este equipo y la pone en la URL', async () => {
      const a = render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      fireEvent.click(pestana('Pagos'));
      expect(window.location.search).toBe('?pestana=pagos');
      a.unmount();
      window.history.replaceState(null, '', '/');
      render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      expect(pestana('Pagos')).toHaveAttribute('aria-selected', 'true');
    });

    it('?pestana= de la URL manda sobre lo recordado; un valor inválido se ignora', async () => {
      window.localStorage.setItem('mi-asistencia-pestana:sin-sesion', 'pagos');
      window.history.replaceState(null, '', '/?pestana=calendario');
      const a = render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      expect(pestana('Calendario')).toHaveAttribute('aria-selected', 'true');
      a.unmount();
      window.history.replaceState(null, '', '/?pestana=cualquiera');
      window.localStorage.clear();
      render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      expect(pestana('Marcar')).toHaveAttribute('aria-selected', 'true');
    });

    it('si el almacenamiento falla, igual funciona', async () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error('bloqueado'); };
      try {
        render(<MiAsistenciaView />);
        await screen.findByTestId('estado-hoy');
        fireEvent.click(pestana('Pagos'));
        expect(pestana('Pagos')).toHaveAttribute('aria-selected', 'true');
      } finally {
        Storage.prototype.setItem = original;
      }
    });

    it('insignias: propinas por pagar y correcciones pendientes', async () => {
      miPropinas.mockResolvedValue([{ anio: 2026, mes: 10, estado: 'APROBADO', horas: 5, porcentaje: 10, monto: 20, pagadoEn: null, pagadoMedio: null }]);
      miInconsistencias.mockResolvedValue([{ jornada: '2026-11-04', texto: 'Falta salida', etiqueta: 'Salida', falta: 'SALIDA', estado: 'PENDIENTE' }]);
      render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      expect(pestana(/Período/)).toHaveTextContent('1');
      expect(pestana(/Calendario/)).toHaveTextContent('1');
    });

    it('360 px: la barra de pestañas hace scroll horizontal propio y no ensancha la página', async () => {
      render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      expect(screen.getByRole('tablist').className).toContain('mcp-barra');
      expect(screen.getByRole('tablist').closest('.ma-cab')).not.toBeNull(); // contenedor fijo (sticky) arriba
    });
  });

  describe('contenido de cada pestaña', () => {
    it('Mi período: resumen, propinas con «Ver N más»', async () => {
      miResumen.mockResolvedValue({ modalidad: 'SEMANAL', periodo: { desde: '2026-11-02', hasta: '2026-11-08' }, programadasH: 40, trabajadasH: 12, tardanzas: 1, tardanzaMin: 6, faltas: 0, jornadasPorRevisar: 0 });
      miPropinas.mockResolvedValue([5, 6, 7, 8, 9].map((mes) => ({ anio: 2026, mes, estado: 'PAGADO', horas: 5, porcentaje: 10, monto: 20, pagadoEn: '2026-11-03T15:00:00Z', pagadoMedio: 'EFECTIVO' })));
      render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      fireEvent.click(pestana(/Período/));
      expect(screen.getByRole('region', { name: 'Mi período' })).toHaveTextContent('Horas trabajadas: 12 h');
      const propinas = screen.getByRole('region', { name: 'Mis propinas' });
      expect(within(propinas).getAllByText(/Pagado/)).toHaveLength(3);
      fireEvent.click(within(propinas).getByRole('button', { name: 'Ver 2 más' }));
      expect(within(propinas).getAllByText(/Pagado/)).toHaveLength(5);
    });

    it('Mi período sin resumen: estado vacío con Reintentar que vuelve a pedir', async () => {
      render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      fireEvent.click(pestana(/Período/));
      const vacio = screen.getByTestId('periodo-vacio');
      const antes = miResumen.mock.calls.length;
      fireEvent.click(within(vacio).getByRole('button', { name: 'Reintentar' }));
      await waitFor(() => expect(miResumen.mock.calls.length).toBe(antes + 1));
    });

    it('Calendario: error con Reintentar', async () => {
      miCalendario.mockRejectedValueOnce(new Error('sin red'));
      render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      fireEvent.click(pestana(/Calendario/));
      expect(await screen.findByText(/No pudimos cargar tu calendario/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByRole('region', { name: 'Mi calendario de asistencia' })).toBeInTheDocument();
      expect(miCalendario).toHaveBeenCalledTimes(2);
    });

    it('Pagos: carga, error con Reintentar y vuelve a cargar', async () => {
      miPlanilla.mockRejectedValueOnce(new Error('sin red'));
      render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      fireEvent.click(pestana('Pagos'));
      expect(await screen.findByText(/No pudimos cargar tus pagos/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByTestId('mis-pagos')).toBeInTheDocument();
    });

    it('si no carga «hoy»: error con Reintentar', async () => {
      miHoy.mockRejectedValueOnce(new Error('sin red'));
      render(<MiAsistenciaView />);
      expect(await screen.findByText('No pudimos cargar tu asistencia')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByTestId('estado-hoy')).toBeInTheDocument();
    });
  });

  describe('asistente de marcado', () => {
    it('muestra un solo paso a la vez, con «Paso N de 5», progreso y aria-current', async () => {
      render(<MiAsistenciaView />);
      await screen.findByTestId('estado-hoy');
      expect(paso()).toBe('Paso 1 de 5: ¿Qué estás haciendo?');
      expect(screen.queryByRole('heading', { name: 'Escanea el QR' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /^Entrada/ }));
      expect(paso()).toBe('Paso 2 de 5: Escanea el QR');
      expect(screen.getByRole('progressbar')).toHaveAttribute('value', '2');
      const actual = within(screen.getByRole('list', { name: 'Pasos de la marca' })).getAllByRole('listitem').find((li) => li.getAttribute('aria-current') === 'step');
      expect(actual).toHaveTextContent('QR');
      expect(screen.queryByRole('heading', { name: 'Tu ubicación' })).toBeNull();
    });

    it('recorre acción, QR, ubicación, selfie y confirmar, y registra', async () => {
      marcarAsistencia.mockResolvedValue({ ok: true, mensaje: 'Marcaste tu entrada', marca: { estado: 'VALIDA' } });
      render(<MiAsistenciaView />);
      await hastaConfirmar();
      expect(paso()).toBe('Paso 5 de 5: Confirma tu marca');
      const resumen = screen.getByTestId('resumen-marca');
      expect(resumen).toHaveTextContent('Entrada');
      expect(resumen).toHaveTextContent('± 7 m');
      expect(within(resumen).getByAltText('Selfie de la marca')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar marca' }));
      await waitFor(() => expect(marcarAsistencia).toHaveBeenCalled());
      expect(marcarAsistencia.mock.calls[0][0]).toMatchObject({ tipo: 'ENTRADA', codigo: '123456', lat: -12, lng: -77, precision: 7 });
      expect(await screen.findByText('Marca registrada')).toBeInTheDocument();
    });

    it('Siguiente explica qué falta junto al campo, y se habilita al completarlo', async () => {
      render(<MiAsistenciaView />);
      fireEvent.click(await screen.findByRole('button', { name: /^Entrada/ }));
      const siguiente = screen.getByRole('button', { name: 'Siguiente' });
      expect(siguiente).toBeDisabled();
      expect(screen.getByTestId('ma-falta')).toHaveTextContent('Falta escanear el QR');
      expect(siguiente).toHaveAttribute('aria-describedby', 'ma-falta');
      expect(screen.getByLabelText(/código de 6 dígitos/)).toHaveAttribute('aria-describedby', 'ma-falta');
      fireEvent.change(screen.getByLabelText(/código de 6 dígitos/), { target: { value: '12345' } });
      expect(siguiente).toBeDisabled();
      fireEvent.change(screen.getByLabelText(/código de 6 dígitos/), { target: { value: '123456' } });
      expect(siguiente).toBeEnabled();
      expect(screen.queryByTestId('ma-falta')).toBeNull();
    });

    it('Atrás no pierde el código, la ubicación ni la selfie', async () => {
      render(<MiAsistenciaView />);
      await hastaConfirmar();
      fireEvent.click(screen.getByRole('button', { name: 'Atrás' })); // selfie
      expect(paso()).toBe('Paso 4 de 5: Tu selfie');
      expect(screen.getByAltText('Selfie tomada')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Tomar selfie' })).toBeNull();
      const llamadasGps = vi.spyOn((navigator as any).geolocation, 'getCurrentPosition');
      fireEvent.click(screen.getByRole('button', { name: 'Atrás' })); // ubicación
      expect(paso()).toBe('Paso 3 de 5: Tu ubicación');
      expect(screen.getByTestId('ubicacion-leida')).toHaveTextContent('7 m');
      expect(llamadasGps).not.toHaveBeenCalled(); // no vuelve a leer el GPS
      fireEvent.click(screen.getByRole('button', { name: 'Atrás' })); // QR
      expect(screen.getByLabelText(/código de 6 dígitos/)).toHaveValue('123456');
      fireEvent.click(screen.getByRole('button', { name: 'Atrás' })); // acción
      expect(paso()).toBe('Paso 1 de 5: ¿Qué estás haciendo?');
      expect(screen.getByRole('button', { name: /^Entrada/ })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      expect(await screen.findByTestId('resumen-marca')).toBeInTheDocument();
    });

    it('QR leído por la cámara: queda marcado y no reabre la cámara al volver', async () => {
      const jsqr = (await import('jsqr')).default as any;
      jsqr.mockReturnValue({ data: 'CAPRICHOS-ASIST:1:abc' });
      render(<MiAsistenciaView />);
      fireEvent.click(await screen.findByRole('button', { name: /^Entrada/ }));
      await waitFor(() => expect(paso()).toBe('Paso 3 de 5: Tu ubicación'), { timeout: 2500 });
      fireEvent.click(await screen.findByRole('button', { name: 'Tomar selfie' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Atrás' }));
      fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
      fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
      expect(screen.getByTestId('qr-leido')).toBeInTheDocument();
      jsqr.mockReturnValue(null);
    });

    it('si el servidor rechaza por el QR, vuelve al paso del QR con el mensaje y conserva ubicación y selfie', async () => {
      marcarAsistencia.mockRejectedValue({ mensaje: 'El QR venció o no es válido. Escanea el de la pantalla actual.' });
      render(<MiAsistenciaView />);
      await hastaConfirmar();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar marca' }));
      expect(await screen.findByTestId('ma-error')).toHaveTextContent('El QR venció');
      expect(paso()).toBe('Paso 2 de 5: Escanea el QR');
      expect(screen.getByLabelText(/código de 6 dígitos/)).toHaveValue('');
      expect(screen.getByRole('alert', { name: '' })).toBeInTheDocument();
    });

    it('si rechaza por la distancia, vuelve a la ubicación y no la relee sola', async () => {
      marcarAsistencia.mockRejectedValue({ mensaje: 'Estás a 40 m del local. Debes estar a 10 m o menos para marcar.' });
      render(<MiAsistenciaView />);
      await hastaConfirmar();
      const gpsSpy = vi.spyOn((navigator as any).geolocation, 'getCurrentPosition');
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar marca' }));
      expect(await screen.findByTestId('ma-error')).toHaveTextContent('Estás a 40 m del local');
      expect(paso()).toBe('Paso 3 de 5: Tu ubicación');
      expect(screen.getByRole('button', { name: 'Leer otra vez' })).toBeInTheDocument();
      expect(gpsSpy).not.toHaveBeenCalled();
    });

    it('si rechaza por la foto, vuelve a la selfie', async () => {
      marcarAsistencia.mockRejectedValue({ mensaje: 'La foto no es válida. Vuelve a tomarla.' });
      render(<MiAsistenciaView />);
      await hastaConfirmar();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar marca' }));
      expect(await screen.findByTestId('ma-error')).toHaveTextContent('La foto no es válida');
      expect(paso()).toBe('Paso 4 de 5: Tu selfie');
      expect(await screen.findByRole('button', { name: 'Tomar selfie' })).toBeInTheDocument();
    });

    it('un rechazo general (otro celular, ya marcado) vuelve al primer paso', async () => {
      marcarAsistencia.mockRejectedValue({ mensaje: 'Esa marca ya quedó registrada hoy.' });
      render(<MiAsistenciaView />);
      await hastaConfirmar();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar marca' }));
      expect(await screen.findByTestId('ma-error')).toHaveTextContent('ya quedó registrada');
      expect(paso()).toBe('Paso 1 de 5: ¿Qué estás haciendo?');
    });

    it('marcado manual: solo 2 pasos (acción y ubicación), QR y selfie no son necesarios', async () => {
      marcarManual.mockResolvedValue({ ok: true, mensaje: 'Listo', marca: { estado: 'A_REVISAR' } });
      render(<MiAsistenciaView />);
      fireEvent.click(await screen.findByRole('button', { name: 'Marcar manualmente (sin QR)' }));
      await waitFor(() => expect(marcarManual).toHaveBeenCalledWith({ lat: -12, lng: -77, precision: 7, tipo: 'ENTRADA' }));
      expect(marcarAsistencia).not.toHaveBeenCalled();
      expect(await screen.findByRole('status')).toHaveTextContent('queda para revisión del administrador');
    });

    it('marcado manual: el aviso explica que QR y selfie no se necesitan', async () => {
      (navigator as any).geolocation = { getCurrentPosition: () => undefined }; // el GPS no responde: se queda en el paso
      render(<MiAsistenciaView />);
      fireEvent.click(await screen.findByRole('button', { name: 'Marcar manualmente (sin QR)' }));
      expect(paso()).toBe('Paso 2 de 2: Tu ubicación');
      expect(screen.getByText(/no son necesarios en este modo/)).toBeInTheDocument();
      expect(screen.getAllByRole('listitem').filter((li) => li.getAttribute('aria-current') === 'step')).toHaveLength(1);
    });

    it('GPS denegado: mensaje, Siguiente deshabilitado con la razón y Atrás disponible', async () => {
      (navigator as any).geolocation = { getCurrentPosition: (_ok: any, err: any) => err({ code: 1 }) };
      render(<MiAsistenciaView />);
      fireEvent.click(await screen.findByRole('button', { name: /^Entrada/ }));
      fireEvent.change(screen.getByLabelText(/código de 6 dígitos/), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      expect(await screen.findByTestId('error-ubicacion')).toHaveTextContent(/candado/);
      expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
      expect(screen.getByTestId('ma-falta')).toHaveTextContent('Falta tu ubicación');
      fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
      expect(screen.getByLabelText(/código de 6 dígitos/)).toHaveValue('123456');
    });

    it('cámara de selfie que no abre: continuar sin foto salta a confirmar con aviso de revisión', async () => {
      const gum = vi.fn().mockResolvedValueOnce({ getTracks: () => [pista] }).mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
      prepararDispositivo(gum);
      marcarAsistencia.mockResolvedValue({ ok: true, mensaje: 'Listo', marca: { estado: 'A_REVISAR' } });
      render(<MiAsistenciaView />);
      fireEvent.click(await screen.findByRole('button', { name: /^Entrada/ }));
      fireEvent.change(screen.getByLabelText(/código de 6 dígitos/), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      expect(await screen.findByTestId('error-camara-selfie')).toBeInTheDocument();
      expect(screen.getByTestId('ma-falta')).toHaveTextContent('continúa sin foto');
      fireEvent.click(screen.getByRole('button', { name: 'Continuar sin foto' }));
      expect(await screen.findByTestId('resumen-marca')).toHaveTextContent('Sin foto (queda para revisión)');
      fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
      expect(screen.getByTestId('sin-foto')).toBeInTheDocument();
    });

    it('al terminar ofrece «Hacer otra marca» y vuelve al primer paso', async () => {
      marcarAsistencia.mockResolvedValue({ ok: true, mensaje: 'Marcaste', marca: { estado: 'VALIDA' } });
      render(<MiAsistenciaView />);
      await hastaConfirmar();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar marca' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Hacer otra marca' }));
      expect(paso()).toBe('Paso 1 de 5: ¿Qué estás haciendo?');
    });
  });
});
