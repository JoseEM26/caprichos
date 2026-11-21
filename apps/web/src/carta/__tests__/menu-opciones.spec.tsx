import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import * as cuentaModulo from '../cuenta/CuentaContext';
import { CarritoProvider } from '../CarritoContext';
import { CabeceraCarta } from '../CabeceraCarta';
import { iniciarCapturaInstalar } from '../../pwa/instalar';

const cuentaBase = {
  panelAbierto: false, abrirPanel: vi.fn(), cerrarPanel: vi.fn(), ingresar: vi.fn(), registrar: vi.fn(),
  actualizarPerfil: vi.fn(), subirFoto: vi.fn(), quitarFoto: vi.fn(), salir: vi.fn(), refrescar: vi.fn(),
};

function sesion(conCliente: boolean) {
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
    ...cuentaBase,
    cliente: conCliente ? { partyId: '1', nombre: 'José', correo: null, telefono: '987654321', fotoUrl: null, cumpleanos: null, puntos: 12 } : null,
  } as any);
}

const cabecera = () => (
  <CarritoProvider>
    <CabeceraCarta
      busqueda="" onCambioBusqueda={() => {}} estadoLocal={{ abierta: true } as any} datosLocal={{ nombre: 'Caprichos' } as any}
      pagina="carta" onPagina={() => {}} categorias={[]} categoriaActivaId="todo" onCategoria={() => {}}
    />
  </CarritoProvider>
);

const boton = () => screen.getByRole('button', { name: 'Opciones' });

describe('Cabecera de la carta ▸ menú Opciones', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    iniciarCapturaInstalar();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as unknown as typeof window.matchMedia;
    sesion(false);
  });

  it('empieza cerrado y el clic lo abre y lo cierra', async () => {
    render(cabecera());
    expect(boton().getAttribute('aria-haspopup')).toBe('menu');
    expect(boton().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(boton());
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(boton().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(boton());
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Esc lo cierra y devuelve el foco al botón; las flechas recorren las opciones', async () => {
    render(cabecera());
    fireEvent.click(boton());
    const items = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(boton());
  });

  it('un clic fuera lo cierra', async () => {
    render(cabecera());
    fireEvent.click(boton());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('sin sesión: Ingresar, Mi avatar e Instalar aplicación (cada opción mide al menos 44 px)', async () => {
    render(cabecera());
    fireEvent.click(boton());
    const nombres = screen.getAllByRole('menuitem').map((i) => i.textContent);
    expect(nombres.some((n) => /Ingresar o crear cuenta/.test(n ?? ''))).toBe(true);
    expect(nombres.some((n) => /Mi avatar/.test(n ?? ''))).toBe(true);
    expect(nombres.some((n) => /Instalar aplicación/.test(n ?? ''))).toBe(true);
    for (const i of screen.getAllByRole('menuitem')) expect(parseInt(i.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  it('con sesión muestra Mi cuenta con los puntos y Mis pedidos', async () => {
    sesion(true);
    render(cabecera());
    fireEvent.click(boton());
    expect(screen.getByRole('menuitem', { name: /Mi cuenta/ })).toBeInTheDocument();
    expect(screen.getByText('12.00 pts')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Mis pedidos/ })).toBeInTheDocument();
  });

  it('«Instalar aplicación» no aparece si la app ya está instalada', async () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({ matches: q.includes('standalone'), addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    render(cabecera());
    fireEvent.click(boton());
    expect(screen.queryByRole('menuitem', { name: /Instalar aplicación/ })).toBeNull();
  });

  it('Ingresar abre el panel de cuenta y cierra el menú', async () => {
    render(cabecera());
    fireEvent.click(boton());
    fireEvent.click(screen.getByRole('menuitem', { name: /Ingresar o crear cuenta/ }));
    expect(cuentaBase.abrirPanel).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('sin sesión «Mi avatar» lleva a ingresar primero', async () => {
    render(cabecera());
    fireEvent.click(boton());
    fireEvent.click(screen.getByRole('menuitem', { name: /Mi avatar/ }));
    expect(cuentaBase.abrirPanel).toHaveBeenCalled();
  });

  it('el aviso «Nuevo» (punto y globito) se quita al abrir el menú y no vuelve; la etiqueta de la opción, al abrir Mi avatar', async () => {
    const { unmount } = render(cabecera());
    expect(screen.getByTestId('punto-nuevo')).toBeInTheDocument();
    expect(screen.getByText(/¡Nuevo: crea tu avatar!/)).toBeInTheDocument();
    fireEvent.click(boton());
    expect(screen.queryByTestId('punto-nuevo')).toBeNull();
    expect(screen.getByText('Nuevo ✨')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /Mi avatar/ }));
    unmount();
    render(cabecera());
    expect(screen.queryByTestId('punto-nuevo')).toBeNull();
    fireEvent.click(boton());
    expect(screen.queryByText('Nuevo ✨')).toBeNull();
  });

  it('el carrito sigue fuera del menú, junto al botón de opciones', async () => {
    render(cabecera());
    const carrito = screen.getByRole('button', { name: /Abrir el carrito/ });
    expect(carrito.closest('[role="menu"]')).toBeNull();
    expect(carrito.parentElement).toBe(boton().parentElement?.parentElement);
    await act(async () => {});
  });
});
