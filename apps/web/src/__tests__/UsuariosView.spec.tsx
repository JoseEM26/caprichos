import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UsuariosView } from '../admin/usuarios/UsuariosView';
import * as sesionModulo from '../comun/sesion';
import { api } from '../comun/api';

const USUARIOS_MOCK = [
  {
    id: '1',
    partyId: '1',
    nombres: 'Carlos',
    apellidos: 'Mendoza',
    dni: '11****44',
    rol: 'ADMIN',
    activo: true,
    debeCambiar: false,
    altaEn: '2026-10-21T00:00:00.000Z',
  },
  {
    id: '2',
    partyId: '2',
    nombres: 'Lucia',
    apellidos: 'Prueba',
    dni: '44****77',
    rol: 'CAJERO',
    activo: true,
    debeCambiar: true,
    altaEn: '2026-10-21T00:00:00.000Z',
  },
  {
    id: '3',
    partyId: '3',
    nombres: 'Marcos',
    apellidos: 'Inactivo',
    dni: '77****88',
    rol: 'MOZO',
    activo: false,
    debeCambiar: false,
    altaEn: '2026-10-20T00:00:00.000Z',
  },
];

describe('UsuariosView (/admin/usuarios)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function setupSesion(rol = 'ADMIN') {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol },
      permisos: [
        'usuarios/ver',
        'usuarios/crear',
        'usuarios/editar',
        'usuarios/desactivar',
        'usuarios/reactivar',
        'usuarios/restablecer',
      ],
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
  }

  it('1. Renderiza lista con filtros y paginación', async () => {
    setupSesion('ADMIN');

    const spyGet = vi.spyOn(api, 'get').mockResolvedValue({
      total: 3,
      pagina: 1,
      limite: 15,
      totalPaginas: 1,
      elementos: USUARIOS_MOCK,
    });

    render(
      <MemoryRouter>
        <UsuariosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Carlos Mendoza/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Lucia Prueba/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Marcos Inactivo/i)[0]).toBeInTheDocument();
    });

    // Paginador
    expect(screen.getByText(/Mostrando 1 a 3 de 3 resultados/i)).toBeInTheDocument();

    // Filtro por búsqueda
    const inputBusqueda = screen.getByPlaceholderText(/Buscar por nombre o DNI/i);
    fireEvent.change(inputBusqueda, { target: { value: 'Lucia' } });

    await waitFor(() => {
      expect(spyGet).toHaveBeenCalledWith(expect.stringContaining('busqueda=Lucia'));
    });
  });

  it('filtro Estado en combo: elegir Inactivos pide solo los inactivos', async () => {
    setupSesion('ADMIN');
    const spyGet = vi.spyOn(api, 'get').mockResolvedValue({
      total: 3,
      pagina: 1,
      limite: 15,
      totalPaginas: 1,
      elementos: USUARIOS_MOCK,
    });

    render(
      <MemoryRouter>
        <UsuariosView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText(/Carlos Mendoza/i)[0]).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Estado: Todos' }));
    fireEvent.click(screen.getByRole('option', { name: /Inactivos/ }));

    expect(screen.getByRole('button', { name: 'Estado: Inactivos' })).toBeInTheDocument();
    await waitFor(() => {
      expect(spyGet).toHaveBeenLastCalledWith(expect.stringContaining('activo=false'));
    });
  });

  it('2. La contraseña inicial se muestra una sola vez y desaparece al cerrar', async () => {
    setupSesion('ADMIN');

    vi.spyOn(api, 'get').mockResolvedValue({
      total: 3,
      pagina: 1,
      limite: 15,
      totalPaginas: 1,
      elementos: USUARIOS_MOCK,
    });

    const claveInicialMock = 'X9#kL2!mP8vQ';
    const spyPost = vi.spyOn(api, 'post').mockResolvedValue({
      id: '4',
      partyId: '4',
      nombres: 'Nuevo',
      apellidos: 'Personal',
      dni: '88776655',
      rol: 'MOZO',
      activo: true,
      debeCambiar: true,
      claveInicial: claveInicialMock,
    });

    render(
      <MemoryRouter>
        <UsuariosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ Nuevo usuario/i })).toBeInTheDocument();
    });

    // Abrir modal de creación
    fireEvent.click(screen.getByRole('button', { name: /\+ Nuevo usuario/i }));
    const dialogCrear = screen.getByRole('dialog', { name: /Nuevo usuario/i });
    expect(dialogCrear).toBeInTheDocument();

    // Llenar campos dentro del diálogo
    fireEvent.change(within(dialogCrear).getByLabelText(/DNI/i), { target: { value: '88776655' } });
    fireEvent.change(within(dialogCrear).getByLabelText(/Nombres/i), { target: { value: 'Nuevo' } });
    fireEvent.change(within(dialogCrear).getByLabelText(/Apellidos/i), { target: { value: 'Personal' } });

    // Asistente por pasos: avanza hasta el resumen y crea
    for (let i = 0; i < 4; i++) {
      fireEvent.click(within(dialogCrear).getByRole('button', { name: 'Siguiente' }));
    }
    fireEvent.click(within(dialogCrear).getByRole('button', { name: 'Crear usuario' }));

    // Antes de crear pide confirmación Sí/No y todavía no llama a la API
    const dialogConfirmar = await screen.findByRole('dialog', { name: /Crear usuario/i });
    expect(spyPost).not.toHaveBeenCalled();
    fireEvent.click(within(dialogConfirmar).getByRole('button', { name: /Sí, crear/i }));

    await waitFor(() => {
      expect(spyPost).toHaveBeenCalledWith('/admin/usuarios', {
        tipoDocumento: 'DNI',
        documento: '88776655',
        nombres: 'Nuevo',
        apellidos: 'Personal',
        rol: 'CAJERO',
        horarios: [],
        reemplazos: [],
      });
    });

    // La contraseña inicial debe mostrarse en pantalla con advertencia
    await waitFor(() => {
      expect(screen.getByTestId('clave-inicial-valor')).toHaveTextContent(claveInicialMock);
      expect(screen.getByText(/ADVERTENCIA IMPORTANTE/i)).toBeInTheDocument();
      expect(screen.getByText(/Esta contraseña solo se muestra/i)).toBeInTheDocument();
    });

    // Botón copiar
    expect(screen.getByRole('button', { name: /Copiar/i })).toBeInTheDocument();

    // Cerrar modal
    fireEvent.click(screen.getByRole('button', { name: /Entendido, cerrar/i }));

    // La contraseña ya no debe estar en el DOM ni en ningún cuadro
    await waitFor(() => {
      expect(screen.queryByTestId('clave-inicial-valor')).not.toBeInTheDocument();
      expect(screen.queryByText(claveInicialMock)).not.toBeInTheDocument();
    });
  });

  it('3. Oculta el DNI y el botón "Ver DNI" para quien no es ADMIN; lo muestra y audita para ADMIN', async () => {
    // Configuración con usuario CAJERO (no ADMIN)
    setupSesion('CAJERO');

    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta.startsWith('/admin/usuarios')) {
        return {
          total: 1,
          pagina: 1,
          limite: 15,
          totalPaginas: 1,
          elementos: [USUARIOS_MOCK[0]],
        };
      }
      return {};
    });

    const { unmount } = render(
      <MemoryRouter>
        <UsuariosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Carlos Mendoza/i)[0]).toBeInTheDocument();
    });

    // Para el cajero: el DNI está enmascarado y NO existe el botón "Ver DNI"
    const dniElemento = screen.getAllByTestId('dni-1')[0];
    expect(dniElemento).toHaveTextContent('11****44');
    expect(screen.queryByRole('button', { name: /Ver DNI/i })).not.toBeInTheDocument();

    unmount();

    // Ahora como ADMIN
    setupSesion('ADMIN');
    const spyGetDni = vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/usuarios/1/dni') {
        return { id: '1', dni: '11223344' };
      }
      return {
        total: 1,
        pagina: 1,
        limite: 15,
        totalPaginas: 1,
        elementos: [USUARIOS_MOCK[0]],
      };
    });

    render(
      <MemoryRouter>
        <UsuariosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      // El botón "Ver DNI" sí está visible para ADMIN
      expect(screen.getAllByRole('button', { name: /Ver DNI/i })[0]).toBeInTheDocument();
    });

    // Hacer clic en "Ver DNI" -> pide confirmación con aviso de auditoría
    fireEvent.click(screen.getAllByRole('button', { name: /Ver DNI/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/¿Consultar DNI completo\?/i)).toBeInTheDocument();
      expect(screen.getByText(/quedará registrada en el historial de auditoría/i)).toBeInTheDocument();
    });

    // Confirmar
    fireEvent.click(screen.getByRole('button', { name: /Sí, consultar DNI/i }));

    // Llama a /admin/usuarios/1/dni y muestra el DNI sin enmascarar
    await waitFor(() => {
      expect(spyGetDni).toHaveBeenCalledWith('/admin/usuarios/1/dni');
      expect(screen.getAllByTestId('dni-1')[0]).toHaveTextContent('11223344');
      expect(screen.getAllByText(/Auditado/i)[0]).toBeInTheDocument();
    });
  });

  it('4. Exige Confirmar Sí/No antes de desactivar un usuario', async () => {
    setupSesion('ADMIN');

    vi.spyOn(api, 'get').mockResolvedValue({
      total: 1,
      pagina: 1,
      limite: 15,
      totalPaginas: 1,
      elementos: [USUARIOS_MOCK[1]], // Lucia Prueba (Activa)
    });

    const spyPost = vi.spyOn(api, 'post').mockResolvedValue({
      mensaje: 'Usuario desactivado exitosamente',
      activo: false,
    });

    render(
      <MemoryRouter>
        <UsuariosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Lucia Prueba/i)[0]).toBeInTheDocument();
    });

    // Clic en desactivar (primer botón de la tabla)
    const botonDesactivar = screen.getAllByRole('button', { name: /Desactivar/i })[0];
    fireEvent.click(botonDesactivar);

    // Debe abrir modal Confirmar, NO haber llamado a la API todavía
    expect(screen.getByText(/¿Desactivar usuario\?/i)).toBeInTheDocument();
    expect(screen.getByText(/No podrá iniciar sesión y sus sesiones abiertas se revocarán/i)).toBeInTheDocument();
    expect(spyPost).not.toHaveBeenCalled();

    // Cancelar
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(spyPost).not.toHaveBeenCalled();

    // Volver a hacer clic y confirmar
    fireEvent.click(screen.getAllByRole('button', { name: /Desactivar/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Sí, desactivar/i }));

    await waitFor(() => {
      expect(spyPost).toHaveBeenCalledWith('/admin/usuarios/2/desactivar', expect.objectContaining({ fechaSalida: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    });
  });

  it('5. La pestaña Horarios muestra los datos reales del servidor y quién reemplaza en los descansos', async () => {
    setupSesion('ADMIN');
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta.startsWith('/admin/usuarios/horarios')) {
        return [
          {
            id: '2', partyId: '2', nombres: 'Lucia', apellidos: 'Prueba', rol: 'CAJERO',
            horarios: [{ dia: 1, entrada: '08:00', salida: '16:00' }],
            reemplazos: [{ dia: 2, reemplazaPartyId: '1', nombre: 'Carlos Mendoza' }],
          },
        ];
      }
      return { total: 3, pagina: 1, limite: 15, totalPaginas: 1, elementos: USUARIOS_MOCK };
    });
    render(
      <MemoryRouter>
        <UsuariosView />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('tab', { name: /Horarios y turnos/i }));
    const fila = await screen.findByTestId('horario-2');
    expect(within(fila).getByText('08:00 a 16:00')).toBeInTheDocument();
    expect(within(fila).getByText(/Lo reemplaza: Carlos Mendoza/)).toBeInTheDocument();
    expect(within(fila).getByText(/8 h por semana/)).toBeInTheDocument();
  });
});
