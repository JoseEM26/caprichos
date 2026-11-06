import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import * as sesionModulo from '../../../comun/sesion';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { cierreApi } from '../cierreApi';
import { CierreView } from '../CierreView';
import { VerificarMovimientos, soles } from '../VerificarMovimientos';

const base = {
  fecha: '2026-10-29',
  cajero: 'Carmen (cajero)',
  totalCobrado: 150,
  ingresos: 20,
  egresos: 5.5,
  pedidosCobrados: [{ pedidoId: 'a', codigo: 'P-1', cliente: 'Ana', total: 150, medios: ['YAPE'], en: '' }],
  movimientos: [{ id: 'm1', tipo: 'EGRESO', motivo: 'Hielo', monto: 5.5 }] as any,
  pendientesCount: 0,
  pendientes: <div>panel pendientes</div>,
  onContinuar: vi.fn(),
  onVolver: vi.fn(),
};
const resumen = { apertura: 100, ventasEfectivo: 0, yape: 150, plin: 0, transferencia: 0, tarjeta: 0, efectivoEsperado: 94.5 };

describe('Verificar movimientos del turno', () => {
  it('formatea montos con 2 decimales', () => {
    expect(soles(5)).toBe('S/ 5.00');
    expect(soles(undefined)).toBe('S/ 0.00');
  });

  it('supervisora: resumen, secciones y ayuda', () => {
    render(<VerificarMovimientos {...base} resumen={resumen} />);
    expect(screen.getByText('Efectivo esperado')).toBeInTheDocument();
    expect(screen.getByText('S/ 94.50')).toBeInTheDocument();
    for (const t of ['Cobros por medio de pago', 'Pedidos cobrados en el turno', 'Movimientos de caja', 'Pendientes'])
      expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
    expect(screen.getByText(/apertura \+ cobros en efectivo \+ propinas en efectivo \+ ingresos − egresos/)).toBeInTheDocument();
    expect(screen.queryByText('Tarjeta')).not.toBeInTheDocument();
    expect(screen.getByText('panel pendientes')).toBeInTheDocument();
  });

  it('cajero (cierre ciego): no ve lo esperado ni totales por medio', () => {
    render(<VerificarMovimientos {...base} resumen={null} />);
    expect(screen.queryByText('Efectivo esperado')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cobros por medio de pago' })).not.toBeInTheDocument();
    expect(screen.getByText('S/ 150.00', { selector: 'b' })).toBeInTheDocument();
  });

  it('acciones', () => {
    render(<VerificarMovimientos {...base} resumen={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ya revisé: continuar al conteo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(base.onContinuar).toHaveBeenCalled();
    expect(base.onVolver).toHaveBeenCalled();
  });

  it('caja de un día anterior: título con su fecha, franja de aviso y estado propio', () => {
    render(<VerificarMovimientos {...base} resumen={resumen} diaAnterior />);
    expect(screen.getByText('2026-10-29', { selector: 'b' }).parentElement).toHaveTextContent('Turno del 2026-10-29');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Esta caja es del 29/10/2026 y sigue abierta. Ciérrala antes de trabajar con la de hoy.',
    );
    expect(screen.getByText('Caja abierta (día anterior)')).toBeInTheDocument();
  });

  it('caja de hoy: sin franja de aviso y con el estado de siempre', () => {
    render(<VerificarMovimientos {...base} resumen={resumen} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Caja abierta')).toBeInTheDocument();
  });

  it('la cantidad de pedidos por medio cuadra con la lista de pedidos cobrados', () => {
    const pedidosCobrados = [
      { pedidoId: 'a', codigo: 'P-1', cliente: 'Ana', total: 150, medios: ['YAPE'], en: '' },
      { pedidoId: 'b', codigo: 'P-2', cliente: null, total: 80, medios: ['EFECTIVO'], en: '' },
    ];
    render(<VerificarMovimientos {...base} pedidosCobrados={pedidosCobrados} resumen={{ ...resumen, ventasEfectivo: 80 }} />);

    const tabla = screen.getByRole('table', { name: 'Cobros por medio de pago' });
    const celdasDe = (medio: string) =>
      within(within(tabla).getByText(medio).closest('[role="row"]') as HTMLElement)
        .getAllByRole('cell')
        .map((c) => c.textContent);
    expect(celdasDe('Efectivo')).toEqual(['Efectivo', '1', 'S/ 80.00']);
    expect(celdasDe('Yape')).toEqual(['Yape', '1', 'S/ 150.00']);

    // La lista muestra los mismos dos pedidos y el mismo total
    const lista = screen.getByRole('table', { name: 'Pedidos cobrados en el turno' });
    expect(within(lista).getByText('P-1')).toBeInTheDocument();
    expect(within(lista).getByText('P-2')).toBeInTheDocument();
    expect(within(lista).getByText('S/ 230.00')).toBeInTheDocument();
  });

  it('el modal del cierre usa la clase ancha y titulo accesible', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '2', nombres: 'Carmen', rol: 'CAJERO' }, permisos: [], tiene: vi.fn().mockReturnValue(true),
    } as any);
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true, caja: { id: 7, estado: 'ABIERTA', apertura: 0 } } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    render(<CierreView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar caja y cuadrar' }));
    const dlg = screen.getByRole('dialog', { name: 'Verificar movimientos del turno' });
    expect(dlg).toHaveClass('vm-ancho');
    fireEvent.click(screen.getByRole('button', { name: 'Ya revisé: continuar al conteo' }));
    expect(screen.getByRole('dialog', { name: 'Cerrar caja y cuadrar' })).not.toHaveClass('vm-ancho');
  });

  it('admin con la caja abierta de ayer y una de hoy: todo el turno sale de la de ayer, sin mezclar', async () => {
    // Ayer en Lima (la caja de hoy no existe abierta; la de ayer sigue abierta)
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const [a, m, d] = ayer.split('-');
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Kevin', rol: 'ADMIN' },
      permisos: ['caja/ver', 'caja/cerrar'],
      tiene: vi.fn().mockReturnValue(true),
    } as any);
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: false, caja: null, cajaAnteriorAbierta: { fecha: ayer } } as any);
    vi.spyOn(pedidosApi, 'listarMovimientos').mockResolvedValue([]);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ items: [] } as any);
    vi.spyOn(cierreApi, 'listarRepartidoresPorLiquidar').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'listarPendientesDeCobro').mockResolvedValue([]);
    vi.spyOn(cierreApi, 'obtenerEsperado').mockResolvedValue({
      cajaId: 7,
      fecha: `${ayer}T00:00:00.000Z`,
      apertura: 0,
      efectivoEsperado: 0,
      medios: { efectivo: 0, yape: 56, plin: 0, transferencia: 0, tarjeta: 0 },
      desglose: { ventasEfectivo: 0, ingresos: 0, egresos: 0 },
      cobrados: [{ pedidoId: '5', codigo: 'CP-005', cliente: 'Rosa', total: 56, medios: ['YAPE'], en: '' }],
      movimientos: [],
    } as any);

    render(<CierreView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar caja y cuadrar' }));
    const dlg = screen.getByRole('dialog', { name: 'Verificar movimientos del turno' });

    expect(within(dlg).getByText(ayer, { selector: 'b' })).toBeInTheDocument();
    expect(within(dlg).getByRole('alert')).toHaveTextContent(
      `Esta caja es del ${d}/${m}/${a} y sigue abierta. Ciérrala antes de trabajar con la de hoy.`,
    );
    expect(within(dlg).getByText('Caja abierta (día anterior)')).toBeInTheDocument();

    // Lista, total y conteo por medio son los mismos cobros de la caja de ayer
    const lista = within(dlg).getByRole('table', { name: 'Pedidos cobrados en el turno' });
    expect(within(lista).getByText('CP-005')).toBeInTheDocument();
    const tablaMedios = within(dlg).getByRole('table', { name: 'Cobros por medio de pago' });
    const filaYape = within(tablaMedios).getByText('Yape').closest('[role="row"]') as HTMLElement;
    expect(within(filaYape).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Yape', '1', 'S/ 56.00']);
    expect(within(dlg).queryByText('Sin pedidos cobrados aún.')).not.toBeInTheDocument();
  });
});

