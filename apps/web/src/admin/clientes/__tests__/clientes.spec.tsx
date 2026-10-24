import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientesAdminView } from '../ClientesAdminView';
import { ModalNuevoCliente } from '../ModalNuevoCliente';
import { ModalFichaCliente } from '../ModalFichaCliente';
import { ModalAjustarPuntos } from '../ModalAjustarPuntos';
import { ModalEditarCliente } from '../ModalEditarCliente';
import * as clientesApi from '../clientesApi';
import type { ClienteItem } from '../tipos';
import { PuntosCanje } from '../../../carta/cuenta/PuntosCanje';
import { NotificacionesCliente } from '../../../carta/cuenta/NotificacionesCliente';
import * as cuentaModulo from '../../../carta/cuenta/CuentaContext';
import { api } from '../../../comun/api';

const mockClientes: ClienteItem[] = [
  {
    id: '100',
    nombre: 'Ana Pérez',
    tipo: 'Persona',
    dni: '4521****',
    telefono: '999 888 777',
    correo: 'ana@ejemplo.com',
    cumpleanos: '14/03',
    pedidos: 18,
    puntos: 180,
    creditoPersonal: false,
    envioFijo: null,
    descuentoEnvio: null,
    activo: true,
  },
  {
    id: '101',
    nombre: 'Constructora Andina',
    tipo: 'Empresa',
    dni: '2055****',
    telefono: '01 555 0202',
    correo: 'admin@ejemplo.com',
    cumpleanos: '—',
    pedidos: 6,
    puntos: 0,
    creditoPersonal: false,
    envioFijo: null,
    descuentoEnvio: null,
    activo: false,
  },
];

