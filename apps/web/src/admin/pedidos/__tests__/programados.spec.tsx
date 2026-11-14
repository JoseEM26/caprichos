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

  it('anular con adelanto avisa que se devuelve y manda adelanto=DEVUELVE; el motivo es obligatorio', async () => {
    const anular = vi.spyOn(pedidosApi, 'anularProgramado').mockResolvedValue({});
    render(<PanelProgramados puedePasar alActualizar={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Anular' }));
    expect(screen.getByText(/Tiene un adelanto de S\/ 30.00/)).toBeInTheDocument();
    const boton = screen.getByRole('button', { name: 'Anular y devolver adelanto' });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo de la anulación'), { target: { value: 'Cliente desistió' } });
    fireEvent.click(boton);
    await waitFor(() => expect(anular).toHaveBeenCalledWith('7', 'Cliente desistió', true));
  });

  it('reprogramar pide fecha y hora válidas y llama al servidor con la nueva hora', async () => {
    const repro = vi.spyOn(pedidosApi, 'reprogramar').mockResolvedValue({ id: '7', programadoPara: '' });
    render(<PanelProgramados puedePasar alActualizar={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reprogramar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva fecha' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(repro).not.toHaveBeenCalled();
    const d = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);
    fireEvent.change(screen.getByLabelText('Nueva fecha'), { target: { value: fecha } });
    fireEvent.change(screen.getByLabelText('Nueva hora'), { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva fecha' }));
    await waitFor(() => expect(repro).toHaveBeenCalledWith('7', new Date(`${fecha}T09:00:00-05:00`).toISOString()));
  });

  it('registrar un adelanto acepta cualquier medio (Yape) sin captura', async () => {
    const adel = vi.spyOn(pedidosApi, 'registrarAdelanto').mockResolvedValue({ adelantoId: '1', adelantoTotal: 40, saldo: 20 });
    render(<PanelProgramados puedePasar alActualizar={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Adelanto' }));
    fireEvent.change(screen.getByLabelText('Monto del adelanto'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Medio del adelanto'), { target: { value: 'YAPE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar adelanto' }));
    await waitFor(() => expect(adel).toHaveBeenCalledWith('7', { medio: 'YAPE', monto: 10 }));
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
