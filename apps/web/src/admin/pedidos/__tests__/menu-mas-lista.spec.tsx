import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MenuMas } from '../ListaCaja';
import type { Pedido } from '../pedidosApi';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const ped = (codigo: string) => ({ id: codigo, codigo }) as unknown as Pedido;

function filas(alVer = vi.fn(), alAbrir = vi.fn()) {
  return render(
    <ul style={{ overflow: 'hidden' }} data-testid="lista">
      {['P-1', 'P-2'].map((c) => (
        <li key={c} style={{ overflow: 'hidden' }}><MenuMas p={ped(c)} alVerDetalle={alVer} alAbrir={alAbrir} /></li>
      ))}
    </ul>,
  );
}

const boton = (c: string) => screen.getByRole('button', { name: `Más acciones de ${c}` });

describe('Menú ⋮ de la fila (Lista de Caja)', () => {
  it('abre fuera de la lista (portal a body): ninguna fila con overflow lo recorta ni lo tapa', () => {
    filas();
    fireEvent.click(boton('P-1'));
    const menu = screen.getByRole('menu', { name: 'Acciones de P-1' });
    expect(screen.getByTestId('lista').contains(menu)).toBe(false);
    expect(menu.parentElement).toBe(document.body);
    // la hoja de estilos no carga en jsdom: la clase fija (position: fixed; z-index: 1000) y la posición en línea
    expect(menu.className).toBe('lc-menu');
    expect(menu.style.top).not.toBe('');
    expect(boton('P-1').getAttribute('aria-haspopup')).toBe('menu');
    expect(boton('P-1').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('si no cabe abajo se abre hacia arriba y no se sale por la derecha', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(90);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(210);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 540, bottom: 580, left: 380, right: 420, width: 40, height: 40, x: 380, y: 540, toJSON() {} } as DOMRect);
    filas();
    fireEvent.click(boton('P-1'));
    const menu = screen.getByRole('menu');
    expect(menu.style.top).toBe('446px'); // 540 - 4 - 90
    expect(menu.style.left).toBe('182px'); // tope: 400 - 210 - 8
  });

  it('teclado: flecha abajo abre y enfoca el primero, las flechas navegan, Esc cierra y devuelve el foco al botón', () => {
    filas();
    const b = boton('P-1');
    b.focus();
    fireEvent.keyDown(b, { key: 'ArrowDown' });
    const items = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(b);
    expect(b.getAttribute('aria-expanded')).toBe('false');
  });

  it('solo uno abierto a la vez', () => {
    filas();
    fireEvent.click(boton('P-1'));
    fireEvent.click(boton('P-2'));
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    expect(screen.getByRole('menu', { name: 'Acciones de P-2' })).toBeTruthy();
  });

  it('cierra con clic fuera, con scroll y al cambiar de tamaño; un clic dentro del menú no lo cierra', () => {
    filas();
    fireEvent.click(boton('P-1'));
    fireEvent.mouseDown(screen.getByRole('menu'));
    expect(screen.queryByRole('menu')).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(boton('P-1'));
    fireEvent.scroll(window);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(boton('P-1'));
    fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('elegir una opción la ejecuta con el pedido y cierra el menú', () => {
    const alVer = vi.fn();
    const alAbrir = vi.fn();
    filas(alVer, alAbrir);
    fireEvent.click(boton('P-2'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Abrir el pedido' }));
    expect(alAbrir).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'P-2' }));
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(boton('P-1'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ver detalle de la venta' }));
    expect(alVer).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'P-1' }));
  });
});
