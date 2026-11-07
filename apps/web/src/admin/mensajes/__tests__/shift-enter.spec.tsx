import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CuadroEscribir } from '../CuadroEscribir';

describe('CuadroEscribir: Enter y Shift+Enter', () => {
  const props: any = {
    detalle: { ocupado: false, telefono: '987654321' },
    respuestasRapidas: [],
    textoPulido: null,
    pulirError: null,
    mensajeCopiado: null,
    onElegirRapida: vi.fn(),
    onUsarPulido: vi.fn(),
    onDejarPulido: vi.fn(),
    textoMensaje: 'hola',
    onCambiarTexto: vi.fn(),
    onPulir: vi.fn(),
    enviando: false,
  };
  it('Enter envía y Shift+Enter no', () => {
    const onEnviar = vi.fn();
    render(<CuadroEscribir {...props} onEnviar={onEnviar} />);
    const caja = screen.getByLabelText('Escribe un mensaje');
    fireEvent.keyDown(caja, { key: 'Enter', shiftKey: true });
    expect(onEnviar).not.toHaveBeenCalled();
    fireEvent.keyDown(caja, { key: 'Enter' });
    expect(onEnviar).toHaveBeenCalledTimes(1);
  });
});
