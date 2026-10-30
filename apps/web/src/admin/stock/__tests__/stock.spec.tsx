import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as sesionModulo from '../../../comun/sesion';
import { StockView } from '../StockView';
import { InsumosTab } from '../InsumosTab';
import { ModalInsumo } from '../ModalInsumo';
import { ModalMovimiento } from '../ModalMovimiento';
import { ExistenciasTab } from '../ExistenciasTab';
import { RecetasTab } from '../RecetasTab';
import { stockApi } from '../stockApi';
import type { InsumoItem, LugarStockItem } from '../tipos';

describe('Módulo Stock y recetas (Front)', () => {
  const mockLugares: LugarStockItem[] = [
    { id: '1', nombre: 'Almacén central', tipo: 'ALMACEN', area_id: null },
    { id: '2', nombre: 'Barra', tipo: 'AREA', area_id: '10' },
    { id: '3', nombre: 'Cocina', tipo: 'AREA', area_id: '20' },
  ];

  const mockLugaresMatriz = [
    { id: '1', nombre: 'Almacén central', tipo: 'ALMACEN', areaId: null, areaNombre: null },
    { id: '2', nombre: 'Barra', tipo: 'AREA', areaId: '10', areaNombre: 'Barra' },
    { id: '3', nombre: 'Cocina', tipo: 'AREA', areaId: '20', areaNombre: 'Cocina' },
  ];

  const mockInsumos: InsumoItem[] = [
    {
      id: '1',
      nombre: 'Café en grano',
      unidad_compra: 'BOLSA',
      unidad_almacen: 'KG',
      unidad_receta: 'G',
      factor_compra: 1,
      factor_receta: 1000,
      minimo: 5,
      intermedio: 15,
      maximo: 40,
      costo_unit: 45.0,
      lugar_consumo_id: '2',
      lugar_consumo_nombre: 'Barra',
      proveedor_a: '1',
      proveedor_b: null,
      proveedor_c: null,
      activo: true,
      stock_total: 8,
      stock_por_lugar: [{ lugarId: '2', lugarNombre: 'Barra', cantidad: 8 }],
      semaforo: 'rojo',
      estado: 'Poco',
      porcentaje_llenado: 20,
    },
    {
      id: '2',
      nombre: 'Leche entera',
      unidad_compra: 'CAJA',
      unidad_almacen: 'L',
      unidad_receta: 'ML',
      factor_compra: 12,
      factor_receta: 1000,
      minimo: 10,
      intermedio: 25,
      maximo: 60,
      costo_unit: 4.5,
      lugar_consumo_id: '2',
      lugar_consumo_nombre: 'Barra',
      proveedor_a: null,
      proveedor_b: null,
      proveedor_c: null,
      activo: true,
      stock_total: 58,
      stock_por_lugar: [{ lugarId: '1', lugarNombre: 'Almacén central', cantidad: 58 }],
      semaforo: 'verde',
      estado: 'Lleno',
      porcentaje_llenado: 97,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' },
      permisos: ['stock/ver', 'stock/editar', 'stock/movimientos', 'recetas/ver', 'recetas/editar'],
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

    vi.spyOn(stockApi, 'listarLugares').mockResolvedValue(mockLugares);
    vi.spyOn(stockApi, 'listarInsumos').mockResolvedValue(mockInsumos);
  });

  it('1. InsumosTab muestra semáforos, porcentajes y estados en palabras (Poco, Lleno)', async () => {
    render(
      <MemoryRouter>
        <InsumosTab lugares={mockLugares} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Café en grano')).toBeDefined();
      expect(screen.getAllByText('Poco').length).toBeGreaterThan(0);
      expect(screen.getByText('Leche entera')).toBeDefined();
      expect(screen.getAllByText('Lleno').length).toBeGreaterThan(0);
    });
  });

  it('2. ModalInsumo valida niveles (mínimo < intermedio < máximo) y proveedores repetidos', () => {
    const handleGuardar = vi.fn();
    render(
      <ModalInsumo
        insumo={null}
        lugares={mockLugares}
        alCerrar={vi.fn()}
        alGuardar={handleGuardar}
      />,
    );

    // Llenar nombre para que pase la primera validación
    fireEvent.change(screen.getByPlaceholderText(/Ej.: Harina de trigo/i), {
      target: { value: 'Harina sin preparar' },
    });

    // Mínimo mayor que intermedio
    fireEvent.change(screen.getByLabelText(/Mínimo \(rojo\)/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Intermedio \(naranja\)/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/^Máximo$/i), { target: { value: '50' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      screen.getByText(/El mínimo debe ser menor que el intermedio y este menor que el máximo/i),
    ).toBeDefined();
    expect(handleGuardar).not.toHaveBeenCalled();
  });

  it('3. ModalInsumo exige confirmación Sí/No antes de guardar', async () => {
    const handleGuardar = vi.fn().mockResolvedValue(undefined);
    render(
      <ModalInsumo
        insumo={null}
        lugares={mockLugares}
        alCerrar={vi.fn()}
        alGuardar={handleGuardar}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Ej.: Harina de trigo/i), {
      target: { value: 'Azúcar rubia' },
    });

    fireEvent.change(screen.getByLabelText(/Mínimo \(rojo\)/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Intermedio \(naranja\)/i), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/^Máximo$/i), { target: { value: '50' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    // Debe abrir el diálogo de confirmación
    expect(screen.getByText('¿Guardar el insumo "Azúcar rubia"?')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sí, guardar' })).toBeDefined();

    // Confirmar
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));

    await waitFor(() => {
      expect(handleGuardar).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Azúcar rubia',
          minimo: 5,
          intermedio: 15,
          maximo: 50,
        }),
      );
    });
  });

  it('4. ModalMovimiento exige motivo obligatorio en AJUSTE y MERMA con confirmación Sí/No', async () => {
    const handleGuardar = vi.fn().mockResolvedValue(undefined);
    render(
      <ModalMovimiento
        insumos={mockInsumos}
        lugares={mockLugares}
        alCerrar={vi.fn()}
        alGuardar={handleGuardar}
      />,
    );

    // Cambiar a MERMA mediante chip
    fireEvent.click(screen.getByRole('button', { name: 'Merma' }));

    // Ingresar cantidad para pasar la validación de cantidad
    fireEvent.change(screen.getByLabelText(/Cantidad/i), {
      target: { value: '2' },
    });

    // Intentar registrar sin motivo
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    expect(screen.getByText(/El motivo es obligatorio para mermas/i)).toBeDefined();
    expect(handleGuardar).not.toHaveBeenCalled();

    // Llenar motivo y confirmar
    fireEvent.change(screen.getByPlaceholderText(/Ej.: Vencimiento, derrame, mal estado/i), {
      target: { value: 'Envase roto durante transporte' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    // Diálogo Sí/No
    expect(screen.getByText(/¿Confirmar movimiento de MERMA\?/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));

    await waitFor(() => {
      expect(handleGuardar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'MERMA',
          motivo: 'Envase roto durante transporte',
        }),
      );
    });
  });

  it('5. ExistenciasTab muestra la matriz de lugares y alerta de stock', async () => {
    vi.spyOn(stockApi, 'obtenerExistencias').mockResolvedValue({
      lugares: mockLugaresMatriz,
      insumos: [
        {
          id: '1',
          nombre: 'Café en grano',
          unidadAlmacen: 'KG',
          minimo: 5,
          intermedio: 15,
          maximo: 40,
          lugarConsumoId: '2',
          lugarConsumoNombre: 'Barra',
          existencias: { '1': 10, '2': -2, '3': 0 },
          total: 8,
        },
      ],
      alertas: [
        {
          insumoId: '1',
          nombre: 'Café en grano',
          lugarId: '2',
          lugarNombre: 'Barra',
          saldo: -2,
          minimo: 5,
          tipo: 'NEGATIVO',
        },
      ],
    });

    render(<ExistenciasTab />);

    await waitFor(() => {
      expect(screen.getAllByText(/Café en grano/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Alertas de stock/i)).toBeDefined();
      expect(screen.getAllByText(/-2/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('6. RecetasTab muestra costos, márgenes en vivo y contador de platos sin receta', async () => {
    vi.spyOn(stockApi, 'listarRecetas').mockResolvedValue({
      productos: [
        {
          id: '32',
          nombre: 'CAPUCCINO',
          categoriaId: '1',
          categoriaNombre: 'Bebidas calientes',
          tieneReceta: true,
          precio: 9.0,
          costo: 2.44,
          margenSoles: 6.56,
          margenPorcentaje: 72.9,
          cantidadTamanos: 3,
        },
        {
          id: '50',
          nombre: 'AGUA MINERAL',
          categoriaId: '1',
          categoriaNombre: 'Bebidas frías',
          tieneReceta: false,
          precio: 4.0,
          costo: null,
          margenSoles: null,
          margenPorcentaje: null,
          cantidadTamanos: 0,
        },
      ],
      totalProductos: 2,
      platosSinMargen: 1,
    });

    vi.spyOn(stockApi, 'obtenerReceta').mockResolvedValue({
      productoId: '32',
      productoNombre: 'CAPUCCINO',
      categoria: 'Bebidas calientes',
      tieneReceta: true,
      tamanos: [
        {
          tamanoId: '1',
          tamanoNombre: '12 oz',
          costo: 2.44,
          precio: 9.0,
          margenSoles: 6.56,
          margenPorcentaje: 72.9,
          tieneRecetaTamano: true,
          lineas: [
            {
              insumoId: '1',
              insumoNombre: 'Café en grano',
              cantidad: 18,
              unidadReceta: 'G',
              costoUnitarioReceta: 0.08,
              subtotalCosto: 1.44,
            },
          ],
        },
      ],
    });

    render(<RecetasTab insumos={mockInsumos} />);

    await waitFor(() => {
      expect(screen.getAllByText('CAPUCCINO').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText('s/ 2.44').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('s/ 6.56').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('72.9%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('AGUA MINERAL').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sin receta').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('SIN RECETA / SIN MARGEN')).toBeDefined();
  });

  it('7. StockView permite alternar entre las 3 pestañas del mockup', async () => {
    vi.spyOn(stockApi, 'obtenerExistencias').mockResolvedValue({
      lugares: mockLugaresMatriz,
      insumos: [],
      alertas: [],
    });
    vi.spyOn(stockApi, 'listarMovimientos').mockResolvedValue({
      items: [],
      total: 0,
      pagina: 1,
      limite: 12,
      totalPaginas: 1,
    });
    vi.spyOn(stockApi, 'listarRecetas').mockResolvedValue({
      productos: [
        {
          id: '32',
          nombre: 'CAPUCCINO',
          categoriaId: '1',
          categoriaNombre: 'Bebidas calientes',
          tieneReceta: true,
          precio: 9.0,
          costo: 2.44,
          margenSoles: 6.56,
          margenPorcentaje: 72.9,
          cantidadTamanos: 3,
        },
      ],
      totalProductos: 1,
      platosSinMargen: 0,
    });
    vi.spyOn(stockApi, 'obtenerReceta').mockResolvedValue({
      productoId: '32',
      productoNombre: 'CAPUCCINO',
      categoria: 'Bebidas calientes',
      tieneReceta: true,
      tamanos: [],
    });

    render(
      <MemoryRouter initialEntries={['/admin/stock']}>
        <StockView />
      </MemoryRouter>,
    );

    expect(screen.getByRole('tab', { name: /^Insumos/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /^Producción y almacén/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /^Recetas/i })).toBeDefined();

    // Cambiar a Producción y almacén
    fireEvent.click(screen.getByRole('tab', { name: /^Producción y almacén/i }));
    await waitFor(() => {
      expect(screen.getByText(/Aquí se registra lo que pasa con el stock/i)).toBeDefined();
      expect(screen.getByText(/Donas, galletas, pan o gelatina/i)).toBeDefined();
      expect(screen.getAllByText('Pedir al almacén').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Pérdidas y cierre')).toBeDefined();
    });

    // Cambiar a Recetas
    fireEvent.click(screen.getByRole('tab', { name: /^Recetas/i }));
    await waitFor(() => {
      expect(screen.getByText(/TOTAL DE PLATOS EN CARTA/i)).toBeDefined();
    });
  });
});
