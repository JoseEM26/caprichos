import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }),
}));
vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));

const cartaConCafe = {
  categorias: [
    {
      id: 'cat-1',
      nombre: 'Bebidas',
      orden: 1,
      productos: [
        { id: 'prod-1', nombre: 'Café Americano', descripcion: 'Café tostado', fotoUrl: null, precio: 8.5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null },
        { id: 'prod-2', nombre: 'Té Negro', descripcion: 'Té', fotoUrl: null, precio: 6, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null },
      ],
    },
  ],
};

const pisoConMesa = [
  {
    id: '1',
    nombre: 'Piso 1',
    activo: true,
    mesas: [
      { id: 'm1', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 4, x: 2, y: 5, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' as const },
    ],
  },
];

/** Sesión con o sin permiso cortesias/dar, con el rol indicado */
function conSesion(rol: string, permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    tiene: (p: string) => permisos.includes(p),
    usuario: { rol },
  } as any);
}

/** Elige boleta en el selector obligatorio, si lo muestra */
const elegirBoleta = () => {
  const b = screen.queryByTestId('comprobante-BOLETA');
  if (b && b.getAttribute('aria-pressed') !== 'true') fireEvent.click(b);
};

/** Pedido de mesa con un café; al abrir la línea se ve la acción de cortesía */
async function pedirCafeEnMesa() {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisoConMesa as any} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />);
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Lucía' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
  fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Lucía Pérez' } });
  // Una segunda línea sin cortesía: el pedido cobra algo (solo cortesías no se envía)
  fireEvent.click(screen.getByText('Té Negro'));
  // Es de la categoría Bebidas: también pide el nombre del vaso
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Pedro' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
}

describe('Cortesía en un pedido de mesa (local)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaConCafe as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
  });

  it('CAJA ve «Dar como cortesía» en la línea de mesa y el envío lleva la cortesía sin código de supervisor', async () => {
    conSesion('CAJERO', ['cortesias/dar']);
    await pedirCafeEnMesa();

    fireEvent.click(screen.getAllByRole('button', { name: 'Dar como cortesía' })[0]);
    fireEvent.click(screen.getByLabelText('Reclamo del cliente'));
    fireEvent.click(screen.getByRole('button', { name: 'Dar cortesía' }));

    expect(screen.getByText(/Cortesía · vale S\/ 8\.50/)).toBeInTheDocument();
    elegirBoleta();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar directo a cocina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const [payload, , codigo] = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0] as unknown[] as [any, string, string | undefined];
    expect(payload.lineas[0].cortesia).toEqual({ motivo: 'RECLAMO_CLIENTE', nota: undefined });
    expect(codigo).toBeUndefined();
  });

  it('SUPERVISOR: «Dar cortesía» sale con el motivo, sin código, y el envío no lleva ninguna cabecera de código', async () => {
    conSesion('SUPERVISOR', ['cortesias/dar']);
    await pedirCafeEnMesa();

    fireEvent.click(screen.getAllByRole('button', { name: 'Dar como cortesía' })[0]);
    fireEvent.click(screen.getByLabelText('Reclamo del cliente'));
    expect(screen.queryByLabelText('Código del supervisor (6 dígitos)')).toBeNull();
    const confirmar = screen.getByRole('button', { name: 'Dar cortesía' });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);

    elegirBoleta();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar directo a cocina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    expect(vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0]).toHaveLength(2);
  });

  it('MOZO (sin cortesias/dar) no ve la acción en la mesa', async () => {
    conSesion('MOZO', []);
    await pedirCafeEnMesa();

    expect(screen.queryByRole('button', { name: 'Dar como cortesía' })).toBeNull();
  });
});
