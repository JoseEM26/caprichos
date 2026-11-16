import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotonEnviarConfirmacionWhatsapp } from '../BotonEnviarConfirmacionWhatsapp';
import { MensajesView } from '../MensajesView';
import * as api from '../mensajesApi';
import { olvidarAvisosPendientes } from '../avisosPendientesApi';
import { textoDeUrl, urlMensajesConTexto } from '../utilidadesChat';
import { api as clienteApi } from '../../../comun/api';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
const sesionMock = vi.hoisted(() => ({ permisos: ['mensajes/ver', 'mensajes/enviar'] as string[] }));
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ tiene: (p: string) => sesionMock.permisos.includes(p), usuario: { rol: 'CAJERO' } }),
}));

const TEXTO = 'Hola Ana 💛 Recibimos tu pedido C-007\nTotal: S/ 35.00\nTiempo estimado: 25 a 30 min';
const aviso = { id: '9', etapa: 'RECIBIDO', telefono: '977503006', texto: TEXTO, motivo: 'Fuera de las 24 h: el cliente no nos escribió en las últimas 24 h' };

describe('Botón «Enviar confirmación por WhatsApp»', () => {
  beforeEach(() => {
    olvidarAvisosPendientes();
    sesionMock.permisos = ['mensajes/ver', 'mensajes/enviar'];
  });
  afterEach(() => vi.restoreAllMocks());

  it('con un aviso fuera de las 24 h muestra el botón y el motivo, y abre Mensajes con el mensaje ya escrito', async () => {
    const get = vi.spyOn(clienteApi, 'get').mockResolvedValue({ '7': [aviso] });
    render(<BotonEnviarConfirmacionWhatsapp pedidoId="7" />);
    const enlace = await screen.findByRole('link', { name: 'Enviar confirmación por WhatsApp' });
    expect(get).toHaveBeenCalledWith('/admin/whatsapp/avisos-pedido-pendientes?ids=7');
    expect(screen.getByText('Fuera de las 24 h: envíalo tú')).toBeTruthy();
    const href = enlace.getAttribute('href')!;
    expect(href.startsWith('/admin/mensajes?telefono=977503006&texto=')).toBe(true);
    expect(decodeURIComponent(href.split('texto=')[1])).toBe(TEXTO);
    expect(enlace.getAttribute('target')).toBe('_blank');
  });

  it('varios pedidos a la vez viajan en UNA sola consulta', async () => {
    const get = vi.spyOn(clienteApi, 'get').mockResolvedValue({ '7': [aviso], '8': [] });
    render(
      <>
        <BotonEnviarConfirmacionWhatsapp pedidoId="7" />
        <BotonEnviarConfirmacionWhatsapp pedidoId="8" />
      </>,
    );
    await screen.findByRole('link', { name: 'Enviar confirmación por WhatsApp' });
    expect(get).toHaveBeenCalledTimes(1);
    expect(String(get.mock.calls[0][0])).toContain('ids=7,8');
  });

  it('sin avisos pendientes no dibuja nada', async () => {
    vi.spyOn(clienteApi, 'get').mockResolvedValue({});
    const { container } = render(<BotonEnviarConfirmacionWhatsapp pedidoId="7" />);
    await waitFor(() => expect(clienteApi.get).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('sin permiso para escribir en Mensajes no consulta ni muestra el botón', () => {
    sesionMock.permisos = ['mensajes/ver'];
    const get = vi.spyOn(clienteApi, 'get').mockResolvedValue({ '7': [aviso] });
    const { container } = render(<BotonEnviarConfirmacionWhatsapp pedidoId="7" />);
    expect(get).not.toHaveBeenCalled();
    expect(container.textContent).toBe('');
  });
});

describe('Mensajes abre el chat con el mensaje prehecho (?telefono=&texto=)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('el enlace se arma y se lee de vuelta', () => {
    window.history.replaceState({}, '', urlMensajesConTexto('51977503006', TEXTO));
    expect(textoDeUrl()).toBe(TEXTO);
  });

  it('sin chat previo lo inicia y deja el mensaje en la caja para que solo toque Enviar (no envía nada)', async () => {
    window.history.replaceState({}, '', urlMensajesConTexto('977503006', TEXTO));
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue({ conteos: { todos: 0, atender: 0, bot: 0, atendidos: 0 }, chats: [] });
    const iniciar = vi.spyOn(api, 'iniciarChat').mockResolvedValue({ id: '55', creada: true });
    const detalle = vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue({
      id: '55', nombre: 'Ana', telefono: '51977503006', estado: 'abierta', duenio: 'PERSONA', mensajes: [], ventanaAbierta: true,
    } as any);
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
    const enviar = vi.spyOn(api, 'enviarMensaje');
    render(<MensajesView />);

    await waitFor(() => expect(iniciar).toHaveBeenCalledWith('51977503006'));
    await waitFor(() => expect(detalle).toHaveBeenCalledWith('55'));
    await waitFor(() => expect((screen.getAllByRole('textbox').find((e) => (e as HTMLTextAreaElement).value === TEXTO)) ?? null).not.toBeNull());
    expect(enviar).not.toHaveBeenCalled();
  });
});
