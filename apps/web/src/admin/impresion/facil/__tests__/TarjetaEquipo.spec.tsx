import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { TarjetaEquipo } from '../TarjetaEquipo';
import { impresionApi } from '../../impresionApi';
import { alternarArea, haceCuanto, ordenarEquipos } from '../logicaEquipo';

const AREAS = [
  { id: '1', nombre: 'Bebidas' },
  { id: '2', nombre: 'Salados' },
  { id: '3', nombre: 'Postres' },
];
const LOCAL = { bebida: { anchoMm: 76, altoMm: 38 }, general: { anchoMm: 100, altoMm: 100 } };
const CFG = { ticketera: false, etiquetera: false, ticketPago: false, comandaSalon: false, comandaAreas: [] as string[], stickerGeneral: false, stickerAreas: [] as string[], stickerBebidaAreas: [] as string[], tamanoGeneral: null, tamanoBebida: null, pausado: false, configurado: true };

function equipo(over: any = {}): any {
  return {
    deviceKeyId: '10', nombre: 'PC Caja', areaId: null, areaNombre: null, conectado: true, impresoras: {}, pendientes: 0,
    candidatas: [{ id: 'POS-80C', nombre: 'POS-80C', puerto: 'USB001', driver: 'POS-80C', estado: 'Normal' }, { id: 'TSC', nombre: 'TSC TTP', puerto: 'USB002' }],
    seleccion: {}, config: CFG, ultimoLatido: new Date().toISOString(), ipLocal: ['192.168.1.20'], ipPublica: '200.1.1.1', version: '0.1.0', hostname: 'CAJA-PC', sistema: 'win32 10', ...over,
  };
}

function montar(e: any = equipo(), opciones: { editar?: boolean } = {}) {
  const alRecargar = vi.fn();
  const alAviso = vi.fn();
  const r = render(<TarjetaEquipo equipo={e} areas={AREAS} tamanosLocal={LOCAL} puedeEditar={opciones.editar ?? true} alRecargar={alRecargar} alAviso={alAviso} />);
  return { ...r, alRecargar, alAviso };
}

