import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    expect(screen.getByText(/apertura \+ cobros en efectivo \+ ingresos − egresos/)).toBeInTheDocument();
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
});
