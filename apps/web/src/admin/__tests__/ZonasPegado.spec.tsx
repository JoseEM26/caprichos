import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { api, ErrorApi } from '../../comun/api';
import { ZonasMapa } from '../configuracion/ZonasMapa';
import type { ZonaRepartoItem } from '../configuracion/ZonasRepartoView';

const KX = 111320 * Math.cos((-12 * Math.PI) / 180);
const KY = 110574;
const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] =>
  [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [-12 + y / KY, -77 + x / KX] as [number, number]);

const zonas: ZonaRepartoItem[] = [
  { id: '1', codigo: 'Z2', tarifa: 2, activa: true, puntos: 4, poligono: rect(0, 0, 100, 100) },
  { id: '2', codigo: 'Z3', tarifa: 3, activa: true, puntos: 4, poligono: rect(106, 0, 200, 100) },
];
const diagnostico = {
  solapes: [], invalidas: [], toleranciaM: 15,
  huecos: [{ zonaA: 'Z2', zonaB: 'Z3', metros: 6, fino: true }],
};

function renderMapa(props: Partial<React.ComponentProps<typeof ZonasMapa>> = {}) {
  const p = {
    zonas, seleccionado: 'Z3', onSeleccionar: vi.fn(), puedeEditar: true, diagnostico, versionHistorial: 0,
    onEditarTarifa: vi.fn(), onCambiarActiva: vi.fn(), onEditarJson: vi.fn(),
    onGuardarPoligono: vi.fn().mockResolvedValue(undefined), onZonasCambiadas: vi.fn(),
    ...props,
  };
  render(<ZonasMapa {...p} />);
  return p;
}

describe('ZonasMapa: pegado automático', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue([] as any);
  });

  it('muestra el resumen del pegado y "Pegar a zonas vecinas" lo aplica al borrador', () => {
    renderMapa();
    fireEvent.click(screen.getByRole('button', { name: 'Editar área en el mapa' }));
    const barra = screen.getByRole('region', { name: 'Edición del área de la zona' });
    expect(within(barra).getByRole('button', { name: 'Pegar a zonas vecinas' })).not.toBeDisabled();
    expect(within(barra).getByText(/Se pegaron 2 vértices/)).toBeInTheDocument();
    fireEvent.click(within(barra).getByRole('button', { name: 'Pegar a zonas vecinas' }));
    // ya pegada: no queda nada por ajustar
    expect(within(barra).getByRole('button', { name: 'Pegar a zonas vecinas' })).toBeDisabled();
    expect(within(barra).getByRole('button', { name: 'Deshacer' })).not.toBeDisabled();
  });

  it('agregar punto, deshacer y quitar vértice respetan el mínimo', () => {
    renderMapa({ diagnostico: null });
    fireEvent.click(screen.getByRole('button', { name: 'Editar área en el mapa' }));
    const barra = screen.getByRole('region', { name: 'Edición del área de la zona' });
    fireEvent.click(within(barra).getByRole('button', { name: 'Agregar punto' }));
    expect(within(barra).getByText(/5 vértices/)).toBeInTheDocument();
    fireEvent.click(within(barra).getByRole('button', { name: 'Deshacer' }));
    expect(within(barra).getByText(/4 vértices/)).toBeInTheDocument();
    expect(within(barra).getByRole('button', { name: 'Deshacer' })).toBeDisabled();
  });

  it('si el servidor responde 409 ZONA_SOLAPADA muestra qué zona se solapa', async () => {
    const err = new ErrorApi('ZONA_SOLAPADA', 'El área se solapa con la zona Z2.', 409, {
      codigo: 'ZONA_SOLAPADA', detalle: [{ zonaId: '1', nombre: 'Z2', areaM2: 420 }],
    });
    renderMapa({ diagnostico: null, onGuardarPoligono: vi.fn().mockRejectedValue(err) });
    fireEvent.click(screen.getByRole('button', { name: 'Editar área en el mapa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar punto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Zona Z2: 420 m² solapados');
  });

  it('Normalizar todas las zonas muestra la vista previa y solo al confirmar aplica', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (_r: string, b: any) =>
      b.confirmar
        ? ({ aplicado: true, zonas: [] } as any)
        : ({ aplicado: false, zonas: [{ codigo: 'Z3', cambia: true, resumen: { verticesAjustados: 2, verticesInsertados: 0, huecosCerrados: 1, huecoMaxM: 6, areaRecortadaM2: 0 }, puntosAntes: 4, puntosDespues: 4 }] } as any),
    );
    const p = renderMapa();
    fireEvent.click(screen.getByRole('button', { name: 'Normalizar todas las zonas' }));
    expect(await screen.findByText(/Se pegaron 2 vértices, se cerró un hueco de 6 m/)).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, normalizar' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][1]).toEqual({ confirmar: true });
    await waitFor(() => expect(p.onZonasCambiadas).toHaveBeenCalled());
  });

  it('Arreglar un hueco pide confirmación y guarda con motivo Pegado automático', async () => {
    const p = renderMapa({ seleccionado: null });
    fireEvent.click(screen.getByRole('button', { name: 'Arreglar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, pegar' }));
    await waitFor(() => expect(p.onGuardarPoligono).toHaveBeenCalled());
    expect((p.onGuardarPoligono as any).mock.calls[0][2]).toBe('Pegado automático');
  });
});
