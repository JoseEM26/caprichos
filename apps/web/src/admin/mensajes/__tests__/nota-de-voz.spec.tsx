import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const obtenerBlob = vi.fn();
vi.mock('../../../comun/api', () => ({ obtenerBlobAutenticado: (r: string) => obtenerBlob(r) }));

import { BurbujaMensaje } from '../BurbujaMensaje';
import type { MensajeItem } from '../mensajesTipos';

const base: MensajeItem = {
  id: '5',
  autor: 'CLIENTE',
  saliente: false,
  imagen: false,
  texto: 'Nota de voz',
  hora: '10:00',
  audioId: '77',
  transcripcion: 'quiero dos donas para hoy',
};

describe('Nota de voz en la burbuja', () => {
  beforeEach(() => {
    obtenerBlob.mockReset();
    obtenerBlob.mockResolvedValue('blob:audio-77');
  });

  it('carga el audio con la sesión (ruta privada), lo muestra con controles y la transcripción con su etiqueta', async () => {
    const { container } = render(<BurbujaMensaje mensaje={base} onReintentar={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('audio')).toBeTruthy());
    expect(obtenerBlob).toHaveBeenCalledWith('/admin/archivos/77');
    const audio = container.querySelector('audio')!;
    expect(audio.getAttribute('src')).toBe('blob:audio-77');
    expect(audio.hasAttribute('controls')).toBe(true);
    expect(screen.getByTestId('transcripcion-audio').tagName).toBe('EM');
    expect(screen.getByText('quiero dos donas para hoy')).toBeTruthy();
    expect(screen.getByText('Transcrito con IA')).toBeTruthy();
    expect(screen.getByText('Descargar audio')).toBeTruthy();
  });

  it('la velocidad rota 1x, 1.5x, 2x y se aplica al audio', async () => {
    const { container } = render(<BurbujaMensaje mensaje={base} onReintentar={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('audio')).toBeTruthy());
    const audio = container.querySelector('audio') as HTMLAudioElement;
    fireEvent.click(screen.getByRole('button', { name: /Velocidad de reproducción 1x/ }));
    expect(audio.playbackRate).toBe(1.5);
    fireEvent.click(screen.getByRole('button', { name: /Velocidad de reproducción 1.5x/ }));
    expect(audio.playbackRate).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: /Velocidad de reproducción 2x/ }));
    expect(audio.playbackRate).toBe(1);
  });

  it('sin transcripción no muestra la etiqueta; si el navegador no lo reproduce deja el enlace de descarga', async () => {
    const { container } = render(<BurbujaMensaje mensaje={{ ...base, transcripcion: null }} onReintentar={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('audio')).toBeTruthy());
    expect(screen.queryByText('Transcrito con IA')).toBeNull();
    fireEvent.error(container.querySelector('audio')!);
    expect(screen.getByText(/No se pudo reproducir el audio/)).toBeTruthy();
    expect(screen.getByText('Descargar audio')).toBeTruthy();
  });

  it('si la descarga falla (sin permiso) avisa sin romper', async () => {
    obtenerBlob.mockRejectedValue(new Error('403'));
    render(<BurbujaMensaje mensaje={base} onReintentar={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/No se pudo reproducir el audio/)).toBeTruthy());
  });
});
