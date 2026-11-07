import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { api } from '../../../comun/api';
import { pedidosApi, type DatosEdicionPedido } from '../../pedidos/pedidosApi';

const manejadores = vi.hoisted(() => ({}) as Record<string, (d: any) => void>);

vi.mock('../../../comun/socket', () => ({
  useEventos: (evento: string, cb: (d: any) => void) => {
    manejadores[evento] = cb;
  },
}));
vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }),
}));
vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn() },
}));
vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
}));

const carta = {
  categorias: [
    {
      id: 'cat-1',
      nombre: 'Bebidas',
      orden: 1,
      productos: [
        { id: 'prod-1', nombre: 'Café Americano', descripcion: '', fotoUrl: null, precio: 8.5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null },
      ],
    },
  ],
};

const datos = (extra: Partial<DatosEdicionPedido> = {}): DatosEdicionPedido => ({
  id: '100',
  codigo: 'CP-W001',
  version: 3,
  estado: 'COLA',
  modalidad: 'RECOGER',
  canal: 'CAJA',
  cliente: { nombre: 'Ana', telefono: '987654321' },
  entrega: { direccion: null, referencia: null, lat: null, lng: null, origen: null, zona: null },
  subtotal: 17,
  descuento: 0,
  envio: 0,
  total: 17,
  propina: 0,
  tieneVoucher: false,
  editandoPor: null,
  lineas: [
    {
      lineaId: '10',
      productoId: 'prod-1',
      nombre: 'Café Americano',
      tamano: null,
      tamanoId: null,
      cantidad: 2,
      precioUnitario: 8.5,
      subtotal: 17,
      opciones: [],
      sabores: [],
      nota: null,
      personas: ['Mario'],
      ofertaId: null,
      bloqueada: false,
      partesCombo: [],
    },
  ],
  ...extra,
});

const abrir = (d = datos(), alCerrar = vi.fn(), alExitoPedido = vi.fn()) =>
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={alCerrar} pisos={[]} pasoInicial="modal" edicion={{ datos: d }} alExitoPedido={alExitoPedido} />);

