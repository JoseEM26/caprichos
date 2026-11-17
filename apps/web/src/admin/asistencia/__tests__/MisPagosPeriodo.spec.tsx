import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const miPlanilla = vi.fn();
const miCalendario = vi.fn();
vi.mock('../miCalendarioApi', () => ({
  miPlanilla: (...a: any[]) => miPlanilla(...a),
  miCalendario: (...a: any[]) => miCalendario(...a),
}));

import { MisPagos, tituloPeriodo } from '../MisPagos';
import { MiCalendario } from '../MiCalendario';
import { jornadaActual } from '../jornada';

// Hoy (jornada) fijo en la respuesta: lunes 16 de noviembre de 2026, semana del 16 al 22.
const HOY = '2026-11-16';
const semana = (extra: Record<string, unknown> = {}) => ({
  hoy: HOY,
  conSueldo: true,
  periodo: { desde: '2026-11-16', hasta: '2026-11-22', tipo: 'SEMANAL' },
  enCurso: true,
  horas: { trabajadasMin: 0 },
  ganado: { bruto: 0, extras: 0, bonos: 0 },
  neto: -1.64,
  resumen: { seSuma: 0, seDescuenta: 1.64 },
  descuentos: [{ id: 'servicio-5', etiqueta: 'NETFLIX', concepto: 'Netflix', monto: 1.64, periodicidad: 'SEMANAL' }],
  estadoPago: 'PENDIENTE',
  ...extra,
});

describe('tituloPeriodo', () => {
  it('fechas legibles en español, también cuando cruzan de mes', () => {
    expect(tituloPeriodo('2026-11-09', '2026-11-15', 'SEMANA')).toBe('9 al 15 nov 2026');
    expect(tituloPeriodo('2026-10-26', '2026-11-01', 'SEMANA')).toBe('26 oct al 1 nov 2026');
    expect(tituloPeriodo('2026-11-01', '2026-11-30', 'MES')).toBe('Noviembre 2026');
  });
});

