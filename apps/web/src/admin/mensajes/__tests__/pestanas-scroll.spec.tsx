import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ListaChats } from '../ListaChats';

const dias = { hoy: 47, ayer: 33, manana: 0, anteriores: 35, total: 82 };
const conteos = { todos: 82, atender: 3, bot: 82, atendidos: 7, sinVer: 0, faltanProcesar: 19 } as any;

function montar() {
  render(
    <ListaChats
      {...({
        conteos, busqueda: '', onBuscar: vi.fn(), filtro: 'todos', onFiltro: vi.fn(), pos: null, onPos: vi.fn(),
        soloBloqueados: false, onToggleSoloBloqueados: vi.fn(), cargando: false, chats: [], chatSeleccionadoId: null,
        onSeleccionar: vi.fn(), dia: 'hoy', onDia: vi.fn(), dias, controles: <span>Salientes</span>,
      } as any)}
    />,
  );
  return screen.getByTestId('pestanas');
}

describe('pestañas de la bandeja: scroll lateral con mouse', () => {
  it('el CSS deja UNA fila con scroll lateral visible (no oculto)', () => {
    const css = readFileSync(join(__dirname, '..', 'mensajes.css'), 'utf8');
    const bloque = css.slice(css.indexOf('.msg-tabs { flex: none; flex-wrap: nowrap'));
    expect(bloque.split('\n')[0]).toMatch(/overflow-x: auto/);
    expect(bloque.split('\n')[0]).toMatch(/scrollbar-width: thin/);
    expect(css).not.toMatch(/\.msg-tabs::-webkit-scrollbar\s*\{\s*display:\s*none/);
  });

  it('la rueda del mouse mueve las pestañas hacia los lados cuando no caben', () => {
    const tabs = montar();
    Object.defineProperty(tabs, 'scrollWidth', { configurable: true, value: 600 });
    Object.defineProperty(tabs, 'clientWidth', { configurable: true, value: 300 });
    const ev = createEvent.wheel(tabs, { deltaY: 120 });
    fireEvent(tabs, ev);
    expect(tabs.scrollLeft).toBe(120);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('si caben todas, la rueda no se intercepta (la página sigue desplazándose)', () => {
    const tabs = montar();
    Object.defineProperty(tabs, 'scrollWidth', { configurable: true, value: 300 });
    Object.defineProperty(tabs, 'clientWidth', { configurable: true, value: 300 });
    const ev = createEvent.wheel(tabs, { deltaY: 120 });
    fireEvent(tabs, ev);
    expect(tabs.scrollLeft).toBe(0);
    expect(ev.defaultPrevented).toBe(false);
  });
});
