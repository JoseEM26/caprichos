import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { instalarPointerEvent } from './PolyfillPointer';

vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), obtenerMesas: vi.fn(), liberarMesaManual: vi.fn() },
}));
vi.mock('../useSalonSocket', () => ({ useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: vi.fn() }) }));
instalarPointerEvent();

const mesa = { id: '5', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 4, x: 1, y: 1, ancho: 2, alto: 2, activo: true, estado: 'LIBRE', pedido: null };
const pisos = [{ id: '1', nombre: 'Piso 1', activo: true, mesas: [mesa] }];
const plano = [{ id: '1', nombre: 'Piso 1', activo: true, cuadriculaAncho: 20, cuadriculaAlto: 12, elementos: [mesa] }];

const tocar = (el: Element) => {
  fireEvent.pointerDown(el, { button: 0, clientX: 5, clientY: 5 });
  fireEvent.pointerUp(el, { button: 0, clientX: 5, clientY: 5 });
  fireEvent.click(el);
};

describe('mozo: la mesa elegida no se queda pegada al volver atrás', () => {
  beforeEach(() => {
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue({ categorias: [] } as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue(plano as any);
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos } as any);
  });

  it('tocar otra vez la misma mesa tras «Volver» sigue al pedido', async () => {
    render(<ModalNuevoPedidoMesa abierto alCerrar={vi.fn()} pisos={pisos as any} />);
    tocar(await screen.findByTestId('elemento-plano-5'));
    expect(await screen.findByPlaceholderText('Buscar producto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    tocar(await screen.findByTestId('elemento-plano-5'));
    expect(await screen.findByPlaceholderText('Buscar producto')).toBeInTheDocument();
  });
});
