import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListaChats } from '../ListaChats';

const dias = { hoy: 47, ayer: 33, manana: 0, anteriores: 35, total: 82 };
const conteos = { todos: 82, atender: 3, bot: 82, atendidos: 7, sinVer: 0, faltanProcesar: 19 } as any;

function montar(extra: object = {}) {
  const props = {
    conteos, busqueda: '', onBuscar: vi.fn(), filtro: 'todos' as const, onFiltro: vi.fn(), pos: null, onPos: vi.fn(),
    soloBloqueados: false, onToggleSoloBloqueados: vi.fn(), cargando: false, chats: [], chatSeleccionadoId: null,
    onSeleccionar: vi.fn(), dia: 'hoy' as const, onDia: vi.fn(), dias, controles: <span>Salientes</span>, ...extra,
  };
  render(<ListaChats {...(props as any)} />);
  return props;
}

describe('cabecera compacta de la bandeja', () => {
  it('muestra buscador, pestañas en una fila y el panel de filtros cerrado por defecto', () => {
    montar();
    expect(screen.getByTestId('cabecera-compacta')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar un chat')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-filtros')).toBeNull();
    expect(screen.queryByTestId('badge-filtros')).toBeNull();
    expect(screen.getByTestId('boton-filtros')).toHaveAttribute('aria-expanded', 'false');
    const tabs = screen.getByTestId('pestanas');
    expect(within(tabs).getAllByRole('button')).toHaveLength(5);
    expect(tabs).toHaveClass('msg-tabs');
    expect(screen.getByRole('button', { name: /Por atender/ })).toHaveAttribute('data-pendiente', '1');
    // el aviso de días anteriores se ve sin abrir el panel
    expect(screen.getByTestId('aviso-anteriores')).toHaveTextContent('35 de días anteriores sin atender');
  });

  it('el panel contiene día, fecha, punto de venta y limpiar; Escape y clic fuera lo cierran', () => {
    montar();
    fireEvent.click(screen.getByTestId('boton-filtros'));
    const panel = screen.getByTestId('panel-filtros');
    expect(within(panel).getByRole('button', { name: 'Hoy: 47 chats' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Ayer: 33 chats' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Mañana: 0 chats' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Todos: 82 chats' })).toBeInTheDocument();
    expect(within(panel).getByLabelText('Elegir fecha')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Faltan procesar (19)' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Ya procesados' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('panel-filtros')).toBeNull();
    expect(screen.getByTestId('boton-filtros')).toHaveFocus();
    fireEvent.click(screen.getByTestId('boton-filtros'));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('panel-filtros')).toBeNull();
  });

  it('con filtros activos muestra el badge y chips que se quitan sin abrir el panel', () => {
    const p = montar({ dia: 'ayer', pos: 'faltan' });
    expect(screen.getByTestId('badge-filtros')).toHaveTextContent('2');
    const activos = screen.getByTestId('filtros-activos');
    fireEvent.click(within(activos).getByRole('button', { name: /Día: Ayer/ }));
    expect(p.onDia).toHaveBeenCalledWith('hoy');
    fireEvent.click(within(activos).getByRole('button', { name: /POS: faltan procesar/ }));
    expect(p.onPos).toHaveBeenCalledWith(null);
  });

  it('Limpiar filtros vuelve a Hoy y quita el punto de venta', () => {
    const p = montar({ dia: 'todos', pos: 'procesados' });
    fireEvent.click(screen.getByTestId('boton-filtros'));
    fireEvent.click(screen.getByTestId('limpiar-filtros'));
    expect(p.onDia).toHaveBeenCalledWith('hoy');
    expect(p.onPos).toHaveBeenCalledWith(null);
  });
});
