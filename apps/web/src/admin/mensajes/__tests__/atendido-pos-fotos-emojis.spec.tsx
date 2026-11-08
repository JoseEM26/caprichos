import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MensajesView } from '../MensajesView';
import * as api from '../mensajesApi';
import { CuadroEscribir } from '../CuadroEscribir';
import { buscarEmojis, CATEGORIAS_EMOJI, insertarEnCursor } from '../emojis';
import { ListaChats } from '../ListaChats';
import { BurbujaMensaje } from '../BurbujaMensaje';

/** Los filtros de día y de punto de venta viven en el panel plegable «Filtros»: se abre solo si está cerrado. */
export async function abrirFiltros() {
  const b = await screen.findByTestId('boton-filtros');
  if (b.getAttribute('aria-expanded') !== 'true') fireEvent.click(b);
}


vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));

const chat = {
  id: '1', nombre: 'Ana Pérez', telefono: '999888777', identificador_tipo: 'TELEFONO' as const,
  estado: 'atencion' as const, urgente: true, ultimo: 'Hola', hora: '21:03', sinLeer: 0,
  pos: { estado: 'SIN_PEDIDO' as const, codigo: null, pedidoId: null }, faltaProcesar: true,
};
const detalleBase = {
  id: '1', nombre: 'Ana Pérez', telefono: '999888777', modalidad: null, estado: 'atencion' as const, urgente: true,
  dueno: null, esMio: false, ocupado: false, mensajes: [], pedido: null, solicitud: null, tiempoPrometidoMin: 25, altaDemanda: false,
  pos: { estado: 'SIN_COBRAR' as const, codigo: 'CP-0007', pedidoId: '70' },
};

describe('Atendido y punto de venta en la pantalla', () => {
  beforeEach(() => {
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue({
      conteos: { todos: 1, atender: 1, bot: 0, atendidos: 4, faltanProcesar: 1 },
      chats: [chat],
    });
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleBase);
  });
  afterEach(() => vi.restoreAllMocks());

  it('las pestañas muestran los contadores Por atender y Atendidos', async () => {
    render(<MensajesView />);
    expect(await screen.findByRole('button', { name: /Por atender\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Atendidos\s*4/ })).toBeInTheDocument();
  });

  it('el botón Atendido archiva con un clic', async () => {
    vi.spyOn(api, 'marcarAtendido').mockResolvedValue({ ok: true });
    render(<MensajesView />);
    fireEvent.click(await screen.findByTestId('btn-atendido'));
    await waitFor(() => expect(api.marcarAtendido).toHaveBeenCalledWith('1', false));
  });

  it('con un pago por revisar pide confirmar y recién ahí archiva', async () => {
    const err: any = Object.assign(new Error('Este chat tiene un pago por revisar. ¿Archivarlo de todos modos?'), { codigo: 'ATENDIDO_REQUIERE_CONFIRMAR' });
    const marcar = vi.spyOn(api, 'marcarAtendido').mockRejectedValueOnce(err).mockResolvedValue({ ok: true });
    render(<MensajesView />);
    fireEvent.click(await screen.findByTestId('btn-atendido'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, archivar' }));
    await waitFor(() => expect(marcar).toHaveBeenLastCalledWith('1', true));
  });

  it('un chat archivado muestra quién lo marcó y «Volver a Por atender»', async () => {
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue({
      ...detalleBase, estado: 'atendido', atendidoPor: 'Ana Ruiz', atendidoEn: new Date().toISOString(),
    });
    const volver = vi.spyOn(api, 'volverPorAtender').mockResolvedValue({ ok: true });
    render(<MensajesView />);
    expect(await screen.findByTestId('atendido-por-detalle')).toHaveTextContent('Atendido por Ana Ruiz');
    expect(screen.queryByTestId('btn-atendido')).toBeNull();
    fireEvent.click(screen.getByTestId('btn-volver-por-atender'));
    await waitFor(() => expect(volver).toHaveBeenCalledWith('1'));
  });

  it('muestra la insignia del punto de venta con enlace a Caja y filtra «Faltan procesar»', async () => {
    render(<MensajesView />);
    const enCabecera = await screen.findByTestId('pos-detalle-1');
    expect(enCabecera).toHaveTextContent('Pedido sin cobrar · CP-0007');
    expect(enCabecera).toHaveAttribute('href', '/admin/caja?pedido=70');
    expect(screen.getByTestId('pos-1')).toHaveTextContent('Sin pedido');

    await abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: /Faltan procesar \(1\)/ }));
    await waitFor(() => expect(api.listarConversaciones).toHaveBeenLastCalledWith('todos', '', 'faltan'));
  });

  it('ListaChats lista «Ya procesados» y devuelve el filtro elegido', async () => {
    const onPos = vi.fn();
    render(
      <ListaChats
        conteos={{ todos: 1, atender: 0, bot: 0, atendidos: 0 }} busqueda="" onBuscar={() => {}} filtro="todos" onFiltro={() => {}}
        pos={null} onPos={onPos} soloBloqueados={false} onToggleSoloBloqueados={() => {}} cargando={false} chats={[]}
        chatSeleccionadoId={null} onSeleccionar={() => {}}
      />,
    );
    await abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: 'Ya procesados' }));
    expect(onPos).toHaveBeenCalledWith('procesados');
  });
});

