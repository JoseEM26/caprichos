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

  it('no-admin con monto distinto: pide código y no abre sin él', () => {
    render_();
    fireEvent.change(campoMonto(), { target: { value: '200' } });
    expect(screen.getByTestId('input-codigo-supervisor')).toBeTruthy();
    abrir();
    expect(screen.getByText(/escribe el código del supervisor/)).toBeTruthy();
    expect(pedidosApi.abrirCaja).not.toHaveBeenCalled();
  });

  it('no-admin con monto distinto y código de 6 dígitos: lo envía', async () => {
    render_();
    fireEvent.change(campoMonto(), { target: { value: '200' } });
    fireEvent.change(screen.getByTestId('input-codigo-supervisor'), { target: { value: '123456' } });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, abrir caja' }));
    await waitFor(() => expect(pedidosApi.abrirCaja).toHaveBeenCalledWith(200, '123456'));
  });

  it('con el monto oficial exacto no se envía código', async () => {
    render_();
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, abrir caja' }));
    await waitFor(() => expect(pedidosApi.abrirCaja).toHaveBeenCalledWith(150, undefined));
  });

  it('ADMIN cambia el monto sin ver ni escribir código', async () => {
    sesion.rol = 'ADMIN';
    render_();
    fireEvent.change(campoMonto(), { target: { value: '300' } });
    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, abrir caja' }));
    await waitFor(() => expect(pedidosApi.abrirCaja).toHaveBeenCalledWith(300, undefined));
  });
});
