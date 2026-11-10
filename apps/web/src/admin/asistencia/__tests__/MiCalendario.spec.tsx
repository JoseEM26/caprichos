import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const miCalendario = vi.fn();
const miPlanilla = vi.fn();
let planillaFalla = false; // el espía de vitest deja sin atender los rechazos que devuelve: el fallo va fuera del espía
vi.mock('../miCalendarioApi', () => ({ miCalendario: (...a: any[]) => miCalendario(...a), miPlanilla: (...a: any[]) => (planillaFalla ? Promise.reject(new Error('x')) : miPlanilla(...a)) }));

import { MiCalendario } from '../MiCalendario';
import { MisPagos } from '../MisPagos';

const hoy = new Date(Date.now() - 9 * 3600_000).toISOString().slice(0, 10); // jornada Lima
const [A, M] = hoy.split('-');
const f = (d: number) => `${A}-${M}-${String(d).padStart(2, '0')}`;

const datos = {
  desde: f(1), hasta: f(28),
  dias: [
    { fecha: f(1), estado: 'CUMPLIO', entrada: '13:28', salida: '22:31', almuerzoSalida: '17:00', almuerzoVuelta: '17:40', almuerzoMin: 40, trabajadaMin: 540, programado: { entrada: '13:30', salida: '22:30' }, marcas: [] },
    { fecha: f(2), estado: 'TARDANZA', entrada: '13:50', salida: '22:30', tardanzaMin: 20, extraMin: 60, extraEstado: 'PENDIENTE', trabajadaMin: 520,
      solicitud: { id: 1, tipo: 'CORRECCION', estado: 'RECHAZADA', motivo: 'Olvidé marcar', respuesta: 'No hay evidencia' } },
    { fecha: f(3), estado: 'FALTA' },
    { fecha: f(4), estado: 'CUMPLIO', feriado: 'Día de prueba', marcas: [{ tipo: null, hora: '13:30', estado: 'VALIDA' }, { tipo: 'SALIDA', hora: '22:30', estado: 'VALIDA' }] },
  ],
  resumen: { diasTrabajados: 2, horasTrabajadasMin: 1060, tardanzaMin: 20, extraAprobadaMin: 30, extraPendienteMin: 60, faltas: 1 },
};