describe('Mis pagos: selector de período y estado', () => {
  beforeEach(() => { miPlanilla.mockReset(); miCalendario.mockReset(); });

  it('«Semana anterior» pide el período que contiene la semana pasada y muestra su título', async () => {
    miPlanilla.mockResolvedValueOnce(semana());
    miPlanilla.mockResolvedValueOnce(semana({ periodo: { desde: '2026-11-09', hasta: '2026-11-15', tipo: 'SEMANAL' }, enCurso: false, neto: 80, resumen: { seSuma: 80, seDescuenta: 0 }, horas: { trabajadasMin: 2400 }, estadoPago: 'PAGADO', pagadoEn: '2026-11-16T10:00:00Z' }));
    render(<MisPagos />);
    await screen.findByText(/Mis pagos · 16 al 22 nov 2026/);
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(await screen.findByText(/Mis pagos · 9 al 15 nov 2026/)).toBeInTheDocument();
    expect(miPlanilla).toHaveBeenLastCalledWith('2026-11-09');
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('«Elegir fecha» carga el período que contiene esa fecha; la fecha futura no se puede elegir', async () => {
    miPlanilla.mockResolvedValue(semana());
    render(<MisPagos />);
    const fecha = await screen.findByLabelText('Elegir fecha');
    expect(fecha).toHaveAttribute('max', HOY);
    fireEvent.change(fecha, { target: { value: '2026-11-03' } });
    await waitFor(() => expect(miPlanilla).toHaveBeenLastCalledWith('2026-11-03'));
  });

  it('la flecha siguiente está deshabilitada en el período actual', async () => {
    miPlanilla.mockResolvedValue(semana());
    render(<MisPagos />);
    expect(await screen.findByRole('button', { name: 'Ir a la semana siguiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ir a la semana anterior' })).toBeEnabled();
  });

  it('mensual: las etiquetas dicen «Este mes» y «Mes anterior»', async () => {
    miPlanilla.mockResolvedValue(semana({ periodo: { desde: '2026-11-01', hasta: '2026-11-30', tipo: 'MENSUAL' }, hoy: HOY }));
    render(<MisPagos />);
    expect(await screen.findByRole('button', { name: 'Este mes (en curso)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    await waitFor(() => expect(miPlanilla).toHaveBeenLastCalledWith('2026-10-01'));
  });

  it('período en curso: insignia «En curso» aviso de que aún no termina', async () => {
    miPlanilla.mockResolvedValue(semana({ neto: 120, resumen: { seSuma: 120, seDescuenta: 0 }, horas: { trabajadasMin: 900 }, descuentos: [] }));
    render(<MisPagos />);
    expect(await screen.findByText('En curso — aún no termina, el monto puede cambiar')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Este período termina el 22 de noviembre de 2026. Lo que ves es un avance, no el reporte final.');
  });

  it('período cerrado sin pagar: «Cerrado — por pagar»', async () => {
    miPlanilla.mockResolvedValue(semana({ periodo: { desde: '2026-11-09', hasta: '2026-11-15', tipo: 'SEMANAL' }, enCurso: false, neto: 50, resumen: { seSuma: 50, seDescuenta: 0 }, horas: { trabajadasMin: 600 }, descuentos: [] }));
    render(<MisPagos />);
    expect(await screen.findByText('Cerrado — por pagar')).toBeInTheDocument();
  });
});

describe('Mis pagos: neto negativo y cálculo', () => {
  beforeEach(() => { miPlanilla.mockReset(); });

  it('explica la razón en vez de mostrar el negativo a secas', async () => {
    miPlanilla.mockResolvedValue(semana());
    render(<MisPagos />);
    const bloque = await screen.findByTestId('mis-pagos');
    expect(bloque).not.toHaveTextContent('S/ -1.64');
    expect(screen.getByText(/Aún no tienes horas registradas/)).toHaveTextContent('Aún no tienes horas registradas este período, y ya hay S/ 1.64 por descontar (Netflix semanal). Se descontará de lo que ganes.');
    expect(bloque).toHaveTextContent('Por descontar: S/ 1.64');
  });

  it('la línea «Cómo se calcula» muestra suma, descuento y resultado', async () => {
    miPlanilla.mockResolvedValue(semana());
    render(<MisPagos />);
    await screen.findByTestId('mis-pagos');
    expect(screen.getByText('Cómo se calcula')).toBeInTheDocument();
    expect(screen.getByText(/Se te suma S\/ 0\.00 − Se te descuenta S\/ 1\.64 = −S\/ 1\.64/)).toBeInTheDocument();
  });

  it('el descuento recurrente sale una sola vez, con nombre legible y periodicidad', async () => {
    miPlanilla.mockResolvedValue(semana());
    render(<MisPagos />);
    const bloque = await screen.findByTestId('mis-pagos');
    expect(bloque.textContent?.match(/Netflix/g)).toHaveLength(2); // la explicación y la fila, nada más
    expect(bloque).toHaveTextContent('Netflix (semanal)');
    expect(bloque).not.toHaveTextContent('NETFLIX:');
  });
});

describe('Mis pagos: sin sueldo, sin vínculo y error', () => {
  beforeEach(() => { miPlanilla.mockReset(); });

  it('sin sueldo configurado: estado útil, sin error', async () => {
    miPlanilla.mockResolvedValue({ conSueldo: false, hoy: HOY });
    render(<MisPagos />);
    expect(await screen.findByText('Aún no tienes sueldo configurado; consulta con el administrador.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sin vínculo con una ficha: mensaje propio', async () => {
    miPlanilla.mockResolvedValue({ conSueldo: false, sinVinculo: true, hoy: HOY });
    render(<MisPagos />);
    expect(await screen.findByText(/no está vinculada a una ficha de personal/)).toBeInTheDocument();
  });

  it('al reintentar conserva el período elegido', async () => {
    miPlanilla.mockResolvedValueOnce(semana());
    miPlanilla.mockRejectedValueOnce(new Error('red'));
    miPlanilla.mockResolvedValueOnce(semana({ periodo: { desde: '2026-11-09', hasta: '2026-11-15', tipo: 'SEMANAL' }, enCurso: false, descuentos: [] }));
    render(<MisPagos />);
    await screen.findByText(/Mis pagos · 16 al 22/);
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus pagos');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(/Mis pagos · 9 al 15 nov 2026/)).toBeInTheDocument();
    expect(miPlanilla).toHaveBeenLastCalledWith('2026-11-09');
  });
});

describe('Mi calendario: lo que se paga ese día', () => {
  beforeEach(() => { miPlanilla.mockReset(); miCalendario.mockReset(); });

  it('al tocar un día muestra lo ganado y el descuento por tardanza', async () => {
    const hoy = jornadaActual();
    const [a, m] = hoy.split('-');
    const primero = `${a}-${m}-01`;
    const mes = `${a}-${m}`;
    miCalendario.mockResolvedValue({
      desde: `${mes}-01`, hasta: `${mes}-28`,
      dias: [{ fecha: primero, estado: 'TARDANZA', entrada: '13:50', salida: '22:30', tardanzaMin: 20, trabajadaMin: 520, marcas: [] }],
    });
    miPlanilla.mockResolvedValue({ dias: [{ fecha: primero, estado: 'TARDANZA', trabajadaMin: 520, tardanzaMin: 20, extraMin: 0, extraAprobada: false, ganado: 120, feriado: null, vacacion: false, penalidadTardanza: 4 }] });
    render(<MiCalendario />);
    const boton = await screen.findByRole('button', { name: new RegExp("^[^ ]+ 1 de ") });
    fireEvent.click(boton);
    const pago = await screen.findByTestId('pago-dia');
    expect(pago).toHaveTextContent('Lo que ganas este día');
    expect(pago).toHaveTextContent('S/ 120.00');
    expect(pago).toHaveTextContent('Descuento por tardanza');
    expect(pago).toHaveTextContent('- S/ 4.00');
  });
});
