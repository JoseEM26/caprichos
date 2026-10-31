import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuditoriaView } from '../admin/usuarios/AuditoriaView';
import * as sesionModulo from '../comun/sesion';
import { api } from '../comun/api';

const REGISTROS_MOCK = [
  {
    id: '101',
    categoria: 'CAMBIO',
    modulo: 'usuarios',
    accion: 'CREAR',
    resultado: 'OK',
    entidad: 'user_account',
    entidadId: '4',
    antes: null,
    despues: { nombres: 'Ana', apellidos: 'García', rol: 'CAJERO' },
    motivo: null,
    partyId: '1',
    conPinAdmin: false,
    ip: '127.0.0.1',
    dispositivo: 'Navegador Web',
    requestId: null,
    en: '2026-10-21T18:30:00.000Z',
    hashAnterior: 'abc123hash',
    hash: 'def456hash',
  },
  {
    id: '100',
    categoria: 'ACCESO',
    modulo: 'acceso',
    accion: 'INGRESO_FALLIDO',
    resultado: 'RECHAZADO',
    entidad: null,
    entidadId: null,
    antes: null,
    despues: null,
    motivo: 'CREDENCIALES_INVALIDAS',
    partyId: '2',
    conPinAdmin: false,
    ip: '192.168.1.10',
    dispositivo: 'Móvil Android',
    requestId: null,
    en: '2026-10-21T18:25:00.000Z',
    hashAnterior: 'prev123hash',
    hash: 'abc123hash',
  },
];

describe('AuditoriaView (/admin/historial)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function setupSesion(tienePermiso = true) {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: tienePermiso ? ['auditoria/ver'] : [],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockImplementation((p: string) => (p === 'auditoria/ver' ? tienePermiso : false)),
    });
  }

  it('renderiza la lista de auditoría con resultados OK y RECHAZADO con Insignia', async () => {
    setupSesion(true);

    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta.startsWith('/admin/auditoria')) {
        return {
          total: 2,
          pagina: 1,
          limite: 20,
          paginas: 1,
          datos: REGISTROS_MOCK,
        };
      }
      return {};
    });

    render(
      <MemoryRouter>
        <AuditoriaView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/USUARIOS · CREAR/i)).toBeInTheDocument();
      expect(screen.getByText(/ACCESO · INGRESO_FALLIDO/i)).toBeInTheDocument();
    });

    // Insignias OK y RECHAZADO
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('RECHAZADO')).toBeInTheDocument();

    // Ver detalle expandible
    const botonDetalle = screen.getAllByRole('button', { name: /Ver datos y huella/i })[0];
    fireEvent.click(botonDetalle);

    await waitFor(() => {
      expect(screen.getByText(/HUELLA ACTUAL \(SHA-256\):/i)).toBeInTheDocument();
      expect(screen.getByText(/def456hash/i)).toBeInTheDocument();
      expect(screen.getByText(/ESTADO DESPUÉS/i)).toBeInTheDocument();
    });
  });

  it('el botón «Verificar cadena» llama a /admin/auditoria/verificar y muestra Válida', async () => {
    setupSesion(true);

    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/auditoria/verificar') {
        return {
          valida: true,
          totalFilas: 105,
          discrepancias: 0,
        };
      }
      if (ruta.startsWith('/admin/auditoria')) {
        return {
          total: 2,
          pagina: 1,
          limite: 20,
          paginas: 1,
          datos: REGISTROS_MOCK,
        };
      }
      return {};
    });

    render(
      <MemoryRouter>
        <AuditoriaView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Verificar cadena/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Verificar cadena/i }));

    await waitFor(() => {
      expect(screen.getByText(/Cadena criptográfica íntegra:/i)).toBeInTheDocument();
      expect(screen.getByText(/Válida/i)).toBeInTheDocument();
      expect(screen.getByText(/105 registros verificados sin alteraciones/i)).toBeInTheDocument();
    });
  });

  it('los filtros de Historial son combos: Resultado Rechazados pide solo los rechazados', async () => {
    setupSesion(true);
    const spyGet = vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta.startsWith('/admin/auditoria/verificar')) return { valida: true, totalFilas: 2, discrepancias: 0 };
      if (ruta.startsWith('/admin/auditoria')) return { total: 2, pagina: 1, limite: 20, paginas: 1, datos: REGISTROS_MOCK };
      return {};
    });

    render(
      <MemoryRouter>
        <AuditoriaView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resultado: Todos' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Resultado: Todos' }));
    fireEvent.click(screen.getByRole('option', { name: 'Rechazados' }));

    expect(screen.getByRole('button', { name: 'Resultado: Rechazados' })).toBeInTheDocument();
    await waitFor(() => {
      expect(spyGet).toHaveBeenLastCalledWith(expect.stringContaining('resultado=RECHAZADO'));
    });
  });

  it('muestra pantalla sin permiso si el usuario no tiene auditoria/ver', async () => {
    setupSesion(false);

    render(
      <MemoryRouter>
        <AuditoriaView />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Sin permiso de auditoría/i)).toBeInTheDocument();
  });
});
