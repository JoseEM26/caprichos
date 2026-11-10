import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ColaImpresion } from '../ColaImpresion';
import { impresionApi } from '../impresionApi';
import * as sesion from '../../../comun/sesion';

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
    descartarSinImpresora: vi.fn(),
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
    expect(screen.getByTestId('lt-contador')).toHaveTextContent('5 seleccionados');
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

    vi.spyOn(sesion, 'useSesion').mockReturnValue({ usuario: { rol: 'MOZO' }, tiene: () => false } as any);
    render(<ColaImpresion alCerrar={() => {}} />);
    await screen.findByTestId('trabajo-1');
    expect(screen.queryByRole('button', { name: 'Reimprimir' })).toBeNull();
    expect(screen.getByText(/Qué hace cada uno/)).toBeInTheDocument();
    expect(screen.getByText(/saca una copia NUEVA de un papel que ya salió/i)).toBeInTheDocument();
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

describe('ColaImpresion: en qué computadora espera cada papel', () => {
  const destino = (extra: any = {}) => ({
    equipoId: '1', equipoNombre: 'Caja', conectado: true, ultimoLatido: new Date(Date.now() - 12000).toISOString(),
    impresoraRol: 'TICKETERA', impresoraNombre: 'EPSON TM-T20', impresoraEstado: 'lista', sinImpresora: false, motivoSinImpresora: null,
    textoEspera: 'Esperando su turno en la computadora «Caja» (conectada hace 12 s).', ...extra,
  });
  const papeles = [
    trabajo('1', 'TICKET_PAGO', 'PENDIENTE', { equipoNombre: 'Caja', destino: destino() }),
    trabajo('2', 'TICKET_COMANDA_SALON', 'PENDIENTE', {
      equipoNombre: 'Sin computadora asignada',
      destino: destino({ equipoId: null, equipoNombre: null, conectado: false, ultimoLatido: null, impresoraNombre: null, impresoraEstado: null, sinImpresora: true,
        motivoSinImpresora: 'Ninguna computadora tiene activado «Comanda de salón» en Impresión fácil.', textoEspera: 'Sin impresora asignada: Ninguna computadora tiene activado «Comanda de salón» en Impresión fácil.' }),
    }),
    trabajo('3', 'ETIQUETA_GENERAL', 'PENDIENTE', {
      equipoNombre: 'Barra',
      destino: destino({ equipoId: '2', equipoNombre: 'Barra', conectado: false, ultimoLatido: new Date(Date.now() - 3600_000).toISOString(), impresoraRol: 'ETIQUETERA', impresoraNombre: 'TSC TTP-244',
        textoEspera: 'Esperando en la computadora «Barra», que está apagada o sin el programa (sin conexión desde las 4:16 p. m.). Saldrá al abrirlo.' }),
    }),
  ];
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sesion, 'useSesion').mockReturnValue({ usuario: { rol: 'ADMIN' }, tiene: () => true } as any);
    vi.mocked(impresionApi.listarCola).mockResolvedValue({ ...cola, resumen: { ...cola.resumen, sinImpresora: 1 } } as any);
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({ agente: 'conectado', impresora: 'x', ultimoLatido: null } as any);
    vi.mocked(impresionApi.listarTrabajos).mockResolvedValue({ items: papeles, total: 3, pagina: 1, paginas: 1, conteo: { stickers: 1, tickets: 2 } } as any);
  });

  it('cada fila dice la computadora, si está conectada, la impresora y en cuál espera', async () => {
    render(<ColaImpresion alCerrar={() => {}} />);
    await screen.findByTestId('trabajo-1');
    const d1 = screen.getByTestId('destino-1');
    expect(d1).toHaveTextContent('Computadora: Caja');
    expect(d1).toHaveTextContent('Conectada · hace');
    expect(d1).toHaveTextContent('Impresora: Ticketera «EPSON TM-T20»');
    expect(screen.getByTestId('trabajo-1')).toHaveTextContent('Esperando su turno en la computadora «Caja» (conectada hace 12 s).');
    expect(screen.getByTestId('destino-3')).toHaveTextContent('Sin conexión desde las');
    expect(screen.getByTestId('trabajo-3')).toHaveTextContent('que está apagada o sin el programa');
  });

  it('un papel que nadie imprime sale «Sin impresora asignada» con el motivo, no «En cola»', async () => {
    render(<ColaImpresion alCerrar={() => {}} />);
    const fila = await screen.findByTestId('trabajo-2');
    expect(fila).toHaveTextContent('Sin impresora asignada');
    expect(fila).not.toHaveTextContent('En cola');
    expect(fila).toHaveTextContent('Ninguna computadora tiene activado «Comanda de salón»');
    expect(screen.queryByTestId('destino-2')).toBeNull();
  });

  it('filtra por computadora', async () => {
    render(<ColaImpresion alCerrar={() => {}} />);
    await screen.findByTestId('trabajo-1');
    fireEvent.change(screen.getByLabelText('Filtrar por computadora'), { target: { value: '2' } });
    expect(screen.queryByTestId('trabajo-1')).toBeNull();
    expect(screen.getByTestId('trabajo-3')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filtrar por computadora'), { target: { value: '__sin__' } });
    expect(screen.getByTestId('trabajo-2')).toBeInTheDocument();
    expect(screen.queryByTestId('trabajo-3')).toBeNull();
  });

  it('el aviso de «sin impresora» ofrece descartarlos con confirmación (no se borran)', async () => {
    vi.mocked(impresionApi.descartarSinImpresora).mockResolvedValue({ ok: true, descartadas: 1, mensaje: 'Se descartaron 1 etiqueta(s); no se imprimirán' });
    render(<ColaImpresion alCerrar={() => {}} />);
    const aviso = await screen.findByTestId('cola-sin-impresora');
    expect(aviso).toHaveTextContent('1 papel(es) sin impresora asignada');
    fireEvent.click(within(aviso).getByRole('button', { name: 'Descartar los que no tienen impresora' }));
    expect(impresionApi.descartarSinImpresora).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    await waitFor(() => expect(impresionApi.descartarSinImpresora).toHaveBeenCalled());
  });
});
