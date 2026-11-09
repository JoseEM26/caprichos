import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import * as sesionModulo from '../../../../comun/sesion';
import { impresionApi, type MapaImpresionDatos } from '../../impresionApi';
import { ImpresionFacil } from '../ImpresionFacil';
import { ATAJOS, RECOMENDADO_CAPRICHOS, celdaMarcada, cambioAlTocar } from '../logicaFacil';

vi.mock('../../../../comun/socket', () => ({ useEventos: () => undefined }));

const REGLAS = { ...RECOMENDADO_CAPRICHOS };

function mapa(over: Partial<MapaImpresionDatos> = {}): MapaImpresionDatos {
  return {
    duplicados: [],
    areas: [
      { id: '1', nombre: 'Bebidas', equiposPorRol: { ETIQUETERA: '11', TICKETERA: null } },
      { id: '2', nombre: 'Salados', equiposPorRol: { ETIQUETERA: null, TICKETERA: null } },
    ],
    equipos: [
      { deviceKeyId: '10', nombre: 'PC Caja', areaId: null, maquinas: ['ETIQUETERA', 'TICKETERA'], roles: [{ rol: 'ETIQUETERA', estado: 'lista' }, { rol: 'TICKETERA', estado: 'lista' }], ultimoLatido: null, conectado: true },
      { deviceKeyId: '11', nombre: 'PC Bebidas', areaId: '1', maquinas: ['ETIQUETERA'], roles: [{ rol: 'ETIQUETERA', estado: 'lista' }, { rol: 'TICKETERA', estado: 'no_configurada' }], ultimoLatido: null, conectado: true },
    ],
    reglas: REGLAS,
    ruteo: [
      { tipo: 'ETIQUETA_BEBIDA', areaId: '1', destinoAreaId: '1', destinoEquipoId: '11', destinoNombre: 'PC Bebidas', activo: true },
      { tipo: 'ETIQUETA_AREA', areaId: '2', destinoAreaId: null, destinoEquipoId: '10', destinoNombre: 'Caja', activo: true },
      { tipo: 'TICKET_PAGO', areaId: null, destinoAreaId: null, destinoEquipoId: '10', destinoNombre: 'Caja', activo: true },
    ],
    colaPendientePorEquipo: [],
    ...over,
  };
}

const CFG_OK = { ticketera: true, etiquetera: true, ticketPago: true, comandaSalon: true, comandaAreas: [], stickerGeneral: false, stickerAreas: ['2'], stickerBebidaAreas: [], tamanoGeneral: null, tamanoBebida: null, pausado: false, configurado: true };
const CFG_NUEVA = { ...CFG_OK, ticketera: false, etiquetera: false, ticketPago: false, comandaSalon: false, stickerAreas: [], configurado: false };
const equipo = (id: string, nombre: string, over: any = {}): any => ({
  deviceKeyId: id, nombre, areaId: null, areaNombre: null, conectado: true, impresoras: {}, candidatas: [], seleccion: {}, pendientes: 0,
  config: CFG_OK, ultimoLatido: new Date().toISOString(), ipLocal: ['192.168.1.20'], ipPublica: '200.1.1.1', version: '0.1.0', hostname: 'CAJA', sistema: 'win32', ...over,
});
let equiposEstado: any[] = [];
let extraEstado: any = {};
const estado = (): any => ({ agente: 'conectado', impresora: 'lista', pendientes: 0, fallidos: 0, equipos: equiposEstado, ...extraEstado });

function montar(opciones: { editar?: boolean; trabajos?: any[] } = {}) {
  const editar = opciones.editar ?? true;
  const permisos = editar ? ['configuracion/ver', 'configuracion/editar'] : ['configuracion/ver'];
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Prueba', rol: editar ? 'ADMIN' : 'CAJERO' },
    permisos,
    tiene: (p: string) => permisos.includes(p),
  } as any);
  vi.spyOn(impresionApi, 'obtenerEstado').mockResolvedValue(estado());
  vi.spyOn(impresionApi, 'listarTrabajos').mockResolvedValue({ items: opciones.trabajos ?? [], total: 0, pagina: 1, paginas: 1 });
  return render(<ImpresionFacil alVistaAvanzada={() => undefined} />);
}

