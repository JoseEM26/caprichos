import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CierreView } from '../CierreView';
import { HistorialCierres } from '../HistorialCierres';
import { reiniciarBorradores } from '../cuadre.util';
import { cierreApi, AjusteMedio, DigitalesCaja } from '../cierreApi';
import { pedidosApi } from '../../pedidos/pedidosApi';
import * as sesionModulo from '../../../comun/sesion';

function usarSesion(rol: 'ADMIN' | 'CAJERO') {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: rol === 'ADMIN' ? '2' : '101', nombres: 'Ana', rol },
    permisos: ['caja/ver', 'caja/cerrar'],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: vi.fn().mockReturnValue(true),
  } as any);
}

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

const digitales: DigitalesCaja = {
  cajaId: 10,
  fecha: `${hoy()}T00:00:00.000Z`,
  medios: {
    yape: { monto: 200, sistema: 200, cobrado: 200, devuelto: 0, cobros: 1, corregido: false },
    plin: { monto: 0, sistema: 0, cobrado: 0, devuelto: 0, cobros: 0, corregido: false },
    transferencia: { monto: 50, sistema: 50, cobrado: 50, devuelto: 0, cobros: 1, corregido: false },
    tarjeta: { monto: 100, sistema: 100, cobrado: 100, devuelto: 0, cobros: 2, corregido: false },
  },
};

const ajuste: AjusteMedio = {
  id: 1,
  medio: 'YAPE',
  montoSistema: 200,
  montoAnterior: 200,
  montoNuevo: 210,
  motivo: 'El voucher dice 210, no 200',
  porNombre: 'Ana Cajera',
  autorizadoPorNombre: 'Rosa Supervisora',
  creadoEn: '2026-10-21T16:00:00.000Z',
};