describe('TarjetaEquipo', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('muestra nombre, estado verde, IP local y pública, versión y las impresoras que ve', () => {
    montar();
    expect(screen.getByTestId('nombre-10')).toHaveValue('PC Caja');
    expect(screen.getByTestId('conexion-10')).toHaveTextContent('Conectada');
    const datos = screen.getByTestId('datos-10');
    expect(datos).toHaveTextContent('192.168.1.20');
    expect(datos).toHaveTextContent('200.1.1.1');
    expect(datos).toHaveTextContent('versión 0.1.0');
    expect(datos).toHaveTextContent('POS-80C · USB001 · POS-80C · Normal');
    expect(screen.queryByTestId('nueva-10')).toBeNull();
  });

  it('sin conexión: gris, «hace X min» y avisa que los cambios se aplican al reconectar', () => {
    montar(equipo({ conectado: false, ultimoLatido: new Date(Date.now() - 5 * 60000).toISOString() }));
    expect(screen.getByTestId('conexion-10')).toHaveTextContent(/Sin conexión · hace 5 min/);
    expect(screen.getByText(/se aplica en cuanto se conecte/)).toBeInTheDocument();
  });

  it('una PC nueva muestra «Nueva · falta configurar» y guardar la deja configurada con todo lo apagado que no toques', async () => {
    const guardar = vi.spyOn(impresionApi, 'guardarConfigEquipo').mockResolvedValue({ ok: true, config: CFG as any });
    const { alRecargar } = montar(equipo({ config: { ...CFG, configurado: false } }));
    expect(screen.getByTestId('nueva-10')).toHaveTextContent('Nueva · falta configurar');
    fireEvent.click(screen.getByTestId('guardar-10'));
    await waitFor(() => expect(guardar).toHaveBeenCalled());
    const [id, cuerpo] = guardar.mock.calls[0] as any;
    expect(id).toBe('10');
    expect(cuerpo).toMatchObject({ ticketera: false, etiquetera: false, nombre: 'PC Caja' });
    expect(cuerpo.configurado).toBeUndefined();
    await waitFor(() => expect(alRecargar).toHaveBeenCalled());
  });

  it('los interruptores muestran sus opciones y «Guardar» manda lo elegido (áreas incluidas)', async () => {
    const guardar = vi.spyOn(impresionApi, 'guardarConfigEquipo').mockResolvedValue({ ok: true, config: CFG as any });
    montar();
    expect(screen.queryByTestId('sw-pago-10')).toBeNull();
    fireEvent.click(screen.getByTestId('sw-ticketera-10'));
    expect(screen.getByTestId('sw-ticketera-10')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('sw-pago-10'));
    fireEvent.click(screen.getByTestId('chips-comanda-10-2'));
    fireEvent.click(screen.getByTestId('sw-etiquetera-10'));
    fireEvent.click(screen.getByTestId('chips-sticker-area-10-3'));
    fireEvent.click(screen.getByTestId('chips-sticker-bebida-10-1'));
    fireEvent.click(screen.getByTestId('sw-general-10'));
    // Bebidas no lleva sticker por área (ya sale uno por vaso)
    expect(screen.queryByTestId('chips-sticker-area-10-1')).toBeNull();
    fireEvent.click(screen.getByTestId('guardar-10'));
    await waitFor(() => expect(guardar).toHaveBeenCalled());
    expect((guardar.mock.calls[0] as any)[1]).toMatchObject({
      ticketera: true, ticketPago: true, comandaAreas: ['2'], etiquetera: true, stickerAreas: ['3'], stickerBebidaAreas: ['1'], stickerGeneral: true,
    });
  });

  it('elegir la impresora por rol se guarda con la PC (entre las que detectó)', async () => {
    const guardar = vi.spyOn(impresionApi, 'guardarConfigEquipo').mockResolvedValue({ ok: true, config: CFG as any });
    montar(equipo({ config: { ...CFG, ticketera: true } }));
    const sel = screen.getByTestId('impresora-TICKETERA');
    expect(within(sel).getAllByRole('option').map((o) => o.textContent)).toEqual(['Que el programa la busque solo (USB)', 'POS-80C · USB001', 'TSC TTP · USB002']);
    fireEvent.change(sel, { target: { value: 'POS-80C' } });
    fireEvent.click(screen.getByTestId('guardar-10'));
    await waitFor(() => expect(guardar).toHaveBeenCalled());
    expect((guardar.mock.calls[0] as any)[1].impresoras).toEqual({ TICKETERA: 'POS-80C', ETIQUETERA: null });
  });

  it('«Imprimir prueba» por rol manda la prueba a ESA PC y a la impresora elegida', async () => {
    const prueba = vi.spyOn(impresionApi, 'pruebaImpresion').mockResolvedValue({ ok: true, trabajoId: '5', mensaje: 'ok' });
    montar(equipo({ config: { ...CFG, ticketera: true }, seleccion: { TICKETERA: 'POS-80C' } }));
    fireEvent.click(screen.getByTestId('probar-TICKETERA'));
    await waitFor(() => expect(prueba).toHaveBeenCalledWith('TICKETERA', 'POS-80C', '10'));
    expect(await screen.findByText(/Prueba enviada/)).toBeInTheDocument();
  });

  it('«Pausar PC» pausa al instante y «Reanudar PC» la devuelve', async () => {
    const guardar = vi.spyOn(impresionApi, 'guardarConfigEquipo').mockResolvedValue({ ok: true, config: CFG as any });
    const { rerender, alRecargar, alAviso } = montar();
    fireEvent.click(screen.getByTestId('pausar-10'));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith('10', { pausado: true }));
    expect(alAviso).toHaveBeenCalledWith('ok', expect.stringContaining('en pausa'));
    expect(alRecargar).toHaveBeenCalled();
    rerender(<TarjetaEquipo equipo={equipo({ config: { ...CFG, pausado: true } })} areas={AREAS} tamanosLocal={LOCAL} puedeEditar alRecargar={alRecargar} alAviso={alAviso} />);
    expect(screen.getByTestId('pausa-10')).toHaveTextContent('En pausa');
    expect(screen.getByTestId('pausar-10')).toHaveTextContent('Reanudar PC');
  });

  it('«Usar lo general» pide confirmar y rellena la PC con las reglas del local', async () => {
    const general = vi.spyOn(impresionApi, 'usarGeneralEquipo').mockResolvedValue({ ok: true, config: { ...CFG, ticketera: true, ticketPago: true } as any });
    montar();
    fireEvent.click(screen.getByTestId('general-10'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, usar lo general' }));
    await waitFor(() => expect(general).toHaveBeenCalledWith('10'));
    expect(await screen.findByTestId('sw-pago-10')).toHaveAttribute('aria-checked', 'true');
  });

  it('«Desvincular» pide confirmar y desactiva la llave de esa PC', async () => {
    const desactivar = vi.spyOn(impresionApi, 'desactivarLlave').mockResolvedValue({ ok: true, mensaje: 'ok' });
    montar();
    fireEvent.click(screen.getByTestId('desvincular-10'));
    expect(desactivar).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, desvincular' }));
    await waitFor(() => expect(desactivar).toHaveBeenCalledWith('10'));
  });

  it('sin permiso de editar todo queda deshabilitado', () => {
    montar(equipo({ config: { ...CFG, ticketera: true } }), { editar: false });
    expect(screen.getByTestId('guardar-10')).toBeDisabled();
    expect(screen.getByTestId('sw-ticketera-10')).toBeDisabled();
    expect(screen.getByTestId('pausar-10')).toBeDisabled();
  });
});