describe('Impresión en 3 pasos', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    equiposEstado = [];
    extraEstado = {};
  });
  afterEach(() => vi.restoreAllMocks());

  it('muestra «Cómo funciona», las computadoras, las reglas generales aparte y lo último impreso (sin «Probar todas»)', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    montar();
    expect(await screen.findByText('Cómo funciona')).toBeInTheDocument();
    expect(screen.getByText(/se configura por separado/)).toBeInTheDocument();
    for (const id of ['paso-1', 'paso-2', 'paso-3']) expect(screen.getByTestId(id)).toBeInTheDocument();
    expect(within(screen.getByTestId('paso-1')).getByText('Tus computadoras')).toBeInTheDocument();
    expect(within(screen.getByTestId('paso-2')).getByText('Reglas generales del local')).toBeInTheDocument();
    expect(screen.queryByTestId('probar-todo')).toBeNull();
    expect(screen.queryByText(/Imprimir una prueba en cada impresora/)).toBeNull();
    expect(screen.queryByTestId('aviso-armado')).toBeNull();
  });

  it('las reglas generales son un card aparte y plegado por defecto', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    montar();
    const det = (await screen.findByTestId('reglas-plegado')) as HTMLDetailsElement;
    expect(det.open).toBe(false);
    expect(det.closest('[data-testid="paso-2"]')).not.toBeNull();
    expect(det.closest('[data-testid="paso-1"]')).toBeNull();
  });

  it('una tarjeta compacta por PC (la nueva arriba), contador y clic abre la ventana de configuración', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    equiposEstado = [equipo('10', 'PC Caja'), equipo('12', 'PC recién vinculada', { config: CFG_NUEVA, ultimoLatido: null, conectado: false })];
    montar();
    const lista = await screen.findByTestId('lista-pcs');
    const tarjetas = within(lista).getAllByRole('button');
    expect(tarjetas.map((t) => t.getAttribute('data-testid')).filter((t) => t?.startsWith('card-'))).toEqual(['card-12', 'card-10']);
    expect(screen.getByTestId('contador-pcs')).toHaveTextContent('2 computadoras · 1 conectada');
    expect(screen.getByTestId('card-12')).toHaveTextContent('Nueva · falta configurar');
    expect(screen.getByTestId('card-10')).toHaveTextContent('Ticket de pago');
    expect(screen.getByTestId('aviso-nuevas')).toHaveTextContent('recién vinculada');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByTestId('card-10'));
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(within(dialogo).getByTestId('nombre-10')).toHaveValue('PC Caja');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('el panel «Vista previa» está abierto y «Ver ejemplos» de una PC lo abre con el tamaño de esa PC', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    equiposEstado = [equipo('10', 'PC Caja', { config: { ...CFG_OK, tamanoBebida: { anchoMm: 60, altoMm: 40 } } }), equipo('11', 'PC Bebidas')];
    montar();
    const panel = await screen.findByTestId('panel-previa');
    expect(panel.querySelector('details')).toHaveAttribute('open');
    fireEvent.click(screen.getByTestId('ver-ejemplos-10'));
    expect((screen.getByTestId('pv-pc') as HTMLSelectElement).value).toBe('10');
    expect(screen.getByTestId('pv-texto')).toHaveTextContent('60 × 40 mm (PC Caja)');
  });

  it('deduplica: una PC archivada/antigua no sale y la repetida lleva insignia «Posible duplicado»', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    equiposEstado = [
      equipo('10', 'CAJA', { conectado: false, antigua: true, ultimoLatido: new Date(Date.now() - 5 * 3600000).toISOString() }),
      equipo('11', 'Programa del local', { hostname: 'CAPRICHOS-CAJA' }),
      equipo('12', 'Otra', { hostname: 'CAPRICHOS-CAJA', conectado: false, ultimoLatido: new Date(Date.now() - 3600000).toISOString() }),
    ];
    montar();
    await screen.findByTestId('lista-pcs');
    expect(screen.queryByTestId('card-10')).toBeNull();
    expect(screen.getByTestId('pcs-ocultas')).toHaveTextContent('1 computadora antigua');
    expect(screen.getByTestId('dup-12')).toHaveTextContent('Posible duplicado de Programa del local');
    expect(screen.queryByTestId('dup-11')).toBeNull();
    expect(screen.getByTestId('contador-pcs')).toHaveTextContent('2 computadoras · 1 conectada');
  });

  it('avisa cuando hay papeles que ninguna PC imprime', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    equiposEstado = [equipo('10', 'PC Caja')];
    extraEstado = { sinReceptor: 3 };
    montar();
    expect(await screen.findByTestId('aviso-sin-receptor')).toHaveTextContent('Ninguna PC imprime 3 papeles');
  });

  it('la tabla marca lo recomendado y tocar una casilla guarda solo ese cambio', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    const guardar = vi.spyOn(impresionApi, 'guardarReglasImpresion').mockResolvedValue({ ok: true, reglas: REGLAS });
    montar();
    const celda = (f: string, c: string) => screen.findByTestId(`celda-${f}-${c}`) as Promise<HTMLInputElement>;
    expect((await celda('PAGO', 'LOCAL')).checked).toBe(true);
    expect((await celda('PAGO', 'LOCAL')).disabled).toBe(true);
    expect((await celda('COMANDA', 'LOCAL')).checked).toBe(true);
    expect((await celda('BEBIDA', 'LOCAL')).checked).toBe(false);
    expect((await celda('BEBIDA', 'DELIVERY')).checked).toBe(true);
    expect((await celda('GENERAL', 'LLEVAR')).checked).toBe(false);
    expect(screen.queryByTestId('celda-COMANDA-DELIVERY')).toBeNull();

    fireEvent.click(await celda('GENERAL', 'DELIVERY'));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith({ generalModalidades: ['DELIVERY'] }));
  });

  it('«Recomendado para Caprichos» pide confirmar y guarda las reglas del dueño', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(
      mapa({ reglas: { ...REGLAS, bebidaModalidades: ['MESA', 'LOCAL', 'LLEVAR'], generalModalidades: ['LLEVAR'], comandaSalonActivo: false } }),
    );
    const guardar = vi.spyOn(impresionApi, 'guardarReglasImpresion').mockResolvedValue({ ok: true, reglas: REGLAS });
    montar();
    fireEvent.click(await screen.findByTestId('atajo-recomendado'));
    fireEvent.click(await screen.findByRole('button', { name: /Sí, usar este/ }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(RECOMENDADO_CAPRICHOS));
    expect(RECOMENDADO_CAPRICHOS.generalModalidades).toEqual([]);
    expect(RECOMENDADO_CAPRICHOS.bebidaModalidades).not.toContain('MESA');
  });

  it('avisa en rojo cuando Bebidas no tiene computadora', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(
      mapa({
        equipos: [mapa().equipos[0]],
        ruteo: [
          { tipo: 'ETIQUETA_BEBIDA', areaId: '1', destinoAreaId: null, destinoEquipoId: '10', destinoNombre: 'Caja', activo: true },
          { tipo: 'TICKET_PAGO', areaId: null, destinoAreaId: null, destinoEquipoId: '10', destinoNombre: 'Caja', activo: true },
        ],
      }),
    );
    montar();
    expect(await screen.findByTestId('aviso-armado')).toHaveTextContent('Bebidas no tiene computadora: los vasos están saliendo en Caja');
    expect(screen.getByTestId('fila-BEBIDA')).toHaveTextContent('Bebidas no tiene computadora');
  });

  it('«Ver ejemplo» abre la vista del papel', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    montar();
    const fila = await screen.findByTestId('fila-BEBIDA');
    fireEvent.click(within(fila).getByRole('button', { name: 'Ver ejemplo' }));
    expect(document.querySelector('.mapa-vista[data-clave="BEBIDA"]')).not.toBeNull();
  });

  it('lista lo último que se imprimió con el motivo y reintenta lo que falló', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    const reintentar = vi.spyOn(impresionApi, 'reintentarTrabajo').mockResolvedValue({ ok: true, mensaje: 'ok' });
    montar({
      trabajos: [
        { id: '7', pedidoId: '5', pedidoCodigo: 'CP-5', clienteNombre: '', tipo: 'ETIQUETA_BEBIDA', estado: 'FALLIDO', intentos: 5, error: 'Sin papel', copia: false, en: '', destinoAreaId: '1', payload: {} },
        { id: '6', pedidoId: '5', pedidoCodigo: 'CP-5', clienteNombre: '', tipo: 'TICKET_PAGO', estado: 'IMPRESO', intentos: 1, error: null, copia: false, en: '', destinoAreaId: null, payload: {} },
        { id: '5', pedidoId: null, pedidoCodigo: '', clienteNombre: '', tipo: 'TICKET_PAGO', estado: 'PENDIENTE', intentos: 0, error: null, copia: false, en: '', destinoAreaId: null, payload: {} },
      ],
    });
    const fallo = await screen.findByTestId('trabajo-7');
    expect(fallo).toHaveTextContent('STICKER · Bebida');
    expect(fallo).toHaveTextContent('en PC Bebidas');
    expect(fallo).toHaveTextContent('Falló');
    expect(fallo).toHaveTextContent('No se pudo imprimir: Sin papel');
    expect(screen.getByTestId('trabajo-6')).toHaveTextContent('Salió bien');
    expect(screen.getByTestId('trabajo-5')).toHaveTextContent('PRUEBA');
    expect(screen.getByTestId('trabajo-5')).toHaveTextContent('En cola');
    fireEvent.click(within(fallo).getByRole('button', { name: 'Reintentar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, reintentar' }));
    await waitFor(() => expect(reintentar).toHaveBeenCalledWith('7'));
  });

  it('lo último se separa en pestañas con contador, reimprime en la misma máquina y ofrece Ver toda la cola', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    const reimprimir = vi.spyOn(impresionApi, 'reimprimirTrabajos').mockResolvedValue({ ok: true, creados: 1, rechazados: [], trabajoIds: ['9'], mensaje: 'Se enviaron 1 copia(s) a imprimir' });
    montar({
      trabajos: [
        { id: '7', pedidoId: '5', pedidoCodigo: 'CP-5', clienteNombre: '', tipo: 'ETIQUETA_BEBIDA', estado: 'IMPRESO', intentos: 1, error: null, copia: false, en: '', destinoAreaId: '1', payload: {} },
        { id: '6', pedidoId: '5', pedidoCodigo: 'CP-5', clienteNombre: '', tipo: 'TICKET_PAGO', estado: 'IMPRESO', intentos: 1, error: null, copia: false, en: '', destinoAreaId: null, payload: {} },
      ],
    });
    await screen.findByTestId('trabajo-7');
    expect(screen.getByTestId('cuenta-ETIQUETERA')).toHaveTextContent('1');
    expect(screen.getByTestId('cuenta-TICKETERA')).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('tab', { name: /Tickets \(térmica\)/ }));
    expect(screen.queryByTestId('trabajo-7')).toBeNull();
    fireEvent.click(within(screen.getByTestId('trabajo-6')).getByRole('button', { name: 'Reimprimir' }));
    expect(screen.getByText('Se imprimirá otra copia del ticket del pago del pedido CP-5 en PC Caja.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reimprimir' }));
    await waitFor(() => expect(reimprimir).toHaveBeenCalledWith({ ids: ['6'] }));
    expect(screen.getByRole('button', { name: 'Ver toda la cola' })).toBeInTheDocument();
  });

  it('sin permiso de editar las casillas quedan bloqueadas', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    montar({ editar: false });
    expect(((await screen.findByTestId('celda-BEBIDA-LLEVAR')) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('atajo-recomendado')).toBeDisabled();
  });
});

describe('lógica de la tabla', () => {
  it('encender sticker de bebida en el local agrega MESA y LOCAL y lo activa', () => {
    const r = { ...REGLAS, bebidaActivo: false, bebidaModalidades: [] };
    expect(celdaMarcada(r, 'BEBIDA', 'LOCAL')).toBe(false);
    expect(cambioAlTocar(r, 'BEBIDA', 'LOCAL')).toEqual({ bebidaModalidades: ['MESA', 'LOCAL'], bebidaActivo: true });
  });

  it('los tres atajos dejan el ticket y nunca pisan las computadoras', () => {
    expect(ATAJOS.map((a) => a.id)).toEqual(['recomendado', 'ticket-comanda', 'solo-ticket']);
    const todoApagado = ATAJOS[2].reglas;
    expect(todoApagado.comandaSalonActivo).toBe(false);
    expect(todoApagado.bebidaActivo).toBe(false);
    expect(todoApagado.areaActivo).toBe(false);
    expect(todoApagado.generalModalidades).toEqual([]);
  });
});
