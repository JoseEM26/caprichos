import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { api, ErrorApi } from '../../comun/api';
import { ZonasMapa, areaAproxM2 } from '../configuracion/ZonasMapa';
import type { ZonaRepartoItem } from '../configuracion/ZonasRepartoView';

// Cuadrados pequeños cerca del local (lat, lng)
const cuadro = (lat0: number, lng0: number): [number, number][] => [
  [lat0, lng0],
  [lat0, lng0 + 0.01],
  [lat0 + 0.01, lng0 + 0.01],
  [lat0 + 0.01, lng0],
];

const zonas: ZonaRepartoItem[] = [
  { id: '1', codigo: 'Z2', tarifa: 2, activa: true, puntos: 4, poligono: cuadro(-12.02, -76.97) },
  { id: '2', codigo: 'Z3', tarifa: 3, activa: true, puntos: 4, poligono: cuadro(-12.01, -76.96) },
  { id: '3', codigo: 'Z7', tarifa: 7, activa: false, puntos: 4, poligono: cuadro(-12.0, -76.95) },
];

function renderMapa(props: Partial<React.ComponentProps<typeof ZonasMapa>> = {}) {
  const base = {
    zonas,
    seleccionado: null,
    onSeleccionar: vi.fn(),
    puedeEditar: true,
    diagnostico: null,
    versionHistorial: 0,
    onEditarTarifa: vi.fn(),
    onCambiarActiva: vi.fn(),
    onEditarJson: vi.fn(),
    onGuardarPoligono: vi.fn().mockResolvedValue(undefined),
  };
  const p = { ...base, ...props };
  render(<ZonasMapa {...p} />);
  return p;
}

describe('ZonasMapa', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue([] as any);
  });

  it('lista las zonas con tarifa y estado, y tocar una tarjeta la selecciona', () => {
    const p = renderMapa();
    expect(screen.getByRole('button', { name: /Zona Z2/ })).toHaveTextContent('S/ 2.00');
    expect(screen.getByRole('button', { name: /Zona Z7/ })).toHaveTextContent('Inactiva');
    fireEvent.click(screen.getByRole('button', { name: /Zona Z3/ }));
    expect(p.onSeleccionar).toHaveBeenCalledWith('Z3');
  });

  it('con zona seleccionada muestra su detalle y el historial', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce([
      {
        id: '9',
        accion: 'EDITAR_TARIFA',
        en: new Date().toISOString(),
        partyId: '1',
        antes: { codigo: 'Z3', tarifa: 3 },
        despues: { codigo: 'Z3', tarifa: 4 },
      },
    ] as any);
    renderMapa({ seleccionado: 'Z3' });
    expect(await screen.findByText('Tarifa: S/ 3.00 → S/ 4.00')).toBeInTheDocument();
    expect(screen.getByText(/usuario #1/)).toBeInTheDocument();
  });

  it('sin permiso de edición no ofrece editar tarifa, estado ni área', () => {
    renderMapa({ seleccionado: 'Z3', puedeEditar: false });
    expect(screen.queryByRole('button', { name: 'Editar tarifa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar área en el mapa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar JSON (avanzado)' })).toBeNull();
  });

  it('muestra los avisos de solape y de polígono inválido del diagnóstico, sin tratar los huecos como error', () => {
    renderMapa({
      diagnostico: {
        solapes: [{ ganadora: 'Z2', perdedora: 'Z3' }],
        invalidas: [{ codigo: 'Z7', activa: false, motivo: 'El polígono debe tener al menos 3 puntos distintos' }],
      },
    });
    expect(screen.getByText('Zona Z3 se solapa con Z2: en la parte compartida gana Z2 (menor código).')).toBeInTheDocument();
    expect(screen.getByText(/Zona Z7: polígono no válido/)).toBeInTheDocument();
    expect(screen.getByText(/Los espacios sin zona son normales/)).toBeInTheDocument();
  });

  it('editar el área en borrador: agregar un vértice, descartar sin guardar, y no guardar hasta confirmar', async () => {
    const p = renderMapa({ seleccionado: 'Z3' });
    fireEvent.click(screen.getByRole('button', { name: 'Editar área en el mapa' }));

    const barra = screen.getByRole('region', { name: 'Edición del área de la zona' });
    expect(within(barra).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    expect(within(barra).getByRole('button', { name: 'Quitar vértice' })).toBeDisabled();

    // Tocar un punto intermedio agrega un vértice (cuatro aristas, cuatro puntos medios)
    const medios = document.querySelectorAll('.cp-punto-medio-zona');
    expect(medios.length).toBe(4);
    fireEvent.click(medios[0]);
    expect(within(barra).getByText(/5 vértices/)).toBeInTheDocument();
    expect(within(barra).getByRole('button', { name: 'Guardar cambios' })).not.toBeDisabled();

    // Nada se guarda al cambiar el borrador
    expect(p.onGuardarPoligono).not.toHaveBeenCalled();

    // Descartar vuelve al estado normal sin llamar al servidor
    fireEvent.click(within(barra).getByRole('button', { name: 'Descartar' }));
    expect(screen.queryByRole('region', { name: 'Edición del área de la zona' })).toBeNull();
    expect(p.onGuardarPoligono).not.toHaveBeenCalled();
  });

  it('guardar pide confirmación Sí/No con el resumen y solo al confirmar envía el polígono', async () => {
    const p = renderMapa({ seleccionado: 'Z3' });
    fireEvent.click(screen.getByRole('button', { name: 'Editar área en el mapa' }));
    fireEvent.click(document.querySelectorAll('.cp-punto-medio-zona')[0]);

    const barra = screen.getByRole('region', { name: 'Edición del área de la zona' });
    fireEvent.click(within(barra).getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('¿Guardar el nuevo área de la zona Z3?')).toBeInTheDocument();
    expect(screen.getByText('Vértices: 4 → 5')).toBeInTheDocument();
    expect(p.onGuardarPoligono).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(p.onGuardarPoligono).toHaveBeenCalledTimes(1));
    const llamada = (p.onGuardarPoligono as any).mock.calls[0];
    expect(llamada[0]).toBe('Z3');
    expect(llamada[1]).toHaveLength(5);
  });

  it('si el servidor rechaza el área muestra su mensaje y conserva el borrador', async () => {
    const p = renderMapa({
      seleccionado: 'Z3',
      onGuardarPoligono: vi.fn().mockRejectedValue(new ErrorApi('POLIGONO_INVALIDO', 'El polígono no puede tener autointersecciones', 400)),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Editar área en el mapa' }));
    fireEvent.click(document.querySelectorAll('.cp-punto-medio-zona')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));

    await waitFor(() => expect(p.onGuardarPoligono).toHaveBeenCalled());
    expect(await screen.findByRole('alert')).toHaveTextContent('El polígono no puede tener autointersecciones');
    expect(screen.getByRole('region', { name: 'Edición del área de la zona' })).toBeInTheDocument();
  });

  it('calcula el área aproximada en m² de un cuadrado de 1.1 km de lado', () => {
    const area = areaAproxM2([
      [-12.0, -76.97],
      [-12.0, -76.96],
      [-12.01, -76.96],
      [-12.01, -76.97],
    ]);
    // 0.01° de latitud ≈ 1106 m y 0.01° de longitud ≈ 1083 m a esa latitud
    expect(area).toBeGreaterThan(1.1e6);
    expect(area).toBeLessThan(1.3e6);
  });
});
