import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EtiquetasPedido } from '../EtiquetasPedido';
import { PedidoDetalle } from '../PedidoDetalle';
import { Pedido } from '../pedidosApi';
import { impresionApi, EstadoEtiquetasPedido } from '../../impresion/impresionApi';
// PedidoDetalle usa useSesion (botón de rechazo del cobro del mozo): sin sesión en estas pruebas, sin permisos extra
vi.mock('../../../comun/sesion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/sesion')>()),
  useSesion: () => ({ tiene: () => false, usuario: null }),
}));


vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

vi.mock('../../impresion/impresionApi', () => ({
  impresionApi: {
    obtenerEtiquetasPedido: vi.fn(),
    reimprimirEtiqueta: vi.fn(),
    reimprimirTodas: vi.fn(),
    reimprimirEtiquetas: vi.fn(),
    reimprimirElegidas: vi.fn(),
  },
}));

const pedido = {
  id: 'ped-9',
  codigo: 'CP-9',
  canal: 'MOZO',
  modalidad: 'DELIVERY',
  mesa_nombre: '2',
  cliente_nombre: 'Rosa',
  estado: 'COLA',
  creado_en: '2026-10-25T21:59:00.000Z',
  subtotal: 40,
  descuento: 0,
  total: 40,
  lineas: [
    { id: 'l1', nombre: 'Frappe Oreo', tamano: '16 oz', cantidad: 1, precio_unit: 18, subtotal: 18, area: { id: 'a1', nombre: 'BARRA' } },
    { id: 'l2', nombre: 'Club Sandwich', cantidad: 1, precio_unit: 22, subtotal: 22, area: { id: 'a2', nombre: 'COCINA' } },
  ],
} as unknown as Pedido;

const estadoMixto: EstadoEtiquetasPedido = {
  pedidoId: 'ped-9',
  codigo: 'CP-9',
  etiquetas: [
    { clave: 'GENERAL', tipo: 'ETIQUETA_GENERAL', titulo: 'General del pedido', detalle: '', estado: 'IMPRESA', trabajoId: '1', intentos: 1, error: null, copia: false, en: '2026-10-25T21:59:00.000Z', impresoEn: '2026-10-25T22:00:00.000Z' },
    { clave: 'AREA:BARRA', tipo: 'ETIQUETA_AREA', titulo: 'Área BARRA', detalle: '', estado: 'EN_COLA', trabajoId: '2', intentos: 0, error: null, copia: false, en: '2026-10-25T22:01:00.000Z', impresoEn: null },
    { clave: 'AREA:COCINA', tipo: 'ETIQUETA_AREA', titulo: 'Área COCINA', detalle: '', estado: 'FALLIDA', trabajoId: '3', intentos: 5, error: 'Papel atascado', copia: false, en: '2026-10-25T22:01:00.000Z', impresoEn: null },
  ],
  resumen: { total: 3, impresas: 1, enCola: 1, fallidas: 1, vencidas: 0, sinTrabajo: 0 },
};

