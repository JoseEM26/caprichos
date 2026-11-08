import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ReimprimirPedido } from '../ReimprimirPedido';
import { TarjetaPedidoCaja } from '../TarjetaPedidoCaja';
import { impresionApi } from '../../impresion/impresionApi';

vi.mock('../../impresion/impresionApi', () => ({ impresionApi: { reimprimirPedido: vi.fn() } }));
vi.mock('../../salon/componentes/AccionesComerLocal', () => ({ AccionesComerLocal: () => null }));

const reimprimir = impresionApi.reimprimirPedido as unknown as ReturnType<typeof vi.fn>;
const pedido = { id: '9', codigo: 'PED-9' } as any;

const resultado = (extra: any = {}) => ({
  ok: true,
  vistaPrevia: false,
  pedido: { id: '9', codigo: 'PED-9', estado: 'ENTREGADO', anulado: false },
  exigeConfirmacionAnulado: false,
  marca: null,
  stickers: 3,
  tickets: 1,
  cantidad: 4,
  porMaquina: [
    { equipoId: '1', equipo: 'Caja', rol: 'ETIQUETERA', stickers: 3, tickets: 0, conectado: true },
    { equipoId: '1', equipo: 'Caja', rol: 'TICKETERA', stickers: 0, tickets: 1, conectado: true },
  ],
  papeles: [],
  omitidos: [],
  yaEnCola: [],
  trabajoIds: ['1'],
  mensaje: '',
  ...extra,
});

beforeEach(() => reimprimir.mockReset());

describe('ReimprimirPedido', () => {
  it('detalle: botón con aria-label y menú con las 4 opciones (stickers con sub-opciones)', () => {
    render(<ReimprimirPedido pedido={pedido} variante="detalle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir stickers y ticket' }));
    expect(screen.getByRole('dialog', { name: 'Reimprimir pedido PED-9' })).toBeTruthy();
    for (const t of ['Todo (stickers + ticket)', 'Solo stickers: todos', 'Sticker general', 'Stickers de área', 'Stickers de bebida', 'Solo ticket de cocina (comanda)', 'Solo ticket de pago / boleta']) {
      expect(screen.getByRole('button', { name: t })).toBeTruthy();
    }
  });

  it('confirma con descripción, envía y muestra el resultado con «Ver cola»', async () => {
    reimprimir.mockResolvedValueOnce(resultado({ vistaPrevia: true })).mockResolvedValueOnce(resultado());
    render(<ReimprimirPedido pedido={pedido} variante="detalle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir stickers y ticket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Todo (stickers + ticket)' }));
    await screen.findByText(/Se reimprimirán 3 stickers y 1 ticket en Caja \/ Etiquetera y Caja \/ Ticketera/);
    expect(reimprimir).toHaveBeenLastCalledWith('9', { tipo: 'todo', vista_previa: true });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reimprimir' }));
    await screen.findByText('Se enviaron 4 trabajos: Etiquetera de Caja: 3 stickers · Ticketera de Caja: 1 ticket');
    expect(reimprimir).toHaveBeenLastCalledWith('9', { tipo: 'todo', confirmar_anulado: false });
    expect(screen.getByRole('link', { name: 'Ver cola' }).getAttribute('href')).toContain('seccion=cola');
  });

  it('«Ya está en cola»: no pide confirmar ni duplica', async () => {
    reimprimir.mockResolvedValueOnce(resultado({ vistaPrevia: true, cantidad: 0, stickers: 0, tickets: 0, porMaquina: [], yaEnCola: [{ tipo: 'TICKET_PAGO', etiqueta: 'Ticket de pago', motivo: 'Ya está en cola' }] }));
    render(<ReimprimirPedido pedido={pedido} variante="detalle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir stickers y ticket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Solo ticket de pago / boleta' }));
    await screen.findByText('Ya está en cola');
    expect(reimprimir).toHaveBeenCalledTimes(1);
  });

  it('lo que no salió se explica con su motivo', async () => {
    reimprimir.mockResolvedValueOnce(resultado({ vistaPrevia: true, cantidad: 0, porMaquina: [], omitidos: [{ tipo: 'ETIQUETA_GENERAL', etiqueta: 'Sticker general', motivo: 'La PC está sin configurar' }] }));
    render(<ReimprimirPedido pedido={pedido} variante="detalle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir stickers y ticket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sticker general' }));
    await screen.findByText(/No salió Sticker general: La PC está sin configurar/);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('pedido anulado: confirmación reforzada y se manda confirmar_anulado', async () => {
    const anulado = { exigeConfirmacionAnulado: true, pedido: { id: '9', codigo: 'PED-9', estado: 'ANULADO', anulado: true } };
    reimprimir.mockResolvedValueOnce(resultado({ vistaPrevia: true, ...anulado })).mockResolvedValueOnce(resultado(anulado));
    render(<ReimprimirPedido pedido={pedido} variante="detalle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir stickers y ticket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Todo (stickers + ticket)' }));
    await screen.findByText(/marca ANULADO/);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reimprimir' }));
    await waitFor(() => expect(reimprimir).toHaveBeenLastCalledWith('9', { tipo: 'todo', confirmar_anulado: true }));
  });

  it('error del servidor (429): aviso claro', async () => {
    reimprimir.mockRejectedValueOnce(new Error('Ya reimprimiste este pedido 5 veces en el último minuto.'));
    render(<ReimprimirPedido pedido={pedido} variante="detalle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir stickers y ticket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Todo (stickers + ticket)' }));
    await screen.findByText(/5 veces en el último minuto/);
  });

  it('sin doble clic: mientras prepara, las opciones quedan deshabilitadas', async () => {
    let fin!: (v: any) => void;
    reimprimir.mockReturnValueOnce(new Promise((r) => (fin = r)));
    render(<ReimprimirPedido pedido={pedido} variante="detalle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir stickers y ticket' }));
    const op = screen.getByRole('button', { name: 'Todo (stickers + ticket)' });
    fireEvent.click(op);
    await waitFor(() => expect((op as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(op);
    expect(reimprimir).toHaveBeenCalledTimes(1);
    fin(resultado({ vistaPrevia: true }));
  });
});

describe('botón en la tarjeta de Caja', () => {
  const props = { seleccionado: false, resaltado: false, cajaCerradaEspera: false, cambioCobroPendiente: false, alSeleccionar: vi.fn() };
  const tarjeta = (estado: string) => ({ id: '9', codigo: 'PED-9', estado, modalidad: 'LLEVAR', canal: 'CAJA', total: 10, lineas: [], cliente_nombre: 'Rosa', creado_en: new Date().toISOString() }) as any;

  it.each(['COLA', 'ENTREGADO', 'ANULADO', 'RECHAZADO'])('aparece en pedidos %s, sin anidarse en otro botón, y no abre el detalle', (estado) => {
    const alSeleccionar = vi.fn();
    const { container } = render(<TarjetaPedidoCaja {...props} alSeleccionar={alSeleccionar} pedido={tarjeta(estado)} />);
    const boton = screen.getByRole('button', { name: 'Reimprimir pedido PED-9' });
    expect(boton.closest('button:not(:scope)')).toBe(boton.parentElement?.closest('button') ?? null);
    expect(boton.parentElement?.closest('button')).toBeNull();
    expect(container.querySelectorAll('button button').length).toBe(0);
    fireEvent.click(boton);
    expect(alSeleccionar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Reimprimir pedido PED-9' })).toBeTruthy();
  });
});
