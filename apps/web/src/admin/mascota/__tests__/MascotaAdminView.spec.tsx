import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MascotaAdminView } from '../MascotaAdminView';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { CONFIGURACION_DEFECTO } from '../../../mascota';

describe('MascotaAdminView.tsx', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock por defecto de useSesion como ADMIN
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: 'usr-admin-1', nombres: 'Admin', rol: 'ADMIN' },
      permisos: ['ADMIN', 'mascota/ver', 'mascota/editar'],
      tiene: () => true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      autenticado: true,
      cargando: false,
      debeCambiar: false,
      marcarClaveCambiada: vi.fn(),
    });

    // Mock de API
    vi.spyOn(api, 'get').mockResolvedValue({
      ok: true,
      config: CONFIGURACION_DEFECTO,
      aspectoResuelto: CONFIGURACION_DEFECTO.base,
      temaActivo: 'halloween',
    });
  });

  it('renderiza el título, subtítulo e indicador de tema activo', async () => {
    render(<MascotaAdminView />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Mascota Capri' })).toBeInTheDocument();
    });

    expect(screen.getByText(/Así se ve hoy en la carta:/i)).toBeInTheDocument();
    expect(screen.getByText('Vista Previa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aspecto Base' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Temporadas y Modo' })).toBeInTheDocument();
  });

  it('permite conmutar entre 3D y 2D en la vista previa', async () => {
    render(<MascotaAdminView />);

    await waitFor(() => {
      expect(screen.getByText('3D Interactivo')).toBeInTheDocument();
    });

    const boton2D = screen.getByRole('button', { name: '2D Accesible' });
    fireEvent.click(boton2D);

    const boton3D = screen.getByRole('button', { name: '3D Interactivo' });
    fireEvent.click(boton3D);
  });

  it('permite cambiar entre pestañas de Aspecto Base y Temporadas y Modo', async () => {
    render(<MascotaAdminView />);

    await waitFor(() => {
      expect(screen.getByText('Tono de Piel')).toBeInTheDocument();
    });

    // Cambiar a Temporadas y Modo
    const tabTemporadas = screen.getByRole('button', { name: 'Temporadas y Modo' });
    fireEvent.click(tabTemporadas);

    expect(screen.getByText('Modo de visualización')).toBeInTheDocument();
    expect(screen.getByText('Temas de Temporada')).toBeInTheDocument();
    expect(screen.getByText('Halloween')).toBeInTheDocument();

    // Volver a Aspecto Base
    const tabBase = screen.getByRole('button', { name: 'Aspecto Base' });
    fireEvent.click(tabBase);

    expect(screen.getByText('Tono de Piel')).toBeInTheDocument();
  });

  it('el botón "Ver este tema" previsualiza el tema sin guardarlo', async () => {
    render(<MascotaAdminView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Temporadas y Modo' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Temporadas y Modo' }));

    const botonesVerTema = screen.getAllByRole('button', { name: 'Ver este tema' });
    expect(botonesVerTema.length).toBeGreaterThan(0);

    // Clic en ver el primer tema
    fireEvent.click(botonesVerTema[0]);

    // Debe aparecer la insignia indicativa en la vista previa
    expect(screen.getByText(/Viendo:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a hoy' })).toBeInTheDocument();

    // Clic en volver a hoy
    fireEvent.click(screen.getByRole('button', { name: 'Volver a hoy' }));
    expect(screen.queryByText(/Viendo:/i)).toBeNull();
  });

  it('abre modal de confirmación al pulsar "Guardar cambios" y llama a PUT /admin/mascota al confirmar', async () => {
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });

    render(<MascotaAdminView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
    });

    // Clic en Guardar cambios
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    // Diálogo de Confirmar modal debe abrirse
    expect(screen.getByText('¿Guardar cambios en la mascota Capri?')).toBeInTheDocument();

    // Confirmar con el botón "Sí, guardar"
    const botonConfirmar = screen.getByRole('button', { name: 'Sí, guardar' });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith('/admin/mascota', expect.any(Object));
    });
  });

  it('abre modal de confirmación al pulsar "Restablecer de fábrica" y llama a POST /admin/mascota/restablecer', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ ok: true });

    render(<MascotaAdminView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Restablecer de fábrica' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Restablecer de fábrica' }));

    expect(screen.getByText('¿Restablecer Capri a los valores de fábrica?')).toBeInTheDocument();

    const botonConfirmar = screen.getByRole('button', { name: 'Sí, restablecer' });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/admin/mascota/restablecer', {});
    });
  });

  it('deshabilita botones de guardado si el usuario no tiene permiso mascota/editar', async () => {
    // Usuario sin permiso de edición
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: 'usr-mozo-1', nombres: 'Mozo', rol: 'MOZO' },
      permisos: ['mascota/ver'],
      tiene: (permiso: string) => permiso === 'mascota/ver',
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      autenticado: true,
      cargando: false,
      debeCambiar: false,
      marcarClaveCambiada: vi.fn(),
    });

    render(<MascotaAdminView />);

    await waitFor(() => {
      expect(screen.getByText(/Modo solo lectura/i)).toBeInTheDocument();
    });

    const botonGuardar = screen.getByRole('button', { name: 'Guardar cambios' });
    const botonRestablecer = screen.getByRole('button', { name: 'Restablecer de fábrica' });

    expect(botonGuardar).toBeDisabled();
    expect(botonRestablecer).toBeDisabled();
  });
});
