import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
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

describe('Plano del local: mantener 2 s una mesa ocupada abre la vista previa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (salonApi.obtenerPlano as any).mockResolvedValue(pisos);
    (salonApi.obtenerMesas as any).mockResolvedValue({ pisos: [{ id: '1', nombre: 'Piso 1', mesas: [mesaOcupada] }] });
    (salonApi.liberarMesaManual as any).mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('con mesas/liberar, mantener 2 s la mesa ocupada abre la vista previa con su pedido y Liberar mesa', async () => {
    const mesa = await montarConMesaOcupada(['plano/ver', 'mesas/liberar']);

    vi.useFakeTimers();
    fireEvent.pointerDown(mesa, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.queryByRole('dialog', { name: /Vista previa de/ })).toBeNull();
    act(() => vi.advanceTimersByTime(700));
    fireEvent.pointerUp(mesa);
    vi.useRealTimers();

    const vista = await screen.findByRole('dialog', { name: 'Vista previa de Mesa 1' });
    expect(vista.textContent).toContain('Pedido P-0050');
    expect(within(vista).getByRole('button', { name: 'Liberar mesa' })).toBeTruthy();
    expect(within(vista).getByRole('button', { name: 'Cambiar de mesa' })).toBeTruthy();
    expect(within(vista).getByRole('button', { name: 'Ver cuenta y cobrar' })).toBeTruthy();
  });

  it('un toque normal no abre la vista previa', async () => {
    const mesa = await montarConMesaOcupada(['plano/ver', 'mesas/liberar']);

    vi.useFakeTimers();
    fireEvent.pointerDown(mesa, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(800));
    fireEvent.pointerUp(mesa);
    act(() => vi.advanceTimersByTime(4000));
    vi.useRealTimers();

    expect(screen.queryByRole('dialog', { name: /Vista previa de/ })).toBeNull();
  });

  it('sin mesas/liberar la vista previa abre, pero no ofrece Liberar mesa', async () => {
    const mesa = await montarConMesaOcupada(['plano/ver']);

    vi.useFakeTimers();
    fireEvent.pointerDown(mesa, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(2100));
    fireEvent.pointerUp(mesa);
    vi.useRealTimers();

    const vista = await screen.findByRole('dialog', { name: 'Vista previa de Mesa 1' });
    expect(within(vista).queryByRole('button', { name: 'Liberar mesa' })).toBeNull();
  });

  it('desde la vista previa: Liberar mesa pide solo confirmación Sí/No, sin motivo, y llama a liberarMesaManual con forzar=true', async () => {
    const mesa = await montarConMesaOcupada(['plano/ver', 'mesas/liberar']);

    vi.useFakeTimers();
    fireEvent.pointerDown(mesa, { button: 0, clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(2100));
    fireEvent.pointerUp(mesa);
    vi.useRealTimers();

    const vista = await screen.findByRole('dialog', { name: 'Vista previa de Mesa 1' });
    fireEvent.click(within(vista).getByRole('button', { name: 'Liberar mesa' }));

    const modal = await screen.findByRole('dialog', { name: /Liberar Mesa 1/ });
    expect(modal.textContent).toContain('Pedido P-0050');
    expect(modal.textContent).toContain('Libera solo la mesa; el pedido no se anula ni se cobra.');
    fireEvent.click(within(modal).getByRole('button', { name: 'Liberar mesa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, liberar mesa' }));

    await waitFor(() =>
      expect(salonApi.liberarMesaManual).toHaveBeenCalledWith('5', undefined, true),
    );
  });
});
