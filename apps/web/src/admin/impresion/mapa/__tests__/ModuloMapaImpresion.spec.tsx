import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as sesionModulo from '../../../../comun/sesion';
import { impresionApi, type MapaImpresionDatos } from '../../impresionApi';
import { ModuloMapaImpresion } from '../ModuloMapaImpresion';
import { ErrorApi } from '../../../../comun/api';

vi.mock('../../../../comun/socket', () => ({ useEventos: () => undefined }));

// jsdom no trae PointerEvent: se añade uno mínimo que conserva clientX/clientY/button/pointerType.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPoly extends MouseEvent {
    readonly pointerType: string;
    constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  (window as any).PointerEvent = PointerEventPoly;
}

function mapa(over: Partial<MapaImpresionDatos> = {}): MapaImpresionDatos {
  return {
    duplicados: [],
    areas: [
      { id: '1', nombre: 'Bebidas', equiposPorRol: { ETIQUETERA: '11', TICKETERA: null } },
      { id: '2', nombre: 'Salados', equiposPorRol: { ETIQUETERA: null, TICKETERA: null } },
    ],
    equipos: [
      { deviceKeyId: '10', nombre: 'PC Caja', areaId: null, maquinas: ['ETIQUETERA', 'TICKETERA'], roles: [{ rol: 'ETIQUETERA', estado: 'lista' }, { rol: 'TICKETERA', estado: 'lista' }], ultimoLatido: null, conectado: true },
      { deviceKeyId: '11', nombre: 'Etiquetera bar', areaId: '1', maquinas: ['ETIQUETERA'], roles: [{ rol: 'ETIQUETERA', estado: 'sin_papel' }, { rol: 'TICKETERA', estado: 'no_configurada' }], ultimoLatido: null, conectado: true },
    ],
    reglas: { generalModalidades: ['LLEVAR', 'RECOGER', 'DELIVERY'], areaModalidades: ['LLEVAR', 'RECOGER', 'DELIVERY'], bebidaModalidades: ['MESA', 'LOCAL', 'LLEVAR', 'RECOGER', 'DELIVERY'], bebidaActivo: true, areaActivo: false, comandaSalonActivo: true, comandaAreaActivo: false },
    ruteo: [
      { tipo: 'ETIQUETA_GENERAL', areaId: null, destinoAreaId: null, destinoEquipoId: '10', destinoNombre: 'PC Caja', activo: true },
      { tipo: 'ETIQUETA_BEBIDA', areaId: '1', destinoAreaId: '1', destinoEquipoId: '11', destinoNombre: 'Etiquetera bar', activo: true },
      { tipo: 'ETIQUETA_AREA', areaId: '1', destinoAreaId: '1', destinoEquipoId: '11', destinoNombre: 'Etiquetera bar', activo: false },
      { tipo: 'ETIQUETA_AREA', areaId: '2', destinoAreaId: null, destinoEquipoId: '10', destinoNombre: 'PC Caja', activo: false },
      { tipo: 'TICKET_COMANDA_SALON', areaId: null, destinoAreaId: null, destinoEquipoId: '10', destinoNombre: 'PC Caja', activo: true },
      { tipo: 'TICKET_PAGO', areaId: null, destinoAreaId: null, destinoEquipoId: '10', destinoNombre: 'PC Caja', activo: true },
    ],
    colaPendientePorEquipo: [{ deviceKeyId: '10', pendientes: 0 }, { deviceKeyId: '11', pendientes: 2 }],
    ...over,
  };
}

/** Espera al nodo de un equipo (waitFor reintenta solo si el callback lanza). */
const equipo = (id: string) =>
  waitFor(() => {
    const el = document.querySelector(`[data-equipo="${id}"]`) as HTMLElement | null;
    expect(el).not.toBeNull();
    return el as HTMLElement;
  });