describe('Editar pedido (modal en modo edición)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(api.get).mockResolvedValue({ items: [] } as any);
    vi.mocked(api.post).mockResolvedValue({ descuentoTotal: 0 } as any);
    vi.spyOn(pedidosApi, 'avisarEditando').mockResolvedValue(undefined);
  });

  it('abre con las líneas y los datos del pedido, sin cupón, plan de pago ni comprobante, y avisa que lo está editando', async () => {
    abrir();
    expect(screen.getByText('Editar pedido CP-W001')).toBeInTheDocument();
    expect(screen.getByText('2 x Café Americano')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del cliente')).toHaveValue('Ana');
    expect(screen.getByLabelText('Celular (opcional)')).toHaveValue('987654321');
    expect(screen.queryByRole('button', { name: 'Cupón' })).toBeNull();
    expect(screen.queryByText(/Enviar directo a cocina|Registrar pedido/)).toBeNull();
    expect(screen.getByTestId('resumen-edicion')).toHaveTextContent('Total antes: S/ 17.00');
    await waitFor(() => expect(pedidosApi.avisarEditando).toHaveBeenCalledWith('100', true));
  });

  it('quitar una línea baja el total nuevo y guardar pide confirmación y manda la versión y el id de la línea', async () => {
    const guardar = vi.spyOn(pedidosApi, 'guardarEdicion').mockResolvedValue({ id: '100', codigo: 'CP-W001', version: 4, estado: 'COLA', total: 17, totalAnterior: 17, cambios: [] });
    const alExito = vi.fn();
    const alCerrar = vi.fn();
    abrir(datos(), alCerrar, alExito);
    fireEvent.change(screen.getByLabelText('Nombre del cliente'), { target: { value: 'Ana Pérez' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    expect(guardar).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar cambios' }));

    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    const [id, payload] = guardar.mock.calls[0];
    expect(id).toBe('100');
    expect(payload.version).toBe(3);
    expect(payload.lineas[0]).toMatchObject({ lineaId: '10', productoId: 'prod-1', cantidad: 2 });
    expect(payload.cliente).toEqual({ nombre: 'Ana Pérez', telefono: '987654321' });
    expect(payload.modalidad).toBe('RECOGER');
    await waitFor(() => expect(alExito).toHaveBeenCalled());
    expect(alCerrar).toHaveBeenCalled();
  });

  it('sin productos no deja guardar y lo dice en español simple', async () => {
    const guardar = vi.spyOn(pedidosApi, 'guardarEdicion');
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    expect(await screen.findByText('El pedido debe tener al menos un producto.')).toBeInTheDocument();
    expect(guardar).not.toHaveBeenCalled();
  });

  it('conflicto 409 PEDIDO_MODIFICADO: avisa, conserva lo escrito y deja guardar encima con la versión nueva', async () => {
    const guardar = vi
      .spyOn(pedidosApi, 'guardarEdicion')
      .mockRejectedValueOnce(Object.assign(new Error('Alguien más cambió este pedido'), { codigo: 'PEDIDO_MODIFICADO' }))
      .mockResolvedValueOnce({ id: '100', codigo: 'CP-W001', version: 6, estado: 'COLA', total: 17, totalAnterior: 17, cambios: [] });
    const releer = vi.spyOn(pedidosApi, 'obtenerParaEditar').mockResolvedValue(datos({ version: 5 }));
    abrir();
    fireEvent.change(screen.getByLabelText('Nombre del cliente'), { target: { value: 'Ana Pérez' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar cambios' }));

    expect(await screen.findByText('Alguien más cambió este pedido mientras lo editabas.')).toBeInTheDocument();
    // lo escrito sigue ahí
    expect(screen.getByLabelText('Nombre del cliente')).toHaveValue('Ana Pérez');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar lo mío de todos modos' }));
    await waitFor(() => expect(releer).toHaveBeenCalledWith('100'));
    await waitFor(() => expect(screen.queryByText('Alguien más cambió este pedido mientras lo editabas.')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar cambios' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(2));
    expect(guardar.mock.calls[1][1].version).toBe(5);
    expect(guardar.mock.calls[1][1].cliente?.nombre).toBe('Ana Pérez');
  });

  it('«Ver la versión actual» recarga las líneas del servidor', async () => {
    vi.spyOn(pedidosApi, 'guardarEdicion').mockRejectedValue(Object.assign(new Error('x'), { codigo: 'PEDIDO_MODIFICADO' }));
    vi.spyOn(pedidosApi, 'obtenerParaEditar').mockResolvedValue(datos({ version: 5, cliente: { nombre: 'Otro', telefono: null } }));
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar cambios' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver la versión actual' }));
    await waitFor(() => expect(screen.getByLabelText('Nombre del cliente')).toHaveValue('Otro'));
  });

  it('si otra persona guarda el pedido mientras se edita, el aviso sale al instante', async () => {
    abrir();
    expect(screen.queryByText('Alguien más cambió este pedido mientras lo editabas.')).toBeNull();
    act(() => manejadores['pedido:editado']({ id: '100', version: 4 }));
    expect(await screen.findByText('Alguien más cambió este pedido mientras lo editabas.')).toBeInTheDocument();
  });

  it('muestra «Luis también está editando este pedido» cuando otro abre el editor', async () => {
    abrir();
    act(() => manejadores['pedido:editando']({ id: '100', activo: true, nombre: 'Luis' }));
    expect(await screen.findByText(/Luis también está editando este pedido/)).toBeInTheDocument();
    act(() => manejadores['pedido:editando']({ id: '100', activo: false }));
    await waitFor(() => expect(screen.queryByText(/Luis también está editando/)).toBeNull());
  });

  it('un combo solo se puede quitar: sin botón Cambiar ni pasos de cantidad', () => {
    const d = datos();
    d.lineas = [{ ...d.lineas[0], lineaId: '11', productoId: null, nombre: 'Dúo Dulce', ofertaId: '7', bloqueada: true, personas: [] }];
    abrir(d);
    expect(screen.getByText('Combo: para cambiarlo, quítalo y agrega otro.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cambiar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Quitar' })).toBeInTheDocument();
  });
});
