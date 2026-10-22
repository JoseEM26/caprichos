import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ComandaTarjeta, obtenerColorMinutos } from '../ComandaTarjeta';
import { CocinaAdminView } from '../CocinaAdminView';
import { ModalAgotados } from '../ModalAgotados';
import { PanelAltaDemanda } from '../PanelAltaDemanda';
import { HistorialView } from '../HistorialView';
import { DespachoView } from '../DespachoView';
import { PantallaCocinaView } from '../../../pantalla/PantallaCocinaView';
import type {
  Comanda,
  AltaDemandaEstado,
  HistorialComanda,
  PedidoDespacho,
} from '../cocinaTipos';
import * as cocinaApi from '../cocinaApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

// Mock de audio para jsdom
vi.mock('../audioAlerta', () => ({
  reproducirCampanaCocina: vi.fn(),
  estaSilenciado: vi.fn().mockReturnValue(false),
  setSilenciado: vi.fn(),
}));

// Mock de react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('F5: Pantallas de Cocina', () => {
  const socketCallbacks: Record<string, ((datos: any) => void)[]> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    for (const key of Object.keys(socketCallbacks)) {
      delete socketCallbacks[key];
    }

    vi.spyOn(socketModulo, 'useEventos').mockImplementation((evento, cb) => {
      if (!socketCallbacks[evento]) {
        socketCallbacks[evento] = [];
      }
      socketCallbacks[evento].push(cb);
    });

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Cocinero Test', rol: 'COCINERO' },
      permisos: ['cocina/ver', 'cocina/despejar', 'cocina/devolver', 'cocina/agotar', 'cocina/demanda'],
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
  });

  const comandaEjemplo: Comanda = {
    id: '1-1',
    pedidoId: '1',
    areaId: '1',
    areaNombre: 'Cocina',
    ticket: 'CP-101',
    codigo: 'CP-101',
    canal: 'WEB',
    modalidad: 'DELIVERY',
    mesa: null,
    nota: 'Sin cebolla',
    minutos: 15,
    color: 'VERDE',
    creado_en: new Date(Date.now() - 15 * 60000).toISOString(),
    lineas: [
      {
        id: '10',
        nombre: 'Hamburguesa Clásica',
        cantidad: 1,
        tamano: 'Grande',
        sabor: null,
        opciones: ['Papas fritas'],
        personas: ['Carlos'],
        nota: 'Término medio',
      },
    ],
  };

  // 1. Color por tiempo (DT-69: <35 verde, 35..49 naranja, >=50 rojo)
  it('1. Color por tiempo: evalúa verde (<35), naranja (35..49) y rojo (>=50)', () => {
    expect(obtenerColorMinutos(10)).toBe('VERDE');
    expect(obtenerColorMinutos(25)).toBe('VERDE');
    expect(obtenerColorMinutos(34)).toBe('VERDE');
    expect(obtenerColorMinutos(35)).toBe('NARANJA');
    expect(obtenerColorMinutos(49)).toBe('NARANJA');
    expect(obtenerColorMinutos(50)).toBe('ROJO');
    expect(obtenerColorMinutos(75)).toBe('ROJO');

    const { unmount } = render(
      <ComandaTarjeta
        comanda={{
          ...comandaEjemplo,
          minutos: 20,
          color: 'VERDE',
          creado_en: new Date(Date.now() - 20 * 60000).toISOString(),
        }}
      />,
    );
    const tiempoVerde = screen.getByTestId('indicador-tiempo');
    expect(tiempoVerde.getAttribute('data-color')).toBe('VERDE');
    unmount();

    render(
      <ComandaTarjeta
        comanda={{
          ...comandaEjemplo,
          minutos: 40,
          color: 'NARANJA',
          creado_en: new Date(Date.now() - 40 * 60000).toISOString(),
        }}
      />,
    );
    const tiempoNaranja = screen.getByTestId('indicador-tiempo');
    expect(tiempoNaranja.getAttribute('data-color')).toBe('NARANJA');
  });

  // 2. La tarjeta no muestra teléfono ni dirección aunque lleguen en los datos (DT-81)
  it('2. La tarjeta no muestra teléfono ni dirección aunque lleguen en los datos', () => {
    const comandaConDatosPrivados: any = {
      ...comandaEjemplo,
      telefono: '999888777',
      cliente_telefono: '999888777',
      direccion: 'Av. Primavera 123 Dpto 4',
      entrega_direccion: 'Av. Primavera 123 Dpto 4',
      cliente_nombre: 'María Perez',
      cliente: 'María Perez',
    };

    render(<ComandaTarjeta comanda={comandaConDatosPrivados} />);

    expect(screen.getByText('CP-101')).toBeInTheDocument();
    expect(screen.getByText('Hamburguesa Clásica')).toBeInTheDocument();
    expect(screen.getByText(/Delivery/i)).toBeInTheDocument();

    expect(screen.queryByText(/999888777/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Primavera/)).not.toBeInTheDocument();
    expect(screen.queryByText(/María Perez/)).not.toBeInTheDocument();
  });

  // 3. Despejar pide Confirmar Sí/No antes de llamar a la API
  it('3. Despejar pide Confirmar Sí/No antes de llamar a la API', async () => {
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([
      { id: '1', nombre: 'Cocina', comandasPendientes: 1 },
    ]);
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([comandaEjemplo]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({
      activa: false,
      minutos: 0,
      pausa: false,
    });
    const spyDespejar = vi
      .spyOn(cocinaApi, 'despejarComanda')
      .mockResolvedValue({ ok: true });

    render(<CocinaAdminView />);

    await waitFor(() => {
      expect(screen.getByText('CP-101')).toBeInTheDocument();
    });

    const botonDespejar = screen.getByRole('button', { name: /^Despejar$/i });
    fireEvent.click(botonDespejar);

    // Diálogo de confirmación
    expect(
      screen.getByText(/¿Despejar comanda CP-101\?/i),
    ).toBeInTheDocument();
    expect(spyDespejar).not.toHaveBeenCalled();

    // Cancelar
    const botonCancelar = screen.getByRole('button', { name: /No, cancelar/i });
    fireEvent.click(botonCancelar);
    expect(spyDespejar).not.toHaveBeenCalled();

    // Confirmar
    fireEvent.click(botonDespejar);
    const botonConfirmar = screen.getByRole('button', { name: /Sí, despejar/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(spyDespejar).toHaveBeenCalledWith('1', '1');
    });
  });

  // 4. El pedido nuevo llega por socket
  it('4. El pedido nuevo llega por socket y refresca la vista', async () => {
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([
      { id: '1', nombre: 'Cocina', comandasPendientes: 1 },
    ]);
    const spyListar = vi
      .spyOn(cocinaApi, 'listarComandasArea')
      .mockResolvedValueOnce([comandaEjemplo])
      .mockResolvedValueOnce([
        comandaEjemplo,
        {
          ...comandaEjemplo,
          id: '2-1',
          pedidoId: '2',
          ticket: 'CP-102',
          codigo: 'CP-102',
        },
      ]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({
      activa: false,
      minutos: 0,
      pausa: false,
    });

    render(<CocinaAdminView />);

    await waitFor(() => {
      expect(screen.getByText('CP-101')).toBeInTheDocument();
    });

    expect(spyListar).toHaveBeenCalledTimes(1);

    expect(socketCallbacks['pedido:nuevo']).toBeDefined();
    socketCallbacks['pedido:nuevo'][0]({ codigo: 'CP-102' });

    await waitFor(() => {
      expect(spyListar).toHaveBeenCalledTimes(2);
      expect(screen.getByText('CP-102')).toBeInTheDocument();
    });
  });

  // 5. HASTA_REACTIVAR oculto para quien no es ADMIN
  it('5. HASTA_REACTIVAR oculto para quien no es ADMIN y visible para ADMIN', async () => {
    vi.spyOn(cocinaApi, 'buscarItemsDeCarta').mockResolvedValue([
      {
        tipo: 'PRODUCTO',
        id: '50',
        nombre: 'Frappé Fresa',
        subtitulo: 'Producto · Bebidas',
      },
    ]);
    vi.spyOn(cocinaApi, 'listarAgotados').mockResolvedValue([]);

    // Caso A: Rol COCINERO (no ADMIN)
    const { unmount } = render(
      <ModalAgotados abierto={true} alCerrar={vi.fn()} />,
    );

    const inputBusqueda = screen.getByLabelText(/Buscar producto/i);
    fireEvent.change(inputBusqueda, { target: { value: 'Frappé' } });

    await waitFor(() => {
      expect(screen.getByText('Frappé Fresa')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Agotar hoy/i })).toBeInTheDocument();
    expect(screen.queryByTestId('boton-hasta-reactivar')).not.toBeInTheDocument();

    unmount();

    // Caso B: Rol ADMIN
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '99', nombres: 'Administrador', rol: 'ADMIN' },
      permisos: ['*'],
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

    render(<ModalAgotados abierto={true} alCerrar={vi.fn()} />);
    const inputBusquedaAdmin = screen.getByLabelText(/Buscar producto/i);
    fireEvent.change(inputBusquedaAdmin, { target: { value: 'Frappé' } });

    await waitFor(() => {
      expect(screen.getByTestId('boton-hasta-reactivar')).toBeInTheDocument();
    });
  });

  // 6. Minutos fuera de rango bloquean en Alta Demanda
  it('6. Minutos fuera de rango (<5 o >180) muestran error y bloquean', () => {
    const estadoInicial: AltaDemandaEstado = {
      activa: false,
      minutos: 0,
      pausa: false,
    };
    const alCambiar = vi.fn();

    render(
      <PanelAltaDemanda estado={estadoInicial} alCambiarEstado={alCambiar} />,
    );

    const inputMinutos = screen.getByLabelText(/Minutos extra de espera/i);
    const botonActivar = screen.getByRole('button', {
      name: /Alta demanda: apagada/i,
    });

    // Probar menos de 5
    fireEvent.change(inputMinutos, { target: { value: '2' } });
    expect(
      screen.getByText(/Los minutos deben estar entre 5 y 180/i),
    ).toBeInTheDocument();

    fireEvent.click(botonActivar);
    expect(
      screen.queryByText(/¿Confirmar alta demanda\?/i),
    ).not.toBeInTheDocument();

    // Probar más de 180
    fireEvent.change(inputMinutos, { target: { value: '250' } });
    expect(
      screen.getByText(/Los minutos deben estar entre 5 y 180/i),
    ).toBeInTheDocument();

    fireEvent.click(botonActivar);
    expect(
      screen.queryByText(/¿Confirmar alta demanda\?/i),
    ).not.toBeInTheDocument();

    // Probar valor válido
    fireEvent.change(inputMinutos, { target: { value: '45' } });
    expect(
      screen.queryByText(/Los minutos deben estar entre 5 y 180/i),
    ).not.toBeInTheDocument();

    fireEvent.click(botonActivar);
    expect(screen.getByText(/¿Confirmar alta demanda\?/i)).toBeInTheDocument();
  });

  // 7. Historial del día y Devolver a la pantalla con confirmación
  it('7. Historial del día muestra tiempos y Devolver pide confirmación', async () => {
    const historialPrueba: HistorialComanda[] = [
      {
        id: '1-1',
        pedidoId: '1',
        areaId: '1',
        areaNombre: 'Cocina',
        ticket: 'CP-090',
        codigo: 'CP-090',
        canal: 'WEB',
        modalidad: 'RECOGER',
        mesa: null,
        llego_en: '2026-10-21T18:00:00Z',
        despejada_en: '2026-10-21T18:22:00Z',
        tiempoPreparacionMin: 22,
        lineas: [
          {
            id: '1',
            nombre: 'Dona Artesanal',
            cantidad: 2,
          },
        ],
      },
    ];

    const spyDevolver = vi
      .spyOn(cocinaApi, 'devolverComanda')
      .mockResolvedValue({ ok: true });
    const alDevolverExito = vi.fn();

    render(
      <HistorialView
        historial={historialPrueba}
        nombreAreaActual="Cocina"
        alDevolverExito={alDevolverExito}
      />,
    );

    expect(screen.getByText('CP-090')).toBeInTheDocument();
    expect(screen.getByText(/22 min de preparación/i)).toBeInTheDocument();

    const botonDevolver = screen.getByRole('button', {
      name: /Devolver a la pantalla/i,
    });
    fireEvent.click(botonDevolver);

    // Diálogo de confirmación
    expect(
      screen.getByText(/¿Devolver comanda CP-090 a la pantalla\?/i),
    ).toBeInTheDocument();
    expect(spyDevolver).not.toHaveBeenCalled();

    const botonConfirmar = screen.getByRole('button', { name: /Sí, devolver/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(spyDevolver).toHaveBeenCalledWith('1', '1');
      expect(alDevolverExito).toHaveBeenCalled();
    });
  });

  // 8. Vista de despacho muestra nombre del cliente y áreas
  it('8. Despacho muestra el nombre del cliente (solo el nombre) y estado por área', () => {
    const despachoPrueba: PedidoDespacho[] = [
      {
        id: '1',
        codigo: 'CP-200',
        ticket: 'CP-200',
        cliente: 'Rosa Díaz',
        cliente_nombre: 'Rosa Díaz',
        estado: 'PREPARANDO',
        canal: 'WEB',
        modalidad: 'DELIVERY',
        mesa: null,
        creado_en: '2026-10-21T18:00:00Z',
        listo_en: null,
        areas: [
          {
            areaId: '1',
            areaNombre: 'Bebidas',
            despejado: true,
            estado: 'DESPEJADA',
            despejada_en: '2026-10-21T18:15:00Z',
          },
          {
            areaId: '2',
            areaNombre: 'Cocina',
            despejado: false,
            estado: 'EN_COCINA',
            despejada_en: null,
          },
        ],
        completo: false,
        estadoDespacho: 'Pendiente',
      },
    ];

    render(<DespachoView pedidos={despachoPrueba} />);

    expect(screen.getByText('Rosa Díaz')).toBeInTheDocument();
    expect(screen.getByText(/CP-200/)).toBeInTheDocument();
    expect(screen.getByText('Bebidas')).toBeInTheDocument();
    expect(screen.getByText('Despejado')).toBeInTheDocument();
    expect(screen.getByText('Cocina')).toBeInTheDocument();
    expect(screen.getByText('Falta despejar')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  // 9. Modo pantalla TV (/pantalla/cocina) es de solo lectura y sin datos personales
  it('9. Pantalla TV (/pantalla/cocina) renderiza en solo lectura sin botones de acción', async () => {
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([
      { id: '1', nombre: 'Barra' },
    ]);
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([
      {
        ...comandaEjemplo,
        ticket: 'CP-999',
        codigo: 'CP-999',
      },
    ]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({
      activa: false,
      minutos: 0,
      pausa: false,
    });

    render(<PantallaCocinaView />);

    await waitFor(() => {
      expect(screen.getByText('CP-999')).toBeInTheDocument();
    });

    // En modo TV no debe existir botón «Despejar»
    expect(screen.queryByRole('button', { name: /^Despejar$/i })).not.toBeInTheDocument();
  });
});
