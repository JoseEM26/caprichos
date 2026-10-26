import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TarjetaImpresionEtiquetas } from '../TarjetaImpresionEtiquetas';
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

describe('TarjetaImpresionEtiquetas (componente)', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    (impresionApi.obtenerEstado as any).mockResolvedValue(estadoMock);
    (impresionApi.listarTrabajos as any).mockResolvedValue(fallidosMock);
    (impresionApi.listarLlaves as any).mockResolvedValue(llavesMock);
    (impresionApi.reintentarTrabajo as any).mockResolvedValue({ ok: true, mensaje: 'Devuelto a la cola' });
    (impresionApi.crearLlave as any).mockResolvedValue({
      id: '2',
      nombre: 'Agente PC Nueva',
      llave: 'agk_clave_secreta_999',
      creadoEn: '2026-10-27T12:05:00.000Z',
      mensaje: 'Guarda esta llave',
    });
    (impresionApi.desactivarLlave as any).mockResolvedValue({ ok: true, mensaje: 'Llave desactivada' });

    vi.spyOn(sesionModule, 'useSesion').mockReturnValue({
      usuario: { id: '1', partyId: '1', nombres: 'Admin', rol: 'ADMIN' },
      tiene: () => true,
    } as any);
  });

  it('1. renderiza cabecera, estado del agente e impresora y conteo de cola', async () => {
    render(<TarjetaImpresionEtiquetas />);

    await waitFor(() => {
      expect(screen.getByText('Impresión de etiquetas')).toBeInTheDocument();
      expect(screen.getByText('Conectado')).toBeInTheDocument();
      expect(screen.getByText('Lista para imprimir')).toBeInTheDocument();
      expect(screen.getByText('2 pendientes')).toBeInTheDocument();
      expect(screen.getByText('1 fallidos')).toBeInTheDocument();
    });
  });

  it('2. permite desplegar fallidos y reintentar con diálogo Sí/No Confirmar', async () => {
    render(<TarjetaImpresionEtiquetas />);

    await waitFor(() => {
      expect(screen.getByText('Ver y reintentar fallidos')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ver y reintentar fallidos'));

    await waitFor(() => {
      expect(screen.getByText(/Trabajo #15 · ETIQUETA_GENERAL/i)).toBeInTheDocument();
      expect(screen.getByText(/Intentos: 5\/5/i)).toBeInTheDocument();
    });

    const btnReintentar = screen.getByRole('button', { name: 'Reintentar' });
    fireEvent.click(btnReintentar);

    // Diálogo Confirmar Sí/No
    expect(screen.getByText('¿Reintentar trabajo #15?')).toBeInTheDocument();
    const btnSi = screen.getByRole('button', { name: /Sí, reintentar/i });
    fireEvent.click(btnSi);

    await waitFor(() => {
      expect(impresionApi.reintentarTrabajo).toHaveBeenCalledWith('15');
    });
  });

  it('3. ADMIN puede crear una llave de agente y se muestra una sola vez con aviso de seguridad', async () => {
    render(<TarjetaImpresionEtiquetas />);

    await waitFor(() => {
      expect(screen.getByText('Crear llave de agente')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Crear llave de agente'));

    await waitFor(() => {
      expect(impresionApi.crearLlave).toHaveBeenCalled();
      expect(screen.getByText(/Esta llave se muestra una sola vez/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('agk_clave_secreta_999')).toBeInTheDocument();
    });

    // Cerrar modal
    fireEvent.click(screen.getByRole('button', { name: /Entendido, ya la copié/i }));
    expect(screen.queryByText(/Esta llave se muestra una sola vez/i)).not.toBeInTheDocument();
  });

  it('4. ADMIN puede desactivar una llave existente con confirmación Sí/No', async () => {
    render(<TarjetaImpresionEtiquetas />);

    await waitFor(() => {
      expect(screen.getByText(/Termina en \.\.\.4A1B/i)).toBeInTheDocument();
    });

    const btnDesactivar = screen.getByRole('button', { name: 'Desactivar' });
    fireEvent.click(btnDesactivar);

    expect(screen.getByText(/¿Desactivar llave de agente "Agente PC Caja"\?/i)).toBeInTheDocument();
    const btnConfirmar = screen.getByRole('button', { name: /Sí, desactivar/i });
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(impresionApi.desactivarLlave).toHaveBeenCalledWith('1');
    });
  });

  it('5. Usuario no ADMIN ve mensaje informativo y no los controles de creación/desactivación', async () => {
    vi.spyOn(sesionModule, 'useSesion').mockReturnValue({
      usuario: { id: '2', partyId: '2', nombres: 'Cajero', rol: 'CAJERO' },
      tiene: () => true,
    } as any);

    render(<TarjetaImpresionEtiquetas />);

    await waitFor(() => {
      expect(screen.getByText(/Inicia sesión como Administrador para crear o desactivar llaves del agente/i)).toBeInTheDocument();
      expect(screen.queryByText('Crear llave de agente')).not.toBeInTheDocument();
    });
  });
});
