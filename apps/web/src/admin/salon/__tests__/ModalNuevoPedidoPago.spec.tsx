import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { continuarYEnviar, irAlPago } from './continuarYEnviar';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { vouchersApi } from '../../vouchers/vouchersApi';
import { llenarPagaCon } from './ayudaPagaCon';

/** Elige boleta en el selector obligatorio (si el paso lo muestra y aún no hay elección). */
const elegirBoleta = () => {
  const b = screen.queryByTestId('comprobante-BOLETA');
  if (b && b.getAttribute('aria-pressed') !== 'true') fireEvent.click(b);
};

vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../pedidos/pedidosApi', () => ({
  pedidosApi: { crearPedidoAdmin: vi.fn() },
}));
vi.mock('../../vouchers/vouchersApi', () => ({
  vouchersApi: { subirVoucher: vi.fn() },
}));
vi.mock('../../vouchers/reducirImagenVoucher', () => ({
  reducirImagenVoucher: vi.fn(async (archivo: File) => archivo),
}));

const cartaMock = {
  categorias: [
    {
      id: 'cat-1',
      nombre: 'Bebidas',
      orden: 1,
      productos: [
        {
          id: 'prod-1',
          nombre: 'Café Americano',
          descripcion: 'Café tostado',
          fotoUrl: null,
          precio: 8.5,
          tamanos: [],
          grupos: [],
          sabores: [],
          noSumaBeneficios: false,
          disponible: true,
          agotadoHasta: null,
        },
      ],
    },
  ],
};

const pedidoCreado = { id: 'ped-9', codigo: 'CP-W009', estado: 'COLA', total: 8.5 };

/** Abre el alta desde «¿Qué vas a hacer?», elige la modalidad y registra un café con datos del cliente. */
async function llegarAResumen(modalidad: 'Para llevar' | 'Delivery', alExitoPedido = vi.fn(), alCerrar = vi.fn()) {
  render(
    <ModalNuevoPedidoMesa
      abierto={true}
      alCerrar={alCerrar}
      pisos={[]}
      pasoInicial="modal"
      alExitoPedido={alExitoPedido}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: new RegExp(modalidad) }));
  fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
  if (modalidad === 'Delivery') {
    fireEvent.change(screen.getByPlaceholderText('Jr. / Av. / Calle y número'), {
      target: { value: 'Jr. Lima 100' },
    });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));

  fireEvent.click(await screen.findByText('Café Americano'));
  // Las bebidas piden el nombre de quien la toma (va en la etiqueta del vaso)
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
  // Paso 1 → paso 2 «Pago»
  irAlPago();
  return { alExitoPedido, alCerrar };
}

async function confirmarRegistro() {
  elegirBoleta();
  llenarPagaCon();
  continuarYEnviar();
  fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar' }));
}

