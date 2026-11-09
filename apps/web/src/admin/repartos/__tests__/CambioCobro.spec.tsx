import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BotonCambiarFormaPago } from '../CambioCobroRepartidor';
import { PanelCambioCobro, InsigniaCambioCobro, useCambiosCobroPendientes } from '../../pedidos/PanelCambioCobro';
import { cambioCobroApi, type SolicitudPendienteCaja, type SolicitudCambioCobro } from '../cambioCobroApi';
import * as socketModulo from '../../../comun/socket';

vi.mock('../../pedidos/SeccionVouchersPedido', () => ({
  SeccionVouchersPedido: ({ pedidoId }: { pedidoId: string }) => <div data-testid="vouchers-del-pedido">vouchers {pedidoId}</div>,
}));

const foto = () => new File(['x'], 'captura.jpg', { type: 'image/jpeg' });

const solicitud = (extra: Partial<SolicitudCambioCobro> = {}): SolicitudCambioCobro => ({
  id: '3', pedidoId: '7', estado: 'PENDIENTE', planOriginal: [{ medio: 'EFECTIVO', monto: 40 }], planSolicitado: [{ medio: 'YAPE', monto: 40 }],
  pagaCon: null, voucherIds: ['9'], motivo: null, solicitadoPor: 'Luis Ruiz', solicitadoEn: '2027-01-04T15:00:00Z', resueltoPor: null, resueltoEn: null, ...extra,
});

