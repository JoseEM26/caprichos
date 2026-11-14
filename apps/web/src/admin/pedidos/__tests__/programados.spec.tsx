import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { PanelProgramados } from '../PanelProgramados';
import { pedidosApi, type Pedido } from '../pedidosApi';
import { estadoVisual, esPagoPorCoordinar } from '../estadosCaja';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fila = { id: '7', codigo: 'CP-W007', canal: 'CAJA', modalidad: 'RECOGER', clienteNombre: 'Ana', total: 60, adelanto: 30, saldo: 30, programadoPara: '2026-11-14T13:30:00.000Z', pagoEstado: 'PENDIENTE' };

describe('lista Programados', () => {
  beforeEach(() => {
    vi.spyOn(pedidosApi, 'listarProgramados').mockResolvedValue([fila]);
  });

  it('muestra fecha y hora pactadas, adelanto y saldo', async () => {
    render(<PanelProgramados puedePasar alActualizar={() => {}} />);
    const f = await screen.findByTestId('fila-programado');
    expect(f.textContent).toContain('CP-W007');
    expect(f.textContent).toContain('08:30');
    expect(f.textContent).toContain('Adelanto S/ 30.00');
    expect(f.textContent).toContain('Saldo S/ 30.00');
  });

  it('«Pasar a cocina ahora» cambia el estado a COLA y avisa a la pantalla', async () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    const actualizar = vi.fn();
    render(<PanelProgramados puedePasar alActualizar={actualizar} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pasar a cocina ahora' }));
    await waitFor(() => expect(actualizar).toHaveBeenCalled());
    expect(cambiar).toHaveBeenCalledWith('7', 'COLA');
  });

  it('sin permiso de cambiar pedidos no hay botón', async () => {
    render(<PanelProgramados puedePasar={false} alActualizar={() => {}} />);
    await screen.findByTestId('fila-programado');
    expect(screen.queryByRole('button', { name: 'Pasar a cocina ahora' })).toBeNull();
  });

  it('lista vacía', async () => {
    vi.spyOn(pedidosApi, 'listarProgramados').mockResolvedValue([]);
    render(<PanelProgramados puedePasar alActualizar={() => {}} />);
    expect(await screen.findByText('No hay pedidos programados.')).toBeInTheDocument();
  });
});

describe('estado PROGRAMADO en Caja', () => {
  const p = { id: '7', codigo: 'CP-W007', modalidad: 'RECOGER', estado: 'PROGRAMADO', pago_estado: 'PENDIENTE', total: 60 } as unknown as Pedido;
  it('tiene su etiqueta y no cuenta como pago por coordinar', () => {
    expect(estadoVisual(p).l).toBe('Programado');
    expect(esPagoPorCoordinar(p)).toBe(false);
  });
});
