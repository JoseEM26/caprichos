import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TarjetaReparto } from '../TarjetaReparto';
import { esMiPedido } from '../esMiPedido';
import { repartosApi } from '../repartosApi';

vi.mock('../repartosApi', async (importOriginal) => {
  const real: any = await importOriginal();
  return {
    ...real,
    repartosApi: {
      ...real.repartosApi,
      tomarPedido: vi.fn().mockResolvedValue({}),
      salir: vi.fn().mockResolvedValue({}),
      llegue: vi.fn().mockResolvedValue({}),
      entregar: vi.fn().mockResolvedValue({}),
      consultarMensajes: vi.fn().mockResolvedValue([]),
    },
  };
});

const pedidoBase = (extra: Record<string, unknown> = {}) =>
  ({
    id: '501',
    codigo: 'CP-0501',
    modalidad: 'DELIVERY',
    estado: 'LISTO',
    cliente_nombre: 'Lucía',
    cliente_telefono: '987654321',
    direccion: 'Av. Siempre Viva 742',
    referencia: null,
    lat: -12.05,
    lng: -77.04,
    zona: null,
    zona_id: null,
    minutosEspera: 5,
    color: 'verde',
    total: 45,
    pago_estado: 'PAGADO',
    pago_metodo: 'YAPE',
    cobro_pendiente_efectivo: false,
    paga_con: null,
    repartidor_party_id: '900',
    tomado_en: null,
    salio_en: null,
    llego_en: null,
    entregado_en: null,
    motivo_falla: null,
    creado_en: new Date().toISOString(),
    ...extra,
  }) as any;

describe('Administrador con un pedido asignado a sí mismo (panel de Repartos)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('esMiPedido compara como texto (la API da string, el socket puede dar número)', () => {
    expect(esMiPedido({ repartidor_party_id: '900' }, 900 as any)).toBe(true);
    expect(esMiPedido({ repartidor_party_id: '900' }, '900')).toBe(true);
    expect(esMiPedido({ repartidor_party_id: '901' }, '900')).toBe(false);
    expect(esMiPedido({ repartidor_party_id: null }, '900')).toBe(false);
  });

  it('LISTO asignado al admin: muestra "Salir a reparto" y "Reportar problema"', () => {
    render(<TarjetaReparto pedido={pedidoBase()} esMio alActualizar={() => {}} />);

    expect(screen.getByTestId('btn-salir-501')).toHaveTextContent('Salir a reparto');
    expect(screen.getByTestId('btn-reportar-501')).toHaveTextContent('Reportar problema');
  });

  it('EN_CAMINO asignado al admin: muestra "Llegué a destino" y "Reportar problema"', () => {
    render(<TarjetaReparto pedido={pedidoBase({ estado: 'EN_CAMINO', salio_en: new Date().toISOString() })} esMio alActualizar={() => {}} />);

    expect(screen.getByTestId('btn-llegue-501')).toHaveTextContent('Llegué a destino');
    expect(screen.queryByTestId('btn-entregar-501')).toBeNull();
  });

  it('EN_CAMINO ya llegado: muestra "Entregar pedido" y "Reportar problema"', () => {
    render(<TarjetaReparto pedido={pedidoBase({ estado: 'EN_CAMINO', salio_en: new Date().toISOString(), llego_en: new Date().toISOString() })} esMio alActualizar={() => {}} />);

    expect(screen.queryByTestId('btn-llegue-501')).toBeNull();
    expect(screen.getByTestId('btn-entregar-501')).toHaveTextContent('Entregar pedido');
    expect(screen.getByTestId('btn-reportar-501')).toBeInTheDocument();
  });

  it('pedido de otro repartidor (no esMio): no muestra las acciones del repartidor', () => {
    render(<TarjetaReparto pedido={pedidoBase({ estado: 'EN_CAMINO', repartidor_party_id: '777' })} alActualizar={() => {}} />);

    expect(screen.queryByTestId('btn-salir-501')).toBeNull();
    expect(screen.queryByTestId('btn-llegue-501')).toBeNull();
    expect(screen.queryByTestId('btn-entregar-501')).toBeNull();
  });

  it('Salir a reparto pide confirmación Sí/No antes de llamar a la API', async () => {
    const alActualizar = vi.fn();
    render(<TarjetaReparto pedido={pedidoBase()} esMio alActualizar={alActualizar} />);

    fireEvent.click(screen.getByTestId('btn-salir-501'));

    expect(screen.getByText('¿Marcar salida con el pedido?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, cancelar' })).toBeInTheDocument();
    expect(repartosApi.salir).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));

    await waitFor(() => expect(repartosApi.salir).toHaveBeenCalledWith('501'));
    await waitFor(() => expect(alActualizar).toHaveBeenCalled());
  });

  it('Tomar pedido pide "¿Seguro que quieres tomar este pedido?" con Sí/No; No no toma el pedido', async () => {
    render(<TarjetaReparto pedido={pedidoBase({ estado: 'LISTO', repartidor_party_id: null })} esDisponible puedeTomar alActualizar={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tomar como repartidor' }));

    expect(screen.getByText('¿Seguro que quieres tomar este pedido?')).toBeInTheDocument();
    expect(screen.getByText(/Quedará asignado a ti/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'No, cancelar' }));
    await waitFor(() => expect(screen.queryByText('¿Seguro que quieres tomar este pedido?')).toBeNull());
    expect(repartosApi.tomarPedido).not.toHaveBeenCalled();
  });

  it('Tomar pedido con Sí/Confirmar llama a la API con el id del pedido', async () => {
    render(<TarjetaReparto pedido={pedidoBase({ estado: 'LISTO', repartidor_party_id: null })} esDisponible puedeTomar alActualizar={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tomar como repartidor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));

    await waitFor(() => expect(repartosApi.tomarPedido).toHaveBeenCalledWith('501'));
  });
});

describe('Pantalla del repartidor: avisos de espera y retiro', () => {
  it('muestra la alerta de espera agotada y los avisos de movilidad retirada', async () => {
    const { BannerAvisosRepartidor } = await import('../RepartidorView');
    render(
      <BannerAvisosRepartidor
        pedidos={[pedidoBase({ codigo: 'CP-0777', espera_agotada: true, espera_min: 12 })]}
        avisos={[{ pedido_id: '9', codigo: 'CP-0009', mensaje: 'Se retiró la movilidad del pedido CP-0009 por espera agotada.', en: new Date().toISOString() }]}
      />,
    );

    expect(screen.getByText(/Espera agotada en CP-0777/)).toBeInTheDocument();
    expect(screen.getByText(/Se retiró la movilidad del pedido CP-0009/)).toBeInTheDocument();
  });

  it('sin esperas ni retiros no muestra nada', async () => {
    const { BannerAvisosRepartidor } = await import('../RepartidorView');
    const { container } = render(<BannerAvisosRepartidor pedidos={[pedidoBase()]} avisos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
