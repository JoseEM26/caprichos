import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Escritorio } from '../admin/Escritorio';
import * as sesionModulo from '../comun/sesion';
import { api } from '../comun/api';

describe('Escritorio (/admin)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('no muestra datos inventados («Turno Día» ni «Abierto») cuando la API falla y muestra «Sin dato»', async () => {
    // Mock sesión activa de admin
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

    // Mock API que falla tanto para /carta/estado como para /admin/caja/actual
    vi.spyOn(api, 'get').mockRejectedValue(new Error('Conexión rehusada'));

    render(
      <MemoryRouter>
        <Escritorio />
      </MemoryRouter>,
    );

    await waitFor(() => {
      // Debe mostrar «Sin dato», no inventar «Abierto» ni «Turno Día»
      const tarjetaLocal = screen.getByTestId('tarjeta-estado-local');
      expect(tarjetaLocal).toHaveTextContent('Sin dato');
      expect(tarjetaLocal).not.toHaveTextContent('Turno Día');

      const tarjetaCaja = screen.getByTestId('tarjeta-caja-actual');
      expect(tarjetaCaja).toHaveTextContent('Sin dato');
      expect(tarjetaCaja).not.toHaveTextContent('Turno Día');
    });

    // Ninguna parte de la pantalla debe mostrar datos inventados
    expect(screen.queryByText(/Turno Día/i)).not.toBeInTheDocument();
  });

  it('obtiene el estado real del local desde /carta/estado cuando está abierto', async () => {
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

    vi.spyOn(api, 'get').mockImplementation((ruta: string) => {
      if (ruta === '/carta/estado') {
        return Promise.resolve({
          abierta: true,
          texto: 'Atendiendo pedidos en salón y delivery',
          pausaAltaDemanda: false,
        });
      }
      return Promise.reject(new Error(`Ruta inesperada: ${ruta}`));
    });

    render(
      <MemoryRouter>
        <Escritorio />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const tarjetaLocal = screen.getByTestId('tarjeta-estado-local');
      expect(tarjetaLocal).toHaveTextContent('Abierto');
      expect(tarjetaLocal).toHaveTextContent('Atendiendo pedidos en salón y delivery');
    });
  });

  it('obtiene el estado real del local desde /carta/estado cuando está cerrado', async () => {
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

    vi.spyOn(api, 'get').mockImplementation((ruta: string) => {
      if (ruta === '/carta/estado') {
        return Promise.resolve({
          abierta: false,
          texto: 'Abre hoy a las 16:00',
          pausaAltaDemanda: false,
        });
      }
      return Promise.reject(new Error(`Ruta inesperada: ${ruta}`));
    });

    render(
      <MemoryRouter>
        <Escritorio />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const tarjetaLocal = screen.getByTestId('tarjeta-estado-local');
      expect(tarjetaLocal).toHaveTextContent('Cerrado');
      expect(tarjetaLocal).toHaveTextContent('Abre hoy a las 16:00');
    });
  });
});
