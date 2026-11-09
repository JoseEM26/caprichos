import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ColaImpresion } from '../ColaImpresion';
import { impresionApi } from '../impresionApi';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ usuario: { rol: 'ADMIN' }, tiene: () => true }) }));
vi.mock('../impresionApi', () => ({
  impresionApi: {
    obtenerEstado: vi.fn(),
    listarCola: vi.fn(),
    vaciarCola: vi.fn(),
    descartarPedido: vi.fn(),
    reimprimirTodas: vi.fn(),
    listarTrabajos: vi.fn(),
    reimprimirTrabajos: vi.fn(),
    quitarTrabajos: vi.fn(),
    reintentarTrabajo: vi.fn(),
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

const montar = () => {
  const r = render(<ColaImpresion alCerrar={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Por pedido' }));
  return r;
};

const trabajo = (id: string, tipo: string, estado: string, extra: any = {}) => ({
  id, pedidoId: '7', pedidoCodigo: 'CP-0128', clienteNombre: 'Ana', tipo, estado, intentos: 0, error: null, copia: false,
  en: new Date().toISOString(), payload: {}, equipoNombre: 'Bebidas', ...extra,
});

describe('ColaImpresion por máquina', () => {
  const papeles = [
    trabajo('1', 'ETIQUETA_BEBIDA', 'IMPRESO'),
    trabajo('2', 'ETIQUETA_AREA', 'FALLIDO', { error: 'Sin papel', payload: { areaNombre: 'Cocina' } }),
    trabajo('3', 'TICKET_PAGO', 'VENCIDO', { equipoNombre: 'Caja' }),
    trabajo('4', 'TICKET_COMANDA_SALON', 'FALLIDO', { equipoNombre: 'Caja' }),
    trabajo('5', 'ETIQUETA_GENERAL', 'IMPRESO', { pedidoId: null, pedidoCodigo: '' }),
  ];
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(impresionApi.listarCola).mockResolvedValue(cola as any);
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({ agente: 'conectado', impresora: 'x', ultimoLatido: null } as any);
    vi.mocked(impresionApi.listarTrabajos).mockResolvedValue({ items: papeles, total: 5, pagina: 1, paginas: 1, conteo: { stickers: 3, tickets: 2 } } as any);
    vi.mocked(impresionApi.reimprimirTrabajos).mockResolvedValue({ ok: true, creados: 1, rechazados: [], trabajoIds: ['9'], mensaje: 'Se enviaron 1 copia(s) a imprimir' });
  });

  it('pestañas con contadores y etiquetas de texto por fila', async () => {
    render(<ColaImpresion alCerrar={() => {}} />);
    await screen.findByTestId('trabajo-1');
    expect(screen.getByTestId('cuenta-TODO')).toHaveTextContent('5');
    expect(screen.getByTestId('cuenta-ETIQUETERA')).toHaveTextContent('3');
    expect(screen.getByTestId('cuenta-TICKETERA')).toHaveTextContent('2');
    expect(screen.getByTestId('trabajo-1')).toHaveTextContent('STICKER · Bebida');
    expect(screen.getByTestId('trabajo-2')).toHaveTextContent('STICKER · Área Cocina');
    expect(screen.getByTestId('trabajo-2')).toHaveTextContent('No se pudo imprimir: Sin papel');
    expect(screen.getByTestId('trabajo-3')).toHaveTextContent('TICKET · Pago');
    expect(screen.getByTestId('trabajo-3')).toHaveTextContent('Se venció');
    expect(screen.getByTestId('trabajo-4')).toHaveTextContent('TICKET · Comanda salón');
    expect(screen.getByTestId('trabajo-5')).toHaveTextContent('PRUEBA');
    expect(screen.getByTestId('trabajo-1')).toHaveTextContent('en Bebidas');
  });

  it('selecciona, selecciona todos, confirma, quita y refresca', async () => {
    vi.mocked(impresionApi.quitarTrabajos).mockResolvedValue({ ok: true, quitados: 2, mensaje: 'x' });
    render(<ColaImpresion alCerrar={() => {}} />);
    await screen.findByTestId('trabajo-1');
    expect(screen.queryByRole('button', { name: /Quitar seleccionados/ })).toBeNull();
    // 2 y 4 son FALLIDO (quitables); el IMPRESO no cuenta
    fireEvent.click(screen.getByLabelText('Seleccionar todos los visibles'));
    expect(screen.getByTestId('lt-contador')).toHaveTextContent('4 seleccionados');
    fireEvent.click(screen.getByLabelText('Seleccionar todos los visibles'));
    expect(screen.queryByTestId('lt-contador')).toBeNull();
    fireEvent.click(within(screen.getByTestId('trabajo-2')).getByRole('checkbox'));
    fireEvent.click(within(screen.getByTestId('trabajo-4')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar seleccionados de la cola' }));
    expect(await screen.findByText(/Se quitarán 2 trabajo\(s\)/)).toBeInTheDocument();
    const llamadas = vi.mocked(impresionApi.listarCola).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() => expect(impresionApi.quitarTrabajos).toHaveBeenCalledWith(['2', '4']));
    expect(await screen.findByText('2 trabajos quitados')).toBeInTheDocument();
    expect(vi.mocked(impresionApi.listarCola).mock.calls.length).toBeGreaterThan(llamadas);
    expect(screen.queryByTestId('lt-contador')).toBeNull();
  });

  it('elegir la pestaña Tickets pide al servidor solo esa máquina', async () => {
    render(<ColaImpresion alCerrar={() => {}} />);
    await screen.findByTestId('trabajo-1');
    fireEvent.click(screen.getByRole('tab', { name: /Tickets \(térmica\)/ }));
    await waitFor(() => expect(impresionApi.listarTrabajos).toHaveBeenLastCalledWith(expect.objectContaining({ maquina: 'TICKETERA' })));
  });

  it('Reimprimir por fila confirma con la frase y manda solo ese id; Reintentar sigue aparte', async () => {
    render(<ColaImpresion alCerrar={() => {}} />);
    const fila = await screen.findByTestId('trabajo-1');
    fireEvent.click(within(fila).getByRole('button', { name: 'Reimprimir' }));
    expect(screen.getByText('Se imprimirá otra copia del sticker de bebida del pedido CP-0128 en Bebidas.')).toBeInTheDocument();
    expect(impresionApi.reimprimirTrabajos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reimprimir' }));
    await waitFor(() => expect(impresionApi.reimprimirTrabajos).toHaveBeenCalledWith({ ids: ['1'] }));
    expect(await screen.findByText('Se enviaron 1 copia(s) a imprimir')).toBeInTheDocument();
    expect(within(screen.getByTestId('trabajo-1')).queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(within(screen.getByTestId('trabajo-2')).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('No en la confirmación no reimprime', async () => {
    render(<ColaImpresion alCerrar={() => {}} />);
    fireEvent.click(within(await screen.findByTestId('trabajo-3')).getByRole('button', { name: 'Reimprimir' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(impresionApi.reimprimirTrabajos).not.toHaveBeenCalled();
  });

  it('selección múltiple: Reimprimir seleccionados manda los ids marcados', async () => {
    render(<ColaImpresion alCerrar={() => {}} />);
    await screen.findByTestId('trabajo-1');
    expect(screen.queryByRole('button', { name: /Reimprimir seleccionados/ })).toBeNull();
    fireEvent.click(within(screen.getByTestId('trabajo-1')).getByRole('checkbox'));
    fireEvent.click(within(screen.getByTestId('trabajo-3')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir seleccionados (2)' }));
    expect(screen.getByText(/otra copia de 2 papel\(es\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reimprimir' }));
    await waitFor(() => expect(impresionApi.reimprimirTrabajos).toHaveBeenCalledWith({ ids: ['1', '3'] }));
  });

  it('botones de grupo con conteo: stickers fallidos y tickets fallidos', async () => {
    render(<ColaImpresion alCerrar={() => {}} />);
    await screen.findByTestId('trabajo-1');
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir todos los stickers fallidos (1)' }));
    expect(screen.getByText(/otra copia de 1 stickers que fallaron/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reimprimir' }));
    await waitFor(() => expect(impresionApi.reimprimirTrabajos).toHaveBeenCalledWith({ grupo: 'STICKERS_FALLIDOS' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reimprimir todos los tickets fallidos (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reimprimir' }));
    await waitFor(() => expect(impresionApi.reimprimirTrabajos).toHaveBeenLastCalledWith({ grupo: 'TICKETS_FALLIDOS' }));
  });

  it('sin permiso no hay botones de reimprimir y la ayuda explica la diferencia', async () => {
    const sesion = await import('../../../comun/sesion');
    vi.spyOn(sesion, 'useSesion').mockReturnValue({ usuario: { rol: 'MOZO' }, tiene: () => false } as any);
    render(<ColaImpresion alCerrar={() => {}} />);
    await screen.findByTestId('trabajo-1');
    expect(screen.queryByRole('button', { name: 'Reimprimir' })).toBeNull();
    expect(screen.getByText(/saca una copia nueva de uno que ya salió/)).toBeInTheDocument();
  });
});

describe('ColaImpresion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(impresionApi.listarCola).mockResolvedValue(cola as any);
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({ agente: 'sin_conexion', impresora: 'desconectada', ultimoLatido: null, pendientes: 34, fallidos: 1 } as any);
  });

  it('muestra resumen y la lista agrupada por pedido', async () => {
    montar();
    const grupo = await screen.findByTestId('cola-grupo');
    expect(grupo).toHaveTextContent('CP-007 · Ana');
    expect(grupo).toHaveTextContent('3 etiqueta(s)');
    expect(screen.getByTestId('cola-resumen')).toHaveTextContent('Programa sin conexión');
    expect(screen.getByText(/no se imprimen aunque la impresora vuelva/)).toBeInTheDocument();
  });

  it('el filtro de la cola es un combo «Ver»: elegir Fallidos pide esa lista y vuelve a la página 1', async () => {
    montar();
    await screen.findByTestId('cola-grupo');
    expect(impresionApi.listarCola).toHaveBeenLastCalledWith('pendientes', 1);

    fireEvent.click(screen.getByRole('button', { name: 'Ver: Pendientes' }));
    fireEvent.click(screen.getByRole('option', { name: 'Fallidos' }));

    expect(screen.getByRole('button', { name: 'Ver: Fallidos' })).toBeInTheDocument();
    await waitFor(() => expect(impresionApi.listarCola).toHaveBeenLastCalledWith('fallidos', 1));
  });

  it('vaciar exige motivo y confirmación Sí/No que dice cuántas se descartan', async () => {
    vi.mocked(impresionApi.vaciarCola).mockResolvedValue({ ok: true, descartadas: 30, mensaje: 'Se descartaron 30 etiqueta(s); no se imprimirán' });
    montar();
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
    montar();
    const grupo = await screen.findByTestId('cola-grupo');
    fireEvent.click(within(grupo).getByRole('button', { name: 'Descartar' }));
    expect(impresionApi.descartarPedido).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    await waitFor(() => expect(impresionApi.descartarPedido).toHaveBeenCalledWith('7'));
  });

  it('muestra estado vacío y de error', async () => {
    vi.mocked(impresionApi.listarCola).mockResolvedValueOnce({ ...cola, items: [], total: 0 } as any);
    const { unmount } = montar();
    expect(await screen.findByText('No hay etiquetas aquí')).toBeInTheDocument();
    unmount();
    vi.mocked(impresionApi.listarCola).mockRejectedValueOnce(new Error('Falla de red'));
    montar();
    expect(await screen.findByText('Falla de red')).toBeInTheDocument();
  });
});
