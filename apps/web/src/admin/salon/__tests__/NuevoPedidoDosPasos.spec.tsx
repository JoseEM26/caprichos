import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { api } from '../../../comun/api';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { vouchersApi } from '../../vouchers/vouchersApi';

vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn(), obtenerMesas: vi.fn() },
}));
vi.mock('../../../comun/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../pedidos/pedidosApi', () => ({ pedidosApi: { crearPedidoAdmin: vi.fn(), cobrar: vi.fn() } }));
vi.mock('../../vouchers/vouchersApi', () => ({
  vouchersApi: {
    subirVoucher: vi.fn(),
    enviarACaja: vi.fn(),
    guardarPlanPago: vi.fn(),
    listarVouchers: vi.fn(),
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

const pisos = [
  {
    id: '1', nombre: 'Piso 1', activo: true,
    mesas: [{ id: 'm1', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 4, x: 2, y: 5, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' as const }],
  },
] as any;

/** Interruptor de propina por canal que devuelve la carta pública (/carta/local) */
function conPropina(canales: { mozo?: boolean; caja?: boolean }, tope = 50) {
  vi.mocked(api.get).mockImplementation((async (ruta: string) =>
    ruta === '/carta/local' ? { propina: { carta: false, bot: false, mozo: false, caja: false, ...canales, tope } } : { items: [] }) as any);
}

const elegirBoleta = () => {
  const b = screen.queryByTestId('comprobante-BOLETA');
  if (b && b.getAttribute('aria-pressed') !== 'true') fireEvent.click(b);
};

/** Mesa 1 preseleccionada, un café de S/ 40 y los datos del cliente. Se queda en el paso 1. */
async function mesaConCafe(canal: 'MOZO' | 'CAJA' = 'MOZO', extra: Record<string, unknown> = {}) {
  render(
    <ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisos} mesasPreseleccionadasIds={['m1']} canal={canal} {...extra} />,
  );
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
  fireEvent.change(screen.getByLabelText('Celular del cliente (opcional)'), { target: { value: '987654321' } });
  fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Ana' } });
}

const continuar = () => fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
const botonEnviar = () => screen.getByRole('button', { name: /^Enviar a cocina/ }) as HTMLButtonElement;
const montoDe = (medio: string) => screen.getByLabelText(`Monto en ${medio}`) as HTMLInputElement;
const elegirMedio = (nombre: string, indice = 0) =>
  fireEvent.click(within(screen.getAllByRole('group', { name: indice === 0 ? '¿Cómo paga?' : `Método de pago ${indice + 1}` })[0]).getByRole('button', { name: nombre }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
  vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
  vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos } as any);
  vi.mocked(salonApi.abrirPedidoMesa).mockResolvedValue({ id: '77', codigo: 'CP-W077' } as any);
  vi.mocked(pedidosApi.crearPedidoAdmin).mockResolvedValue({ id: '78', codigo: 'CP-W078' } as any);
  vi.mocked(pedidosApi.cobrar).mockResolvedValue({ ok: true } as any);
  vi.mocked(vouchersApi.enviarACaja).mockResolvedValue({ ok: true });
  vi.mocked(vouchersApi.guardarPlanPago).mockResolvedValue({} as any);
  vi.mocked(vouchersApi.listarVouchers).mockResolvedValue([] as any);
  conPropina({});
});

describe('Nuevo pedido en 2 pasos: Pedido y Pago', () => {
  it('«Continuar» está deshabilitado sin productos o sin datos del cliente y se habilita al completarlos', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisos} mesasPreseleccionadasIds={['m1']} canal="MOZO" />);
    const boton = await screen.findByRole('button', { name: 'Continuar' });
    expect(boton).toBeDisabled();
    expect(screen.getByText('Agrega al menos un producto para enviarlo.')).toBeInTheDocument();

    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Celular del cliente (opcional)'), { target: { value: '987654321' } });
    expect(boton).toBeEnabled();
    expect(boton).toHaveTextContent('S/ 40.00');
  });

  it('el paso 2 no muestra los productos, y «Atrás» vuelve al paso 1 sin perder productos ni datos', async () => {
    await mesaConCafe();
    continuar();
    expect(screen.getByTestId('paso-pago')).toBeInTheDocument();
    expect(screen.queryByText('Buscar producto')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora/ }));
    elegirMedio('Yape');

    fireEvent.click(screen.getByRole('button', { name: /Atrás/ }));
    expect(screen.queryByTestId('paso-pago')).toBeNull();
    expect(screen.getByLabelText('Nombre del cliente *')).toHaveValue('Ana');
    expect(screen.getByLabelText('Celular del cliente (opcional)')).toHaveValue('987654321');
    expect(screen.getAllByText(/1 x Café Americano/).length).toBeGreaterThan(0);

    // Al volver al pago, la elección de «Pagar ahora» y el medio siguen ahí
    continuar();
    expect(screen.getByRole('button', { name: /Pagar ahora/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('group', { name: '¿Cómo paga?' })).getByRole('button', { name: 'Yape' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('mesa de local, «Pagar al final»: no pide pago y el pedido sale sin plan', async () => {
    await mesaConCafe();
    continuar();
    expect(screen.getByRole('button', { name: /Pagar al final/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('group', { name: '¿Cómo paga?' })).toBeNull();
    elegirBoleta();
    fireEvent.click(botonEnviar());
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar comanda' }));
    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0][0] as any;
    expect(payload.pago).toEqual({ metodo: 'EFECTIVO' });
    expect(payload.propina).toBeUndefined();
    expect(pedidosApi.cobrar).not.toHaveBeenCalled();
    expect(vouchersApi.enviarACaja).not.toHaveBeenCalled();
  });

  it('mesa de local, «Pagar ahora»: abre el detalle del pago y exige el efectivo con su vuelto', async () => {
    await mesaConCafe();
    continuar();
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora/ }));
    expect(screen.getByRole('group', { name: '¿Cómo paga?' })).toBeInTheDocument();
    expect(montoDe('Efectivo')).toHaveValue(40);
    expect(screen.getByTestId('estado-pago')).toHaveTextContent('Cubierto');
    elegirBoleta();
    // Falta «con cuánto paga»: no se puede enviar
    expect(botonEnviar()).toBeDisabled();
    expect(screen.getByText(/Indica con cuánto paga/)).toBeInTheDocument();
    fireEvent.change(document.querySelector('#plan-paga-con') as HTMLInputElement, { target: { value: '50' } });
    expect(screen.getByTestId('vuelto')).toHaveTextContent('Vuelto S/ 10.00');
    expect(botonEnviar()).toBeEnabled();
  });

  it('llevar y delivery siempre piden el pago: no existe «Pagar al final»', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" canal="CAJA" />);
    fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
    fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));
    continuar();
    expect(screen.queryByRole('button', { name: /Pagar al final/ })).toBeNull();
    expect(screen.getByRole('group', { name: '¿Cómo paga?' })).toBeInTheDocument();
    elegirBoleta();
    expect(botonEnviar()).toBeDisabled();
  });
});

