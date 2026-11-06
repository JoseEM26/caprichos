import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ChatPedidoReparto, chatVigente } from '../ChatPedidoReparto';
import { repartosApi, ChatRepartidor } from '../repartosApi';

const ahora = Date.parse('2026-11-06T15:00:00Z');
const hace = (min: number) => new Date(ahora - min * 60_000).toISOString();

const conMensajes: ChatRepartidor = {
  disponible: true,
  cliente: { nombre: 'Rosa Sanchez', telefono: '***4321' },
  ventanaAbierta: true,
  atendidoPorLocal: false,
  mensajes: [
    { id: '1', de: 'cliente', texto: 'Llego en 5 min?', en: hace(10) },
    { id: '2', de: 'local', texto: 'Sí, ya sale tu pedido', en: hace(8) },
  ],
};

describe('chatVigente: el chat dura mientras el pedido siga en curso o hasta 2 h tras entregarlo', () => {
  it('en curso siempre; entregado hace menos de 2 h sí; más de 2 h no', () => {
    expect(chatVigente('LISTO', null, ahora)).toBe(true);
    expect(chatVigente('EN_CAMINO', null, ahora)).toBe(true);
    expect(chatVigente('ENTREGADO', hace(90), ahora)).toBe(true);
    expect(chatVigente('ENTREGADO', hace(125), ahora)).toBe(false);
    expect(chatVigente('ENTREGADO', null, ahora)).toBe(false);
    expect(chatVigente('COLA', null, ahora)).toBe(false);
  });
});

describe('ChatPedidoReparto: hilo de un solo cliente con caja para escribir', () => {
  let obtener: any;
  let enviar: any;

  beforeEach(() => {
    obtener = vi.spyOn(repartosApi, 'obtenerChat').mockResolvedValue(conMensajes);
    enviar = vi.spyOn(repartosApi, 'enviarChat').mockResolvedValue({ id: '9' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const abrir = () => render(<ChatPedidoReparto pedidoId="101" codigo="CP-0101" alCerrar={() => {}} />);

  it('muestra solo el hilo de ese pedido, con nombre y teléfono enmascarado', async () => {
    abrir();
    const dialogo = await screen.findByRole('dialog', { name: 'Chat de WhatsApp del pedido CP-0101' });
    expect(obtener).toHaveBeenCalledWith('101');
    expect(await within(dialogo).findByText('Llego en 5 min?')).toBeInTheDocument();
    expect(within(dialogo).getByText('Sí, ya sale tu pedido')).toBeInTheDocument();
    expect(dialogo).toHaveTextContent('Rosa Sanchez');
    expect(dialogo).toHaveTextContent('***4321');
  });

  it('envía el texto a ese pedido y limpia la caja', async () => {
    abrir();
    const caja = await screen.findByLabelText('Escribe un mensaje al cliente');
    fireEvent.change(caja, { target: { value: '  Ya llegamos  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() => expect(enviar).toHaveBeenCalledWith('101', 'Ya llegamos'));
    await waitFor(() => expect(caja).toHaveValue(''));
  });

  it('con la ventana de 24 h cerrada no deja escribir y lo explica', async () => {
    obtener.mockResolvedValue({ ...conMensajes, ventanaAbierta: false });
    abrir();
    expect(await screen.findByText(/Pasaron 24 h sin respuesta del cliente; el local debe escribirle/)).toBeInTheDocument();
    expect(screen.getByLabelText('Escribe un mensaje al cliente')).toBeDisabled();
  });

  it('si el cliente no tiene chat lo dice y no muestra caja', async () => {
    obtener.mockResolvedValue({ disponible: false, motivo: 'Este cliente no tiene chat' });
    abrir();
    expect(await screen.findByText('Este cliente no tiene chat')).toBeInTheDocument();
    expect(screen.queryByLabelText('Escribe un mensaje al cliente')).toBeNull();
  });

  it('si el servidor rechaza el envío muestra su mensaje', async () => {
    enviar.mockRejectedValue(new Error('Pasaron 24 h sin respuesta del cliente; el local debe escribirle'));
    abrir();
    const caja = await screen.findByLabelText('Escribe un mensaje al cliente');
    fireEvent.change(caja, { target: { value: 'hola' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pasaron 24 h sin respuesta del cliente');
  });

  it('se cierra con el botón Cerrar chat', async () => {
    const alCerrar = vi.fn();
    render(<ChatPedidoReparto pedidoId="101" codigo="CP-0101" alCerrar={alCerrar} />);
    await screen.findByText('Llego en 5 min?');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar chat' }));
    expect(alCerrar).toHaveBeenCalled();
  });
});
