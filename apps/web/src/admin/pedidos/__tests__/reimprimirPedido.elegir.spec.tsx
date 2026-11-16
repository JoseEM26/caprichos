import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ReimprimirPedido } from '../ReimprimirPedido';
import { impresionApi } from '../../impresion/impresionApi';

vi.mock('../../impresion/impresionApi', () => ({ impresionApi: { reimprimirPedido: vi.fn(), destinosReimpresion: vi.fn().mockRejectedValue(new Error('x')) } }));
const reimprimir = impresionApi.reimprimirPedido as unknown as ReturnType<typeof vi.fn>;

const papel = (n: number) => ({
  tipo: 'ETIQUETA_BEBIDA', clave: `BEBIDA:${n}`, etiqueta: `Sticker de bebida ${n}`, equipoId: '1', equipo: 'Caja', rol: 'ETIQUETERA', conectado: true,
  payload: { bebidaIndex: n, totalBebidas: 2, bebidaNombre: 'Frappe Maracuyá', persona: 'Lucía', codigo: 'PED-9', who: 'Lucía', hora: '10:00', contenido: [], tamano: null },
});
const res = (n: number, extra: any = {}) => ({
  ok: true, vistaPrevia: true, pedido: { id: '9', codigo: 'PED-9', estado: 'ENTREGADO', anulado: false }, exigeConfirmacionAnulado: false, marca: null,
  stickers: n, tickets: 0, cantidad: n, porMaquina: [{ equipoId: '1', equipo: 'Caja', rol: 'ETIQUETERA', stickers: n, tickets: 0, conectado: true }],
  papeles: Array.from({ length: n }, (_, i) => papel(i + 1)), omitidos: [], yaEnCola: [], trabajoIds: [], mensaje: '', ...extra,
});

const abrir = async (opcion: string) => {
  render(<ReimprimirPedido pedido={{ id: '9', codigo: 'PED-9' } as any} variante="detalle" />);
  fireEvent.click(screen.getByRole('button', { name: 'Reimprimir stickers y ticket' }));
  fireEvent.click(screen.getByRole('button', { name: opcion }));
};

beforeEach(() => reimprimir.mockReset());

describe('Caja › Reimprimir stickers: elegir cuáles', () => {
  it('con 2 vasos iguales: una fila «Hay 2 stickers», por defecto los 2, y se puede bajar a 1', async () => {
    reimprimir.mockResolvedValueOnce(res(2)).mockResolvedValueOnce(res(1, { vistaPrevia: false }));
    await abrir('Stickers de bebida');
    expect(await screen.findByText('¿Cuáles reimprimes? · PED-9')).toBeInTheDocument();
    expect(screen.getByText(/Hay 2 stickers de Frappe Maracuyá/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    const cuantos = screen.getByRole('combobox', { name: /Cuántos de Frappe Maracuyá/ });
    expect(cuantos).toHaveValue('2');
    expect(screen.getByRole('button', { name: 'Imprimir 2' })).toBeEnabled();
    fireEvent.change(cuantos, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir 1' }));
    await waitFor(() => expect(reimprimir).toHaveBeenLastCalledWith('9', expect.objectContaining({ tipo: 'stickers', sub: 'bebida', claves: ['BEBIDA:1'] })));
  });

  it('con 1 sticker sigue el Sí/No y no manda claves', async () => {
    reimprimir.mockResolvedValueOnce(res(1)).mockResolvedValueOnce(res(1, { vistaPrevia: false }));
    await abrir('Stickers de bebida');
    expect(await screen.findByText(/¿Seguro\?/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reimprimir' }));
    await waitFor(() => expect(reimprimir).toHaveBeenCalledTimes(2));
    expect(reimprimir.mock.calls[1][1].claves).toBeUndefined();
  });

  it('Todo con ticket + sticker + vasos iguales: los vasos van agrupados con su contador y el ticket aparte', async () => {
    const ticket = { tipo: 'TICKET_PAGO', clave: 'TICKET_PAGO', etiqueta: 'Ticket de pago', equipoId: '1', equipo: 'Caja', rol: 'TICKETERA', conectado: true, payload: null };
    reimprimir.mockResolvedValueOnce(res(2, { papeles: [ticket, papel(1), papel(2)], tickets: 1, cantidad: 3 })).mockResolvedValueOnce(res(1, { vistaPrevia: false }));
    await abrir('Todo (stickers + ticket)');
    expect(await screen.findByText('Ticket de pago (1)')).toBeInTheDocument();
    expect(screen.getByText('Stickers de bebida (2)')).toBeInTheDocument();
    expect(screen.getByText('Se imprimirán 2 hojas')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '0' } });
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByText('Se imprimirán 1 hoja')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir 1' }));
    await waitFor(() => expect(reimprimir).toHaveBeenLastCalledWith('9', expect.objectContaining({ tipo: 'todo', claves: ['TICKET_PAGO'] })));
  });

  it('rótulo de extra en el título', async () => {
    reimprimir.mockResolvedValueOnce(res(2));
    render(<ReimprimirPedido pedido={{ id: '9', codigo: 'PED-9' } as any} variante="detalle" rotulo="Extra" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir stickers y ticket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stickers de bebida' }));
    expect(await screen.findByText('¿Cuáles reimprimes? · Extra PED-9')).toBeInTheDocument();
  });
});
