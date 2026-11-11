import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CuadroEscribir, MOTIVO_VENTANA } from '../CuadroEscribir';
import { BurbujaMensaje } from '../BurbujaMensaje';

const obtenerBlob = vi.fn();
// función simple (no vi.fn) para simular el fallo: así no queda una promesa rechazada registrada por el espía
let fallar = false;
vi.mock('../../../comun/api', async (orig) => ({
  ...(await orig<any>()),
  obtenerBlobAutenticado: (r: string) => (fallar ? new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('403')), 0)) : obtenerBlob(r)),
}));

const props = (extra: any = {}, detalle: any = {}): any => ({
  detalle: { ocupado: false, nombre: 'Ana', telefono: '987654321', ventanaAbierta: true, ...detalle },
  respuestasRapidas: [], textoPulido: null, pulirError: null, mensajeCopiado: null,
  onElegirRapida: vi.fn(), onUsarPulido: vi.fn(), onDejarPulido: vi.fn(), textoMensaje: '', onCambiarTexto: vi.fn(),
  onPulir: vi.fn(), onEnviar: vi.fn(), enviando: false, onEnviarDocumento: vi.fn().mockResolvedValue(undefined), ...extra,
});
const archivo = (nombre = 'menu.docx', tam = 120 * 1024) => {
  const f = new File(['x'], nombre, { type: 'application/octet-stream' });
  Object.defineProperty(f, 'size', { value: tam });
  return f;
};
const elegir = (f: File) => fireEvent.change(screen.getByTestId('entrada-documento'), { target: { files: [f] } });

describe('Adjuntar documento en el chat', () => {
  beforeEach(() => {
    obtenerBlob.mockReset();
    fallar = false;
  });

  it('muestra el botón «Adjuntar documento» y el selector solo acepta los tipos permitidos', () => {
    render(<CuadroEscribir {...props()} />);
    const b = screen.getByRole('button', { name: 'Adjuntar documento' });
    expect(b).toBeEnabled();
    expect(b).toHaveTextContent('Documento');
    expect(screen.getByTestId('entrada-documento')).toHaveAttribute('accept', '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv');
  });

  it('un tipo no permitido o muy pesado muestra el error y no abre la confirmación', () => {
    render(<CuadroEscribir {...props()} />);
    elegir(archivo('programa.exe'));
    expect(screen.getByTestId('error-documento')).toHaveTextContent('PDF, Word, Excel, PowerPoint o de texto');
    expect(screen.queryByRole('group', { name: 'Vista previa del documento' })).toBeNull();
    elegir(archivo('grande.pdf', 17 * 1024 * 1024));
    expect(screen.getByTestId('error-documento')).toHaveTextContent('16 MB');
    elegir(archivo('vacio.pdf', 0));
    expect(screen.getByTestId('error-documento')).toHaveTextContent('vacío');
  });

  it('muestra nombre, tamaño y la pregunta Sí/No; «No» cancela sin enviar', () => {
    const p = props();
    render(<CuadroEscribir {...p} />);
    elegir(archivo());
    const vista = screen.getByRole('group', { name: 'Vista previa del documento' });
    expect(vista).toHaveTextContent('menu.docx');
    expect(vista).toHaveTextContent('120 KB');
    expect(vista).toHaveTextContent('¿Enviar este documento a Ana?');
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(p.onEnviarDocumento).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Vista previa del documento' })).toBeNull();
  });

  it('«Sí, enviar» muestra «Enviando…», llama una sola vez y cierra la vista previa', async () => {
    let terminar!: () => void;
    const p = props({ onEnviarDocumento: vi.fn(() => new Promise<void>((r) => (terminar = r))) });
    render(<CuadroEscribir {...p} />);
    const f = archivo();
    elegir(f);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar' }));
    expect(await screen.findByRole('button', { name: 'Enviando…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Enviando…' })); // doble toque: no duplica
    expect(p.onEnviarDocumento).toHaveBeenCalledTimes(1);
    expect(p.onEnviarDocumento).toHaveBeenCalledWith(f);
    terminar();
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Vista previa del documento' })).toBeNull());
  });

  it('si el envío falla, la vista previa queda para reintentar', async () => {
    const p = props({ onEnviarDocumento: vi.fn().mockRejectedValue(new Error('x')) });
    render(<CuadroEscribir {...p} />);
    elegir(archivo());
    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sí, enviar' })).toBeEnabled());
    expect(screen.getByRole('group', { name: 'Vista previa del documento' })).toBeInTheDocument();
  });

  it('fuera de la ventana de 24 h el botón está deshabilitado con el motivo', () => {
    render(<CuadroEscribir {...props({}, { ventanaAbierta: false })} />);
    const b = screen.getByRole('button', { name: 'Adjuntar documento' });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('title', MOTIVO_VENTANA);
  });

  it('sin la función de envío no se muestra el botón', () => {
    render(<CuadroEscribir {...props({ onEnviarDocumento: undefined })} />);
    expect(screen.queryByRole('button', { name: 'Adjuntar documento' })).toBeNull();
  });
});

describe('Tarjeta de documento en el hilo', () => {
  const msg = (extra: any = {}): any => ({
    id: '5', autor: 'CLIENTE', saliente: false, imagen: false, texto: '📄 menu.docx (120 KB)', hora: '10:00', estado: undefined,
    documento: { nombre: 'menu.docx', bytes: 120 * 1024, mime: 'x', url: '/admin/mensajes/documentos/5' }, ...extra,
  });

  beforeEach(() => {
    obtenerBlob.mockReset();
    fallar = false;
  });

  it('recibido: ícono, nombre, tamaño y Descargar con la sesión (nunca link directo)', async () => {
    obtenerBlob.mockResolvedValue('blob:doc');
    render(<BurbujaMensaje mensaje={msg()} onReintentar={vi.fn()} />);
    const t = screen.getByTestId('tarjeta-documento');
    expect(t).toHaveTextContent('menu.docx');
    expect(t).toHaveTextContent('120 KB');
    expect(t.querySelector('a')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar menu.docx' }));
    await waitFor(() => expect(obtenerBlob).toHaveBeenCalledWith('/admin/mensajes/documentos/5'));
  });

  it('enviado por el equipo también muestra la tarjeta', () => {
    render(<BurbujaMensaje mensaje={msg({ autor: 'PERSONA', saliente: true, estado: 'ENVIADO' })} onReintentar={vi.fn()} />);
    expect(screen.getByTestId('tarjeta-documento')).toBeInTheDocument();
    expect(screen.getByText('Enviado')).toBeInTheDocument();
  });

  it('si la descarga falla muestra el error en español', async () => {
    fallar = true;
    render(<BurbujaMensaje mensaje={msg()} onReintentar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar menu.docx' }));
    expect(await screen.findByText('No se pudo descargar el documento. Intenta de nuevo.')).toBeInTheDocument();
  });

  it('un envío fallido de documento no ofrece Reintentar', () => {
    render(<BurbujaMensaje mensaje={msg({ autor: 'PERSONA', saliente: true, estado: 'FALLIDO', puedeReintentar: false })} onReintentar={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });
});
