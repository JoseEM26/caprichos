import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { VentasTurno } from '../VentasTurno';
import { CierreView } from '../CierreView';
import { cierreApi, type VentaDetalle } from '../cierreApi';
import { pedidosApi, type CobroTurno } from '../../pedidos/pedidosApi';
import { preferenciasApi } from '../../../comun/usePreferencia';
import * as sesionModulo from '../../../comun/sesion';
import { unir, totalesVentas, filtrarVentas, ordenarVentas, ventasACsv, COLUMNAS_VENTAS_POR_DEFECTO, normalizarColumnasVentas } from '../ventasTurno';

// Datos inventados
const cobrados: CobroTurno[] = [
  { pedidoId: '1', codigo: 'CP-001', cliente: 'Ana Prueba', total: 40, medios: ['EFECTIVO'], en: '2026-11-02T15:30:00Z' },
  { pedidoId: '2', codigo: 'CP-002', cliente: 'Beto Prueba', total: 60, medios: ['YAPE'], en: '2026-11-02T16:10:00Z' },
  { pedidoId: '3', codigo: 'CP-003', cliente: null, total: 50, medios: ['EFECTIVO', 'TARJETA'], en: '2026-11-02T17:00:00Z' },
];
const ventas: VentaDetalle[] = [
  {
    pedidoId: '1', modalidad: 'DELIVERY', canal: 'CAJA', estadoPedido: 'ENTREGADO', mesa: null, creadoEn: '2026-11-02T15:00:00Z',
    registradoPor: 'Lucia Cajera', cobradoPor: 'Lucia Cajera', cobradoPorMozo: null, repartidor: 'Rita Reparto', categorias: ['Donas'],
    pagos: [{ medio: 'EFECTIVO', monto: 40 }], propina: 2, creditoPersonal: false, comprobante: { tipo: 'BOLETA', numero: 'B001-5', estado: 'EMITIDO' },
  },
  {
    pedidoId: '2', modalidad: 'MESA', canal: 'MOZO', estadoPedido: 'ENTREGADO', mesa: 'Mesa 4', creadoEn: '2026-11-02T16:00:00Z',
    registradoPor: 'Mario Mozo', cobradoPor: 'Lucia Cajera', cobradoPorMozo: 'Mario Mozo', repartidor: null, categorias: ['Bebidas', 'Donas'],
    pagos: [{ medio: 'YAPE', monto: 60 }], propina: 0, creditoPersonal: false, comprobante: null,
  },
  {
    pedidoId: '3', modalidad: 'LLEVAR', canal: 'BOT', estadoPedido: 'ENTREGADO', mesa: null, creadoEn: '2026-11-02T16:50:00Z',
    registradoPor: null, cobradoPor: 'Lucia Cajera', cobradoPorMozo: null, repartidor: null, categorias: ['Bebidas'],
    pagos: [{ medio: 'EFECTIVO', monto: 20 }, { medio: 'TARJETA', monto: 30 }], propina: 1.5, creditoPersonal: false, comprobante: null,
  },
];

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(preferenciasApi, 'obtener').mockRejectedValue(new Error('sin servidor'));
  vi.spyOn(preferenciasApi, 'guardar').mockResolvedValue({ clave: 'x', valor: null });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ventasTurno: lógica pura', () => {
  const filas = unir(cobrados, ventas);

  it('une cobrados y detalle; sin detalle sigue mostrando lo básico', () => {
    expect(filas[0]).toMatchObject({ codigo: 'CP-001', modalidad: 'Delivery', registro: 'Lucia Cajera', repartidor: 'Rita Reparto', estadoCobro: 'Cobrado', comprobante: 'Boleta B001-5' });
    expect(filas[1]).toMatchObject({ modalidad: 'En mesa', estadoCobro: 'Cobrado por mozo', comprobanteTipo: 'Sin comprobante' });
    // el cliente (BOT) no tiene «registró»: sale el canal
    expect(filas[2]).toMatchObject({ registro: 'WhatsApp', cliente: 'Cliente' });
    expect(unir(cobrados)[0]).toMatchObject({ codigo: 'CP-001', total: 40, registro: '', repartidor: '' });
  });

  it('los totales sin filtrar son los mismos de la lista cobrados y de los medios', () => {
    const t = totalesVentas(filas);
    expect(t.total).toBe(cobrados.reduce((a, c) => a + c.total, 0));
    expect(t.total).toBe(150);
    expect(t.porMedio).toEqual({ EFECTIVO: 60, YAPE: 60, TARJETA: 30 });
    expect(t.propina).toBe(3.5);
    // mismos datos de entrada, mismo resultado (sin el detalle los medios salen del cobro)
    expect(totalesVentas(unir(cobrados)).total).toBe(150);
  });

  it('filtra por varios criterios a la vez, busca por código o cliente y ordena', () => {
    expect(filtrarVentas(filas, { categoria: ['Donas'] }, '').map((f) => f.codigo)).toEqual(['CP-001', 'CP-002']);
    expect(filtrarVentas(filas, { categoria: ['Donas'], medio: ['YAPE'] }, '').map((f) => f.codigo)).toEqual(['CP-002']);
    expect(filtrarVentas(filas, { repartidor: ['Rita Reparto'] }, '').map((f) => f.codigo)).toEqual(['CP-001']);
    expect(filtrarVentas(filas, {}, 'beto').map((f) => f.codigo)).toEqual(['CP-002']);
    expect(filtrarVentas(filas, {}, 'cp 003').map((f) => f.codigo)).toEqual(['CP-003']);
    expect(ordenarVentas(filas, { col: 'total', asc: false }).map((f) => f.codigo)).toEqual(['CP-002', 'CP-003', 'CP-001']);
  });

  it('el CSV lleva las columnas elegidas y escapa comillas', () => {
    const csv = ventasACsv(filas, ['codigo', 'total']);
    expect(csv.startsWith('\uFEFF"Código","Total"')).toBe(true);
    expect(csv).toContain('"CP-001","S/ 40.00"');
  });

  it('las columnas guardadas se validan y vuelven a las de fábrica si quedan vacías', () => {
    expect(normalizarColumnasVentas(['total', 'nada', 'total', 'codigo'])).toEqual(['total', 'codigo']);
    expect(normalizarColumnasVentas(['nada'])).toEqual(COLUMNAS_VENTAS_POR_DEFECTO);
    expect(normalizarColumnasVentas('x')).toEqual(COLUMNAS_VENTAS_POR_DEFECTO);
  });
});

