import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { OpcionesRutaSugerida } from '../OpcionesRutaSugerida';
import { repartosApi, OpcionRutaSugerida, RespuestaRutasSugeridas } from '../repartosApi';
import { ErrorApi } from '../../../comun/api';

const parada = (id: string, orden: number, retrasoMin = 0) => ({
  id, codigo: `CP-${id}`, cliente: `Cliente ${id}`, orden, lat: -12, lng: -77,
  llegadaMin: 10 * orden, llegadaEstimada: '2026-10-29T15:10:00Z', retrasoMin, yaTarde: retrasoMin > 0,
});
const opcion = (id: string, sector: string, ids: string[], urgente = false): OpcionRutaSugerida => ({
  id, sector, rumbo: sector === 'Norte' ? 0 : 180, pedidos: ids.map((p, i) => parada(p, i + 1, urgente ? 5 : 0)),
  distanciaKm: 4.2, tiempoMin: 22, retrasoTotalMin: urgente ? 10 : 0, yaTarde: urgente ? 2 : 0, urgente,
  razon: urgente ? 'La más urgente: 2 pedidos ya van tarde' : 'Más pedidos en menos km', puntaje: 1, ruta: [[-12, -77], [-11.9, -77]],
});
const datos: RespuestaRutasSugeridas = {
  opciones: [opcion('ruta-a', 'Norte', ['1', '2'], true), opcion('ruta-b', 'Sur', ['3'])],
  sinUbicacion: [{ id: '9', codigo: 'CP-9', cliente: 'X' }],
  cupo: 3,
};

function Envoltura({ alCambiar = vi.fn(), alTomada = vi.fn(), d = datos }: any) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <>
      <span data-testid="seleccion">{sel ?? 'ninguna'}</span>
      <OpcionesRutaSugerida
        datos={d} cargando={false} error={null} alReintentar={vi.fn()}
        seleccionadaId={sel} alSeleccionar={setSel} alCambiar={alCambiar} alTomada={alTomada}
      />
    </>
  );
}

describe('OpcionesRutaSugerida', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lista las opciones con sector, pedidos, minutos, km, insignia Urgente y razón', () => {
    render(<Envoltura />);
    const a = screen.getByTestId('opcion-ruta-ruta-a');
    expect(a).toHaveTextContent('Ruta hacia el norte');
    expect(a).toHaveTextContent('2 pedidos');
    expect(a).toHaveTextContent('22 min');
    expect(a).toHaveTextContent('4.2 km');
    expect(a).toHaveTextContent('Urgente');
    expect(a).toHaveTextContent('La más urgente: 2 pedidos ya van tarde');
    expect(a).toHaveTextContent('CP-1 · Cliente 1');
    expect(screen.getByTestId('opcion-ruta-ruta-b')).not.toHaveTextContent('Urgente');
    expect(screen.getByTestId('rutas-sin-ubicacion')).toHaveTextContent('CP-9');
  });

  it('tocar una tarjeta la resalta (y atenúa las demás); otra vez la quita', () => {
    render(<Envoltura />);
    fireEvent.click(screen.getByTestId('opcion-ruta-ruta-b'));
    expect(screen.getByTestId('seleccion')).toHaveTextContent('ruta-b');
    expect(screen.getByTestId('opcion-ruta-ruta-b')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('opcion-ruta-ruta-a').style.opacity).toBe('0.6');
    fireEvent.click(screen.getByTestId('opcion-ruta-ruta-b'));
    expect(screen.getByTestId('seleccion')).toHaveTextContent('ninguna');
  });

  it('tomar pide confirmación Sí/No con los pedidos y luego asigna la ruta', async () => {
    const tomar = vi.spyOn(repartosApi, 'tomarRutaSugerida').mockResolvedValue({ idOpcion: 'ruta-a', tomados: [] });
    const alTomada = vi.fn();
    const alCambiar = vi.fn();
    render(<Envoltura alTomada={alTomada} alCambiar={alCambiar} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Tomar esta ruta' })[0]);
    expect(screen.getByTestId('confirmar-pedidos-ruta')).toHaveTextContent('CP-1 · Cliente 1');
    expect(screen.getByTestId('confirmar-pedidos-ruta')).toHaveTextContent('CP-2 · Cliente 2');
    expect(tomar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, tomar la ruta' }));
    await waitFor(() => expect(tomar).toHaveBeenCalledWith(datos.opciones[0], undefined));
    await waitFor(() => expect(alTomada).toHaveBeenCalled());
    expect(alCambiar).toHaveBeenCalled();
    expect(screen.getByTestId('aviso-rutas')).toHaveTextContent('Ruta tomada');
  });

  it('No cancela sin llamar al servidor', () => {
    const tomar = vi.spyOn(repartosApi, 'tomarRutaSugerida');
    render(<Envoltura />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Tomar esta ruta' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(tomar).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirmar-pedidos-ruta')).not.toBeInTheDocument();
  });

  it('ante un 409 RUTA_YA_TOMADA avisa y recarga las opciones', async () => {
    vi.spyOn(repartosApi, 'tomarRutaSugerida').mockRejectedValue(new ErrorApi('RUTA_YA_TOMADA', 'x', 409));
    const alTomada = vi.fn();
    const alCambiar = vi.fn();
    render(<Envoltura alTomada={alTomada} alCambiar={alCambiar} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Tomar esta ruta' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, tomar la ruta' }));
    await waitFor(() =>
      expect(screen.getByTestId('aviso-rutas')).toHaveTextContent(
        'Otro repartidor tomó parte de esta ruta; actualizamos las opciones',
      ),
    );
    expect(alCambiar).toHaveBeenCalled();
    expect(alTomada).not.toHaveBeenCalled();
  });

  it('estados vacío, cargando y error', () => {
    const { rerender } = render(<Envoltura d={{ opciones: [], sinUbicacion: [], cupo: 3 }} />);
    expect(screen.getByTestId('rutas-vacio')).toHaveTextContent('No hay pedidos listos para repartir');
    rerender(
      <OpcionesRutaSugerida datos={null} cargando error={null} alReintentar={vi.fn()} seleccionadaId={null} alSeleccionar={vi.fn()} alCambiar={vi.fn()} />,
    );
    expect(screen.getByText(/Calculando rutas sugeridas/)).toBeInTheDocument();
    rerender(
      <OpcionesRutaSugerida datos={null} cargando={false} error="Sin conexión" alReintentar={vi.fn()} seleccionadaId={null} alSeleccionar={vi.fn()} alCambiar={vi.fn()} />,
    );
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
  });
});
