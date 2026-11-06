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
    tiene: () => true,
  };

  const sesionMozo = {
    ...sesionAdmin,
    usuario: { id: '2', partyId: '2', nombres: 'Mozo Prueba', rol: 'MOZO' },
    tiene: (p: string) => ['iniciativas/ver', 'iniciativas/crear', 'iniciativas/comentar'].includes(p),
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

    // Los filtros son combos con su cantidad dentro de la lista
    fireEvent.click(screen.getByRole('button', { name: 'Tipo: Todas' }));
    expect(screen.getByRole('option', { name: /Quejas/ })).toHaveTextContent('1');
    expect(screen.getByRole('option', { name: /Mejoras/ })).toHaveTextContent('1');
    expect(screen.getByRole('option', { name: /Ideas/ })).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('option', { name: /Quejas/ }));
    expect(screen.getByRole('button', { name: 'Tipo: Quejas' })).toBeInTheDocument();

    // Estado y «Solo las mías» también son combos
    fireEvent.click(screen.getByRole('button', { name: 'Estado: Todos' }));
    fireEvent.click(screen.getByRole('option', { name: /En revisión/ }));
    expect(screen.getByRole('button', { name: 'Estado: En revisión' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver: Todas' }));
    fireEvent.click(screen.getByRole('option', { name: 'Solo las mías' }));
    expect(screen.getByRole('button', { name: 'Ver: Solo las mías' })).toBeInTheDocument();
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

    expect(screen.getByText('CAMBIAR ESTADO (administrador y supervisor)')).toBeInTheDocument();
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

    expect(screen.queryByText('CAMBIAR ESTADO (administrador y supervisor)')).not.toBeInTheDocument();
  });

  it('muestra miniatura en tarjeta y detalle, y al hacer clic abre el visor con botón Cerrar', async () => {
    const datosConFoto: api.RespuestaIniciativas = {
      ...datosEjemplo,
      elementos: [
        {
          ...datosEjemplo.elementos[0],
          archivoId: '10',
          fotoUrl: '/admin/archivos/10',
        },
      ],
    };
    vi.spyOn(api, 'listarIniciativas').mockResolvedValue(datosConFoto);

    render(<IniciativasView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ver captura de IN-0003' })).toBeInTheDocument();
    });

    // Clic en la miniatura de la tarjeta para abrir el visor
    fireEvent.click(screen.getByRole('button', { name: 'Ver captura de IN-0003' }));

    // Se abre el visor modal con la captura ampliada y botón Cerrar
    expect(screen.getByRole('dialog', { name: 'Visor de captura' })).toBeInTheDocument();
    expect(screen.getByText('Captura adjunta · IN-0003')).toBeInTheDocument();
    const btnCerrar = screen.getByRole('button', { name: 'Cerrar' });
    expect(btnCerrar).toBeInTheDocument();

    // Clic en Cerrar
    fireEvent.click(btnCerrar);
    expect(screen.queryByRole('dialog', { name: 'Visor de captura' })).not.toBeInTheDocument();
  });
});
