import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { instalarPointerEvent } from './PolyfillPointer';

// El socket se simula: la prueba dispara el evento salon:mesa a mano
const socket = vi.hoisted(() => ({ onMesaCambio: null as null | ((d: any) => void) }));

vi.mock('../api', () => ({
  salonApi: {
    obtenerCarta: vi.fn(),
    obtenerPlano: vi.fn(),
    obtenerMesas: vi.fn(),
    liberarMesaManual: vi.fn(),
  },
}));
vi.mock('../useSalonSocket', () => ({
  useSalonSocket: (opciones: { onMesaCambio?: (d: any) => void }) => {
    socket.onMesaCambio = opciones?.onMesaCambio ?? null;
    return { avisoListo: null, cerrarAvisoListo: vi.fn() };
  },
}));

instalarPointerEvent();

const elementos = [
  { id: '5', pisoId: '1', tipo: 'MESA', nombre: 'Mesa 1', x: 1, y: 1, ancho: 2, alto: 2, numero: 1, asientos: 4, activo: true },
];
const planoPisos = [{ id: '1', nombre: 'Piso 1', activo: true, cuadriculaAncho: 20, cuadriculaAlto: 12, elementos }];

const mesaBase = {
  id: '5',
  pisoId: '1',
  tipo: 'MESA',
  numero: 1,
  nombre: 'Mesa 1',
  asientos: 4,
  x: 1,
  y: 1,
  ancho: 2,
  alto: 2,
  activo: true,
};
const mesaOcupada = {
  ...mesaBase,
  estado: 'OCUPADA',
  pedido: { id: '50', codigo: 'P-0050', mozo: 'Ana', total: 45, estado: 'COLA', lineas: [] },
};
const mesaLibre = { ...mesaBase, estado: 'LIBRE', pedido: null };

const pisoCon = (mesa: unknown) => ({ id: '1', nombre: 'Piso 1', activo: true, mesas: [mesa] });

const textoMesa = () => screen.getByTestId('elemento-plano-5').textContent ?? '';

function montar(pisos: unknown[]) {
  return render(
    <ModalNuevoPedidoMesa
      abierto={true}
      alCerrar={vi.fn()}
      pisos={pisos as any}
      puedeForzarLiberacion={true}
    />,
  );
}

describe('ModalNuevoPedidoMesa: el plano de adentro se actualiza en tiempo real', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socket.onMesaCambio = null;
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue({ categorias: [] } as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue(planoPisos as any);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('al llegar salon:mesa LIBRE, la mesa ocupada pasa a libre sin depender de alRefrescarMesas', async () => {
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [pisoCon(mesaLibre)] } as any);
    montar([pisoCon(mesaOcupada)]);

    await screen.findByTestId('elemento-plano-5');
    expect(textoMesa()).toContain('ocupada');

    await act(async () => {
      socket.onMesaCambio?.({ mesaId: '5', estado: 'LIBRE' });
    });

    await waitFor(() => expect(textoMesa()).not.toContain('ocupada'));
    expect(salonApi.obtenerMesas).toHaveBeenCalled();
  });

  it('tras forzar la liberación con éxito, el modal refresca sus mesas aunque no le pasen alRefrescarMesas', async () => {
    vi.useFakeTimers();
    // El modal no pide mesas al abrir: la única llamada es la de tras forzar
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [pisoCon(mesaLibre)] } as any);
    vi.mocked(salonApi.liberarMesaManual).mockResolvedValue({ ok: true, mensaje: 'ok' } as any);
    montar([pisoCon(mesaOcupada)]);

    const mesa = screen.getByTestId('elemento-plano-5');
    fireEvent.pointerDown(mesa, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(3100));
    fireEvent.pointerUp(mesa);
    vi.useRealTimers();

    await screen.findByRole('dialog', { name: /Forzar liberación de Mesa 1/ });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Mesa trabada tras cobro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forzar liberación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, forzar liberación' }));

    await waitFor(() =>
      expect(salonApi.liberarMesaManual).toHaveBeenCalledWith('5', 'Mesa trabada tras cobro', true),
    );
    await waitFor(() => expect(textoMesa()).not.toContain('ocupada'));
  });
});
