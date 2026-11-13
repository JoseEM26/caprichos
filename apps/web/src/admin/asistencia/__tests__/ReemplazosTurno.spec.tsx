import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = {
  misTurnos: vi.fn(), candidatosTurno: vi.fn(), turnosParaDevolver: vi.fn(), crearTurno: vi.fn(),
  aceptarTurno: vi.fn(), rechazarTurno: vi.fn(), cancelarTurno: vi.fn(),
  turnosPorAprobar: vi.fn(), aprobarTurno: vi.fn(), rechazarTurnoAdmin: vi.fn(),
};
vi.mock('../turnosApi', async (orig) => ({
  ...(await orig<typeof import('../turnosApi')>()),
  misTurnos: (...a: any[]) => api.misTurnos(...a),
  candidatosTurno: (...a: any[]) => api.candidatosTurno(...a),
  turnosParaDevolver: (...a: any[]) => api.turnosParaDevolver(...a),
  crearTurno: (...a: any[]) => api.crearTurno(...a),
  aceptarTurno: (...a: any[]) => api.aceptarTurno(...a),
  rechazarTurno: (...a: any[]) => api.rechazarTurno(...a),
  cancelarTurno: (...a: any[]) => api.cancelarTurno(...a),
  turnosPorAprobar: (...a: any[]) => api.turnosPorAprobar(...a),
  aprobarTurno: (...a: any[]) => api.aprobarTurno(...a),
  rechazarTurnoAdmin: (...a: any[]) => api.rechazarTurnoAdmin(...a),
}));
const miCalendario = vi.fn();
vi.mock('../miCalendarioApi', () => ({ miCalendario: (...a: any[]) => miCalendario(...a) }));

import { ReemplazosTurno } from '../ReemplazosTurno';
import { PorAprobarTurnos } from '../PorAprobarTurnos';
import { jornadaActual } from '../jornada';

const sumar = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const FECHA = sumar(jornadaActual(), 3);

const pedido = (extra: Record<string, unknown> = {}) => ({
  id: 7, tipo: 'REEMPLAZO', estado: 'PENDIENTE_ACEPTA', fecha: FECHA, etiqueta: 'lunes 16', desde: '09:00', hasta: '17:00', devolucion: null,
  motivo: 'Cita médica', solicitante: { partyId: 1, nombre: 'Ana Pérez' }, reemplazo: { partyId: 2, nombre: 'Luis Gómez' }, area: 'Salado',
  motivoResolucion: null, creadaEn: '2026-11-13T17:00:00Z', soyYoSolicitante: false, ...extra,
});

const abrirYLlenarPaso1 = async () => {
  render(<ReemplazosTurno />);
  fireEvent.click(await screen.findByRole('button', { name: 'Pedir reemplazo o cambio de turno' }));
  const dlg = await screen.findByRole('dialog', { name: 'Pedir reemplazo o cambio de turno' });
  fireEvent.change(within(dlg).getByLabelText('Día de mi turno'), { target: { value: FECHA } });
  await waitFor(() => expect(within(dlg).getByLabelText('Desde')).toHaveValue('09:00'));
  return dlg;
};
const siguiente = () => fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

beforeEach(() => {
  Object.values(api).forEach((m) => m.mockReset());
  api.misTurnos.mockResolvedValue([]);
  api.candidatosTurno.mockResolvedValue({
    candidatos: [{ partyId: 2, nombre: 'Luis Gómez', motivos: ['Misma área: Salado'] }, { partyId: 3, nombre: 'María Soto', motivos: ['Misma área: Salado'] }],
    descartados: [], aviso: null,
  });
  api.crearTurno.mockResolvedValue({ ok: true, id: 1 });
  miCalendario.mockReset().mockResolvedValue({ dias: [{ fecha: FECHA, estado: 'PROGRAMADO', programado: { entrada: '09:00', salida: '17:00' } }] });
});

