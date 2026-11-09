import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import { PlanoMesaResaltada } from '../../salon/componentes/PlanoMesaResaltada';
import type { Pedido } from '../pedidosApi';
import { vouchersApi } from '../../vouchers/vouchersApi';
import { salonApi } from '../../salon/api';
import * as sesionModulo from '../../../comun/sesion';
import { obtenerBlobAutenticado } from '../../../comun/api';

vi.mock('../../../comun/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/api')>()),
  obtenerBlobAutenticado: vi.fn().mockResolvedValue('blob:captura'),
}));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));
vi.mock('../audioAlerta', () => ({ reproducirCampana: vi.fn() }));

let permisos: string[] = [];
beforeEach(() => {
  vi.restoreAllMocks();
  permisos = ['pedidos/anular'];
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: (p: string) => permisos.includes(p) } as any);
  vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([]);
  vi.mocked(obtenerBlobAutenticado).mockResolvedValue('blob:captura');
});

const pedido = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'p-1',
    codigo: 'CP-W100',
    canal: 'MOZO',
    modalidad: 'MESA',
    mesa_nombre: 'Mesa 3',
    cliente_nombre: 'José',
    estado: 'PREPARANDO',
    pago_estado: 'PENDIENTE',
    creado_en: '2026-11-08T20:00:00.000Z',
    minutosEspera: 12,
    subtotal: 40,
    descuento: 0,
    total: 40,
    lineas: [
      {
        id: 'l1',
        nombre: 'Dona clásica',
        tamano: 'Caja x6',
        cantidad: 2,
        precio_unit: 20,
        subtotal: 40,
        sabores: [
          { nombre: 'Chocolate', cantidad: 4 },
          { nombre: 'Fresa', cantidad: 2 },
        ],
        opcionesElegidas: [{ opcion_nombre: 'Leche de almendra' }],
        nota: 'sin azúcar',
      },
    ],
    eventos: [{ id: 'e1', tipo: 'estado', titulo: 'Pasó a preparando', detalle: null, en: '2026-11-08T20:05:00.000Z', por: 'Ana' }],
    ...extra,
  }) as unknown as Pedido;

const renderizar = (p: Pedido, props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <PedidoDetalle pedido={p} alActualizar={vi.fn()} {...props} />
    </MemoryRouter>,
  );

