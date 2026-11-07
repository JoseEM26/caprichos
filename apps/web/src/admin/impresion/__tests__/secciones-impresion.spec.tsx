import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SeccionEquipos } from '../SeccionEquipos';
import { SeccionColaPruebas } from '../SeccionColaPruebas';
import { saludEquipos, seccionDesdeUrl } from '../seccionesImpresion';
import { impresionApi } from '../impresionApi';
import * as sesionModule from '../../../comun/sesion';

vi.mock('../impresionApi', () => ({
  impresionApi: {
    obtenerEstado: vi.fn(),
    listarTrabajos: vi.fn(),
    reintentarTrabajo: vi.fn(),
    listarLlaves: vi.fn(),
    crearLlave: vi.fn(),
    desactivarLlave: vi.fn(),
  },
}));

const estadoMock = {
  agente: 'conectado',
  ultimoLatido: '2026-10-27T12:00:00.000Z',
  impresora: 'lista',
  pendientes: 2,
  fallidos: 1,
};

const fallidosMock = {
  items: [
    {
      id: '15',
      pedidoId: '101',
      pedidoCodigo: 'CP-101',
      clienteNombre: 'Maria Flores',
      tipo: 'ETIQUETA_GENERAL',
      estado: 'FALLIDO',
      intentos: 5,
      error: 'Cabezal desconectado',
      copia: false,
      en: '2026-10-27T12:00:00.000Z',
      payload: {},
    },
  ],
  total: 1,
  pagina: 1,
  paginas: 1,
};

const llavesMock = [
  {
    id: '1',
    nombre: 'Agente PC Caja',
    activo: true,
    creadoEn: '2026-10-27T10:00:00.000Z',
    ultimoLatido: '2026-10-27T12:00:00.000Z',
    llaveMuestra: 'Termina en ...4A1B',
  },
];

function usarRol(rol: string) {
  vi.spyOn(sesionModule, 'useSesion').mockReturnValue({
    usuario: { id: '1', partyId: '1', nombres: 'Prueba', rol },
    tiene: () => true,
  } as any);
}

