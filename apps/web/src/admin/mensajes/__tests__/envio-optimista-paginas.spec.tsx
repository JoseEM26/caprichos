import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MensajesView } from '../MensajesView';
import * as api from '../mensajesApi';
import { fusionarMensajes, mensajeOptimista, nuevoIdCliente } from '../utilidadesChat';
import type { MensajeItem } from '../mensajesTipos';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));

const msg = (id: string, extra: Partial<MensajeItem> = {}): MensajeItem => ({
  id,
  autor: 'CLIENTE',
  saliente: false,
  imagen: false,
  texto: `Mensaje ${id}`,
  hora: '10:00',
  ...extra,
});

describe('fusionarMensajes (páginas del historial + envío optimista)', () => {
  it('conserva el historial anterior ya pedido y no repite los mensajes de la página nueva', () => {
    const previos = [msg('1'), msg('2'), msg('3'), msg('4')];
    const nuevos = [msg('3'), msg('4'), msg('5')];
    expect(fusionarMensajes(previos, nuevos).map((m) => m.id)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('el mensaje local sigue al final hasta que llega el real con su idCliente; entonces no se duplica', () => {
    const local = mensajeOptimista('tmp-a', 'Hola');
    const sinConfirmar = fusionarMensajes([msg('1'), local], [msg('1')]);
    expect(sinConfirmar.map((m) => m.id)).toEqual(['1', 'tmp-a']);
    expect(sinConfirmar[1].estado).toBe('ENVIANDO');

    const real = msg('2', { autor: 'PERSONA', saliente: true, texto: 'Hola', idCliente: 'tmp-a', estado: 'ENVIADO' });
    const confirmado = fusionarMensajes(sinConfirmar, [msg('1'), real]);
    expect(confirmado.map((m) => m.id)).toEqual(['1', '2']);
  });

  it('dos mensajes locales con el mismo texto son dos mensajes (no se unen por texto)', () => {
    const a = mensajeOptimista(nuevoIdCliente(), 'ok');
    const b = mensajeOptimista(nuevoIdCliente(), 'ok');
    expect(a.id).not.toBe(b.id);
    expect(fusionarMensajes([a, b], [msg('1')]).map((m) => m.texto)).toEqual(['Mensaje 1', 'ok', 'ok']);
  });
});

describe('MensajesView: enviar con mensaje «Enviando…» y «Cargar anteriores»', () => {
  const chats = {
    conteos: { todos: 1, atender: 0, bot: 1, atendidos: 0 },
    chats: [
      { id: '1', nombre: 'Ana Pérez', telefono: '999888777', identificador_tipo: 'TELEFONO' as const, estado: 'bot' as const, urgente: false, ultimo: 'Hola', hora: '21:03', sinLeer: 0 },
    ],
  };
  const detalle = {
    id: '1',
    nombre: 'Ana Pérez',
    telefono: '999888777',
    modalidad: null,
    estado: 'bot' as const,
    urgente: false,
    dueno: null,
    esMio: false,
    ocupado: false,
    ventanaAbierta: true,
    hayMasAnteriores: true,
    mensajes: [msg('10', { texto: 'Hola desde el cliente' })],
    pedido: null,
    solicitud: null,
    tiempoPrometidoMin: null,
    altaDemanda: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue(chats);
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalle);
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
  });

  const escribir = (texto: string) => {
    fireEvent.change(screen.getByPlaceholderText('Escribe un mensaje'), { target: { value: texto } });
    fireEvent.click(screen.getByLabelText('Enviar mensaje'));
  };

  it('el mensaje aparece al instante como «Enviando…», se confirma y nunca queda duplicado', async () => {
    let terminar!: (v: { id: string }) => void;
    const espera = new Promise<{ id: string }>((r) => (terminar = r));
    const enviar = vi.spyOn(api, 'enviarMensaje').mockReturnValue(espera);
    render(<MensajesView />);
    await waitFor(() => expect(screen.getByPlaceholderText('Escribe un mensaje')).toBeInTheDocument());

    escribir('Ya va tu pedido');
    // el servidor aún no respondió y el mensaje ya se ve, con el reloj
    expect(await screen.findByText('Ya va tu pedido')).toBeInTheDocument();
    expect(screen.getByTestId('estado-enviando')).toBeInTheDocument();
    const idCliente = enviar.mock.calls[0][2] as string;
    expect(idCliente).toMatch(/^tmp-/);

    // el servidor ya lo guardó y la relectura trae el real con el mismo idCliente
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue({
      ...detalle,
      mensajes: [...detalle.mensajes, msg('11', { autor: 'PERSONA', saliente: true, texto: 'Ya va tu pedido', idCliente, estado: 'ENVIADO' })],
    });
    await act(async () => {
      terminar({ id: '11' });
      await espera;
    });
    await waitFor(() => expect(screen.queryByTestId('estado-enviando')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText('Ya va tu pedido')).toHaveLength(1), { timeout: 2500 });
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('si el envío falla, el mensaje local desaparece, el texto vuelve a la caja y se avisa el error', async () => {
    vi.spyOn(api, 'enviarMensaje').mockRejectedValue({ codigo: 'ENVIO_FALLIDO', message: 'WhatsApp no recibió el mensaje' });
    render(<MensajesView />);
    await waitFor(() => expect(screen.getByPlaceholderText('Escribe un mensaje')).toBeInTheDocument());

    escribir('No sale');
    await waitFor(() => expect(screen.getByText('WhatsApp no recibió el mensaje')).toBeInTheDocument());
    expect(screen.queryByTestId('estado-enviando')).not.toBeInTheDocument();
    expect((screen.getByPlaceholderText('Escribe un mensaje') as HTMLTextAreaElement).value).toBe('No sale');
    // en el historial no queda el mensaje fantasma (el texto solo está en la caja)
    expect(screen.queryAllByText('No sale').filter((el) => el.tagName !== 'TEXTAREA')).toHaveLength(0);
  });

  it('«Cargar mensajes anteriores» pide la página previa al más antiguo y la pone arriba sin repetir', async () => {
    const anteriores = vi.spyOn(api, 'listarMensajesAnteriores').mockResolvedValue({
      mensajes: [msg('8', { texto: 'Más viejo' }), msg('9', { texto: 'Viejo' })],
      hayMasAnteriores: false,
    });
    render(<MensajesView />);
    const boton = await screen.findByTestId('cargar-anteriores');
    fireEvent.click(boton);
    await waitFor(() => expect(screen.getByText('Más viejo')).toBeInTheDocument());
    expect(anteriores).toHaveBeenCalledWith('1', '10');
    const textos = screen.getAllByRole('article').map((a) => a.textContent ?? '');
    expect(textos.findIndex((t) => t.includes('Más viejo'))).toBeLessThan(textos.findIndex((t) => t.includes('Viejo')));
    expect(textos.findIndex((t) => t.includes('Viejo'))).toBeLessThan(textos.findIndex((t) => t.includes('Hola desde el cliente')));
    expect(screen.queryByTestId('cargar-anteriores')).not.toBeInTheDocument();
  });
});
