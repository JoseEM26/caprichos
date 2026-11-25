import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const miInc = vi.fn();
const misSol = vi.fn();
const crear = vi.fn();
const miCalendario = vi.fn();
vi.mock('../correccionesApi', async (orig) => ({
  ...(await orig<any>()),
  miInconsistencias: (...a: any[]) => miInc(...a),
  misSolicitudes: (...a: any[]) => misSol(...a),
  crearSolicitud: (...a: any[]) => crear(...a),
}));
vi.mock('../miCalendarioApi', () => ({ miCalendario: (...a: any[]) => miCalendario(...a), miPlanilla: vi.fn() }));

import { CorreccionesAsistencia, type PedidoCorreccion } from '../CorreccionesAsistencia';
import { MiCalendario } from '../MiCalendario';

const hoy = new Date(Date.now() - 9 * 3600_000).toISOString().slice(0, 10);
const [A, M] = hoy.split('-');
const f = (d: number) => `${A}-${M}-${String(d).padStart(2, '0')}`;

/** Igual que la pestaña Calendario: el detalle del día abre el modal de corrección. */
function Pestana() {
  const [pedido, setPedido] = useState<PedidoCorreccion | null>(null);
  return (
    <>
      <CorreccionesAsistencia pedido={pedido} alAbrir={setPedido} alCerrar={() => setPedido(null)} />
      <MiCalendario alPedirCorreccion={(jornada) => setPedido({ jornada })} alJustificar={setPedido} />
    </>
  );
}

describe('Pedir corrección en modal', () => {
  beforeEach(() => {
    [miInc, misSol, crear, miCalendario].forEach((x) => x.mockReset());
    miInc.mockResolvedValue([]);
    misSol.mockResolvedValue([]);
    crear.mockResolvedValue({ ok: true, id: 1 });
    miCalendario.mockResolvedValue({ desde: f(1), hasta: f(28), dias: [{ fecha: f(3), estado: 'FALTA' }], resumen: {} });
  });

  const abrir = async () => {
    render(<Pestana />);
    fireEvent.click(await screen.findByRole('button', { name: /Falta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir corrección de este día' }));
    return screen.findByRole('dialog');
  };

  it('desde el detalle del día se abre en un dialog con el foco dentro', async () => {
    const dialogo = await abrir();
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleName('Pedir corrección');
    expect(within(dialogo).getByRole('form', { name: 'Pedir corrección de asistencia' })).toBeInTheDocument();
    expect(dialogo.contains(document.activeElement)).toBe(true);
  });

  it('Esc cierra sin preguntar si no hay nada escrito', async () => {
    const dialogo = await abrir();
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('con texto escrito pide confirmar antes de descartar', async () => {
    const dialogo = await abrir();
    fireEvent.change(within(dialogo).getByLabelText(/Motivo/), { target: { value: 'Me olvidé' } });
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    expect(await screen.findByText('¿Descartar lo escrito?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No, seguir' }));
    expect(screen.getByRole('dialog', { name: 'Pedir corrección' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Pedir corrección' }), { key: 'Escape' });
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, descartar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(crear).not.toHaveBeenCalled();
  });

  it('enviar llama a la API, cierra y muestra el aviso', async () => {
    const dialogo = await abrir();
    fireEvent.change(within(dialogo).getByLabelText('Hora real'), { target: { value: '18:05' } });
    fireEvent.change(within(dialogo).getByLabelText(/Motivo/), { target: { value: 'Me olvidé de marcar' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Enviar solicitud' }));
    await waitFor(() => expect(crear).toHaveBeenCalledWith({ jornada: f(3), items: [{ tipo: 'SALIDA', hora: '18:05' }], motivo: 'Me olvidé de marcar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText(/Corrección enviada/)).toBeInTheDocument();
  });
});
