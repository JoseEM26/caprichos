import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RepartosView } from '../RepartosView';
import { repartosApi, OpcionRutaSugerida } from '../repartosApi';
import { ErrorApi } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

// Leaflet simulado: guarda los manejadores para poder simular un toque sobre el mapa y sobre una línea
const leaflet = vi.hoisted(() => {
  const m: any = {};
  for (const k of ['setView', 'fitBounds', 'setMaxBounds', 'remove', 'invalidateSize', 'panBy']) m[k] = vi.fn(() => m);
  m.on = vi.fn(() => m);
  m.latLngToContainerPoint = vi.fn(() => ({ x: 120, y: 200 }));
  m.getContainer = vi.fn(() => {
    const d = document.createElement('div');
    document.body.appendChild(d);
    return d;
  });
  const lineas: Array<{ coords: any; opts: any; click?: () => void }> = [];
  const polilinea = vi.fn((coords: any, opts: any) => {
    const l: any = { coords, opts, addTo: () => l, remove: () => {}, on: (_e: string, f: () => void) => { l.click = f; } };
    lineas.push(l);
    return l;
  });
  const zoom = vi.fn();
  const crearMapa = vi.fn();
  return { m, polilinea, lineas, zoom, crearMapa };
});

vi.mock('../../../comun/mapa/leaflet', () => {
  const capa = (): any => {
    const o: any = {};
    o.addTo = () => o;
    return o;
  };
  return {
    ATRIBUCION: '',
    URL_TESELAS: '',
    L: {
      map: (...a: unknown[]) => {
        leaflet.crearMapa(...a);
        return leaflet.m;
      },
      control: { zoom: (...a: unknown[]) => { leaflet.zoom(...a); return capa(); }, attribution: capa },
      tileLayer: capa,
      polyline: leaflet.polilinea,
      latLngBounds: (coords: unknown) => ({ coords, pad: () => coords }),
    },
  };
});

const parada = (id: string, orden: number) => ({
  id, codigo: `CP-${id}`, cliente: `Cliente ${id}`, orden, lat: -12.06 - orden / 100, lng: -77.04,
  llegadaMin: 10 * orden, llegadaEstimada: '2026-10-29T15:10:00Z', retrasoMin: 0, yaTarde: false,
});
const opcion = (id: string, sector: string, ids: string[]): OpcionRutaSugerida => ({
  id, sector, rumbo: 0, pedidos: ids.map((p, i) => parada(p, i + 1)),
  distanciaKm: 4.2, tiempoMin: 22, retrasoTotalMin: 0, yaTarde: 0, urgente: false, razon: 'Más pedidos en menos km',
  puntaje: 1, ruta: [[-12.05, -77.04], ...ids.map((_, i): [number, number] => [-12.06 - (i + 1) / 100, -77.04])],
});

