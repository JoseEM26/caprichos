import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuditoriaView } from '../AuditoriaView';
import * as sesionModulo from '../../../comun/sesion';
import * as apiModulo from '../../../comun/api';

const MODULOS = [
  { valor: 'caja', etiqueta: 'Caja', cantidad: 3 },
  { valor: 'pedidos', etiqueta: 'Pedidos', cantidad: 9 },
];

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
      if (url.startsWith('/admin/auditoria/opciones')) {
        const modulo = new URLSearchParams(url.split('?')[1] ?? '').get('modulo');
        if (modulo === 'caja') return { modulos: MODULOS, acciones: [{ valor: 'ABRIR_CAJA', cantidad: 4 }] };
        return { modulos: MODULOS, acciones: [{ valor: 'ANULAR', cantidad: 1 }, { valor: 'COBRAR', cantidad: 2 }] };
      }
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
    await waitFor(() => expect(ultima().get('motivo')).toBe('error'));
    await waitFor(() => expect(ubicacion).toContain('pedido=CP-W422'));
    expect(screen.getByText(/como máximo 31 días/i)).toBeInTheDocument();
  }, 15000);

  it('Módulo y Acción son selectores con los valores que existen; Este mes manda desde el día 1', async () => {
    dibujar();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/admin/auditoria/opciones'));
    await elegir(/^Módulo/, /^Pedidos/);
    await waitFor(() => expect(ultima().get('modulo')).toBe('pedidos'));
    await elegir(/^Acción/, /^Cobrar/);
    await waitFor(() => expect(ultima().get('accion')).toBe('COBRAR'));
    await elegir(/^Fecha/, /Este mes/);
    await waitFor(() => expect(ultima().get('desde')).toMatch(/^\d{4}-\d{2}-01$/));
  });

  it('Módulo muestra nombre y conteo; al elegir uno, Acción solo trae sus acciones y se reinicia', async () => {
    dibujar('/admin/historial?accion=ANULAR');
    await waitFor(() => expect(get).toHaveBeenCalledWith('/admin/auditoria/opciones'));
    fireEvent.click(screen.getByRole('button', { name: /^Módulo/ }));
    expect(within(await screen.findByRole('listbox')).getByRole('option', { name: /Caja/ })).toHaveTextContent('3');
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /^Caja/ }));
    await waitFor(() => expect(ultima().get('modulo')).toBe('caja'));
    expect(ultima().get('accion')).toBeNull();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/admin/auditoria/opciones?modulo=caja'));
    fireEvent.click(await screen.findByRole('button', { name: /^Acción/ }));
    const opcionesAccion = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(opcionesAccion.map((o) => o.textContent)).toEqual(expect.arrayContaining([expect.stringMatching(/Abrir caja/)]));
    expect(opcionesAccion.some((o) => /Cobrar/.test(o.textContent ?? ''))).toBe(false);
  });

  it('URL con modulo y accion: se leen y se mandan al servidor', async () => {
    dibujar('/admin/historial?modulo=caja&accion=ABRIR_CAJA');
    await waitFor(() => expect(listas().length).toBeGreaterThan(0));
    expect(ultima().get('modulo')).toBe('caja');
    expect(ultima().get('accion')).toBe('ABRIR_CAJA');
    await waitFor(() => expect(get).toHaveBeenCalledWith('/admin/auditoria/opciones?modulo=caja'));
  });

  it('módulo sin registros en el rango muestra el estado vacío del módulo', async () => {
    dibujar('/admin/historial?modulo=caja');
    expect(await screen.findByText('Sin acciones de este módulo en el rango')).toBeInTheDocument();
  });

  it('Persona se busca por nombre y manda su id', async () => {
    dibujar();
    await waitFor(() => expect(listas().length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText(/Persona que hizo/i), { target: { value: 'Ana' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Ana Paz' }));
    await waitFor(() => expect(ultima().get('partyId')).toBe('7'));
    expect(ubicacion).toContain('persona=7');
  });

  it('los atajos de catálogo fijan modulo=catalogo y la acción, y se guardan en la URL', async () => {
    dibujar();
    await waitFor(() => expect(get).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Desactivaron un producto' }));
    await waitFor(() => expect(ultima().get('accion')).toBe('OCULTAR_PRODUCTO'));
    expect(ultima().get('modulo')).toBe('catalogo');
    expect(ubicacion).toContain('accion=OCULTAR_PRODUCTO');
    expect(screen.getByRole('button', { name: 'Desactivaron un producto' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Activaron un producto' }));
    await waitFor(() => expect(ultima().get('accion')).toBe('MOSTRAR_PRODUCTO,DISPONIBILIZAR_PRODUCTO'));
    expect(screen.getByRole('button', { name: /^Acción: Activaron un producto/ })).toBeInTheDocument();
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
