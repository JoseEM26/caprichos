import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const miInc = vi.fn();
const misSol = vi.fn();
const crear = vi.fn();
const cancelar = vi.fn();
const bandeja = vi.fn();
const lote = vi.fn();
const crono = vi.fn();
const simples = vi.fn();
vi.mock('../correccionesApi', async (orig) => ({
  ...(await orig<any>()),
  miInconsistencias: (...a: any[]) => miInc(...a),
  misSolicitudes: (...a: any[]) => misSol(...a),
  crearSolicitud: (...a: any[]) => crear(...a),
  cancelarSolicitud: (...a: any[]) => cancelar(...a),
  bandejaCorrecciones: (...a: any[]) => bandeja(...a),
  loteCorrecciones: (...a: any[]) => lote(...a),
  cronograma: (...a: any[]) => crono(...a),
  aprobarSimplesPeriodo: (...a: any[]) => simples(...a),
}));
const listar = vi.fn();
const detalle = vi.fn();
vi.mock('../planillaApi', async (orig) => ({
  ...(await orig<any>()),
  listarPlanilla: (...a: any[]) => listar(...a),
  detallePlanilla: (...a: any[]) => detalle(...a),
}));

import { CorreccionesAsistencia } from '../CorreccionesAsistencia';
import { CronogramaTab } from '../CronogramaTab';
import { PlanillaTab } from '../PlanillaTab';
import { SolicitudesTab } from '../SolicitudesTab';

beforeEach(() => {
  [miInc, misSol, crear, cancelar, bandeja, lote, crono, simples, listar, detalle].forEach((f) => f.mockReset());
});

describe('Mi asistencia: inconsistencias y solicitud de corrección', () => {
  it('muestra el bloque destacado y abre el formulario prellenado con la fecha y la marca que falta', async () => {
    miInc.mockResolvedValue([
      { jornada: '2026-11-06', etiqueta: 'viernes 6', tipo: 'SIN_SALIDA', texto: 'No marcaste tu salida (viernes 6)', falta: 'SALIDA', estado: 'SIN_CORREGIR', rechazo: 'La cámara te ve salir a las 17:00', solicitudId: null },
      { jornada: '2026-11-05', etiqueta: 'jueves 5', tipo: 'SIN_ENTRADA', texto: 'No marcaste tu entrada (jueves 5)', falta: 'ENTRADA', estado: 'ENVIADA', rechazo: null, solicitudId: 4 },
    ]);
    misSol.mockResolvedValue([]);
    crear.mockResolvedValue({ ok: true, id: 9 });
    const abrir = vi.fn();
    const { rerender } = render(<CorreccionesAsistencia pedido={null} alAbrir={abrir} alCerrar={() => undefined} />);
    const bloque = await screen.findByTestId('bloque-inconsistencias');
    expect(bloque).toHaveTextContent('Inconsistencia detectada');
    expect(bloque).toHaveTextContent('No marcaste tu salida (viernes 6)');
    expect(bloque).toHaveTextContent('Rechazada: La cámara te ve salir a las 17:00'); // reaparece con el motivo
    expect(bloque).toHaveTextContent('Corrección enviada, pendiente de aprobación'); // la enviada no desaparece
    fireEvent.click(screen.getByRole('button', { name: 'Corregir viernes 6' }));
    expect(abrir).toHaveBeenCalledWith({ jornada: '2026-11-06', tipo: 'SALIDA' });

    rerender(<CorreccionesAsistencia pedido={{ jornada: '2026-11-06', tipo: 'SALIDA' }} alAbrir={abrir} alCerrar={() => undefined} />);
    const form = await screen.findByRole('form', { name: 'Pedir corrección de asistencia' });
    expect(within(form).getByLabelText('Marca')).toHaveValue('SALIDA');
    const enviar = within(form).getByRole('button', { name: 'Enviar solicitud' });
    expect(enviar).toBeDisabled(); // falta hora y motivo
    fireEvent.change(within(form).getByLabelText('Hora real'), { target: { value: '18:05' } });
    fireEvent.change(within(form).getByLabelText(/Motivo/), { target: { value: 'ab' } });
    expect(enviar).toBeDisabled(); // motivo de menos de 5 caracteres
    fireEvent.change(within(form).getByLabelText(/Motivo/), { target: { value: 'Me olvidé de marcar' } });
    fireEvent.click(enviar);
    await waitFor(() => expect(crear).toHaveBeenCalledWith({ jornada: '2026-11-06', items: [{ tipo: 'SALIDA', hora: '18:05' }], motivo: 'Me olvidé de marcar' }));
  });

  it('lista mis solicitudes con su estado, el motivo del rechazo y permite cancelar las pendientes', async () => {
    miInc.mockResolvedValue([]);
    misSol.mockResolvedValue([
      { id: 1, partyId: 7, jornada: '2026-11-06', etiqueta: 'viernes 6', items: [{ tipo: 'SALIDA', hora: '18:00', momento: 'x' }], motivo: 'Me olvidé', estado: 'PENDIENTE', creadaEn: 'x', resueltaEn: null, motivoResolucion: null },
      { id: 2, partyId: 7, jornada: '2026-11-05', etiqueta: 'jueves 5', items: [{ tipo: 'ENTRADA', hora: '09:00', momento: 'x' }], motivo: 'Marqué mal', estado: 'RECHAZADA', creadaEn: 'x', resueltaEn: 'x', motivoResolucion: 'No coincide con la cámara' },
    ]);
    cancelar.mockResolvedValue({ ok: true });
    render(<CorreccionesAsistencia pedido={null} alAbrir={() => undefined} alCerrar={() => undefined} />);
    const lista = await screen.findByRole('region', { name: 'Mis solicitudes de corrección' });
    expect(lista).toHaveTextContent('Pendiente de aprobación');
    expect(lista).toHaveTextContent('Motivo del rechazo: No coincide con la cámara');
    expect(screen.queryByTestId('bloque-inconsistencias')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));
    await waitFor(() => expect(cancelar).toHaveBeenCalledWith(1));
  });
});

