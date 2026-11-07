import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { impresionApi } from '../impresionApi';
import { ImpresorasDelEquipo, textoEstadoMaquina } from '../ImpresorasDelEquipo';

vi.mock('../impresionApi', () => ({
  impresionApi: {
    pruebaImpresion: vi.fn(),
    pruebaTodas: vi.fn(),
    elegirImpresora: vi.fn(),
    estadoPrueba: vi.fn(),
  },
}));

const lista = { conectada: true, estado: 'lista', motivo: null, impresoraId: 'TSC', impresoraNombre: 'TSC TTP-247' } as any;
const sinElegir = { conectada: false, estado: 'no_configurada', motivo: 'x' } as any;

const equipo = (extra: any = {}) =>
  ({
    deviceKeyId: '7',
    nombre: 'PC Caja',
    areaId: null,
    areaNombre: null,
    conectado: true,
    pendientes: 0,
    seleccion: {},
    impresoras: { ETIQUETERA: lista, TICKETERA: sinElegir },
    candidatas: [
      { id: 'TSC', nombre: 'TSC TTP-247', detalle: 'puerto USB001', sugerido: 'ETIQUETERA' },
      { id: 'XP', nombre: 'XP-80C', sugerido: 'TICKETERA' },
      { id: 'Rara', nombre: 'Rara' },
    ],
    ...extra,
  }) as any;

describe('estados por máquina', () => {
  it('distingue programa caído, sin elegir, elegida que no aparece y lista', () => {
    expect(textoEstadoMaquina({ conectada: false, estado: 'sin_programa', motivo: '' } as any).texto).toContain('El programa no está corriendo');
    expect(textoEstadoMaquina(sinElegir).texto).toContain('Aún no elegiste la impresora');
    expect(textoEstadoMaquina({ conectada: false, estado: 'desconectada', motivo: '', impresoraNombre: 'XP-80C' } as any).texto).toContain('no aparece (XP-80C)');
    expect(textoEstadoMaquina(lista)).toEqual({ texto: 'Lista: TSC TTP-247', tipo: 'ok' });
  });
});

describe('impresoras del equipo', () => {
  beforeEach(() => {
    for (const f of Object.values(impresionApi) as any[]) f.mockReset();
  });

  it('numera las impresoras, marca la que ya es etiquetera y muestra el estado por rol', () => {
    render(<ImpresorasDelEquipo equipo={equipo()} />);
    expect(within(screen.getByTestId('impresora-1')).getByText(/ES LA ETIQUETERA/)).toBeInTheDocument();
    expect(screen.getByTestId('impresora-2')).toHaveTextContent('XP-80C');
    expect(screen.getByTestId('estado-7-ticketera')).toHaveTextContent('Aún no elegiste la impresora para este rol');
    expect(screen.getByTestId('estado-7-etiquetera')).toHaveTextContent('Lista: TSC TTP-247');
  });

  it('si la computadora está apagada avisa cuál falta y que sus trabajos esperan', () => {
    render(<ImpresorasDelEquipo equipo={equipo({ conectado: false, candidatas: [], pendientes: 5 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Sus 5 trabajos esperan en cola');
  });

  it('Probar TODAS pide Sí/No y manda la prueba a ESA computadora', async () => {
    vi.mocked(impresionApi.pruebaTodas).mockResolvedValue({ ok: true, total: 3, trabajos: [], mensaje: 'Se mandó una hoja de prueba a cada una de las 3 impresoras' });
    render(<ImpresorasDelEquipo equipo={equipo()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Probar TODAS (3)' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(impresionApi.pruebaTodas).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Probar TODAS (3)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, probar todas' }));
    await waitFor(() => expect(impresionApi.pruebaTodas).toHaveBeenCalledWith('7'));
    expect(await screen.findByText(/cada una de las 3 impresoras/)).toBeInTheDocument();
  });

  it('Imprimir prueba usa el rol sugerido y la impresora concreta; muestra Impresa', async () => {
    vi.mocked(impresionApi.pruebaImpresion).mockResolvedValue({ ok: true, trabajoId: '9', mensaje: '' });
    vi.mocked(impresionApi.estadoPrueba).mockResolvedValue({ id: '9', rol: 'TICKETERA', estado: 'IMPRESO', intentos: 1, error: null });
    render(<ImpresorasDelEquipo equipo={equipo()} />);
    fireEvent.click(within(screen.getByTestId('impresora-2')).getByRole('button', { name: 'Imprimir prueba' }));
    expect(impresionApi.pruebaImpresion).toHaveBeenCalledWith('TICKETERA', 'XP', '7');
    expect(await screen.findByText(/Impresa: mira si salió/, {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('muestra el error en español con Reintentar', async () => {
    vi.mocked(impresionApi.pruebaImpresion).mockResolvedValue({ ok: true, trabajoId: '10', mensaje: '' });
    vi.mocked(impresionApi.estadoPrueba).mockResolvedValue({ id: '10', rol: 'ETIQUETERA', estado: 'FALLIDO', intentos: 1, error: 'Impresora no encontrada: Rara' });
    render(<ImpresorasDelEquipo equipo={equipo()} />);
    fireEvent.click(within(screen.getByTestId('impresora-3')).getByRole('button', { name: 'Imprimir prueba' }));
    await waitFor(() => expect(screen.getByTestId('impresora-3')).toHaveTextContent('Error: Impresora no encontrada: Rara'), { timeout: 4000 });
    expect(within(screen.getByTestId('impresora-3')).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('Usar como ticketera confirma y guarda la elección de ESA computadora', async () => {
    vi.mocked(impresionApi.elegirImpresora).mockResolvedValue({ ok: true, mensaje: 'La ticketera será: XP-80C' });
    const alCambiar = vi.fn();
    render(<ImpresorasDelEquipo equipo={equipo()} alCambiar={alCambiar} />);
    fireEvent.click(within(screen.getByTestId('impresora-2')).getByRole('button', { name: 'Usar como ticketera' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, usar esta' }));
    await waitFor(() => expect(impresionApi.elegirImpresora).toHaveBeenCalledWith('TICKETERA', 'XP', '7'));
    expect(await screen.findByText('La ticketera será: XP-80C')).toBeInTheDocument();
    expect(alCambiar).toHaveBeenCalled();
  });

  it('con un programa viejo (sin lista) explica cómo actualizar; y los comandos se pueden copiar', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: escribir } });
    render(<ImpresorasDelEquipo equipo={equipo({ candidatas: [] })} />);
    expect(screen.getByText(/no informa sus impresoras/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Comandos del programa (para esa computadora)'));
    fireEvent.click(screen.getByRole('button', { name: 'Copiar probar-todas' }));
    await waitFor(() => expect(escribir).toHaveBeenCalledWith('probar-todas'));
  });
});
