import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as sesionModulo from '../../../comun/sesion';
import { comprobantesApi } from '../comprobantesApi';
import { PorEmitirTab } from '../PorEmitirTab';

const comprobante = (id: string, tipo: string, emision: string) => ({
  id,
  pedido_id: `p${id}`,
  codigo_pedido: `CP-${id}`,
  tipo,
  serie: 'B001',
  numero: Number(id),
  numero_texto: `B001-${id}`,
  documento: null,
  razon_social: null,
  total: 20,
  fecha: '2026-10-28T20:00:00Z',
  emision,
  copias_impresas: 0,
});

describe('PorEmitirTab: filtros Tipo y Estado en combo', () => {
  beforeEach(() => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: ['comprobantes/ver', 'comprobantes/emitir'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    } as any);
    // El servidor filtra: el mock respeta tipo y devuelve el total real
    vi.spyOn(comprobantesApi, 'listarPorEmitir').mockImplementation(async (_p, _l, f) => {
      const todos = [comprobante('1', 'BOLETA', 'POR_EMITIR'), comprobante('2', 'FACTURA', 'POR_EMITIR')];
      const elementos = todos.filter((c) => !f?.tipo || f.tipo === 'TODOS' || c.tipo === f.tipo);
      return { elementos, pagina: 1, total: elementos.length, paginas: 1 } as any;
    });
  });

  it('Tipo y Estado son combos; elegir Facturas deja solo las facturas por emitir', async () => {
    render(
      <MemoryRouter>
        <PorEmitirTab />
      </MemoryRouter>,
    );
    expect(await screen.findByText('2 pendientes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tipo: Todos' }));
    fireEvent.click(screen.getByRole('option', { name: 'Facturas' }));

    expect(screen.getByRole('button', { name: 'Tipo: Facturas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estado: Todos' })).toBeInTheDocument();
    expect(await screen.findByText('1 pendiente')).toBeInTheDocument();
    expect(comprobantesApi.listarPorEmitir).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ tipo: 'FACTURA' }));
  });
});