function montar(opciones: { editar: boolean }) {
  const permisos = opciones.editar ? ['configuracion/ver', 'configuracion/editar'] : ['configuracion/ver'];
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Prueba', rol: opciones.editar ? 'ADMIN' : 'CAJERO' },
    permisos,
    debeCambiar: false, cargando: false, autenticado: true,
    ingresar: vi.fn(), salir: vi.fn(), renovar: vi.fn(), refrescarYo: vi.fn(), marcarClaveCambiada: vi.fn(),
    tiene: (p: string) => permisos.includes(p),
  } as any);
  return render(
    <MemoryRouter>
      <ModuloMapaImpresion />
    </MemoryRouter>,
  );
}

describe('Mapa de impresión', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (window as any).innerWidth = 1024;
  });
  afterEach(() => vi.restoreAllMocks());

  it('dibuja las piezas y los equipos con su luz y su cola', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    montar({ editar: true });
    expect((await screen.findAllByText('Sticker de bebida')).length).toBeGreaterThan(0);
    const bar = await equipo('11');
    expect(within(bar).getByText('Etiquetera bar')).toBeInTheDocument();
    expect(within(bar).getByText(/Etiquetera: sin papel/)).toBeInTheDocument();
    expect(within(bar).getByText(/2 en cola/)).toBeInTheDocument();
  });

  it('cambiar la regla de bebida envía el PUT con bebidaActivo', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    const guardar = vi.spyOn(impresionApi, 'guardarReglasImpresion').mockResolvedValue({ ok: true, reglas: { ...mapa().reglas, bebidaActivo: false } });
    montar({ editar: true });
    const interruptor = await screen.findByRole('switch', { name: 'Sticker de bebida' });
    fireEvent.click(interruptor);
    await waitFor(() => expect(guardar).toHaveBeenCalledWith({ bebidaActivo: false }));
  });

  it('asignar equipo con el selector envía {areaId} del área elegida', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    const asignar = vi.spyOn(impresionApi, 'asignarAreaEquipo').mockResolvedValue({ ok: true, areaId: '2', avisos: [] });
    montar({ editar: true });
    const bar = await equipo('11');
    fireEvent.change(within(bar).getByRole('combobox'), { target: { value: '2' } });
    await waitFor(() => expect(asignar).toHaveBeenCalledWith('11', '2'));
  });

  it('mover un equipo con trabajos en cola desde Caja pide confirmación antes de guardar', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa({ colaPendientePorEquipo: [{ deviceKeyId: '10', pendientes: 3 }, { deviceKeyId: '11', pendientes: 0 }] }));
    const asignar = vi.spyOn(impresionApi, 'asignarAreaEquipo').mockResolvedValue({ ok: true, areaId: '2', avisos: [] });
    montar({ editar: true });
    const caja = await equipo('10');
    fireEvent.change(within(caja).getByRole('combobox'), { target: { value: '2' } });
    expect(await screen.findByText('¿Mover este equipo?')).toBeInTheDocument();
    expect(asignar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, mover' }));
    await waitFor(() => expect(asignar).toHaveBeenCalledWith('10', '2'));
  });

  it('sin permiso para editar, los controles quedan solo lectura y hay aviso', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    montar({ editar: false });
    expect(await screen.findByText(/Solo puedes ver este mapa/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Sticker de bebida' })).toBeDisabled();
    const bar = await equipo('11');
    expect(within(bar).getByRole('combobox')).toBeDisabled();
  });

  it('si el servidor rechaza el cambio de equipo, el selector vuelve al área anterior', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    vi.spyOn(impresionApi, 'asignarAreaEquipo').mockRejectedValue(new Error('Área no válida'));
    montar({ editar: true });
    const bar = await equipo('11');
    const select = within(bar).getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '2' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó el cambio');
    // el nodo se vuelve a montar al revertir: se vuelve a buscar el selector
    await waitFor(() => {
      const otro = within(document.querySelector('[data-equipo="11"]') as HTMLElement).getByRole('combobox') as HTMLSelectElement;
      expect(otro.value).toBe('1');
    });
  });
});

