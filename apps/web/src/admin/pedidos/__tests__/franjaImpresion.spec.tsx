import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FranjaImpresion } from '../FranjaImpresion';
import { impresionApi } from '../../impresion/impresionApi';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
vi.mock('../../impresion/impresionApi', () => ({
  impresionApi: { obtenerEstado: vi.fn(), listarCola: vi.fn(), vaciarCola: vi.fn(), descartarPedido: vi.fn(), reimprimirTodas: vi.fn() },
}));

const base = { agente: 'conectado', impresora: 'lista', ultimoLatido: null, conteos: {} };

function montar() {
  return render(
    <MemoryRouter>
      <FranjaImpresion />
    </MemoryRouter>,
  );
}

describe('FranjaImpresion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aparece con etiquetas en cola y el agente desconectado, con enlace a Impresión', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({
      ...base, agente: 'sin_conexion', impresora: 'desconectada', pendientes: 4, fallidos: 0,
    } as any);

    montar();

    expect(await screen.findByTestId('franja-impresion')).toHaveTextContent('Impresora sin conexión: 4 etiqueta(s) en cola');
    expect(screen.getByRole('link', { name: 'Ver impresión' })).toHaveAttribute('href', '/admin/configuracion?tab=impresion');
    expect(screen.getByRole('button', { name: 'Gestionar cola' })).toBeInTheDocument();
  });

  it('aparece si la impresora tiene error con el agente conectado', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({
      ...base, impresora: 'sin_papel', pendientes: 2, fallidos: 0,
    } as any);

    montar();

    expect(await screen.findByTestId('franja-impresion')).toBeInTheDocument();
  });

  it('no aparece sin etiquetas en cola aunque el agente esté apagado', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({
      ...base, agente: 'sin_conexion', impresora: 'desconectada', pendientes: 0, fallidos: 0,
    } as any);

    montar();

    await waitFor(() => expect(impresionApi.obtenerEstado).toHaveBeenCalled());
    expect(screen.queryByTestId('franja-impresion')).not.toBeInTheDocument();
  });

  it('no aparece con agente conectado e impresora lista', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({ ...base, pendientes: 3, fallidos: 0 } as any);

    montar();

    await waitFor(() => expect(impresionApi.obtenerEstado).toHaveBeenCalled());
    expect(screen.queryByTestId('franja-impresion')).not.toBeInTheDocument();
  });
});
