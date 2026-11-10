import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { continuarYEnviar } from './continuarYEnviar';
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

const envios = () => vi.mocked(api.post).mock.calls.filter((c) => String(c[0]).endsWith('/extra'));

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
    continuarYEnviar();
    // Actualizada: el extra ya no usa «Sí, enviar comanda»; pide «¿Agregar este extra?» y envía con «Sí, agregar»
    expect(envios()).toHaveLength(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, agregar' }));

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

  async function llegarALaConfirmacion(alExito = vi.fn()) {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} canal="CAJA" extra={original} alExitoPedido={alExito} />);
    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Mario' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));
    const boleta = screen.queryByTestId('comprobante-BOLETA');
    if (boleta && boleta.getAttribute('aria-pressed') !== 'true') fireEvent.click(boleta);
    continuarYEnviar();
    return alExito;
  }

  it('el botón final abre «¿Agregar este extra?» con resumen y NO envía; foco inicial en «No, volver»', async () => {
    await llegarALaConfirmacion();
    const dlg = await screen.findByRole('dialog', { name: '¿Agregar este extra?' });
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(dlg).toHaveTextContent('CP-W045');
    expect(dlg).toHaveTextContent('Mesa 3');
    expect(dlg).toHaveTextContent('Lucía');
    expect(screen.getByTestId('extra-resumen')).toHaveTextContent('1× Café Americano');
    expect(screen.getByTestId('extra-resumen')).toHaveTextContent('S/ 8.50');
    expect(screen.getByRole('button', { name: 'No, volver' })).toHaveFocus();
    expect(envios()).toHaveLength(0);
  });

  it('«No, volver» y Escape cierran sin enviar y conservan el carrito', async () => {
    await llegarALaConfirmacion();
    fireEvent.click(await screen.findByRole('button', { name: 'No, volver' }));
    expect(screen.queryByRole('dialog', { name: '¿Agregar este extra?' })).toBeNull();
    continuarYEnviar();
    await screen.findByRole('dialog', { name: '¿Agregar este extra?' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '¿Agregar este extra?' })).toBeNull();
    expect(envios()).toHaveLength(0);
    expect(screen.getByRole('button', { name: /^Registrar extra/ })).toHaveTextContent('S/ 8.50');
  });

  it('doble clic en «Sí, agregar» envía una sola vez', async () => {
    await llegarALaConfirmacion();
    const si = await screen.findByRole('button', { name: 'Sí, agregar' });
    fireEvent.click(si);
    fireEvent.click(si);
    await waitFor(() => expect(envios().length).toBeGreaterThan(0));
    expect(envios()).toHaveLength(1);
  });

  it('si falla, el error se ve en la ventana con «Reintentar» y el carrito sigue', async () => {
    let fallo = true;
    vi.mocked(api.post).mockImplementation(async (ruta: any) => {
      if (String(ruta).endsWith('/extra') && fallo) {
        fallo = false;
        throw new Error('Sin conexión');
      }
      return { id: '46', codigo: 'CP-W046', total: 8.5 } as any;
    });
    const alExito = await llegarALaConfirmacion();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, agregar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(alExito).toHaveBeenCalled());
    expect(envios()).toHaveLength(2);
  });
});
