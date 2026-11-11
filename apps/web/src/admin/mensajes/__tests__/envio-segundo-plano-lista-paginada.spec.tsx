import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MensajesView } from '../MensajesView';
import { BurbujaMensaje } from '../BurbujaMensaje';
import * as api from '../mensajesApi';
import { agregarPagina, aplicarEstadoEnvio, aplicarFilaEnVivo, fusionarMensajes, mensajeOptimista } from '../utilidadesChat';
import type { ChatResumen, MensajeItem } from '../mensajesTipos';

// Se guardan los manejadores de socket para dispararlos a mano
const manejadores: Record<string, (d: any) => void> = {};
vi.mock('../../../comun/socket', () => ({
  useEventos: (evento: string, cb: (d: any) => void) => {
    manejadores[evento] = cb;
  },
}));

/** Todos los datos son inventados. */
const msg = (id: string, extra: Partial<MensajeItem> = {}): MensajeItem => ({
  id, autor: 'CLIENTE', saliente: false, imagen: false, texto: `Mensaje ${id}`, hora: '10:00', ...extra,
});
const chat = (n: number, extra: Partial<ChatResumen> = {}): ChatResumen => ({
  id: String(n), nombre: `Cliente ${n}`, telefono: `9000000${String(n).padStart(2, '0')}`, identificador_tipo: 'TELEFONO',
  estado: 'bot', urgente: false, ultimo: `Último ${n}`, hora: '10:00', sinLeer: 0, clave: String(n).padStart(4, '0'), ...extra,
});

describe('utilidades: lista de chats por páginas', () => {
  it('agregarPagina no repite chats y respeta el orden por clave', () => {
    const r = agregarPagina([chat(1), chat(2)], [chat(2, { ultimo: 'nuevo' }), chat(3)]);
    expect(r.map((c) => c.id)).toEqual(['1', '2', '3']);
    expect(r[1].ultimo).toBe('nuevo');
  });

  it('chat cargado: se actualiza su fila y se reordena', () => {
    const r = aplicarFilaEnVivo([chat(1), chat(2), chat(3)], '3', { chat: chat(3, { clave: '0000', ultimo: 'llegó algo' }), dentro: true });
    expect(r.map((c) => c.id)).toEqual(['3', '1', '2']);
    expect(r[0].ultimo).toBe('llegó algo');
  });

  it('chat cargado que ya no cumple el filtro: sale de la lista', () => {
    expect(aplicarFilaEnVivo([chat(1), chat(2)], '2', { chat: null, dentro: false }).map((c) => c.id)).toEqual(['1']);
  });

  it('chat NO cargado: entra solo si cae dentro de lo cargado; si no, la lista queda IGUAL (misma referencia)', () => {
    const base = [chat(5), chat(6)];
    expect(aplicarFilaEnVivo(base, '1', { chat: chat(1), dentro: true }).map((c) => c.id)).toEqual(['1', '5', '6']);
    expect(aplicarFilaEnVivo(base, '99', { chat: chat(99), dentro: false })).toBe(base);
    expect(aplicarFilaEnVivo(base, '98', { chat: null, dentro: false })).toBe(base);
  });

  it('aplicarEstadoEnvio cambia SOLO ese mensaje, por idCliente o por id real', () => {
    const local = { ...mensajeOptimista('tmp-1', 'Hola'), id: 'tmp-1' };
    const otro = msg('5', { saliente: true, autor: 'PERSONA', estado: 'ENVIADO' });
    const r = aplicarEstadoEnvio([otro, local], { mensajeId: '9', idCliente: 'tmp-1', estado: 'FALLIDO', motivoFallo: 'Meta no respondió', puedeReintentar: true });
    expect(r.encontrado).toBe(true);
    expect(r.mensajes[0]).toBe(otro);
    expect(r.mensajes[1]).toMatchObject({ id: '9', estado: 'FALLIDO', motivoFallo: 'Meta no respondió', puedeReintentar: true });
    expect(aplicarEstadoEnvio([otro], { mensajeId: '77', estado: 'ENVIADO' }).encontrado).toBe(false);
  });

  it('reconciliar por idCliente nunca duplica aunque llegue el estado final antes que la relectura', () => {
    const local = mensajeOptimista('tmp-z', 'Hola');
    const { mensajes } = aplicarEstadoEnvio([local], { mensajeId: '12', idCliente: 'tmp-z', estado: 'ENVIADO' });
    const real = msg('12', { saliente: true, autor: 'PERSONA', texto: 'Hola', idCliente: 'tmp-z', estado: 'ENVIADO' });
    expect(fusionarMensajes(mensajes, [real]).map((m) => m.id)).toEqual(['12']);
  });
});

