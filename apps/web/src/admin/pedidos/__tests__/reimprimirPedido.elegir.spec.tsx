import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ReimprimirPedido } from '../ReimprimirPedido';
import { impresionApi } from '../../impresion/impresionApi';

vi.mock('../../impresion/impresionApi', () => ({ impresionApi: { reimprimirPedido: vi.fn(), destinosReimpresion: vi.fn().mockRejectedValue(new Error('x')) } }));
const reimprimir = impresionApi.reimprimirPedido as unknown as ReturnType<typeof vi.fn>;

const papel = (n: number) => ({
  tipo: 'ETIQUETA_BEBIDA', clave: `BEBIDA:${n}`, etiqueta: `Sticker de bebida ${n}`, equipoId: '1', equipo: 'Caja', rol: 'ETIQUETERA', conectado: true,
  payload: { bebidaIndex: n, bebidaNombre: 'Frappe Maracuyá', persona: 'Lucía' },
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
  it('con 2 vasos: lista, ninguno marcado, «Reimprimir N» y manda claves', async () => {
    reimprimir.mockResolvedValueOnce(res(2)).mockResolvedValueOnce(res(1, { vistaPrevia: false }));
    await abrir('Stickers de bebida');
    expect(await screen.findByText('¿Cuáles reimprimes?')).toBeInTheDocument();
    expect(screen.getByText('Vaso 1 · Frappe Maracuyá · Lucía')).toBeInTheDocument();
    const casillas = screen.getAllByRole('checkbox');
    casillas.forEach((c) => expect(c).not.toBeChecked());
    expect(screen.getByRole('button', { name: 'Reimprimir 0' })).toBeDisabled();
    fireEvent.click(casillas[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir 1' }));
    await waitFor(() => expect(reimprimir).toHaveBeenLastCalledWith('9', expect.objectContaining({ tipo: 'stickers', sub: 'bebida', claves: ['BEBIDA:2'] })));
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
});
