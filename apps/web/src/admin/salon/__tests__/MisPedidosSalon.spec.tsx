import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { MisPedidosView } from '../MisPedidosView';
import { salonApi } from '../api';
import * as sesionModulo from '../../../comun/sesion';
import { instalarPointerEvent } from './PolyfillPointer';

vi.mock('../api', () => ({
  salonApi: {
    misPedidos: vi.fn(),
    obtenerMesas: vi.fn(),
    obtenerPlano: vi.fn(),
    cambiarMesaPedido: vi.fn(),
    liberarMesaManual: vi.fn(),
  },
}));
vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
// El detalle de Nuevo pedido tiene su propia prueba; aquí importa qué mesa llega preseleccionada
vi.mock('../componentes/ModalNuevoPedidoMesa', () => ({
  ModalNuevoPedidoMesa: (props: { mesaPreseleccionadaId?: string }) =>
    props.mesaPreseleccionadaId ? `Nuevo pedido en mesa ${props.mesaPreseleccionadaId}` : null,
}));

instalarPointerEvent();

const mesaOcupada = {
  id: '5',
  pisoId: '1',
  tipo: 'MESA',
  numero: 1,
  nombre: null,
  asientos: 4,
  x: 1,
  y: 1,
  ancho: 2,
  alto: 2,
  activo: true,
  estado: 'OCUPADA',
  pedido: {
    id: '50',
    codigo: 'CP-0050',
    mozo: 'Ana',
    cliente: 'José',
    total: 45,
    estado: 'PREPARANDO',
    lineas: [{ cantidad: 2, nombre: 'Ceviche', detalle: '', opciones: ['Picante'] }],
  },
};

const mesaLibre = {
  id: '6',
  pisoId: '1',
  tipo: 'MESA',
  numero: 2,
  nombre: null,
  asientos: 4,
  x: 5,
  y: 1,
  ancho: 2,
  alto: 2,
  activo: true,
  estado: 'LIBRE',
  pedido: null,
};

const elementosDe = (mesas: any[]) =>
  mesas.map((m) => ({ id: m.id, pisoId: '1', tipo: 'MESA', nombre: null, x: m.x, y: m.y, ancho: m.ancho, alto: m.alto, numero: m.numero, asientos: 4, activo: true }));

const pisoSalon = (mesas: any[]) => [{ id: '1', nombre: 'Piso 1', activo: true, mesas }];

function conPermisos(permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    tiene: (p: string) => permisos.includes(p),
    usuario: { partyId: '7', nombres: 'Prueba', rol: 'MOZO' },
  } as any);
}

const pulsarMantener = (el: HTMLElement) => {
  fireEvent.pointerDown(el, { button: 0, clientX: 5, clientY: 5 });
  act(() => vi.advanceTimersByTime(2100));
  fireEvent.pointerUp(el);
};