describe('Mapa de impresión: leyenda, detalle y presión larga', () => {
  const nodoPieza = (clave: string) => document.querySelector(`[data-pieza="${clave}"]`) as HTMLElement;
  const dialogo = () => screen.queryByRole('dialog');

  beforeEach(() => {
    vi.restoreAllMocks();
    (window as any).innerWidth = 1024;
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Prueba', rol: 'ADMIN' },
      permisos: ['configuracion/ver', 'configuracion/editar'],
      debeCambiar: false, cargando: false, autenticado: true,
      ingresar: vi.fn(), salir: vi.fn(), renovar: vi.fn(), refrescarYo: vi.fn(), marcarClaveCambiada: vi.fn(),
      tiene: () => true,
    } as any);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('muestra la leyenda y los títulos ① ② ③', async () => {
    render(<MemoryRouter><ModuloMapaImpresion /></MemoryRouter>);
    await screen.findAllByText('Sticker de bebida');
    expect(screen.getByText('Línea viva')).toBeInTheDocument();
    expect(screen.getByText('Línea gris discontinua')).toBeInTheDocument();
    expect(screen.getByText('① Qué se imprime')).toBeInTheDocument();
    expect(screen.getByText('② Cuándo sale (reglas)')).toBeInTheDocument();
    expect(screen.getByText('③ En qué impresora sale')).toBeInTheDocument();
    expect(screen.getByText('Elige un tipo de pedido y mira qué se imprime')).toBeInTheDocument();
    expect(screen.getByText('Lo que saldría')).toBeInTheDocument();
  });

  it('la regla de resumen muestra «Sale en:» con las modalidades completas', async () => {
    render(<MemoryRouter><ModuloMapaImpresion /></MemoryRouter>);
    await screen.findAllByText('Sticker de bebida');
    // Tres reglas con «Sale en:»: resumen, sticker por área y sticker de bebida (la del resumen va primero)
    expect(screen.getAllByText('Sale en:').length).toBe(3);
    const resumen = screen.getByRole('group', { name: /resumen/i });
    expect(within(resumen).getByRole('button', { name: 'Salón' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(resumen).getByRole('button', { name: 'Para llevar' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(resumen).getByRole('button', { name: 'Delivery' })).toHaveAttribute('aria-pressed', 'true');
    // El vaso de bebida del fixture sale en todas; el de área, en llevar y delivery
    const bebida = screen.getByRole('group', { name: /sticker de bebida/i });
    expect(within(bebida).getByRole('button', { name: 'Salón' })).toHaveAttribute('aria-pressed', 'true');
    const area = screen.getByRole('group', { name: /sticker por área/i });
    expect(within(area).getByRole('button', { name: 'Salón' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('mantener presionado 3 s abre el detalle; soltar antes no lo abre', async () => {
    render(<MemoryRouter><ModuloMapaImpresion /></MemoryRouter>);
    await screen.findAllByText('Sticker de bebida');
    vi.useFakeTimers();
    const nodo = nodoPieza('BEBIDA');
    fireEvent.pointerDown(nodo, { pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
    act(() => { vi.advanceTimersByTime(2000); });
    fireEvent.pointerUp(nodo);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(dialogo()).toBeNull();

    fireEvent.pointerDown(nodo, { pointerType: 'touch', button: 0, clientX: 10, clientY: 10 });
    act(() => { vi.advanceTimersByTime(2999); });
    expect(dialogo()).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByRole('dialog', { name: 'Detalle: Sticker de bebida' })).toBeInTheDocument();
  });

  it('mover más de 8 px cancela la presión; un movimiento pequeño no', async () => {
    render(<MemoryRouter><ModuloMapaImpresion /></MemoryRouter>);
    await screen.findAllByText('Sticker de bebida');
    vi.useFakeTimers();
    const nodo = nodoPieza('BEBIDA');
    fireEvent.pointerDown(nodo, { pointerType: 'mouse', button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(nodo, { pointerType: 'mouse', clientX: 30, clientY: 0 });
    act(() => { vi.advanceTimersByTime(3500); });
    expect(dialogo()).toBeNull();

    fireEvent.pointerDown(nodo, { pointerType: 'mouse', button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(nodo, { pointerType: 'mouse', clientX: 3, clientY: 3 });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(dialogo()).not.toBeNull();
  });

  it('presionar el selector de una impresora no abre su detalle', async () => {
    render(<MemoryRouter><ModuloMapaImpresion /></MemoryRouter>);
    const bar = await equipo('11');
    vi.useFakeTimers();
    fireEvent.pointerDown(within(bar).getByRole('combobox'), { pointerType: 'mouse', button: 0, clientX: 0, clientY: 0 });
    act(() => { vi.advanceTimersByTime(3500); });
    expect(dialogo()).toBeNull();
  });

  it('mantener presionado una impresora abre su detalle', async () => {
    render(<MemoryRouter><ModuloMapaImpresion /></MemoryRouter>);
    const bar = await equipo('11');
    vi.useFakeTimers();
    fireEvent.pointerDown(within(bar).getByText('Etiquetera bar'), { pointerType: 'mouse', button: 0, clientX: 0, clientY: 0 });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByRole('dialog', { name: 'Detalle: Etiquetera bar' })).toBeInTheDocument();
  });

  it('el botón «Ver detalle» abre el panel al instante con nombre, reglas, destino y EJEMPLO', async () => {
    render(<MemoryRouter><ModuloMapaImpresion /></MemoryRouter>);
    await screen.findAllByText('Sticker de bebida');
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Sticker de bebida' }));
    const panel = await screen.findByRole('dialog', { name: 'Detalle: Sticker de bebida' });
    expect(within(panel).getByText(/Regla encendida: sale en cada pedido que lleva bebidas/)).toBeInTheDocument();
    expect(within(panel).getByText('Etiquetera bar')).toBeInTheDocument();
    expect(within(panel).getByText(/no está listo/)).toBeInTheDocument();
    expect(within(panel).getAllByText('EJEMPLO').length).toBeGreaterThan(0);
    expect(within(panel).getByRole('img', { name: /Vista previa de la etiqueta de bebida/ })).toBeInTheDocument();
  });

  it('Esc cierra el panel y devuelve el foco al botón que lo abrió', async () => {
    render(<MemoryRouter><ModuloMapaImpresion /></MemoryRouter>);
    await screen.findAllByText('Sticker de bebida');
    const boton = screen.getByRole('button', { name: 'Ver detalle de Sticker de bebida' });
    fireEvent.click(boton);
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(dialogo()).toBeNull());
    expect(document.activeElement).toBe(boton);
  });

  it('el botón Cerrar cierra el panel; tocar fuera también', async () => {
    render(<MemoryRouter><ModuloMapaImpresion /></MemoryRouter>);
    await screen.findAllByText('Sticker de bebida');
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Sticker de bebida' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(dialogo()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Sticker de bebida' }));
    await screen.findByRole('dialog');
    fireEvent.pointerDown(document.body);
    expect(dialogo()).toBeNull();
  });

  it('el panel no bloquea las reglas: se puede cambiar un interruptor con el panel abierto', async () => {
    const guardar = vi.spyOn(impresionApi, 'guardarReglasImpresion').mockResolvedValue({ ok: true, reglas: { ...mapa().reglas, bebidaActivo: false } });
    render(<MemoryRouter><ModuloMapaImpresion /></MemoryRouter>);
    await screen.findAllByText('Sticker de bebida');
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Sticker de bebida' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('switch', { name: 'Sticker de bebida' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith({ bebidaActivo: false }));
  });

  it('el detalle de un sticker de resumen trae su vista previa EJEMPLO', async () => {
    render(<MemoryRouter><ModuloMapaImpresion /></MemoryRouter>);
    await screen.findAllByText('Sticker de bebida');
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Sticker de resumen' }));
    const panel = await screen.findByRole('dialog', { name: 'Detalle: Sticker de resumen' });
    expect(within(panel).getByRole('img', { name: /Vista previa de la etiqueta general/ })).toBeInTheDocument();
    expect(within(panel).getByText(/Sale en: Para llevar · Delivery/)).toBeInTheDocument();
  });

  it('cada área tiene dos sub-ranuras: la etiquetera con su equipo, y la ticketera sin equipo sale en Caja', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    montar({ editar: true });
    const bebidas = await screen.findByRole('region', { name: 'Ranura Bebidas' });
    const etiq = within(bebidas).getByText('Etiquetera de stickers').closest('[data-maquina]') as HTMLElement;
    expect(within(etiq).getByText('Etiquetera bar · sin papel')).toBeInTheDocument();
    const tick = within(bebidas).getByText('Ticketera de tickets').closest('[data-maquina]') as HTMLElement;
    expect(within(tick).getByText('Este equipo no tiene ticketera: sale en Caja.')).toBeInTheDocument();
    const salados = screen.getByRole('region', { name: 'Ranura Salados' });
    expect(within(salados).getAllByText('Sin impresora propia: sale en la de Caja')).toHaveLength(2);
    expect(within(salados).getAllByRole('button', { name: '+ Asignar equipo' })).toHaveLength(2);
    const enlaces = within(salados).getAllByRole('link', { name: 'Vincular un equipo nuevo' });
    expect(enlaces[0].getAttribute('href')).toContain('seccion=equipos');
  });

  it('+ Asignar equipo abre el selector con los equipos vinculados y envía {areaId} al confirmar', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    const asignar = vi.spyOn(impresionApi, 'asignarAreaEquipo').mockResolvedValue({ ok: true, areaId: '2', avisos: [] });
    montar({ editar: true });
    const salados = await screen.findByRole('region', { name: 'Ranura Salados' });
    fireEvent.click(within(salados).getAllByRole('button', { name: '+ Asignar equipo' })[0]);
    const select = within(salados).getByRole('combobox', { name: /Equipo que atiende la etiquetera de Salados/ });
    expect(within(select).getByText(/PC Caja/)).toBeInTheDocument();
    fireEvent.change(select, { target: { value: '10' } });
    fireEvent.click(within(salados).getByRole('button', { name: 'Asignar a Salados' }));
    await waitFor(() => expect(asignar).toHaveBeenCalledWith('10', '2'));
  });

  it('si el área ya tiene equipo para esa máquina, confirma el reemplazo y envía reemplazar:true', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    const asignar = vi.spyOn(impresionApi, 'asignarAreaEquipo')
      .mockRejectedValueOnce(new ErrorApi('AREA_OCUPADA', 'ocupada', 409, { ocupadoPor: { deviceKeyId: '11', nombre: 'Etiquetera bar' } }))
      .mockResolvedValueOnce({ ok: true, areaId: '1', avisos: [], reemplazados: ['11'] } as any);
    montar({ editar: true });
    const caja = await equipo('10');
    fireEvent.change(within(caja).getByRole('combobox'), { target: { value: '1' } });
    expect(await screen.findByText('Bebidas ya la atiende «Etiquetera bar». ¿Reemplazarla por «PC Caja»? «Etiquetera bar» dejará de imprimir.')).toBeInTheDocument();
    expect(asignar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reemplazar' }));
    await waitFor(() => expect(asignar).toHaveBeenLastCalledWith('10', '1', true));
  });

  it('«Reemplazar este equipo» en una sub-ranura elige el nuevo, confirma y llama al atajo de reemplazo', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    const reemplazar = vi.spyOn(impresionApi, 'reemplazarEquipo').mockResolvedValue({ ok: true, reemplazados: ['11'] });
    montar({ editar: true });
    const bebidas = await screen.findByRole('region', { name: 'Ranura Bebidas' });
    fireEvent.click(within(bebidas).getByRole('button', { name: 'Reemplazar este equipo' }));
    fireEvent.change(within(bebidas).getByRole('combobox', { name: /ocupará el lugar de «Etiquetera bar»/ }), { target: { value: '10' } });
    fireEvent.click(within(bebidas).getByRole('button', { name: 'Reemplazar' }));
    expect(await screen.findByText('Bebidas ya la atiende «Etiquetera bar». ¿Reemplazarla por «PC Caja»? «Etiquetera bar» dejará de imprimir.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reemplazar' }));
    await waitFor(() => expect(reemplazar).toHaveBeenCalledWith('11', '10'));
  });

  it('avisa de equipos duplicados y «Quedarme con este» desactiva el otro, con confirmación', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa({
      duplicados: [{ areaId: '1', nombre: 'Bebidas', equipos: [{ deviceKeyId: '11', nombre: 'Etiquetera bar' }, { deviceKeyId: '12', nombre: 'Barra 2' }] }],
    }));
    const quedarse = vi.spyOn(impresionApi, 'quedarseCon').mockResolvedValue({ ok: true, desactivados: ['12'] });
    montar({ editar: true });
    expect(await screen.findByText('Hay 2 equipos para esta área: deja solo uno.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quedarme con este equipo: Etiquetera bar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, dejar solo este' }));
    await waitFor(() => expect(quedarse).toHaveBeenCalledWith('11'));
  });

  it('la pieza «Comanda por área» viene apagada y su interruptor guarda comandaAreaActivo', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    const guardar = vi.spyOn(impresionApi, 'guardarReglasImpresion').mockResolvedValue({ ok: true, reglas: { ...mapa().reglas, comandaAreaActivo: true } });
    montar({ editar: true });
    const interruptor = await screen.findByRole('switch', { name: 'Comanda por área' });
    expect(interruptor).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByText('Una hoja por área para su cocina').length).toBeGreaterThan(0);
    fireEvent.click(interruptor);
    await waitFor(() => expect(guardar).toHaveBeenCalledWith({ comandaAreaActivo: true }));
  });

  it('el mapa recuerda la regla de un solo equipo por área y en Caja', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    montar({ editar: true });
    expect(await screen.findByText('Un solo equipo por área y tipo de máquina, y uno en Caja.')).toBeInTheDocument();
  });

  it('«Restablecer a lo recomendado» pide confirmación, llama al endpoint, vuelve a leer y avisa', async () => {
    const obtener = vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    const restablecer = vi.spyOn(impresionApi, 'restablecerReglasImpresion').mockResolvedValue({ ok: true, reglas: mapa().reglas });
    montar({ editar: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Restablecer a lo recomendado' }));
    expect(await screen.findByText(/No cambia a qué área atiende cada equipo\./)).toBeInTheDocument();
    expect(restablecer).not.toHaveBeenCalled();
    const llamadasAntes = obtener.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Sí, restablecer' }));
    await waitFor(() => expect(restablecer).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('status')).toHaveTextContent('Reglas restablecidas');
    await waitFor(() => expect(obtener.mock.calls.length).toBeGreaterThan(llamadasAntes));
  });

  it('cancelar la confirmación de restablecer no llama al servidor', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    const restablecer = vi.spyOn(impresionApi, 'restablecerReglasImpresion').mockResolvedValue({ ok: true, reglas: mapa().reglas });
    montar({ editar: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Restablecer a lo recomendado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'No, cancelar' }));
    expect(restablecer).not.toHaveBeenCalled();
  });

  it('sin permiso de editar no hay botón de restablecer, pero sí el texto de lo recomendado', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    montar({ editar: false });
    expect(await screen.findByText(/Lo recomendado:/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restablecer a lo recomendado' })).not.toBeInTheDocument();
  });
});
