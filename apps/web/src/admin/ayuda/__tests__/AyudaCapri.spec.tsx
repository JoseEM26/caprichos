import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AyudaCapri } from '../AyudaCapri';
import * as ayudaApi from '../ayudaApi';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/admin/caja' }),
  };
});

vi.mock('../ayudaApi', () => ({
  obtenerContextoAyuda: vi.fn(),
  enviarPreguntaAyuda: vi.fn(),
}));

describe('AyudaCapri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ayudaApi.obtenerContextoAyuda).mockResolvedValue({
      activo: true,
      modulo: 'caja',
      titulo: 'Pedidos y caja',
      rolUsuario: 'Administrador',
      sugerencias: ['¿Cómo anulo un pedido?', '¿Cómo registro un cobro?'],
      enlaces: [{ texto: 'Caja', ruta: '/admin/caja' }],
    });
  });

  it('muestra el botón flotante (FAB) al inicio y el panel está cerrado', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <AyudaCapri />
        </MemoryRouter>
      );
    });

    const fab = screen.getByRole('button', { name: /abrir la ayuda de capri/i });
    expect(fab).toBeInTheDocument();
    expect(screen.getByText(/¿necesitas ayuda\? pregúntame cómo se hace\./i)).toBeInTheDocument();

    const panel = screen.queryByRole('dialog', { name: /ayuda de capri/i });
    expect(panel).not.toBeInTheDocument();
  });

  it('abre el panel al hacer clic en el FAB y muestra la cabecera y sugerencias', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <AyudaCapri />
        </MemoryRouter>
      );
    });

    const fab = screen.getByRole('button', { name: /abrir la ayuda de capri/i });
    fireEvent.click(fab);

    const panel = await screen.findByRole('dialog', { name: /ayuda de capri/i });
    expect(panel).toBeInTheDocument();

    expect(screen.getByText('Capri · Ayuda del sistema')).toBeInTheDocument();
    expect(screen.getByText('Te explico cómo se hace. No cambio nada por ti.')).toBeInTheDocument();

    // Mensaje inicial de Capri
    expect(screen.getByText(/hola, soy capri/i)).toBeInTheDocument();

    // Sugerencias de contexto
    expect(await screen.findByRole('button', { name: '¿Cómo anulo un pedido?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '¿Cómo registro un cobro?' })).toBeInTheDocument();
  });

  it('cierra el panel al hacer clic en el botón de cerrar (x)', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <AyudaCapri />
        </MemoryRouter>
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /abrir la ayuda de capri/i }));
    const botonCerrar = await screen.findByRole('button', { name: /cerrar la ayuda/i });

    fireEvent.click(botonCerrar);

    expect(screen.queryByRole('dialog', { name: /ayuda de capri/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir la ayuda de capri/i })).toBeInTheDocument();
  });

  it('cierra el panel al presionar la tecla Escape', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <AyudaCapri />
        </MemoryRouter>
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /abrir la ayuda de capri/i }));
    await screen.findByRole('dialog', { name: /ayuda de capri/i });

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('dialog', { name: /ayuda de capri/i })).not.toBeInTheDocument();
  });

  it('permite enviar una pregunta por el formulario y muestra la respuesta y enlace de navegación', async () => {
    vi.mocked(ayudaApi.enviarPreguntaAyuda).mockResolvedValueOnce({
      respuesta: 'Para anular un pedido entra a Pedidos y selecciona Anular.',
      enlaces: [{ texto: 'Pedidos', ruta: '/admin/pedidos' }],
      estado: 'ok',
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <AyudaCapri />
        </MemoryRouter>
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /abrir la ayuda de capri/i }));
    await screen.findByRole('dialog', { name: /ayuda de capri/i });

    const input = screen.getByPlaceholderText(/escribe tu duda/i);
    const botonEnviar = screen.getByRole('button', { name: /enviar/i });

    fireEvent.change(input, { target: { value: '¿Cómo anulo un pedido?' } });
    fireEvent.click(botonEnviar);

    // Mensaje de usuario dentro de los mensajes
    const mensajesUsuario = screen.getAllByText('¿Cómo anulo un pedido?');
    expect(mensajesUsuario.length).toBeGreaterThanOrEqual(1);

    // Respuesta del bot
    await waitFor(() => {
      expect(
        screen.getByText('Para anular un pedido entra a Pedidos y selecciona Anular.')
      ).toBeInTheDocument();
    });

    // Aviso fijo obligatorio por contrato
    expect(
      screen.getByText('Yo solo te guío. Tú haces el cambio y confirmas con Sí o No en la pantalla.')
    ).toBeInTheDocument();

    // Botón de navegación "Ir a Pedidos"
    const botonIr = screen.getByRole('button', { name: 'Ir a Pedidos' });
    expect(botonIr).toBeInTheDocument();

    fireEvent.click(botonIr);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/pedidos');
  });

  it('al pulsar una pregunta sugerida se envía directamente', async () => {
    vi.mocked(ayudaApi.enviarPreguntaAyuda).mockResolvedValueOnce({
      respuesta: 'Para registrar un cobro ve a Caja...',
      enlaces: [],
      estado: 'ok',
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <AyudaCapri />
        </MemoryRouter>
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /abrir la ayuda de capri/i }));
    const chipSugerencia = await screen.findByRole('button', { name: '¿Cómo registro un cobro?' });

    fireEvent.click(chipSugerencia);

    await waitFor(() => {
      expect(screen.getByText('Para registrar un cobro ve a Caja...')).toBeInTheDocument();
    });
    expect(ayudaApi.enviarPreguntaAyuda).toHaveBeenCalledWith(
      expect.objectContaining({
        pregunta: '¿Cómo registro un cobro?',
      })
    );
  });

  it('no utiliza emojis en los textos de la interfaz', async () => {
    let renderResult: any;
    await act(async () => {
      renderResult = render(
        <MemoryRouter>
          <AyudaCapri />
        </MemoryRouter>
      );
    });
    const { container } = renderResult;

    fireEvent.click(screen.getByRole('button', { name: /abrir la ayuda de capri/i }));
    await screen.findByRole('dialog', { name: /ayuda de capri/i });

    const regexEmoji =
      /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;

    expect(regexEmoji.test(container.textContent || '')).toBe(false);
  });
});
