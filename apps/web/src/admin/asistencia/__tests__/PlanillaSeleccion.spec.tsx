import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PestanaDescuentos } from '../PlanillaPersonaDescuentos';
import { formulaNeto, motivoNeto, textoFuera } from '../planillaExplicacion';

const resultado = {
  programadaMin: 0, trabajadaMin: 0, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 0, extraAprobadaMin: 0, valorHora: 0,
  pagoTrabajado: 348.96, pagoExtra: 0, ganado: 348.96, consumosCobrados: 4.8, consumosPendientes: 0, descuentos: 0, adelantos: 0, neto: 344.16,
};
const d: any = {
  partyId: 7, nombre: 'Luis Pérez', periodo: { desde: '2026-11-09', hasta: '2026-11-15' }, sueldo: { modalidad: 'SEMANAL', semanal: 300 },
  estado: 'ABIERTO', periodoId: null, toleranciaMin: 5, pendientes: 0, resultado, dias: [], ajustes: [], cuotas: [], recurrentes: [],
  consumos: [{ id: '1', fecha: '2026-11-10', pedido: 'P-100', monto: 4.8, cobrar: true, productos: ['1 × Café'] }],
  recurrentesFueraDePeriodo: [{ id: '5', nombre: 'Netflix', signo: 'DESCUENTO', periodicidad: 'SEMANAL', valorTipo: 'MONTO', valor: 1.64, estado: 'EMPIEZA', desde: '2026-11-16', hasta: null, proximoPeriodo: { desde: '2026-11-16', hasta: '2026-11-22' } }],
};

function ctl(extra: Record<string, unknown> = {}): any {
  return {
    d, r: resultado, pagado: false, ocupado: false, guardando: null,
    ejecutar: vi.fn(async () => undefined), cargar: vi.fn(async () => undefined), seleccionar: vi.fn(async () => undefined),
    antSinCobrar: [], antTotal: 0, sinDescontarAnt: false, setSinDescontarAnt: vi.fn(),
    ...extra,
  };
}

describe('PestanaDescuentos: checks que se guardan', () => {
  it('marcar un consumo lo guarda en el servidor (no en un estado local)', () => {
    const c = ctl();
    render(<PestanaDescuentos c={c} />);
    fireEvent.click(screen.getByLabelText('Cobrar en este pago el consumo P-100'));
    expect(c.seleccionar).toHaveBeenCalledWith('CONSUMO_EXCLUIDO', '1', true);
  });

  it('mientras guarda, ese check queda deshabilitado', () => {
    render(<PestanaDescuentos c={ctl({ guardando: 'CONSUMO_EXCLUIDO:1' })} />);
    expect(screen.getByLabelText('Cobrar en este pago el consumo P-100')).toBeDisabled();
  });

  it('el total a descontar se muestra en la parte de arriba', () => {
    render(<PestanaDescuentos c={ctl()} />);
    expect(screen.getByTestId('total-descontar')).toHaveTextContent('Total a descontar este período: S/ 4.80');
  });
});

describe('descuento personalizado fuera del período visto', () => {
  it('dice cuándo empieza y en qué planilla entra, en vez de «Ninguno este período»', () => {
    render(<PestanaDescuentos c={ctl()} />);
    expect(screen.getByTestId('personalizados-fuera')).toHaveTextContent('Netflix — S/ 1.64 por semana · empieza el 16/11/2026: entra en la planilla del 16 nov al 22 nov');
    expect(screen.queryByText('Ninguno este período')).toBeNull();
  });

  it('un descuento que ya terminó dice que terminó y que ya no se aplica', () => {
    const x = { id: '9', nombre: 'Plan de celular', signo: 'DESCUENTO', periodicidad: 'MENSUAL', valorTipo: 'MONTO', valor: 20, estado: 'TERMINO', desde: '2026-01-01', hasta: '2026-10-31', proximoPeriodo: null } as any;
    expect(textoFuera(x)).toBe('Plan de celular — S/ 20.00 por mes · terminó el 31/10/2026: ya no se aplica en esta planilla');
  });
});

describe('explicación del neto', () => {
  it('la fórmula usa los números reales de la persona', () => {
    expect(formulaNeto(d)).toBe('S/ 348.96 − S/ 4.80 = S/ 344.16');
  });

  it('con neto negativo dice qué concepto supera lo ganado', () => {
    const neg = { ...d, resultado: { ...resultado, consumosCobrados: 400, neto: -51.04 } };
    const texto = motivoNeto(neg);
    expect(texto).toContain('El neto es negativo');
    expect(texto).toContain('lo que se descuenta (S/ 400.00) supera lo ganado (S/ 348.96)');
    expect(texto).toContain('Lo que más pesa: consumos del personal (S/ 400.00)');
  });

  it('con neto positivo no hay aviso', () => {
    expect(motivoNeto(d)).toBeNull();
  });
});