describe('Admin ▸ Clientes UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(clientesApi, 'listarClientes').mockResolvedValue({
      items: mockClientes,
      total: 2,
      pagina: 1,
      paginas: 1,
    });

    vi.spyOn(clientesApi, 'obtenerFichaCliente').mockResolvedValue({
      id: '100',
      nombre: 'Ana Pérez',
      dni: '45218899',
      dniMascara: '4521****',
      telefono: '999 888 777',
      correo: 'ana@ejemplo.com',
      cumpleanos: '14/03',
      puntos: 180,
      pedidos: [
        {
          id: 'PED-01',
          modalidad: 'Delivery',
          estado: 'Entregado',
          total: 's/ 45.00',
          pago: 'Cobrado',
          fecha: '2026-10-15',
        },
      ],
    });

    vi.spyOn(clientesApi, 'listarHistorialPuntos').mockResolvedValue([
      {
        id: 'MOV-1',
        tipo: 'SUMA',
        puntos: 20,
        motivo: 'Acumulación por pedido PED-01',
        fecha: '2026-10-15T18:00:00Z',
        pedido: null,
      },
    ]);

    vi.spyOn(clientesApi, 'registrarClienteMostrador').mockResolvedValue({
      ok: true,
      partyId: '200',
    });

    vi.spyOn(clientesApi, 'editarCliente').mockResolvedValue({
      ok: true,
    });

    vi.spyOn(clientesApi, 'cambiarEstadoCliente').mockResolvedValue({
      ok: true,
      activo: false,
    });

    vi.spyOn(clientesApi, 'ajustarPuntos').mockResolvedValue({
      puntos: 15,
      nuevoSaldo: 195,
    });
  });

  it('renderiza la lista de clientes con la nota, botón nuevo cliente y filtros', async () => {
    render(<ClientesAdminView />);

    expect(screen.getByText(/Historial de quienes piden/i)).toBeInTheDocument();
    expect(screen.getByText('+ Nuevo cliente')).toBeInTheDocument();
    expect(screen.getByText('Comentarios de los clientes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar por nombre')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
      expect(screen.getByText('Constructora Andina')).toBeInTheDocument();
    });

    expect(screen.getByText('Desactivado')).toBeInTheDocument();
  });

  it('permite abrir y cerrar filtros por Tipo y Registro', async () => {
    render(<ClientesAdminView />);

    const btnFiltros = screen.getByRole('button', { name: /Filtros/i });
    fireEvent.click(btnFiltros);

    expect(screen.getByText('TIPO')).toBeInTheDocument();
    expect(screen.getByText('REGISTRO')).toBeInTheDocument();

    // Filtra por Empresa
    const btnEmpresa = screen.getByRole('button', { name: 'Empresa' });
    fireEvent.click(btnEmpresa);

    await waitFor(() => {
      expect(clientesApi.listarClientes).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'Empresa' })
      );
    });
  });

  it('permite abrir el modal de nuevo cliente, validar datos y confirmar registro', async () => {
    const alGuardarExitoso = vi.fn();
    const alCerrar = vi.fn();

    render(
      <ModalNuevoCliente
        abierto={true}
        alCerrar={alCerrar}
        alGuardarExitoso={alGuardarExitoso}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Nuevo cliente' })).toBeInTheDocument();

    const inputNombre = screen.getByLabelText(/Nombre \(obligatorio\)/i);
    const inputDni = screen.getByLabelText(/DNI o RUC \(obligatorio\)/i);
    const inputCumple = screen.getByLabelText(/Cumpleaños/i);

    fireEvent.change(inputNombre, { target: { value: 'Carlos Mendoza' } });
    fireEvent.change(inputDni, { target: { value: '87654321' } });
    fireEvent.change(inputCumple, { target: { value: '1990-05-20' } });

    // Intenta enviar sin consent
    const btnRegistrar = screen.getByRole('button', { name: 'Registrar cliente' });
    fireEvent.click(btnRegistrar);
    expect(screen.getByText(/El cliente debe aceptar que se guarden sus datos/i)).toBeInTheDocument();

    // Acepta datos
    const chkConsent = screen.getByRole('checkbox');
    fireEvent.click(chkConsent);

    fireEvent.click(btnRegistrar);

    // Diálogo de confirmación Sí / No
    expect(screen.getByText(/¿Registrar a Carlos Mendoza\?/i)).toBeInTheDocument();
    const btnSi = screen.getByRole('button', { name: 'Sí' });
    fireEvent.click(btnSi);

    await waitFor(() => {
      expect(clientesApi.registrarClienteMostrador).toHaveBeenCalledWith({
        nombre: 'Carlos Mendoza',
        dni: '87654321',
        cumpleanos: '1990-05-20',
        aceptaDatos: true,
      });
      expect(alGuardarExitoso).toHaveBeenCalled();
      expect(alCerrar).toHaveBeenCalled();
    });
  });

  it('permite abrir la ficha de cliente y muestra pedidos de este turno', async () => {
    render(
      <ModalFichaCliente
        abierto={true}
        cliente={mockClientes[0]}
        alCerrar={vi.fn()}
        alPuntosActualizados={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Historial del cliente' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('PED-01')).toBeInTheDocument();
      expect(screen.getByText(/Delivery · Entregado/i)).toBeInTheDocument();
      expect(screen.getByText('+20 pts')).toBeInTheDocument();
    });
  });

  it('permite ajustar puntos con motivo y confirmación Sí / No', async () => {
    const alAjustar = vi.fn();
    render(
      <ModalAjustarPuntos
        abierto={true}
        clienteId="100"
        clienteNombre="Ana Pérez"
        saldoActual={180}
        alCerrar={vi.fn()}
        alAjustarExitoso={alAjustar}
      />
    );

    const inputPts = screen.getByLabelText(/Cantidad de puntos/i);
    const inputMotivo = screen.getByLabelText(/Motivo del ajuste/i);

    fireEvent.change(inputPts, { target: { value: '15' } });
    fireEvent.change(inputMotivo, { target: { value: 'Cortesía por aniversario' } });

    const btnAjustar = screen.getByRole('button', { name: 'Ajustar puntos' });
    fireEvent.click(btnAjustar);

    expect(screen.getByText(/¿Sumar 15 puntos a Ana Pérez\?/i)).toBeInTheDocument();

    const btnSi = screen.getByRole('button', { name: 'Sí' });
    fireEvent.click(btnSi);

    await waitFor(() => {
      expect(clientesApi.ajustarPuntos).toHaveBeenCalledWith('100', {
        puntos: 15,
        tipo: 'SUMA',
        motivo: 'Cortesía por aniversario',
      });
      expect(alAjustar).toHaveBeenCalledWith(195);
    });
  });

  it('permite editar cliente y guardar cambios con confirmación', async () => {
    const alGuardar = vi.fn();
    render(
      <ModalEditarCliente
        abierto={true}
        cliente={mockClientes[0]}
        alCerrar={vi.fn()}
        alGuardarExitoso={alGuardar}
      />
    );

    const inputNombre = screen.getByDisplayValue('Ana Pérez');
    fireEvent.change(inputNombre, { target: { value: 'Ana Pérez Gómez' } });

    const btnGuardar = screen.getByRole('button', { name: 'Guardar' });
    fireEvent.click(btnGuardar);

    expect(screen.getByText(/¿Guardar los cambios\?/i)).toBeInTheDocument();

    const btnSi = screen.getByRole('button', { name: 'Sí' });
    fireEvent.click(btnSi);

    await waitFor(() => {
      expect(clientesApi.editarCliente).toHaveBeenCalledWith('100', expect.objectContaining({
        nombre: 'Ana Pérez Gómez',
      }));
      expect(alGuardar).toHaveBeenCalled();
    });
  });
});

