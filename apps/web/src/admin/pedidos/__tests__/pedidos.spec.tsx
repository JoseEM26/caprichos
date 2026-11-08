import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PedidosAdminView } from '../PedidosAdminView';
import { ModalCobrar } from '../ModalCobrar';
import { ModalAnular } from '../ModalAnular';
import { pedidosApi, Pedido } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

// Mock de audio para evitar excepciones en jsdom
vi.mock('../audioAlerta', () => ({
  reproducirCampana: vi.fn(),
}));


// El ADMIN no ve el código del supervisor: estas pruebas de código se hacen como CAJERO.
const comoCajero = () => {
  const actual = vi.mocked(sesionModulo.useSesion)();
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ ...actual, usuario: { partyId: '3', nombres: 'Cajera', rol: 'CAJERO' } } as any);
};

// La vista de la lista ahora es un combo «Ver pedidos»: lo abre y devuelve la opción buscada
async function opcionVer(nombre: RegExp) {
  const boton = await screen.findByRole('button', { name: /^Ver pedidos:/ });
  if (boton.getAttribute('aria-expanded') !== 'true') fireEvent.click(boton);
  return screen.getByRole('option', { name: nombre });
}

describe('Ola F4: Pedidos y Caja', () => {
  const socketCallbacks: Record<string, ((datos: any) => void)[]> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    // Limpiar callbacks de socket
    for (const key of Object.keys(socketCallbacks)) {
      delete socketCallbacks[key];
    }

    // Mock de useSesion
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: ['caja/ver', 'caja/cobrar', 'pedidos/ver', 'pedidos/cambiar_estado', 'pedidos/anular'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    });

    // Mock de useEventos para registrar callbacks simulando Socket.IO
    vi.spyOn(socketModulo, 'useEventos').mockImplementation((evento, cb) => {
      if (!socketCallbacks[evento]) {
        socketCallbacks[evento] = [];
      }
      socketCallbacks[evento].push(cb);
    });
  });

  const pedidosPrueba: Pedido[] = [
    {
      id: '1',
      codigo: 'CP-001',
      canal: 'CARTA',
      modalidad: 'DELIVERY',
      estado: 'COLA',
      pago_estado: 'PENDIENTE',
      total: '45.00',
      subtotal: '40.00',
      descuento: '0',
      cliente_nombre: 'Ana Lopez',
      creado_en: '2026-10-21T18:00:00Z',
      minutosEspera: 10,
      color: 'verde',
    },
    {
      id: '2',
      codigo: 'CP-002',
      canal: 'MOZO',
      modalidad: 'MESA',
      estado: 'PREPARANDO',
      pago_estado: 'PAGADO',
      total: '30.00',
      subtotal: '30.00',
      descuento: '0',
      cliente_nombre: 'Mesa 3',
      creado_en: '2026-10-21T18:05:00Z',
      minutosEspera: 36,
      color: 'naranja',
    },
    {
      id: '3',
      codigo: 'CP-003',
      canal: 'BOT',
      modalidad: 'RECOGER',
      estado: 'LISTO',
      pago_estado: 'PAGADO',
      total: '25.00',
      subtotal: '25.00',
      descuento: '0',
      cliente_nombre: 'Carlos Ruiz',
      creado_en: '2026-10-21T17:30:00Z',
      minutosEspera: 55,
      color: 'rojo',
    },
    {
      id: '4',
      codigo: 'CP-004',
      canal: 'CARTA',
      modalidad: 'DELIVERY',
      estado: 'EN_CAMINO',
      pago_estado: 'PAGADO',
      total: '50.00',
      subtotal: '45.00',
      descuento: '0',
      cliente_nombre: 'Diana Prado',
      creado_en: '2026-10-21T17:15:00Z',
      minutosEspera: 70,
      color: 'rojo',
    },
    {
      id: '5',
      codigo: 'CP-005',
      canal: 'TELEFONO',
      modalidad: 'LLEVAR',
      estado: 'ENTREGADO',
      pago_estado: 'PAGADO',
      total: '18.00',
      subtotal: '18.00',
      descuento: '0',
      cliente_nombre: 'Elena Castro',
      creado_en: '2026-10-21T16:00:00Z',
      minutosEspera: 120,
      color: 'rojo',
    },
    {
      id: '6',
      codigo: 'CP-006',
      canal: 'CARTA',
      modalidad: 'DELIVERY',
      estado: 'ANULADO',
      pago_estado: 'PENDIENTE',
      total: '22.00',
      subtotal: '22.00',
      descuento: '0',
      cliente_nombre: 'Fernando Gil',
      creado_en: '2026-10-21T15:00:00Z',
      minutosEspera: 180,
      color: 'rojo',
    },
  ];

  it('1. Pestañas y conteos se calculan y muestran correctamente', async () => {
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({
      total: pedidosPrueba.length,
      pagina: 1,
      limite: 100,
      items: pedidosPrueba,
    });
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({
      caja: {
        id: '1',
        fecha: '2026-10-21',
        apertura: 50,
        estado: 'ABIERTA',
        abierta_por: '1',
        cerrada_por: null,
        cerrada_en: null,
      },
      abierta: true,
      totalesPorMedio: { EFECTIVO: 30 },
      resumen: {
        apertura: 50,
        cobrosEfectivo: 30,
        vueltosEfectivo: 0,
        ingresos: 0,
        egresos: 0,
      },
      efectivoEsperado: 80,
    });

    render(<PedidosAdminView />);

    await waitFor(async () => {
      expect(await opcionVer(/^Por confirmar\s*1$/i)).toBeInTheDocument();
    });

    // Verificar conteos en cada pestaña del mockup:
    // Por confirmar: 1 (CP-001)
    expect(screen.getByRole('option', { name: /^Por confirmar\s*1$/i })).toBeInTheDocument();
    // Pago por coordinar: 0
    expect(screen.getByRole('option', { name: /^Pago por coordinar\s*0$/i })).toBeInTheDocument();
    // En curso: 3 (CP-002 PREPARANDO + CP-003 LISTO + CP-004 EN_CAMINO)
    expect(screen.getByRole('option', { name: /^En curso\s*3$/i })).toBeInTheDocument();
    // Cerrados: 2 (CP-005 ENTREGADO + CP-006 ANULADO)
    expect(screen.getByRole('option', { name: /^Cerrados\s*2$/i })).toBeInTheDocument();

    // Cambiar a pestaña En curso y verificar que selecciona automáticamente CP-002 y ya no muestra CP-001
    fireEvent.click(screen.getByRole('option', { name: /^En curso\s*3$/i }));
    expect(screen.getAllByText('CP-002').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('CP-001')).not.toBeInTheDocument();
  });

  it('2. El pedido nuevo llegado por socket aparece sin recargar la página', async () => {
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({
      total: pedidosPrueba.length,
      pagina: 1,
      limite: 100,
      items: pedidosPrueba,
    });
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({
      caja: null,
      abierta: false,
      totalesPorMedio: {},
      resumen: { apertura: 0, cobrosEfectivo: 0, vueltosEfectivo: 0, ingresos: 0, egresos: 0 },
      efectivoEsperado: 0,
    });

    const nuevoPedidoSocket: Pedido = {
      id: '99',
      codigo: 'CP-NEW99',
      canal: 'CARTA',
      modalidad: 'DELIVERY',
      estado: 'COLA',
      pago_estado: 'PENDIENTE',
      total: '88.00',
      subtotal: '88.00',
      descuento: '0',
      cliente_nombre: 'Mariana Gomez',
      creado_en: new Date().toISOString(),
      minutosEspera: 0,
      color: 'verde',
    };

    vi.spyOn(pedidosApi, 'obtenerPorId').mockResolvedValue(nuevoPedidoSocket);

    render(<PedidosAdminView />);

    await waitFor(() => {
      expect(screen.getByText('CP-001')).toBeInTheDocument();
    });

    // Emitir simulación del evento 'pedido:nuevo' desde el socket
    const callbacks = socketCallbacks['pedido:nuevo'] || [];
    expect(callbacks.length).toBeGreaterThan(0);

    // Invocamos el listener
    callbacks[0]({ id: '99', codigo: 'CP-NEW99' });

    // Verificar que el nuevo pedido aparece sin recargar
    await waitFor(() => {
      expect(screen.getByText('CP-NEW99')).toBeInTheDocument();
      expect(screen.getByText(/Mariana Gomez/i)).toBeInTheDocument();
    });
  });

  it('3. Confirmar antes de cobrar y antes de anular', async () => {
    comoCajero();
    const pedidoCobro: Pedido = {
      id: '10',
      codigo: 'CP-010',
      canal: 'MOZO',
      modalidad: 'MESA',
      estado: 'PREPARANDO',
      pago_estado: 'PENDIENTE',
      total: '40.00',
      subtotal: '40.00',
      descuento: '0',
      creado_en: '2026-10-21T18:00:00Z',
    };

    const spyCobrar = vi.spyOn(pedidosApi, 'cobrar').mockResolvedValue({});
    const spyAnular = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue(pedidoCobro);

    // A. Cobro: requiere confirmar Sí/No
    const alCobrarExitoso = vi.fn();
    const { unmount: unmountCobro } = render(
      <ModalCobrar
        pedido={pedidoCobro}
        alCerrar={vi.fn()}
        alCobrarExitoso={alCobrarExitoso}
      />,
    );

    const btnCobrar = screen.getByRole('button', { name: /Registrar cobro/i });
    fireEvent.click(btnCobrar);

    // Debe abrirse el diálogo modal de confirmación
    const modalConfirmarCobro = screen.getByRole('dialog', { name: /Registrar el cobro de CP-010/i });
    expect(modalConfirmarCobro).toBeInTheDocument();
    expect(screen.getByText(/Registrar el cobro de CP-010/i)).toBeInTheDocument();

    // La API NO se ha llamado aún
    expect(spyCobrar).not.toHaveBeenCalled();

    // Confirmar con el botón Sí (en ModalCobrar tiene textoSi="Cobrar")
    const btnSiCobrar = screen.getByRole('button', { name: /^Cobrar$/i });
    fireEvent.click(btnSiCobrar);

    await waitFor(() => {
      expect(spyCobrar).toHaveBeenCalledTimes(1);
    });

    unmountCobro();

    // B. Anular: requiere confirmar Sí/No
    const alAnularExitoso = vi.fn();
    render(
      <ModalAnular
        pedidoId="10"
        codigoPedido="CP-010"
        alCerrar={vi.fn()}
        alAnularExitoso={alAnularExitoso}
      />,
    );

    // Ingresar motivo y código válido
    const inputMotivo = screen.getByLabelText(/Motivo detallado/i);
    fireEvent.change(inputMotivo, { target: { value: 'Cliente desistió de esperar' } });

    const inputPin = screen.getByLabelText(/Código del supervisor/i);
    fireEvent.change(inputPin, { target: { value: '123456' } });

    const btnAnular = screen.getByRole('button', { name: /Confirmar anulación/i });
    fireEvent.click(btnAnular);

    // Debe mostrarse el diálogo Confirmar
    expect(screen.getByRole('dialog', { name: /¿Anular el pedido CP-010\?/i })).toBeInTheDocument();
    expect(screen.getByText(/¿Anular el pedido CP-010\?/i)).toBeInTheDocument();

    // La API NO se ha llamado aún
    expect(spyAnular).not.toHaveBeenCalled();

    // Confirmar con Sí
    const btnSiAnular = screen.getByRole('button', { name: /Sí, anular/i });
    fireEvent.click(btnSiAnular);

    await waitFor(() => {
      expect(spyAnular).toHaveBeenCalledTimes(1);
    });
  });

  it('4. El código no queda en el estado tras enviar la anulación', async () => {
    comoCajero();
    vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);

    render(
      <ModalAnular
        pedidoId="10"
        codigoPedido="CP-010"
        alCerrar={vi.fn()}
        alAnularExitoso={vi.fn()}
      />,
    );

    const inputMotivo = screen.getByLabelText(/Motivo detallado/i);
    fireEvent.change(inputMotivo, { target: { value: 'Cliente no llegó a recoger' } });

    const inputPin = screen.getByLabelText(/Código del supervisor/i) as HTMLInputElement;
    fireEvent.change(inputPin, { target: { value: '654321' } });
    expect(inputPin.value).toBe('654321');

    const btnAnular = screen.getByRole('button', { name: /Confirmar anulación/i });
    fireEvent.click(btnAnular);

    // Al confirmar en el diálogo
    const btnSi = screen.getByRole('button', { name: /Sí, anular/i });
    fireEvent.click(btnSi);

    // Inmediatamente tras enviar, el campo del código queda en blanco (limpiado del estado)
    await waitFor(() => {
      expect(inputPin.value).toBe('');
    });
  });

  it('5. Pago mixto que no cuadra bloquea el envío', async () => {
    const pedidoCobro: Pedido = {
      id: '20',
      codigo: 'CP-020',
      canal: 'CARTA',
      modalidad: 'DELIVERY',
      estado: 'COLA',
      pago_estado: 'PENDIENTE',
      total: '50.00',
      subtotal: '50.00',
      descuento: '0',
      creado_en: '2026-10-21T18:00:00Z',
    };

    render(
      <ModalCobrar
        pedido={pedidoCobro}
        alCerrar={vi.fn()}
        alCobrarExitoso={vi.fn()}
      />,
    );

    // Cambiar el primer pago a 20.00
    const inputsMonto = screen.getAllByLabelText(/Monto \(S\/\)/i);
    fireEvent.change(inputsMonto[0], { target: { value: '20.00' } });

    // Agregar segundo pago
    const btnAgregar = screen.getByRole('button', { name: /\+ Pagar parte con otro medio/i });
    fireEvent.click(btnAgregar);

    // Configurar segundo pago en 20.00 (Total = 40.00, falta 10.00)
    const inputsMonto2 = screen.getAllByLabelText(/Monto \(S\/\)/i);
    fireEvent.change(inputsMonto2[1], { target: { value: '20.00' } });

    // Debe mostrar que falta cobrar S/ 10.00
    expect(screen.getByText(/Falta cobrar S\/ 10.00\./i)).toBeInTheDocument();

    // El botón de registrar cobro debe estar deshabilitado
    const btnCobrar = screen.getByRole('button', { name: /Registrar cobro/i });
    expect(btnCobrar).toBeDisabled();

    // Si corregimos el segundo pago a 30.00 (20 + 30 = 50.00 cuadra)
    fireEvent.change(inputsMonto2[1], { target: { value: '30.00' } });
    expect(screen.getByText(/Cuadra con el total\./i)).toBeInTheDocument();
    // El segundo medio por defecto es Yape (digital): la captura es opcional, así que cuadrar basta para cobrar.
    expect(btnCobrar).not.toBeDisabled();
  });

  it('6. El vuelto se calcula bien en pantalla', () => {
    const pedidoCobro: Pedido = {
      id: '30',
      codigo: 'CP-030',
      canal: 'MOZO',
      modalidad: 'MESA',
      estado: 'PREPARANDO',
      pago_estado: 'PENDIENTE',
      total: '35.50',
      subtotal: '35.50',
      descuento: '0',
      creado_en: '2026-10-21T18:00:00Z',
    };

    render(
      <ModalCobrar
        pedido={pedidoCobro}
        alCerrar={vi.fn()}
        alCobrarExitoso={vi.fn()}
      />,
    );

    // Pago en Efectivo por defecto por 35.50
    // Ingresamos recibido = 50.00
    const inputRecibido = screen.getByLabelText(/Con cuánto paga el cliente/i);
    fireEvent.change(inputRecibido, { target: { value: '50.00' } });

    // Vuelto esperado: 50.00 - 35.50 = 14.50
    expect(screen.getByText(/Vuelto: S\/ 14.50/i)).toBeInTheDocument();

    // Cambiamos recibido a 100.00 -> Vuelto esperado: 100 - 35.50 = 64.50
    fireEvent.change(inputRecibido, { target: { value: '100.00' } });
    expect(screen.getByText(/Vuelto: S\/ 64.50/i)).toBeInTheDocument();
  });
});
