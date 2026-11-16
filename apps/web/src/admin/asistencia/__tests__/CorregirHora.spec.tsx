import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cambiar = vi.fn();
const crear = vi.fn();
vi.mock('../correccionesApi', async (orig) => ({
  ...(await orig<any>()),
  cambiarHoraMarca: (...a: any[]) => cambiar(...a),
  crearSolicitud: (...a: any[]) => crear(...a),
  miInconsistencias: vi.fn(async () => []),
  misSolicitudes: vi.fn(async () => []),
}));
vi.mock('../miCalendarioApi', () => ({ miCalendario: vi.fn(), miPlanilla: vi.fn() }));

import { TarjetasMarcas } from '../TarjetasMarcas';
import { vistaPrevia } from '../CambiarHoraMarca';
import { CorreccionesAsistencia } from '../CorreccionesAsistencia';
import { MiCalendario } from '../MiCalendario';
import * as calApi from '../miCalendarioApi';

const fila: any = {
  fecha: '2026-11-06', partyId: '7', nombre: 'Luis Pérez', rol: 'MOZO', turno: { entrada: '14:00', salida: '23:00' },
  marcas: [], entrada: '14:12', salida: null, almuerzoSalida: null, almuerzoVuelta: null, almuerzoMin: null,
  trabajadaMin: 0, tardanzaMin: 12, salioAntesMin: 0, extraMin: 0, estado: 'TARDANZA', solicitudes: [], inconsistencias: [],
};
const marca = { id: 50, minutos: 852, hora: '14:12', momento: '2026-11-06T19:12:00.000Z', origen: 'CELULAR', estado: 'VALIDA', rol: 'ENTRADA', duplicada: false, tieneSelfie: false, motivo: null, alertas: null };
const dia: any = { jornada: '2026-11-06', estado: 'TARDANZA', turno: null, marcas: [marca, { ...marca, id: 51, hora: '15:00', minutos: 900, rol: 'SALIDA', origen: 'CORRECCION', motivo: 'Hora corregida de 14:12 a 14:00 por Ana (marca #49): Falla del sistema' }], solicitudes: [] };

const montar = (recargar = vi.fn(async () => undefined)) =>
  render(<TarjetasMarcas fila={fila} dia={dia} cargando={false} error={false} reintentar={() => undefined} onError={() => undefined} onOk={() => undefined} recargar={recargar} />);

describe('Cambiar hora de una marca (admin)', () => {
  beforeEach(() => { cambiar.mockReset().mockResolvedValue({ ok: true }); });

  it('la vista previa muestra hora y tardanza antes → después', () => {
    expect(vistaPrevia(fila, marca as any, '14:00')).toBe('Entrada 14:12 → 14:00 · Tardanza 12 min → 0 min');
    expect(vistaPrevia(fila, { ...marca, rol: 'SALIDA' } as any, '22:30')).toBe('Salida 14:12 → 22:30');
  });

  it('el botón abre el formulario en el mismo detalle (sin modal) y «← Volver» regresa a las marcas', () => {
    montar();
    expect(screen.getByTestId('historial-correccion')).toHaveTextContent('Hora corregida de 14:12 a 14:00 por Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar hora de la marca de las 14:12' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('vista-previa')).toHaveTextContent('Entrada 14:12 → 14:12');
    fireEvent.change(screen.getByLabelText('Hora correcta'), { target: { value: '14:00' } });
    expect(screen.getByTestId('vista-previa')).toHaveTextContent('Entrada 14:12 → 14:00 · Tardanza 12 min → 0 min');
    fireEvent.click(screen.getAllByRole('button', { name: /Volver a las marcas/ })[0]);
    expect(screen.getByRole('list', { name: 'Marcas del día' })).toBeInTheDocument();
  });

  it('el motivo es obligatorio (10+) y el atajo de falla del sistema lo completa; guarda con la hora Lima', async () => {
    const recargar = vi.fn(async () => undefined);
    montar(recargar);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar hora de la marca de las 14:12' }));
    fireEvent.change(screen.getByLabelText('Hora correcta'), { target: { value: '14:00' } });
    const guardar = screen.getByRole('button', { name: 'Guardar nueva hora' });
    expect(guardar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'corto' } });
    expect(guardar).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Falla del sistema al marcar (GPS)' }));
    expect(guardar).toBeEnabled();
    fireEvent.click(guardar);
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith(50, '2026-11-06T14:00:00-05:00', 'Falla del sistema al marcar (GPS)', 'ENTRADA'));
    await waitFor(() => expect(recargar).toHaveBeenCalled());
  });

  it('si el período está pagado, muestra la explicación del servidor', async () => {
    cambiar.mockRejectedValue({ mensaje: 'Ese período ya está pagado. Reábrelo (con motivo) para cambiar la hora de esta marca.' });
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar hora de la marca de las 14:12' }));
    fireEvent.change(screen.getByLabelText('Hora correcta'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Falla del sistema al marcar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva hora' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ya está pagado');
  });
});

describe('Justificar mi tardanza (trabajador)', () => {
  beforeEach(() => { crear.mockReset().mockResolvedValue({ ok: true, id: 1 }); });

  it('el calendario ofrece «¿Quieres justificar esta tardanza?» con la hora del turno', async () => {
    const hoy = new Date(Date.now() - 9 * 3600_000).toISOString().slice(0, 10);
    (calApi.miCalendario as any).mockResolvedValue({
      desde: hoy, hasta: hoy, resumen: {},
      dias: [{ fecha: hoy, estado: 'TARDANZA', entrada: '14:12', tardanzaMin: 12, entradaMarcaId: 50, programado: { entrada: '14:00', salida: '23:00' }, marcas: [] }],
    });
    const alJustificar = vi.fn();
    render(<MiCalendario alJustificar={alJustificar} />);
    fireEvent.click(await screen.findByRole('button', { name: /Tardanza, entrada 14:12/ }));
    fireEvent.click(await screen.findByRole('button', { name: '¿Quieres justificar esta tardanza?' }));
    expect(alJustificar).toHaveBeenCalledWith({ jornada: hoy, justificar: { marcaId: 50, horaTurno: '14:00', tardanzaMin: 12 } });
  });

  it('el formulario trae la hora del turno, exige motivo de 10+ y envía una solicitud que reemplaza la marca', async () => {
    render(<CorreccionesAsistencia pedido={{ jornada: '2026-11-06', justificar: { marcaId: 50, horaTurno: '14:00', tardanzaMin: 12 } }} alAbrir={() => undefined} alCerrar={() => undefined} />);
    expect(screen.getByLabelText(/Hora a la que debió contar/)).toHaveValue('14:00');
    const enviar = screen.getByRole('button', { name: 'Enviar justificación' });
    expect(enviar).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Falla del sistema al marcar' }));
    expect(enviar).toBeEnabled();
    fireEvent.click(enviar);
    await waitFor(() => expect(crear).toHaveBeenCalledWith({
      jornada: '2026-11-06', items: [{ tipo: 'ENTRADA', hora: '14:00', reemplazaMarcaId: 50 }], motivo: 'Falla del sistema al marcar',
    }));
  });
});