describe('cierre: medios digitales calculados por el sistema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reiniciarBorradores();
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({
      abierta: true,
      caja: { id: 10, estado: 'ABIERTA', apertura: 50 },
    } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'listarPendientesDeCobro').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'obtenerEsperado').mockResolvedValue({
      cajaId: 10,
      fecha: `${hoy()}T00:00:00.000Z`,
      apertura: 50,
      efectivoEsperado: 355,
      medios: { efectivo: 355, yape: 200, plin: 0, transferencia: 50, tarjeta: 100 },
      desglose: { ventasEfectivo: 300, ingresos: 20, egresos: 15 },
    } as any);
    vi.spyOn(cierreApi, 'obtenerDigitales').mockResolvedValue(digitales);
    vi.spyOn(cierreApi, 'listarAjustesMedio').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'registrarAjusteMedio').mockResolvedValue(ajuste);
    vi.spyOn(cierreApi, 'realizarArqueo').mockResolvedValue({ resultado: 'NO_CUADRA', intento: 1 } as any);
  });

  async function abrirConteo() {
    // Una sola pantalla «Cuadre de caja»: ya no hay paso de verificación aparte
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar caja y cuadrar' }));
    await screen.findByTestId('cuadre-caja');
  }

  it('el panel muestra Yape, Plin, Transferencia y Tarjeta con el monto del sistema y el campo vacío para escribir', async () => {
    usarSesion('ADMIN');
    render(<CierreView />);
    await abrirConteo();

    const yape = screen.getByTestId('digital-yape');
    expect(yape).toHaveTextContent('Sistema S/ 200.00');
    const campo = within(yape).getByLabelText('Lo que veo en mi app/POS');
    expect(campo).toHaveValue('');
    expect(screen.getByTestId('digital-tarjeta')).toHaveTextContent('Sistema S/ 100.00');
    expect(screen.getByTestId('digital-transferencia')).toHaveTextContent('Sistema S/ 50.00');
    expect(screen.getByTestId('digital-plin')).toHaveTextContent('Sistema S/ 0.00');
  });

  it('las devoluciones del día salen informadas y el sistema ya las trae descontadas (antes: desglose cobrado/devuelto por medio)', async () => {
    usarSesion('ADMIN');
    vi.spyOn(cierreApi, 'obtenerEsperado').mockResolvedValue({
      cajaId: 10,
      fecha: `${hoy()}T00:00:00.000Z`,
      apertura: 50,
      efectivoEsperado: 355,
      medios: { efectivo: 355, yape: 150, plin: 0, transferencia: 50, tarjeta: 100 },
      desglose: { ventasEfectivo: 300, ingresos: 20, egresos: 15 },
      cobrados: [],
      movimientos: [],
    } as any);
    vi.spyOn(cierreApi, 'listarDevolucionesTurno').mockResolvedValue([
      { id: '1', pedidoCodigo: 'PED-9', montoDevuelto: 50, medio: 'YAPE', codigoOperacion: null, motivo: null, porNombre: null, autorizadoPorNombre: null, comprobanteBajaEstado: null, creadoEn: '2026-10-21T17:00:00Z' },
    ]);
    render(<CierreView />);
    await abrirConteo();

    expect(screen.getByTestId('digital-yape')).toHaveTextContent('Sistema S/ 150.00');
    expect(screen.getByTestId('cc-devoluciones')).toHaveTextContent('PED-9 S/ 50.00 YAPE');
    expect(screen.getByTestId('cc-devoluciones')).toHaveTextContent('ya están descontadas');
  });

  it('el cajero también ve el esperado y el desglose del efectivo (sin código)', async () => {
    usarSesion('CAJERO');
    render(<CierreView />);
    await abrirConteo();

    expect(cierreApi.obtenerEsperado).toHaveBeenCalled();
    expect(screen.getByTestId('cc-deberia')).toHaveTextContent('S/ 355.00');
    expect(screen.queryByLabelText(/código/i)).not.toBeInTheDocument();
  });

  it('corregir: el motivo es obligatorio y el cajero no escribe ningún código', async () => {
    usarSesion('CAJERO');
    render(<CierreView />);
    await abrirConteo();

    fireEvent.click(await screen.findByRole('button', { name: 'Corregir Yape' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Corregir monto de Yape' });
    expect(dialogo).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Monto nuevo'), { target: { value: '210' } });
    fireEvent.change(screen.getByLabelText('Motivo del cambio'), { target: { value: 'corto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('mínimo 10 caracteres');
    expect(cierreApi.registrarAjusteMedio).not.toHaveBeenCalled();

    expect(screen.queryByLabelText('Código de supervisor')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo del cambio'), { target: { value: 'El voucher dice 210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));

    await waitFor(() =>
      expect(cierreApi.registrarAjusteMedio).toHaveBeenCalledWith({ medio: 'YAPE', montoNuevo: 210, motivo: 'El voucher dice 210' }),
    );
    expect(await screen.findByText('Corrección guardada: Yape ahora vale s/ 210.00.')).toBeInTheDocument();
  });

  it('el ADMIN corrige con motivo y sin código', async () => {
    usarSesion('ADMIN');
    render(<CierreView />);
    await abrirConteo();

    fireEvent.click(await screen.findByRole('button', { name: 'Corregir Tarjeta' }));
    expect(screen.queryByLabelText('Código de supervisor')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Monto nuevo'), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText('Motivo del cambio'), { target: { value: 'Terminal cobró 90 real' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }));

    await waitFor(() =>
      expect(cierreApi.registrarAjusteMedio).toHaveBeenCalledWith(
        { medio: 'TARJETA', montoNuevo: 90, motivo: 'Terminal cobró 90 real' },
      ),
    );
  });

  it('la lista «Correcciones de esta caja» muestra medio, montos, motivo, quién lo hizo y quién lo aprobó', async () => {
    usarSesion('ADMIN');
    vi.spyOn(cierreApi, 'listarAjustesMedio').mockResolvedValue([ajuste]);
    vi.spyOn(cierreApi, 'obtenerDigitales').mockResolvedValue({
      ...digitales,
      medios: { ...digitales.medios, yape: { monto: 210, sistema: 200, cobrado: 200, devuelto: 0, cobros: 1, corregido: true } },
    });
    render(<CierreView />);
    await abrirConteo();

    const lista = await screen.findByTestId('lista-correcciones');
    expect(lista).toHaveTextContent('Correcciones de esta caja');
    expect(lista).toHaveTextContent('Yape: s/ 200.00 → s/ 210.00');
    expect(lista).toHaveTextContent('Motivo: El voucher dice 210, no 200');
    expect(lista).toHaveTextContent('Hecha por Ana Cajera · aprobada por Rosa Supervisora');
    expect(screen.getByTestId('digital-yape')).toHaveTextContent('Sistema S/ 200.00');
  });

  it('el historial muestra en el detalle del cierre las correcciones de medios digitales', async () => {
    usarSesion('ADMIN');
    vi.spyOn(cierreApi, 'obtenerHistorial').mockResolvedValue({
      cierres: [
        {
          cajaId: 10,
          fecha: '2026-10-21T00:00:00.000Z',
          apertura: 50,
          cerradaPor: 2,
          cerradaEn: '2026-10-21T23:00:00.000Z',
          cierre: { resultado: 'NO_CUADRA', aprobadoPor: 2, nota: 'Voucher', medios: [] },
        },
      ],
      total: 1,
      pagina: 1,
      limite: 20,
      totalPaginas: 1,
    } as any);
    vi.spyOn(cierreApi, 'obtenerCierrePorId').mockResolvedValue({
      cajaId: 10,
      fecha: '2026-10-21T00:00:00.000Z',
      apertura: 50,
      resultado: 'NO_CUADRA',
      aprobadoPor: 2,
      nota: 'Voucher',
      cerradaPor: 2,
      cerradaPorNombre: 'Ana Cajera',
      cerradaEn: '2026-10-21T23:00:00.000Z',
      conteo: {},
      medios: [],
      ajustesMedio: [ajuste],
    } as any);

    render(<HistorialCierres />);
    fireEvent.click(await screen.findByText(/21\/10\/2026/));

    expect(await screen.findByText('Correcciones de medios digitales')).toBeInTheDocument();
    expect(screen.getByText('Motivo: El voucher dice 210, no 200')).toBeInTheDocument();
    expect(screen.getByText(/aprobada por Rosa Supervisora/)).toBeInTheDocument();
  });
});
