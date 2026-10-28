import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotonAbrirChatCliente, ultimos9Digitos } from '../BotonAbrirChatCliente';
import { MensajesView } from '../MensajesView';
import * as api from '../mensajesApi';

vi.mock('../../../comun/socket', () => ({
  useEventos: vi.fn(),
}));

const sesionMock = vi.hoisted(() => ({ permisos: ['mensajes/ver', 'whatsapp_salientes/ver'] as string[] }));
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({
    tiene: (p: string) => sesionMock.permisos.includes(p),
    usuario: { rol: 'CAJERO' },
  }),
}));

const chatDeAna = {
  id: '1',
  nombre: 'Ana Pérez',
  telefono: '51977503006',
  identificador_tipo: 'TELEFONO' as const,
  estado: 'validar' as const,
  urgente: false,
  ultimo: 'Hola',
  hora: '21:03',
  sinLeer: 0,
};

describe('Botón «Abrir chat con el cliente»', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('extrae los últimos 9 dígitos del celular', () => {
    expect(ultimos9Digitos('+51 977 503 006')).toBe('977503006');
    expect(ultimos9Digitos('12')).toBe('');
  });

  it('apunta a /admin/mensajes con el teléfono del cliente cuando existe el chat', async () => {
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue({
      conteos: { todos: 1, atender: 0, bot: 1, atendidos: 0 },
      chats: [chatDeAna],
    });
    render(<BotonAbrirChatCliente telefono="977503006" />);
    const enlace = await screen.findByRole('link', { name: 'Abrir chat con el cliente' });
    expect(enlace.getAttribute('href')).toBe('/admin/mensajes?telefono=977503006');
    expect(enlace.getAttribute('target')).toBe('_blank');
    expect(screen.queryByText('Abrir en WhatsApp personal')).toBeNull();
  });

  it('sin conversación muestra «Sin chat todavía» deshabilitado y el wa.me como enlace secundario', async () => {
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue({
      conteos: { todos: 0, atender: 0, bot: 0, atendidos: 0 },
      chats: [],
    });
    render(<BotonAbrirChatCliente telefono="977503006" />);
    const boton = await screen.findByRole('button', { name: 'Sin chat todavía' });
    expect((boton as HTMLButtonElement).disabled).toBe(true);
    const wa = screen.getByRole('link', { name: 'Abrir en WhatsApp personal' });
    expect(wa.getAttribute('href')).toBe('https://wa.me/51977503006');
    expect(screen.queryByRole('link', { name: 'Abrir chat con el cliente' })).toBeNull();
  });

  it('sin permiso mensajes/ver deshabilita el botón y deja el enlace de WhatsApp', async () => {
    sesionMock.permisos = [];
    const lista = vi.spyOn(api, 'listarConversaciones');
    render(<BotonAbrirChatCliente telefono="977503006" />);
    const boton = await screen.findByRole('button', { name: 'Sin permiso para ver Mensajes' });
    expect((boton as HTMLButtonElement).disabled).toBe(true);
    expect(lista).not.toHaveBeenCalled();
    sesionMock.permisos = ['mensajes/ver', 'whatsapp_salientes/ver'];
  });

  it('sin teléfono no ofrece chat', () => {
    render(<BotonAbrirChatCliente telefono={null} />);
    expect(screen.getByText('Sin teléfono: no hay chat con el cliente.')).toBeTruthy();
  });
});

describe('MensajesView abre el chat indicado por ?telefono=', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('busca por el teléfono, selecciona su chat y pide el detalle', async () => {
    window.history.replaceState({}, '', '/admin/mensajes?telefono=977503006');
    const lista = vi.spyOn(api, 'listarConversaciones').mockResolvedValue({
      conteos: { todos: 2, atender: 0, bot: 2, atendidos: 0 },
      chats: [
        { ...chatDeAna, id: '7', nombre: 'Otra persona', telefono: '51999111222' },
        chatDeAna,
      ],
    });
    const detalle = vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue({
      id: '1',
      nombre: 'Ana Pérez',
      telefono: '51977503006',
      estado: 'validar',
      mensajes: [],
    } as any);
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
    render(<MensajesView />);

    await waitFor(() => expect(lista).toHaveBeenCalledWith('todos', '977503006'));
    await waitFor(() => expect(detalle).toHaveBeenCalledWith('1'));
  });
});
