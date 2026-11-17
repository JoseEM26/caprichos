import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { FiltroDiasPedidos } from '../FiltroDiasPedidos';
import { PagosEnLineaSinCompletar, situacionSinCompletar } from '../PagosEnLineaSinCompletar';
import { esperaPagoEnLinea } from '../EsperaPagoEnLinea';
import { pedidosApi } from '../pedidosApi';
import { rangoHoy } from '../filtroDias';

// Datos sintéticos
const esperando: any = { id: '1', codigo: 'CP-A001', estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE', total: 29, cliente_nombre: 'Cliente Prueba', creado_en: '2026-11-17T15:00:00Z', motivo_anulacion: null };
const vencido: any = { id: '2', codigo: 'CP-A002', estado: 'ANULADO', pago_estado: 'PENDIENTE_ONLINE', total: 15, cliente_nombre: null, creado_en: '2026-11-17T14:00:00Z', motivo_anulacion: 'Sin pago en línea en 15 minutos' };

const base = { rango: rangoHoy('2026-11-17'), pendientesAnteriores: 0, programadosVigentes: 0, alCambiar: () => {} };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Caja: chip «Pagos en línea sin completar» (solo para quien puede auditar)', () => {
  it('se muestra con su contador cuando el usuario puede verlo', () => {
    render(<FiltroDiasPedidos {...base} abandonados={{ visible: true, cantidad: 3, activo: false, alAlternar: () => {} }} />);
    const chip = screen.getByRole('button', { name: /Pagos en línea sin completar/ });
    expect(chip.textContent).toContain('3');
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });

  it('al tocarlo avisa a la vista (la vista decide qué muestra)', () => {
    const alAlternar = vi.fn();
    render(<FiltroDiasPedidos {...base} abandonados={{ visible: true, cantidad: 0, activo: false, alAlternar }} />);
    fireEvent.click(screen.getByRole('button', { name: /Pagos en línea sin completar/ }));
    expect(alAlternar).toHaveBeenCalledTimes(1);
  });

  it('no aparece para quien no tiene el permiso', () => {
    render(<FiltroDiasPedidos {...base} abandonados={{ visible: false, cantidad: 5, activo: false, alAlternar: () => {} }} />);
    expect(screen.queryByRole('button', { name: /Pagos en línea sin completar/ })).toBeNull();
  });
});

describe('Pagos en línea sin completar: solo lectura', () => {
  it('pide al servidor solo los abandonados y muestra situación y motivo', async () => {
    const listar = vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ total: 2, pagina: 1, limite: 100, items: [esperando, vencido] } as any);
    render(<PagosEnLineaSinCompletar />);
    await waitFor(() => expect(screen.getByText('CP-A001')).toBeTruthy());
    expect(listar).toHaveBeenCalledWith({ abandonadosEnLinea: true, limite: 100 });
    expect(screen.getByText('Esperando pago')).toBeTruthy();
    expect(screen.getByText('Venció sin pagar')).toBeTruthy();
    expect(screen.getByText(/Sin pago en línea en 15 minutos/)).toBeTruthy();
  });

  it('no tiene botones de acción: ni cobrar, cambiar medio, revertir ni pasar a cocina', async () => {
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ total: 2, pagina: 1, limite: 100, items: [esperando, vencido] } as any);
    render(<PagosEnLineaSinCompletar />);
    await waitFor(() => expect(screen.getByText('CP-A002')).toBeTruthy());
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(/Cobrar|Cambiar medio|Revertir|Pasar a cocina/)).toBeNull();
  });

  it('sin pagos muestra el estado vacío', async () => {
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ total: 0, pagina: 1, limite: 100, items: [] } as any);
    render(<PagosEnLineaSinCompletar />);
    expect(await screen.findByText('No hay pagos en línea sin completar.')).toBeTruthy();
  });
});

describe('Vista por defecto: un pago en línea pagado y luego anulado no se confunde con uno sin pagar', () => {
  it('la situación sale de estado: POR_PAGAR espera pago, ANULADO vence sin pagar', () => {
    expect(situacionSinCompletar(esperando)).toBe('Esperando pago');
    expect(situacionSinCompletar(vencido)).toBe('Venció sin pagar');
  });

  it('un anulado no cuenta como «esperando pago en línea» (el resto de la vista lo trata como cancelado)', () => {
    expect(esperaPagoEnLinea(vencido)).toBe(false);
    expect(esperaPagoEnLinea({ estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE' })).toBe(true);
  });
});