describe('BurbujaMensaje: estados del envío en segundo plano', () => {
  const saliente = (estado: string, extra: Partial<MensajeItem> = {}) => msg('7', { autor: 'PERSONA', saliente: true, texto: 'Ya salió tu pedido', estado, ...extra });

  it('ENCOLADO y ENVIANDO se ven «Enviando…»; ENVIADO lleva ✓ y «Enviado»', () => {
    const { rerender } = render(<BurbujaMensaje mensaje={saliente('ENCOLADO')} onReintentar={vi.fn()} />);
    expect(screen.getByTestId('estado-enviando')).toBeInTheDocument();
    rerender(<BurbujaMensaje mensaje={saliente('ENVIANDO')} onReintentar={vi.fn()} />);
    expect(screen.getByTestId('estado-enviando')).toBeInTheDocument();
    rerender(<BurbujaMensaje mensaje={saliente('ENVIADO')} onReintentar={vi.fn()} />);
    expect(screen.getByText('Enviado')).toBeInTheDocument();
    expect(screen.getByText('✓')).toHaveAttribute('aria-hidden', 'true');
  });

  it('el estado vive en una región role=status (el lector de pantalla anuncia el cambio sin interrumpir)', () => {
    render(<BurbujaMensaje mensaje={saliente('ENVIANDO')} onReintentar={vi.fn()} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(within(region).getByText('Enviando…')).toBeInTheDocument();
  });

  it('FALLIDO: dice por qué, conserva el texto y «Reintentar» se activa con el teclado', async () => {
    const onReintentar = vi.fn();
    render(<BurbujaMensaje mensaje={saliente('FALLIDO', { motivoFallo: 'Meta no respondió a tiempo', puedeReintentar: true })} onReintentar={onReintentar} />);
    expect(screen.getByText('Ya salió tu pedido')).toBeInTheDocument();
    expect(screen.getByText('No se pudo enviar: Meta no respondió a tiempo')).toBeInTheDocument();
    const boton = screen.getByRole('button', { name: 'Reintentar' });
    // <button> nativo: entra en el orden de tabulación y Enter/Espacio lo activan
    boton.focus();
    expect(boton).toHaveFocus();
    expect(boton.tagName).toBe('BUTTON');
    fireEvent.click(boton);
    expect(onReintentar).toHaveBeenCalledWith('7');
  });

  it('REVISAR: avisa que no se pudo confirmar y deja reintentar a conciencia', () => {
    render(<BurbujaMensaje mensaje={saliente('REVISAR', { motivoFallo: 'Revisa en WhatsApp antes de reenviar.', puedeReintentar: true })} onReintentar={vi.fn()} />);
    expect(screen.getByText(/No se pudo confirmar el envío/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('fuera de ventana de 24 h no se ofrece Reintentar (hay que reabrir con plantilla)', () => {
    render(<BurbujaMensaje mensaje={saliente('FALLIDO', { puedeReintentar: false })} onReintentar={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });
});

describe('MensajesView: envío en segundo plano y lista por páginas', () => {
  const detalle = {
    id: '1', nombre: 'Cliente 1', telefono: '900000001', modalidad: null, estado: 'bot' as const, urgente: false, dueno: null,
    esMio: false, ocupado: false, ventanaAbierta: true, mensajes: [msg('10', { texto: 'Hola desde el cliente' })],
    pedido: null, solicitud: null, tiempoPrometidoMin: null, altaDemanda: false,
  };
  const pagina1 = {
    conteos: { todos: 5, atender: 0, bot: 5, atendidos: 0 },
    dias: { hoy: 5, ayer: 0, manana: 0, anteriores: 0, total: 5 },
    chats: [chat(1), chat(2), chat(3)],
    hayMas: true,
    siguienteCursor: '0003',
  };
  const pagina2 = { ...pagina1, chats: [chat(4), chat(5)], hayMas: false, siguienteCursor: null };

  /** Como el servidor real: tras el envío, la relectura del chat ya trae el mensaje guardado (en cola) con su idCliente. */
  const escribir = (texto: string) => {
    fireEvent.change(screen.getByPlaceholderText('Escribe un mensaje'), { target: { value: texto } });
    vi.mocked(api.enviarMensaje).mockImplementation(async (_id, t, idCliente) => {
      vi.mocked(api.obtenerDetalleConversacion).mockResolvedValue({
        ...detalle,
        mensajes: [...detalle.mensajes, msg('11', { autor: 'PERSONA', saliente: true, texto: t, idCliente, estado: 'ENCOLADO' })],
      });
      return { id: '11', estado: 'ENCOLADO' };
    });
    fireEvent.click(screen.getByLabelText('Enviar mensaje'));
  };
  const nombresEnLista = () => within(screen.getByRole('list', { name: 'Conversaciones' })).getAllByText(/^Cliente( \d+| nuevo)$/);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(manejadores).forEach((k) => delete manejadores[k]);
    vi.spyOn(api, 'listarConversaciones').mockImplementation(async (_f, _q, _p, o) => (o?.cursor ? pagina2 : pagina1));
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalle);
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
    vi.spyOn(api, 'obtenerConteosChats').mockResolvedValue({ todos: 5, atender: 1, bot: 4, atendidos: 0, sinVer: 1 });
    vi.spyOn(api, 'obtenerFilaChat').mockResolvedValue({ chat: null, dentro: false });
  });

  it('«Cargar más chats» pide la siguiente página con el cursor y la agrega sin repetir; al terminar el botón desaparece', async () => {
    render(<MensajesView />);
    const boton = await screen.findByTestId('cargar-mas-chats');
    expect(nombresEnLista()).toHaveLength(3);
    fireEvent.click(boton);
    await waitFor(() => expect(screen.getByText('Cliente 5')).toBeInTheDocument());
    expect(api.listarConversaciones).toHaveBeenLastCalledWith('todos', '', undefined, expect.objectContaining({ cursor: '0003' }));
    expect(nombresEnLista()).toHaveLength(5);
    expect(screen.queryByTestId('cargar-mas-chats')).not.toBeInTheDocument();
  });

  it('el día y los bloqueados viajan al servidor (la lista ya llega filtrada)', async () => {
    render(<MensajesView />);
    await screen.findByTestId('cargar-mas-chats');
    expect(api.listarConversaciones).toHaveBeenCalledWith('todos', '', undefined, expect.objectContaining({ dia: 'hoy', soloBloqueados: false }));
  });

  it('el mensaje sigue «Enviando…» tras la respuesta inmediata y pasa a «Enviado» con el aviso del socket, sin recargar el chat', async () => {
    vi.spyOn(api, 'enviarMensaje').mockResolvedValue({ id: '11', estado: 'ENCOLADO' });
    render(<MensajesView />);
    await waitFor(() => expect(screen.getByPlaceholderText('Escribe un mensaje')).toBeInTheDocument());
    escribir('Ya va tu pedido');
    await screen.findByText('Ya va tu pedido');
    const idCliente = (api.enviarMensaje as any).mock.calls[0][2] as string;
    expect(screen.getByTestId('estado-enviando')).toBeInTheDocument();
    // la relectura que sigue al envío trae el mensaje guardado, aún en cola
    await waitFor(() => expect(api.obtenerDetalleConversacion).toHaveBeenCalledTimes(2), { timeout: 2000 });
    expect(screen.getAllByText('Ya va tu pedido')).toHaveLength(1);
    expect(screen.getByTestId('estado-enviando')).toBeInTheDocument();

    const llamadasDetalle = (api.obtenerDetalleConversacion as any).mock.calls.length;
    act(() => manejadores['mensajes:envio']({ id: '1', mensajeId: '11', idCliente, estado: 'ENVIADO' }));
    await waitFor(() => expect(screen.queryByTestId('estado-enviando')).not.toBeInTheDocument());
    expect(screen.getByText('Enviado')).toBeInTheDocument();
    expect(screen.getByTestId('anuncio-envio')).toHaveTextContent('Mensaje enviado');
    expect(screen.getAllByText('Ya va tu pedido')).toHaveLength(1); // sin duplicar
    expect((api.obtenerDetalleConversacion as any).mock.calls.length).toBe(llamadasDetalle); // actualizó solo ese mensaje
  });

  it('si Meta falla, el mensaje queda en el hilo «No se pudo enviar», con Reintentar, y el texto no se pierde', async () => {
    vi.spyOn(api, 'enviarMensaje').mockResolvedValue({ id: '11', estado: 'ENCOLADO' });
    render(<MensajesView />);
    await waitFor(() => expect(screen.getByPlaceholderText('Escribe un mensaje')).toBeInTheDocument());
    escribir('Confirmo tu reserva');
    await screen.findByText('Confirmo tu reserva');
    const idCliente = (api.enviarMensaje as any).mock.calls[0][2] as string;
    act(() => manejadores['mensajes:envio']({ id: '1', mensajeId: '11', idCliente, estado: 'FALLIDO', motivoFallo: 'Meta no respondió a tiempo', puedeReintentar: true }));
    expect(await screen.findByText('No se pudo enviar: Meta no respondió a tiempo')).toBeInTheDocument();
    expect(screen.getByText('Confirmo tu reserva')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByTestId('anuncio-envio')).toHaveTextContent('No se envió el mensaje');
  });

  it('Reintentar reusa el MISMO mensaje: vuelve a «Enviando…» sin crear otro', async () => {
    vi.spyOn(api, 'enviarMensaje').mockResolvedValue({ id: '11', estado: 'ENCOLADO' });
    // el servidor reencola el mismo mensaje: la relectura lo trae «ENCOLADO» (sin crear otro)
    const reintentar = vi.spyOn(api, 'reintentarMensaje').mockImplementation(async () => {
      vi.mocked(api.obtenerDetalleConversacion).mockResolvedValue({
        ...detalle,
        mensajes: [...detalle.mensajes, msg('11', { autor: 'PERSONA', saliente: true, texto: 'Gracias por tu pedido', estado: 'ENCOLADO', idCliente: (api.enviarMensaje as any).mock.calls[0][2] })],
      });
      return { ok: true, id: '11', estado: 'ENCOLADO' };
    });
    render(<MensajesView />);
    await waitFor(() => expect(screen.getByPlaceholderText('Escribe un mensaje')).toBeInTheDocument());
    escribir('Gracias por tu pedido');
    await screen.findByText('Gracias por tu pedido');
    const idCliente = (api.enviarMensaje as any).mock.calls[0][2] as string;
    // el servidor ya lo dejó FALLIDO: tanto el aviso por socket como cualquier relectura lo muestran así
    vi.mocked(api.obtenerDetalleConversacion).mockResolvedValue({
      ...detalle,
      mensajes: [...detalle.mensajes, msg('11', { autor: 'PERSONA', saliente: true, texto: 'Gracias por tu pedido', idCliente, estado: 'FALLIDO', motivoFallo: 'x', puedeReintentar: true })],
    });
    act(() => manejadores['mensajes:envio']({ id: '1', mensajeId: '11', idCliente, estado: 'FALLIDO', motivoFallo: 'x', puedeReintentar: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, reintentar' }));
    await waitFor(() => expect(reintentar).toHaveBeenCalledWith('1', '11'));
    await waitFor(() => expect(screen.getByTestId('estado-enviando')).toBeInTheDocument());
    expect(screen.getAllByText('Gracias por tu pedido')).toHaveLength(1);
    expect(api.enviarMensaje).toHaveBeenCalledTimes(1);
  });

  it('evento en vivo de un chat CARGADO: pide solo su fila y los contadores; la lista no se recarga entera', async () => {
    render(<MensajesView />);
    await screen.findByTestId('cargar-mas-chats');
    vi.mocked(api.obtenerFilaChat).mockResolvedValue({ chat: chat(2, { ultimo: 'Hola, ¿sigue abierto?', sinLeer: 1, clave: '0000' }), dentro: true });
    const llamadasLista = vi.mocked(api.listarConversaciones).mock.calls.length;
    act(() => manejadores['mensajes:actualizado']({ id: '2' }));
    await waitFor(() => expect(screen.getByText('Hola, ¿sigue abierto?')).toBeInTheDocument());
    expect(api.obtenerFilaChat).toHaveBeenCalledWith('2', 'todos', '', undefined, expect.objectContaining({ hasta: '0003' }));
    expect(api.obtenerConteosChats).toHaveBeenCalled();
    expect(vi.mocked(api.listarConversaciones).mock.calls.length).toBe(llamadasLista);
    // se reordenó: el chat 2 con la clave más baja va primero
    expect(nombresEnLista()[0]).toHaveTextContent('Cliente 2');
  });

  it('evento en vivo de un chat NO cargado que cae más adelante: solo se ajustan los contadores, la lista no cambia', async () => {
    render(<MensajesView />);
    await screen.findByTestId('cargar-mas-chats');
    vi.mocked(api.obtenerFilaChat).mockResolvedValue({ chat: chat(40, { clave: '0040' }), dentro: false });
    act(() => manejadores['mensajes:actualizado']({ id: '40' }));
    await waitFor(() => expect(api.obtenerFilaChat).toHaveBeenCalledWith('40', 'todos', '', undefined, expect.anything()));
    await waitFor(() => expect(api.obtenerConteosChats).toHaveBeenCalled());
    expect(screen.queryByText('Cliente 40')).not.toBeInTheDocument();
    expect(nombresEnLista()).toHaveLength(3);
  });

  it('evento en vivo de un chat NO cargado que cae entre los cargados (llegó un cliente nuevo): aparece arriba', async () => {
    render(<MensajesView />);
    await screen.findByTestId('cargar-mas-chats');
    vi.mocked(api.obtenerFilaChat).mockResolvedValue({ chat: chat(77, { clave: '0000', nombre: 'Cliente nuevo' }), dentro: true });
    act(() => manejadores['mensajes:actualizado']({ id: '77' }));
    await waitFor(() => expect(screen.getByText('Cliente nuevo')).toBeInTheDocument());
    expect(screen.getAllByRole('listitem').some((li) => li.textContent?.includes('Cliente nuevo'))).toBe(true);
  });

  it('teclado: «Cargar más chats» es un botón alcanzable y se activa con Enter', async () => {
    render(<MensajesView />);
    const boton = await screen.findByTestId('cargar-mas-chats');
    boton.focus();
    expect(boton).toHaveFocus();
    expect(boton.tagName).toBe('BUTTON');
    fireEvent.click(boton);
    await waitFor(() => expect(screen.getByText('Cliente 4')).toBeInTheDocument());
  });
});
