import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditosView } from '../CreditosView';
import { ModalCreditoPersonal } from '../ModalCreditoPersonal';
import * as api from '../creditosApi';
import * as sesionModulo from '../../../comun/sesion';

describe('CreditosView', () => {
  const sesionAdmin = {
    usuario: { id: '1', partyId: '1', nombres: 'Kevin Rosales', rol: 'ADMIN' },
    permisos: ['creditos/ver', 'creditos/exportar'],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: vi.fn().mockReturnValue(true),
  };

  const datosResumen: api.RespuestaResumenCreditos = {
    descuentoPct: 25,
    periodo: {
      tipo: 'semana',
      etiqueta: 'Lun 12/10 – Dom 18/10',
      desde: '2026-10-12',
      hasta: '2026-10-18',
      navegable: true,
    },
    totales: {
      totalMonto: 26.4,
      totalFormateado: 's/ 26.40',
      totalConsumos: 1,
      trabajadoresConConsumo: 1,
      totalTrabajadores: 6,
      resumenTrabajadores: '1 de 6',
    },
    trabajadores: [
      {
        partyId: '14',
        nombre: 'Jorge Salas',
        rol: 'Reparto',
        total: 26.4,
        totalFormateado: 's/ 26.40',
        tieneConsumo: true,
        cantidadConsumos: 1,
        items: [
          {
            id: '1',
            pedidoId: '38',
            pedidoCodigo: 'CP-P06',
            fecha: '12/10',
            fechaIso: '2026-10-12T00:00:00.000Z',
            monto: 26.4,
            montoFormateado: 's/ 26.40',
            lineas: ['1 × Frappe lúcuma (Grande)', '1 × Brownie'],
            descuento: 8.8,
          },
        ],
      },
      {
        partyId: '9',
        nombre: 'Marta Gómez',
        rol: 'Caja',
        total: 0,
        totalFormateado: 's/ 0.00',
        tieneConsumo: false,
        cantidadConsumos: 0,
        items: [],
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesionAdmin);
    vi.spyOn(api, 'obtenerResumenCreditos').mockResolvedValue(datosResumen);
    vi.spyOn(api, 'listarPersonalActivo').mockResolvedValue([
      { partyId: '9', nombre: 'Marta Gómez', rol: 'Caja' },
      { partyId: '14', nombre: 'Jorge Salas', rol: 'Reparto' },
    ]);
    vi.spyOn(api, 'registrarConsumoCredito').mockResolvedValue({ ok: true });
    vi.spyOn(api, 'exportarCreditos').mockResolvedValue({
      blob: new Blob(['a,b,c']),
      nombreArchivo: 'creditos-personal.csv',
    });
  });

  it('renderiza resumen de créditos, totales dinámicos y trabajadores', async () => {
    render(<CreditosView />);

    await waitFor(() => {
      expect(screen.getByText('Condiciones del crédito del personal')).toBeInTheDocument();
    });

    // Total de la semana dinámico
    expect(screen.getAllByText('s/ 26.40').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1 de 6')).toBeInTheDocument();
    expect(screen.getByText('Jorge Salas')).toBeInTheDocument();
    expect(screen.getByText('Marta Gómez')).toBeInTheDocument();
  });

  it('permite abrir el acordeón de un trabajador y ver sus consumos y líneas', async () => {
    render(<CreditosView />);

    await waitFor(() => {
      expect(screen.getByText('Jorge Salas')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Jorge Salas'));

    expect(screen.getByText('12/10 · CP-P06')).toBeInTheDocument();
    expect(screen.getByText('• 1 × Frappe lúcuma (Grande)')).toBeInTheDocument();
    // el descuento del personal que ya lleva el pedido y que queda por cobrar
    expect(screen.getByText(/descuento del personal de s\/ 8\.80 · por cobrar a fin del período/)).toBeInTheDocument();
  });

  it('un trabajador sin consumo muestra "No consumió nada este mes."', async () => {
    render(<CreditosView />);

    await waitFor(() => {
      expect(screen.getByText('Marta Gómez')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Marta Gómez'));

    expect(screen.getByText('No consumió nada este mes.')).toBeInTheDocument();
  });

  it('permite cambiar a período Por mes', async () => {
    render(<CreditosView />);

    await waitFor(() => {
      expect(screen.getByText('Por mes')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Por mes'));

    await waitFor(() => {
      expect(api.obtenerResumenCreditos).toHaveBeenCalledWith(
        expect.objectContaining({ periodo: 'mes' }),
      );
    });
  });
});

describe('ModalCreditoPersonal', () => {
  const pedidoEjemplo = {
    id: '15',
    codigo: 'P-0015',
    total: 30,
    lineas: [
      { cantidad: 1, nombre: 'Café americano', subtotal: 8, precio_unit: 8 },
      { cantidad: 1, nombre: 'Combo desayuno', subtotal: 22, precio_unit: 22, oferta_id: 1 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'listarPersonalActivo').mockResolvedValue([
      { partyId: '9', nombre: 'Marta Gómez', rol: 'Cajera' },
      { partyId: '14', nombre: 'Jorge Salas', rol: 'Reparto' },
    ]);
    vi.spyOn(api, 'registrarConsumoCredito').mockResolvedValue({ id: '1', ok: true });
  });

  it('renderiza título del pedido, chips de colaboradores y cálculo con descuento', async () => {
    render(
      <ModalCreditoPersonal
        abierto={true}
        pedido={pedidoEjemplo}
        descuentoPct={25}
        alCobrado={vi.fn()}
        alCancelar={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Cobrar P-0015 a crédito')).toBeInTheDocument();
    });

    expect(screen.getByText('Marta Gómez · Cajera')).toBeInTheDocument();
    expect(screen.getByText('Total del pedido: s/ 30.00')).toBeInTheDocument();
  });

  it('pide confirmación Sí/No antes de cobrar a crédito', async () => {
    const alCobrado = vi.fn();
    render(
      <ModalCreditoPersonal
        abierto={true}
        pedido={pedidoEjemplo}
        descuentoPct={25}
        alCobrado={alCobrado}
        alCancelar={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Marta Gómez · Cajera')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Marta Gómez · Cajera'));
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar a crédito' }));

    // Diálogo de confirmación
    expect(screen.getByText('¿Cobrar P-0015 a crédito de Marta Gómez?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, cobrar a crédito' }));

    await waitFor(() => {
      expect(api.registrarConsumoCredito).toHaveBeenCalledWith('15', '9');
      expect(alCobrado).toHaveBeenCalled();
    });
  });
});
