import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { ConfiguracionLocalView } from '../ConfiguracionLocalView';

function usarSesion(permisos: string[], rol = 'ADMIN') {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Prueba', rol },
    permisos,
    debeCambiar: false, cargando: false, autenticado: true,
    ingresar: vi.fn(), salir: vi.fn(), renovar: vi.fn(), refrescarYo: vi.fn(), marcarClaveCambiada: vi.fn(),
    tiene: (p: string) => permisos.includes(p) || (rol === 'ADMIN' && p === 'ADMIN'),
  } as any);
}
const montar = (url = '/admin/configuracion') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ConfiguracionLocalView />
    </MemoryRouter>,
  );
const buscador = () => screen.getByRole('combobox', { name: /Buscar un ajuste/i });
const ancho = (n: number) => { (window as any).innerWidth = n; window.dispatchEvent(new Event('resize')); };

describe('Configuración: buscador, grupos y salto al ajuste', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    ancho(1024);
    vi.spyOn(api, 'get').mockResolvedValue({} as any);
    usarSesion(['configuracion/ver', 'configuracion/editar', 'local/ver', 'local/editar']);
  });
  afterEach(() => ancho(1024));

  it('agrupa las categorías con títulos de grupo y cada grupo se pliega con memoria', async () => {
    montar();
    expect(screen.getByRole('tab', { name: /Datos del local/i })).toBeInTheDocument();
    const grupo = screen.getByRole('button', { name: /Ventas y reparto/i });
    expect(grupo).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('tab', { name: /Zonas de reparto/i })).toBeInTheDocument();
    fireEvent.click(grupo);
    expect(grupo).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('tab', { name: /Zonas de reparto/i })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('cfg_nav_grupos_cerrados')!)).toContain('ventas');
  });

  it('el atajo / enfoca el buscador y Esc lo cierra', () => {
    montar();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(buscador()).toHaveFocus();
    fireEvent.change(buscador(), { target: { value: 'spam' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(buscador(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(buscador()).toHaveFocus();
  });

  it('flechas y Enter abren el ajuste: cambia de pestaña y lo resalta', async () => {
    montar();
    fireEvent.change(buscador(), { target: { value: 'razon social' } });
    const opciones = screen.getAllByRole('option');
    expect(opciones[0]).toHaveTextContent(/Razón social/);
    fireEvent.keyDown(buscador(), { key: 'ArrowDown' });
    fireEvent.keyDown(buscador(), { key: 'ArrowUp' });
    fireEvent.keyDown(buscador(), { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('tab', { name: /Empresa/i })).toHaveAttribute('aria-selected', 'true'));
    await waitFor(() => {
      const el = document.querySelector('[data-cfg-id="empresa-razon-social"]')!;
      expect(el).toHaveClass('cfg-resaltado');
    });
    // lo elegido queda en recientes
    expect(JSON.parse(localStorage.getItem('cfg_busq_recientes')!)).toEqual(['empresa-razon-social']);
  });

  it('?tab=&campo= en la URL salta al campo y lo resalta', async () => {
    montar('/admin/configuracion?tab=operacion&campo=operacion-tiempo-base');
    await waitFor(() => expect(document.querySelector('[data-cfg-id="operacion-tiempo-base"]')).toHaveClass('cfg-resaltado'));
  });

  it('sin resultados sugiere acortar y Limpiar vacía el campo', () => {
    montar();
    fireEvent.change(buscador(), { target: { value: 'zzzxqwv' } });
    expect(screen.getByText(/Prueba con una palabra más corta/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(buscador()).toHaveValue('');
  });

  it('muestra máximo 8 resultados y «Ver todos» los expande', () => {
    montar();
    fireEvent.change(buscador(), { target: { value: 'de' } });
    // consulta amplia: todo lo que tenga palabras con «de»
    const n = screen.getAllByRole('option').length;
    expect(n).toBeLessThanOrEqual(8);
    const ver = screen.queryByRole('button', { name: /Ver todos/ });
    if (ver) { fireEvent.click(ver); expect(screen.getAllByRole('option').length).toBeGreaterThan(8); }
  });

  it('no muestra ajustes sin permiso y marca solo lectura', () => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue({} as any);
    usarSesion(['configuracion/ver'], 'CAJERO');
    montar();
    fireEvent.change(buscador(), { target: { value: 'pausar pedidos' } });
    expect(screen.queryByRole('option', { name: /Pausar la recepción/ })).not.toBeInTheDocument();
    fireEvent.change(buscador(), { target: { value: 'horario' } });
    expect(within(screen.getAllByRole('option')[0]).getByText('solo lectura')).toBeInTheDocument();
  });

  it('en celular muestra la lista de categorías y el botón ‹ Configuración vuelve', async () => {
    ancho(390);
    montar();
    expect(buscador()).toBeInTheDocument();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ventas y reparto/i })).not.toBeInTheDocument(); // sin acordeón
    fireEvent.click(screen.getByRole('tab', { name: /Datos del local/i }));
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /‹ Configuración/ }));
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
  });
});