describe('Mis pedidos: pestaña Salón (croquis)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    conPermisos(['mesas/ver', 'mesas/abrir', 'mesas/liberar', 'plano/ver']);
    vi.mocked(salonApi.misPedidos).mockResolvedValue({ pedidos: [], resumen: { cantidad: 0, total: 0, enCurso: 0, entregados: 0 } } as any);
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: pisoSalon([mesaOcupada, mesaLibre]) } as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([
      { id: '1', nombre: 'Piso 1', activo: true, cuadriculaAncho: 10, cuadriculaAlto: 10, elementos: elementosDe([mesaOcupada, mesaLibre]) },
    ] as any);
    vi.mocked(salonApi.cambiarMesaPedido).mockResolvedValue({ ok: true, mesa: 'Mesa 2' } as any);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('abre en Salón por defecto y recuerda la pestaña Lista elegida', async () => {
    const { unmount } = render(<MisPedidosView />);
    expect(screen.getByRole('tab', { name: 'Salón' }).getAttribute('aria-selected')).toBe('true');
    await screen.findByTestId('elemento-plano-5');

    fireEvent.click(screen.getByRole('tab', { name: 'Lista' }));
    expect(localStorage.getItem('caprichos.misPedidos.pestana')).toBe('lista');
    unmount();

    render(<MisPedidosView />);
    expect(screen.getByRole('tab', { name: 'Lista' }).getAttribute('aria-selected')).toBe('true');
  });

  it('la mesa ocupada muestra «Mesa 1 · José» (nombre del cliente)', async () => {
    render(<MisPedidosView />);
    const celda = await screen.findByTestId('elemento-plano-5');
    expect(celda.textContent).toContain('Mesa 1 · José');
  });

  it('mantener 2 s una mesa ocupada abre la vista previa con lo que pidió', async () => {
    render(<MisPedidosView />);
    const celda = await screen.findByTestId('elemento-plano-5');

    vi.useFakeTimers();
    pulsarMantener(celda);
    vi.useRealTimers();

    const vista = await screen.findByRole('dialog', { name: 'Vista previa de Mesa 1' });
    expect(vista.textContent).toContain('2 x Ceviche');
    expect(vista.textContent).toContain('Picante');
    expect(vista.textContent).toContain('S/ 45.00');
  });

  it('un toque en la mesa ocupada abre su cuenta (precuenta)', async () => {
    render(<MisPedidosView />);
    fireEvent.click(await screen.findByTestId('elemento-plano-5'));
    expect(await screen.findByRole('dialog', { name: 'Precuenta' })).toBeTruthy();
  });

  it('un toque en la mesa libre abre Nuevo pedido con esa mesa', async () => {
    render(<MisPedidosView />);
    fireEvent.click(await screen.findByTestId('elemento-plano-6'));
    expect(await screen.findByText('Nuevo pedido en mesa 6')).toBeTruthy();
  });

  it('cambiar de mesa: elegir la libre, Sí/No, y Sí llama a la API con el pedido y la mesa', async () => {
    render(<MisPedidosView />);
    const celda = await screen.findByTestId('elemento-plano-5');
    vi.useFakeTimers();
    pulsarMantener(celda);
    vi.useRealTimers();

    const vista = await screen.findByRole('dialog', { name: 'Vista previa de Mesa 1' });
    fireEvent.click(within(vista).getByRole('button', { name: 'Cambiar de mesa' }));

    expect(screen.getByRole('status').textContent).toContain('Elige una mesa libre para pasar el pedido de Mesa 1');
    fireEvent.click(screen.getByTestId('elemento-plano-6'));

    const confirmar = await screen.findByRole('dialog', { name: '¿Pasar el pedido de Mesa 1 a Mesa 2?' });
    fireEvent.click(within(confirmar).getByRole('button', { name: 'No, volver' }));
    expect(salonApi.cambiarMesaPedido).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('elemento-plano-6'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cambiar de mesa' }));

    await waitFor(() => expect(salonApi.cambiarMesaPedido).toHaveBeenCalledWith('50', '6'));
    expect(await screen.findByText('El pedido CP-0050 pasó a Mesa 2.')).toBeTruthy();
  });

  it('si la mesa destino se ocupó (409), muestra el mensaje del servidor', async () => {
    vi.mocked(salonApi.cambiarMesaPedido).mockRejectedValue(new Error('La mesa 2 ya está ocupada'));
    render(<MisPedidosView />);
    const celda = await screen.findByTestId('elemento-plano-5');
    vi.useFakeTimers();
    pulsarMantener(celda);
    vi.useRealTimers();

    const vista = await screen.findByRole('dialog', { name: 'Vista previa de Mesa 1' });
    fireEvent.click(within(vista).getByRole('button', { name: 'Cambiar de mesa' }));
    fireEvent.click(screen.getByTestId('elemento-plano-6'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cambiar de mesa' }));

    expect((await screen.findByRole('alert')).textContent).toContain('La mesa 2 ya está ocupada');
  });
});