describe('Formulario «Cambiar forma de pago» del repartidor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
  });

  const montar = (extra: Partial<Parameters<typeof BotonCambiarFormaPago>[0]> = {}) => {
    const alEnviado = vi.fn();
    render(<BotonCambiarFormaPago pedidoId="7" codigo="CP-7" estado="EN_CAMINO" totalCobrable={40} medioActual="EFECTIVO" solicitud={null} alEnviado={alEnviado} {...extra} />);
    return { alEnviado };
  };

  it('solo aparece en camino o en la puerta', () => {
    montar({ estado: 'LISTO' });
    expect(screen.queryByTestId('btn-cambiar-pago')).toBeNull();
  });

  // ANTES: la captura era obligatoria y el envío quedaba PENDIENTE de Caja; ahora es opcional y el cambio se aplica al instante
  it('con parte digital la captura es opcional: se puede cambiar sin foto y con foto se envía', async () => {
    const solicitar = vi.spyOn(cambioCobroApi, 'solicitar').mockResolvedValue(solicitud());
    const { alEnviado } = montar();
    fireEvent.click(screen.getByTestId('btn-cambiar-pago'));
    // el formulario propone Yape por el total (el medio actual es efectivo)
    expect(screen.getByTestId('captura-YAPE')).toHaveTextContent('opcional');
    expect(screen.getByTestId('enviar-cambio-pago')).toBeEnabled();

    // se puede elegir de la galería o de la cámara
    const archivo = foto();
    fireEvent.change(screen.getByLabelText('Galería de Yape'), { target: { files: [archivo] } });
    expect(screen.getByTestId('captura-YAPE')).toHaveTextContent('Lista: captura.jpg');
    expect(screen.getByTestId('enviar-cambio-pago')).toBeEnabled();

    fireEvent.click(screen.getByTestId('enviar-cambio-pago'));
    await waitFor(() => expect(solicitar).toHaveBeenCalled());
    expect(solicitar).toHaveBeenCalledWith('7', { plan: [{ medio: 'YAPE', monto: 40 }], pagaCon: null, capturas: { YAPE: archivo } });
    await waitFor(() => expect(alEnviado).toHaveBeenCalledWith(expect.objectContaining({ estado: 'PENDIENTE' })));
  });

  it('efectivo → tarjeta no pide captura', async () => {
    const solicitar = vi.spyOn(cambioCobroApi, 'solicitar').mockResolvedValue(solicitud());
    montar();
    fireEvent.click(screen.getByTestId('btn-cambiar-pago'));
    fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));
    expect(screen.queryByTestId('captura-YAPE')).toBeNull();
    expect(screen.getByTestId('enviar-cambio-pago')).toBeEnabled();
    fireEvent.click(screen.getByTestId('enviar-cambio-pago'));
    await waitFor(() => expect(solicitar).toHaveBeenCalledWith('7', expect.objectContaining({ plan: [{ medio: 'TARJETA', monto: 40 }], capturas: {} })));
  });

  it('mixto: una captura opcional por cada medio digital', () => {
    montar();
    fireEvent.click(screen.getByTestId('btn-cambiar-pago'));
    fireEvent.click(screen.getByText(/Agregar otro medio/));
    // la segunda fila queda con otro medio digital o efectivo; se fuerza Plin y su monto
    fireEvent.click(screen.getAllByRole('button', { name: 'Plin' })[screen.getAllByRole('button', { name: 'Plin' }).length - 1]);
    fireEvent.change(screen.getByLabelText('Monto en Plin'), { target: { value: '10' } });
    expect(screen.getByTestId('captura-YAPE')).toHaveTextContent('S/ 30.00');
    expect(screen.getByTestId('captura-PLIN')).toHaveTextContent('S/ 10.00');
    expect(screen.getByTestId('enviar-cambio-pago')).toBeEnabled();
  });

  it('un error del servidor (captura ilegible) se muestra y no cierra el formulario', async () => {
    vi.spyOn(cambioCobroApi, 'solicitar').mockRejectedValue(new Error('La captura de YAPE no se lee bien. Toma otra foto, por favor.'));
    montar();
    fireEvent.click(screen.getByTestId('btn-cambiar-pago'));
    fireEvent.change(screen.getByLabelText('Galería de Yape'), { target: { files: [foto()] } });
    fireEvent.click(screen.getByTestId('enviar-cambio-pago'));
    expect(await screen.findByRole('alert')).toHaveTextContent('no se lee bien');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('con una solicitud pendiente muestra el estado y no deja pedir otra', () => {
    montar({ solicitud: solicitud() });
    expect(screen.getByTestId('estado-cambio-cobro')).toHaveTextContent('Esperando que Caja valide el pago…');
    expect(screen.queryByTestId('btn-cambiar-pago')).toBeNull();
  });

  it('aplicada de inmediato: muestra «Cambio de pago aplicado» y deja volver a cambiar (sin aprobación de Caja)', () => {
    montar({ solicitud: solicitud({ estado: 'APROBADA' }) });
    expect(screen.getByTestId('estado-cambio-cobro')).toHaveTextContent('Cambio de pago aplicado');
    expect(screen.getByTestId('btn-cambiar-pago')).toBeInTheDocument();
  });

  it('rechazada: avisa que cobre con el medio original y deja pedir de nuevo', () => {
    montar({ solicitud: solicitud({ estado: 'RECHAZADA', motivo: 'El Yape no llegó' }) });
    expect(screen.getByTestId('estado-cambio-cobro')).toHaveTextContent('cobra con el medio original');
    expect(screen.getByTestId('estado-cambio-cobro')).toHaveTextContent('El Yape no llegó');
    expect(screen.getByTestId('btn-cambiar-pago')).toBeInTheDocument();
  });
});

