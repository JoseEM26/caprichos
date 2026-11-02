import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ComandaTarjeta, SEGUNDOS_DESHACER } from '../ComandaTarjeta';
import { CocinaAdminView } from '../CocinaAdminView';
import type { Comanda, LineaComanda } from '../cocinaTipos';
import * as cocinaApi from '../cocinaApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

vi.mock('../audioAlerta', () => ({
  reproducirCampanaCocina: vi.fn(),
  estaSilenciado: vi.fn().mockReturnValue(false),
  setSilenciado: vi.fn(),
}));

const latte: LineaComanda = { id: '1', nombre: 'Latte', cantidad: 3, listas: 1, despachadas: 0 };

const comandaArea = (lineas: LineaComanda[], over: Partial<Comanda> = {}): Comanda => ({
  id: '7-1',
  pedidoId: '7',
  areaId: '1',
  areaNombre: 'Bebidas',
  ticket: 'CP-0007',
  codigo: 'CP-0007',
  canal: 'WEB',
  modalidad: 'LLEVAR',
  mesa: null,
  minutos: 3,
  color: 'VERDE',
  creado_en: new Date().toISOString(),
  lineas,
  areas: [{ areaId: '1', areaNombre: 'Bebidas', despejada: false, lineas }],
  ...over,
});

describe('ComandaTarjeta: casilla por unidad (vista de área)', () => {
  it('muestra «1 de 3» y cada toque suma una unidad', () => {
    const marcar = vi.fn();
    render(<ComandaTarjeta comanda={comandaArea([latte], { lineas: [latte] })} soloArea alMarcarUnidades={marcar} />);

    expect(screen.getByTestId('unidades-linea')).toHaveTextContent('1 de 3');
    const casilla = screen.getByRole('button', { name: /Latte: 1 de 3 listas/ });
    expect(casilla.style.minHeight).toBe('44px');
    fireEvent.click(casilla);
    expect(marcar).toHaveBeenCalledWith(latte, 2);
  });

  it('una línea completa vuelve a 0 con Deshacer visible, y Deshacer la restaura', () => {
    vi.useFakeTimers();
    const marcar = vi.fn();
    const completa: LineaComanda = { ...latte, listas: 3 };
    render(<ComandaTarjeta comanda={comandaArea([completa], { lineas: [completa] })} soloArea alMarcarUnidades={marcar} />);

    fireEvent.click(screen.getByRole('button', { name: /Latte: 3 de 3 listas/ }));
    expect(marcar).toHaveBeenLastCalledWith(completa, 0);
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(marcar).toHaveBeenLastCalledWith(completa, 3);
    vi.useRealTimers();
  });

  it('el Deshacer desaparece a los 5 segundos', () => {
    vi.useFakeTimers();
    const completa: LineaComanda = { ...latte, listas: 3 };
    render(
      <ComandaTarjeta
        comanda={comandaArea([completa], { lineas: [completa] })}
        soloArea
        alMarcarUnidades={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Latte: 3 de 3 listas/ }));
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime((SEGUNDOS_DESHACER + 1) * 1000);
    });
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
    vi.useRealTimers();
  });

  it('una línea completa se ve con check y texto atenuado', () => {
    const completa: LineaComanda = { ...latte, listas: 3 };
    render(<ComandaTarjeta comanda={comandaArea([completa], { lineas: [completa] })} soloArea alMarcarUnidades={vi.fn()} />);
    expect(screen.getByTestId('linea-1').style.opacity).toBe('0.6');
    expect(screen.getByTestId('linea-1')).toHaveAttribute('data-completa', 'true');
  });
});