describe('Bandeja de solicitudes: selección múltiple y lote', () => {
  const dato = {
    solicitudes: [{ id: 5, partyId: 7, jornada: '2026-11-06', etiqueta: 'viernes 6', items: [{ tipo: 'SALIDA', hora: '18:00', momento: 'x' }], motivo: 'Me olvidé', estado: 'PENDIENTE', creadaEn: 'x', resueltaEn: null, motivoResolucion: null, nombre: 'Luis Pérez', roles: ['MOZO'] }],
    marcas: [
      { id: 1, partyId: 7, nombre: 'Luis Pérez', roles: ['MOZO'], jornada: '2026-11-06', hora: '09:00', rol: 'ENTRADA', origen: 'WEB', estado: 'A_REVISAR', alertas: 'web', tieneSelfie: false, clase: 'WEB', cantidadesRaras: false },
      { id: 2, partyId: 8, nombre: 'Ana Ruiz', roles: ['COCINA'], jornada: '2026-11-05', hora: '09:01', rol: 'ENTRADA', origen: 'CELULAR', estado: 'VALIDA', alertas: null, tieneSelfie: true, clase: 'DOBLE', cantidadesRaras: false },
    ],
    sinSolicitud: [{ partyId: 8, nombre: 'Ana Ruiz', roles: ['COCINA'], jornada: '2026-11-04', tipo: 'SIN_SALIDA', texto: 'No marcaste tu salida (miércoles 4)' }],
  };

  it('«seleccionar todo lo visible», filtros por tipo y rol, confirmación con resumen y resultado por ítem', async () => {
    bandeja.mockResolvedValue(dato);
    lote.mockResolvedValue({ total: 3, ok: 2, fallidas: 1, resultados: [
      { tipo: 'SOLICITUD', id: 5, ok: true }, { tipo: 'MARCA', id: 1, ok: true }, { tipo: 'MARCA', id: 2, ok: false, codigo: 'PERIODO_PAGADO', mensaje: 'Período ya pagado: reábrelo para cambiarlo' },
    ] });
    render(<SolicitudesTab onError={() => undefined} onOk={() => undefined} />);
    await screen.findByText('Ana Ruiz', { selector: 'td' });
    expect(screen.getByText('Jornadas con inconsistencia sin solicitud')).toBeInTheDocument(); // recordatorio sin solicitud

    // filtro por rol
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'COCINA' } });
    expect(screen.queryByText('Luis Pérez', { selector: 'td' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: '' } });

    fireEvent.click(screen.getByLabelText('Seleccionar todo lo visible'));
    expect(screen.getByRole('region', { name: 'Acciones en lote' })).toHaveTextContent('3 seleccionadas');
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar seleccionadas' }));
    // confirmación Sí/No con resumen
    expect(await screen.findByText(/3 ítems de Luis Pérez, Ana Ruiz/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, aprobar' }));
    await waitFor(() => expect(lote).toHaveBeenCalledWith({ accion: 'APROBAR', items: expect.arrayContaining([{ tipo: 'SOLICITUD', id: 5 }, { tipo: 'MARCA', id: 1 }, { tipo: 'MARCA', id: 2 }]) }));
    const res = await screen.findByLabelText('Resultado por ítem');
    expect(res).toHaveTextContent('Marca #2: Período ya pagado');
  });

  it('rechazar exige un solo motivo para todas', async () => {
    bandeja.mockResolvedValue(dato);
    lote.mockResolvedValue({ total: 1, ok: 1, fallidas: 0, resultados: [{ tipo: 'MARCA', id: 1, ok: true }] });
    render(<SolicitudesTab onError={() => undefined} onOk={() => undefined} />);
    await screen.findByText('Ana Ruiz', { selector: 'td' });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'WEB' } });
    fireEvent.click(screen.getByLabelText('Seleccionar todo lo visible'));
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar/anular seleccionadas' }));
    const confirmar = await screen.findByRole('button', { name: 'Sí, rechazar' });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Un solo motivo/), { target: { value: 'Las cámaras no lo muestran' } });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);
    await waitFor(() => expect(lote).toHaveBeenCalledWith({ accion: 'RECHAZAR', motivo: 'Las cámaras no lo muestran', items: [{ tipo: 'MARCA', id: 1 }] }));
  });

  it('los atajos de fechas filtran (hoy no trae lo de otros días)', async () => {
    bandeja.mockResolvedValue(dato);
    render(<SolicitudesTab onError={() => undefined} onOk={() => undefined} />);
    await screen.findByText('Ana Ruiz', { selector: 'td' });
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(await screen.findByText('Nada por revisar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(await screen.findByText('Ana Ruiz', { selector: 'td' })).toBeInTheDocument();
  });
});

