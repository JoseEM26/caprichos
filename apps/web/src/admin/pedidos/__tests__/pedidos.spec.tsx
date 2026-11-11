import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PedidosAdminView } from '../PedidosAdminView';
import { ModalCobrar } from '../ModalCobrar';
import { ModalAnular } from '../ModalAnular';
import { pedidosApi, Pedido } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import { abrirFiltros } from './abrirFiltros';

// Mock de audio para evitar excepciones en jsdom
vi.mock('../audioAlerta', () => ({
  reproducirCampana: vi.fn(),
}));


// Ya no hay código de supervisor: estas pruebas se hacen como CAJERO.
const comoCajero = () => {
  const actual = vi.mocked(sesionModulo.useSesion)();
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ ...actual, usuario: { partyId: '3', nombres: 'Cajera', rol: 'CAJERO' } } as any);
};

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

  it('1. Los 4 filtros y sus contadores se calculan y filtran la lista', async () => {
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({
      total: pedidosPrueba.length,
      pagina: 1,
      limite: 100,
      items: pedidosPrueba,
    });
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({
      caja: null,
      abierta: true,
      totalesPorMedio: {},
      resumen: { apertura: 0, cobrosEfectivo: 0, vueltosEfectivo: 0, ingresos: 0, egresos: 0 },
      efectivoEsperado: 0,
    });

    render(<PedidosAdminView />);

    await screen.findByText('CP-001');
    abrirFiltros();
    const filtros = screen.getByRole('navigation', { name: 'Estado de los pedidos' });
    // Activos: CP-001 (por confirmar, delivery), CP-002 (preparando), CP-003 (listo), CP-004 (en camino, delivery)
    expect(within(filtros).getByRole('button', { name: /^Todo/ })).toHaveTextContent('Todo4');
    expect(within(filtros).getByRole('button', { name: /^En preparación/ })).toHaveTextContent('En preparación1');
    expect(within(filtros).getByRole('button', { name: /^Listos/ })).toHaveTextContent('Listos1');
    expect(within(filtros).getByRole('button', { name: /^A domicilio/ })).toHaveTextContent('A domicilio2');
    // Los cerrados no se mezclan en «Todo»
    expect(screen.queryByText('CP-005')).not.toBeInTheDocument();
    expect(screen.queryByText('CP-006')).not.toBeInTheDocument();
    expect(screen.getByText('CP-001')).toBeInTheDocument();

    fireEvent.click(within(filtros).getByRole('button', { name: /^En preparación/ }));
    expect(screen.getByText('CP-002')).toBeInTheDocument();
    expect(screen.queryByText('CP-001')).not.toBeInTheDocument();

    fireEvent.click(within(filtros).getByRole('button', { name: /^A domicilio/ }));
    expect(screen.getByText('CP-001')).toBeInTheDocument();
    expect(screen.getByText('CP-004')).toBeInTheDocument();
    expect(screen.queryByText('CP-003')).not.toBeInTheDocument();
  });

  it('1b. Los cerrados salen del grupo Estado de Filtros, con su chip removible', async () => {
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({
      total: pedidosPrueba.length,
      pagina: 1,
      limite: 100,
      items: pedidosPrueba,
    });
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);

    render(<PedidosAdminView />);
    await screen.findByText('CP-001');

    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Estado:/ }));
    fireEvent.click(screen.getByRole('option', { name: /^Cerrados/ }));

    expect(screen.getByText('CP-005')).toBeInTheDocument();
    expect(screen.getByText('CP-006')).toBeInTheDocument();
    expect(screen.queryByText('CP-001')).not.toBeInTheDocument();
    // Sin botón de acción en los cerrados
    expect(screen.queryByRole('button', { name: /^(?!Reimprimir).*CP-005$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Estado de los pedidos' })).toHaveTextContent('Todo2');

    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro Cerrados' }));
    expect(screen.getByText('CP-001')).toBeInTheDocument();
    expect(screen.queryByText('CP-005')).not.toBeInTheDocument();
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

    // Ingresar solo el motivo: no hay campo de código de supervisor
    const inputMotivo = screen.getByLabelText(/Motivo detallado/i);
    fireEvent.change(inputMotivo, { target: { value: 'Cliente desistió de esperar' } });
    expect(screen.queryByLabelText(/Código del supervisor/i)).toBeNull();

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

  it('4. La anulación se envía solo con el motivo, sin ningún código de supervisor', async () => {
    comoCajero();
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);

    render(
      <ModalAnular
        pedidoId="10"
        codigoPedido="CP-010"
        alCerrar={vi.fn()}
        alAnularExitoso={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Motivo detallado/i), { target: { value: 'Cliente no llegó a recoger' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar anulación/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, anular/i }));

    await waitFor(() => expect(cambiar).toHaveBeenCalledWith('10', 'ANULADO', 'Cliente no llegó a recoger'));
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
