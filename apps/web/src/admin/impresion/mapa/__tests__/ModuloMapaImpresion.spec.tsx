import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as sesionModulo from '../../../../comun/sesion';
import { impresionApi, type MapaImpresionDatos } from '../../impresionApi';
import { ModuloMapaImpresion } from '../ModuloMapaImpresion';

vi.mock('../../../../comun/socket', () => ({ useEventos: () => undefined }));

function mapa(over: Partial<MapaImpresionDatos> = {}): MapaImpresionDatos {
  return {
    areas: [
      { id: '1', nombre: 'Bebidas' },
      { id: '2', nombre: 'Salados' },
    ],
    equipos: [
      { deviceKeyId: '10', nombre: 'PC Caja', areaId: null, roles: [{ rol: 'ETIQUETERA', estado: 'lista' }, { rol: 'TICKETERA', estado: 'lista' }], ultimoLatido: null, conectado: true },
      { deviceKeyId: '11', nombre: 'Etiquetera bar', areaId: '1', roles: [{ rol: 'ETIQUETERA', estado: 'sin_papel' }], ultimoLatido: null, conectado: true },
    ],
    reglas: { generalModalidades: ['LLEVAR', 'RECOGER', 'DELIVERY'], bebidaActivo: true, areaActivo: false, comandaSalonActivo: true },
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
