import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ModalPrecuenta } from '../componentes/ModalPrecuenta';
import { impresionApi } from '../../impresion/impresionApi';

vi.mock('../../impresion/impresionApi', () => ({ impresionApi: { imprimirPrecuenta: vi.fn() } }));
vi.mock('../../vouchers/vouchersApi', () => ({ vouchersApi: { listarPedido: vi.fn().mockResolvedValue([]), guardarPlanPago: vi.fn() } }));

const res = (p: any = {}) => ({ ok: true, cantidad: 1, porMaquina: [{ equipo: 'CAJA', conectado: true }], omitidos: [], yaEnCola: [], ...p });
const abrir = () =>
  render(<ModalPrecuenta abierto alCerrar={vi.fn()} mesa="Mesa 3" total={10} subtotal={10} pedidoId={9} lineas={[{ cantidad: 1, nombre: 'Café', precio: 10 }]} />);
const imprimir = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Imprimir precuenta/ }));
  fireEvent.click(screen.getByRole('button', { name: /Sí, imprimir/ }));
};

describe('ModalPrecuenta - imprimir en la ticketera', () => {
  beforeEach(() => vi.clearAllMocks());

  it('encola la precuenta y avisa a qué ticketera fue', async () => {
    (impresionApi.imprimirPrecuenta as any).mockResolvedValue(res());
    abrir();
    await imprimir();
    expect(impresionApi.imprimirPrecuenta).toHaveBeenCalledWith(9);
    expect(await screen.findByText('Precuenta enviada a la ticketera de CAJA.')).toBeInTheDocument();
  });

  it('PC sin conexión: avisa que queda en cola', async () => {
    (impresionApi.imprimirPrecuenta as any).mockResolvedValue(res({ porMaquina: [{ equipo: 'CAJA', conectado: false }] }));
    abrir();
    await imprimir();
    expect(await screen.findByRole('alert')).toHaveTextContent(/sin conexión: el ticket queda en cola/);
  });

  it('error visible con Reintentar y respaldo de imprimir desde este equipo; sin duplicar mientras envía', async () => {
    let falla!: (e: Error) => void;
    (impresionApi.imprimirPrecuenta as any).mockReturnValue(new Promise((_, rej) => (falla = rej)));
    abrir();
    await imprimir();
    expect(screen.getByRole('button', { name: /Enviando/ })).toBeDisabled();
    falla(new Error('Sin permiso'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin permiso');
    expect(screen.getByRole('button', { name: /Imprimir desde este equipo/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled());
    expect(impresionApi.imprimirPrecuenta).toHaveBeenCalledTimes(1);
  });

  it('sin PC con ticket de pago: muestra el motivo', async () => {
    (impresionApi.imprimirPrecuenta as any).mockResolvedValue(res({ cantidad: 0, porMaquina: [], omitidos: [{ motivo: 'La PC está en pausa' }] }));
    abrir();
    await imprimir();
    expect(await screen.findByRole('alert')).toHaveTextContent('La PC está en pausa');
  });
});
