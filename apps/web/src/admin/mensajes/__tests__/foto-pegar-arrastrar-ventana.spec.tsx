import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CuadroEscribir, MOTIVO_VENTANA } from '../CuadroEscribir';
import { BurbujaMensaje } from '../BurbujaMensaje';

const props = (extra: any = {}, detalle: any = {}): any => ({
  detalle: { ocupado: false, telefono: '987654321', ventanaAbierta: true, ...detalle },
  respuestasRapidas: [], textoPulido: null, pulirError: null, mensajeCopiado: null,
  onElegirRapida: vi.fn(), onUsarPulido: vi.fn(), onDejarPulido: vi.fn(), textoMensaje: '', onCambiarTexto: vi.fn(),
  onPulir: vi.fn(), onEnviar: vi.fn(), enviando: false, onEnviarImagen: vi.fn().mockResolvedValue(undefined), ...extra,
});
const png = () => new File(['x'], 'p.png', { type: 'image/png' });

describe('Foto en el chat: pegar, arrastrar y ventana de 24 h', () => {
  beforeEach(() => {
    (URL as any).createObjectURL = vi.fn(() => 'blob:previa');
    (URL as any).revokeObjectURL = vi.fn();
  });

  it('el botón «Adjuntar foto» es visible, con texto «Foto» y habilitado', () => {
    render(<CuadroEscribir {...props()} />);
    const b = screen.getByRole('button', { name: 'Adjuntar foto' });
    expect(b).toBeEnabled();
    expect(b).toHaveTextContent('Foto');
  });

  it('pegar una imagen con Ctrl+V abre la vista previa; quitar la cierra', async () => {
    render(<CuadroEscribir {...props()} />);
    fireEvent.paste(screen.getByLabelText('Escribe un mensaje'), { clipboardData: { files: [png()] } });
    expect(await screen.findByAltText('Foto que se va a enviar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(screen.queryByAltText('Foto que se va a enviar')).toBeNull();
  });

  it('pegar solo texto no abre vista previa', () => {
    render(<CuadroEscribir {...props()} />);
    fireEvent.paste(screen.getByLabelText('Escribe un mensaje'), { clipboardData: { files: [] } });
    expect(screen.queryByAltText('Foto que se va a enviar')).toBeNull();
  });

  it('arrastrar y soltar una imagen abre la vista previa y se envía con su leyenda', async () => {
    const onEnviarImagen = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<CuadroEscribir {...props({ onEnviarImagen })} />);
    const archivo = png();
    fireEvent.drop(container.querySelector('.msg-componer')!, { dataTransfer: { files: [archivo], types: ['Files'] } });
    expect(await screen.findByAltText('Foto que se va a enviar')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Subtítulo de la foto (opcional)'), { target: { value: 'Mira' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar foto' }));
    await waitFor(() => expect(onEnviarImagen).toHaveBeenCalledWith(archivo, 'Mira'));
  });

  it('acepta WebP', async () => {
    render(<CuadroEscribir {...props()} />);
    fireEvent.change(screen.getByTestId('entrada-foto'), { target: { files: [new File(['x'], 'a.webp', { type: 'image/webp' })] } });
    expect(await screen.findByAltText('Foto que se va a enviar')).toBeInTheDocument();
  });

  it('fuera de la ventana de 24 h el botón se deshabilita con el motivo visible y pegar/soltar no hacen nada', () => {
    const { container } = render(<CuadroEscribir {...props({}, { ventanaAbierta: false })} />);
    expect(screen.getByRole('button', { name: 'Adjuntar foto' })).toBeDisabled();
    expect(screen.getByTestId('motivo-foto')).toHaveTextContent(MOTIVO_VENTANA);
    fireEvent.paste(screen.getByLabelText('Escribe un mensaje'), { clipboardData: { files: [png()] } });
    fireEvent.drop(container.querySelector('.msg-componer')!, { dataTransfer: { files: [png()], types: ['Files'] } });
    expect(screen.queryByAltText('Foto que se va a enviar')).toBeNull();
  });

  it('si el envío falla muestra la vista previa para reintentar y el segundo intento envía', async () => {
    const onEnviarImagen = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined);
    render(<CuadroEscribir {...props({ onEnviarImagen })} />);
    fireEvent.change(screen.getByTestId('entrada-foto'), { target: { files: [png()] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar foto' }));
    await waitFor(() => expect(onEnviarImagen).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar foto' }));
    await waitFor(() => expect(onEnviarImagen).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByAltText('Foto que se va a enviar')).toBeNull());
  });

  it('la burbuja saliente muestra la foto con su leyenda', () => {
    render(
      <BurbujaMensaje
        mensaje={{ id: '2', autor: 'PERSONA', saliente: true, imagen: true, imagenId: '33', texto: 'Así queda', hora: '10:01' }}
        onReintentar={() => {}}
      />,
    );
    expect(screen.getByText('Así queda')).toBeInTheDocument();
    expect(document.querySelector('[aria-label*="Foto"], img[alt="Foto enviada al cliente"], .msg-foto')).not.toBeNull();
  });
});