describe('Verificar movimientos: devoluciones del turno (informativo)', () => {
  const devoluciones = [
    { id: '1', pedidoCodigo: 'CP-7', montoDevuelto: 25, medio: 'YAPE', codigoOperacion: 'YP-881', motivo: null, porNombre: 'Ana', autorizadoPorNombre: 'Ana', comprobanteBajaEstado: null, creadoEn: '2026-11-04T15:00:00Z' },
    { id: '2', pedidoCodigo: 'CP-8', montoDevuelto: 10, medio: 'EFECTIVO', codigoOperacion: null, motivo: null, porNombre: 'Ana', autorizadoPorNombre: 'Ana', comprobanteBajaEstado: null, creadoEn: '2026-11-04T16:00:00Z' },
  ];

  it('lista las devoluciones con su medio, código y el total digital', () => {
    render(<VerificarMovimientos {...base} resumen={resumen} devoluciones={devoluciones} />);

    const tabla = screen.getByRole('table', { name: 'Devoluciones del turno' });
    expect(within(tabla).getByText('CP-7')).toBeInTheDocument();
    expect(within(tabla).getByText('YP-881')).toBeInTheDocument();
    expect(within(tabla).getByText('Devuelto por Yape, Plin, transferencia y tarjeta')).toBeInTheDocument();
    // fila de la devolución y total digital: ambas dicen S/ 25.00
    expect(within(tabla).getAllByText('S/ 25.00')).toHaveLength(2);
  });

  it('sin devoluciones dice que no hay', () => {
    render(<VerificarMovimientos {...base} resumen={resumen} devoluciones={[]} />);
    expect(screen.getByRole('heading', { name: 'Devoluciones del turno' })).toBeInTheDocument();
    expect(screen.getByText('Sin devoluciones en este turno.')).toBeInTheDocument();
  });
});