describe('ModalNuevoPedidoMesa: medio de pago del mozo en llevar y delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaMock as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(pedidosApi.crearPedidoAdmin).mockResolvedValue(pedidoCreado as any);
  });

  it('en mesa el selector ¿Cómo paga? aparece igual que en llevar', async () => {
    // Mesa: se abre con una mesa preseleccionada
    render(
      <ModalNuevoPedidoMesa
        abierto={true}
        alCerrar={vi.fn()}
        pisos={[{ id: '1', nombre: 'Piso 1', activo: true, mesas: [
          { id: 'm1', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 4, x: 2, y: 5, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' as const },
        ] }] as any}
        mesasPreseleccionadasIds={['m1']}
      />,
    );
    await screen.findByText('Aún no agregas productos.', { exact: false });
    // En mesa el pago es un paso aparte y solo se detalla con «Pagar ahora»
    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));
    fireEvent.change(screen.getByLabelText('Celular del cliente (opcional)'), { target: { value: '987654321' } });
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Ana' } });
    irAlPago();
    expect(screen.queryByRole('group', { name: '¿Cómo paga?' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora/ }));
    expect(await screen.findByRole('group', { name: '¿Cómo paga?' })).toBeInTheDocument();
  });

  it('en llevar muestra Efectivo, Yape, Plin y Transferencia con Efectivo por defecto', async () => {
    await llegarAResumen('Para llevar');

    const grupo = await screen.findByRole('group', { name: '¿Cómo paga?' });
    const opciones = within(grupo).getAllByRole('button');
    expect(opciones.map((b) => b.textContent)).toEqual(['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia']);
    expect(within(grupo).getByRole('button', { name: 'Efectivo' })).toHaveAttribute('aria-pressed', 'true');
    // El campo «con cuánto paga» aparece con efectivo en llevar también (para el vuelto)
    expect(screen.getByText('¿Con cuánto paga?')).toBeInTheDocument();
  });

  it('en efectivo sin «con cuánto paga» no registra, avisa y «Pago exacto» llena el monto', async () => {
    await llegarAResumen('Para llevar');
    await screen.findByRole('group', { name: '¿Cómo paga?' });

    continuarYEnviar();
    expect(await screen.findByText(/Indica con cuánto paga/)).toBeInTheDocument();
    expect(pedidosApi.crearPedidoAdmin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Pago exacto/ }));
    expect((document.querySelector('#plan-paga-con') as HTMLInputElement).value).toBe('8.50');
    continuarYEnviar();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, registrar' }));
    await waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledTimes(1));
    expect(vi.mocked(pedidosApi.crearPedidoAdmin).mock.calls[0][0].pago).toMatchObject({ metodo: 'EFECTIVO', pagaCon: 8.5 });
  });

  it('en efectivo registra con metodo EFECTIVO y cierra como antes, sin voucher', async () => {
    const { alExitoPedido, alCerrar } = await llegarAResumen('Para llevar');
    await screen.findByRole('group', { name: '¿Cómo paga?' });

    await confirmarRegistro();

    await waitFor(() => expect(alCerrar).toHaveBeenCalledTimes(1));
    expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ modalidad: 'RECOGER', pago: expect.objectContaining({ metodo: 'EFECTIVO' }) }),
      expect.any(String),
    );
    expect(alExitoPedido).toHaveBeenCalledWith(pedidoCreado);
    expect(screen.queryByRole('dialog', { name: /Voucher del pedido/ })).toBeNull();
  });

  it('con Yape registra con metodo YAPE y abre la ventana del voucher del pedido creado', async () => {
    const { alExitoPedido, alCerrar } = await llegarAResumen('Para llevar');
    const grupo = await screen.findByRole('group', { name: '¿Cómo paga?' });
    fireEvent.click(within(grupo).getByRole('button', { name: 'Yape' }));

    await confirmarRegistro();

    const dialogo = await screen.findByRole('dialog', { name: 'Voucher del pedido CP-W009' });
    expect(within(dialogo).getByText('Foto del voucher (YAPE)')).toBeInTheDocument();
    expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        pago: { metodo: 'YAPE', pagaCon: undefined, plan: [{ medio: 'YAPE', monto: 8.5 }] },
      }),
      expect.any(String),
    );
    // Aún no se cierra el flujo: falta el voucher o decidir subirlo después
    expect(alCerrar).not.toHaveBeenCalled();
    expect(alExitoPedido).not.toHaveBeenCalled();
  });

  it('«Subir después» cierra el flujo, deja el pedido creado y no sube nada', async () => {
    const { alExitoPedido, alCerrar } = await llegarAResumen('Para llevar');
    const grupo = await screen.findByRole('group', { name: '¿Cómo paga?' });
    fireEvent.click(within(grupo).getByRole('button', { name: 'Plin' }));
    await confirmarRegistro();

    const dialogo = await screen.findByRole('dialog', { name: 'Voucher del pedido CP-W009' });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Subir después' }));

    await waitFor(() => expect(alCerrar).toHaveBeenCalledTimes(1));
    expect(alExitoPedido).toHaveBeenCalledWith(pedidoCreado);
    expect(vouchersApi.subirVoucher).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: /Voucher del pedido/ })).toBeNull();
  });

  it('una foto legible cierra el flujo con el éxito del pedido', async () => {
    vi.mocked(vouchersApi.subirVoucher).mockResolvedValue({ id: '7', legible: true } as any);
    const { alExitoPedido, alCerrar } = await llegarAResumen('Delivery');
    const grupo = await screen.findByRole('group', { name: '¿Cómo paga?' });
    fireEvent.click(within(grupo).getByRole('button', { name: 'Transferencia' }));
    await confirmarRegistro();

    const dialogo = await screen.findByRole('dialog', { name: 'Voucher del pedido CP-W009' });
    fireEvent.change(await within(dialogo).findByTestId('input-voucher-archivo'), {
      target: { files: [new File(['img'], 'transf.jpg', { type: 'image/jpeg' })] },
    });

    expect(await within(dialogo).findByText(/Voucher guardado/)).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Listo' }));

    await waitFor(() => expect(alCerrar).toHaveBeenCalledTimes(1));
    expect(alExitoPedido).toHaveBeenCalledWith(pedidoCreado);
    expect(vouchersApi.subirVoucher).toHaveBeenCalledWith(expect.anything(), 'ped-9', 'TRANSFERENCIA');
  });

  it('en delivery con efectivo muestra el campo «paga con»; con Yape lo oculta', async () => {
    await llegarAResumen('Delivery');
    const grupo = await screen.findByRole('group', { name: '¿Cómo paga?' });
    expect(screen.getByText('¿Con cuánto paga?')).toBeInTheDocument();

    fireEvent.click(within(grupo).getByRole('button', { name: 'Yape' }));
    expect(screen.queryByText('¿Con cuánto paga?')).toBeNull();
  });

  it('pago dividido: efectivo + Yape envía pago.plan con los montos y el voucher es solo de la parte digital', async () => {
    vi.mocked(vouchersApi.subirVoucher).mockResolvedValue({ id: '8', legible: true } as any);
    const { alExitoPedido, alCerrar } = await llegarAResumen('Para llevar');
    const grupo = await screen.findByRole('group', { name: '¿Cómo paga?' });
    fireEvent.click(within(grupo).getByRole('button', { name: 'Yape' }));
    // Total 8.50: Yape baja a 5.00 y «Añadir otro método» agrega Efectivo con el saldo (3.50) ya sugerido
    fireEvent.change(screen.getByLabelText('Monto en Yape'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir otro método/ }));
    expect(screen.getByLabelText('Monto en Efectivo')).toHaveValue(3.5);
    expect(screen.getByTestId('estado-pago')).toHaveTextContent('Cubierto');

    await confirmarRegistro();

    expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        pago: expect.objectContaining({
          metodo: 'YAPE',
          plan: [
            { medio: 'YAPE', monto: 5 },
            { medio: 'EFECTIVO', monto: 3.5 },
          ],
        }),
      }),
      expect.any(String),
    );
    const dialogo = await screen.findByRole('dialog', { name: 'Voucher del pedido CP-W009' });
    expect(within(dialogo).getByText(/Captura de Yape por S\/ 5.00/)).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Subir después' }));
    await waitFor(() => expect(alCerrar).toHaveBeenCalledTimes(1));
    expect(alExitoPedido).toHaveBeenCalledWith(pedidoCreado);
  });

  it('no deja registrar si el plan no cubre el total', async () => {
    await llegarAResumen('Para llevar');
    const grupo = await screen.findByRole('group', { name: '¿Cómo paga?' });
    fireEvent.click(within(grupo).getByRole('button', { name: 'Yape' }));
    fireEvent.change(screen.getByLabelText('Monto en Yape'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir otro método/ }));
    // Efectivo por encima del saldo: sobran 0.50 sobre el total (8.50)
    fireEvent.change(screen.getByLabelText('Monto en Efectivo'), { target: { value: '4' } });

    expect(screen.getByTestId('estado-pago')).toHaveTextContent('Sobra S/ 0.50');
    // «Enviar a cocina» queda deshabilitado y dice qué falta
    elegirBoleta();
    llenarPagaCon();
    const enviar = screen.getByRole('button', { name: /^Enviar a cocina/ });
    expect(enviar).toBeDisabled();
    expect(screen.getByText(/Sobra S\/ 0.50: ajusta los montos/)).toBeInTheDocument();
    expect(pedidosApi.crearPedidoAdmin).not.toHaveBeenCalled();
  });
});