describe('ComandaTarjeta: despachar en la vista Todas', () => {
  const lista: LineaComanda = { id: '1', nombre: 'Latte', cantidad: 2, listas: 2, despachadas: 0 };
  const otra: LineaComanda = { id: '2', nombre: 'Torta', cantidad: 1, listas: 1, despachadas: 1 };

  it('cada producto listo tiene Despachar, y el pedido tiene Despachar todo lo listo', () => {
    const despachar = vi.fn();
    const todo = vi.fn();
    const c = comandaArea([lista, otra], {
      areas: [{ areaId: '1', areaNombre: 'Bebidas', despejada: false, lineas: [lista, otra] }],
    });
    render(
      <ComandaTarjeta
        comanda={c}
        soloLectura
        mostrarArea
        puedeDespachar
        alDespacharLinea={despachar}
        alDespacharTodo={todo}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Despachar 2 de Latte' }));
    expect(despachar).toHaveBeenCalledWith(lista, 2);

    fireEvent.click(screen.getByRole('button', { name: 'Despachar todo lo listo' }));
    expect(todo).toHaveBeenCalledWith(c);
  });

  it('lo despachado completo se ve tachado y gris, sin botón', () => {
    const despachada: LineaComanda = { id: '2', nombre: 'Torta', cantidad: 1, listas: 1, despachadas: 1 };
    const c = comandaArea([despachada], { areas: [{ areaId: '1', areaNombre: 'Bebidas', despejada: false, lineas: [despachada] }] });
    render(<ComandaTarjeta comanda={c} soloLectura puedeDespachar alDespacharLinea={vi.fn()} alDespacharTodo={vi.fn()} />);

    const nombre = screen.getByText('Torta');
    expect(nombre.style.textDecoration).toBe('line-through');
    expect(screen.queryByRole('button', { name: /Despachar 1 de Torta/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Despachar todo lo listo' })).toBeNull();
  });

  it('en delivery no se despacha', () => {
    const c = comandaArea([lista], {
      modalidad: 'DELIVERY',
      areas: [{ areaId: '1', areaNombre: 'Bebidas', despejada: false, lineas: [lista] }],
    });
    render(<ComandaTarjeta comanda={c} soloLectura puedeDespachar alDespacharLinea={vi.fn()} alDespacharTodo={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Despachar/ })).toBeNull();
  });
});

describe('Vista Todas de cocina: despachar con Sí o No', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Mozo', rol: 'MOZO' },
      permisos: ['cocina/ver', 'cocina/despachar'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn((p: string) => p === 'cocina/ver' || p === 'cocina/despachar'),
    } as any);
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([{ id: '1', nombre: 'Bebidas', comandasPendientes: 1 }]);
    vi.spyOn(cocinaApi, 'obtenerAjustesCocina').mockResolvedValue({ confirmarDespejar: true });
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({ activa: false, minutos: 0, pausa: false });
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([
      comandaArea([latte], {
        lineas: [{ ...latte, listas: 3 }],
        areas: [{ areaId: '1', areaNombre: 'Bebidas', despejada: false, lineas: [{ ...latte, listas: 3 }] }],
      }),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderVista = () =>
    render(
      <BrowserRouter>
        <CocinaAdminView />
      </BrowserRouter>,
    );

  it('despachar todo pide Sí o No antes de llamar a la API', async () => {
    const despachar = vi.spyOn(cocinaApi, 'despacharPedido').mockResolvedValue({ completo: true, estado: 'ENTREGADO' });
    renderVista();
    await screen.findByText('Latte');
    fireEvent.click(await screen.findByRole('button', { name: /^Área: / }));
    fireEvent.click(screen.getByRole('option', { name: 'Todas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Despachar todo lo listo' }));
    expect(await screen.findByText(/Se despacha todo lo listo/)).toBeInTheDocument();
    expect(despachar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(despachar).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Despachar todo lo listo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, despachar' }));
    await waitFor(() => expect(despachar).toHaveBeenCalledWith('7', undefined));
  });

  it('despachar un producto pide Sí o No y manda solo sus unidades', async () => {
    const despachar = vi.spyOn(cocinaApi, 'despacharPedido').mockResolvedValue({ completo: false, estado: 'PREPARANDO' });
    renderVista();

    await screen.findByText('Latte');
    fireEvent.click(await screen.findByRole('button', { name: /^Área: / }));
    fireEvent.click(screen.getByRole('option', { name: 'Todas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Despachar 3 de Latte' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, despachar' }));
    await waitFor(() => expect(despachar).toHaveBeenCalledWith('7', [{ lineaId: '1', unidades: 3 }]));
  });
});
