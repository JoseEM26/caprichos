import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { api } from '../../../comun/api';
import { listarPersonalActivo } from '../../creditos/creditosApi';

vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }),
}));
vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), obtenerMesas: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn(),
}));

const carta = {
  categorias: [
    {
      id: 'cat-1',
      nombre: 'Bebidas',
      orden: 1,
      productos: [
        { id: 'prod-1', nombre: 'Café Americano', descripcion: 'Café', fotoUrl: null, precio: 8.5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null },
      ],
    },
  ],
};

const original = { id: '45', codigo: 'CP-W045', modalidad: 'MESA', mesa_nombre: 'Mesa 3', cliente_nombre: 'Lucía' };

describe('Modal de pedido en modo «extra»', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] } as any);
    vi.mocked(listarPersonalActivo).mockResolvedValue([]);
    vi.mocked(api.get).mockResolvedValue({ items: [] } as any);
    vi.mocked(api.post).mockResolvedValue({ id: '46', codigo: 'CP-W046', total: 8.5 } as any);
  });

  it('abre directo en productos con cliente y mesa bloqueados (sin elegir mesa ni cambiar datos)', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} canal="CAJA" extra={original} />);
    expect(await screen.findByText('Agregar extra a CP-W045')).toBeInTheDocument();
    expect(screen.getByTestId('extra-bloqueado')).toHaveTextContent('EXTRA de CP-W045');
    expect(screen.getByTestId('extra-bloqueado')).toHaveTextContent('Mesa 3');
    expect(screen.getByTestId('extra-bloqueado')).toHaveTextContent('Lucía');
    expect(screen.queryByText('Cambiar mesa')).toBeNull();
    expect(screen.queryByText('Cambiar datos')).toBeNull();
  });

  it('envía solo productos, pago y comprobante a /admin/pedidos/:id/extra, sin mesa ni cliente', async () => {
    const alExito = vi.fn();
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} canal="CAJA" extra={original} alExitoPedido={alExito} />);
    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Mario' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));
    const boleta = screen.queryByTestId('comprobante-BOLETA');
    if (boleta && boleta.getAttribute('aria-pressed') !== 'true') fireEvent.click(boleta);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar extra' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [ruta, cuerpo, opciones] = vi.mocked(api.post).mock.calls.at(-1) as any[];
    expect(ruta).toBe('/admin/pedidos/45/extra');
    expect(cuerpo.lineas).toHaveLength(1);
    expect(cuerpo.lineas[0]).toMatchObject({ productoId: 'prod-1', cantidad: 1 });
    expect(cuerpo.pago.metodo).toBeTruthy();
    expect(cuerpo).not.toHaveProperty('mesa');
    expect(cuerpo).not.toHaveProperty('cliente');
    expect(cuerpo).not.toHaveProperty('modalidad');
    expect(opciones.headers['Idempotency-Key']).toBeTruthy();
    expect(salonApi.abrirPedidoMesa).not.toHaveBeenCalled();
    await waitFor(() => expect(alExito).toHaveBeenCalled());
  });
});
