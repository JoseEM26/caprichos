import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArqueoCiegoForm } from '../ArqueoCiegoForm';
import { HistorialCierres } from '../HistorialCierres';
import { CierreView } from '../CierreView';
import { reiniciarBorradores } from '../cuadre.util';
import { cierreApi } from '../cierreApi';
import { pedidosApi } from '../../pedidos/pedidosApi';
import * as sesionModulo from '../../../comun/sesion';

describe('Ola F5: Caja y Cierres', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reiniciarBorradores();

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '2', nombres: 'Cajera Carmen', rol: 'CAJERO' },
      permisos: ['caja/ver', 'caja/cerrar', 'repartos/liquidar'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    });
  });

  it('el arqueo suma por denominación y no muestra lo esperado', () => {
    render(<ArqueoCiegoForm />);

    // Conteo por denominación: 3 billetes de 100, 2 billetes de 20, 5 monedas de 1
    // Total: 3 * 100 + 2 * 20 + 5 * 1 = 345.00
    const input100 = screen.getByLabelText(/^cantidad de billetes de s\/ 100$/i);
    const input20 = screen.getByLabelText(/^cantidad de billetes de s\/ 20$/i);
    const input1 = screen.getByLabelText(/^cantidad de monedas de s\/ 1\.00$/i);

    fireEvent.change(input100, { target: { value: '3' } });
    fireEvent.change(input20, { target: { value: '2' } });
    fireEvent.change(input1, { target: { value: '5' } });

    // La suma en pantalla se actualiza reactivamente
    const totalContado = screen.getByTestId('total-efectivo-contado');
    expect(totalContado).toHaveTextContent('Total efectivo: S/ 345.00');

    // No debe mostrar lo esperado por el sistema (cierre ciego para cajero)
    expect(screen.queryByText(/total esperado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/esperado efectivo/i)).not.toBeInTheDocument();
  });

  it('tras el tercer intento ya no pide ningún código de supervisor', async () => {
    // Simulamos 3 intentos fallidos de arqueo
    vi.spyOn(cierreApi, 'realizarArqueo')
      .mockResolvedValueOnce({ resultado: 'NO_CUADRA', intento: 1 })
      .mockResolvedValueOnce({ resultado: 'NO_CUADRA', intento: 2 })
      .mockResolvedValueOnce({ resultado: 'NO_CUADRA', intento: 3 });

    render(<ArqueoCiegoForm />);

    const botonRevisar = screen.getByRole('button', { name: /revisar arqueo ciego/i });

    // Intento 1
    fireEvent.click(botonRevisar);
    await waitFor(() => {
      expect(screen.getByText('Intento #1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('seccion-pin-supervisor')).not.toBeInTheDocument();

    // Intento 2
    fireEvent.click(botonRevisar);
    await waitFor(() => {
      expect(screen.getByText('Intento #2')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('seccion-pin-supervisor')).not.toBeInTheDocument();

    // Intento 3: tampoco hay código de supervisor; el cierre solo pedirá la nota
    fireEvent.click(botonRevisar);
    await waitFor(() => {
      expect(screen.getByText('Intento #3')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('seccion-pin-supervisor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pin-supervisor-input')).not.toBeInTheDocument();
  });

  it('un arqueo que cuadra no suma: dos que no cuadraron y uno que cuadra: sin código de supervisor', async () => {
    vi.spyOn(cierreApi, 'realizarArqueo')
      .mockResolvedValueOnce({ resultado: 'NO_CUADRA', intento: 1 })
      .mockResolvedValueOnce({ resultado: 'NO_CUADRA', intento: 2 })
      .mockResolvedValueOnce({ resultado: 'CUADRA', intento: 3 });

    render(<ArqueoCiegoForm />);

    const botonRevisar = screen.getByRole('button', { name: /revisar arqueo ciego/i });
    for (const n of [1, 2, 3]) {
      fireEvent.click(botonRevisar);
      await waitFor(() => {
        expect(screen.getByText(`Intento #${n}`)).toBeInTheDocument();
      });
    }

    expect(screen.queryByTestId('seccion-pin-supervisor')).not.toBeInTheDocument();
  });

  it('el historial oculta el detalle por medio al no ADMIN', async () => {
    // 1. Mock de historial y detalle
    vi.spyOn(cierreApi, 'obtenerHistorial').mockResolvedValue({
      cierres: [
        {
          cajaId: 5,
          fecha: '2026-10-21T00:00:00Z',
          apertura: 100,
          cerradaPor: 2,
          cerradaEn: '2026-10-21T21:00:00Z',
          cierre: {
            resultado: 'NO_CUADRA',
            aprobadoPor: 1,
            nota: 'Faltante de 4 soles',
            medios: [
              { medio: 'EFECTIVO', sistema: 355, visto: 351, diferencia: -4 },
              { medio: 'YAPE', sistema: 200, visto: 200, diferencia: 0 },
            ],
          },
        },
      ],
      total: 1,
      pagina: 1,
      limite: 10,
      totalPaginas: 1,
    });

    vi.spyOn(cierreApi, 'obtenerCierrePorId').mockResolvedValue({
      cajaId: 5,
      fecha: '2026-10-21T00:00:00Z',
      apertura: 100,
      resultado: 'NO_CUADRA',
      aprobadoPor: 1,
      nota: 'Faltante de 4 soles',
      cerradaPor: 2,
      cerradaEn: '2026-10-21T21:00:00Z',
      conteo: { '100': 3 },
      medios: [
        { medio: 'EFECTIVO', sistema: 355, visto: 351, diferencia: -4 },
        { medio: 'YAPE', sistema: 200, visto: 200, diferencia: 0 },
      ],
    });

    // Caso A: Usuario CAJERO (no ADMIN)
    const { rerender } = render(<HistorialCierres />);

    await waitFor(() => {
      expect(screen.getByText(/Caja #5/)).toBeInTheDocument();
    });

    // Abre el detalle de la caja #5
    fireEvent.click(screen.getByText(/Caja #5/));

    await waitFor(() => {
      expect(screen.getByText(/Detalle del cierre #5/)).toBeInTheDocument();
    });

    // Para no ADMIN: el detalle por medio NO debe existir en el DOM
    expect(screen.queryByTestId('detalle-medios')).not.toBeInTheDocument();
    expect(screen.getByTestId('aviso-detalle-restringido')).toBeInTheDocument();

    // Caso B: Usuario ADMIN
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Kevin', rol: 'ADMIN' },
      permisos: ['caja/ver', 'caja/cerrar', 'repartos/liquidar'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    });

    rerender(<HistorialCierres />);

    // Ahora como ADMIN sí debe mostrarse el detalle por medio con diferencias
    await waitFor(() => {
      expect(screen.getByTestId('detalle-medios')).toBeInTheDocument();
      expect(screen.getByText(/Detalle por medio de pago \(solo administrador\)/i)).toBeInTheDocument();
      expect(screen.getByText(/EFECTIVO/)).toBeInTheDocument();
      expect(screen.getByText(/Sist\. S\/ 355\.00/)).toBeInTheDocument();
      expect(screen.getByText(/Cont\. S\/ 351\.00/)).toBeInTheDocument();
      expect(screen.getByText(/- S\/ 4\.00/)).toBeInTheDocument();
    });
  });

  it('muestra el resumen esperado al cajero y al ADMIN en CierreView', async () => {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true, caja: { id: 10, estado: 'ABIERTA', apertura: 50 } } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'obtenerEsperado').mockResolvedValueOnce({
      cajaId: 10,
      fecha: `${hoy}T00:00:00.000Z`,
      cobrados: [],
      movimientos: [],
      apertura: 50,
      efectivoEsperado: 355,
      medios: {
        efectivo: 355,
        yape: 210,
        plin: 0,
        transferencia: 0,
        tarjeta: 120,
      },
      desglose: {
        ventasEfectivo: 300,
        ingresos: 20,
        egresos: 15,
      },
    });

    // Caso A: el cajero TAMBIÉN ve el resumen esperado (el conteo a ciegas ya no se usa)
    const { rerender } = render(<CierreView />);
    expect(await screen.findByTestId('seccion-esperado-admin')).toBeInTheDocument();

    // Caso B: el admin lo ve igual
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Kevin', rol: 'ADMIN' },
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
    });

    rerender(<CierreView />);

    await waitFor(() => {
      expect(screen.getByTestId('seccion-esperado-admin')).toBeInTheDocument();
      expect(screen.getByText('Total esperado')).toBeInTheDocument();
      expect(screen.getByText(/S\/ 355\.00/)).toBeInTheDocument();
    });
  });

  it('propinas del día: línea propia con efectivo y digital; el total vendido resta la propina digital de Yape', async () => {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true, caja: { id: 10, estado: 'ABIERTA', apertura: 50 } } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'obtenerEsperado').mockResolvedValueOnce({
      cajaId: 10,
      fecha: `${hoy}T00:00:00.000Z`,
      cobrados: [],
      movimientos: [],
      apertura: 50,
      // efectivo esperado ya incluye la propina en efectivo (4): 50 + 300 + 4 + 0 - 0
      efectivoEsperado: 354,
      // yape 210 incluye 6 de propina digital (lo que entró a la cuenta)
      medios: { efectivo: 354, yape: 210, plin: 0, transferencia: 0, tarjeta: 120 },
      desglose: {
        ventasEfectivo: 300,
        propinas: { total: 10, efectivo: 4, digital: 6 },
        ingresos: 0,
        egresos: 0,
      },
    });
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Kevin', rol: 'ADMIN' },
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
    });

    render(<CierreView />);

    await waitFor(() => {
      expect(screen.getByTestId('cierre-propinas-total')).toHaveTextContent('s/ 10.00');
    });
    expect(screen.getByTestId('cierre-propinas-efectivo')).toHaveTextContent('s/ 4.00');
    expect(screen.getByTestId('cierre-propinas-digital')).toHaveTextContent('s/ 6.00');
    // venta: 300 efectivo + 210 Yape + 120 tarjeta - 6 de propina digital = 624 (no 630)
    expect(screen.getByText('s/ 624.00')).toBeInTheDocument();
    expect(screen.getByText('S/ 354.00')).toBeInTheDocument();
  });

  it('una caja de un día anterior abierta no se muestra como la caja de hoy', async () => {
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: false, caja: null } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'obtenerEsperado').mockResolvedValue({
      cajaId: 7,
      fecha: '2026-10-22T00:00:00.000Z',
      cobrados: [],
      movimientos: [],
      apertura: 10,
      efectivoEsperado: 170,
      medios: { efectivo: 170, yape: 0, plin: 0, transferencia: 0, tarjeta: 0 },
      desglose: { ventasEfectivo: 160, ingresos: 0, egresos: 0 },
    });
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Kevin', rol: 'ADMIN' },
      permisos: ['caja/ver', 'caja/cerrar', 'caja/abrir', 'caja/movimientos'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    });

    render(<CierreView />);

    expect(await screen.findByText(/La caja del 22\/10\/2026 sigue abierta/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar movimiento' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar caja y cuadrar' })).toBeInTheDocument();
  });

  it('el cajero ve que la caja de un día anterior sigue abierta, no «Caja cerrada», y puede cerrarla', async () => {
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({
      abierta: false,
      caja: null,
      cajaAnteriorAbierta: { fecha: '2026-10-22' },
    } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    const esperado = vi.spyOn(cierreApi, 'obtenerEsperado');

    render(<CierreView />);

    expect(await screen.findByText(/La caja del 22\/10\/2026 sigue abierta/)).toBeInTheDocument();
    expect(screen.queryByText('Caja cerrada. Se abre en cero cada mañana.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir caja' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar caja y cuadrar' })).toBeInTheDocument();
    // El cajero también pide el esperado (sin código): el conteo a ciegas ya no se usa
    expect(esperado).toHaveBeenCalled();
  });

  it('el cajero cuenta y ve la diferencia en vivo: ya no hay arqueo a ciegas ni intentos', async () => {
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true, caja: { id: 7, estado: 'ABIERTA', apertura: 0 } } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'listarPendientesDeCobro').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'obtenerEsperado').mockResolvedValue({
      cajaId: 7,
      fecha: `${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })}T00:00:00.000Z`,
      apertura: 0,
      efectivoEsperado: 250,
      medios: { efectivo: 250, yape: 0, plin: 0, transferencia: 0, tarjeta: 0 },
      desglose: { ventasEfectivo: 250, ingresos: 0, egresos: 0 },
      cobrados: [],
      movimientos: [],
    } as any);
    const arqueo = vi.spyOn(cierreApi, 'realizarArqueo');

    render(<CierreView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar caja y cuadrar' }));
    expect(await screen.findByTestId('cc-deberia')).toHaveTextContent('S/ 250.00');
    fireEvent.change(screen.getByLabelText('Cantidad de billetes de S/ 100'), { target: { value: '3' } });

    expect(screen.getByTestId('cc-diferencia')).toHaveTextContent('Sobra +S/ 50.00');
    expect(arqueo).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/Código de la supervisora/i)).not.toBeInTheDocument();
  });

  it('al cajero no se le ofrece la pestaña de historial (el servidor responde 403)', async () => {
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true, caja: { id: 7, estado: 'ABIERTA', apertura: 0 } } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);

    render(<CierreView />);

    expect(await screen.findByRole('tab', { name: 'Turno actual' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Historial de cierres' })).not.toBeInTheDocument();
  });

  it('si no cuadra, el cajero puede cerrar igual: sin código y con nota opcional (antes: a ciegas, nota obligatoria)', async () => {
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true, caja: { id: 7, estado: 'ABIERTA', apertura: 0 } } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'listarPendientesDeCobro').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'obtenerEsperado').mockResolvedValue({
      cajaId: 7,
      fecha: `${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })}T00:00:00.000Z`,
      apertura: 0,
      efectivoEsperado: 100,
      medios: { efectivo: 100, yape: 0, plin: 0, transferencia: 0, tarjeta: 0 },
      desglose: { ventasEfectivo: 100, ingresos: 0, egresos: 0 },
      cobrados: [],
      movimientos: [],
    } as any);
    const cerrar = vi.spyOn(cierreApi, 'cerrarCaja').mockResolvedValue({ cajaId: 7, resultado: 'NO_CUADRA', diferenciaTotal: -50 } as any);

    render(<CierreView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar caja y cuadrar' }));
    fireEvent.change(await screen.findByLabelText('Cantidad de billetes de S/ 50'), { target: { value: '1' } });

    expect(screen.queryByLabelText(/Código de la supervisora/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Cerrar caja con diferencia de −S\/ 50\.00/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cerrar caja' }));
    await waitFor(() => expect(cerrar).toHaveBeenCalledWith(expect.objectContaining({ conteo: { '50': 1 }, nota: undefined })));
  });

  it('la fecha de la caja no cambia de día al mostrarla en Lima', async () => {
    vi.spyOn(cierreApi, 'obtenerHistorial').mockResolvedValue({
      cierres: [
        {
          cajaId: 9,
          fecha: '2026-10-23T00:00:00.000Z',
          apertura: 0,
          cerradaPor: 2,
          cerradaEn: '2026-10-23T03:00:00.000Z',
          cierre: { resultado: 'CUADRA', aprobadoPor: null, nota: null, medios: [{ medio: 'EFECTIVO', sistema: 100, visto: 100, diferencia: 0 }] },
        },
      ],
      total: 1,
      pagina: 1,
      limite: 20,
      totalPaginas: 1,
    });

    render(<HistorialCierres />);
    expect(await screen.findByText(/23\/10\/2026/)).toBeInTheDocument();
  });

  it('el resultado del cierre se filtra con un combo: Sobrantes deja solo el cierre con sobrante', async () => {
    const cierre = (cajaId: number, fecha: string, diferencia: number) => ({
      cajaId,
      fecha,
      apertura: 0,
      cerradaPor: 2,
      cerradaEn: fecha,
      cierre: {
        resultado: diferencia === 0 ? 'CUADRA' : 'NO_CUADRA',
        aprobadoPor: null,
        nota: null,
        medios: [{ medio: 'EFECTIVO', sistema: 100, visto: 100 + diferencia, diferencia }],
      },
    });
    vi.spyOn(cierreApi, 'obtenerHistorial').mockResolvedValue({
      cierres: [cierre(1, '2026-10-22T00:00:00.000Z', 0), cierre(2, '2026-10-21T00:00:00.000Z', 5)],
      total: 2,
      pagina: 1,
      limite: 20,
      totalPaginas: 1,
    } as any);

    render(<HistorialCierres />);
    expect(await screen.findByText(/22\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/21\/10\/2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resultado: Todos' }));
    fireEvent.click(screen.getByRole('option', { name: 'Sobrantes' }));

    expect(screen.getByRole('button', { name: 'Resultado: Sobrantes' })).toBeInTheDocument();
    expect(screen.getByText(/21\/10\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/22\/10\/2026/)).not.toBeInTheDocument();
  });
});