describe('PedidoDetalle en 3 capas', () => {
  it('la cabecera muestra la mesa completa en su insignia, aparte del nombre', () => {
    renderizar(pedido({ mesa_nombre: 'Mesa 12 - Terraza', cliente_nombre: 'María de los Ángeles Fernández de la Cruz' }));
    const ins = screen.getAllByTestId('insignia-mesa')[0];
    expect(ins).toHaveTextContent('MESA 12');
    expect(ins).toHaveTextContent('TERRAZA');
    expect(screen.getByRole('heading', { level: 2, name: 'María de los Ángeles Fernández de la Cruz' })).toBeInTheDocument();
  });

  it('muestra la cabecera y tres capas numeradas; cambia de capa y empieza en Productos', () => {
    renderizar(pedido());
    expect(screen.getByRole('heading', { name: 'José' })).toBeInTheDocument();
    expect(screen.getAllByTestId('insignia-mesa')[0]).toHaveTextContent('MESA 3');
    expect(screen.getByText('CP-W100')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument();
    const capas = screen.getAllByRole('tab');
    expect(capas.map((c) => c.getAttribute('aria-label'))).toEqual(['Productos', 'Pago y voucher', 'Cliente y entrega']);
    expect(capas[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Productos del pedido' })).toBeInTheDocument();

    fireEvent.click(capas[1]);
    expect(capas[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('region', { name: 'Productos del pedido' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Estado del cobro' })).toBeInTheDocument();

    fireEvent.click(capas[2]);
    expect(screen.getByRole('region', { name: 'Cliente' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Entrega' })).toBeInTheDocument();
  });

  it('la capa Productos pone sabores en negrita, opciones como chips, nota y resumen con el descuento por nombre', () => {
    renderizar(
      pedido({
        descuento: 5,
        descuento_detalle: [{ tipo: 'PROMO', nombre: 'Promo dona', montoDescontado: 5 }],
        propina: 2,
        nota: 'Sin velas',
        total: 37,
      }),
    );
    const linea = screen.getByTestId('linea-pedido');
    expect(within(linea).getByText('Dona clásica')).toBeInTheDocument();
    expect(within(linea).getByTestId('linea-detalle')).toHaveTextContent('Caja x6 · Leche de almendra');
    expect(within(linea).getByText('Sabores: 4 Chocolate · 2 Fresa')).toBeInTheDocument();
    expect(within(linea).getByText('Nota: sin azúcar')).toBeInTheDocument();
    const resumen = screen.getByRole('region', { name: 'Resumen del pedido' });
    expect(within(resumen).getByText('Descuento · Promo dona')).toBeInTheDocument();
    expect(within(resumen).getByText('Propina')).toBeInTheDocument();
    expect(screen.getByText('Nota para cocina: Sin velas')).toBeInTheDocument();
  });

  it('la capa Pago muestra el vuelto cuando hay efectivo y paga con más', () => {
    renderizar(pedido({ modalidad: 'LLEVAR', pago_preferido: 'EFECTIVO', paga_con: 50 }));
    fireEvent.click(screen.getByRole('tab', { name: 'Pago y voucher' }));
    const vuelto = screen.getByTestId('vuelto');
    expect(vuelto).toHaveTextContent('SÍ lleva vuelto: S/ 10.00');
    expect(vuelto).toHaveTextContent('Paga con S/ 50.00');
  });

  it('sin efectivo no hay bloque de vuelto', () => {
    renderizar(pedido({ modalidad: 'LLEVAR', pago_preferido: 'YAPE' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Pago y voucher' }));
    expect(screen.queryByTestId('vuelto')).toBeNull();
  });

  it('pago dividido: cada medio con su monto y si pide captura', async () => {
    renderizar(
      pedido({
        modalidad: 'LLEVAR',
        planPago: [
          { medio: 'EFECTIVO', monto: 15 },
          { medio: 'YAPE', monto: 25 },
        ],
      }),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Pago y voucher' }));
    expect(within(screen.getByTestId('plan-efectivo')).getByText('S/ 15.00')).toBeInTheDocument();
    const yape = screen.getByTestId('plan-yape');
    expect(within(yape).getByText('S/ 25.00')).toBeInTheDocument();
    await waitFor(() => expect(within(yape).getByText('Falta captura')).toBeInTheDocument());
  });

  it('el voucher es una fila corta con «Ver captura» que abre un visor con zoom y se cierra', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([
      { id: '21', pedidoId: 'p-1', archivoId: '900', origen: 'CARTA', medio: 'YAPE', operacion: '123456', semaforo: 'CONFIABLE', motivos: [], extraido: { legible: true, monto: 40, operacion: '123456', hora: '20:01' }, creadoEn: '2026-11-08T20:01:00Z' } as any,
    ]);
    renderizar(pedido({ modalidad: 'LLEVAR', pago_preferido: 'YAPE' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Pago y voucher' }));

    const fila = await screen.findByTestId('fila-voucher');
    expect(within(fila).getByText('YAPE · S/ 40.00')).toBeInTheDocument();
    expect(within(fila).getByText(/Operación 123456 · 20:01/)).toBeInTheDocument();
    expect(within(fila).getByTestId('voucher-semaforo')).toHaveTextContent('Legible');
    expect(within(fila).getByRole('button', { name: 'Reemplazar voucher' })).toBeInTheDocument();
    expect(screen.queryByTestId('visor-captura')).toBeNull();

    fireEvent.click(within(fila).getByRole('button', { name: 'Ver captura' }));
    const visor = screen.getByTestId('visor-captura');
    expect(within(visor).getByTestId('visor-zoom')).toHaveTextContent('100%');
    fireEvent.click(within(visor).getByRole('button', { name: 'Acercar' }));
    expect(within(visor).getByTestId('visor-zoom')).toHaveTextContent('150%');
    fireEvent.click(within(visor).getByRole('button', { name: 'Alejar' }));
    fireEvent.click(within(visor).getByRole('button', { name: 'Alejar' }));
    expect(within(visor).getByTestId('visor-zoom')).toHaveTextContent('75%');
    fireEvent.click(within(visor).getByRole('button', { name: 'Cerrar la captura' }));
    expect(screen.queryByTestId('visor-captura')).toBeNull();
  });

  it('sin captura y con Yape ofrece la caja punteada «Sin captura (opcional)» con «Subir captura»', async () => {
    renderizar(pedido({ modalidad: 'LLEVAR', pago_preferido: 'YAPE' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Pago y voucher' }));
    const caja = await screen.findByTestId('sin-captura');
    expect(caja).toHaveTextContent('Sin captura (opcional)');
    expect(within(caja).getByRole('button', { name: 'Subir captura' })).toBeInTheDocument();
  });

  it('con efectivo no ofrece subir captura', async () => {
    renderizar(pedido({ modalidad: 'LLEVAR', pago_preferido: 'EFECTIVO' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Pago y voucher' }));
    await waitFor(() => expect(vouchersApi.listarVouchers).toHaveBeenCalled());
    expect(screen.queryByTestId('sin-captura')).toBeNull();
  });

  it('la capa Entrega trae el celular con Copiar y el historial plegado hasta que se abre', () => {
    const escribir = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: escribir } });
    renderizar(pedido({ modalidad: 'LLEVAR', cliente_telefono: '987654321' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Cliente y entrega' }));
    expect(screen.getByText('987654321')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(escribir).toHaveBeenCalledWith('987654321');

    const boton = screen.getByRole('button', { name: /Historial y auditoría/ });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Pasó a preparando')).toBeNull();
    fireEvent.click(boton);
    expect(screen.getByText('Pasó a preparando')).toBeInTheDocument();
  });

  it('delivery: ruta del repartidor con sus cuatro pasos', () => {
    renderizar(
      pedido({
        modalidad: 'DELIVERY',
        estado: 'EN_CAMINO',
        repartidor_party_id: 7,
        entrega_direccion: 'Av. Lima 123',
        entrega_lat: -12.05,
        entrega_lng: -77.04,
        entrega_referencia: 'Portón negro',
      }),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Cliente y entrega' }));
    const ruta = screen.getByTestId('ruta-repartidor');
    expect(within(ruta).getByTestId('ruta-asignado')).toHaveAttribute('data-hecho', 'si');
    expect(within(ruta).getByTestId('ruta-salió')).toHaveAttribute('data-hecho', 'si');
    expect(within(ruta).getByTestId('ruta-llegó')).toHaveAttribute('data-hecho', 'no');
    expect(within(ruta).getByTestId('ruta-entregado')).toHaveAttribute('data-hecho', 'no');
    expect(screen.getAllByText('Av. Lima 123').length).toBeGreaterThan(0);
    expect(screen.getByText('Ref.: Portón negro')).toBeInTheDocument();
    expect(screen.queryByTestId('plano-mesa-resaltada')).toBeNull();
  });

  it('para llevar no hay croquis', () => {
    renderizar(pedido({ modalidad: 'LLEVAR', mesa_nombre: null }));
    fireEvent.click(screen.getByRole('tab', { name: 'Cliente y entrega' }));
    expect(screen.getByText('Recoge en el local.')).toBeInTheDocument();
    expect(screen.queryByTestId('plano-mesa-resaltada')).toBeNull();
  });
});

describe('Barra de acciones fija', () => {
  it('por cobrar: Registrar cobro con el total, Imprimir y Anular con aria-label', () => {
    renderizar(pedido({ modalidad: 'LLEVAR', estado: 'LISTO', repartidor_party_id: 1 }));
    expect(screen.getByRole('button', { name: 'Registrar cobro S/ 40.00' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Entregar al cliente y cerrar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Imprimir etiquetas y ticket' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anular pedido' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Repetir este pedido' })).toBeInTheDocument();
  });

  it('en mesa ofrece la precuenta y «Ya lo llevé a la mesa»; Imprimir abre ticket, etiquetas y comprobante', () => {
    renderizar(pedido());
    expect(screen.getByRole('button', { name: 'Sacar precuenta (el cajero cobra)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ya lo llevé a la mesa' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir etiquetas y ticket' }));
    const panel = screen.getByRole('dialog', { name: 'Impresión del pedido' });
    expect(within(panel).getByRole('tab', { name: 'Ticket de cocina' })).toBeInTheDocument();
    expect(within(panel).getByRole('tab', { name: 'Etiquetas' })).toBeInTheDocument();
    expect(within(panel).getByRole('tab', { name: 'Comprobante' })).toBeInTheDocument();
    expect(within(panel).getByText(/COMANDA CP-W100/)).toBeInTheDocument();
  });

  it('pagado: sin Registrar cobro y el botón de anular dice «Anular cobro»', () => {
    renderizar(pedido({ modalidad: 'LLEVAR', pago_estado: 'PAGADO', estado: 'ENTREGADO', cobro_vigente_id: 5 }));
    expect(screen.queryByRole('button', { name: /Registrar cobro/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Anular cobro' })).toBeInTheDocument();
  });

  it('por confirmar: Confirmar pedido y pago y Rechazar', () => {
    renderizar(pedido({ modalidad: 'LLEVAR', estado: 'COLA', canal: 'CARTA' }));
    expect(screen.getByRole('button', { name: 'Confirmar pedido y pago' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
  });
});

describe('delivery por confirmar se cobra al entregar', () => {
  it('efectivo: el botón es «Confirmar pedido» y el aviso dice que no bloquea', () => {
    renderizar(pedido({ modalidad: 'DELIVERY', estado: 'NUEVO', canal: 'CARTA', pago_preferido: 'EFECTIVO', paga_con: 50 }));
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar pedido y pago' })).toBeNull();
  });

  it('digital: se mantiene «Confirmar pedido y pago»', () => {
    renderizar(pedido({ modalidad: 'DELIVERY', estado: 'NUEVO', canal: 'CARTA', pago_preferido: 'YAPE' }));
    expect(screen.getByRole('button', { name: 'Confirmar pedido y pago' })).toBeInTheDocument();
  });
});

describe('Croquis del pedido de mesa', () => {
  const pisos = {
    pisos: [
      {
        id: 'piso-1',
        nombre: 'Primer piso',
        activo: true,
        cuadriculaAncho: 10,
        cuadriculaAlto: 6,
        mesas: [
          { id: 'm1', pisoId: 'piso-1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 4, x: 0, y: 0, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' },
          { id: 'm3', pisoId: 'piso-1', tipo: 'MESA', numero: 3, nombre: 'Mesa 3', asientos: 4, x: 4, y: 2, ancho: 2, alto: 2, activo: true, estado: 'OCUPADA', pedido: { id: 'p-1', codigo: 'CP-W100', mozo: 'Ana' } },
        ],
      },
      { id: 'piso-2', nombre: 'Terraza', activo: true, cuadriculaAncho: 8, cuadriculaAlto: 5, mesas: [{ id: 'm9', pisoId: 'piso-2', tipo: 'MESA', numero: 9, nombre: 'Mesa 9', asientos: 2, x: 1, y: 1, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' }] },
    ],
  };

  it('con permiso de plano resalta la mesa del pedido (anillo y etiqueta) en su piso', async () => {
    permisos = ['plano/ver'];
    vi.spyOn(salonApi, 'obtenerMesas').mockResolvedValue(pisos as any);
    renderizar(pedido());
    fireEvent.click(screen.getByRole('tab', { name: 'Cliente y entrega' }));
    const croquis = await screen.findByTestId('plano-mesa-resaltada');
    expect(within(croquis).getByText('Mesa 3 · Primer piso')).toBeInTheDocument();
    expect(within(croquis).getAllByTestId('etiqueta-mesa-resaltada')).toHaveLength(1);
    expect(within(croquis).getByTestId('elemento-plano-m3').style.boxShadow).toContain('var(--cp-orange)');
    expect(within(croquis).getByTestId('elemento-plano-m1').style.boxShadow).not.toContain('var(--cp-orange)');
    // Con varios pisos se ofrece ver el piso completo, con los pisos para elegir
    fireEvent.click(within(croquis).getByRole('button', { name: 'Ver piso completo' }));
    expect(within(croquis).getByRole('button', { name: 'Terraza' })).toBeInTheDocument();
  });

  it('sin permiso de plano solo muestra el texto de la mesa y no pide el plano', () => {
    const mesas = vi.spyOn(salonApi, 'obtenerMesas').mockResolvedValue(pisos as any);
    render(<PlanoMesaResaltada pedidoId="p-1" mesaNombre="Mesa 3" />);
    expect(screen.getByTestId('mesa-texto')).toHaveTextContent('Mesa 3');
    expect(mesas).not.toHaveBeenCalled();
  });

  it('si el plano falla muestra solo «Mesa N»', async () => {
    permisos = ['plano/ver'];
    vi.spyOn(salonApi, 'obtenerMesas').mockRejectedValue(new Error('500'));
    render(<PlanoMesaResaltada pedidoId="otro" mesaNombre="7" />);
    expect(await screen.findByTestId('mesa-texto')).toHaveTextContent('Mesa 7');
  });
});
