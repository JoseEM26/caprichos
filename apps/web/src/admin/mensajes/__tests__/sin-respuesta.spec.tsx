import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MensajesView } from '../MensajesView';
import * as api from '../mensajesApi';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));

const chat = (id: string, sinRespuestaMin: number | null) => ({
  id, nombre: `Cliente ${id}`, telefono: '911111111', estado: 'atencion' as const, urgente: false,
  ultimo: 'hola', hora: '22:38', sinLeer: 1, sinRespuestaMin,
});

describe('Chat sin respuesta destacado en Mensajes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
  });

  it('muestra «Esperando N min» solo cuando el último mensaje es del cliente sin respuesta', async () => {
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue({
      conteos: { todos: 3, atender: 3, bot: 0, atendidos: 0 },
      chats: [chat('c1', 7), chat('c2', null), chat('c3', 1)],
    } as any);
    render(<MensajesView />);
    await waitFor(() => expect(screen.getByTestId('esperando-c1')).toHaveTextContent('Esperando 7 min'));
    expect(screen.queryByTestId('esperando-c2')).toBeNull();
    expect(screen.queryByTestId('esperando-c3')).toBeNull();
  });
});
