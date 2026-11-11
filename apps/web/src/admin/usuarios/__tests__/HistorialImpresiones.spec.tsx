import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuditoriaView } from '../AuditoriaView';
import { ImpresionesDelPedido } from '../../pedidos/ImpresionesDelPedido';
import * as sesionModulo from '../../../comun/sesion';
import { api } from '../../../comun/api';
import { impresionApi } from '../../impresion/impresionApi';

vi.mock('../../impresion/impresionApi', () => ({
  impresionApi: {
    reimprimirPedido: vi.fn(),
    destinosReimpresion: vi.fn().mockResolvedValue({ destinos: [] }),
    obtenerMapa: vi.fn().mockResolvedValue({ equipos: [{ deviceKeyId: '3', nombre: 'Caja 1' }] }),
  },
}));

const fila = (o: any = {}) => ({
  id: '1', pedidoId: '9', pedidoCodigo: 'PED-9', tipo: 'ETIQUETA_BEBIDA', etiqueta: 'Sticker · Bebida', origen: 'AUTOMATICA',
  solicitadoPor: null, creadoEn: '2026-11-10T15:00:00Z', impresoEn: '2026-11-10T15:00:05Z', estado: 'IMPRESO', intentos: 1, error: null,
  equipo: { id: '3', nombre: 'Caja 1' }, impresora: 'TSC', copia: false, motivo: null, ...o,
});
const respuesta = (datos: any[] = [fila()]) => ({
  total: datos.length, pagina: 1, limite: 25, paginas: 1, datos,
  resumen: { origen: { AUTOMATICA: 5, REIMPRESION: 2, PRUEBA: 1, REINTENTO: 0 }, estado: { IMPRESO: 7, FALLIDO: 1 } },
});

let get: ReturnType<typeof vi.fn>;
const ultima = () => new URLSearchParams(String(get.mock.calls.at(-1)![0]).split('?')[1]);

function montar(permisos: string[] = ['auditoria/ver', 'pedidos/ver', 'pedidos/cambiar_estado']) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: (p: string) => permisos.includes(p) } as any);
  return render(<MemoryRouter><AuditoriaView /></MemoryRouter>);
}
const abrirPestana = () => fireEvent.click(screen.getByRole('tab', { name: 'Impresiones' }));

beforeEach(() => {
  vi.restoreAllMocks();
  get = vi.fn().mockImplementation(async (url: string) => (url.includes('/impresion/historial') ? respuesta() : { total: 0, pagina: 1, limite: 20, paginas: 1, datos: [], conteos: {} }));
  vi.spyOn(api, 'get').mockImplementation(get as any);
});