describe('tamaño del sticker por PC con vista previa', () => {
  beforeEach(() => vi.restoreAllMocks());

  const conBebida = (tamanoBebida: any = null) => equipo({ config: { ...CFG, etiquetera: true, stickerBebidaAreas: ['1'], stickerGeneral: true, tamanoBebida } });
  const medidaSvg = (tipo: string) => within(screen.getByTestId(`previa-${tipo}`)).getByRole('img').getAttribute('data-maqueta');

  it('sin tamaño propio hereda el del local y la vista previa lo muestra a escala', () => {
    montar(conBebida());
    expect(screen.getByTestId('tamano-bebida-local')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('previa-bebida-texto')).toHaveTextContent('76 × 38 mm');
    expect(medidaSvg('bebida')).toBe('608x304'); // 8 puntos por mm
    expect(screen.getByTestId('previa-general-texto')).toHaveTextContent('100 × 100 mm');
  });

  it('elegir una medida común cambia la vista previa al instante y «Guardar» manda el tamaño', async () => {
    const guardar = vi.spyOn(impresionApi, 'guardarConfigEquipo').mockResolvedValue({ ok: true, config: CFG as any });
    montar(conBebida());
    fireEvent.click(screen.getByTestId('tamano-bebida-50x30'));
    expect(screen.getByTestId('previa-bebida-texto')).toHaveTextContent('50 × 30 mm');
    expect(medidaSvg('bebida')).toBe('400x240');
    fireEvent.click(screen.getByTestId('tamano-bebida-101.6x63.5'));
    expect(screen.getByTestId('previa-bebida-texto')).toHaveTextContent('101,6 × 63,5 mm');
    expect(medidaSvg('bebida')).toBe('813x508');
    fireEvent.click(screen.getByTestId('guardar-10'));
    await waitFor(() => expect(guardar).toHaveBeenCalled());
    expect((guardar.mock.calls[0] as any)[1].tamanoBebida).toEqual({ anchoMm: 101.6, altoMm: 63.5 });
    expect((guardar.mock.calls[0] as any)[1].tamanoGeneral).toBeNull();
  });

  it('la orientación vertical gira la medida y el margen se refleja en la vista previa', () => {
    montar(conBebida({ anchoMm: 76, altoMm: 38 }));
    fireEvent.click(screen.getByTestId('tamano-bebida-vertical'));
    expect(screen.getByTestId('previa-bebida-texto')).toHaveTextContent('38 × 76 mm');
    expect(medidaSvg('bebida')).toBe('304x608');
    fireEvent.click(screen.getByTestId('tamano-bebida-apaisado'));
    expect(screen.getByTestId('previa-bebida-texto')).toHaveTextContent('76 × 38 mm');
    const antes = within(screen.getByTestId('previa-bebida')).getByRole('img').innerHTML;
    fireEvent.change(screen.getByTestId('tamano-bebida-margen'), { target: { value: '4' } });
    expect(within(screen.getByTestId('previa-bebida')).getByRole('img').innerHTML).not.toBe(antes);
  });

  it('personalizado: escribe ancho y alto; fuera de 30 a 200 mm avisa y no deja probar', () => {
    montar(conBebida({ anchoMm: 76, altoMm: 38 }));
    fireEvent.click(screen.getByTestId('tamano-bebida-personalizado'));
    fireEvent.change(screen.getByTestId('tamano-bebida-ancho'), { target: { value: '90' } });
    fireEvent.change(screen.getByTestId('tamano-bebida-alto'), { target: { value: '45' } });
    expect(screen.getByTestId('previa-bebida-texto')).toHaveTextContent('90 × 45 mm');
    fireEvent.change(screen.getByTestId('tamano-bebida-ancho'), { target: { value: '500' } });
    expect(screen.getByRole('alert')).toHaveTextContent('entre 30 y 200 mm');
    expect(screen.getByTestId('tamano-bebida-probar')).toBeDisabled();
  });

  it('«Igual que el local» quita el tamaño propio (hereda)', async () => {
    const guardar = vi.spyOn(impresionApi, 'guardarConfigEquipo').mockResolvedValue({ ok: true, config: CFG as any });
    montar(conBebida({ anchoMm: 60, altoMm: 40 }));
    expect(screen.getByTestId('previa-bebida-texto')).toHaveTextContent('60 × 40 mm');
    fireEvent.click(screen.getByTestId('tamano-bebida-local'));
    expect(screen.getByTestId('previa-bebida-texto')).toHaveTextContent('76 × 38 mm');
    fireEvent.click(screen.getByTestId('guardar-10'));
    await waitFor(() => expect(guardar).toHaveBeenCalled());
    expect((guardar.mock.calls[0] as any)[1].tamanoBebida).toBeNull();
  });

  it('«Imprimir prueba con este tamaño» manda esa etiqueta a esa PC con la medida que se ve', async () => {
    const prueba = vi.spyOn(impresionApi, 'pruebaEtiquetaEquipo').mockResolvedValue({ ok: true, trabajoId: '9', mensaje: 'ok' });
    montar(conBebida());
    fireEvent.click(screen.getByTestId('tamano-bebida-60x40'));
    fireEvent.click(screen.getByTestId('tamano-bebida-probar'));
    await waitFor(() => expect(prueba).toHaveBeenCalledWith('10', 'bebida', { anchoMm: 60, altoMm: 40 }));
    expect(await screen.findByText(/Prueba enviada a la impresora/)).toBeInTheDocument();
    // sin tamaño propio manda sin medida: el servidor usa el que tenga o el del local
    fireEvent.click(screen.getByTestId('tamano-general-probar'));
    await waitFor(() => expect(prueba).toHaveBeenLastCalledWith('10', 'general', null));
  });
});

