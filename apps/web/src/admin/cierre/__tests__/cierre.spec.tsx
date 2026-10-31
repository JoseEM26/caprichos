import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArqueoCiegoForm } from '../ArqueoCiegoForm';
import { HistorialCierres } from '../HistorialCierres';
import { CierreView } from '../CierreView';
import { cierreApi } from '../cierreApi';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { ErrorApi } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';

describe('Ola F5: Caja y Cierres', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

  it('tras el tercer intento pide PIN', async () => {
    // Simulamos 3 intentos fallidos de arqueo
    vi.spyOn(cierreApi, 'realizarArqueo')
      .mockResolvedValueOnce({ resultado: 'NO_CUADRA', intento: 1 })
      .mockResolvedValueOnce({ resultado: 'NO_CUADRA', intento: 2 })
      .mockResolvedValueOnce({ resultado: 'NO_CUADRA', intento: 3 });

    render(<ArqueoCiegoForm />);

    const botonRevisar = screen.getByRole('button', { name: /revisar arqueo ciego/i });

    // Intento 1: no debe pedir PIN todavía
    fireEvent.click(botonRevisar);
    await waitFor(() => {
      expect(screen.getByText('Intento #1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('seccion-pin-supervisor')).not.toBeInTheDocument();

    // Intento 2: no debe pedir PIN todavía
    fireEvent.click(botonRevisar);
    await waitFor(() => {
      expect(screen.getByText('Intento #2')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('seccion-pin-supervisor')).not.toBeInTheDocument();

    // Intento 3: tras el tercer intento fallido, exige PIN del supervisor
    fireEvent.click(botonRevisar);
    await waitFor(() => {
      expect(screen.getByText('Intento #3')).toBeInTheDocument();
      expect(screen.getByTestId('seccion-pin-supervisor')).toBeInTheDocument();
      expect(screen.getByTestId('pin-supervisor-input')).toBeInTheDocument();
    });
  });

  it('un arqueo que cuadra no suma: dos que no cuadraron y uno que cuadra no piden PIN', async () => {
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

  it('el PIN no queda en el estado', async () => {
    vi.spyOn(cierreApi, 'realizarArqueo')
      .mockResolvedValueOnce({ resultado: 'NO_CUADRA', intento: 1 })
      .mockResolvedValueOnce({ resultado: 'NO_CUADRA', intento: 2 })
      .mockResolvedValueOnce({ resultado: 'NO_CUADRA', intento: 3 })
      .mockResolvedValue({ resultado: 'NO_CUADRA', intento: 4 });

    render(<ArqueoCiegoForm />);

    // Tres arqueos que no cuadran: a partir de ahí se pide el PIN del supervisor
    const botonRevisar = screen.getByRole('button', { name: /revisar arqueo ciego/i });
    for (const n of [1, 2, 3]) {
      fireEvent.click(botonRevisar);
      await waitFor(() => {
        expect(screen.getByText(`Intento #${n}`)).toBeInTheDocument();
      });
    }

    await waitFor(() => {
      expect(screen.getByTestId('pin-supervisor-input')).toBeInTheDocument();
    });

    const inputPin = screen.getByTestId('pin-supervisor-input') as HTMLInputElement;

    // El usuario ingresa un PIN
    fireEvent.change(inputPin, { target: { value: '123456' } });
    expect(inputPin.value).toBe('123456');

    // Al volver a enviar o reintentar el arqueo
    fireEvent.click(botonRevisar);

    // El PIN no queda guardado en el estado: el campo vuelve a quedar vacío
    await waitFor(() => {
      expect(inputPin.value).toBe('');
    });
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

  it('muestra el resumen esperado solo cuando el rol es ADMIN en CierreView', async () => {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true, caja: { id: 10, estado: 'ABIERTA', apertura: 50 } } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'obtenerEsperado').mockResolvedValueOnce({
      cajaId: 10,
      fecha: `${hoy}T00:00:00.000Z`,
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

    // Caso A: Cajero no ve el resumen esperado
    const { rerender } = render(<CierreView />);
    expect(screen.queryByTestId('seccion-esperado-admin')).not.toBeInTheDocument();

    // Caso B: Admin ve el resumen esperado
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

  it('una caja de un día anterior abierta no se muestra como la caja de hoy', async () => {
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: false, caja: null } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'obtenerEsperado').mockResolvedValue({
      cajaId: 7,
      fecha: '2026-10-22T00:00:00.000Z',
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
    expect(screen.queryByTestId('seccion-esperado-admin')).not.toBeInTheDocument();
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
    expect(esperado).not.toHaveBeenCalled();
  });

  it('el cajero cuenta con el arqueo del servidor y no pide el esperado', async () => {
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true, caja: { id: 7, estado: 'ABIERTA', apertura: 0 } } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    const esperado = vi.spyOn(cierreApi, 'obtenerEsperado');
    const arqueo = vi.spyOn(cierreApi, 'realizarArqueo').mockResolvedValue({ resultado: 'NO_CUADRA', intento: 1 });

    render(<CierreView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar caja y cuadrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ya revisé: continuar al conteo' }));
    fireEvent.change(screen.getByLabelText('Cantidad de billetes de S/ 100'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar si cuadra' }));

    await waitFor(() =>
      expect(arqueo).toHaveBeenCalledWith({ conteo: { '100': 3 }, medios: { yape: 0, plin: 0, transferencia: 0, tarjeta: 0 } }, undefined),
    );
    expect(await screen.findByText(/No cuadra: la supervisora debe escribir su (código|PIN)/)).toBeInTheDocument();
    expect(esperado).not.toHaveBeenCalled();
    expect(screen.queryByText(/Sist\./)).not.toBeInTheDocument();
  });

  it('al cajero no se le ofrece la pestaña de historial (el servidor responde 403)', async () => {
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true, caja: { id: 7, estado: 'ABIERTA', apertura: 0 } } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);

    render(<CierreView />);

    expect(await screen.findByRole('tab', { name: 'Turno actual' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Historial de cierres' })).not.toBeInTheDocument();
  });

  it('el PIN de la supervisora lo valida el servidor, no el navegador', async () => {
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true, caja: { id: 7, estado: 'ABIERTA', apertura: 0 } } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'realizarArqueo').mockResolvedValue({ resultado: 'NO_CUADRA', intento: 1 });
    const verificar = vi
      .spyOn(cierreApi, 'verificarPinSupervisor')
      .mockRejectedValue(new ErrorApi('CODIGO_INVALIDO', 'Código de supervisor inválido o no proporcionado', 403));

    render(<CierreView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar caja y cuadrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ya revisé: continuar al conteo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar si cuadra' }));

    const pin = await screen.findByLabelText(/Código de la supervisora/i);
    fireEvent.change(pin, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));

    expect(await screen.findByText('Código de supervisor inválido o no proporcionado')).toBeInTheDocument();
    expect(verificar).toHaveBeenCalledWith('123456');
    expect(screen.queryByTestId('detalle-cuadre')).not.toBeInTheDocument();
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
