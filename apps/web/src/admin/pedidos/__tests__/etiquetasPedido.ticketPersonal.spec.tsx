import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { EtiquetasPedido } from '../EtiquetasPedido';
import { Pedido } from '../pedidosApi';
import { impresionApi, EstadoEtiquetasPedido } from '../../impresion/impresionApi';

vi.mock('../../impresion/impresionApi', () => ({
  impresionApi: {
    obtenerEtiquetasPedido: vi.fn(),
    reimprimirEtiqueta: vi.fn(),
    reimprimirTodas: vi.fn(),
    reimprimirEtiquetas: vi.fn(),
  },
}));

const pedido = {
  id: 'p-5', codigo: 'CP-5', canal: 'MOZO', modalidad: 'MESA', mesa_nombre: '3', cliente_nombre: 'Rosa Pérez', estado: 'LISTO',
  creado_en: '2026-11-08T15:00:00.000Z', subtotal: 20, descuento: 5, total: 15, es_personal: true,
  descuento_detalle: [{ tipo: 'PERSONAL', nombre: 'Descuento del personal 25%', montoDescontado: 5 }],
  lineas: [{ id: 'l1', nombre: 'Café', cantidad: 2, precio_unit: 10, subtotal: 20, area: { id: 'a1', nombre: 'BARRA' } }],
} as unknown as Pedido;

const estado = (est: string, extra: any = {}): EstadoEtiquetasPedido => ({
  pedidoId: 'p-5', codigo: 'CP-5',
  etiquetas: [{ clave: 'TICKET_PAGO', tipo: 'TICKET_PAGO', titulo: 'Ticket de consumo del personal', detalle: '', estado: est as any, trabajoId: '8', intentos: 1, error: null, copia: false, en: '2026-11-08T15:00:00.000Z', impresoEn: '2026-11-08T15:01:00.000Z', ...extra }],
  resumen: { total: 1, impresas: est === 'IMPRESA' ? 1 : 0, enCola: est === 'EN_COLA' ? 1 : 0, fallidas: est === 'FALLIDA' ? 1 : 0, vencidas: 0, sinTrabajo: 0 },
});

describe('Ticket de consumo del personal en el pedido', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(impresionApi.reimprimirEtiqueta).mockResolvedValue({ ok: true, mensaje: 'Se encoló el ticket de pago para reimpresión', cantidad: 1 });
  });

  it('muestra «Ticket impreso ✓» cuando salió y la leyenda de consumo de personal en la vista previa', async () => {
    vi.mocked(impresionApi.obtenerEtiquetasPedido).mockResolvedValue(estado('IMPRESA'));
    render(<EtiquetasPedido pedido={pedido} />);
    const ticket = await screen.findByRole('article', { name: 'Ticket Ticket de consumo del personal' });
    expect(within(ticket).getByText('Ticket impreso ✓')).toBeInTheDocument();
    expect(within(ticket).getByText(/CONSUMO DE PERSONAL/)).toBeInTheDocument();
    expect(within(ticket).getByText(/Cargado a su crédito/)).toBeInTheDocument();
  });

  it('en cola y fallido se distinguen; fallido muestra el error', async () => {
    vi.mocked(impresionApi.obtenerEtiquetasPedido).mockResolvedValue(estado('EN_COLA', { impresoEn: null }));
    const { unmount } = render(<EtiquetasPedido pedido={pedido} />);
    expect(await screen.findByText('Ticket en cola')).toBeInTheDocument();
    unmount();
    vi.mocked(impresionApi.obtenerEtiquetasPedido).mockResolvedValue(estado('FALLIDA', { impresoEn: null, error: 'Sin papel' }));
    render(<EtiquetasPedido pedido={pedido} />);
    expect(await screen.findByText('Ticket falló')).toBeInTheDocument();
    expect(screen.getByText('Sin papel')).toBeInTheDocument();
  });

  it('Reimprimir pide confirmación Sí/No y reencola el ticket de pago', async () => {
    vi.mocked(impresionApi.obtenerEtiquetasPedido).mockResolvedValue(estado('IMPRESA'));
    render(<EtiquetasPedido pedido={pedido} />);
    const ticket = await screen.findByRole('article', { name: 'Ticket Ticket de consumo del personal' });
    fireEvent.click(within(ticket).getByRole('button', { name: 'Reimprimir' }));
    expect(impresionApi.reimprimirEtiqueta).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'No, cancelar' }));
    expect(impresionApi.reimprimirEtiqueta).not.toHaveBeenCalled();
    fireEvent.click(within(ticket).getByRole('button', { name: 'Reimprimir' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, reimprimir' }));
    await waitFor(() => expect(impresionApi.reimprimirEtiqueta).toHaveBeenCalledWith('p-5', 'TICKET_PAGO'));
  });
});