describe('Cronograma', () => {
  const hoy = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
  const dia = {
    jornada: hoy, estado: 'A_REVISAR', turno: { entrada: 540, salida: 1080, almuerzoIni: 780, almuerzoFin: 840 }, alertas: ['Marcó 3 veces: falta el regreso del break'],
    trabajadaMin: 0, tardanzaMin: 0, breakMin: 0, cantidadesRaras: true, inconsistencia: null,
    tramos: [{ desde: 540, hasta: 780, tipo: 'TRABAJO' }],
    marcas: [
      { id: 1, minutos: 540, hora: '09:00', momento: '2026-11-06T14:00:00.000Z', origen: 'CELULAR', estado: 'VALIDA', rol: 'ENTRADA', duplicada: false, tieneSelfie: true, motivo: null, alertas: null },
      { id: 2, minutos: 542, hora: '09:02', momento: '2026-11-06T14:02:00.000Z', origen: 'CELULAR', estado: 'VALIDA', rol: 'ENTRADA', duplicada: true, tieneSelfie: false, motivo: null, alertas: null },
      { id: 3, minutos: 780, hora: '13:00', momento: '2026-11-06T18:00:00.000Z', origen: 'WEB', estado: 'A_REVISAR', rol: 'SALIDA_ALMUERZO', duplicada: false, tieneSelfie: false, motivo: null, alertas: 'web' },
    ],
    solicitudes: [{ id: 8, motivo: 'Me olvidé', creadaEn: 'x', items: [{ tipo: 'ENTRADA_ALMUERZO', hora: '13:40', momento: 'x' }] }],
  };
  const datos = { desde: hoy, hasta: hoy, dias: [hoy], resumen: {}, personas: [
    { partyId: 7, nombre: 'Luis Pérez', roles: ['MOZO'], dias: [dia] },
    { partyId: 8, nombre: 'Ana Ruiz', roles: ['COCINA'], dias: [{ ...dia, estado: 'CUMPLIO', alertas: [], marcas: [], solicitudes: [] }] },
  ] };

  it('dibuja el horario, los tramos, cada marca con su hora y la solicitud propuesta; el detalle sale al tocar una marca', async () => {
    crono.mockResolvedValue(datos);
    render(<CronogramaTab onError={() => undefined} onOk={() => undefined} />);
    const linea = await screen.findByRole('group', { name: 'Línea de tiempo de Luis Pérez' });
    expect(within(linea).getByTitle('Horario 09:00–18:00')).toBeInTheDocument();
    expect(within(linea).getByRole('button', { name: /09:02 Entrada \(doble marca, tachada\)/ })).toBeInTheDocument();
    expect(within(linea).getByRole('button', { name: /13:00 Salida a break, Usuario y contraseña, por revisar/ })).toBeInTheDocument();
    expect(within(linea).getByRole('img', { name: 'Solicitud pendiente: 13:40 Regreso del break' })).toBeInTheDocument();
    expect(screen.getByText(/Marcó 3 veces: falta el regreso del break/)).toBeInTheDocument();

    fireEvent.click(within(linea).getByRole('button', { name: /13:00 Salida a break/ }));
    const detalle = await screen.findByRole('region', { name: 'Detalle de la marca de las 13:00' });
    expect(detalle).toHaveTextContent('Interpretada comoSalida a break');
    const aprobar = within(detalle).getByRole('button', { name: 'Aprobar' });
    expect(aprobar).toBeDisabled(); // falta el motivo
    fireEvent.change(within(detalle).getByLabelText(/Motivo/), { target: { value: 'Verificado con la cámara' } });
    expect(aprobar).toBeEnabled();
  });

  it('filtra por rol y la vista de mes marca los días con indicadores en texto', async () => {
    crono.mockResolvedValue(datos);
    render(<CronogramaTab onError={() => undefined} onOk={() => undefined} />);
    await screen.findByRole('group', { name: 'Línea de tiempo de Luis Pérez' });
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'COCINA' } });
    expect(screen.queryByRole('group', { name: 'Línea de tiempo de Luis Pérez' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Línea de tiempo de Ana Ruiz' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    const celda = await screen.findByRole('gridcell', { name: new RegExp(`: 1 cumplieron, 0 con tardanza, 1 por revisar, 0 faltas, 1 solicitudes`) });
    expect(celda).toHaveTextContent('⚠ 1');
    expect(celda).toHaveTextContent('✉ 1');
  });
});

