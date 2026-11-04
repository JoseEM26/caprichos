import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { EditorPantalla, usePantallaCompleta } from '../PantallaCompleta';

const CLAVE = 'caprichos_editor_pantalla_completa';
let apiActiva: Element | null = null;

function Editor() {
  const [dialogo, setDialogo] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setDialogo((v) => !v)}>Abrir</button>
      <input aria-label="campo" />
      {dialogo && <div role="dialog" aria-modal="true"><button type="button" onClick={() => setDialogo(false)}>Cerrar dialogo</button></div>}
      <span>contenido</span>
    </div>
  );
}

const estaCompleta = () => screen.getByTestId('editor-pantalla').getAttribute('data-completa') === '1';

describe('EditorPantalla: pantalla completa estable', () => {
  beforeEach(() => {
    localStorage.setItem(CLAVE, '1');
    apiActiva = null;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => apiActiva });
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: vi.fn(() => Promise.resolve()) });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: vi.fn(() => Promise.resolve()) });
  });
  afterEach(() => {
    localStorage.clear();
    delete (document as any).fullscreenElement;
  });

  it('salir de la Fullscreen API del navegador no cierra el overlay', () => {
    render(<EditorPantalla><Editor /></EditorPantalla>);
    expect(estaCompleta()).toBe(true);
    act(() => { fireEvent(document, new Event('fullscreenchange')); });
    expect(estaCompleta()).toBe(true);
    expect(localStorage.getItem(CLAVE)).toBe('1');
  });

  it('Esc con un campo enfocado no cierra', () => {
    render(<EditorPantalla><Editor /></EditorPantalla>);
    screen.getByLabelText('campo').focus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(estaCompleta()).toBe(true);
  });

  it('Esc con un diálogo abierto no cierra', () => {
    render(<EditorPantalla><Editor /></EditorPantalla>);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(estaCompleta()).toBe(true);
  });

  it('Esc sin nada abierto sí cierra', () => {
    render(<EditorPantalla><Editor /></EditorPantalla>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(estaCompleta()).toBe(false);
    expect(localStorage.getItem(CLAVE)).toBe('0');
  });

  it('el botón de salir sí cierra', () => {
    render(<EditorPantalla><ToggleBoton /></EditorPantalla>);
    fireEvent.click(screen.getByRole('button', { name: 'Salir de pantalla completa' }));
    expect(estaCompleta()).toBe(false);
  });

  it('abrir y cerrar una confirmación no cambia el estado de pantalla completa', () => {
    render(<EditorPantalla><Editor /></EditorPantalla>);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar dialogo' }));
    expect(estaCompleta()).toBe(true);
  });
});

function ToggleBoton() {
  const { completa, alternar } = usePantallaCompleta();
  return <button type="button" onClick={alternar}>{completa ? 'Salir de pantalla completa' : 'Pantalla completa'}</button>;
}
