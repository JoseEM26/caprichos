import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ComprasView } from '../ComprasView';
import { comprasApi } from '../comprasApi';
import * as sesionModulo from '../../../comun/sesion';

describe('ComprasView', () => {
  const mockResumen = {
    pedidosPorRecibir: 1,
    porPagar: 1535.0,
    compradoMes: 2835.0,
    listaPedir: 2,
  };

  const mockProveedores = [
    {
      id: '1',
      razonSocial: 'Distribuidora Lácteos del Norte SAC',
      nombreComercial: 'Lácteos del Norte',
      ruc: '20123456789',
      telefono: '987654321',
      contacto: 'Carlos Ventas',
      diasCredito: 15,
      cuentaPago: 'BCP 191-111111',
      activo: true,
      totalCompras: 2500,
    },
    {
      id: '2',
      razonSocial: 'Café de Altura SAC',
      nombreComercial: 'Café de Altura',
      ruc: '20987654321',
      telefono: '912345678',
      contacto: 'María Café',
      diasCredito: 0,
      cuentaPago: 'BBVA 0011-22222',
      activo: true,
      totalCompras: 900,
    },
  ];

  const mockCompras = [
    {
      id: '101',
      comprobanteTipo: 'Factura',
      comprobanteNumero: 'OC-211',
      proveedorId: '1',
      proveedorNombre: 'Lácteos del Norte',
      proveedorRuc: '20123456789',
      estado: 'PENDIENTE' as const,
      estadoPago: 'PENDIENTE' as const,
      condicion: 'CREDITO' as const,
      diasCredito: 15,
      subtotal: 322.03,
      igv: 57.97,
      montoTotal: 380.0,
      fechaEmision: '13/10',
      creadoEn: '2026-10-13T10:00:00Z',
      insumosResumen: 'Leche, crema',
      lineas: [
        {
          id: '1',
          insumoId: '10',
          insumoNombre: 'Leche entera',
          unidad: 'L',
          cantidadCompra: 20,
          cantidadAlmacen: 20,
          costoUnit: 4.5,
          subtotal: 90,
        },
      ],
    },
  ];

  const mockInsumosPedir = [
    {
      id: '10',
      nombre: 'Leche entera',
      unidadAlmacen: 'L',
      unidadCompra: 'L',
      factorConversion: 1,
      costoUnitario: 4.5,
      stockActual: 3,
      stockMinimo: 10,
      stockIdeal: 20,
      cantidadSugerida: 17,
      proveedorId: '1',
      proveedorNombre: 'Lácteos del Norte',
      proveedorTelefono: '987654321',
      estadoStock: 'BAJO' as const,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMINISTRADOR' },
      permisos: ['stock/ver', 'stock/ajustar', 'compras/gestionar'],
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

    vi.spyOn(comprasApi, 'obtenerResumen').mockResolvedValue(mockResumen);
    vi.spyOn(comprasApi, 'listarProveedores').mockResolvedValue(mockProveedores);
    vi.spyOn(comprasApi, 'listarCompras').mockResolvedValue(mockCompras);
    vi.spyOn(comprasApi, 'listarInsumosParaPedir').mockResolvedValue(mockInsumosPedir);
  });

  it('renderiza tarjetas de resumen y pestañas dinámicamente', async () => {
    render(<ComprasView />);

    await waitFor(() => {
      expect(screen.getByText('Pedidos por recibir')).toBeInTheDocument();
      expect(screen.getByText('Por pagar a proveedores')).toBeInTheDocument();
      expect(screen.getByText('Comprado este mes')).toBeInTheDocument();
      expect(screen.getByText('Lista para pedir')).toBeInTheDocument();
    });

    expect(screen.getByText('+ Registrar compra')).toBeInTheDocument();
  });

  it('permite cambiar a la pestaña Por pedir y muestra botón de WhatsApp', async () => {
    render(<ComprasView />);

    const botonTabPedir = await screen.findByRole('button', { name: /por pedir|pedir a proveedores/i });
    fireEvent.click(botonTabPedir);

    await waitFor(() => {
      expect(screen.getByText(/Pedir al proveedor \(WhatsApp\)|Pedir por WhatsApp/i)).toBeInTheDocument();
      expect(screen.getByText('Leche entera')).toBeInTheDocument();
    });
  });

  it('muestra el botón + Compra rápida y abre el modal de compra suelta', async () => {
    render(<ComprasView />);

    const botonRapida = await screen.findByRole('button', { name: /\+ compra rápida/i });
    expect(botonRapida).toBeInTheDocument();
    fireEvent.click(botonRapida);

    expect(screen.getByRole('dialog', { name: /compra rápida \(sin proveedor\)/i })).toBeInTheDocument();
    expect(screen.getByText(/Costo total/i)).toBeInTheDocument();
  });

  it('permite cambiar a la pestaña Proveedores y ver los proveedores registrados', async () => {
    render(<ComprasView />);

    const botonTabProv = await screen.findByRole('button', { name: /^proveedores$/i });
    fireEvent.click(botonTabProv);

    await waitFor(() => {
      expect(screen.getByText('+ Nuevo proveedor')).toBeInTheDocument();
      expect(screen.getByText('Lácteos del Norte')).toBeInTheDocument();
      expect(screen.getByText('Café de Altura')).toBeInTheDocument();
    });
  });

  it('el filtro por proveedor de Compras es un combo con los proveedores que tienen compras', async () => {
    render(<ComprasView />);
    await screen.findByRole('button', { name: 'Proveedor: Todos' });

    fireEvent.click(screen.getByRole('button', { name: 'Proveedor: Todos' }));
    fireEvent.click(screen.getByRole('option', { name: 'Lácteos del Norte' }));

    expect(screen.getByRole('button', { name: 'Proveedor: Lácteos del Norte' })).toBeInTheDocument();
  });

  it('abre el modal de registrar compra al hacer clic en + Registrar compra', async () => {
    render(<ComprasView />);

    const botonRegistrar = await screen.findByRole('button', { name: /\+ registrar compra/i });
    fireEvent.click(botonRegistrar);

    expect(screen.getByRole('dialog', { name: /registrar compra/i })).toBeInTheDocument();
    expect(screen.getByText('Condición de pago')).toBeInTheDocument();
  });
});
