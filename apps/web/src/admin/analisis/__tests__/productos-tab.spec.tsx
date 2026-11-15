import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ProductosTab } from '../productos/ProductosTab';
import { PESTANAS_ANALISIS } from '../registro';
import { api } from '../../../comun/api';

vi.mock('../../../comun/socket', () => ({ useTiempoReal: vi.fn(), useEventos: vi.fn() }));

const filtros = { preset: 'hoy' as const, desde: '2026-11-10', hasta: '2026-11-11', modalidad: '', canal: '', turno: '' };

const fila = (id: string, nombre: string, unidades: number, extra: Record<string, unknown> = {}) => ({
  id,
  nombre,
  categoria: 'Postres',
  unidades,
  monto: unidades * 10,
  porcentaje: unidades ? 50 : 0,
  pedidos: unidades ? 2 : 0,
  unidadesAnterior: 0,
  tendencia: null,
  marca: null,
  ...extra,
});

const datos = (extra: Record<string, unknown> = {}) => ({
  generadoEn: '2026-11-11T20:00:00Z',
  rango: { desde: '2026-11-10', hasta: '2026-11-11', dias: 2 },
  conDinero: true,
  productos: {
    total: 3,
    conVentas: 2,
    sinVentas: 1,
    unidades: 8,
    monto: 80,
    categorias: ['Bebidas', 'Postres'],
    filas: [fila('1', 'Torta', 5, { marca: 'TOP', tendencia: 25 }), fila('2', 'Café', 3, { categoria: 'Bebidas' }), fila('3', 'Té', 0, { marca: 'BAJO' })],
  },
  dias: {
    porSemana: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dia, i) => ({ dia, dias: i < 2 ? 1 : 0, pedidos: i < 2 ? 4 : 0, promedioPedidos: i < 2 ? 4 : null, monto: i < 2 ? 40 : null, promedioMonto: i < 2 ? 40 : null })),
    masVentas: [{ fecha: '2026-11-10', pedidos: 4, monto: 40 }],
    menosVentas: [{ fecha: '2026-11-11', pedidos: 2, monto: 20 }],
    diasConVentas: 2,
  },
  modificadores: {
    porProducto: [{ id: '2', nombre: 'Café', total: 4, opciones: [{ grupo: 'Leche', opcion: 'Almendra', veces: 3 }, { grupo: 'Tamaño', opcion: 'Grande', veces: 1 }] }],
    global: [{ grupo: 'Leche', opcion: 'Almendra', veces: 3 }],
  },
  margen: {
    grupos: { BAJO: 1, MEDIO: 0, ALTO: 1, SIN_COSTO: 1 },
    ponderado: { margen: 56.7, ingresos: 60, costo: 26, productos: 2 },
    filas: [
      { id: '2', nombre: 'Café', categoria: 'Bebidas', grupo: 'BAJO', margen: 10, precio: 10, costo: 9, unidades: 3, base: 'ventas', motivos: [] },
      { id: '1', nombre: 'Torta', categoria: 'Postres', grupo: 'ALTO', margen: 80, precio: 10, costo: 2, unidades: 5, base: 'ventas', motivos: [] },
      { id: '3', nombre: 'Flan', categoria: 'Postres', grupo: 'SIN_COSTO', margen: null, precio: 10, costo: null, unidades: 0, base: 'catalogo', motivos: ['Sin receta', 'Cacao sin costo'] },
    ],
  },
  ...extra,
});

let get: ReturnType<typeof vi.fn>;
beforeEach(() => {
  get = vi.spyOn(api, 'get').mockResolvedValue(datos() as never) as unknown as ReturnType<typeof vi.fn>;
});