describe('Pago mixto hasta 3 métodos con «Añadir otro método»', () => {
  async function alPagoMixto() {
    await mesaConCafe();
    continuar();
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora/ }));
  }

  it('el primer método lleva todo el total; «Añadir otro método» sugiere el saldo, muestra Falta/Cubierto y permite quitar', async () => {
    await alPagoMixto();
    // Con todo el monto en un método no hay saldo para añadir otro
    expect(screen.getByRole('button', { name: /Añadir otro método/ })).toBeDisabled();

    elegirMedio('Yape');
    fireEvent.change(montoDe('Yape'), { target: { value: '25' } });
    expect(screen.getByTestId('estado-pago')).toHaveTextContent('Falta S/ 15.00');
    fireEvent.click(screen.getByRole('button', { name: /Añadir otro método/ }));
    expect(screen.getAllByRole('group', { name: /Método de pago 2/ })).toHaveLength(1);
    // El saldo ya viene sugerido en la fila nueva (el primer medio libre es Efectivo)
    expect(montoDe('Efectivo')).toHaveValue(15);
    expect(screen.getByTestId('estado-pago')).toHaveTextContent('Cubierto');

    fireEvent.click(screen.getByRole('button', { name: 'Quitar Efectivo' }));
    expect(screen.queryByLabelText('Monto en Efectivo')).toBeNull();
    expect(screen.getByTestId('estado-pago')).toHaveTextContent('Falta S/ 15.00');
  });

  it('acepta hasta 3 métodos: con 3 filas desaparece «Añadir otro método»', async () => {
    await alPagoMixto();
    elegirMedio('Yape');
    fireEvent.change(montoDe('Yape'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir otro método/ }));
    fireEvent.change(montoDe('Efectivo'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir otro método/ }));
    expect(screen.getAllByRole('group', { name: /Método de pago/ })).toHaveLength(2);
    expect(screen.getByLabelText('Monto en Plin')).toHaveValue(20);
    expect(screen.queryByRole('button', { name: /Añadir otro método/ })).toBeNull();
    expect(screen.getByTestId('estado-pago')).toHaveTextContent('Cubierto');
  });

  it('con efectivo + Yape + Plin: envía el plan de 3 medios y pide una captura por cada medio digital', async () => {
    await alPagoMixto();
    elegirMedio('Yape');
    fireEvent.change(montoDe('Yape'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir otro método/ }));
    fireEvent.change(montoDe('Efectivo'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir otro método/ }));
    // Resumen: 2 capturas al enviar (Yape y Plin)
    expect(screen.getByText('2 capturas al enviar')).toBeInTheDocument();
    fireEvent.change(document.querySelector('#plan-paga-con') as HTMLInputElement, { target: { value: '10' } });
    elegirBoleta();
    fireEvent.click(botonEnviar());
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0][0] as any;
    expect(payload.pago.plan).toEqual([
      { medio: 'YAPE', monto: 10 },
      { medio: 'EFECTIVO', monto: 10 },
      { medio: 'PLIN', monto: 20 },
    ]);

    // Después de crear el pedido: una captura por medio digital (Yape y Plin), no por el efectivo
    const dialogo = await screen.findByRole('dialog', { name: 'Capturas del pedido CP-W077' });
    expect(await within(dialogo).findByTestId('captura-yape')).toBeInTheDocument();
    expect(within(dialogo).getByTestId('captura-plin')).toBeInTheDocument();
    expect(within(dialogo).queryByTestId('captura-efectivo')).toBeNull();
    // El plan se guarda antes de subir cada foto (el servidor compara contra el monto de su medio)
    expect(vouchersApi.guardarPlanPago).toHaveBeenCalledWith('77', payload.pago.plan);
  });
});

