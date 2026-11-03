import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MensajesView } from '../MensajesView';
import * as api from '../mensajesApi';
import { obtenerBlobAutenticado } from '../../../comun/api';

vi.mock('../../../comun/socket', () => ({
  useEventos: vi.fn(),
}));

vi.mock('../../../comun/api', async (orig) => ({
  ...(await orig<typeof import('../../../comun/api')>()),
  obtenerBlobAutenticado: vi.fn().mockResolvedValue('blob:foto-cliente'),
}));

const chat = {
  id: '1',
  nombre: 'Ana Pérez',
  telefono: '999888777',
  identificador_tipo: 'TELEFONO' as const,
  estado: 'validar' as const,
  urgente: false,
  ultimo: 'Te envío el pago',
  hora: '21:03',
  sinLeer: 1,
};

const pedido = {
  id: '50',
  codigo: 'CP-0002',
  medio: 'Yape',
  total: '34.50',
  lineas: ['1 x FRAPPE OREO Grande 16 oz'],
};

const detalleBase = {
  id: '1',
  nombre: 'Ana Pérez',
  telefono: '999888777',
  modalidad: 'Delivery',
  estado: 'validar' as const,
  urgente: false,
  dueno: null,
  esMio: false,
  ocupado: false,
  mensajes: [
    {
      id: '10',
      autor: 'CLIENTE' as const,
      saliente: false,
      imagen: false,
      texto: 'Te envío el pago',
      hora: '21:03',
    },
  ],
  pedido,
  solicitud: null,
  tiempoPrometidoMin: 25,
  altaDemanda: false,
};

describe('Diseño nuevo de Mensajes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(obtenerBlobAutenticado).mockResolvedValue('blob:foto-cliente');
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue({
      conteos: { todos: 1, atender: 1, bot: 0, atendidos: 0 },
      chats: [chat],
    });
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
    vi.spyOn(api, 'aprobarPagoChat').mockResolvedValue({ ok: true });
    vi.spyOn(api, 'rechazarPagoChat').mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('el aviso de derivación sale como un evento de una sola línea, no como tarjeta', async () => {
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue({
      ...detalleBase,
      estado: 'atencion',
      motivoDerivacion: 'Pide cambiar la dirección del pedido',
    });
    render(<MensajesView />);

    const evento = await screen.findByTestId('banner-motivo-derivacion');
    expect(evento).toHaveClass('msg-evento');
    expect(evento).toHaveAttribute('data-tono', 'aviso');
    expect(evento).toHaveTextContent('Derivado a asesor: Pide cambiar la dirección del pedido');
    // Un evento no lleva botones
    expect(within(evento).queryByRole('button')).toBeNull();
  });

  it('la barra «Acción pendiente» aprueba el pago con confirmación Sí/No', async () => {
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleBase);
    render(<MensajesView />);

    const barra = await screen.findByRole('region', { name: 'Acción pendiente' });
    expect(within(barra).getByText(/Revisa el comprobante: aprueba o rechaza el pedido CP-0002/)).toBeInTheDocument();

    fireEvent.click(within(barra).getByRole('button', { name: 'Aprobar pago' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sí, aprobar pago' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Sí, aprobar pago' }));

    await waitFor(() => expect(api.aprobarPagoChat).toHaveBeenCalledWith('1'));
  });

  it('la barra también rechaza el pedido con confirmación', async () => {
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleBase);
    render(<MensajesView />);

    const barra = await screen.findByRole('region', { name: 'Acción pendiente' });
    fireEvent.click(within(barra).getByRole('button', { name: 'Rechazar pedido' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sí, rechazar' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Sí, rechazar' }));

    await waitFor(() => expect(api.rechazarPagoChat).toHaveBeenCalledWith('1'));
  });

  it('la miniatura de la foto abre el visor y se cierra con Esc', async () => {
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue({
      ...detalleBase,
      mensajes: [
        ...detalleBase.mensajes,
        { id: '11', autor: 'CLIENTE' as const, saliente: false, imagen: true, imagenId: '77', texto: '', hora: '21:04' },
      ],
    });
    render(<MensajesView />);

    const miniatura = await screen.findByRole('button', { name: 'Ver la foto en pantalla completa' });
    fireEvent.click(miniatura);

    const visor = await screen.findByRole('dialog', { name: 'Foto enviada por el cliente' });
    expect(visor).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Foto enviada por el cliente' })).toBeNull());
  });

  it('el panel «Pedido y acciones» se pliega y se despliega', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })),
    );
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleBase);
    render(<MensajesView />);

    const boton = await screen.findByRole('button', { name: 'Ocultar' });
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Total s/ 34.50')).toBeVisible();

    fireEvent.click(boton);
    const plegado = await screen.findByRole('button', { name: 'Mostrar' });
    expect(plegado).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('complementary', { name: 'Pedido y acciones' })).toHaveAttribute('data-abierto', '0');

    fireEvent.click(plegado);
    expect(screen.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('en celular el botón Detalles abre el pedido y acciones como hoja', async () => {
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleBase);
    render(<MensajesView />);

    const panel = await screen.findByRole('complementary', { name: 'Pedido y acciones' });
    expect(panel).toHaveAttribute('data-abierto', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Ver pedido y acciones' }));
    expect(panel).toHaveAttribute('data-abierto', '1');
  });

  it('la lista de chats es una lista con cada chat como botón y el chat abierto marcado', async () => {
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleBase);
    render(<MensajesView />);

    const lista = await screen.findByRole('list', { name: 'Conversaciones' });
    const fila = within(lista).getByRole('button', { name: /Ana Pérez/ });
    await waitFor(() => expect(fila).toHaveAttribute('aria-current', 'true'));
    expect(screen.getByRole('log', { name: 'Mensajes de la conversación' })).toBeInTheDocument();
  });
  it('la lectura del voucher sale como resumen (monto, medio, operación, estado) con el detalle plegado', async () => {
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue({
      ...detalleBase,
      voucher: {
        id: 'v1',
        semaforo: 'CONFIABLE' as const,
        motivos: [],
        medio: 'YAPE',
        extraido: {
          legible: true,
          monto: 34.5,
          operacion: '908172',
          fecha: null,
          hora: null,
          titular: null,
          destinoNumero: null,
          medioDetectado: 'YAPE' as const,
          confianza: 0.9,
        },
      },
    });
    render(<MensajesView />);

    const seccion = await screen.findByRole('region', { name: 'Comprobante de pago' });
    expect(within(seccion).getByText('s/ 34.50')).toBeInTheDocument();
    expect(within(seccion).getByText('Operación').nextElementSibling).toHaveTextContent('908172');
    expect(within(seccion).getByText('Estado').nextElementSibling).toHaveTextContent('Confiable · por revisar');
    // El detalle completo queda dentro de un bloque plegable
    expect(within(seccion).getByText('Ver la lectura completa').closest('details')).not.toBeNull();
  });
});
