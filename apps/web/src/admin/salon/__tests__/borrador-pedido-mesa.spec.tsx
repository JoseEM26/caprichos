import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';

vi.mock('../api', () => ({
  salonApi: {
    obtenerCarta: vi.fn(),
    obtenerPlano: vi.fn(),
    obtenerMesas: vi.fn(),
    abrirPedidoMesa: vi.fn(),
    borradorDeMesa: vi.fn(),
    guardarBorradorMesa: vi.fn(),
    eliminarBorradorMesa: vi.fn(),
  },
}));
vi.mock('../../../comun/socket', () => ({ useEventos: () => undefined }));
vi.mock('../useSalonSocket', () => ({ useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }) }));

const carta = {
  categorias: [
    {
      id: 'cat-1',
      nombre: 'Bebidas',
      orden: 1,
      productos: [
        { id: 'prod-1', nombre: 'Café Americano', descripcion: 'Café', fotoUrl: null, precio: 40, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null },
      ],
    },
  ],
};
const mesaLibre = { id: 'm1', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 4, x: 2, y: 5, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' as const };
const pisos = [{ id: '1', nombre: 'Piso 1', activo: true, mesas: [mesaLibre] }] as any;

const borrador = {
  mesaId: 'm1',
  mesaNombre: 'Mesa 1',
  partyId: '9',
  mozo: 'Ana Ruiz',
  productos: 1,
  creadoEn: new Date().toISOString(),
  actualizadoEn: new Date(Date.now() - 10 * 60000).toISOString(),
  contenido: {
    lineas: [{ id: 'l1', productoId: 'prod-1', nombre: 'Café Americano', cantidad: 1, precioUnitario: 40, precioTotal: 40, opciones: [] }],
    cliNombre: 'Lucía',
    fase: 'pedido',
  },
};

async function conCafe(alCerrar = vi.fn()) {
  render(<ModalNuevoPedidoMesa abierto alCerrar={alCerrar} pisos={pisos} mesasPreseleccionadasIds={['m1']} canal="MOZO" />);
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
  fireEvent.click(await screen.findByText('Agregar al pedido'));
  return alCerrar;
}

describe('borrador del pedido de mesa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos } as any);
    vi.mocked(salonApi.borradorDeMesa).mockResolvedValue(null);
    vi.mocked(salonApi.guardarBorradorMesa).mockResolvedValue(borrador as any);
    vi.mocked(salonApi.eliminarBorradorMesa).mockResolvedValue(undefined as any);
  });

  it('sin productos ni cliente, cerrar no pregunta', async () => {
    const alCerrar = vi.fn();
    render(<ModalNuevoPedidoMesa abierto alCerrar={alCerrar} pisos={pisos} mesasPreseleccionadasIds={['m1']} canal="MOZO" />);
    await screen.findByText('Café Americano');
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(alCerrar).toHaveBeenCalled();
    expect(screen.queryByText('¿Salir del pedido?')).not.toBeInTheDocument();
  });

  it('con productos, cerrar pregunta; «Seguir» no cierra y «Salir sin guardar» sí', async () => {
    const alCerrar = await conCafe();
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(await screen.findByText('¿Salir del pedido?')).toBeInTheDocument();
    expect(alCerrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir con el pedido' }));
    expect(screen.queryByText('¿Salir del pedido?')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Salir sin guardar' }));
    expect(alCerrar).toHaveBeenCalledTimes(1);
    expect(salonApi.guardarBorradorMesa).not.toHaveBeenCalled();
  });

  it('el clic en el fondo oscuro también pregunta', async () => {
    const alCerrar = await conCafe();
    const fondo = document.querySelector('.salon-overlay > div') as HTMLElement;
    fireEvent.click(fondo);
    expect(await screen.findByText('¿Salir del pedido?')).toBeInTheDocument();
    expect(alCerrar).not.toHaveBeenCalled();
  });

  it('«Guardar como borrador» lo manda al servidor y cierra', async () => {
    const alCerrar = await conCafe();
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar como borrador' }));
    await waitFor(() => expect(alCerrar).toHaveBeenCalled());
    const [mesaId, contenido, productos] = vi.mocked(salonApi.guardarBorradorMesa).mock.calls[0];
    expect(mesaId).toBe('m1');
    expect(productos).toBe(1);
    expect((contenido as any).lineas[0].nombre).toBe('Café Americano');
  });

  it('si la mesa ya tenía borrador, pregunta si lo reemplaza', async () => {
    vi.mocked(salonApi.borradorDeMesa).mockResolvedValue(borrador as any);
    // la mesa ya tiene borrador: el aviso de continuar sale primero; se elimina para armar uno nuevo
    render(<ModalNuevoPedidoMesa abierto alCerrar={vi.fn()} pisos={pisos} mesasPreseleccionadasIds={['m1']} canal="MOZO" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Empezar de cero (borra el borrador)' }));
    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
  fireEvent.click(await screen.findByText('Agregar al pedido'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar como borrador' }));
    expect(await screen.findByText('Ya tienes un borrador de esta mesa')).toBeInTheDocument();
    expect(salonApi.guardarBorradorMesa).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar' }));
    await waitFor(() => expect(salonApi.guardarBorradorMesa).toHaveBeenCalled());
  });

  it('al abrir una mesa con borrador, «Continuar» restaura los productos', async () => {
    vi.mocked(salonApi.borradorDeMesa).mockResolvedValue(borrador as any);
    render(<ModalNuevoPedidoMesa abierto alCerrar={vi.fn()} pisos={pisos} mesasPreseleccionadasIds={['m1']} canal="MOZO" />);
    expect(await screen.findByText(/Lo dejaste con 1 producto, hace 10 min/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar mi borrador' }));
    expect(await screen.findAllByText(/Café Americano/)).not.toHaveLength(0);
    expect(screen.queryByText(/Tienes un borrador de/)).not.toBeInTheDocument();
  });

  it('si la mesa del borrador ya está ocupada, avisa y pide otra libre sin perder los productos', async () => {
    const ocupada = [{ ...pisos[0], mesas: [{ ...mesaLibre, estado: 'OCUPADA' }] }];
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: ocupada } as any);
    render(<ModalNuevoPedidoMesa abierto alCerrar={vi.fn()} pisos={pisos} canal="MOZO" borradorInicial={borrador as any} mesaPreseleccionadaId="m1" />);
    expect(await screen.findByText(/Mesa 1 ya está ocupada\. Elige otra mesa libre/)).toBeInTheDocument();
  });
});