describe('Etiquetas: una tarjeta por sticker con estado real', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(impresionApi.obtenerEtiquetasPedido).mockResolvedValue(estadoMixto);
    vi.mocked(impresionApi.reimprimirEtiqueta).mockResolvedValue({ ok: true, mensaje: 'Se encoló 1 etiqueta', cantidad: 1 });
    vi.mocked(impresionApi.reimprimirTodas).mockResolvedValue({ ok: true, mensaje: 'Se encolaron 2 etiquetas', cantidad: 2 });
  });

  it('muestra el resumen y el estado de cada etiqueta (impresa con hora, en cola, fallida con el error)', async () => {
    render(<EtiquetasPedido pedido={pedido} />);

    expect(await screen.findByText('3 etiquetas: 1 impresas, 1 en cola, 1 fallidas')).toBeInTheDocument();
    const general = screen.getByRole('article', { name: 'Etiqueta General del pedido' });
    expect(within(general).getByText('Impresa')).toBeInTheDocument();
    expect(within(general).getByText(/Impresa a las/)).toBeInTheDocument();
    const barra = screen.getByRole('article', { name: 'Etiqueta Área BARRA' });
    expect(within(barra).getByText('En cola')).toBeInTheDocument();
    const cocina = screen.getByRole('article', { name: 'Etiqueta Área COCINA' });
    expect(within(cocina).getByText('Fallida')).toBeInTheDocument();
    expect(within(cocina).getByText('Papel atascado')).toBeInTheDocument();
  });

  it('reimprime solo esa etiqueta tras confirmar Sí, y no con No', async () => {
    render(<EtiquetasPedido pedido={pedido} />);
    const cocina = await screen.findByRole('article', { name: 'Etiqueta Área COCINA' });

    fireEvent.click(within(cocina).getByRole('button', { name: 'Reimprimir' }));
    fireEvent.click(screen.getByRole('button', { name: /No, cancelar/i }));
    expect(impresionApi.reimprimirEtiqueta).not.toHaveBeenCalled();

    fireEvent.click(within(cocina).getByRole('button', { name: 'Reimprimir' }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, reimprimir/i }));
    await waitFor(() =>
      expect(impresionApi.reimprimirEtiqueta).toHaveBeenCalledWith('ped-9', 'AREA:COCINA'),
    );
  });

  it('no permite reimprimir una etiqueta que ya está en cola', async () => {
    render(<EtiquetasPedido pedido={pedido} />);
    const barra = await screen.findByRole('article', { name: 'Etiqueta Área BARRA' });
    expect(within(barra).getByRole('button', { name: 'Reimprimir' })).toBeDisabled();
  });

  it('Reimprimir todas (3 stickers) deja elegir cuáles y manda solo los marcados', async () => {
    vi.mocked(impresionApi.reimprimirElegidas).mockResolvedValue({ ok: true, mensaje: 'Se encoló 1 etiqueta' });
    render(<EtiquetasPedido pedido={pedido} />);
    await screen.findByText('3 etiquetas: 1 impresas, 1 en cola, 1 fallidas');
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir todas' }));
    expect(screen.getByText('¿Cuáles reimprimes?')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('checkbox')[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir 1' }));
    await waitFor(() => expect(impresionApi.reimprimirElegidas).toHaveBeenCalledWith('ped-9', 'TODAS', ['AREA:COCINA']));
    expect(impresionApi.reimprimirTodas).not.toHaveBeenCalled();
  });

  it('si la consulta de estado falla, las etiquetas siguen visibles con su vista previa', async () => {
    vi.mocked(impresionApi.obtenerEtiquetasPedido).mockRejectedValue(new Error('Sin red'));
    render(<EtiquetasPedido pedido={pedido} />);

    expect(await screen.findByText('Sin red')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Etiqueta General del pedido' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Etiqueta Área BARRA' })).toBeInTheDocument();
  });
});

describe('Pestañas de Pedido visibles en cualquier estado', () => {
  beforeEach(() => {
    vi.mocked(impresionApi.obtenerEtiquetasPedido).mockResolvedValue({ ...estadoMixto, etiquetas: [] });
  });

  it.each(['ANULADO', 'RECHAZADO', 'COBRADO'])('la pestaña Etiquetas aparece con el pedido en %s', (estado) => {
    render(
      <MemoryRouter>
        <PedidoDetalle pedido={{ ...pedido, estado } as Pedido} alActualizar={() => {}} />
      </MemoryRouter>,
    );
    // Imprimir abre ticket, etiquetas y comprobante; las etiquetas se ven en cualquier estado
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir etiquetas y ticket' }));
    expect(screen.getByRole('tab', { name: 'Etiquetas' })).toBeInTheDocument();
  });
});

describe('Sticker general solo para llevar, recoger y delivery', () => {
  const sinGeneral = { ...estadoMixto, etiquetas: estadoMixto.etiquetas.filter((e) => e.clave !== 'GENERAL') };

  it('pedido en MESA: no ofrece ni reimprime la etiqueta general (la API tampoco la lista)', async () => {
    vi.mocked(impresionApi.obtenerEtiquetasPedido).mockResolvedValue({ ...sinGeneral, resumen: { ...estadoMixto.resumen, total: 2, impresas: 0 } });
    render(<EtiquetasPedido pedido={{ ...pedido, modalidad: 'MESA' } as Pedido} />);
    await screen.findByText('2 etiquetas: 0 impresas, 1 en cola, 1 fallidas');
    expect(screen.queryByRole('article', { name: 'Etiqueta General del pedido' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reimprimir la general/i })).toBeNull();
    expect(screen.getByTestId('sin-general')).toHaveTextContent('no lleva ninguna etiqueta');
  });

  it.each(['DELIVERY', 'RECOGER'])('pedido %s: sí muestra la general y su vista previa con el tamaño configurado', async (modalidad) => {
    vi.mocked(impresionApi.obtenerEtiquetasPedido).mockResolvedValue({
      ...estadoMixto,
      tamanos: { bebida: { anchoMm: 76, altoMm: 38 }, general: { anchoMm: 80, altoMm: 120 } },
    });
    render(<EtiquetasPedido pedido={{ ...pedido, modalidad } as Pedido} />);
    const general = await screen.findByRole('article', { name: 'Etiqueta General del pedido' });
    expect(within(general).getByRole('img')).toHaveAttribute('data-maqueta', '640x960');
    expect(screen.getByRole('button', { name: /Reimprimir la general/i })).toBeInTheDocument();
  });
});
