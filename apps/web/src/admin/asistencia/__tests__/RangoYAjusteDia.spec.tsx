import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listar = vi.fn();
const ajustar = vi.fn();
vi.mock('../planillaApi', async (orig) => ({ ...(await orig<any>()), listarPlanilla: (...a: any[]) => listar(...a) }));
vi.mock('../correccionesApi', async (orig) => ({ ...(await orig<any>()), ajustarDia: (...a: any[]) => ajustar(...a) }));

import { PlanillaTab } from '../PlanillaTab';
import { AjustarIngresoSalida } from '../DetalleDiaPersona';
import { errorRango, etiquetaRango, presetsRango, quincenaDe } from '../periodoVista';

describe('rango libre de fechas (funciones)', () => {
  it('atajos: semana, semana pasada, mes, mes pasado y quincenas', () => {
    const p = Object.fromEntries(presetsRango('2026-11-18').map((x) => [x.id, [x.desde, x.hasta]]));
    expect(p.semana).toEqual(['2026-11-16', '2026-11-22']);
    expect(p['semana-pasada']).toEqual(['2026-11-09', '2026-11-15']);
    expect(p.mes).toEqual(['2026-11-01', '2026-11-30']);
    expect(p['mes-pasado']).toEqual(['2026-10-01', '2026-10-31']);
    expect(p.quincena).toEqual(['2026-11-16', '2026-11-30']);
    expect(p['quincena-pasada']).toEqual(['2026-11-01', '2026-11-15']);
    expect(quincenaDe('2026-02-10')).toEqual({ desde: '2026-02-01', hasta: '2026-02-15' });
    expect(quincenaDe('2026-02-20')).toEqual({ desde: '2026-02-16', hasta: '2026-02-28' });
  });
  it('valida el rango y lo escribe en español', () => {
    expect(errorRango('2026-11-10', '2026-11-01')).toMatch(/anterior/);
    expect(errorRango('2026-01-01', '2026-11-01')).toMatch(/93/);
    expect(errorRango('2026-11-01', '2026-11-15')).toBeNull();
    expect(etiquetaRango('2026-11-01', '2026-11-15')).toBe('Del 1 al 15 de noviembre de 2026');
    expect(etiquetaRango('2026-10-28', '2026-11-03')).toBe('Del 28 de octubre al 3 de noviembre de 2026');
  });
});

function Url() {
  const l = useLocation();
  return <output data-testid="url">{l.search}</output>;
}
const montar = (entrada: string) => render(<MemoryRouter initialEntries={[entrada]}><PlanillaTab onError={() => undefined} onOk={() => undefined} /><Url /></MemoryRouter>);
const url = () => new URLSearchParams(screen.getByTestId('url').textContent ?? '');