describe('Panel de Caja: cambio de pago solicitado', () => {
  const pendiente: SolicitudPendienteCaja = { ...solicitud({ planSolicitado: [{ medio: 'EFECTIVO', monto: 15 }, { medio: 'YAPE', monto: 25 }], pagaCon: 20 }), codigo: 'CP-7', cliente: 'Ana', total: 40, estadoPedido: 'EN_CAMINO', pagoEstado: 'PENDIENTE' };

  beforeEach(() => vi.restoreAllMocks());

  it('muestra medio original contra nuevo, el voucher del pedido y los tres botones', () => {
    render(<PanelCambioCobro pendientes={[pendiente]} />);
    expect(screen.getByLabelText('Cambios de pago solicitados')).toBeInTheDocument();
    expect(screen.getByText(/Medio original:/).parentElement).toHaveTextContent('Efectivo S/ 40.00');
    expect(screen.getByText(/Medio nuevo:/).parentElement).toHaveTextContent('Efectivo S/ 15.00 + Yape S/ 25.00 · paga con S/ 20.00');
    expect(screen.getByTestId('vouchers-del-pedido')).toHaveTextContent('vouchers 7');
    for (const t of ['Aprobar', 'Rechazar', 'Autorizar entrega sin validar']) expect(screen.getByRole('button', { name: t })).toBeInTheDocument();
  });

  it('no muestra nada sin solicitudes', () => {
    const { container } = render(<PanelCambioCobro pendientes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Aprobar resuelve en la API y avisa para recargar', async () => {
    const resolver = vi.spyOn(cambioCobroApi, 'resolver').mockResolvedValue(solicitud({ estado: 'APROBADA' }));
    const alResolver = vi.fn();
    render(<PanelCambioCobro pendientes={[pendiente]} alResolver={alResolver} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
    await waitFor(() => expect(resolver).toHaveBeenCalledWith('7', '3', 'APROBAR', undefined));
    await waitFor(() => expect(alResolver).toHaveBeenCalled());
  });

  it('Rechazar: el motivo es opcional y el pedido vuelve al medio original', async () => {
    const resolver = vi.spyOn(cambioCobroApi, 'resolver').mockResolvedValue(solicitud({ estado: 'RECHAZADA' }));
    render(<PanelCambioCobro pendientes={[pendiente]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('vuelve a Efectivo S/ 40.00');
    const confirmar = Array.from(dialogo.querySelectorAll('button')).find((b) => b.textContent === 'Rechazar') as HTMLButtonElement;
    expect(confirmar).toBeEnabled(); // sin motivo también se puede rechazar
    fireEvent.change(dialogo.querySelector('input')!, { target: { value: 'El Yape no llegó' } });
    fireEvent.click(confirmar);
    await waitFor(() => expect(resolver).toHaveBeenCalledWith('7', '3', 'RECHAZAR', 'El Yape no llegó'));
  });

  it('Autorizar entrega sin validar exige motivo de al menos 5 caracteres', async () => {
    const resolver = vi.spyOn(cambioCobroApi, 'resolver').mockResolvedValue(solicitud({ estado: 'AUTORIZADA_SIN_VALIDAR' }));
    render(<PanelCambioCobro pendientes={[pendiente]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar entrega sin validar' }));
    const dialogo = screen.getByRole('dialog');
    const confirmar = Array.from(dialogo.querySelectorAll('button')).find((b) => b.textContent === 'Autorizar') as HTMLButtonElement;
    expect(confirmar).toBeDisabled();
    fireEvent.change(dialogo.querySelector('input')!, { target: { value: 'no' } });
    expect(confirmar).toBeDisabled();
    fireEvent.change(dialogo.querySelector('input')!, { target: { value: 'La app de Yape no abre' } });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);
    await waitFor(() => expect(resolver).toHaveBeenCalledWith('7', '3', 'AUTORIZAR_SIN_VALIDAR', 'La app de Yape no abre'));
  });

  it('insignia «Cambio de pago solicitado» y el hook carga las pendientes (solo con permiso)', async () => {
    render(<InsigniaCambioCobro />);
    expect(screen.getByTestId('insignia-cambio-cobro')).toHaveTextContent('Cambio de pago solicitado');
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    const pend = vi.spyOn(cambioCobroApi, 'pendientes').mockResolvedValue([pendiente]);
    function Prueba({ activo }: { activo: boolean }) {
      const { pendientes } = useCambiosCobroPendientes(activo);
      return <div data-testid="n">{pendientes.length}</div>;
    }
    const { unmount } = render(<Prueba activo={false} />);
    await act(async () => {});
    expect(pend).not.toHaveBeenCalled();
    unmount();
    render(<Prueba activo />);
    await waitFor(() => expect(screen.getByTestId('n')).toHaveTextContent('1'));
  });
});