describe('Historial › Impresiones', () => {
  it('sin permiso de pedidos no hay pestaña Impresiones', () => {
    montar(['auditoria/ver']);
    expect(screen.queryByRole('tab', { name: 'Impresiones' })).toBeNull();
  });

  it('lista con origen en texto, estado, quién, equipo y totales por origen', async () => {
    get.mockImplementation(async () => respuesta([
      fila(),
      fila({ id: '2', origen: 'REIMPRESION', solicitadoPor: { partyId: '9', nombre: 'Ana Ruiz', rol: 'CAJERO' } }),
      fila({ id: '3', origen: 'PRUEBA', pedidoId: null, pedidoCodigo: null, estado: 'FALLIDO', error: 'Sin papel' }),
      fila({ id: '4', origen: 'REINTENTO' }),
    ]));
    montar();
    abrirPestana();
    const filas = await screen.findAllByTestId('fila-impresion');
    expect(filas).toHaveLength(4);
    expect(within(filas[0]).getByText('Automática')).toBeTruthy();
    expect(within(filas[0]).getByText(/Sistema \(automático\)/)).toBeTruthy();
    expect(within(filas[1]).getByText('Reimpresión')).toBeTruthy();
    expect(within(filas[1]).getByText(/Ana Ruiz · CAJERO/)).toBeTruthy();
    expect(within(filas[2]).getByText('Prueba')).toBeTruthy();
    expect(within(filas[2]).getByText('Sin papel')).toBeTruthy();
    expect(within(filas[2]).getByText('Sin pedido')).toBeTruthy();
    expect(within(filas[2]).getByText(/No registrado/)).toBeTruthy();
    expect(within(filas[3]).getByText('Reintento')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Automática · 5' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reimpresión · 2' })).toBeTruthy();
  });

  it('los filtros están ocultos hasta pulsar «Filtros» y llegan al servidor', async () => {
    montar();
    abrirPestana();
    await screen.findAllByTestId('fila-impresion');
    expect(screen.queryByRole('button', { name: /^Estado/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Estado/ }));
    fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: /Falló/ }));
    await waitFor(() => expect(ultima().get('estado')).toBe('FALLIDO'));
    fireEvent.click(screen.getByRole('button', { name: 'Prueba · 1' }));
    await waitFor(() => expect(ultima().get('origen')).toBe('PRUEBA'));
    fireEvent.click(screen.getByRole('button', { name: 'Reimpresión · 2' }));
    await waitFor(() => expect(ultima().get('origen')).toBe('PRUEBA,REIMPRESION'));
    fireEvent.change(screen.getByLabelText('Buscar por código de pedido'), { target: { value: 'cp-w1' } });
    await waitFor(() => expect(ultima().get('q')).toBe('cp-w1'));
  });

  it('Reimprimir abre el diálogo seguro existente (menú de destinos)', async () => {
    montar();
    abrirPestana();
    const f = (await screen.findAllByTestId('fila-impresion'))[0];
    fireEvent.click(within(f).getByRole('button', { name: 'Reimprimir stickers y ticket' }));
    expect(await screen.findByRole('dialog', { name: 'Reimprimir pedido PED-9' })).toBeTruthy();
    expect(impresionApi.reimprimirPedido).not.toHaveBeenCalled(); // nada se imprime sin confirmar
  });

  it('sin permiso de cambiar estado no hay botón Reimprimir', async () => {
    montar(['auditoria/ver', 'pedidos/ver']);
    abrirPestana();
    await screen.findAllByTestId('fila-impresion');
    expect(screen.queryByRole('button', { name: 'Reimprimir stickers y ticket' })).toBeNull();
  });

  it('estado vacío, de error con reintento y de carga', async () => {
    get.mockImplementation(async () => respuesta([]));
    montar();
    abrirPestana();
    expect(await screen.findByText('No hay impresiones con estos filtros.')).toBeTruthy();
    get.mockRejectedValueOnce(new Error('Servidor caído'));
    fireEvent.click(screen.getByRole('button', { name: 'Automática · 5' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Servidor caído'));
    get.mockImplementation(async () => respuesta());
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findAllByTestId('fila-impresion')).toHaveLength(1);
  });
});

describe('Detalle del pedido › Impresiones de este pedido', () => {
  it('pide los datos al abrir y muestra origen y quién', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: () => true } as any);
    get.mockImplementation(async () => ({ datos: [fila({ origen: 'REIMPRESION', solicitadoPor: { partyId: '9', nombre: 'Ana Ruiz', rol: 'CAJERO' } })] }));
    const { container } = render(<MemoryRouter><ImpresionesDelPedido pedidoId="9" /></MemoryRouter>);
    expect(get).not.toHaveBeenCalled();
    const det = container.querySelector('details')!;
    det.open = true;
    fireEvent(det, new Event('toggle'));
    expect(await screen.findByText('Reimpresión')).toBeTruthy();
    expect(get.mock.calls[0][0]).toBe('/admin/pedidos/9/impresiones');
    expect(screen.getByText(/Ana Ruiz · CAJERO/)).toBeTruthy();
  });

  it('vacío y error', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: () => true } as any);
    get.mockImplementation(async () => ({ datos: [] }));
    const { container } = render(<MemoryRouter><ImpresionesDelPedido pedidoId="9" /></MemoryRouter>);
    const det = container.querySelector('details')!;
    det.open = true;
    fireEvent(det, new Event('toggle'));
    expect(await screen.findByText('Este pedido todavía no tiene impresiones.')).toBeTruthy();
  });
});
