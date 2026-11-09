import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CuadroEscribir } from '../CuadroEscribir';
import { insertarEnCursor } from '../emojis';
import { obtenerIniciales } from '../utilidadesChat';

const props = (extra: any = {}, det: any = {}): any => ({
  detalle: { id: 'c1', ocupado: false, telefono: '987654321', ...det }, respuestasRapidas: [], textoPulido: null, pulirError: null,
  mensajeCopiado: null, onElegirRapida: vi.fn(), onUsarPulido: vi.fn(), onDejarPulido: vi.fn(), textoMensaje: 'Hola mundo',
  onCambiarTexto: vi.fn(), onPulir: vi.fn(), onEnviar: vi.fn(), enviando: false, ...extra,
});

describe('insertarEnCursor con emojis de varios códigos', () => {
  it('ZWJ, bandera y tono entran enteros en inicio, medio y final', () => {
    for (const e of ['👩‍🍳', '🇵🇪', '👍🏽']) {
      expect(insertarEnCursor('ab', e, 0, 0)).toEqual({ texto: e + 'ab', cursor: e.length });
      expect(insertarEnCursor('ab', e, 1, 1).texto).toBe('a' + e + 'b');
      expect(insertarEnCursor('ab', e, null, null)).toEqual({ texto: 'ab' + e, cursor: 2 + e.length });
    }
    expect(insertarEnCursor('', '😊', 0, 0)).toEqual({ texto: '😊', cursor: 2 });
  });
  it('una selección que corta un par sustituto no deja medio emoji', () => {
    const r = insertarEnCursor('a🍩b', '😊', 2, 2); // 2 = mitad del 🍩
    expect(r.texto).toBe('a😊🍩b');
    expect(r.texto).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(insertarEnCursor('a🍩b', 'X', 2, 3).texto).toBe('aXb');
  });
});

describe('selector de emojis', () => {
  it('se abre, busca «dona» y «gracias», inserta y devuelve el foco', async () => {
    const onCambiarTexto = vi.fn();
    render(<CuadroEscribir {...props({ onCambiarTexto })} />);
    (screen.getByLabelText('Escribe un mensaje') as HTMLTextAreaElement).setSelectionRange(10, 10);
    fireEvent.click(screen.getByRole('button', { name: 'Elegir un emoji' }));
    fireEvent.change(screen.getByLabelText('Buscar un emoji'), { target: { value: 'dona' } });
    expect(screen.getByText('🍩')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar un emoji'), { target: { value: 'gracias' } });
    expect(screen.getByText('🙏')).toBeTruthy();
    fireEvent.click(screen.getByText('🙏'));
    expect(onCambiarTexto).toHaveBeenCalledWith('Hola mundo🙏');
    await new Promise((r) => setTimeout(r, 5));
    expect(document.activeElement).toBe(screen.getByLabelText('Escribe un mensaje'));
  });
  it('Escape cierra y el foco vuelve al cuadro', () => {
    render(<CuadroEscribir {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Elegir un emoji' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Elegir un emoji' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Escribe un mensaje'));
  });
  it('chat tomado por otra persona: botón deshabilitado con motivo claro', () => {
    render(<CuadroEscribir {...props({}, { ocupado: true })} />);
    const b = screen.getByRole('button', { name: 'Elegir un emoji' }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.title).toBe('Para usar emojis, toma el chat');
  });
  it('no se queda abierto al cambiar de chat', () => {
    const { rerender } = render(<CuadroEscribir {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Elegir un emoji' }));
    rerender(<CuadroEscribir {...props({}, { id: 'c2' })} />);
    expect(screen.queryByRole('dialog', { name: 'Elegir un emoji' })).toBeNull();
  });
  it('el panel queda por encima del fondo que cierra el menú (si no, tocar un emoji no inserta)', () => {
    const css = readFileSync(join(__dirname, '..', 'mensajes.css'), 'utf8');
    const z = (sel: string) => Number(new RegExp(`${sel.replace('.', '\\.')} \\{[^}]*?z-index:\\s*(\\d+)`).exec(css)?.[1]);
    expect(z('.msg-emojis')).toBeGreaterThan(z('.msg-menu-fondo'));
  });
});

describe('iniciales con emoji', () => {
  it('no parten el emoji a la mitad', () => {
    expect(obtenerIniciales('🍩 Ana')).toBe('🍩A');
    expect(obtenerIniciales('😊')).toBe('😊');
  });
});