describe('PlanillaTab: rango libre', () => {
  beforeEach(() => {
    listar.mockReset().mockResolvedValue({
      fecha: '2026-11-01', modo: 'RANGO', vista: { desde: '2026-11-01', hasta: '2026-11-15' },
      filas: [{ partyId: 7, nombre: 'Luis Pérez', rol: 'MOZO', sueldo: { modalidad: 'MENSUAL', semanal: 230.77, mensual: 1000 }, estado: 'ABIERTO', estimado: true, neto: 300, ganado: 320, pendientes: 0 }],
    });
  });

  it('abre el rango desde la URL, pide la lista con esas fechas y los totales dicen «Estimado»', async () => {
    montar('/?modo=RANGO&rd=2026-11-01&rh=2026-11-15');
    expect(await screen.findByText('Luis Pérez')).toBeInTheDocument();
    expect(listar).toHaveBeenCalledWith(undefined, 'RANGO', { desde: '2026-11-01', hasta: '2026-11-15' });
    expect(screen.getByText('Del 1 al 15 de noviembre de 2026')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Totales de la planilla')).getByText('Estimado a pagar').nextElementSibling).toHaveTextContent('S/ 300.00');
    expect(screen.getByRole('button', { name: 'Quincena pasada' }).getAttribute('aria-pressed')).toBeDefined();
  });

  it('cambiar «hasta» y los atajos se recuerdan en la URL y recalculan', async () => {
    montar('/?modo=RANGO&rd=2026-11-01&rh=2026-11-15');
    await screen.findByText('Luis Pérez');
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-20' } });
    await waitFor(() => expect(url().get('rh')).toBe('2026-11-20'));
    await waitFor(() => expect(listar).toHaveBeenCalledWith(undefined, 'RANGO', { desde: '2026-11-01', hasta: '2026-11-20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mes pasado' }));
    await waitFor(() => expect(url().get('rd')).toMatch(/^\d{4}-\d{2}-01$/));
    expect(url().get('modo')).toBe('RANGO');
  });

  it('un rango al revés avisa y no pide nada', async () => {
    montar('/?modo=RANGO&rd=2026-11-10&rh=2026-11-01');
    expect(await screen.findByRole('alert')).toHaveTextContent('no puede ser anterior');
    expect(listar).not.toHaveBeenCalled();
  });

  it('pasar de Semana a Rango conserva el período que se miraba', async () => {
    listar.mockResolvedValue({ fecha: '2026-11-09', filas: [] });
    montar('/?fecha=2026-11-11');
    fireEvent.click(await screen.findByRole('button', { name: 'Rango libre' }));
    await waitFor(() => expect(url().get('modo')).toBe('RANGO'));
    expect(url().get('rd')).toBe('2026-11-09');
    expect(url().get('rh')).toBe('2026-11-15');
  });
});

describe('Ajustar ingreso y salida del día (admin)', () => {
  const fila: any = { fecha: '2026-11-06', partyId: '7', nombre: 'Luis Pérez', entrada: '14:12', salida: null };
  beforeEach(() => { ajustar.mockReset().mockResolvedValue({ ok: true }); });

  it('pone ingreso y salida aunque no haya marcado, con motivo obligatorio', async () => {
    const onCambio = vi.fn(async () => undefined);
    render(<AjustarIngresoSalida fila={{ ...fila, entrada: null }} onCambio={onCambio} onError={() => undefined} onOk={() => undefined} />);
    const guardar = screen.getByRole('button', { name: 'Guardar horas del día' });
    expect(guardar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Hora de ingreso'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('Hora de salida'), { target: { value: '23:00' } });
    expect(screen.getByTestId('vista-previa-ajuste')).toHaveTextContent('Ingreso sin marca → 14:00 · Salida sin marca → 23:00');
    expect(guardar).toBeDisabled(); // falta el motivo
    fireEvent.change(screen.getByLabelText('Motivo del ajuste de horas'), { target: { value: 'No marcó, verificado con cámara' } });
    fireEvent.click(guardar);
    await waitFor(() => expect(ajustar).toHaveBeenCalledWith({
      partyId: 7, jornada: '2026-11-06', motivo: 'No marcó, verificado con cámara',
      entrada: '2026-11-06T14:00:00-05:00', salida: '2026-11-06T23:00:00-05:00',
    }));
    await waitFor(() => expect(onCambio).toHaveBeenCalled());
  });

  it('solo manda lo que cambió y una salida de madrugada cae al día calendario siguiente', async () => {
    render(<AjustarIngresoSalida fila={fila} onCambio={async () => undefined} onError={() => undefined} onOk={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Hora de salida'), { target: { value: '01:30' } });
    fireEvent.change(screen.getByLabelText('Motivo del ajuste de horas'), { target: { value: 'Se quedó a cerrar el local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horas del día' }));
    await waitFor(() => expect(ajustar).toHaveBeenCalledWith({ partyId: 7, jornada: '2026-11-06', motivo: 'Se quedó a cerrar el local', salida: '2026-11-07T01:30:00-05:00' }));
  });

  it('una salida anterior al ingreso bloquea el guardado', () => {
    render(<AjustarIngresoSalida fila={fila} onCambio={async () => undefined} onError={() => undefined} onOk={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Hora de salida'), { target: { value: '13:00' } });
    fireEvent.change(screen.getByLabelText('Motivo del ajuste de horas'), { target: { value: 'Corrección de prueba larga' } });
    expect(screen.getByRole('alert')).toHaveTextContent('posterior al ingreso');
    expect(screen.getByRole('button', { name: 'Guardar horas del día' })).toBeDisabled();
  });
});