describe('MiCalendario', () => {
  beforeEach(() => { miCalendario.mockReset().mockResolvedValue(datos); });

  it('pinta cada día con estado en texto (aria-label), horas y feriado, y el resumen del mes', async () => {
    render(<MiCalendario />);
    const d1 = await screen.findByRole('button', { name: /1 de .*Cumplió, entrada 13:28, salida 22:31/ });
    expect(d1).toHaveTextContent('13:28');
    expect(screen.getByRole('button', { name: /Falta/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /feriado Día de prueba/ })).toBeInTheDocument();
    expect(screen.getByTestId('resumen-mes')).toHaveTextContent('Días trabajados2');
    expect(screen.getByTestId('resumen-mes')).toHaveTextContent('Extras pendientes1 h 00 min');
    expect(miCalendario).toHaveBeenCalledWith(f(1), expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('al tocar un día muestra la línea de tiempo con almuerzo pagado y horas', async () => {
    render(<MiCalendario />);
    fireEvent.click(await screen.findByRole('button', { name: /Cumplió, entrada 13:28/ }));
    const det = await screen.findByTestId('detalle-dia');
    const linea = within(det).getByRole('list', { name: 'Línea de tiempo del día' });
    expect(linea).toHaveTextContent('13:28 Entrada');
    expect(linea).toHaveTextContent('17:00 Salió a almorzar');
    expect(linea).toHaveTextContent('17:40 Volvió (almuerzo 40 min, pagado)');
    expect(linea).toHaveTextContent('22:31 Salida');
    expect(det).toHaveTextContent('9 h 00 min');
  });

  it('detalle con tardanza, extra pendiente y solicitud rechazada con su respuesta', async () => {
    render(<MiCalendario />);
    fireEvent.click(await screen.findByRole('button', { name: /Tardanza/ }));
    const det = await screen.findByTestId('detalle-dia');
    expect(det).toHaveTextContent('20 min');
    expect(det).toHaveTextContent('Pendiente');
    expect(screen.getByTestId('solicitud-dia')).toHaveTextContent('Rechazada');
    expect(screen.getByTestId('solicitud-dia')).toHaveTextContent('Respuesta: No hay evidencia');
  });

  it('marcas viejas sin tipo salen como «Marca» y un día sin datos lo dice amistosamente', async () => {
    render(<MiCalendario />);
    fireEvent.click(await screen.findByRole('button', { name: /feriado Día de prueba/ }));
    const det = await screen.findByTestId('detalle-dia');
    expect(det).toHaveTextContent('13:30 Marca');
    expect(det).toHaveTextContent('22:30 Salida');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }));
    fireEvent.click(document.querySelector(`[data-fecha="${f(10)}"]`)!);
    expect(await screen.findByTestId('sin-marcas')).toBeInTheDocument();
  });

  it('pedir corrección desde el detalle', async () => {
    const alPedir = vi.fn();
    render(<MiCalendario alPedirCorreccion={alPedir} />);
    fireEvent.click(await screen.findByRole('button', { name: /Falta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir corrección de este día' }));
    expect(alPedir).toHaveBeenCalledWith(f(3));
  });

  it('navega de mes y con los atajos pide el rango correcto', async () => {
    render(<MiCalendario />);
    await screen.findByTestId('resumen-mes');
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    await waitFor(() => expect(miCalendario).toHaveBeenCalledTimes(2));
    const [d2, h2] = miCalendario.mock.calls[1];
    expect(d2.endsWith('-01')).toBe(true);
    expect(d2 < f(1)).toBe(true);
    expect(h2 < f(1)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Esta semana' }));
    await waitFor(() => expect(miCalendario.mock.calls.at(-1)![0]).toBe(f(1)));
    fireEvent.click(screen.getByRole('button', { name: 'Hace un mes' }));
    await waitFor(() => expect(miCalendario.mock.calls.at(-1)![0] < f(1)).toBe(true));
  });

  it('flechas del teclado mueven el foco entre días', async () => {
    render(<MiCalendario />);
    const d1 = await screen.findByRole('button', { name: /Cumplió, entrada 13:28/ });
    d1.focus();
    fireEvent.keyDown(d1, { key: 'ArrowRight' });
    expect(document.activeElement).toHaveAttribute('data-fecha', f(2));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveAttribute('data-fecha', f(9));
  });

  it('privacidad: no muestra foto ni ubicación', async () => {
    render(<MiCalendario />);
    fireEvent.click(await screen.findByRole('button', { name: /Cumplió, entrada 13:28/ }));
    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).not.toMatch(/selfie|GPS/i);
  });

  it('si falla la carga muestra un aviso sin romper', async () => {
    miCalendario.mockImplementation(() => Promise.reject(new Error('x')));
    render(<MiCalendario />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tu calendario');
  });
});

describe('MisPagos', () => {
  beforeEach(() => { planillaFalla = false; miPlanilla.mockReset(); });

  it('muestra lo que se suma, lo que se descuenta, préstamos, neto y estado', async () => {
    miPlanilla.mockResolvedValue({
      periodo: { desde: '2026-11-09', hasta: '2026-11-15', tipo: 'SEMANAL' },
      horas: { trabajadasMin: 2400, extraAprobadaMin: 60, extraPendienteMin: 30 },
      ganado: { bruto: 400, extras: 15, bonos: 20 },
      descuentos: [{ id: 1, fecha: '2026-11-10', etiqueta: 'Consumo', concepto: 'Café', monto: 6.5 }],
      adelantos: [{ id: 2, fecha: '2026-11-11', monto: 50, motivo: 'Pasaje' }],
      penalidadTardanza: { total: 4, detalle: [{ fecha: '2026-11-10', minutos: 20, monto: 4 }] },
      prestamos: [{ id: 3, capital: 300, interesPctMensual: 2, cuota: 50, saldo: 200, cuotasPagadas: 2, cuotasTotales: 6, estado: 'ACTIVO' }],
      serviciosExtra: [{ nombre: 'Netflix', monto: 10, periodicidad: 'MENSUAL', activo: true }],
      neto: 369.5, estadoPago: 'PENDIENTE',
    });
    render(<MisPagos />);
    const bloque = await screen.findByTestId('mis-pagos');
    expect(bloque).toHaveTextContent('Neto estimadoS/ 369.50');
    expect(bloque).toHaveTextContent('Por pagar');
    expect(bloque).toHaveTextContent('Bonos');
    expect(bloque).toHaveTextContent('Extras pendientes de aprobar');
    expect(bloque).toHaveTextContent('- S/ 6.50');
    expect(bloque).toHaveTextContent('Penalidad por tardanza');
    expect(bloque).toHaveTextContent('2026-11-10: 20 min');
    expect(bloque).toHaveTextContent('Adelanto: Pasaje');
    expect(bloque).toHaveTextContent('Netflix');
    expect(bloque).toHaveTextContent('interés 2 % mensual');
    expect(bloque).toHaveTextContent('pagadas 2 de 6');
    expect(bloque).toHaveTextContent('El tiempo de almuerzo se paga');
    expect(bloque).not.toHaveTextContent(/se descuenta el (break|almuerzo)/i);
  });

  it('campos que no llegan: degrada con «sin dato» y sin romper', async () => {
    miPlanilla.mockResolvedValue({});
    render(<MisPagos />);
    const bloque = await screen.findByTestId('mis-pagos');
    expect(bloque).toHaveTextContent('sin dato');
    expect(bloque).toHaveTextContent('No tienes préstamos');
  });

  it('pagado muestra la etiqueta Pagado', async () => {
    miPlanilla.mockResolvedValue({ neto: 100, estadoPago: 'PAGADO', pagadoEn: '2026-11-16T10:00:00Z' });
    render(<MisPagos />);
    expect(await screen.findByText('Pagado')).toBeInTheDocument();
  });

  it('error: aviso', async () => {
    planillaFalla = true;
    render(<MisPagos />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus pagos');
  });
});
