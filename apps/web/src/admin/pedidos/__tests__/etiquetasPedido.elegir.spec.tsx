import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EtiquetasPedido } from '../EtiquetasPedido';
import { Pedido } from '../pedidosApi';
import { impresionApi, EstadoEtiquetasPedido } from '../../impresion/impresionApi';

vi.mock('../../impresion/impresionApi', () => ({
  impresionApi: {
    obtenerEtiquetasPedido: vi.fn(),
    reimprimirEtiqueta: vi.fn(),
    reimprimirTodas: vi.fn(),
    reimprimirEtiquetas: vi.fn(),
    reimprimirElegidas: vi.fn(),
  },
}));

const linea = (cantidad: number) => ({
  id: 'l1', nombre: 'Frappe Maracuyá', tamano: '16 oz', cantidad, nombres_persona: ['Lucía', 'Lucía'].slice(0, cantidad),
  precio_unit: 18, subtotal: 18 * cantidad, area: { id: 'a1', nombre: 'BARRA' },
});
const pedido = (cantidad: number) =>
  ({ id: 'p1', codigo: 'CP-1', canal: 'MOZO', modalidad: 'LLEVAR', cliente_nombre: 'Lucía', estado: 'COLA', creado_en: '2026-10-25T21:59:00.000Z', subtotal: 1, descuento: 0, total: 1, lineas: [linea(cantidad)] }) as unknown as Pedido;

const et = (clave: string, tipo: any, titulo: string) => ({ clave, tipo, titulo, detalle: '', estado: 'IMPRESA' as const, trabajoId: '1', intentos: 1, error: null, copia: false, en: null, impresoEn: null });
const estado = (vasos: number): EstadoEtiquetasPedido => ({
  pedidoId: 'p1', codigo: 'CP-1',
  etiquetas: [et('GENERAL', 'ETIQUETA_GENERAL', 'General'), ...Array.from({ length: vasos }, (_, i) => et(`BEBIDA:${i + 1}`, 'ETIQUETA_BEBIDA', `Bebida ${i + 1} de ${vasos}`))],
  resumen: { total: 1 + vasos, impresas: 1 + vasos, enCola: 0, fallidas: 0, vencidas: 0, sinTrabajo: 0 },
});

describe('Reimprimir un grupo: elegir cuáles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(impresionApi.reimprimirElegidas).mockResolvedValue({ ok: true, mensaje: 'Listo' });
    vi.mocked(impresionApi.reimprimirEtiquetas).mockResolvedValue({ ok: true, mensaje: 'Listo' });
  });

  it('con 2 vasos: lista, ninguno marcado, «Reimprimir N» y manda solo los elegidos', async () => {
    vi.mocked(impresionApi.obtenerEtiquetasPedido).mockResolvedValue(estado(2));
    render(<EtiquetasPedido pedido={pedido(2)} />);
    await screen.findByText(/3 etiquetas/);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir las de bebida' }));
    expect(screen.getByText('¿Cuáles reimprimes?')).toBeInTheDocument();
    expect(screen.getByText('Vaso 1 · Frappe Maracuyá · Lucía')).toBeInTheDocument();
    expect(screen.getByText('Vaso 2 · Frappe Maracuyá · Lucía')).toBeInTheDocument();
    const casillas = screen.getAllByRole('checkbox');
    expect(casillas).toHaveLength(2);
    casillas.forEach((c) => expect(c).not.toBeChecked());
    expect(screen.getByRole('button', { name: 'Reimprimir 0' })).toBeDisabled();
    fireEvent.click(casillas[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir 1' }));
    await waitFor(() => expect(impresionApi.reimprimirElegidas).toHaveBeenCalledWith('p1', 'bebida', ['BEBIDA:2']));
    expect(impresionApi.reimprimirEtiquetas).not.toHaveBeenCalled();
  });

  it('Marcar todos / ninguno', async () => {
    vi.mocked(impresionApi.obtenerEtiquetasPedido).mockResolvedValue(estado(2));
    render(<EtiquetasPedido pedido={pedido(2)} />);
    await screen.findByText(/3 etiquetas/);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir las de bebida' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todos' }));
    expect(screen.getByRole('button', { name: 'Reimprimir 2' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar ninguno' }));
    expect(screen.getByRole('button', { name: 'Reimprimir 0' })).toBeDisabled();
  });

  it('con un solo sticker sigue la confirmación Sí/No de siempre', async () => {
    vi.mocked(impresionApi.obtenerEtiquetasPedido).mockResolvedValue(estado(1));
    render(<EtiquetasPedido pedido={pedido(1)} />);
    await screen.findByText(/2 etiquetas/);
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir las de bebida' }));
    expect(screen.getByText('¿Reimprimir etiquetas de bebida?')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reimprimir' }));
    await waitFor(() => expect(impresionApi.reimprimirEtiquetas).toHaveBeenCalledWith('p1', 'bebida'));
  });
});