describe('«Pagar ahora» deja el pago registrado según el canal', () => {
  it('CAJA con efectivo: cobra al crear, con el efectivo recibido, y cierra', async () => {
    const alCerrar = vi.fn();
    await mesaConCafe('CAJA', { alCerrar });
    continuar();
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora/ }));
    fireEvent.change(document.querySelector('#plan-paga-con') as HTMLInputElement, { target: { value: '50' } });
    elegirBoleta();
    fireEvent.click(botonEnviar());
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(pedidosApi.cobrar).toHaveBeenCalledTimes(1));
    expect(pedidosApi.cobrar).toHaveBeenCalledWith({ pedidoId: '77', pagos: [{ medio: 'EFECTIVO', monto: 40, recibido: 50 }] });
    expect(vouchersApi.enviarACaja).not.toHaveBeenCalled();
    await waitFor(() => expect(alCerrar).toHaveBeenCalled());
  });

  it('MOZO: no cobra; lo deja «pagado por mozo, por verificar» con el cobro por mozo existente (enviar a Caja)', async () => {
    await mesaConCafe('MOZO');
    continuar();
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora/ }));
    expect(screen.getByText(/Pagado por mozo · por verificar/)).toBeInTheDocument();
    fireEvent.change(document.querySelector('#plan-paga-con') as HTMLInputElement, { target: { value: '50' } });
    elegirBoleta();
    fireEvent.click(botonEnviar());
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(vouchersApi.enviarACaja).toHaveBeenCalledTimes(1));
    expect(vouchersApi.enviarACaja).toHaveBeenCalledWith('77', 'EFECTIVO', [{ medio: 'EFECTIVO', monto: 40 }], { recibido: 50 });
    expect(pedidosApi.cobrar).not.toHaveBeenCalled();
  });

  it('con un medio digital pide la captura y, con la casilla «sin captura», registra el pago', async () => {
    await mesaConCafe('CAJA');
    continuar();
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora/ }));
    elegirMedio('Yape');
    elegirBoleta();
    fireEvent.click(botonEnviar());
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar comanda' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Capturas del pedido CP-W077' });
    const registrar = within(dialogo).getByRole('button', { name: 'Registrar pago' });
    await waitFor(() => expect(within(dialogo).getByTestId('captura-yape')).toBeInTheDocument());
    expect(registrar).toBeDisabled();
    fireEvent.click(within(dialogo).getByRole('checkbox'));
    expect(registrar).toBeEnabled();
    fireEvent.click(registrar);
    await waitFor(() => expect(pedidosApi.cobrar).toHaveBeenCalledTimes(1));
    expect(pedidosApi.cobrar).toHaveBeenCalledWith({ pedidoId: '77', pagos: [{ medio: 'YAPE', monto: 40 }], confirmaSinCaptura: true });
  });

  it('si el cobro falla (p. ej. caja cerrada) el pedido ya está en cocina y se puede reintentar desde el aviso', async () => {
    vi.mocked(pedidosApi.cobrar).mockRejectedValueOnce(new Error('Abre la caja para cobrar'));
    await mesaConCafe('CAJA');
    continuar();
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora/ }));
    fireEvent.change(document.querySelector('#plan-paga-con') as HTMLInputElement, { target: { value: '40' } });
    elegirBoleta();
    fireEvent.click(botonEnviar());
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar comanda' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Capturas del pedido CP-W077' });
    expect(within(dialogo).getByRole('alert')).toHaveTextContent('Abre la caja para cobrar');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pago' }));
    await waitFor(() => expect(pedidosApi.cobrar).toHaveBeenCalledTimes(2));
  });
});

