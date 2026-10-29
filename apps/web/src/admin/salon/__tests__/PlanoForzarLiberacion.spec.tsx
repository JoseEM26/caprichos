import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { PlanoView } from '../PlanoView';
import { salonApi } from '../api';
import * as sesionModulo from '../../../comun/sesion';
import { instalarPointerEvent } from './PolyfillPointer';

vi.mock('../api', () => ({
  salonApi: {
    obtenerPlano: vi.fn(),
    obtenerMesas: vi.fn(),
    liberarMesaManual: vi.fn(),
  },
}));
vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: vi.fn() }),
}));

instalarPointerEvent();

const elementos = [
  { id: '5', pisoId: '1', tipo: 'MESA', nombre: 'Mesa 1', x: 1, y: 1, ancho: 2, alto: 2, numero: 1, asientos: 4, activo: true },
];
const pisos = [{ id: '1', nombre: 'Piso 1', activo: true, cuadriculaAncho: 20, cuadriculaAlto: 12, elementos }];

const mesaOcupada = {
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
  estado: 'OCUPADA',
  pedido: { id: '50', codigo: 'P-0050', mozo: 'Ana', total: 45, estado: 'COLA', lineas: [] },
};

function conPermisos(permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    tiene: (p: string) => permisos.includes(p),
    usuario: { partyId: '7', nombres: 'Prueba', rol: 'ADMIN' },
  } as any);
}

async function montarConMesaOcupada(permisos: string[]) {
  conPermisos(permisos);
  render(<PlanoView />);
  return screen.findByTestId('elemento-plano-5');
}

describe('Plano del local: forzar liberación con mantener presionada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (salonApi.obtenerPlano as any).mockResolvedValue(pisos);
    (salonApi.obtenerMesas as any).mockResolvedValue({ pisos: [{ id: '1', nombre: 'Piso 1', mesas: [mesaOcupada] }] });
    (salonApi.liberarMesaManual as any).mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('con mesas/liberar, mantener 3 s la mesa ocupada abre Forzar liberación con su pedido', async () => {
    const mesa = await montarConMesaOcupada(['plano/ver', 'mesas/liberar']);

    vi.useFakeTimers();
    fireEvent.pointerDown(mesa, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByRole('dialog', { name: /Forzar liberación de/ })).toBeNull();
    act(() => vi.advanceTimersByTime(1100));
    fireEvent.pointerUp(mesa);
    vi.useRealTimers();

    const dialogo = await screen.findByRole('dialog', { name: /Forzar liberación de Mesa 1/ });
    expect(dialogo.textContent).toContain('Pedido P-0050');
    expect(dialogo.textContent).toContain('Libera solo la mesa; el pedido no se anula ni se cobra.');
  });

  it('un toque normal no abre la ventana', async () => {
    const mesa = await montarConMesaOcupada(['plano/ver', 'mesas/liberar']);

    vi.useFakeTimers();
    fireEvent.pointerDown(mesa, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(800));
    fireEvent.pointerUp(mesa);
    act(() => vi.advanceTimersByTime(4000));
    vi.useRealTimers();

    expect(screen.queryByRole('dialog', { name: /Forzar liberación de/ })).toBeNull();
  });

  it('sin mesas/liberar no aparece la opcion aunque se mantenga presionada', async () => {
    const mesa = await montarConMesaOcupada(['plano/ver']);

    vi.useFakeTimers();
    fireEvent.pointerDown(mesa, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(4000));
    vi.useRealTimers();

    expect(screen.queryByRole('dialog', { name: /Forzar liberación de/ })).toBeNull();
  });

  it('confirma con motivo y llama a liberarMesaManual con forzar=true', async () => {
    const mesa = await montarConMesaOcupada(['plano/ver', 'mesas/liberar']);

    vi.useFakeTimers();
    fireEvent.pointerDown(mesa, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(3100));
    vi.useRealTimers();

    await screen.findByRole('dialog', { name: /Forzar liberación de Mesa 1/ });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Mesa trabada tras cobro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forzar liberación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, forzar liberación' }));

    await waitFor(() =>
      expect(salonApi.liberarMesaManual).toHaveBeenCalledWith('5', 'Mesa trabada tras cobro', true),
    );
  });
});
