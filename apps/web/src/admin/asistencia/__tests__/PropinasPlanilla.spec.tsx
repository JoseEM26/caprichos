import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const miPlanilla = vi.fn();
const miCalendario = vi.fn();
vi.mock('../miCalendarioApi', () => ({
  miPlanilla: (...a: any[]) => miPlanilla(...a),
  miCalendario: (...a: any[]) => miCalendario(...a),
}));

import { MisPagos } from '../MisPagos';
import { CascadaNeto } from '../PlanillaPersona';
import { LineaPropinas } from '../LineaPropinas';

const lineas = [
  { fecha: '2026-11-16', totalLocal: 10, horas: 8, horasTotales: 20, porcentaje: 40, monto: 4, pendiente: false },
  { fecha: '2026-11-10', totalLocal: 15, horas: 8, horasTotales: 20, porcentaje: 40, monto: 2, pendiente: true },
];

describe('Línea «Propinas» de la planilla', () => {
  it('muestra el total y el detalle por día: propina del local, horas, % y monto; lo de períodos anteriores sale «pendiente»', () => {
    render(<LineaPropinas total={6} lineas={lineas} />);
    const linea = screen.getByTestId('linea-propinas');
    expect(linea).toHaveTextContent('Propinas');
    expect(linea).toHaveTextContent('+ S/ 6.00');
    const tabla = within(linea).getByRole('table', { name: 'Propinas por día' });
    expect(within(tabla).getByText('Propina del 16/11')).toBeInTheDocument();
    expect(within(tabla).getByText('Propina pendiente del 10/11')).toBeInTheDocument();
    expect(within(tabla).getAllByText('8 h / 20 h')).toHaveLength(2);
    expect(within(tabla).getAllByText('40.00%')).toHaveLength(2);
  });

  it('sin propinas no muestra nada', () => {
    const { container } = render(<LineaPropinas total={0} lineas={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('en la planilla de la persona, la cascada del neto suma «Propinas» aparte de los bonos', () => {
    const r: any = { pagoTrabajado: 300, pagoExtra: 0, ganado: 300, adicional: 16, adelantos: 0, descuentos: 0, consumosCobrados: 0, neto: 316 };
    const c: any = { d: { propinas: { total: 6, lineas } }, r, penal: 0 };
    render(<CascadaNeto c={c} />);
    const cascada = screen.getByTestId('cascada-neto');
    expect(cascada).toHaveTextContent('Bonos (adicional)');
    expect(cascada).toHaveTextContent('+ S/ 10.00'); // 16 − 6 de propinas
    expect(cascada).toHaveTextContent('Propinas');
    expect(cascada).toHaveTextContent('+ S/ 6.00');
  });
});

describe('Mi planilla: mis propinas por día', () => {
  beforeEach(() => { miPlanilla.mockReset(); miCalendario.mockReset(); });

  it('«Se te suma» incluye la línea Propinas con su detalle por día', async () => {
    miPlanilla.mockResolvedValue({
      hoy: '2026-11-17',
      conSueldo: true,
      periodo: { desde: '2026-11-16', hasta: '2026-11-22', tipo: 'SEMANAL' },
      enCurso: true,
      horas: { trabajadasMin: 480 },
      ganado: { bruto: 100, extras: 0, bonos: 0 },
      neto: 106,
      resumen: { seSuma: 106, seDescuenta: 0 },
      propinas: { total: 6, lineas },
      estadoPago: 'PENDIENTE',
    });
    render(<MisPagos />);
    const linea = await screen.findByTestId('linea-propinas');
    expect(linea).toHaveTextContent('+ S/ 6.00');
    expect(within(linea).getByText('Propina pendiente del 10/11')).toBeInTheDocument();
    expect(screen.queryByText('Bonos')).toBeNull(); // las propinas no se cuentan como bono
  });

  it('sin propinas, Mi planilla no muestra la línea', async () => {
    miPlanilla.mockResolvedValue({
      hoy: '2026-11-17', conSueldo: true, periodo: { desde: '2026-11-16', hasta: '2026-11-22', tipo: 'SEMANAL' }, enCurso: true,
      horas: { trabajadasMin: 0 }, ganado: { bruto: 0, extras: 0, bonos: 0 }, neto: 0, resumen: { seSuma: 0, seDescuenta: 0 },
      propinas: { total: 0, lineas: [] }, estadoPago: 'PENDIENTE',
    });
    render(<MisPagos />);
    await screen.findByTestId('mis-pagos');
    expect(screen.queryByTestId('linea-propinas')).toBeNull();
  });
});
