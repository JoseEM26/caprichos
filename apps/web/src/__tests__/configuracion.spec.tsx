import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api, ErrorApi } from '../comun/api';
import * as sesionModulo from '../comun/sesion';
import { ConfiguracionLocalView } from '../admin/configuracion/ConfiguracionLocalView';
import { HorarioTab } from '../admin/configuracion/HorarioTab';
import { ParametrosOperacionTab } from '../admin/configuracion/ParametrosOperacionTab';
import { ZonasRepartoView } from '../admin/configuracion/ZonasRepartoView';

describe('Módulo de Configuración y Zonas de reparto', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const setupSesion = (permisos: string[] = ['local/ver', 'local/editar', 'configuracion/ver', 'configuracion/editar', 'zonas/ver', 'zonas/editar']) => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' },
      permisos,
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: (p: string) => permisos.includes(p) || permisos.includes('ADMIN'),
    });
  };

  // =========================================================================
  // 1. Validación del horario
  // =========================================================================
  describe('Validación del horario semanal', () => {
    it('muestra error y deshabilita guardar cuando abre es mayor o igual a cierra', async () => {
      setupSesion();
      const mockHorarios = [
        { dia_semana: 1, dia: 'Lunes', abre: null, cierra: null, cerrado: true },
        { dia_semana: 2, dia: 'Martes', abre: '14:00', cierra: '22:00', cerrado: false },
        { dia_semana: 3, dia: 'Miércoles', abre: '14:00', cierra: '22:00', cerrado: false },
        { dia_semana: 4, dia: 'Jueves', abre: '14:00', cierra: '22:00', cerrado: false },
        { dia_semana: 5, dia: 'Viernes', abre: '14:00', cierra: '22:00', cerrado: false },
        { dia_semana: 6, dia: 'Sábado', abre: '14:00', cierra: '22:00', cerrado: false },
        { dia_semana: 7, dia: 'Domingo', abre: '14:00', cierra: '22:00', cerrado: false },
      ];

      vi.spyOn(api, 'get').mockResolvedValueOnce(mockHorarios);

      render(<HorarioTab puedeEditar={true} />);

      await waitFor(() => {
        expect(screen.getByText('Martes')).toBeInTheDocument();
      });

      // Modificamos el horario de Martes para que abre (23:00) sea mayor a cierra (22:00)
      const inputAbreMartes = screen.getByLabelText(/Apertura Martes/i);
      fireEvent.change(inputAbreMartes, { target: { value: '23:00' } });

      // Debe aparecer el aviso de error de validación
      expect(
        screen.getByText(/La hora de apertura \(23:00\) debe ser menor a la hora de cierre \(22:00\) el Martes/i),
      ).toBeInTheDocument();

      // El botón de guardar debe estar deshabilitado
      const botonGuardar = screen.getByRole('button', { name: /Guardar horario/i });
      expect(botonGuardar).toBeDisabled();
    });
  });

  // =========================================================================
  // 2. No permitir editar sin permiso
  // =========================================================================
  describe('Control granular de permisos (ver vs editar)', () => {
    it('muestra modo sólo lectura y deshabilita inputs cuando no tiene local/editar', async () => {
      vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
        usuario: { partyId: '2', nombres: 'Cajero', rol: 'CAJERO' },
        permisos: ['local/ver'],
        debeCambiar: false,
        cargando: false,
        autenticado: true,
        ingresar: vi.fn(),
        salir: vi.fn(),
        renovar: vi.fn(),
        refrescarYo: vi.fn(),
        marcarClaveCambiada: vi.fn(),
        tiene: (p: string) => p === 'local/ver',
      });

      vi.spyOn(api, 'get').mockResolvedValueOnce({
        nombre: 'Caprichos',
        direccion: 'Av. Principal 123',
        telefono: '999999999',
        whatsapp: '999999999',
        redes: { instagram: '', facebook: '', tiktok: '' },
      });

      render(
        <MemoryRouter>
          <ConfiguracionLocalView />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Modo sólo lectura/i)).toBeInTheDocument();
      });

      // Inputs deshabilitados
      const inputNombre = screen.getByLabelText(/Nombre del local/i);
      expect(inputNombre).toBeDisabled();

      // Botón guardar deshabilitado
      const botonGuardar = screen.getByRole('button', { name: /Guardar cambios/i });
      expect(botonGuardar).toBeDisabled();
    });

    it('no muestra botones de edición en parámetros cuando no tiene configuracion/editar', async () => {
      vi.spyOn(api, 'get').mockResolvedValueOnce([
        { clave: 'puntos_porcentaje', valor: 5 },
        { clave: 'rep_max_pedidos', valor: 3 },
      ]);

      render(
        <ParametrosOperacionTab
          puedeVer={true}
          puedeEditar={false}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Modo sólo lectura/i)).toBeInTheDocument();
      });

      // No debe haber botones "Editar" disponibles
      expect(screen.queryByRole('button', { name: /^Editar$/i })).not.toBeInTheDocument();
    });

    it('deshabilita edición en Zonas cuando el usuario no tiene zonas/editar', async () => {
      vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
        usuario: { partyId: '2', nombres: 'Cajero', rol: 'CAJERO' },
        permisos: ['zonas/ver'],
        debeCambiar: false,
        cargando: false,
        autenticado: true,
        ingresar: vi.fn(),
        salir: vi.fn(),
        renovar: vi.fn(),
        refrescarYo: vi.fn(),
        marcarClaveCambiada: vi.fn(),
        tiene: (p: string) => p === 'zonas/ver',
      });

      vi.spyOn(api, 'get').mockResolvedValueOnce([
        {
          id: '1',
          codigo: 'Z2',
          tarifa: 2,
          activa: true,
          puntos: 4,
          poligono: [
            [-12.01, -76.97],
            [-12.02, -76.97],
            [-12.02, -76.96],
            [-12.01, -76.96],
          ],
        },
      ]);

      render(<ZonasRepartoView />);

      await waitFor(() => {
        expect(screen.getByText(/Zona Z2/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Modo sólo lectura/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Editar tarifa/i })).not.toBeInTheDocument();
      const botonSwitch = screen.getByRole('switch');
      expect(botonSwitch).toBeDisabled();
    });
  });

  // =========================================================================
  // 3. Confirmar antes de guardar un parámetro
  // =========================================================================
  describe('Confirmar Sí/No obligatorio antes de guardar un parámetro', () => {
    it('solicita confirmación mediante modal accesible antes de mutar el parámetro', async () => {
      vi.spyOn(api, 'get').mockResolvedValueOnce([
        { clave: 'puntos_porcentaje', valor: 5 },
      ]);

      const putSpy = vi.spyOn(api, 'put').mockResolvedValueOnce({
        clave: 'puntos_porcentaje',
        valor: 10,
      });

      render(
        <ParametrosOperacionTab
          puedeVer={true}
          puedeEditar={true}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Porcentaje de puntos/i)).toBeInTheDocument();
      });

      // Abrir edición del parámetro
      const botonEditar = screen.getByRole('button', { name: /^Editar$/i });
      fireEvent.click(botonEditar);

      // El modal de edición está abierto
      const inputValor = screen.getByLabelText(/Nuevo valor/i);
      fireEvent.change(inputValor, { target: { value: '10' } });

      const botonContinuar = screen.getByRole('button', { name: /Continuar/i });
      fireEvent.click(botonContinuar);

      // Verificamos que se abrió el diálogo de confirmación y aún NO se llamó a PUT
      expect(screen.getByText(/¿Guardar parámetro de operación\?/i)).toBeInTheDocument();
      expect(screen.getByText(/¿Confirmas cambiar el valor de "Porcentaje de puntos" a "10"\?/i)).toBeInTheDocument();
      expect(putSpy).not.toHaveBeenCalled();

      // Al pulsar "Sí, guardar", se ejecuta la llamada a la API
      const botonSi = screen.getByRole('button', { name: /Sí, guardar/i });
      fireEvent.click(botonSi);

      await waitFor(() => {
        expect(putSpy).toHaveBeenCalledWith('/admin/configuracion/puntos_porcentaje', {
          valor: 10,
        });
      });
    });
  });

  // =========================================================================
  // 4. Mensaje del servidor al rechazar
  // =========================================================================
  describe('Manejo y despliegue del mensaje de error del servidor', () => {
    it('muestra el mensaje devuelto por la API cuando rechaza la actualización de un parámetro', async () => {
      vi.spyOn(api, 'get').mockResolvedValueOnce([
        { clave: 'puntos_porcentaje', valor: 5 },
      ]);

      vi.spyOn(api, 'put').mockRejectedValueOnce(
        new ErrorApi('VALOR_INVALIDO', 'El valor debe ser un número mayor o igual a 0', 400),
      );

      render(
        <ParametrosOperacionTab
          puedeVer={true}
          puedeEditar={true}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Porcentaje de puntos/i)).toBeInTheDocument();
      });

      // Abrir edición
      fireEvent.click(screen.getByRole('button', { name: /^Editar$/i }));
      fireEvent.change(screen.getByLabelText(/Nuevo valor/i), { target: { value: '50' } });
      fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

      // Confirmar en el modal
      fireEvent.click(screen.getByRole('button', { name: /Sí, guardar/i }));

      // El mensaje exacto de la API debe ser desplegado en pantalla
      await waitFor(() => {
        expect(
          screen.getByText('El valor debe ser un número mayor o igual a 0'),
        ).toBeInTheDocument();
      });
    });

    it('muestra el mensaje del servidor cuando se rechaza el cambio de tarifa en una zona', async () => {
      vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
        usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' },
        permisos: ['zonas/ver', 'zonas/editar'],
        debeCambiar: false,
        cargando: false,
        autenticado: true,
        ingresar: vi.fn(),
        salir: vi.fn(),
        renovar: vi.fn(),
        refrescarYo: vi.fn(),
        marcarClaveCambiada: vi.fn(),
        tiene: () => true,
      });

      vi.spyOn(api, 'get').mockResolvedValueOnce([
        {
          id: '1',
          codigo: 'Z2',
          tarifa: 2,
          activa: true,
          puntos: 4,
          poligono: [
            [-12.01, -76.97],
            [-12.02, -76.97],
            [-12.02, -76.96],
            [-12.01, -76.96],
          ],
        },
      ]);

      vi.spyOn(api, 'put').mockRejectedValueOnce(
        new ErrorApi('TARIFA_INVALIDA', 'La tarifa debe ser un número mayor o igual a 0', 400),
      );

      render(<ZonasRepartoView />);

      await waitFor(() => {
        expect(screen.getByText(/Zona Z2/i)).toBeInTheDocument();
      });

      // Abrir edición de tarifa
      fireEvent.click(screen.getByRole('button', { name: /Editar tarifa/i }));
      fireEvent.change(screen.getByLabelText(/Nueva tarifa/i), { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

      // Confirmar
      fireEvent.click(screen.getByRole('button', { name: /Sí, actualizar tarifa/i }));

      // Debe mostrar el error del servidor
      await waitFor(() => {
        expect(
          screen.getByText('La tarifa debe ser un número mayor o igual a 0'),
        ).toBeInTheDocument();
      });
    });
  });
});
