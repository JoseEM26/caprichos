import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ReimprimirPedido } from '../ReimprimirPedido';
import { impresionApi } from '../../impresion/impresionApi';
import { ErrorApi } from '../../../comun/api';

vi.mock('../../impresion/impresionApi', () => ({ impresionApi: { reimprimirPedido: vi.fn(), destinosReimpresion: vi.fn() } }));

const reimprimir = impresionApi.reimprimirPedido as unknown as ReturnType<typeof vi.fn>;
const destinosApi = impresionApi.destinosReimpresion as unknown as ReturnType<typeof vi.fn>;
const pedido = { id: '9', codigo: 'PED-9' } as any;

const dest = (tipo: string, etiqueta: string, extra: any = {}) => ({ tipo, etiqueta, disponible: true, equipo: 'Caja', impresora: 'EPSON TM-T20', conectada: true, motivo: null, cantidad: 1, ...extra });
const TODOS = [
  dest('todo', 'Todo (stickers + ticket)', { cantidad: 3 }),
  dest('stickers_todos', 'Solo stickers: todos', { impresora: 'TSC TTP-244', cantidad: 2 }),
  dest('sticker_general', 'Sticker general', { impresora: 'TSC TTP-244' }),
  dest('sticker_area', 'Stickers de área', { disponible: false, equipo: null, impresora: null, conectada: false, cantidad: 0, motivo: 'Ninguna PC tiene encendido este papel en el Mapa de impresión' }),
  dest('sticker_bebida', 'Stickers de bebida', { disponible: false, conectada: false, motivo: 'Caja: La computadora está apagada o sin el programa' }),
  dest('ticket_cocina', 'Solo ticket de cocina (comanda)', { disponible: false, conectada: false, impresora: null, motivo: 'Caja: Aún no elegiste la impresora de esta máquina' }),
  dest('ticket_pago', 'Solo ticket de pago / boleta'),
];

const vista = (extra: any = {}) => ({
  ok: true, vistaPrevia: true, pedido: { id: '9', codigo: 'PED-9', estado: 'ENTREGADO', anulado: false }, exigeConfirmacionAnulado: false, marca: null,
  stickers: 0, tickets: 1, cantidad: 1,
  porMaquina: [{ equipoId: '1', equipo: 'Caja', rol: 'TICKETERA', stickers: 0, tickets: 1, conectado: true, impresora: 'EPSON TM-T20' }],
  papeles: [{ tipo: 'TICKET_COMANDA_SALON', etiqueta: 'Ticket de cocina', equipoId: '1', equipo: 'Caja', rol: 'TICKETERA', conectado: true, impresora: 'EPSON TM-T20', impresoraLista: true, motivo: null,
    payload: { tipo: 'TICKET_COMANDA_SALON', codigo: 'PED-9', mesa: '3', cliente: 'Rosa', canal: 'Salón', hora: '10:00', fecha: '10/11/2026', lineas: [{ cantidad: 1, nombre: 'Café', opciones: [] }], nota: null } }],
  omitidos: [], yaEnCola: [], trabajoIds: [], mensaje: '', ...extra,
});

const abrir = () => {
  render(<ReimprimirPedido pedido={pedido} variante="detalle" />);
  fireEvent.click(screen.getByRole('button', { name: 'Reimprimir stickers y ticket' }));
};

beforeEach(() => {
  reimprimir.mockReset();
  destinosApi.mockReset();
  destinosApi.mockResolvedValue({ pedidoId: '9', destinos: TODOS });
});

describe('Reimprimir: destino real por opción', () => {
  it('muestra equipo/impresora y deshabilita con motivo lo que no se puede imprimir', async () => {
    abrir();
    await screen.findAllByText(/1 papel → Caja \/ EPSON TM-T20 · conectada/);
    expect((screen.getByRole('button', { name: 'Solo ticket de pago / boleta' }) as HTMLButtonElement).disabled).toBe(false);
    for (const [nombre, motivo] of [
      ['Stickers de área', /Ninguna PC tiene encendido este papel/],
      ['Stickers de bebida', /apagada o sin el programa/],
      ['Solo ticket de cocina (comanda)', /Aún no elegiste la impresora/],
    ] as const) {
      const b = screen.getByRole('button', { name: nombre }) as HTMLButtonElement;
      expect(b.disabled).toBe(true);
      expect(b.getAttribute('aria-describedby')).toBeTruthy();
      expect(screen.getByText(motivo)).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Stickers de área' }));
    expect(reimprimir).not.toHaveBeenCalled();
  });

  it('si no se pueden consultar los destinos, las opciones siguen habilitadas y lo avisa', async () => {
    destinosApi.mockRejectedValue(new Error('x'));
    abrir();
    await screen.findByText(/No se pudo comprobar las impresoras/);
    expect((screen.getByRole('button', { name: 'Sticker general' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('Reimprimir: vista previa, confirmación y doble clic', () => {
  it('«¿Seguro?» dice cuántos papeles y dónde; la vista previa muestra la comanda antes de enviar', async () => {
    reimprimir.mockResolvedValueOnce(vista());
    abrir();
    await screen.findAllByText(/1 papel →/);
    fireEvent.click(screen.getByRole('button', { name: 'Solo ticket de pago / boleta' }));
    await screen.findByText(/¿Seguro\? Se imprimirá 1 papel \(0 stickers y 1 ticket\) en Caja \/ Ticketera «EPSON TM-T20»/);
    expect(reimprimir).toHaveBeenCalledTimes(1); // todavía solo la vista previa
    fireEvent.click(screen.getByRole('button', { name: 'Vista previa' }));
    const prev = await screen.findByTestId('rp-vista-previa');
    expect(prev.textContent).toMatch(/Ticket de cocina · Caja \/ EPSON TM-T20/);
    expect(prev.textContent).toMatch(/Café/);
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy();
  });

  it('doble clic en «Sí»: un solo envío y el botón dice «Enviando…»', async () => {
    let fin!: (v: any) => void;
    reimprimir.mockResolvedValueOnce(vista()).mockReturnValueOnce(new Promise((r) => (fin = r)));
    abrir();
    await screen.findAllByText(/1 papel →/);
    fireEvent.click(screen.getByRole('button', { name: 'Solo ticket de pago / boleta' }));
    const si = await screen.findByRole('button', { name: 'Sí, reimprimir' });
    fireEvent.click(si);
    fireEvent.click(si);
    expect(reimprimir).toHaveBeenCalledTimes(2); // vista previa + UN envío
    await screen.findByRole('button', { name: 'Enviando…' });
    fin(vista({ vistaPrevia: false, cantidad: 1 }));
    await screen.findByText(/Se enviaron 1 trabajos/);
    expect(reimprimir).toHaveBeenCalledTimes(2);
  });

  it('el servidor avisa «Ya se envió hace N s» y «Imprimir otra copia igual» reenvía con otra_copia', async () => {
    reimprimir
      .mockResolvedValueOnce(vista())
      .mockRejectedValueOnce(new ErrorApi('REIMPRESION_REPETIDA', 'Ya se envió hace 4 s, espera a que salga', 409))
      .mockResolvedValueOnce(vista({ vistaPrevia: false }));
    abrir();
    await screen.findAllByText(/1 papel →/);
    fireEvent.click(screen.getByRole('button', { name: 'Solo ticket de pago / boleta' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, reimprimir' }));
    await screen.findByText('Ya se envió hace 4 s, espera a que salga');
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir otra copia igual' }));
    await waitFor(() => expect(reimprimir).toHaveBeenLastCalledWith('9', { tipo: 'ticket_pago', confirmar_anulado: false, otra_copia: true }));
  });
});