describe('ventana de configuración (modal) y pestaña Probar', () => {
  beforeEach(() => vi.restoreAllMocks());
  const completa = () => equipo({ config: { ...CFG, ticketera: true, ticketPago: true, comandaSalon: true, etiquetera: true, stickerAreas: ['2'], stickerBebidaAreas: ['1'], stickerGeneral: true } });
  const abrir = (e: any = completa()) => {
    const alCancelar = vi.fn();
    const r = render(<TarjetaEquipo equipo={e} areas={AREAS} tamanosLocal={LOCAL} puedeEditar alRecargar={vi.fn()} alAviso={vi.fn()} alCancelar={alCancelar} />);
    return { ...r, alCancelar };
  };

  it('es un diálogo modal con 4 pestañas y pie con Guardar, Usar lo general y Cancelar', () => {
    abrir();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['General', 'Ticketera', 'Etiquetera', 'Probar']);
    for (const id of ['guardar-10', 'general-10', 'cancelar-10']) expect(screen.getByTestId(id)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tab-probar-10'));
    expect(screen.getByTestId('tab-probar-10')).toHaveAttribute('aria-selected', 'true');
  });

  it('Esc o Cancelar sin cambios cierran; con cambios avisa antes de descartar', async () => {
    const { alCancelar } = abrir();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(alCancelar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('sw-ticketera-10'));
    expect(screen.getByTestId('sucio-10')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cancelar-10'));
    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Hay cambios sin guardar', { selector: 'h2, h3, h4, strong, div' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    expect(alCancelar).toHaveBeenCalledTimes(2);
  });

  it('Probar solo ofrece lo que esa PC tiene activo y encola UNA prueba solo para esa PC', async () => {
    const ticket = vi.spyOn(impresionApi, 'pruebaImpresion').mockResolvedValue({ ok: true, trabajoId: '5', mensaje: 'ok' });
    const etiqueta = vi.spyOn(impresionApi, 'pruebaEtiquetaEquipo').mockResolvedValue({ ok: true, trabajoId: '6', mensaje: 'ok' });
    abrir();
    fireEvent.click(screen.getByTestId('probar-bebida'));
    await waitFor(() => expect(etiqueta).toHaveBeenCalledWith('10', 'bebida', null));
    fireEvent.click(screen.getByTestId('probar-general'));
    await waitFor(() => expect(etiqueta).toHaveBeenLastCalledWith('10', 'general', null));
    fireEvent.click(screen.getByTestId('probar-ETIQUETERA'));
    await waitFor(() => expect(ticket).toHaveBeenCalledWith('ETIQUETERA', undefined, '10'));
    expect(etiqueta).toHaveBeenCalledTimes(2);
  });

  it('una PC sin nada activo no ofrece botones de prueba', () => {
    abrir(equipo());
    expect(screen.queryByTestId('probar-TICKETERA')).toBeNull();
    expect(screen.queryByTestId('probar-bebida')).toBeNull();
    expect(screen.getByTestId('probar-10')).toHaveTextContent('nada activo que probar');
  });

  it('«Mostrar cómo se visualiza» dibuja la maqueta REAL (CAPRICHOS, logo y bloque PAGO) con un nombre al azar', () => {
    abrir(equipo({ config: { ...CFG, etiquetera: true, stickerBebidaAreas: ['1'], stickerGeneral: true, tamanoGeneral: { anchoMm: 100, altoMm: 100 } } }));
    fireEvent.click(screen.getByTestId('ver-previa-general'));
    const vp = screen.getByTestId('vp-general');
    const svg = within(vp).getByRole('img');
    expect(svg.textContent).toContain('CAPRICHOS');
    expect(svg.querySelector('[data-logo]')).not.toBeNull();
    expect(svg.textContent).toMatch(/PAGO|VUELTO|COBRAR/i);
    const nombre = within(vp).getByTestId('vp-nombre-general').textContent;
    expect(nombre).toMatch(/Ejemplo con «/);
    fireEvent.click(within(vp).getByTestId('vp-otro-general'));
    expect(within(vp).getByTestId('vp-nombre-general').textContent).not.toBe(nombre);
    fireEvent.click(screen.getByTestId('ver-previa-bebida'));
    const vaso = within(screen.getByTestId('vp-bebida')).getByRole('img');
    expect(vaso.textContent).toContain('CAPRICHOS');
    expect(vaso.getAttribute('data-maqueta')).toBe('608x304');
    expect(vaso.querySelector('[data-logo]')).not.toBeNull();
  });

  it('PC duplicada: ofrece Fusionar (con confirmación) y «No es la misma»', async () => {
    const fus = vi.spyOn(impresionApi, 'fusionarEquipo').mockResolvedValue({ ok: true });
    const no = vi.spyOn(impresionApi, 'noEsLaMisma').mockResolvedValue({ ok: true });
    render(<TarjetaEquipo equipo={completa()} areas={AREAS} tamanosLocal={LOCAL} puedeEditar alRecargar={vi.fn()} alAviso={vi.fn()} alCancelar={vi.fn()} duplicadoDe={{ deviceKeyId: '99', nombre: 'CAJA' }} />);
    expect(screen.getByTestId('duplicado-10')).toHaveTextContent('Posible duplicado de «CAJA»');
    fireEvent.click(screen.getByTestId('fusionar-10'));
    expect(fus).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, fusionar' }));
    await waitFor(() => expect(fus).toHaveBeenCalledWith('10', '99'));
    fireEvent.click(screen.getByTestId('no-misma-10'));
    await waitFor(() => expect(no).toHaveBeenCalledWith('10', '99'));
  });
});

describe('lógica de PC', () => {
  it('haceCuanto en palabras', () => {
    const ahora = Date.now();
    expect(haceCuanto(null)).toBe('nunca se conectó');
    expect(haceCuanto(new Date(ahora - 20000).toISOString(), ahora)).toBe('hace un momento');
    expect(haceCuanto(new Date(ahora - 3 * 60000).toISOString(), ahora)).toBe('hace 3 min');
    expect(haceCuanto(new Date(ahora - 2 * 3600000).toISOString(), ahora)).toBe('hace 2 h');
    expect(haceCuanto(new Date(ahora - 24 * 3600000).toISOString(), ahora)).toBe('hace 1 día');
  });

  it('las PC nuevas van primero; alternarArea agrega y quita', () => {
    const det: Record<string, any> = { a: { config: { ...CFG } }, b: { config: { ...CFG, configurado: false } } };
    expect(ordenarEquipos([{ deviceKeyId: 'a' }, { deviceKeyId: 'b' }], (id) => det[id]).map((e) => e.deviceKeyId)).toEqual(['b', 'a']);
    expect(alternarArea(['1'], '2')).toEqual(['1', '2']);
    expect(alternarArea(['1', '2'], '1')).toEqual(['2']);
  });
});
