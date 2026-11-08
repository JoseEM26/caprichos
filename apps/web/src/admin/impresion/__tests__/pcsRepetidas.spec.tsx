import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { impresionApi } from '../impresionApi';
import { ImpresorasDelEquipo, haceCuanto } from '../ImpresorasDelEquipo';
import { MemoryRouter } from 'react-router-dom';
import { SeccionEquipos } from '../SeccionEquipos';

vi.mock('../impresionApi', () => ({
  impresionApi: {
    obtenerEstado: vi.fn(),
    listarLlaves: vi.fn(),
    fusionarEquipo: vi.fn(),
    noEsLaMisma: vi.fn(),
    eliminarEquipo: vi.fn(),
    limpiarEquiposAntiguos: vi.fn(),
    guardarConfigEquipo: vi.fn(),
  },
}));
vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ usuario: { rol: 'ADMIN' } }) }));
vi.mock('../useEstadoMaquinas', () => ({
  NOMBRE_MAQUINA: { ETIQUETERA: 'Etiquetera', TICKETERA: 'Ticketera' },
  useEstadoMaquinas: () => ({ maquinas: null, recargar: vi.fn() }),
}));

const m = { conectada: true, estado: 'lista', motivo: null } as any;
const eq = (id: string, extra: any = {}) =>
  ({
    deviceKeyId: id,
    nombre: `PC ${id}`,
    areaId: null,
    areaNombre: null,
    conectado: true,
    pendientes: 0,
    seleccion: {},
    impresoras: { ETIQUETERA: m, TICKETERA: m },
    candidatas: [],
    hostname: 'CAJA-01',
    sistema: 'win32 10',
    ipLocal: ['192.168.1.10'],
    ultimoLatido: new Date(Date.now() - 5 * 60000).toISOString(),
    config: { configurado: true },
    ...extra,
  }) as any;

describe('PC repetidas', () => {
  beforeEach(() => {
    for (const f of Object.values(impresionApi) as any[]) f.mockReset();
  });

  it('muestra nombre, hostname, sistema, IP, último latido y estado de configuración', () => {
    render(<ImpresorasDelEquipo equipo={eq('1', { config: { configurado: false } })} />);
    const d = screen.getByTestId('datos-1');
    expect(d).toHaveTextContent('CAJA-01');
    expect(d).toHaveTextContent('win32 10');
    expect(d).toHaveTextContent('192.168.1.10');
    expect(d).toHaveTextContent('hace 5 min');
    expect(d).toHaveTextContent('Nueva: falta configurar');
    expect(haceCuanto(null)).toBe('nunca');
  });

  it('aviso de posible duplicado con «Sí, es la misma» (confirma y fusiona) y «No, es otra PC»', async () => {
    const alCambiar = vi.fn();
    (impresionApi.fusionarEquipo as any).mockResolvedValue({ ok: true });
    (impresionApi.noEsLaMisma as any).mockResolvedValue({ ok: true });
    render(<ImpresorasDelEquipo equipo={eq('2', { repetidaDe: { deviceKeyId: '1', nombre: 'PC Caja' } })} alCambiar={alCambiar} />);
    const aviso = screen.getByTestId('repetida-2');
    expect(aviso).toHaveTextContent('¿es la misma que PC Caja?');
    fireEvent.click(within(aviso).getByText('No, es otra PC'));
    await waitFor(() => expect(impresionApi.noEsLaMisma).toHaveBeenCalledWith('2', '1'));
    fireEvent.click(within(aviso).getByText('Sí, es la misma'));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Sí, es la misma' })).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('button', { name: 'Sí, es la misma' })[1]);
    await waitFor(() => expect(impresionApi.fusionarEquipo).toHaveBeenCalledWith('2', '1'));
  });

  it('Eliminar PC pide confirmación fuerte con la frase y el motivo opcional', async () => {
    (impresionApi.eliminarEquipo as any).mockResolvedValue({ ok: true, descartados: 2 });
    render(<ImpresorasDelEquipo equipo={eq('3')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar PC PC 3' }));
    expect(await screen.findByText(/Esta PC dejará de imprimir y su vinculación se desactiva\. Sus trabajos pendientes se descartan\./)).toBeInTheDocument();
    expect(impresionApi.eliminarEquipo).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Motivo para eliminar la PC'), { target: { value: 'repetida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(impresionApi.eliminarEquipo).toHaveBeenCalledWith('3', 'repetida'));
    expect(await screen.findByText(/Se descartaron 2 trabajos pendientes/)).toBeInTheDocument();
  });

  it('el nombre amigable se guarda con el botón', async () => {
    (impresionApi.guardarConfigEquipo as any).mockResolvedValue({ ok: true });
    render(<ImpresorasDelEquipo equipo={eq('4')} />);
    fireEvent.click(screen.getByRole('button', { name: /Cambiar el nombre de PC 4/ }));
    fireEvent.change(screen.getByLabelText('Nombre de la PC'), { target: { value: 'Cocina' } });
    fireEvent.click(screen.getByText('Guardar nombre'));
    await waitFor(() => expect(impresionApi.guardarConfigEquipo).toHaveBeenCalledWith('4', { nombre: 'Cocina' }));
  });
});

describe('lista de PC: antiguas bajo un contador y limpieza', () => {
  beforeEach(() => {
    for (const f of Object.values(impresionApi) as any[]) f.mockReset();
    (impresionApi.listarLlaves as any).mockResolvedValue([]);
  });

  it('las repetidas apagadas van bajo «Antiguas (N)», sin fila nueva; limpiar exige motivo y confirma', async () => {
    (impresionApi.obtenerEstado as any).mockResolvedValue({
      agente: 'conectado',
      impresora: 'lista',
      equipos: [eq('9'), eq('1', { antigua: true, conectado: false }), eq('2', { antigua: true, conectado: false })],
      eliminadas: [{ deviceKeyId: '5', nombre: 'Vieja', hostname: 'X', ipLocal: [], ultimoLatido: null, eliminadaEn: new Date().toISOString() }],
    });
    (impresionApi.limpiarEquiposAntiguos as any).mockResolvedValue({ ok: true, archivadas: 2 });
    render(<MemoryRouter><SeccionEquipos /></MemoryRouter>);
    const antiguas = await screen.findByTestId('pcs-antiguas');
    expect(antiguas).toHaveTextContent('Antiguas (2) · Eliminadas (1)');
    // solo una PC activa fuera de «Antiguas»
    expect(screen.getAllByTestId(/^equipo-/).filter((n) => !antiguas.contains(n))).toHaveLength(1);
    expect(within(antiguas).getByTestId('pcs-eliminadas')).toHaveTextContent('Vieja');

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar PCs antiguas' }));
    const si = await screen.findByRole('button', { name: 'Sí, limpiar' });
    expect(si).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo de la limpieza'), { target: { value: 'duplicadas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, limpiar' }));
    await waitFor(() => expect(impresionApi.limpiarEquiposAntiguos).toHaveBeenCalledWith('duplicadas'));
  });
});
