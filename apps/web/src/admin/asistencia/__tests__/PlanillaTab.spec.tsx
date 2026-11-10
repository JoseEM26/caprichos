import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const listar = vi.fn();
const detalle = vi.fn();
const pagar = vi.fn();
vi.mock('../planillaApi', async (orig) => ({
  ...(await orig<any>()),
  listarPlanilla: (...a: any[]) => listar(...a),
  detallePlanilla: (...a: any[]) => detalle(...a),
  pagarPlanilla: (...a: any[]) => pagar(...a),
}));

import { PlanillaTab } from '../PlanillaTab';
import { sueldoEquivalente } from '../planillaApi';

describe('sueldoEquivalente (web)', () => {
  it('mensual ×12/52 y semanal ×52/12', () => {
    expect(sueldoEquivalente('MENSUAL', 1000)).toEqual({ semanal: 230.77, mensual: 1000 });
    expect(sueldoEquivalente('SEMANAL', 300)).toEqual({ semanal: 300, mensual: 1300 });
  });
});

describe('PlanillaTab', () => {
  const resultado = {
    programadaMin: 3000, trabajadaMin: 1800, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 0, extraAprobadaMin: 0, valorHora: 20,
    pagoTrabajado: 600, pagoExtra: 0, ganado: 600, consumosCobrados: 40, consumosPendientes: 0, descuentos: 0, adelantos: 0, neto: 560,
  };
  const persona = { partyId: 7, nombre: 'Luis Pérez', sueldo: { modalidad: 'MENSUAL', semanal: 230.77, mensual: 1000 }, periodo: { desde: '2026-11-01', hasta: '2026-11-30' } };
  const base = {
    partyId: 7, nombre: 'Luis Pérez', periodo: { desde: '2026-11-01', hasta: '2026-11-30' }, sueldo: persona.sueldo,
    estado: 'ABIERTO', periodoId: null, toleranciaMin: 5, pendientes: 0, resultado, dias: [], consumos: [], ajustes: [],
  };
  const abrir = async () => fireEvent.click(await screen.findByRole('button', { name: 'Abrir la planilla de Luis Pérez' }));

  it('lista a la persona con tarjeta, totales y abre el detalle; los consumos pasan al siguiente período al desmarcarlos', async () => {
    listar.mockResolvedValue({ fecha: '2026-11-09', filas: [{ ...persona, estado: 'ABIERTO', programadasH: 50, trabajadasH: 30, ganado: 600, consumos: 40, descuentos: 0, adelantos: 0, neto: 560, pendientes: 0 }] });
    detalle.mockResolvedValue({ ...base, consumos: [{ id: '1', fecha: '2026-11-10', pedido: 'P-100', monto: 40, cobrar: true }] });
    render(<PlanillaTab onError={() => undefined} onOk={() => undefined} />);
    expect(await screen.findByText('Luis Pérez')).toBeInTheDocument();
    expect(screen.getByText('S/ 1000.00 al mes', { exact: false })).toBeInTheDocument();
    expect(within(screen.getByLabelText('Totales de la planilla')).getByText('A pagar').nextElementSibling).toHaveTextContent('S/ 560.00');
    await abrir();
    expect(await screen.findByText('Neto a pagar')).toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText('Cobrar en este pago el consumo P-100'));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, expect.any(String), ['1'], [], []));
  });

  it('resumen por persona: penalidad, préstamos, adelantos, medio de pago, LIQUIDADO y copiar; sin ningún «50 %»', async () => {
    const copiar = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText: copiar } });
    const excel = {
      pagoPorDia: 62.5, valorHora: 6.94, horasLaboradas: 10, minutosLaborados: 25, horasExtra: 1, total: 72.34, adicional: 20,
      descuentos: 41.64, descuentosPorCategoria: { NETFLIX: 1.64, MERMA: 15, PRESTAMO: 25 }, netoAPagar: 75.7, adelanto: 30, diferencia: 45.7, penalidadTardanza: 8.5,
    };
    listar.mockResolvedValue({ fecha: '2026-11-09', filas: [{ ...persona, estado: 'PAGADO', pendientes: 0, excel, pago: { celular: '999000111', medio: 'YAPE' } }] });
    const { container } = render(<PlanillaTab onError={() => undefined} onOk={() => undefined} />);
    expect(await screen.findByText('10 h 25 min')).toBeInTheDocument();
    const dd = (t: string) => within(container.querySelector('.pl-tarjeta') as HTMLElement).getByText(t, { selector: 'dt' }).nextElementSibling!;
    expect(dd('Penalidad')).toHaveTextContent('S/ 8.50');
    expect(dd('Préstamos')).toHaveTextContent('S/ 25.00');
    expect(dd('Adelantos')).toHaveTextContent('S/ 30.00');
    expect(screen.getByText(/Merma: S\/ 15\.00/)).toBeInTheDocument();
    expect(screen.getByText('YAPE')).toBeInTheDocument();
    expect(screen.getByText('LIQUIDADO')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/50 ?%/);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar el número de pago' }));
    await waitFor(() => expect(copiar).toHaveBeenCalledWith('999000111'));
  });

  it('los filtros están ocultos y el de estado deja solo a los pagados', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'PAGADO' }, { ...persona, partyId: 8, nombre: 'Ana Ríos', estado: 'ABIERTO' }] });
    render(<PlanillaTab onError={() => undefined} onOk={() => undefined} />);
    await screen.findByText('Ana Ríos');
    expect(screen.queryByLabelText('Estado')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'PAGADO' } });
    expect(screen.queryByText('Ana Ríos')).toBeNull();
    expect(screen.getByText('Luis Pérez')).toBeInTheDocument();
  });

  it('el detalle muestra la penalidad por tardanza con su detalle por día (en soles o en céntimos) y no el antiguo porcentaje', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue({
      ...base, pctTardanza: 50,
      resultado: { ...resultado, tardanzaMin: 40, neto: 551.5 },
      penalidadTardanza: { totalCents: 850, detalle: [{ fecha: '2026-11-03', minutos: 30, monto: 5 }, { fecha: '2026-11-05', minutos: 10, monto: 3.5 }] },
    });
    render(<PlanillaTab onError={() => undefined} onOk={() => undefined} />);
    await abrir();
    const sec = (await screen.findByText('Penalidad por tardanza', { selector: '.pl-seccion-titulo' })).closest('details')!;
    expect(sec).toHaveTextContent('− S/ 8.50');
    expect(sec).toHaveTextContent('2026-11-03 · 30 min de tardanza');
    expect(sec).toHaveTextContent('− S/ 5.00');
    expect(sec).toHaveTextContent('2026-11-05 · 10 min de tardanza');
    expect(screen.getByRole('dialog').textContent).not.toMatch(/50 ?%/);
    expect(screen.getByText('Horas trabajadas (el break se paga)')).toBeInTheDocument();
  });

  it('sin datos de penalidad se degrada a S/ 0.00 sin romperse', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue(base);
    render(<PlanillaTab onError={() => undefined} onOk={() => undefined} />);
    await abrir();
    expect(await screen.findByText('Sin penalidad')).toBeInTheDocument();
    expect(screen.getByText('No hay tardanzas con penalidad en este período.')).toBeInTheDocument();
  });

  it('una cuota de préstamo (con capital e interés) y un servicio extra se pueden saltar en este pago y se vuelve a pedir el cálculo', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue({
      ...base,
      cuotas: [{ id: '90', prestamoId: '1', numero: 1, numCuotas: 3, monto: 106, motivo: null, cobrar: true, capital: 100, interes: 6 }],
      recurrentes: [{ id: '5', tipo: 'NETFLIX', nombre: 'Netflix', monto: 6.56, cobrar: true, periodicidad: 'MENSUAL' }],
    });
    render(<PlanillaTab onError={() => undefined} onOk={() => undefined} />);
    await abrir();
    expect(await screen.findByText(/capital S\/ 100\.00 \+ interés S\/ 6\.00/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Cobrar la cuota 1 del préstamo'));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, expect.any(String), [], ['90'], []));
    fireEvent.click(screen.getByLabelText('Cobrar Netflix en este pago'));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, expect.any(String), [], ['90'], ['5']));
  });

  it('las secciones del detalle son plegables y marcar pagado pide confirmación', async () => {
    listar.mockResolvedValue({ fecha: 'x', filas: [{ ...persona, estado: 'ABIERTO' }] });
    detalle.mockResolvedValue(base);
    pagar.mockResolvedValue({});
    render(<PlanillaTab onError={() => undefined} onOk={() => undefined} />);
    await abrir();
    for (const t of ['Pago', 'Penalidad por tardanza', 'Asistencia del período', 'Adelantos', 'Descuentos y consumos', 'Préstamos', 'Servicios extra', 'Vínculo y vacaciones']) {
      expect((await screen.findByText(t, { selector: '.pl-seccion-titulo' })).closest('details')).not.toBeNull();
    }
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar pagado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, marcar pagado' }));
    await waitFor(() => expect(pagar).toHaveBeenCalledWith(7, expect.any(String), [], [], []));
  });
});
