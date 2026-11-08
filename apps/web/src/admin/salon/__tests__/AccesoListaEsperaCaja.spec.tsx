import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccesoListaEsperaCaja } from '../componentes/AccesoListaEsperaCaja';
import { salonApi } from '../api';

vi.mock('../api', () => ({
  salonApi: { listarEspera: vi.fn(), asignarEspera: vi.fn(), obtenerMesas: vi.fn(), obtenerPlano: vi.fn() },
}));
vi.mock('../../../comun/socket', () => ({ useEventos: () => {} }));

const item = { pedidoId: '1', codigo: 'CP-1', estado: 'COLA', nombre: 'Miguel', celular: '***321', personas: 2, productos: 3, total: 45, desde: new Date().toISOString(), minutos: 0 };

describe('Acceso a la lista de espera en Caja', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] } as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
  });

  it('sin lista no se ve', async () => {
    vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 0, items: [] } as any);
    render(<AccesoListaEsperaCaja />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('caja-lista-espera')).not.toBeInTheDocument();
  });

  it('con lista muestra el contador y abre el panel', async () => {
    vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [item] } as any);
    render(<AccesoListaEsperaCaja />);
    const boton = await screen.findByTestId('caja-lista-espera');
    expect(boton).toHaveTextContent('Lista de espera (1)');
    fireEvent.click(boton);
    expect(await screen.findByText('Miguel')).toBeInTheDocument();
  });
});
