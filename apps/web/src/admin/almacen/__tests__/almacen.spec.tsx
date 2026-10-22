import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlmacenView } from '../AlmacenView';
import { almacenApi } from '../almacenApi';
import * as sesionModulo from '../../../comun/sesion';

describe('AlmacenView', () => {
  const mockMovimientos = [
    {
      id: '1',
      fecha: '2026-10-15T08:00:00Z',
      fechaFormateada: '15/10',
      tipo: 'ENTRADA' as const,
      insumoId: '10',
      insumoNombre: 'Donas (producción del día)',
      cantidad: 24,
      unidad: 'unidades',
      cantidadTexto: '24 unidades',
      origen: 'Producción',
      destino: 'Almacén central',
      documento: 'PRD-014',
      esAnulable: true,
    },
    {
      id: '2',
      fecha: '2026-10-15T09:30:00Z',
      fechaFormateada: '15/10',
      tipo: 'SALIDA' as const,
      insumoId: '11',
      insumoNombre: 'Harina y azúcar (producción)',
      cantidad: 6,
      unidad: 'kg',
      cantidadTexto: '6 kg',
      origen: 'Almacén central',
      destino: 'Producción',
      documento: 'REQ-045',
      esAnulable: true,
    },
    {
      id: '3',
      fecha: '2026-10-14T18:00:00Z',
      fechaFormateada: '14/10',
      tipo: 'MERMA' as const,
      insumoId: '12',
      insumoNombre: 'Donas del día',
      cantidad: 3,
      unidad: 'unidades',
      cantidadTexto: '3 unidades',
      origen: 'Producción',
      destino: 'Merma',
      documento: 'MER-009',
      esAnulable: true,
    },
  ];

  const mockInsumos = [
    {
      id: '10',
      nombre: 'Harina Especial',
      unidad: 'kg',
      stockActual: 5,
      stockMinimo: 10,
      costoUnit: 3.2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMINISTRADOR' },
      permisos: ['stock/ver', 'stock/ajustar'],
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

    vi.spyOn(almacenApi, 'listarMovimientos').mockResolvedValue({
      conteos: {
        todos: 3,
        entradas: 1,
        salidas: 1,
        mermas: 1,
        devoluciones: 0,
      },
      movimientos: mockMovimientos,
    });
    vi.spyOn(almacenApi, 'listarInsumos').mockResolvedValue(mockInsumos);
  });

  it('renderiza banner de acciones, advertencia de stock bajo y botones principales', async () => {
    render(<AlmacenView />);

    await waitFor(() => {
      expect(screen.getByText('Gestionar listas')).toBeInTheDocument();
      expect(screen.getByText(/Stock bajo \(1\) · pedir a proveedores/i)).toBeInTheDocument();
      expect(screen.getByText('Registrar movimiento')).toBeInTheDocument();
      expect(screen.getByText('Registrar la producción del día')).toBeInTheDocument();
      expect(screen.getByText('Cerrar el día (sobrantes a merma)')).toBeInTheDocument();
    });
  });

  it('muestra las tarjetas de movimientos con sus campos de insumo, cantidad, origen, destino y documento', async () => {
    render(<AlmacenView />);

    await waitFor(() => {
      expect(screen.getByText('Donas (producción del día)')).toBeInTheDocument();
      expect(screen.getByText('24 unidades')).toBeInTheDocument();
      expect(screen.getByText('PRD-014')).toBeInTheDocument();
      expect(screen.getByText('REQ-045')).toBeInTheDocument();
    });
  });

  it('permite filtrar por tipo abriendo el panel de filtros', async () => {
    render(<AlmacenView />);

    const botonFiltros = await screen.findByRole('button', { name: /filtros/i });
    fireEvent.click(botonFiltros);

    // Debe mostrar los botones de tipo con sus conteos dinámicos
    expect(screen.getByRole('button', { name: /entrada \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salida \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /merma \(1\)/i })).toBeInTheDocument();

    // Filtramos solo por Merma
    fireEvent.click(screen.getByRole('button', { name: /merma \(1\)/i }));

    await waitFor(() => {
      expect(screen.getByText('Donas del día')).toBeInTheDocument();
      expect(screen.queryByText('Donas (producción del día)')).not.toBeInTheDocument();
    });
  });

  it('abre el modal de registrar movimiento al hacer clic', async () => {
    render(<AlmacenView />);

    const boton = await screen.findByRole('button', { name: 'Registrar movimiento' });
    fireEvent.click(boton);

    expect(screen.getByRole('dialog', { name: /registrar movimiento/i })).toBeInTheDocument();
  });
});