describe('Pestaña Productos', () => {
  it('está registrada con los filtros de modalidad, canal y turno', () => {
    const p = PESTANAS_ANALISIS.find((x) => x.id === 'productos');
    expect(p?.etiqueta).toBe('Productos');
    expect(p?.filtros).toEqual(['modalidad', 'canal', 'turno']);
  });

  it('muestra cargando y luego todos los productos con sus marcas, incluso los de 0 ventas', async () => {
    render(<ProductosTab filtros={filtros} esAdmin />);
    expect(screen.getByText('Calculando los productos')).toBeInTheDocument();
    const tabla = await screen.findByRole('table');
    fireEvent.click(screen.getByLabelText(/Mostrar productos sin ventas \(1\)/));
    expect(get.mock.calls[0][0]).toContain('/admin/analisis/productos?desde=2026-11-10&hasta=2026-11-11');
    expect(within(tabla).getByText('Torta')).toBeInTheDocument();
    expect(within(tabla).getByText('Té')).toBeInTheDocument();
    expect(within(tabla).getByText('Top 20 %')).toBeInTheDocument();
    expect(within(tabla).getByText('Bajo 20 %')).toBeInTheDocument();
  });

  it('busca por nombre, filtra por categoría y cambia el orden', async () => {
    render(<ProductosTab filtros={filtros} esAdmin />);
    const tabla = await screen.findByRole('table');
    fireEvent.click(screen.getByLabelText(/Mostrar productos sin ventas/));
    fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: 'caf' } });
    expect(within(tabla).queryByText('Torta')).not.toBeInTheDocument();
    expect(within(tabla).getByText('Café')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Bebidas' } });
    expect(within(tabla).queryByText('Torta')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Menos vendidos primero' }));
    const filas = within(tabla).getAllByRole('row');
    expect(filas[1]).toHaveTextContent('Té');
  });

  it('días: barras por día de la semana y rankings de fechas', async () => {
    render(<ProductosTab filtros={filtros} esAdmin />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Días de venta' }));
    expect(screen.getByRole('list', { name: 'Venta promedio por día de la semana' })).toBeInTheDocument();
    expect(screen.getByText('Fechas con más ventas')).toBeInTheDocument();
    expect(screen.getByText('Fechas con menos ventas')).toBeInTheDocument();
  });

  it('opciones: ranking global y producto expandible', async () => {
    render(<ProductosTab filtros={filtros} esAdmin />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Opciones elegidas' }));
    expect(screen.getByRole('list', { name: 'Opciones más elegidas' })).toBeInTheDocument();
    const b = screen.getByRole('button', { name: /Café/ });
    expect(b).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Tamaño: Grande')).toBeInTheDocument();
  });

  it('margen: conteo por grupo, margen del período y explicación de lo que falta', async () => {
    render(<ProductosTab filtros={filtros} esAdmin />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Margen' }));
    expect(screen.getByText('56,7 %')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sin costo registrado (1)' })).toBeInTheDocument();
    expect(screen.getByText(/Falta: Sin receta; Cacao sin costo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Margen bajo (1)' }));
    expect(screen.queryByText('Torta')).not.toBeInTheDocument();
  });

  it('el supervisor no ve montos ni margen', async () => {
    get.mockResolvedValue(
      datos({
        conDinero: false,
        margen: null,
        productos: { ...datos().productos, monto: null, filas: datos().productos.filas.map((f) => ({ ...f, monto: null })) },
      }) as never,
    );
    render(<ProductosTab filtros={filtros} esAdmin={false} />);
    const tabla = await screen.findByRole('table');
    expect(within(tabla).queryByText('Monto')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Margen' }));
    expect(screen.getByText('Margen solo para el administrador')).toBeInTheDocument();
  });

  it('error con reintento', async () => {
    get.mockRejectedValueOnce(new Error('falló'));
    render(<ProductosTab filtros={filtros} esAdmin />);
    expect(await screen.findByText('No se pudieron calcular los productos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
  });

  it('catálogo vacío', async () => {
    get.mockResolvedValue(datos({ productos: { total: 0, conVentas: 0, sinVentas: 0, unidades: 0, monto: 0, categorias: [], filas: [] } }) as never);
    render(<ProductosTab filtros={filtros} esAdmin />);
    expect(await screen.findByText('No hay productos en el catálogo.')).toBeInTheDocument();
  });

  const muchos = (n: number) => Array.from({ length: n }, (_, i) => fila(String(i), `Prod ${String(i).padStart(2, '0')}`, n - i));

  it('oculta los de 0 ventas por defecto; el interruptor los muestra y cuentan para Bajo 20 %', async () => {
    render(<ProductosTab filtros={filtros} esAdmin />);
    const tabla = await screen.findByRole('table');
    expect(within(tabla).queryByText('Té')).not.toBeInTheDocument();
    // con 2 productos vendidos no hay marca Bajo (menos de 5)
    expect(within(tabla).queryByText('Bajo 20 %')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Mostrar productos sin ventas (1)'));
    expect(within(tabla).getByText('Té')).toBeInTheDocument();
    expect(within(tabla).getByText('Bajo 20 %')).toBeInTheDocument();
  });

  it('pagina de 10 en 10, cambia el tamaño y vuelve a la página 1 al buscar', async () => {
    get.mockResolvedValue(datos({ productos: { total: 70, conVentas: 70, sinVentas: 0, unidades: 100, monto: 1, categorias: ['Postres'], filas: muchos(70) } }) as never);
    render(<ProductosTab filtros={filtros} esAdmin />);
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getAllByRole('row')).toHaveLength(11);
    expect(screen.getByText('Mostrando 1–10 de 70')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente ›' }));
    expect(screen.getByText('Página 2 de 7')).toBeInTheDocument();
    expect(within(tabla).getByText('Prod 10')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filas'), { target: { value: '25' } });
    expect(screen.getByText('Mostrando 1–25 de 70')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente ›' }));
    fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: 'Prod' } });
    expect(screen.getByText('Mostrando 1–25 de 70')).toBeInTheDocument();
  });

  it('sin ventas en el periodo: estado vacío con Ver ayer y Ver últimos 7 días', async () => {
    const alCambiarPeriodo = vi.fn();
    get.mockResolvedValue(datos({ productos: { ...datos().productos, conVentas: 0, sinVentas: 3, unidades: 0, monto: 0 } }) as never);
    render(<ProductosTab filtros={filtros} esAdmin alCambiarPeriodo={alCambiarPeriodo} />);
    expect(await screen.findByText('Todavía no hay ventas en este periodo')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver ayer' }));
    expect(alCambiarPeriodo).toHaveBeenLastCalledWith('ayer');
    fireEvent.click(screen.getByRole('button', { name: 'Ver últimos 7 días' }));
    expect(alCambiarPeriodo).toHaveBeenLastCalledWith('7d');
  });
});