describe('SeccionEquipos (Equipos y estado)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (impresionApi.obtenerEstado as any).mockResolvedValue(estadoMock);
    (impresionApi.listarLlaves as any).mockResolvedValue(llavesMock);
    (impresionApi.crearLlave as any).mockResolvedValue({
      id: '2',
      nombre: 'Agente PC Nueva',
      llave: 'agk_clave_secreta_999',
      creadoEn: '2026-10-27T12:05:00.000Z',
      mensaje: 'Guarda esta llave',
    });
    (impresionApi.desactivarLlave as any).mockResolvedValue({ ok: true, mensaje: 'Llave desactivada' });
    usarRol('ADMIN');
  });

  it('muestra el agente, la impresora y cada máquina con su estado', async () => {
    render(<SeccionEquipos />);
    await waitFor(() => {
      expect(screen.getByText('Conectado')).toBeInTheDocument();
      expect(screen.getByText('Lista para imprimir')).toBeInTheDocument();
      expect(screen.getByTestId('maquina-etiquetera')).toHaveTextContent('Etiquetera (etiquetas)');
      expect(screen.getByTestId('maquina-ticketera')).toHaveTextContent('Ticketera (tickets)');
    });
    // lo de la cola es de la otra sección
    expect(screen.queryByText('2 pendientes')).not.toBeInTheDocument();
  });

  it('ADMIN puede crear una llave de agente y se muestra una sola vez con aviso de seguridad', async () => {
    render(<SeccionEquipos />);
    await waitFor(() => expect(screen.getByText('Crear llave de agente')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Crear llave de agente'));

    await waitFor(() => {
      expect(impresionApi.crearLlave).toHaveBeenCalled();
      expect(screen.getByText(/Esta llave se muestra una sola vez/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('agk_clave_secreta_999')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Entendido, ya la copié/i }));
    expect(screen.queryByText(/Esta llave se muestra una sola vez/i)).not.toBeInTheDocument();
  });

  it('ADMIN puede desactivar una llave existente con confirmación Sí/No', async () => {
    render(<SeccionEquipos />);
    await waitFor(() => expect(screen.getByText(/Termina en \.\.\.4A1B/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(screen.getByText(/¿Desactivar llave de agente "Agente PC Caja"\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sí, desactivar/i }));

    await waitFor(() => expect(impresionApi.desactivarLlave).toHaveBeenCalledWith('1'));
  });

  it('usuario no ADMIN ve el aviso informativo y no los controles de llaves', async () => {
    usarRol('CAJERO');
    render(<SeccionEquipos />);
    await waitFor(() => {
      expect(screen.getByText(/Inicia sesión como Administrador para crear o desactivar llaves del agente/i)).toBeInTheDocument();
      expect(screen.queryByText('Crear llave de agente')).not.toBeInTheDocument();
    });
  });

  it('el botón de instalar o vincular abre el panel del programa', async () => {
    render(<SeccionEquipos />);
    await waitFor(() => expect(screen.getByText('Conectado')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Instalar o vincular programa/i }));
    expect(screen.getByRole('dialog', { name: 'Instalar programa de impresión' })).toBeInTheDocument();
  });
});

describe('SeccionColaPruebas (Cola y pruebas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (impresionApi.obtenerEstado as any).mockResolvedValue(estadoMock);
    (impresionApi.listarTrabajos as any).mockResolvedValue(fallidosMock);
    (impresionApi.reintentarTrabajo as any).mockResolvedValue({ ok: true, mensaje: 'Devuelto a la cola' });
    usarRol('ADMIN');
  });

  it('muestra el conteo de la cola y las pruebas de las máquinas', async () => {
    render(<SeccionColaPruebas />);
    await waitFor(() => {
      expect(screen.getByText('2 pendientes')).toBeInTheDocument();
      expect(screen.getByText('1 fallidos')).toBeInTheDocument();
      expect(screen.getByText('Pruebas de impresión')).toBeInTheDocument();
      expect(screen.getByText('Etiquetera: no conectada')).toBeInTheDocument();
    });
    // lo de equipos no está aquí
    expect(screen.queryByText('Llaves de autenticación del agente')).not.toBeInTheDocument();
  });

  it('permite desplegar fallidos y reintentar con diálogo Sí/No', async () => {
    render(<SeccionColaPruebas />);
    await waitFor(() => expect(screen.getByText('Ver y reintentar fallidos')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Ver y reintentar fallidos'));
    await waitFor(() => {
      expect(screen.getByText(/Trabajo #15 · ETIQUETA_GENERAL/i)).toBeInTheDocument();
      expect(screen.getByText(/Intentos: 5\/5/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByText('¿Reintentar trabajo #15?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sí, reintentar/i }));

    await waitFor(() => expect(impresionApi.reintentarTrabajo).toHaveBeenCalledWith('15'));
  });
});

describe('funciones puras del módulo Impresión', () => {
  it('seccionDesdeUrl: enlace viejo, sección explícita y, si no hay, la pantalla fácil', () => {
    expect(seccionDesdeUrl('mapa-impresion', null, 'cola')).toBe('mapa');
    expect(seccionDesdeUrl('impresion', null, 'mapa')).toBe('facil');
    expect(seccionDesdeUrl('impresion', 'cola', 'mapa')).toBe('cola');
    expect(seccionDesdeUrl('impresion', 'facil', null)).toBe('facil');
    expect(seccionDesdeUrl('impresion', 'inventada', 'cola')).toBe('facil');
  });

  it('saludEquipos: verde, ámbar, roja o sin datos', () => {
    const conectada = { conectada: true, estado: 'lista', motivo: null };
    const caida = { conectada: false, estado: 'desconectada', motivo: 'USB' };
    expect(saludEquipos(null).nivel).toBe('sin_datos');
    expect(saludEquipos({ ETIQUETERA: conectada, TICKETERA: conectada } as any)).toMatchObject({ nivel: 'ok' });
    expect(saludEquipos({ ETIQUETERA: caida, TICKETERA: conectada } as any).nivel).toBe('aviso');
    expect(saludEquipos({ ETIQUETERA: caida, TICKETERA: caida } as any).nivel).toBe('falla');
    expect(saludEquipos({ ETIQUETERA: { ...caida, estado: 'sin_programa' }, TICKETERA: conectada } as any).nivel).toBe('falla');
  });
});