describe('Propina de monto libre en el paso Pago', () => {
  it('apagada para el canal: no se muestra ni se envía', async () => {
    conPropina({ caja: true }); // solo Caja; el mozo la tiene apagada
    await mesaConCafe('MOZO');
    continuar();
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora/ }));
    expect(screen.queryByTestId('propina-nuevo-pedido')).toBeNull();
  });

  it('con «Pagar al final» no se ofrece (no hay cobro en este momento)', async () => {
    conPropina({ mozo: true });
    await mesaConCafe('MOZO');
    continuar();
    expect(screen.queryByTestId('propina-nuevo-pedido')).toBeNull();
  });

  it.each([
    ['Efectivo', 'EFECTIVO'],
    ['Tarjeta', 'TARJETA'],
    ['Yape', 'YAPE'],
    ['Plin', 'PLIN'],
    ['Transferencia', 'TRANSFERENCIA'],
  ])('con %s: monto libre aparte del total, el plan suma venta + propina y el botón lo dice', async (nombre, medio) => {
    conPropina({ mozo: true });
    await mesaConCafe('MOZO');
    continuar();
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora/ }));
    elegirMedio(nombre);
    // Monto libre: sin botones de porcentaje
    expect(screen.queryByText(/%/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Propina para el equipo/), { target: { value: '5' } });

    expect(screen.getByTestId('propina-resumen')).toHaveTextContent('S/ 5.00');
    expect(montoDe(nombre)).toHaveValue(45);
    expect(screen.getByRole('button', { name: /^Enviar a cocina · S\/ 40\.00 \+ propina S\/ 5\.00/ })).toBeInTheDocument();
    if (medio === 'EFECTIVO') fireEvent.change(document.querySelector('#plan-paga-con') as HTMLInputElement, { target: { value: '50' } });
    elegirBoleta();
    fireEvent.click(botonEnviar());
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0][0] as any;
    expect(payload.propina).toBe(5);
    expect(payload.pago.plan).toEqual([{ medio, monto: 45 }]);
  });

  it('pago mixto con propina: el plan suma venta + propina y la propina se reparte en el cobro en proporción al monto por medio', async () => {
    conPropina({ caja: true });
    await mesaConCafe('CAJA');
    continuar();
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora/ }));
    fireEvent.change(screen.getByLabelText(/Propina para el equipo/), { target: { value: '5' } });
    elegirMedio('Tarjeta');
    fireEvent.change(montoDe('Tarjeta'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir otro método/ }));
    // Saldo sugerido: 45 - 30 = 15 en el primer medio libre (Efectivo)
    expect(montoDe('Efectivo')).toHaveValue(15);
    expect(screen.getByTestId('estado-pago')).toHaveTextContent('Cubierto');
    fireEvent.change(document.querySelector('#plan-paga-con') as HTMLInputElement, { target: { value: '20' } });
    elegirBoleta();
    fireEvent.click(botonEnviar());
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(pedidosApi.cobrar).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0][0] as any;
    expect(payload.propina).toBe(5);
    expect(payload.pago.plan).toEqual([
      { medio: 'TARJETA', monto: 30 },
      { medio: 'EFECTIVO', monto: 15 },
    ]);
    // El cobro lleva lo que entrega el cliente por medio (45 en total); el servidor separa la propina por renglón
    expect(pedidosApi.cobrar).toHaveBeenCalledWith({
      pedidoId: '77',
      pagos: [
        { medio: 'TARJETA', monto: 30 },
        { medio: 'EFECTIVO', monto: 15, recibido: 20 },
      ],
    });
  });

  it('una propina sobre el tope o mal escrita bloquea el envío con un aviso', async () => {
    conPropina({ mozo: true }, 10);
    await mesaConCafe('MOZO');
    continuar();
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora/ }));
    fireEvent.change(screen.getByLabelText(/Propina para el equipo/), { target: { value: '25' } });
    expect(screen.getAllByText(/La propina debe ser un monto entre S\/ 0 y S\/ 10\.00/).length).toBeGreaterThan(0);
    elegirBoleta();
    fireEvent.change(document.querySelector('#plan-paga-con') as HTMLInputElement, { target: { value: '100' } });
    expect(botonEnviar()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Propina para el equipo/), { target: { value: '2,5' } });
    expect(botonEnviar()).toBeEnabled();
  });
});
