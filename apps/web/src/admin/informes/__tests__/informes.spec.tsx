import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InformesView } from '../InformesView';
import { IndicadoresView } from '../IndicadoresView';
import { MapaEntregasView } from '../MapaEntregasView';
import * as sesionModulo from '../../../comun/sesion';

describe('Vistas de Análisis e Informes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: ['auditoria/ver', 'zonas/ver'],
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
  });

  describe('InformesView', () => {
    it('muestra el catálogo de reportes y permite buscar', async () => {
      render(
        <MemoryRouter>
          <InformesView />
        </MemoryRouter>,
      );

      expect(screen.getByText('Resumen del día')).toBeInTheDocument();
      expect(screen.getByText('Ventas por producto')).toBeInTheDocument();

      const busquedaInput = screen.getByPlaceholderText(/buscar informe/i);
      fireEvent.change(busquedaInput, { target: { value: 'producto' } });

      expect(screen.getByText('Ventas por producto')).toBeInTheDocument();
      expect(screen.queryByText('Resumen del día')).not.toBeInTheDocument();
    });

    it('abre el modal de detalle del reporte al hacer clic en Abrir informe', async () => {
      render(
        <MemoryRouter>
          <InformesView />
        </MemoryRouter>,
      );

      const botonAbrir = screen.getAllByRole('button', { name: /abrir informe/i })[0];
      fireEvent.click(botonAbrir);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /descargar en excel/i })).toBeInTheDocument();
    });
  });

  describe('IndicadoresView', () => {
    it('renderiza las metas y solicita confirmación para cambiar estrellas', async () => {
      render(
        <MemoryRouter>
          <IndicadoresView />
        </MemoryRouter>,
      );

      expect(screen.getByText('Tiempo de entrega')).toBeInTheDocument();
      expect(screen.getByText('Ventas de productos agotados')).toBeInTheDocument();

      const botonEstrellas = screen.getByRole('button', { name: /activadas/i });
      fireEvent.click(botonEstrellas);

      expect(screen.getByText(/¿Quitar las estrellas de la carta\?/i)).toBeInTheDocument();
    });
  });

  describe('MapaEntregasView', () => {
    it('renderiza los KPIs del mapa y controles de capa', () => {
      render(
        <MemoryRouter>
          <MapaEntregasView />
        </MemoryRouter>,
      );

      expect(screen.getByText('Pedidos con entrega')).toBeInTheDocument();
      expect(screen.getByText('Intentos fuera de cobertura')).toBeInTheDocument();
      expect(screen.getByText('Capas')).toBeInTheDocument();
    });
  });
});