describe('RepartidorView: rutas sugeridas sobre el mapa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leaflet.lineas.length = 0;
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '10', nombres: 'Repartidor 1', rol: 'REPARTIDOR' },
      permisos: ['repartos/ver', 'repartos/tomar'],
      cargando: false, autenticado: true, debeCambiar: false,
      tiene: vi.fn((p: string) => ['repartos/ver', 'repartos/tomar'].includes(p)),
    } as any);
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: [], orden: [], paso: [], ruta: [] });
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'listarProximos').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue({ umbralRetrasadoMin: 20, umbralTardeMin: 30, umbralMuyTardeMin: 45, velocidadMediaKmH: 20, maxPedidosPorRepartidor: 5 });
    vi.spyOn(repartosApi, 'listarRutasSugeridas').mockResolvedValue({
      opciones: [opcion('ra', 'Norte', ['1', '2', '3']), opcion('rb', 'Sur', ['4']), opcion('rc', 'Este', ['5', '6'])],
      sinUbicacion: [],
      cupo: 5,
    });
  });

  const abrir = async () => {
    render(<MemoryRouter><RepartosView /></MemoryRouter>);
    await waitFor(() => expect(repartosApi.listarRutasSugeridas).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: 'Más' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Rutas sugeridas/ }));
    return screen.findByTestId('hoja-rutas');
  };
  const encuadresDeRuta = () => leaflet.m.fitBounds.mock.calls.filter((c: any[]) => c[1]?.paddingBottomRight);

  it('abre plegada y ningún overlay con eventos cubre el mapa (plegada ni media)', async () => {
    const hoja = await abrir();
    expect(hoja).toHaveAttribute('data-altura', 'plegada');
    expect(hoja.style.height).toBe('136px');
    const sinCapaSobreElMapa = () => {
      const mapa = screen.getByTestId('mapa-repartidor');
      const vista = screen.getByTestId('vista-repartidor');
      const tapadores = [...vista.querySelectorAll<HTMLElement>('*')].filter(
        (el) => el.style.inset === '0px' && el.style.pointerEvents !== 'none' && !el.contains(mapa) && !mapa.contains(el),
      );
      expect(tapadores).toEqual([]);
      // la hoja es una caja pegada abajo, no un fondo a pantalla completa
      expect(hoja.style.top).toBe('');
    };
    sinCapaSobreElMapa();
    fireEvent.click(screen.getByTestId('hoja-rutas-asa'));
    expect(hoja).toHaveAttribute('data-altura', 'media');
    expect(hoja.style.height).toBe('40%');
    sinCapaSobreElMapa();
  });

  it('tres alturas: asa alterna, arrastre sube, baja y cierra; tocar el mapa pliega', async () => {
    const hoja = await abrir();
    const asa = screen.getByTestId('hoja-rutas-asa');
    fireEvent.pointerDown(asa, { clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(asa, { clientY: 400, pointerId: 1 });
    expect(hoja).toHaveAttribute('data-altura', 'media');
    fireEvent.click(asa); // el click que sigue al arrastre no alterna
    expect(hoja).toHaveAttribute('data-altura', 'media');

    const clicMapa = leaflet.m.on.mock.calls.find((c: any[]) => c[0] === 'click')[1];
    clicMapa();
    await waitFor(() => expect(hoja).toHaveAttribute('data-altura', 'plegada'));

    fireEvent.pointerDown(asa, { clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(asa, { clientY: 500, pointerId: 1 });
    await waitFor(() => expect(screen.queryByTestId('hoja-rutas')).toBeNull());
  });

  it('dibuja las 3 rutas; elegir un chip la engrosa, abre media y encuadra una sola vez', async () => {
    await abrir();
    await waitFor(() => expect(encuadresDeRuta()).toHaveLength(1)); // todas, al abrir
    const finas = leaflet.lineas.filter((l) => l.opts.opacity !== 0 && l.opts.weight === 3);
    expect(finas).toHaveLength(3);

    fireEvent.click(screen.getByTestId('chip-ruta-rb'));
    const hoja = screen.getByTestId('hoja-rutas');
    expect(hoja).toHaveAttribute('data-altura', 'media');
    expect(screen.getByTestId('chip-ruta-rb')).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByTestId('paradas-ruta')).getByText(/CP-4/)).toBeInTheDocument();
    await waitFor(() => expect(encuadresDeRuta()).toHaveLength(2));
    const gruesa = leaflet.lineas.filter((l) => l.opts.weight === 6);
    expect(gruesa.at(-1)?.opts.opacity).toBe(1);
    // marcador numerado de la ruta elegida aunque no esté en la pestaña
    expect(screen.getByTestId('marcador-4')).toHaveAttribute('data-numero', '1');

    // plegar y volver a plegar la hoja no vuelve a encuadrar
    fireEvent.click(screen.getByTestId('hoja-rutas-asa'));
    fireEvent.click(screen.getByTestId('hoja-rutas-asa'));
    expect(encuadresDeRuta()).toHaveLength(2);

    // tocar una línea de otra ruta la elige
    leaflet.lineas.filter((l) => l.coords.length === 3 && l.click).at(-1)!.click!();
    await waitFor(() => expect(screen.getByTestId('chip-ruta-rc')).toHaveAttribute('aria-pressed', 'true'));
    await waitFor(() => expect(encuadresDeRuta()).toHaveLength(3));

    fireEvent.click(screen.getByTestId('btn-ver-todo'));
    await waitFor(() => expect(encuadresDeRuta()).toHaveLength(4));
  });

  it('Tomar esta ruta pide confirmación Sí/No y la toma', async () => {
    const spy = vi.spyOn(repartosApi, 'tomarRutaSugerida').mockResolvedValue({ idOpcion: 'rb', tomados: [] } as any);
    await abrir();
    fireEvent.click(screen.getByTestId('chip-ruta-rb'));
    fireEvent.click(screen.getByRole('button', { name: 'Tomar esta ruta' }));
    fireEvent.click(screen.getByText('No'));
    expect(spy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tomar esta ruta' }));
    expect(screen.getByTestId('confirmar-pedidos-ruta')).toHaveTextContent('CP-4');
    fireEvent.click(screen.getByText('Sí, tomar la ruta'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'rb' })));
    await waitFor(() => expect(screen.queryByTestId('hoja-rutas')).toBeNull());
  });

  it('un 409 avisa con el mensaje, quita la elección y recarga', async () => {
    vi.spyOn(repartosApi, 'tomarRutaSugerida').mockRejectedValue(new ErrorApi('RUTA_YA_TOMADA', 'ya tomada', 409));
    await abrir();
    fireEvent.click(screen.getByTestId('chip-ruta-ra'));
    const antes = (repartosApi.listarRutasSugeridas as any).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Tomar esta ruta' }));
    fireEvent.click(screen.getByText('Sí, tomar la ruta'));
    await waitFor(() => expect(screen.getByTestId('hoja-rutas')).toHaveTextContent('Otro repartidor tomó parte de esta ruta'));
    expect(screen.getByTestId('chip-ruta-ra')).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect((repartosApi.listarRutasSugeridas as any).mock.calls.length).toBeGreaterThan(antes));
  });

  it('no hay control de zoom de Leaflet y el zoom táctil, doble toque y rueda están activos', async () => {
    await abrir();
    expect(leaflet.zoom).not.toHaveBeenCalled();
    expect(leaflet.crearMapa.mock.calls[0][1]).toMatchObject({ zoomControl: false, touchZoom: true, doubleClickZoom: true, scrollWheelZoom: true });
  });

  it('la cabecera tiene título, Ver todo y Cerrar (icono con aria-label) separados y del mismo alto', async () => {
    await abrir();
    const cab = screen.getByTestId('cabecera-rutas');
    expect(within(cab).getByRole('heading', { name: 'Rutas sugeridas' })).toBeInTheDocument();
    const ver = within(cab).getByRole('button', { name: /Ver todas las rutas/ });
    const cerrar = within(cab).getByRole('button', { name: 'Cerrar rutas sugeridas' });
    expect(ver.parentElement).toBe(cerrar.parentElement);
    expect(ver.parentElement!.style.gap).toBe('8px');
    expect(ver.style.minHeight).toBe('44px');
    expect(cerrar.style.minHeight).toBe('44px');
    expect(ver.style.padding).toBe('0px 12px');
  });
});
