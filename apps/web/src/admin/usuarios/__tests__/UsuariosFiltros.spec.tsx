import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UsuariosView } from '../UsuariosView';
import * as sesionModulo from '../../../comun/sesion';
import { api } from '../../../comun/api';

const U = (id: string, nombres: string) => ({
  id,
  partyId: id,
  nombres,
  apellidos: 'Prueba',
  dni: '11****44',
  rol: 'CAJERO',
  activo: true,
  debeCambiar: false,
  altaEn: '2026-10-21T00:00:00.000Z',
});
const CONTEOS = { total: 12, activos: 9, inactivos: 3, porRol: { ADMIN: 2, CAJERO: 4, PRODUCCION: 5, MOZO: 1, REPARTIDOR: 0 } };
const resp = (elementos: any[]) => ({ total: elementos.length, pagina: 1, limite: 15, totalPaginas: 1, elementos, conteos: CONTEOS });

function montar(impl?: (url: string) => Promise<any>) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' },
    permisos: [],
    tiene: vi.fn().mockReturnValue(true),
  } as any);
  const get = vi.spyOn(api, 'get').mockImplementation((async (url: string) => (impl ? impl(url) : resp([U('2', 'Lucia')]))) as any);
  render(
    <MemoryRouter>
      <UsuariosView />
    </MemoryRouter>,
  );
  const ultima = () => new URLSearchParams(String(get.mock.calls.filter((c) => String(c[0]).includes('pagina=')).at(-1)![0]).split('?')[1]);
  return { get, ultima };
}

async function elegir(combo: RegExp, opcion: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: combo }));
  fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: opcion }));
}

describe('UsuariosView filtros al servidor', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('Creado, Último acceso, fechas y Producción llegan al servidor', async () => {
    const { ultima } = montar();
    await screen.findByText(/Lucia Prueba/);

    await elegir(/^Creado/, /Últimos 30 días/);
    await waitFor(() => expect(ultima().get('creado')).toBe('30'));
    await elegir(/^Último acceso/, /Nunca ingresó/);
    await waitFor(() => expect(ultima().get('acceso')).toBe('nunca'));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-31' } });
    await waitFor(() => {
      expect(ultima().get('desde')).toBe('2026-10-01');
      expect(ultima().get('hasta')).toBe('2026-10-31');
    });
    await elegir(/^Cargo/, /Producción/);
    await waitFor(() => expect(ultima().get('rol')).toBe('PRODUCCION'));
  });

  it('los contadores salen de los conteos reales del servidor', async () => {
    montar();
    await screen.findByText(/Lucia Prueba/);
    fireEvent.click(screen.getByRole('button', { name: /^Cargo/ }));
    const lista = await screen.findByRole('listbox');
    expect(within(lista).getByRole('option', { name: /Producción/ })).toHaveTextContent('5');
    expect(within(lista).getByRole('option', { name: /Todos/ })).toHaveTextContent('12');
    fireEvent.click(screen.getByRole('button', { name: /^Cargo/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Estado/ }));
    const est = await screen.findByRole('listbox');
    expect(within(est).getByRole('option', { name: /Inactivos/ })).toHaveTextContent('3');
  });

  it('descarta la respuesta tardía de una búsqueda anterior', async () => {
    let soltarVieja: (v: any) => void = () => {};
    const { get } = montar((url) => {
      if (url.includes('busqueda=ana+r')) return Promise.resolve(resp([U('9', 'Nueva')]));
      if (url.includes('busqueda=ana')) return new Promise((r) => (soltarVieja = r));
      return Promise.resolve(resp([U('2', 'Lucia')]));
    });
    await screen.findByText(/Lucia Prueba/);
    const q = screen.getByLabelText(/buscar por usuario/i);
    fireEvent.change(q, { target: { value: 'ana' } });
    await waitFor(() => expect(get.mock.calls.some((c) => String(c[0]).includes('busqueda=ana&') || String(c[0]).endsWith('busqueda=ana'))).toBe(true));
    fireEvent.change(q, { target: { value: 'ana r' } });
    await screen.findByText(/Nueva Prueba/);
    soltarVieja(resp([U('7', 'Vieja')]));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/Vieja Prueba/)).toBeNull();
    expect(screen.getByText(/Nueva Prueba/)).toBeInTheDocument();
  });

  it('avisa al admin cuando un usuario activo no tiene celular', async () => {
    montar(async () => resp([{ ...U('2', 'Lucia'), sinCelular: true }, U('3', 'Rosa')]));
    await screen.findByText(/Lucia Prueba/);
    expect(screen.getByTestId('sin-celular-2').textContent).toMatch(/Sin celular: no tendrá descuento de personal en la carta/);
    expect(screen.queryByTestId('sin-celular-3')).toBeNull();
  });
});
