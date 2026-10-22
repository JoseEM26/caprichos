import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RepartosView } from '../RepartosView';
import { TarjetaReparto } from '../TarjetaReparto';
import { ModalReportarFalla } from '../ModalReportarFalla';
import { repartosApi, PedidoReparto } from '../repartosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import { ErrorApi } from '../../../comun/api';

vi.mock('../../../comun/mapa/MapaPedidos', () => ({
  MapaPedidos: ({ puntos, seleccionado, onSeleccionar }: any) => (
    <div data-testid="mock-mapa-pedidos">
      {puntos.map((p: any) => (
        <button
          key={p.id}
          data-testid={`pin-${p.id}`}
          data-selected={p.id === seleccionado ? 'true' : 'false'}
          onClick={() => onSeleccionar && onSeleccionar(p.id)}
        >
          {p.orden ? `${p.orden}. ` : ''}
          {p.etiqueta} - {p.detalle} ({p.color})
        </button>
      ))}
    </div>
  ),
}));

describe('Ola F5 y Siguiente: Repartos y Mapa', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '10', nombres: 'Repartidor Carlos', rol: 'REPARTIDOR' },
      permisos: ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockImplementation((permiso: string) => {
        return ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar'].includes(
          permiso,
        );
      }),
    });

    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});

    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'obtenerResumen').mockResolvedValue({ lados: {}, zonas: {} });
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({
      pedidos: [],
      orden: [],
      paso: [],
      ruta: [],
    });
    vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue([]);
  });

  const pedidoEjemplo: PedidoReparto = {
    id: '101',
    codigo: 'CP-0101',
    modalidad: 'DELIVERY',
    estado: 'LISTO',
    cliente_nombre: 'Maria Flores',
    cliente_telefono: '987654321',
    direccion: 'Av. Las Flores 123',
    referencia: 'Frente al parque',
    lat: -12.045,
    lng: -77.03,
    zona: 'Z1',
    zona_id: '1',
    minutosEspera: 36,
    color: 'naranja',
    total: 45.0,
    pago_estado: 'PENDIENTE',
    pago_metodo: 'EFECTIVO',
    cobro_pendiente_efectivo: true,
    paga_con: 50.0,
    repartidor_party_id: null,
    tomado_en: null,
    salio_en: null,
    llego_en: null,
    entregado_en: null,
    motivo_falla: null,
    creado_en: '2026-10-21T19:00:00Z',
  };

  it('Tomar maneja LIMITE_PEDIDOS', async () => {
    vi.spyOn(repartosApi, 'tomarPedido').mockRejectedValueOnce(
      new ErrorApi(
        'LIMITE_PEDIDOS',
        'Ya llevas 3 pedidos: entrega alguno antes de tomar otro',
        409,
      ),
    );

    render(
      <TarjetaReparto
        pedido={pedidoEjemplo}
        esDisponible={true}
        alActualizar={vi.fn()}
      />,
    );

    // Botón "Tomar pedido"
    const botonTomar = screen.getByRole('button', { name: /tomar pedido/i });
    fireEvent.click(botonTomar);

    // Modal de confirmación Sí/No
    expect(screen.getByText('¿Tomar este pedido?')).toBeInTheDocument();
    const botonConfirmar = screen.getByRole('button', { name: /sí, confirmar/i });
    fireEvent.click(botonConfirmar);

    // Debe mostrar el mensaje de límite de pedidos
    await waitFor(() => {
      expect(
        screen.getByText('Ya llevas 3 pedidos: entrega alguno antes de tomar otro'),
      ).toBeInTheDocument();
    });
  });

  it('no se puede reportar NO_CONTESTA con menos de 2 llamadas', async () => {
    const reportarMock = vi.spyOn(repartosApi, 'reportarFalla').mockResolvedValueOnce({
      ok: true,
      incidenteId: '99',
      intento: 1,
      pedido: { id: '101' },
    });

    render(
      <ModalReportarFalla
        pedido={pedidoEjemplo}
        alCerrar={vi.fn()}
        alCompletar={vi.fn()}
      />,
    );

    // Selecciona NO_CONTESTA (seleccionado por defecto)
    const selectMotivo = screen.getByLabelText(/motivo del incidente/i);
    expect(selectMotivo).toHaveValue('NO_CONTESTA');

    // Intenta enviar con 0 llamadas
    const botonEnviar = screen.getByRole('button', { name: /reportar entrega fallida/i });
    fireEvent.click(botonEnviar);

    // Debe rechazar y mostrar advertencia
    expect(
      screen.getByText(
        'Se requieren al menos 2 llamadas registradas como evidencia para el motivo NO_CONTESTA',
      ),
    ).toBeInTheDocument();
    expect(reportarMock).not.toHaveBeenCalled();

    // Registra 1 llamada
    const botonLlamada = screen.getByRole('button', { name: /\+ registrar llamada/i });
    fireEvent.click(botonLlamada);

    // Intenta enviar de nuevo con solo 1 llamada
    fireEvent.click(botonEnviar);
    expect(
      screen.getByText(
        'Se requieren al menos 2 llamadas registradas como evidencia para el motivo NO_CONTESTA',
      ),
    ).toBeInTheDocument();
    expect(reportarMock).not.toHaveBeenCalled();

    // Registra la 2da llamada
    fireEvent.click(botonLlamada);

    // Ahora sí debe permitir continuar a la confirmación
    fireEvent.click(botonEnviar);

    // Aparece el modal de confirmación Sí/No
    expect(screen.getByText('¿Confirmar reporte de entrega fallida?')).toBeInTheDocument();
    const botonConfirmar = screen.getByRole('button', { name: /sí, reportar/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(reportarMock).toHaveBeenCalledWith(
        '101',
        expect.objectContaining({
          motivo: 'NO_CONTESTA',
          contactos: expect.arrayContaining([
            expect.objectContaining({ tipo: 'LLAMADA' }),
            expect.objectContaining({ tipo: 'LLAMADA' }),
          ]),
        }),
      );
    });
  });

  it('muestra tiempo de espera con color, vuelto a llevar y avisos pendientes de enviar', async () => {
    vi.spyOn(repartosApi, 'consultarMensajes').mockResolvedValueOnce([
      {
        pedido_id: '101',
        numero: 1,
        enviado_en: '2026-10-21T19:10:00Z',
        respondido_en: null,
        estado: 'PENDIENTE',
      },
    ]);

    render(
      <TarjetaReparto
        pedido={pedidoEjemplo}
        esDisponible={true}
        alActualizar={vi.fn()}
      />,
    );

    // Tiempo de espera (36 min naranja)
    expect(screen.getByText(/36 min \(espera\)/i)).toBeInTheDocument();

    // Vuelto a llevar
    expect(screen.getByText(/llevar vuelto s\/ 5\.00/i)).toBeInTheDocument();

    // Ver avisos
    const botonAvisos = screen.getByRole('button', { name: /avisos al cliente/i });
    fireEvent.click(botonAvisos);

    await waitFor(() => {
      expect(
        screen.getByText(/PENDIENTE DE ENVIAR \(no se envía nada real\)/i),
      ).toBeInTheDocument();
    });
  });

  it('muestra la ruta sugerida de entrega con mapa y lista de paradas con distancia aproximada', async () => {
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValueOnce({
      pedidos: [
        {
          ...pedidoEjemplo,
          id: '101',
          codigo: 'CP-0101',
          estado: 'EN_CAMINO',
        },
        {
          ...pedidoEjemplo,
          id: '102',
          codigo: 'CP-0102',
          cliente_nombre: 'Pedro Gomez',
          estado: 'EN_CAMINO',
          lat: -12.05,
          lng: -77.035,
        },
      ],
      orden: ['101', '102'],
      paso: ['101', '102'],
      ruta: [
        [-12.045, -77.03],
        [-12.05, -77.035],
      ],
    });

    render(<RepartosView />);

    // Cambia a pestaña "Mis pedidos"
    const tabMios = screen.getByRole('tab', { name: /mis pedidos/i });
    fireEvent.click(tabMios);

    await waitFor(() => {
      expect(screen.getByText(/ruta sugerida de entrega/i)).toBeInTheDocument();
      // Puntos en el mapa con números de parada sugeridos (1. y 2.)
      expect(screen.getByTestId('pin-101')).toHaveTextContent(/1\.\s*Maria Flores/);
      expect(screen.getByTestId('pin-102')).toHaveTextContent(/2\.\s*Pedro Gomez/);
      // Lista de paradas
      expect(screen.getAllByText(/CP-0101/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/CP-0102/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('agrupación por zona en vista Lista («Z4 · 3 pedidos»)', async () => {
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValueOnce([
      { ...pedidoEjemplo, id: '201', codigo: 'CP-0201', zona: 'Z4' },
      { ...pedidoEjemplo, id: '202', codigo: 'CP-0202', zona: 'Z4' },
      { ...pedidoEjemplo, id: '203', codigo: 'CP-0203', zona: 'Z4' },
      { ...pedidoEjemplo, id: '204', codigo: 'CP-0204', zona: 'Z7' },
    ]);

    render(<RepartosView />);

    // Cambia a modo Lista
    const botonLista = screen.getByRole('button', { name: /^lista$/i });
    fireEvent.click(botonLista);

    await waitFor(() => {
      expect(screen.getByText('Z4 · 3 pedidos')).toBeInTheDocument();
      expect(screen.getByText('Z7 · 1 pedido')).toBeInTheDocument();
    });
  });

  it('filtro por zona filtra puntos en mapa y grupos en lista', async () => {
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([
      { ...pedidoEjemplo, id: '201', codigo: 'CP-0201', zona: 'Z4' },
      { ...pedidoEjemplo, id: '202', codigo: 'CP-0202', zona: 'Z4' },
      { ...pedidoEjemplo, id: '204', codigo: 'CP-0204', zona: 'Z7' },
    ]);

    render(<RepartosView />);

    // Por defecto en Mapa, ambos deben estar presentes
    await waitFor(() => {
      expect(screen.getByTestId('pin-201')).toBeInTheDocument();
      expect(screen.getByTestId('pin-204')).toBeInTheDocument();
    });

    // Filtra por Z4
    const botonFiltroZ4 = screen.getByRole('button', { name: /^Z4$/ });
    fireEvent.click(botonFiltroZ4);

    expect(screen.getByTestId('pin-201')).toBeInTheDocument();
    expect(screen.queryByTestId('pin-204')).not.toBeInTheDocument();
  });

  it('pedidos «Falta ubicar» (lat/lng nulos) no salen en el mapa y desactivan Tomar con aviso', async () => {
    const pedidoSinUbicacion: PedidoReparto = {
      ...pedidoEjemplo,
      id: '301',
      codigo: 'CP-0301',
      cliente_nombre: 'Ana Rojas',
      lat: null,
      lng: null,
      zona: 'Z2',
    };

    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValueOnce([pedidoSinUbicacion]);

    render(<RepartosView />);

    // En el mapa NO debe aparecer pin
    await waitFor(() => {
      expect(screen.queryByTestId('pin-301')).not.toBeInTheDocument();
      expect(
        screen.getByText(/pedido\(s\) sin ubicación en esta vista/i),
      ).toBeInTheDocument();
    });

    // Cambiar a Lista
    const botonLista = screen.getByRole('button', { name: /^lista$/i });
    fireEvent.click(botonLista);

    await waitFor(() => {
      // Debe tener la marca «Falta ubicar»
      expect(screen.getAllByText('Falta ubicar').length).toBeGreaterThanOrEqual(1);
      // Aviso para pedir a caja que lo ubique
      expect(
        screen.getByText(/pide a caja que ubique el pedido antes de tomarlo/i),
      ).toBeInTheDocument();
      // Botón "Falta ubicar" desactivado
      const botonFaltaUbicar = screen.getByRole('button', { name: 'Falta ubicar' });
      expect(botonFaltaUbicar).toBeDisabled();
    });
  });

  it('al tocar un punto en el mapa aparece el resumen (RQ-DEL-02-15) con botones y botón de estado', async () => {
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValueOnce([pedidoEjemplo]);

    render(<RepartosView />);

    await waitFor(() => {
      expect(screen.getByTestId('pin-101')).toBeInTheDocument();
    });

    // Toca el pin del pedido 101
    fireEvent.click(screen.getByTestId('pin-101'));

    await waitFor(() => {
      // Aparece la región de resumen
      expect(screen.getByRole('region', { name: /resumen de pedido CP-0101/i })).toBeInTheDocument();
      // Código, cliente, total
      expect(screen.getByText('CP-0101')).toBeInTheDocument();
      expect(screen.getByText('Maria Flores')).toBeInTheDocument();
      expect(screen.getByText('S/ 45.00')).toBeInTheDocument();
      // Vuelto que debe llevar
      expect(
        screen.getByText(/cobrar.*s\/ 45\.00.*llevar vuelto.*s\/ 5\.00/i),
      ).toBeInTheDocument();
      // Botones de acción rápida
      const linkLlamar = screen.getByRole('link', { name: /llamar/i });
      expect(linkLlamar).toHaveAttribute('href', 'tel:987654321');
      const linkWa = screen.getByRole('link', { name: /whatsapp/i });
      expect(linkWa).toHaveAttribute('href', 'https://wa.me/51987654321');
      const linkNavegar = screen.getByRole('link', { name: /navegar/i });
      expect(linkNavegar).toHaveAttribute(
        'href',
        'https://www.google.com/maps?q=-12.045,-77.03',
      );
      // Botón grande de Tomar pedido
      expect(screen.getByRole('button', { name: /tomar pedido/i })).toBeInTheDocument();
    });
  });

  it('exige confirmación Sí/No obligatoria antes de tomar pedido desde el resumen', async () => {
    const tomarMock = vi.spyOn(repartosApi, 'tomarPedido').mockResolvedValueOnce({
      ...pedidoEjemplo,
      estado: 'LISTO',
      repartidor_party_id: '10',
    });

    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValueOnce([pedidoEjemplo]);

    render(<RepartosView />);

    await waitFor(() => {
      expect(screen.getByTestId('pin-101')).toBeInTheDocument();
    });

    // Selecciona el pin
    fireEvent.click(screen.getByTestId('pin-101'));

    // Clic en Tomar pedido en el resumen
    const botonTomar = screen.getByRole('button', { name: /tomar pedido/i });
    fireEvent.click(botonTomar);

    // Debe abrir el modal de confirmación Sí/No
    expect(screen.getByText('¿Tomar este pedido?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /no, cancelar/i })).toBeInTheDocument();
    const botonConfirmar = screen.getByRole('button', { name: /sí, confirmar/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(tomarMock).toHaveBeenCalledWith('101');
    });
  });
});
