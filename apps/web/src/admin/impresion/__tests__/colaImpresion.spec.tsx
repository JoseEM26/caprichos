import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ColaImpresion } from '../ColaImpresion';
import { impresionApi } from '../impresionApi';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
vi.mock('../impresionApi', () => ({
  impresionApi: {
    obtenerEstado: vi.fn(),
    listarCola: vi.fn(),
    vaciarCola: vi.fn(),
    descartarPedido: vi.fn(),
    reimprimirTodas: vi.fn(),
  },
}));

const cola = {
  items: [
    {
      pedidoId: '7', pedidoCodigo: 'CP-007', clienteNombre: 'Ana', cantidad: 3,
      estados: { PENDIENTE: 3 }, masAntiguaEn: new Date(Date.now() - 90 * 60000).toISOString(), error: null, trabajoIds: ['1', '2', '3'],
    },
  ],
  total: 1, pagina: 1, paginas: 1,
  resumen: { pendientes: 34, enCurso: 0, fallidos: 1, vencidos: 2, descartados: 0, pendientesAntiguas: 30, minutosAntiguas: 30 },
};

describe('ColaImpresion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(impresionApi.listarCola).mockResolvedValue(cola as any);
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({ agente: 'sin_conexion', impresora: 'desconectada', ultimoLatido: null, pendientes: 34, fallidos: 1 } as any);
  });

  it('muestra resumen y la lista agrupada por pedido', async () => {
    render(<ColaImpresion alCerrar={() => {}} />);
    const grupo = await screen.findByTestId('cola-grupo');
    expect(grupo).toHaveTextContent('CP-007 · Ana');
    expect(grupo).toHaveTextContent('3 etiqueta(s)');
    expect(screen.getByTestId('cola-resumen')).toHaveTextContent('Programa sin conexión');
    expect(screen.getByText(/no se imprimen aunque la impresora vuelva/)).toBeInTheDocument();
  });

  it('vaciar exige motivo y confirmación Sí/No que dice cuántas se descartan', async () => {
    vi.mocked(impresionApi.vaciarCola).mockResolvedValue({ ok: true, descartadas: 30, mensaje: 'Se descartaron 30 etiqueta(s); no se imprimirán' });
    render(<ColaImpresion alCerrar={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Vaciar cola' }));
    const continuar = screen.getByRole('button', { name: 'Continuar' });
    expect(continuar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Impresora apagada' } });
    fireEvent.click(continuar);
    expect(screen.getByRole('dialog', { name: 'Vaciar cola de impresión' })).toHaveTextContent('Se descartarán 30 etiqueta(s) y NO se imprimirán');
    expect(impresionApi.vaciarCola).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, vaciar' }));
    await waitFor(() =>
      expect(impresionApi.vaciarCola).toHaveBeenCalledWith({ alcance: 'ANTIGUAS', minutos: 30, motivo: 'Impresora apagada' }),
    );
  });

  it('descartar por pedido pide confirmación y llama a la API', async () => {
    vi.mocked(impresionApi.descartarPedido).mockResolvedValue({ ok: true, descartadas: 3, mensaje: 'ok' });
    render(<ColaImpresion alCerrar={() => {}} />);
    const grupo = await screen.findByTestId('cola-grupo');
    fireEvent.click(within(grupo).getByRole('button', { name: 'Descartar' }));
    expect(impresionApi.descartarPedido).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    await waitFor(() => expect(impresionApi.descartarPedido).toHaveBeenCalledWith('7'));
  });

  it('muestra estado vacío y de error', async () => {
    vi.mocked(impresionApi.listarCola).mockResolvedValueOnce({ ...cola, items: [], total: 0 } as any);
    const { unmount } = render(<ColaImpresion alCerrar={() => {}} />);
    expect(await screen.findByText('No hay etiquetas aquí')).toBeInTheDocument();
    unmount();
    vi.mocked(impresionApi.listarCola).mockRejectedValueOnce(new Error('Falla de red'));
    render(<ColaImpresion alCerrar={() => {}} />);
    expect(await screen.findByText('Falla de red')).toBeInTheDocument();
  });
});