describe('VentasTurno: pantalla', () => {
  it('sin ventas muestra un estado vacío claro', () => {
    render(<VentasTurno cobrados={[]} />);
    expect(screen.getByText(/todavía no hay ventas cobradas/i)).toBeInTheDocument();
  });

  it('alterna entre tabla y tarjetas y recuerda la vista', async () => {
    const { unmount } = render(<VentasTurno cobrados={cobrados} ventas={ventas} />);
    expect(screen.getByTestId('tabla-ventas')).toBeInTheDocument();
    expect(screen.getAllByTestId('fila-venta')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Tarjetas' }));
    expect(screen.queryByTestId('tabla-ventas')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('tarjeta-venta')).toHaveLength(3);
    // la tarjeta trae lo relevante
    const t = screen.getByRole('article', { name: 'Venta CP-001' });
    expect(within(t).getByText('Rita Reparto')).toBeInTheDocument();
    expect(within(t).getByText('Boleta B001-5')).toBeInTheDocument();
    expect(preferenciasApi.guardar).toHaveBeenCalledWith('cierre.ventas.vista', 'tarjetas');
    unmount();
    render(<VentasTurno cobrados={cobrados} ventas={ventas} />);
    expect(screen.getByTestId('tarjetas-ventas')).toBeInTheDocument();
  });

  it('elige columnas, persisten y se restablecen', () => {
    const { unmount } = render(<VentasTurno cobrados={cobrados} ventas={ventas} />);
    expect(screen.queryByRole('columnheader', { name: /Comprobante/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Columnas' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Comprobante' }));
    expect(screen.getByRole('columnheader', { name: /Comprobante/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Repartidor' }));
    expect(screen.queryByRole('columnheader', { name: /Repartidor/ })).not.toBeInTheDocument();
    unmount();
    render(<VentasTurno cobrados={cobrados} ventas={ventas} />);
    expect(screen.getByRole('columnheader', { name: /Comprobante/ })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Repartidor/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Columnas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer columnas' }));
    expect(screen.getByRole('columnheader', { name: /Repartidor/ })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Comprobante/ })).not.toBeInTheDocument();
  });

  it('los totales siguen a los filtros y se pueden quitar con los chips', () => {
    render(<VentasTurno cobrados={cobrados} ventas={ventas} />);
    expect(screen.getByTestId('vt-total')).toHaveTextContent('S/ 150.00');
    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Categoría:/ }));
    fireEvent.click(screen.getByRole('option', { name: /Donas/ }));
    expect(screen.getAllByTestId('fila-venta')).toHaveLength(2);
    expect(screen.getByTestId('vt-total')).toHaveTextContent('S/ 100.00');
    expect(screen.getByTestId('totales-ventas')).toHaveTextContent('Filtrado: 2 de 3');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro Categoría: Donas' }));
    expect(screen.getAllByTestId('fila-venta')).toHaveLength(3);
    expect(screen.getByTestId('vt-total')).toHaveTextContent('S/ 150.00');
  });

  it('la búsqueda filtra y, sin resultados, ofrece quitar los filtros', () => {
    render(<VentasTurno cobrados={cobrados} ventas={ventas} />);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código o cliente/), { target: { value: 'zzz' } });
    expect(screen.getByText(/Ninguna venta coincide/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar los filtros' }));
    expect(screen.getAllByTestId('fila-venta')).toHaveLength(3);
  });

  it('ordena por columna con el encabezado (con teclado: es un botón)', () => {
    render(<VentasTurno cobrados={cobrados} ventas={ventas} />);
    const cabecera = screen.getByRole('button', { name: 'Ordenar por Total' });
    cabecera.focus();
    fireEvent.click(cabecera);
    fireEvent.click(cabecera);
    const filas = screen.getAllByTestId('fila-venta');
    expect(filas[0]).toHaveTextContent('CP-002');
    expect(screen.getByRole('columnheader', { name: /Total/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('pagina: con 10 por página y 12 ventas muestra el rango', () => {
    const muchas: CobroTurno[] = Array.from({ length: 12 }, (_, i) => ({ pedidoId: String(100 + i), codigo: `CP-${100 + i}`, cliente: 'Cliente', total: 10, medios: ['EFECTIVO'], en: '2026-11-02T15:00:00Z' }));
    render(<VentasTurno cobrados={muchas} />);
    fireEvent.change(screen.getByLabelText('Filas por página'), { target: { value: '10' } });
    expect(screen.getAllByTestId('fila-venta')).toHaveLength(10);
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–10 de 12');
    // los totales son de todo lo filtrado, no de la página
    expect(screen.getByTestId('vt-total')).toHaveTextContent('S/ 120.00');
  });

  it('a 360 px: la tabla queda en su propio cuadro con scroll y los botones miden al menos 44 px por CSS', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 });
    render(<VentasTurno cobrados={cobrados} ventas={ventas} />);
    const scroll = screen.getByRole('region', { name: 'Tabla de ventas del turno' });
    expect(scroll).toHaveClass('cj2-tabla-scroll');
    expect(scroll).toHaveAttribute('tabindex', '0');
  });
});

describe('CierreView: la sección nueva no cambia los totales del cierre', () => {
  function montar(conVentas: boolean) {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '2', nombres: 'Persona de prueba', rol: 'CAJERO' },
      permisos: ['caja/ver', 'caja/cerrar'],
      debeCambiar: false, cargando: false, autenticado: true,
      ingresar: vi.fn(), salir: vi.fn(), renovar: vi.fn(), refrescarYo: vi.fn(), marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    });
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true, caja: { id: 10, estado: 'ABIERTA', apertura: 50 } } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'listarPendientesDeCobro').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'obtenerDigitales').mockResolvedValue(null as any);
    vi.spyOn(cierreApi, 'listarAjustesMedio').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'listarDevolucionesTurno').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'obtenerEsperado').mockResolvedValue({
      cajaId: 10, fecha: `${hoy}T00:00:00.000Z`, apertura: 50, efectivoEsperado: 110,
      cobrados, ...(conVentas ? { ventas } : {}),
      movimientos: [],
      medios: { efectivo: 110, yape: 60, plin: 0, transferencia: 0, tarjeta: 30 },
      desglose: { ventasEfectivo: 60, ingresos: 0, egresos: 0 },
    } as any);
    return render(<CierreView />);
  }

  it('el total vendido y los medios son los mismos con y sin el detalle de ventas', async () => {
    const con = montar(true);
    const sec = await screen.findByTestId('seccion-esperado-admin');
    expect(await screen.findByTestId('ventas-turno')).toBeInTheDocument();
    const textoCon = sec.textContent;
    expect(textoCon).toContain('s/ 150.00');
    con.unmount();
    vi.restoreAllMocks();
    montar(false);
    const sec2 = await screen.findByTestId('seccion-esperado-admin');
    await waitFor(() => expect(screen.getByTestId('ventas-turno')).toBeInTheDocument());
    expect(sec2.textContent).toBe(textoCon);
  });
});