describe('Planilla: banner de jornadas por revisar y aprobar dudosas', () => {
  const resultado = {
    programadaMin: 3000, trabajadaMin: 1800, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 0, extraAprobadaMin: 0, valorHora: 20,
    pagoTrabajado: 600, pagoTardanza: 0, pagoExtra: 0, ganado: 600, consumosCobrados: 0, consumosPendientes: 0, descuentos: 0, adelantos: 0, neto: 600,
  };
  it('muestra «N jornadas por revisar» con enlace al día, el calendario con marcas interpretadas y aprueba las simples con confirmación', async () => {
    listar.mockResolvedValue({ fecha: '2026-11-09', filas: [{ partyId: 7, nombre: 'Luis Pérez', sueldo: { modalidad: 'MENSUAL', semanal: 230.77, mensual: 1000 }, periodo: { desde: '2026-11-01', hasta: '2026-11-30' }, estado: 'ABIERTO', pendientes: 2 }] });
    detalle.mockResolvedValue({
      partyId: 7, nombre: 'Luis Pérez', periodo: { desde: '2026-11-01', hasta: '2026-11-30' }, sueldo: { modalidad: 'MENSUAL', semanal: 230.77, mensual: 1000 },
      estado: 'ABIERTO', periodoId: null, toleranciaMin: 5, pctTardanza: 50, pendientes: 2, jornadasPorRevisar: ['2026-11-05', '2026-11-06'], resultado,
      dias: [
        { jornada: '2026-11-05', estado: 'A_REVISAR', programadaMin: 540, trabajadaMin: 0, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 0, extraAprobada: false, extraAprobadaEn: null, ganado: 0,
          horario: { entrada: '09:00', salida: '18:00', almuerzo: '13:00-14:00' }, breakMin: 0, alertas: ['Marcó 3 veces: falta el regreso del break'],
          marcas: [{ id: 1, hora: '09:00', rol: 'ENTRADA', duplicada: false, estado: 'VALIDA' }, { id: 2, hora: '09:01', rol: 'ENTRADA', duplicada: true, estado: 'VALIDA' }] },
        { jornada: '2026-11-06', estado: 'CUMPLIO', programadaMin: 540, trabajadaMin: 480, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 60, extraAprobada: false, extraAprobadaEn: null, ganado: 160, feriado: 'Día X', recargo: 2, extraPendiente: true,
          horario: { entrada: '09:00', salida: '18:00', almuerzo: null }, breakMin: 60, alertas: [], marcas: [] },
      ],
      consumos: [], ajustes: [],
    });
    simples.mockResolvedValue({ total: 2, ok: 1, fallidas: 1, omitidas: 1, resultados: [{ tipo: 'MARCA', id: 5, ok: true }, { tipo: 'MARCA', id: 6, ok: false, codigo: 'PERIODO_PAGADO', mensaje: 'Período ya pagado' }] });
    render(<PlanillaTab onError={() => undefined} onOk={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));
    const banner = await screen.findByTestId('banner-por-revisar');
    expect(banner).toHaveTextContent('2 jornadas por revisar');
    expect(screen.getByRole('button', { name: 'Marcar pagado' })).toBeDisabled();

    fireEvent.click(within(banner).getByRole('button', { name: '2026-11-05' })); // enlace al día
    const fila = (await screen.findByText('2026-11-05', { selector: 'td' })).closest('tr')!;
    expect(fila).toHaveTextContent('09:00 Entrada');
    expect(within(fila).getByText(/09:01 Entrada/)).toHaveStyle({ textDecoration: 'line-through' });
    expect(fila).toHaveTextContent('Marcó 3 veces: falta el regreso del break');
    const feriado = screen.getByText('2026-11-06', { selector: 'td' }).closest('tr')!;
    expect(feriado).toHaveTextContent('Feriado ×2');
    expect(feriado).toHaveTextContent('pendiente de aprobar');

    fireEvent.click(within(banner).getByRole('button', { name: 'Aprobar todas las marcas dudosas del período' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, aprobar' }));
    await waitFor(() => expect(simples).toHaveBeenCalledWith(7, '2026-11-01', '2026-11-30'));
    expect(await screen.findByText(/Aprobadas 1 de 2/)).toBeInTheDocument();
    expect(screen.getByText(/1 marca\(s\) de jornadas con cantidades raras requieren corrección explícita/)).toBeInTheDocument();
  });
});
