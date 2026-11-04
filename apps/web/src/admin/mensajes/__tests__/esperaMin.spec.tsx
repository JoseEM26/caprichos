import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MensajesView, obtenerEstiloEspera } from '../MensajesView';
import * as api from '../mensajesApi';

vi.mock('../../../comun/socket', () => ({
  useEventos: vi.fn(),
}));

describe('esperaMin y orden en lista Por atender (MensajesView)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue({
      id: 'chat-1',
      nombre: 'Cliente 1',
      telefono: '999111222',
      modalidad: null,
      estado: 'atencion',
      urgente: false,
      dueno: null,
      esMio: false,
      ocupado: false,
      mensajes: [],
      pedido: null,
      solicitud: null,
      tiempoPrometidoMin: null,
      altaDemanda: false,
    });
  });

  it('función obtenerEstiloEspera aplica colores de marca correctos', () => {
    const estiloRust = obtenerEstiloEspera(16);
    expect(estiloRust.color).toContain('--cp-rust');
    expect(estiloRust.fondo).toBe('#FBEDE9');

    const estiloGold = obtenerEstiloEspera(8);
    expect(estiloGold.color).toContain('--cp-gold');
    expect(estiloGold.fondo).toBe('#FEF9EE');

    const estiloNormal = obtenerEstiloEspera(4);
    expect(estiloNormal.color).toContain('--cp-soft');
    expect(estiloNormal.fondo).toBe('#F0F2F5');
  });

  it('muestra tiempo de espera con colores de marca en cada chat', async () => {
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue({
      conteos: { todos: 3, atender: 3, bot: 0, atendidos: 0 },
      chats: [
        {
          id: 'c1',
          nombre: 'Juan Perez',
          telefono: '911111111',
          estado: 'atencion',
          urgente: true,
          ultimo: 'Espero confirmación',
          hora: '12:00',
          sinLeer: 1,
          esperaMin: 18,
        },
        {
          id: 'c2',
          nombre: 'Maria Gomez',
          telefono: '922222222',
          estado: 'atencion',
          urgente: false,
          ultimo: 'Mi consulta',
          hora: '12:10',
          sinLeer: 0,
          esperaMin: 8,
        },
        {
          id: 'c3',
          nombre: 'Carlos Ruiz',
          telefono: '933333333',
          estado: 'atencion',
          urgente: false,
          ultimo: 'Hola',
          hora: '12:15',
          sinLeer: 0,
          esperaMin: 3,
        },
      ],
    });

    render(<MensajesView />);

    await waitFor(() => {
      expect(screen.getByTestId('espera-badge-c1')).toBeInTheDocument();
      expect(screen.getByTestId('espera-badge-c2')).toBeInTheDocument();
      expect(screen.getByTestId('espera-badge-c3')).toBeInTheDocument();
    });

    const b1 = screen.getByTestId('espera-badge-c1');
    const b2 = screen.getByTestId('espera-badge-c2');
    const b3 = screen.getByTestId('espera-badge-c3');

    expect(b1).toHaveTextContent('Espera: 18 min');
    expect(b1.style.color).toContain('--cp-rust');

    expect(b2).toHaveTextContent('Espera: 8 min');
    expect(b2.style.color).toContain('--cp-gold');

    expect(b3).toHaveTextContent('Espera: 3 min');
    expect(b3.style.color).toContain('--cp-soft');
  });

  it('en filtro Por atender ordena por más esperado primero (descendente por esperaMin)', async () => {
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue({
      conteos: { todos: 3, atender: 3, bot: 0, atendidos: 0 },
      chats: [
        {
          id: 'c-corto',
          nombre: 'Cliente Corto',
          telefono: '911111111',
          estado: 'atencion',
          urgente: false,
          ultimo: 'Hola',
          hora: '12:15',
          sinLeer: 0,
          esperaMin: 2,
        },
        {
          id: 'c-maximo',
          nombre: 'Cliente Maximo',
          telefono: '922222222',
          estado: 'atencion',
          urgente: true,
          ultimo: 'Urgente',
          hora: '11:55',
          sinLeer: 1,
          esperaMin: 25,
        },
        {
          id: 'c-medio',
          nombre: 'Cliente Medio',
          telefono: '933333333',
          estado: 'atencion',
          urgente: false,
          ultimo: 'Aviso',
          hora: '12:05',
          sinLeer: 0,
          esperaMin: 12,
        },
      ],
    });

    render(<MensajesView />);

    await waitFor(() => {
      expect(screen.getByText('Cliente Corto')).toBeInTheDocument();
    });

    // Cambiar a pestaña Por atender
    const btnAtender = screen.getByRole('button', { name: /Por atender/i });
    fireEvent.click(btnAtender);

    await waitFor(() => {
      const rows = screen.getAllByRole('button').filter((b) => b.className.includes('msg-fila'));
      expect(rows).toHaveLength(3);

      // El más esperado (25 min) debe ser el primero
      expect(rows[0]).toHaveTextContent('Cliente Maximo');
      expect(rows[0]).toHaveTextContent('Espera: 25 min');

      // El del medio (12 min) es el segundo
      expect(rows[1]).toHaveTextContent('Cliente Medio');
      expect(rows[1]).toHaveTextContent('Espera: 12 min');

      // El menor (2 min) es el tercero
      expect(rows[2]).toHaveTextContent('Cliente Corto');
      expect(rows[2]).toHaveTextContent('Espera: 2 min');
    });
  });
});
