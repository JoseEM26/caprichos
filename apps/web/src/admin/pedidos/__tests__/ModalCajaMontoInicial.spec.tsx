import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const sesion = { rol: 'CAJERO' as string };
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ usuario: { rol: sesion.rol }, tiene: () => true }),
}));
vi.mock('../../impresion/SeccionEquipos', () => ({ SeccionEquipos: () => null }));
vi.mock('../../impresion/SeccionColaPruebas', () => ({ SeccionColaPruebas: () => null }));
vi.mock('../pedidosApi', () => ({
  pedidosApi: {
    abrirCaja: vi.fn().mockResolvedValue({}),
    listarMovimientos: vi.fn().mockResolvedValue([]),
    listarPorCobrar: vi.fn().mockResolvedValue([]),
  },
}));

import { ModalCaja } from '../ModalCaja';
import { pedidosApi } from '../pedidosApi';

const cajaCerrada = { caja: null, abierta: false, montoInicialOficial: 150 } as any;
const render_ = () => render(<ModalCaja cajaInfo={cajaCerrada} alCerrar={() => {}} alActualizarCaja={() => {}} />);
const campoMonto = () => screen.getByLabelText(/Monto inicial en soles/) as HTMLInputElement;
const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Abrir caja hoy' }));

describe('ModalCaja: monto inicial oficial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sesion.rol = 'CAJERO';
  });

  it('el campo sale precargado con el monto oficial y no pide código', () => {
    render_();
    expect(campoMonto().value).toBe('150.00');
    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
  });

  it('con monto distinto del oficial no pide código: abre con ese monto (queda auditado)', async () => {
    render_();
    fireEvent.change(campoMonto(), { target: { value: '200' } });
    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, abrir caja' }));
    await waitFor(() => expect(pedidosApi.abrirCaja).toHaveBeenCalledWith(200));
  });

  it('con el monto oficial exacto abre sin código', async () => {
    render_();
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, abrir caja' }));
    await waitFor(() => expect(pedidosApi.abrirCaja).toHaveBeenCalledWith(150));
  });

  it('ADMIN también cambia el monto sin código', async () => {
    sesion.rol = 'ADMIN';
    render_();
    fireEvent.change(campoMonto(), { target: { value: '300' } });
    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, abrir caja' }));
    await waitFor(() => expect(pedidosApi.abrirCaja).toHaveBeenCalledWith(300));
  });
});
