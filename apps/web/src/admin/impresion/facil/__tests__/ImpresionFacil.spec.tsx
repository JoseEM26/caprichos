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

const estado = (): any => ({ agente: 'conectado', impresora: 'lista', pendientes: 0, fallidos: 0, equipos: [] });

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
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('muestra «Cómo funciona» y los tres pasos numerados', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    montar();
    expect(await screen.findByText('Cómo funciona')).toBeInTheDocument();
    expect(screen.getByText(/UNA sola para todo el local/)).toBeInTheDocument();
    for (const id of ['paso-1', 'paso-2', 'paso-3']) expect(screen.getByTestId(id)).toBeInTheDocument();
    expect(within(screen.getByTestId('paso-1')).getByText('Tus computadoras')).toBeInTheDocument();
    expect(within(screen.getByTestId('paso-2')).getByText('Qué se imprime')).toBeInTheDocument();
    expect(within(screen.getByTestId('paso-3')).getByText('Probar')).toBeInTheDocument();
    expect(screen.queryByTestId('aviso-armado')).toBeNull();
  });

  it('cada PC muestra su estado en una frase y su luz', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(
      mapa({
        equipos: [
          { deviceKeyId: '10', nombre: 'PC Caja', areaId: null, maquinas: ['ETIQUETERA', 'TICKETERA'], roles: [{ rol: 'ETIQUETERA', estado: 'lista' }, { rol: 'TICKETERA', estado: 'no_configurada' }], ultimoLatido: null, conectado: true },
          { deviceKeyId: '11', nombre: 'PC Bebidas', areaId: '1', maquinas: ['ETIQUETERA'], roles: [{ rol: 'ETIQUETERA', estado: 'lista' }], ultimoLatido: null, conectado: false },
        ],
        colaPendientePorEquipo: [{ deviceKeyId: '11', pendientes: 3 }],
      }),
    );
    montar();
    expect(await screen.findByTestId('estado-pc-10')).toHaveTextContent('No elegiste impresora de tickets');
    expect(screen.getByTestId('luz-10')).toHaveAttribute('data-nivel', 'ambar');
    expect(screen.getByTestId('estado-pc-11')).toHaveTextContent('El programa no está abierto en esta PC');
    expect(screen.getByTestId('estado-pc-11')).toHaveTextContent('3 papeles esperan');
    expect(screen.getByTestId('luz-11')).toHaveAttribute('data-nivel', 'rojo');
  });

  it('el selector «Esta PC imprime lo de» manda el área elegida', async () => {
    vi.spyOn(impresionApi, 'obtenerMapa').mockResolvedValue(mapa());
    const asignar = vi.spyOn(impresionApi, 'asignarAreaEquipo').mockResolvedValue({ ok: true, areaId: '2', avisos: [] });
    montar();
    fireEvent.change(await screen.findByTestId('area-10'), { target: { value: '2' } });
    await waitFor(() => expect(asignar).toHaveBeenCalledWith('10', '2'));
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
