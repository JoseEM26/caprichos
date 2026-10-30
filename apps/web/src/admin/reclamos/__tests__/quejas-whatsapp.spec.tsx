import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as sesionModulo from '../../../comun/sesion';
import { api } from '../../../comun/api';
import { comprobantesApi } from '../../comprobantes/comprobantesApi';
import { QuejasWhatsAppTab } from '../QuejasWhatsAppTab';
import { ReclamosAdminView } from '../../comprobantes/ReclamosAdminView';
import { ParametrosOperacionTab } from '../../configuracion/ParametrosOperacionTab';
import type { RespuestaListarQuejasWhatsApp, QuejaWhatsAppItem, EstadoConexionWhatsAppInfo } from '../../comprobantes/tipos';

describe('Admin - Quejas de WhatsApp y Configuración Chatbot', () => {
  const mockRespuestaQuejas: RespuestaListarQuejasWhatsApp = {
    quejas: [
      {
        id: '1',
        origen: 'ENCUESTA',
        pedidoId: '10',
        pedidoCodigo: 'CP-1010',
        cliente: 'Carlos Mendoza',
        telefonoEnmascarado: '+51 9*** ***21',
        puntaje: 1,
        texto: 'La comida llego fria y demoro mas de 45 minutos.',
        estado: 'NUEVA',
        atendidaPor: null,
        resolucion: null,
        creadaEn: '2026-10-25T01:00:00Z',
        actualizadaEn: '2026-10-25T01:00:00Z',
      },
      {
        id: '2',
        origen: 'CHAT',
        pedidoId: '11',
        pedidoCodigo: 'CP-1011',
        cliente: 'Maria Lopez',
        telefonoEnmascarado: '+51 9*** ***33',
        puntaje: null,
        texto: 'No me llego la bebida que pedi.',
        estado: 'EN_REVISION',
        atendidaPor: 'Admin Test',
        resolucion: 'En coordinacion',
        creadaEn: '2026-10-25T01:30:00Z',
        actualizadaEn: '2026-10-25T01:30:00Z',
      },
    ],
    resumen: {
      promedio: 3.2,
      totalEncuestas: 15,
      totalQuejas: 2,
      todas: 2,
      nuevas: 1,
      enRevision: 1,
      resueltas: 0,
    },
    total: 2,
    pagina: 1,
    limite: 20,
    totalPaginas: 1,
  };

  const mockDetalleQueja: QuejaWhatsAppItem = mockRespuestaQuejas.quejas[0];

  const mockEstadoConexionSimulado: EstadoConexionWhatsAppInfo = {
    conectado: false,
    modo: 'simulado',
    razon: 'Modo simulado activo. Configure WHATSAPP_TOKEN y WHATSAPP_PHONE_ID para activar Meta Cloud API.',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: ['reclamos/ver', 'reclamos/responder', 'configuracion/ver', 'configuracion/editar'],
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

    vi.spyOn(comprobantesApi, 'listarQuejasWhatsApp').mockResolvedValue(mockRespuestaQuejas);
    vi.spyOn(comprobantesApi, 'obtenerQuejaWhatsApp').mockResolvedValue(mockDetalleQueja);
    vi.spyOn(comprobantesApi, 'cambiarEstadoQuejaWhatsApp').mockResolvedValue({ ok: true, id: '1', estado: 'EN_REVISION' });
    vi.spyOn(comprobantesApi, 'obtenerEstadoWhatsApp').mockResolvedValue(mockEstadoConexionSimulado);
  });

  it('1. ReclamosAdminView muestra las dos pestañas y permite alternar a Quejas de WhatsApp', async () => {
    vi.spyOn(comprobantesApi, 'listarReclamos').mockResolvedValue({
      total: 0,
      pagina: 1,
      limite: 20,
      items: [],
    });

    render(<ReclamosAdminView />);

    expect(screen.getByRole('tab', { name: /Libro de Reclamaciones \(Legal\)/i })).toBeInTheDocument();
    const pestanaWhatsapp = screen.getByRole('tab', { name: /Quejas de WhatsApp \(Chatbot\)/i });
    expect(pestanaWhatsapp).toBeInTheDocument();

    // Cambiar a la pestaña WhatsApp
    fireEvent.click(pestanaWhatsapp);

    await waitFor(() => {
      expect(screen.getByText(/Canal informal de atención al cliente/i)).toBeInTheDocument();
    });
  });

  it('2. QuejasWhatsAppTab muestra métricas de satisfacción y lista de quejas', async () => {
    render(<QuejasWhatsAppTab puedeResponder={true} />);

    await waitFor(() => {
      expect(screen.getByText(/3.2 \/ 5/i)).toBeInTheDocument();
      expect(screen.getByText(/15 encuestas respondidas/i)).toBeInTheDocument();
      expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
      expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
      expect(screen.getByText(/\+51 9\*\*\* \*\*\*21/i)).toBeInTheDocument();
    });
  });

  it('3. Al hacer clic en Ver detalle y cambiar estado a EN_REVISION solicita confirmación Sí/No', async () => {
    render(<QuejasWhatsAppTab puedeResponder={true} />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
    });

    const botonesDetalle = screen.getAllByRole('button', { name: /Ver detalle/i });
    fireEvent.click(botonesDetalle[0]);

    // Esperar a que se abra el modal de detalle
    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: /Detalle de queja de WhatsApp/i });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent(/La comida llego fria y demoro mas de 45 minutos/i);
    });

    // Clic en Marcar en revisión
    const botonRevision = screen.getByRole('button', { name: /Marcar en revisión/i });
    fireEvent.click(botonRevision);

    // Debe abrir el diálogo de confirmación Si/No
    await waitFor(() => {
      expect(screen.getByText('¿Marcar queja en revisión?')).toBeInTheDocument();
    });

    const botonConfirmar = screen.getByRole('button', { name: /Sí, continuar/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(comprobantesApi.cambiarEstadoQuejaWhatsApp).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ estado: 'EN_REVISION' }),
      );
    });
  });

  it('4. ParametrosOperacionTab muestra los parámetros del chatbot y la tarjeta de conexión WhatsApp solo-lectura', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/configuracion') {
        return [
          { clave: 'whatsapp_aviso_salida_activo', valor: 'true' },
          { clave: 'reparto_insistencia_min', valor: 3 },
          { clave: 'encuesta_espera_min', valor: 30 },
        ];
      }
      if (url === '/admin/reclamos/whatsapp/estado-conexion') {
        return { conectado: false, modo: 'simulado' };
      }
      return [];
    });

    render(
      <ParametrosOperacionTab
        puedeVer={true}
        puedeEditar={true}
      />,
    );

    await waitFor(() => {
      // Verifica tarjeta de estado WhatsApp sin secretos
      expect(screen.getByText(/modo simulado \(no se envia nada\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Modo seguro por defecto sin credenciales/i)).toBeInTheDocument();
      // Verifica nombres de parámetros visibles
      expect(screen.getByText('Aviso WhatsApp: Delivery en camino')).toBeInTheDocument();
      expect(screen.getByText('Tiempo para insistencia en la puerta')).toBeInTheDocument();
      expect(screen.getByText('Espera para encuesta posventa')).toBeInTheDocument();
    });
  });
});