describe('CuadroEscribir: emojis y fotos', () => {
  const props = (extra: any = {}): any => ({
    detalle: { ocupado: false, telefono: '987654321' }, respuestasRapidas: [], textoPulido: null, pulirError: null, mensajeCopiado: null,
    onElegirRapida: vi.fn(), onUsarPulido: vi.fn(), onDejarPulido: vi.fn(), textoMensaje: 'Hola mundo', onCambiarTexto: vi.fn(),
    onPulir: vi.fn(), onEnviar: vi.fn(), enviando: false, ...extra,
  });
  beforeEach(() => {
    (URL as any).createObjectURL = vi.fn(() => 'blob:previa');
    (URL as any).revokeObjectURL = vi.fn();
  });

  it('inserta el emoji en la posición del cursor', () => {
    expect(insertarEnCursor('Hola mundo', '😊', 4, 4)).toEqual({ texto: 'Hola😊 mundo', cursor: 6 });
    expect(insertarEnCursor('Hola mundo', '🍩', 5, 10)).toEqual({ texto: 'Hola 🍩', cursor: 7 });
    expect(insertarEnCursor('Hola', '🍩', null, null).texto).toBe('Hola🍩');
  });

  it('el panel inserta donde está el cursor y se cierra', () => {
    const onCambiarTexto = vi.fn();
    render(<CuadroEscribir {...props({ onCambiarTexto })} />);
    const caja = screen.getByLabelText('Escribe un mensaje') as HTMLTextAreaElement;
    caja.setSelectionRange(4, 4);
    fireEvent.click(screen.getByRole('button', { name: 'Elegir un emoji' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'sonrojado gracias amable' })[0]);
    expect(onCambiarTexto).toHaveBeenCalledWith('Hola😊 mundo');
    expect(screen.queryByRole('dialog', { name: 'Elegir un emoji' })).toBeNull();
  });

  it('la lista es compacta (~200), con categorías y búsqueda sin tildes', () => {
    const total = CATEGORIAS_EMOJI.reduce((n, c) => n + c.items.length, 0);
    expect(total).toBeGreaterThanOrEqual(180);
    expect(total).toBeLessThanOrEqual(260);
    expect(buscarEmojis('CAFE').map(([e]) => e)).toContain('☕');
    expect(buscarEmojis('cumpleanos').map(([e]) => e)).toContain('🎂');
    expect(buscarEmojis('cumpleaños').map(([e]) => e)).toContain('🎂');
  });

  it('adjuntar foto: rechaza otro tipo y pesada; con una buena muestra vista previa y envía con subtítulo', async () => {
    const onEnviarImagen = vi.fn().mockResolvedValue(undefined);
    render(<CuadroEscribir {...props({ onEnviarImagen })} />);
    const entrada = screen.getByTestId('entrada-foto');

    fireEvent.change(entrada, { target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] } });
    expect(await screen.findByText('Solo se pueden enviar fotos JPG, PNG o WebP.')).toBeInTheDocument();

    const grande = new File(['x'], 'g.jpg', { type: 'image/jpeg' });
    Object.defineProperty(grande, 'size', { value: 17 * 1024 * 1024 });
    fireEvent.change(entrada, { target: { files: [grande] } });
    expect(await screen.findByText(/pesa más de 16 MB/)).toBeInTheDocument();

    const buena = new File(['x'], 'ok.png', { type: 'image/png' });
    fireEvent.change(entrada, { target: { files: [buena] } });
    expect(await screen.findByAltText('Foto que se va a enviar')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Subtítulo de la foto (opcional)'), { target: { value: ' Así queda ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar foto' }));
    await waitFor(() => expect(onEnviarImagen).toHaveBeenCalledWith(buena, 'Así queda'));
    await waitFor(() => expect(screen.queryByAltText('Foto que se va a enviar')).toBeNull());
  });

  it('si el envío de la foto falla, la vista previa se queda para reintentar', async () => {
    const onEnviarImagen = vi.fn().mockRejectedValue(new Error('x'));
    render(<CuadroEscribir {...props({ onEnviarImagen })} />);
    fireEvent.change(screen.getByTestId('entrada-foto'), { target: { files: [new File(['x'], 'ok.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar foto' }));
    await waitFor(() => expect(onEnviarImagen).toHaveBeenCalled());
    expect(screen.getByAltText('Foto que se va a enviar')).toBeInTheDocument();
  });
});

describe('Mensaje con emojis y saltos de línea', () => {
  it('el texto conserva los saltos y los emojis (el CSS lo muestra con pre-wrap)', () => {
    render(
      <BurbujaMensaje
        mensaje={{ id: '1', autor: 'PERSONA', saliente: true, imagen: false, texto: 'Hola 😊\nGracias 🍩', hora: '10:00' }}
        onReintentar={() => {}}
      />,
    );
    const t = document.querySelector('.msg-texto') as HTMLElement;
    expect(t.textContent).toBe('Hola 😊\nGracias 🍩');
  });
  it('una foto saliente se ve como miniatura con su subtítulo', () => {
    render(
      <BurbujaMensaje
        mensaje={{ id: '2', autor: 'PERSONA', saliente: true, imagen: true, imagenId: '33', texto: 'Así queda', hora: '10:01' }}
        onReintentar={() => {}}
      />,
    );
    expect(screen.getByText('Así queda')).toBeInTheDocument();
  });
});
