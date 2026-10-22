import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MensajesView } from '../MensajesView';
import * as api from '../mensajesApi';

vi.mock('../../../comun/socket', () => ({
  useEventos: vi.fn(),
}));

describe('MensajesView (/admin/mensajes)', () => {
  const chatsMock = {
    conteos: { todos: 2, atender: 1, bot: 1, atendidos: 0 },
    chats: [
      {
        id: '1',
        nombre: 'Ana Pérez',
        telefono: '999888777',
        estado: 'atencion' as const,
        urgente: true,
        ultimo: 'Mi pedido llegó sin salsa',
        hora: '21:03',
        sinLeer: 1,
      },
      {
        id: '2',
        nombre: 'Rosa Díaz',
        telefono: '977666555',
        estado: 'validar' as const,
        urgente: false,
        ultimo: 'Foto',
        hora: '21:35',
        sinLeer: 1,
      },
    ],
  };

  const detalleMock = {
    id: '1',
    nombre: 'Ana Pérez',
    telefono: '999888777',
    modalidad: 'Delivery',
    estado: 'atencion' as const,
    urgente: true,
    dueno: null,
    esMio: false,
    ocupado: false,
    mensajes: [
      {
        id: '10',
        autor: 'CLIENTE' as const,
        saliente: false,
        imagen: false,
        texto: 'Mi pedido llegó sin salsa',
        hora: '21:03',
      },
    ],
    pedido: {
      id: '50',
      codigo: 'CP-0002',
      medio: 'Yape',
      total: '34.50',
      lineas: ['1 x FRAPPE OREO Grande 16 oz · Leche entera'],
    },
    solicitud: null,
    tiempoPrometidoMin: 25,
    altaDemanda: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue(chatsMock);
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleMock);
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([
      { id: '1', titulo: 'Pedido listo', texto: 'Tu pedido ya está listo.' },
    ]);
    vi.spyOn(api, 'enviarMensaje').mockResolvedValue({ id: 'msg-new' });
    vi.spyOn(api, 'pausarBot').mockResolvedValue({ ok: true });
    vi.spyOn(api, 'aprobarPagoChat').mockResolvedValue({ ok: true });
  });

  it('1. Renderiza la lista de chats, pestañas y conteos dinámicos', async () => {
    render(<MensajesView />);
    await waitFor(() => {
      expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
      expect(screen.getByText('Rosa Díaz')).toBeInTheDocument();
    });
    expect(screen.getByText('1 por atender')).toBeInTheDocument();
  });

  it('2. Muestra el detalle del chat seleccionado con mensajes y pedido', async () => {
    render(<MensajesView />);
    await waitFor(() => {
      expect(screen.getAllByText('Mi pedido llegó sin salsa').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Total s/ 34.50')).toBeInTheDocument();
    });
  });

  it('3. Permite escribir y enviar un mensaje al chat', async () => {
    render(<MensajesView />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Escribe un mensaje')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Escribe un mensaje');
    fireEvent.change(input, { target: { value: 'Hola Ana, te enviamos la salsa' } });

    const sendBtn = screen.getByLabelText('Enviar mensaje');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(api.enviarMensaje).toHaveBeenCalledWith('1', 'Hola Ana, te enviamos la salsa');
    });
  });

  it('4. Permite pausar el bot con confirmación Sí/No', async () => {
    render(<MensajesView />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pausar el bot' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pausar el bot' }));

    // Diálogo de Confirmar
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sí, pausar bot' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sí, pausar bot' }));

    await waitFor(() => {
      expect(api.pausarBot).toHaveBeenCalledWith('1');
    });
  });
});
