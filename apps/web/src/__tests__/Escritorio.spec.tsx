import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Escritorio } from '../admin/escritorio';
import * as sesionModulo from '../comun/sesion';
import { api } from '../comun/api';

describe('Escritorio (/admin)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('inicia con el saludo del administrador y el recuadro del período sin inventar datos', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: ['caja/ver'],
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

    vi.spyOn(api, 'get').mockRejectedValue(new Error('Conexión rehusada'));

    render(
      <MemoryRouter>
        <Escritorio />
      </MemoryRouter>,
    );

    // Saludo idéntico al mockup
    expect(
      screen.getByText('Hola, Admin Test. Este es tu escritorio de Administrador.'),
    ).toBeInTheDocument();

    // Filtros de período (30 días por defecto)
    expect(screen.getByText(/30 días/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filtros/i })).toBeInTheDocument();

    // No inventa datos ni tarjetas fuera de mockup («Turno Día»)
    expect(screen.queryByText(/Turno Día/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('tarjeta-estado-local')).not.toBeInTheDocument();
  });

  it('permite abrir el panel de Filtros y seleccionar otro período', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: [],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(false),
    });

    vi.spyOn(api, 'get').mockResolvedValue({
      kpisS: [
        { n: 'VENTAS', v: 's/ 100.00', dTxt: 'Prueba', dCol: 'var(--cp-green)' },
        { n: 'PEDIDOS', v: '5', dTxt: 'Prueba', dCol: 'var(--cp-green)' },
      ],
    });

    render(
      <MemoryRouter>
        <Escritorio />
      </MemoryRouter>,
    );

    const botonFiltros = screen.getByRole('button', { name: /filtros/i });
    fireEvent.click(botonFiltros);

    expect(screen.getByText('PERÍODO')).toBeInTheDocument();
    expect(screen.getByText('AÑO')).toBeInTheDocument();
    expect(screen.getByText('CANAL')).toBeInTheDocument();
    expect(screen.getByText('RANGO DE FECHAS')).toBeInTheDocument();
  });

  it('muestra la vista propia cuando el usuario entra con rol Cajero', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '2', nombres: 'Cajera Test', rol: 'CAJERO' },
      permisos: [],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(false),
    });

    render(
      <MemoryRouter>
        <Escritorio />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Hola, Cajera Test. Este es tu escritorio de Cajero: solo muestra lo que corresponde a tu rol.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Pedidos por confirmar').length).toBeGreaterThan(0);
    expect(screen.getByText('Para hacer ahora')).toBeInTheDocument();
  });
});
