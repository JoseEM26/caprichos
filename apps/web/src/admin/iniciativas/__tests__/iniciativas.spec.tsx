import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IniciativasView } from '../IniciativasView';
import * as api from '../iniciativasApi';
import * as sesionModulo from '../../../comun/sesion';

describe('IniciativasView', () => {
  const sesionAdmin = {
    usuario: { id: '1', partyId: '1', nombres: 'Kevin Rosales', rol: 'ADMIN' },
    permisos: ['iniciativas/ver', 'iniciativas/crear', 'iniciativas/comentar', 'iniciativas/cambiar_estado'],
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

  const sesionMozo = {
    ...sesionAdmin,
    usuario: { id: '2', partyId: '2', nombres: 'Mozo Prueba', rol: 'MOZO' },
  };

  const datosEjemplo: api.RespuestaIniciativas = {
    conteos: {
      total: 3,
      nuevas: 1,
      enRevision: 1,
      hechas: 1,
      noPorAhora: 0,
      quejas: 1,
      mejoras: 1,
      ideas: 1,
    },
    elementos: [
      {
        id: '1',
        codigo: 'IN-0003',
        tipo: 'IDEA',
        tipoTexto: 'Idea',
        area: 'CARTA_WEB',
        areaTexto: 'Carta web',
        titulo: 'Combo desayuno: waffle + café',
        detalle: 'Muchos clientes piden waffle con café por la mañana.',
        archivoId: null,
        fotoUrl: null,
        estado: 'HECHA',
        estadoTexto: 'Hecha',
        creadoEn: '2026-10-22T06:35:45.892Z',
        fechaTexto: '22/10 06:35',
        autor: { id: '1', nombre: 'Cajera de ejemplo', rol: 'Cajero' },
        comentarios: [
          {
            id: '1',
            iniciativaId: '1',
            texto: 'Buena idea. Ya está armado como combo.',
            creadoEn: '2026-10-22T06:35:45.901Z',
            fechaTexto: '22/10 06:35',
            autor: { id: '1', nombre: 'Kevin Rosales', rol: 'Administrador' },
          },
        ],
        totalComentarios: 1,
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesionAdmin);
    vi.spyOn(api, 'listarIniciativas').mockResolvedValue(datosEjemplo);
    vi.spyOn(api, 'crearIniciativa').mockResolvedValue({ ok: true });
    vi.spyOn(api, 'comentarIniciativa').mockResolvedValue({
      id: '2',
      iniciativaId: '1',
      texto: 'Nuevo comentario test',
      creadoEn: new Date().toISOString(),
      fechaTexto: '22/10 12:00',
      autor: { id: '1', nombre: 'Kevin Rosales', rol: 'ADMIN' },
    });
    vi.spyOn(api, 'cambiarEstadoIniciativa').mockResolvedValue({
      id: '1',
      estado: 'EN_REVISION',
      estadoTexto: 'En revisión',
    });
  });

  it('renderiza contadores dinámicos, lista de iniciativas y botones de filtro', async () => {
    render(<IniciativasView />);

    await waitFor(() => {
      expect(screen.getByText('Combo desayuno: waffle + café')).toBeInTheDocument();
    });

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('+ Nueva iniciativa')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar por título, texto o persona')).toBeInTheDocument();

    expect(screen.getByText('Quejas (1)')).toBeInTheDocument();
    expect(screen.getByText('Mejoras (1)')).toBeInTheDocument();
    expect(screen.getByText('Ideas (1)')).toBeInTheDocument();
  });

  it('permite abrir "Ver y comentar", ver comentarios y escribir un comentario', async () => {
    render(<IniciativasView />);

    await waitFor(() => {
      expect(screen.getByText('Ver y comentar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ver y comentar'));

    expect(screen.getByText('Buena idea. Ya está armado como combo.')).toBeInTheDocument();

    const inputComentario = screen.getByPlaceholderText('Escribe aquí');
    fireEvent.change(inputComentario, { target: { value: 'Nuevo comentario test' } });

    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));

    await waitFor(() => {
      expect(api.comentarIniciativa).toHaveBeenCalledWith('1', 'Nuevo comentario test');
    });
  });

  it('administrador puede cambiar de estado con diálogo de confirmación Sí/No', async () => {
    render(<IniciativasView />);

    await waitFor(() => {
      expect(screen.getByText('Ver y comentar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ver y comentar'));

    expect(screen.getByText('CAMBIAR ESTADO (solo administrador)')).toBeInTheDocument();
    const btnEnRevision = screen.getByText('Pasar a En revisión');
    fireEvent.click(btnEnRevision);

    expect(screen.getByText('¿Pasar a En revisión?')).toBeInTheDocument();
    const btnConfirmar = screen.getByRole('button', { name: 'Sí, cambiar' });
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(api.cambiarEstadoIniciativa).toHaveBeenCalledWith('1', 'EN_REVISION');
    });
  });

  it('mozo no ve los botones de cambiar estado', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesionMozo);
    render(<IniciativasView />);

    await waitFor(() => {
      expect(screen.getByText('Ver y comentar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ver y comentar'));

    expect(screen.queryByText('CAMBIAR ESTADO (solo administrador)')).not.toBeInTheDocument();
  });
});