describe('Carta ▸ PuntosCanje y NotificacionesCliente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PuntosCanje: muestra mensaje y botón de ingresar si no hay cliente logueado', () => {
    const abrirPanel = vi.fn();
    vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
      cliente: null,
      panelAbierto: false,
      abrirPanel,
      cerrarPanel: vi.fn(),
      ingresar: vi.fn(),
      registrar: vi.fn(),
      actualizarPerfil: vi.fn(),
      subirFoto: vi.fn(),
      quitarFoto: vi.fn(),
      salir: vi.fn(),
      refrescar: vi.fn(),
    });

    render(<PuntosCanje totalPedido={50} puntosAplicados={0} alAplicar={vi.fn()} />);

    expect(screen.getByText(/Ingresa con tu cuenta para usar tus puntos/i)).toBeInTheDocument();
    const btnIngresar = screen.getByRole('button', { name: 'Ingresar con mi DNI' });
    fireEvent.click(btnIngresar);
    expect(abrirPanel).toHaveBeenCalled();
  });

  it('PuntosCanje: permite aplicar puntos con tope del total y saldo', () => {
    const alAplicar = vi.fn();
    vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
      cliente: {
        partyId: '100',
        nombre: 'Ana',
        dniMascara: '4521****',
        correo: 'ana@ejemplo.com',
        telefono: '912345678',
        fotoUrl: null,
        cumpleanos: '14/03',
        puntos: 30,
      },
      panelAbierto: false,
      abrirPanel: vi.fn(),
      cerrarPanel: vi.fn(),
      ingresar: vi.fn(),
      registrar: vi.fn(),
      actualizarPerfil: vi.fn(),
      subirFoto: vi.fn(),
      quitarFoto: vi.fn(),
      salir: vi.fn(),
      refrescar: vi.fn(),
    });

    render(<PuntosCanje totalPedido={25} puntosAplicados={0} alAplicar={alAplicar} />);

    expect(screen.getByText(/Pides con la cuenta de/i)).toBeInTheDocument();
    expect(screen.getByText(/puntos disponibles/i)).toBeInTheDocument();

    const input = screen.getByLabelText(/¿Cuántos puntos deseas usar\?/i);
    fireEvent.change(input, { target: { value: '20' } });

    const btnAplicar = screen.getByRole('button', { name: 'Aplicar' });
    fireEvent.click(btnAplicar);

    expect(alAplicar).toHaveBeenCalledWith(20);
  });

  it('NotificacionesCliente: carga y muestra cupones de cumpleaños', async () => {
    vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
      cliente: {
        partyId: '100',
        nombre: 'Ana',
        dniMascara: '4521****',
        correo: 'ana@ejemplo.com',
        telefono: '912345678',
        fotoUrl: null,
        cumpleanos: '14/03',
        puntos: 30,
      },
      panelAbierto: false,
      abrirPanel: vi.fn(),
      cerrarPanel: vi.fn(),
      ingresar: vi.fn(),
      registrar: vi.fn(),
      actualizarPerfil: vi.fn(),
      subirFoto: vi.fn(),
      quitarFoto: vi.fn(),
      salir: vi.fn(),
      refrescar: vi.fn(),
    });

    vi.spyOn(api, 'get').mockResolvedValue({
      notificaciones: [
        {
          id: 'bday-1',
          t: '¡Feliz cumpleaños, Ana!',
          x: 'Te regalamos un cupón de 20% de descuento.',
          fresh: true,
          hasTicket: true,
          tCode: 'CUMPLE-ANA',
          tNote: '20% de descuento en tu pedido',
          tVence: '31/10/2026',
        },
      ],
    });

    render(<NotificacionesCliente abierto={true} alCerrar={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('¡Feliz cumpleaños, Ana!')).toBeInTheDocument();
      expect(screen.getByText('CUMPLE-ANA')).toBeInTheDocument();
    });
  });
});

