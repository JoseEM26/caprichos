import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MensajesView } from '../MensajesView';
import { textoTiempoEspera } from '../ListaChats';
import { BurbujaMensaje } from '../BurbujaMensaje';
import * as api from '../mensajesApi';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));

const chat = (id: string, extra: any = {}) => ({
  id, nombre: `Cliente ${id}`, telefono: '911111111', estado: 'bot' as const, urgente: false,
  ultimo: 'hola', hora: '22:38', sinLeer: 0, ...extra,
});

describe('Por responder en Mensajes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
  });

  it('pestaña «Por responder (N)» primero, globo verde con los sin leer, quién atiende y espera en rojo pasada la marca', async () => {
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue({
      conteos: { todos: 2, atender: 0, bot: 2, atendidos: 0, porResponder: 2 },
      chats: [
        chat('c1', { porResponder: true, sinLeer: 3, sinRespuestaMin: 25, atiende: 'WHATSAPP_BUSINESS' }),
        chat('c2', { porResponder: true, sinLeer: 1, sinRespuestaMin: 4, atiende: 'BOT' }),
      ],
    } as any);
    render(<MensajesView />);
    await waitFor(() => expect(screen.getByTestId('sin-leer-c1')).toHaveTextContent('3'));
    const tabs = screen.getByTestId('pestanas').querySelectorAll('button');
    expect(tabs[0]).toHaveTextContent('Por responder');
    expect(tabs[0]).toHaveTextContent('2');
    expect(screen.getByTestId('atiende-c1')).toHaveTextContent('WhatsApp Business');
    expect(screen.getByTestId('atiende-c2')).toHaveTextContent('Bot');
    expect(screen.getByTestId('esperando-c1')).toHaveTextContent('Esperando hace 25 min');
    expect(screen.getByTestId('esperando-c1').getAttribute('style')).toContain('163, 38, 26');
    expect(screen.getByTestId('esperando-c2').getAttribute('style') ?? '').not.toContain('163, 38, 26');
  });

  it('el título de la pestaña muestra cuántos faltan por responder', async () => {
    document.title = 'Mensajes';
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue({
      conteos: { todos: 1, atender: 0, bot: 1, atendidos: 0, porResponder: 5 },
      chats: [chat('c1')],
    } as any);
    render(<MensajesView />);
    await waitFor(() => expect(document.title).toBe('(5) Mensajes'));
  });

  it('formato del tiempo de espera', () => {
    expect(textoTiempoEspera(12)).toBe('12 min');
    expect(textoTiempoEspera(125)).toBe('2 h 5 min');
    expect(textoTiempoEspera(60)).toBe('1 h');
  });

  it('la burbuja del local escrita desde WhatsApp Business lo dice', () => {
    render(
      <BurbujaMensaje
        onReintentar={() => undefined}
        mensaje={{ id: '1', autor: 'PERSONA', saliente: true, imagen: false, texto: 'Ya va', hora: '10:00', canal: 'WHATSAPP_BUSINESS' } as any}
      />,
    );
    expect(screen.getByText(/Enviado desde WhatsApp Business por el local/)).toBeInTheDocument();
  });
});
