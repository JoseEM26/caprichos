import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuditoriaView } from '../AuditoriaView';
import * as sesionModulo from '../../../comun/sesion';
import * as apiModulo from '../../../comun/api';

const respuesta = (pagina = 1) => ({
  total: 45,
  pagina,
  limite: 20,
  paginas: 3,
  datos: [],
  conteos: { categoria: { CAMBIO: 30, ACCESO: 10, LECTURA_SENSIBLE: 5 }, resultado: { OK: 40, RECHAZADO: 5 } },
});

describe('AuditoriaView filtros al servidor', () => {
  let get: ReturnType<typeof vi.fn>;
  const listas = () => get.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/admin/auditoria?'));
  const ultima = () => new URLSearchParams(listas().at(-1)!.split('?')[1]);
  const irPagina2 = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /página siguiente/i }));
    await waitFor(() => expect(ultima().get('pagina')).toBe('2'));
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: () => true } as any);
    get = vi.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/auditoria/opciones')) return { modulos: ['caja', 'pedidos'], acciones: ['ANULAR', 'COBRAR'] };
      if (url.startsWith('/admin/auditoria/personas')) return [{ id: '7', nombre: 'Ana Paz' }];
      return respuesta(Number(new URLSearchParams(url.split('?')[1]).get('pagina')));
    });
    vi.spyOn(apiModulo.api, 'get').mockImplementation(get as any);
  });

  let ubicacion = '';
  function Ubicacion() {
    ubicacion = useLocation().search;
    return null;
  }
  const dibujar = (inicial = '/admin/historial') =>
    render(
      <MemoryRouter initialEntries={[inicial]}>
        <AuditoriaView />
        <Ubicacion />
      </MemoryRouter>,
    );

  async function elegir(combo: RegExp, opcion: RegExp) {
    fireEvent.click(screen.getByRole('button', { name: combo }));
    fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: opcion }));
  }

  it('Tipo, Resultado y Fecha llegan al servidor y reinician la página; conteos reales', async () => {
    dibujar();
    await waitFor(() => expect(get).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole('button', { name: /^Tipo/ }));
    expect(within(await screen.findByRole('listbox')).getByRole('option', { name: /Cambios/ })).toHaveTextContent('30');
    fireEvent.click(screen.getByRole('button', { name: /^Tipo/ }));

    await irPagina2();
    await elegir(/^Tipo/, /Lecturas sensibles/);
    await waitFor(() => expect(ultima().get('categoria')).toBe('LECTURA_SENSIBLE'));
    expect(ultima().get('pagina')).toBe('1');

    await irPagina2();
    await elegir(/^Resultado/, /Rechazados/);
    await waitFor(() => expect(ultima().get('resultado')).toBe('RECHAZADO'));
    expect(ultima().get('pagina')).toBe('1');

    await irPagina2();
    await elegir(/^Fecha/, /Hoy/);
    await waitFor(() => expect(ultima().get('desde')).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    expect(ultima().get('desde')).toBe(ultima().get('hasta'));
    expect(ultima().get('pagina')).toBe('1');
  });

  it('Desde, Hasta y búsqueda (con debounce) llegan al servidor', async () => {
    const { container } = dibujar();
    await waitFor(() => expect(get).toHaveBeenCalled());
    const fechas = container.querySelectorAll('input[type="date"]');
    fireEvent.change(fechas[0], { target: { value: '2026-10-05' } });
    await waitFor(() => expect(ultima().get('desde')).toBe('2026-10-05'));
    fireEvent.change(fechas[1], { target: { value: '2026-10-06' } });
    await waitFor(() => expect(ultima().get('hasta')).toBe('2026-10-06'));
    fireEvent.change(screen.getByLabelText(/buscar en el historial/i), { target: { value: 'anular' } });
    await waitFor(() => expect(ultima().get('busqueda')).toBe('anular'));
    expect(ultima().get('pagina')).toBe('1');
  });

  it('Pedido, Producto y Motivo llegan al servidor, se reflejan en la URL y avisan del límite de 31 días', async () => {
    dibujar();
    await waitFor(() => expect(listas().length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText(/Pedido \(código/i), { target: { value: 'CP-W422' } });
    fireEvent.change(screen.getByLabelText(/Producto \(nombre/i), { target: { value: 'torta' } });
    fireEvent.change(screen.getByLabelText(/Texto del motivo/i), { target: { value: 'error' } });
    await waitFor(() => expect(ultima().get('pedido')).toBe('CP-W422'));
    expect(ultima().get('producto')).toBe('torta');
    expect(ultima().get('motivo')).toBe('error');
    await waitFor(() => expect(ubicacion).toContain('pedido=CP-W422'));
    expect(screen.getByText(/como máximo 31 días/i)).toBeInTheDocument();
  });

  it('Módulo y Acción son selectores con los valores que existen; Este mes manda desde el día 1', async () => {
    dibujar();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/admin/auditoria/opciones'));
    await elegir(/^Módulo/, /^pedidos/);
    await waitFor(() => expect(ultima().get('modulo')).toBe('pedidos'));
    await elegir(/^Acción/, /^COBRAR/);
    await waitFor(() => expect(ultima().get('accion')).toBe('COBRAR'));
    await elegir(/^Fecha/, /Este mes/);
    await waitFor(() => expect(ultima().get('desde')).toMatch(/^\d{4}-\d{2}-01$/));
  });

  it('Persona se busca por nombre y manda su id', async () => {
    dibujar();
    await waitFor(() => expect(listas().length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText(/Persona que hizo/i), { target: { value: 'Ana' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Ana Paz' }));
    await waitFor(() => expect(ultima().get('partyId')).toBe('7'));
    expect(ubicacion).toContain('persona=7');
  });

  it('Los filtros se leen de la URL y «Limpiar filtros» los quita', async () => {
    dibujar('/admin/historial?pedido=CP-A1&modulo=caja&accion=ANULAR&res=rechazados');
    await waitFor(() => expect(ultima().get('pedido')).toBe('CP-A1'));
    expect(ultima().get('modulo')).toBe('caja');
    expect(ultima().get('accion')).toBe('ANULAR');
    expect(ultima().get('resultado')).toBe('RECHAZADO');
    fireEvent.click(screen.getByRole('button', { name: /Limpiar filtros/i }));
    await waitFor(() => expect(ubicacion).toBe(''));
    await waitFor(() => expect(ultima().get('pedido')).toBeNull());
    expect(ultima().get('modulo')).toBeNull();
  });
});
