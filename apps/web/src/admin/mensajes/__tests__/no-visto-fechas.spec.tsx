import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { etiquetaDia, fechaCompletaChat, horaDeChat, horaListaChat } from '../fechasChat';
import { MensajesView } from '../MensajesView';
import * as api from '../mensajesApi';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));

// Hoy 7 nov 2026 a las 10:37 en Lima (15:37 UTC)
const AHORA = new Date('2026-11-07T15:37:00Z');

describe('fechas del chat (hora de Lima, español)', () => {
  it('hora de la burbuja y fecha completa', () => {
    expect(horaDeChat('2026-11-03T20:37:00Z')).toBe('15:37');
    expect(fechaCompletaChat('2026-11-03T20:37:00Z')).toBe('3 nov 2026, 15:37');
  });

  it('separador de día: Hoy, Ayer, día de la semana y otro año', () => {
    expect(etiquetaDia('2026-11-07T12:00:00Z', AHORA)).toBe('Hoy');
    expect(etiquetaDia('2026-11-06T12:00:00Z', AHORA)).toBe('Ayer');
    expect(etiquetaDia('2026-11-03T20:37:00Z', AHORA)).toBe('Martes 3 de noviembre');
    expect(etiquetaDia('2025-12-24T20:37:00Z', AHORA)).toBe('24 dic 2025');
  });

  it('usa el día de Lima, no el de UTC (01:30 UTC del 8 sigue siendo el 7 en Lima)', () => {
    expect(etiquetaDia('2026-11-08T01:30:00Z', AHORA)).toBe('Hoy');
  });

  it('hora en la lista por antigüedad: hora, Ayer, día de la semana, fecha', () => {
    expect(horaListaChat('2026-11-07T14:05:00Z', AHORA)).toBe('09:05');
    expect(horaListaChat('2026-11-06T14:05:00Z', AHORA)).toBe('Ayer');
    expect(horaListaChat('2026-11-03T14:05:00Z', AHORA)).toBe('Martes');
    expect(horaListaChat('2026-10-20T14:05:00Z', AHORA)).toBe('20/10/26');
  });
});

const chat = (id: string, extra: object = {}) => ({
  id, nombre: `Cliente ${id}`, telefono: '911111111', estado: 'bot' as const, urgente: false,
  ultimo: 'hola', hora: '10:00', sinLeer: 0, marcadoNoVisto: false, ...extra,
});

const hace = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString();

describe('Mensajes: no vistos y fechas en pantalla', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue({
      conteos: { todos: 3, atender: 1, bot: 2, atendidos: 0, sinVer: 2 },
      chats: [
        chat('c1', { fecha: new Date().toISOString() }),
        chat('c2', { sinLeer: 2, estado: 'atencion', fecha: hace(30) }),
        chat('c3', { marcadoNoVisto: true, fecha: hace(1) }),
      ],
    } as any);
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue({
      id: 'c1', nombre: 'Cliente c1', telefono: '911111111', modalidad: null, estado: 'bot', urgente: false,
      marcadoNoVisto: false, dueno: null, esMio: false, ocupado: false,
      mensajes: [
        { id: 'm1', autor: 'CLIENTE', saliente: false, imagen: false, texto: 'antiguo', hora: '15:37', fecha: '2026-11-03T20:37:00Z' },
        { id: 'm2', autor: 'CLIENTE', saliente: false, imagen: false, texto: 'mismo dia', hora: '15:40', fecha: '2026-11-03T20:40:00Z' },
        { id: 'm3', autor: 'BOT', saliente: true, imagen: false, texto: 'hoy', hora: '10:00', fecha: new Date().toISOString() },
      ],
      pedido: null, solicitud: null, tiempoPrometidoMin: null, altaDemanda: false,
    } as any);
    vi.spyOn(api, 'marcarChatVisto').mockResolvedValue({ ok: true });
    vi.spyOn(api, 'marcarChatNoVisto').mockResolvedValue({ ok: true });
  });

  it('muestra el contador «N sin ver», las insignias con texto y el filtro No vistos', async () => {
    render(<MensajesView />);
    expect(await screen.findByTestId('total-sin-ver')).toHaveTextContent('2 sin ver');
    expect(screen.getByTestId('sin-leer-c2')).toHaveAttribute('aria-label', '2 mensajes sin ver');
    expect(screen.getByTestId('no-visto-c3')).toHaveTextContent('No visto');
    expect(screen.queryByTestId('no-visto-c1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /No vistos/ }));
    await waitFor(() => expect(api.listarConversaciones).toHaveBeenLastCalledWith('novistos', ''));
  });

  it('abrir la lista no marca visto; abrir el chat sí', async () => {
    render(<MensajesView />);
    await screen.findByTestId('total-sin-ver');
    expect(api.marcarChatVisto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cliente c3'));
    await waitFor(() => expect(api.marcarChatVisto).toHaveBeenCalledWith('c3'));
  });

  it('«Marcar como no visto» desde el menú de la fila llama a la API y recarga la lista', async () => {
    render(<MensajesView />);
    await screen.findByTestId('total-sin-ver');
    const antes = (api.listarConversaciones as any).mock.calls.length;
    fireEvent.click(screen.getByTitle('Más opciones del chat de Cliente c1'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Marcar como no visto' }));
    await waitFor(() => expect(api.marcarChatNoVisto).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect((api.listarConversaciones as any).mock.calls.length).toBeGreaterThan(antes));
  });

  it('un chat sin ver ofrece «Marcar como visto» en su menú', async () => {
    render(<MensajesView />);
    await screen.findByTestId('total-sin-ver');
    fireEvent.click(screen.getByTitle('Más opciones del chat de Cliente c3'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Marcar como visto' }));
    await waitFor(() => expect(api.marcarChatVisto).toHaveBeenCalledWith('c3'));
  });

  it('el botón del detalle marca como no visto el chat abierto', async () => {
    render(<MensajesView />);
    fireEvent.click(await screen.findByTestId('btn-no-visto-detalle'));
    await waitFor(() => expect(api.marcarChatNoVisto).toHaveBeenCalledWith('c1'));
  });

  it('el detalle separa por día y cada hora lleva la fecha completa', async () => {
    render(<MensajesView />);
    await screen.findByText('mismo dia');
    const seps = screen.getAllByTestId('separador-dia');
    expect(seps).toHaveLength(2);
    expect(within(seps[0]).getByText('Martes 3 de noviembre')).toBeInTheDocument();
    expect(seps[1]).toHaveTextContent('Hoy');
    const hora = screen.getAllByTestId('hora-mensaje')[0];
    expect(hora).toHaveTextContent('15:37');
    expect(hora).toHaveAttribute('title', '3 nov 2026, 15:37');
    expect(hora).toHaveAttribute('aria-label', '3 nov 2026, 15:37');
  });

  it('en la lista, hoy muestra hora y un chat de hace 30 días muestra su fecha', async () => {
    render(<MensajesView />);
    await screen.findByTestId('total-sin-ver');
    const fila = screen.getByText('Cliente c2').closest('button')!;
    expect(fila.textContent).toMatch(/\d{2}\/\d{2}\/\d{2}/);
    const filaHoy = screen.getAllByText('Cliente c1')[0].closest('button')!;
    expect(filaHoy.textContent).toMatch(/\d{2}:\d{2}/);
  });
});