describe('Pedir reemplazo o cambio de turno (asistente de 3 pasos)', () => {
  it('paso 1: propone mi turno del día y valida lo que falta con mensajes simples', async () => {
    render(<ReemplazosTurno />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pedir reemplazo o cambio de turno' }));
    siguiente();
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige el día de tu turno');
    const dlg = screen.getByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('Día de mi turno'), { target: { value: FECHA } });
    expect(await within(dlg).findByText('Tu turno ese día: 09:00 a 17:00.')).toBeInTheDocument();
    expect(within(dlg).getByLabelText('Desde')).toHaveValue('09:00');
    expect(within(dlg).getByLabelText('Hasta')).toHaveValue('17:00');
    fireEvent.change(within(dlg).getByLabelText('Motivo'), { target: { value: 'no' } });
    siguiente();
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe el motivo (mínimo 5 letras)');
  });

  it('paso 2: ofrece solo candidatos elegibles con su razón y exige elegir a uno', async () => {
    const dlg = await abrirYLlenarPaso1();
    fireEvent.change(within(dlg).getByLabelText('Motivo'), { target: { value: 'Cita médica' } });
    siguiente();
    expect(await screen.findByText('Personas disponibles')).toBeInTheDocument();
    expect(api.candidatosTurno).toHaveBeenCalledWith(FECHA, '09:00', '17:00');
    expect(screen.getAllByText('Misma área: Salado')).toHaveLength(2);
    siguiente();
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige a la persona');
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'maría' } });
    expect(screen.queryByText('Luis Gómez')).not.toBeInTheDocument();
    expect(screen.getByText('María Soto')).toBeInTheDocument();
  });

  it('sin candidatos explica por qué nadie está disponible', async () => {
    api.candidatosTurno.mockResolvedValue({ candidatos: [], descartados: [{ motivo: 'Ya tiene turno ese día', cantidad: 2 }, { motivo: 'No comparte tu área de cocina', cantidad: 1 }], aviso: null });
    const dlg = await abrirYLlenarPaso1();
    fireEvent.change(within(dlg).getByLabelText('Motivo'), { target: { value: 'Cita médica' } });
    siguiente();
    const vacio = await screen.findByTestId('sin-candidatos');
    expect(vacio).toHaveTextContent('Nadie está disponible para ese horario');
    expect(vacio).toHaveTextContent('Ya tiene turno ese día: 2 personas');
    expect(vacio).toHaveTextContent('No comparte tu área de cocina: 1 persona');
  });

  it('reemplazo completo: resumen, confirmación Sí/No y envío', async () => {
    const dlg = await abrirYLlenarPaso1();
    fireEvent.change(within(dlg).getByLabelText('Motivo'), { target: { value: 'Cita médica' } });
    siguiente();
    fireEvent.click(await screen.findByRole('radio', { name: /Luis Gómez/ }));
    siguiente();
    expect(screen.getByLabelText('Resumen del pedido')).toHaveTextContent('Luis Gómez');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(api.crearTurno).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar' }));
    await waitFor(() => expect(api.crearTurno).toHaveBeenCalledWith({ tipo: 'REEMPLAZO', reemplazoPartyId: 2, fecha: FECHA, desde: '09:00', hasta: '17:00', motivo: 'Cita médica' }));
    expect(await screen.findByText(/Pedido enviado/)).toBeInTheDocument();
  });

  it('cambio de turno: pide elegir el turno que yo haré a cambio y lo envía', async () => {
    api.turnosParaDevolver.mockResolvedValue([{ fecha: sumar(FECHA, 1), etiqueta: 'martes 17', desde: '10:00', hasta: '18:00' }]);
    const dlg = await abrirYLlenarPaso1();
    fireEvent.click(within(dlg).getByRole('radio', { name: /Cambiar de turno/ }));
    fireEvent.change(within(dlg).getByLabelText('Motivo'), { target: { value: 'Cita médica' } });
    siguiente();
    fireEvent.click(await screen.findByRole('radio', { name: /Luis Gómez/ }));
    siguiente();
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige el turno que tú harás a cambio');
    fireEvent.click(await screen.findByRole('radio', { name: /martes 17/ }));
    siguiente();
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar pedido' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar' }));
    await waitFor(() => expect(api.crearTurno).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'CAMBIO_TURNO', fechaDevolucion: sumar(FECHA, 1), desdeDevolucion: '10:00', hastaDevolucion: '18:00',
    })));
  });

  it('si el servidor rechaza el envío muestra el motivo y deja reintentar', async () => {
    api.crearTurno.mockRejectedValue({ mensaje: 'La persona elegida no está disponible' });
    const dlg = await abrirYLlenarPaso1();
    fireEvent.change(within(dlg).getByLabelText('Motivo'), { target: { value: 'Cita médica' } });
    siguiente();
    fireEvent.click(await screen.findByRole('radio', { name: /Luis Gómez/ }));
    siguiente();
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar pedido' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar' }));
    expect(await screen.findByText('La persona elegida no está disponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('Mis pedidos y los que me piden', () => {
  it('«Te piden cubrir…»: muestra fecha, horas, quién pide y el área; aceptar pide Sí/No', async () => {
    api.misTurnos.mockResolvedValue([pedido()]);
    api.aceptarTurno.mockResolvedValue({ ok: true });
    render(<ReemplazosTurno />);
    const bloque = await screen.findByRole('region', { name: 'Te piden cubrir' });
    expect(bloque).toHaveTextContent('Ana Pérez te pide cubrir su turno');
    expect(bloque).toHaveTextContent('lunes 16 · 09:00 a 17:00');
    expect(bloque).toHaveTextContent('Área: Salado');
    fireEvent.click(within(bloque).getByRole('button', { name: 'Aceptar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(api.aceptarTurno).not.toHaveBeenCalled();
    fireEvent.click(within(bloque).getByRole('button', { name: 'Aceptar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, acepto' }));
    await waitFor(() => expect(api.aceptarTurno).toHaveBeenCalledWith(7));
  });

  it('rechazar el pedido que me hacen', async () => {
    api.misTurnos.mockResolvedValue([pedido()]);
    api.rechazarTurno.mockResolvedValue({ ok: true });
    render(<ReemplazosTurno />);
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, rechazar' }));
    await waitFor(() => expect(api.rechazarTurno).toHaveBeenCalledWith(7));
  });

  it('mis pedidos con estado en texto; cancelar solo mientras no está aprobado', async () => {
    api.misTurnos.mockResolvedValue([
      pedido({ id: 1, soyYoSolicitante: true, estado: 'PENDIENTE_APRUEBA' }),
      pedido({ id: 2, soyYoSolicitante: true, estado: 'APROBADA' }),
      pedido({ id: 3, soyYoSolicitante: true, estado: 'SIN_MARCA' }),
    ]);
    api.cancelarTurno.mockResolvedValue({ ok: true });
    render(<ReemplazosTurno />);
    const mios = await screen.findByRole('region', { name: 'Mis pedidos de turno' });
    expect(within(mios).getByText('Espera aprobación')).toBeInTheDocument();
    expect(within(mios).getByText('Aprobado')).toBeInTheDocument();
    expect(within(mios).getByText('No marcó')).toBeInTheDocument();
    expect(within(mios).getAllByRole('button', { name: 'Cancelar pedido' })).toHaveLength(1);
    fireEvent.click(within(mios).getByRole('button', { name: 'Cancelar pedido' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cancelar' }));
    await waitFor(() => expect(api.cancelarTurno).toHaveBeenCalledWith(1));
  });

  it('si el servidor responde 409 al aceptar, lo dice y deja reintentar', async () => {
    api.misTurnos.mockResolvedValue([pedido()]);
    api.aceptarTurno.mockRejectedValue({ mensaje: 'El turno ya empezó: el pedido venció.' });
    render(<ReemplazosTurno />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, acepto' }));
    expect(await screen.findByText('El turno ya empezó: el pedido venció.')).toBeInTheDocument();
  });
});

describe('Supervisión: reemplazos y cambios por aprobar', () => {
  const datos = { toleranciaMin: 5, solicitudes: [pedido({ estado: 'PENDIENTE_APRUEBA', validacion: { ok: true, problema: null, areaYRol: ['Misma área: Salado'] } })] };

  beforeEach(() => { api.turnosPorAprobar.mockResolvedValue(datos); });

  it('muestra el resumen de validación: área, horario libre y tolerancia', async () => {
    render(<PorAprobarTurnos />);
    const chips = await screen.findByRole('list', { name: 'Validación' });
    expect(chips).toHaveTextContent('Misma área: Salado');
    expect(chips).toHaveTextContent('Horario libre');
    expect(chips).toHaveTextContent('Tolerancia para marcar: 5 min');
  });

  it('aprobar pide Sí/No y llama al servidor', async () => {
    api.aprobarTurno.mockResolvedValue({ ok: true });
    render(<PorAprobarTurnos />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(api.aprobarTurno).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, aprobar' }));
    await waitFor(() => expect(api.aprobarTurno).toHaveBeenCalledWith(7));
  });

  it('rechazar exige un motivo de al menos 5 letras', async () => {
    api.rechazarTurnoAdmin.mockResolvedValue({ ok: true });
    render(<PorAprobarTurnos />);
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    const si = await screen.findByRole('button', { name: 'Sí, rechazar' });
    expect(si).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo (mínimo 5 letras)'), { target: { value: 'Falta gente' } });
    expect(si).toBeEnabled();
    fireEvent.click(si);
    await waitFor(() => expect(api.rechazarTurnoAdmin).toHaveBeenCalledWith(7, 'Falta gente'));
  });

  it('si ya no se cumplen las condiciones, no deja aprobar y dice por qué; un 409 se muestra', async () => {
    api.turnosPorAprobar.mockResolvedValue({ toleranciaMin: 5, solicitudes: [pedido({ estado: 'PENDIENTE_APRUEBA', validacion: { ok: false, problema: 'Ya tiene turno ese día', areaYRol: [] } })] });
    render(<PorAprobarTurnos />);
    expect(await screen.findByText('Ya tiene turno ese día')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDisabled();
  });

  it('un 409 al aprobar se muestra en la confirmación', async () => {
    api.aprobarTurno.mockRejectedValue({ mensaje: 'Las condiciones cambiaron mientras aprobabas.' });
    render(<PorAprobarTurnos />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, aprobar' }));
    expect(await screen.findByText('Las condiciones cambiaron mientras aprobabas.')).toBeInTheDocument();
  });

  it('sin pedidos muestra el estado vacío', async () => {
    api.turnosPorAprobar.mockResolvedValue({ toleranciaMin: 5, solicitudes: [] });
    render(<PorAprobarTurnos />);
    expect(await screen.findByText('No hay pedidos esperando aprobación.')).toBeInTheDocument();
  });
});
