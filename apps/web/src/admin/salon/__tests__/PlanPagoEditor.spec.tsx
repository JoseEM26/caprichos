import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanPagoEditor } from '../componentes/PlanPagoEditor';
import { errorPlan, aPlan, montoDigitalPlan, restantePlan, planInicial } from '../../pedidos/planPago';

describe('planPago: reglas del plan', () => {
  it('error si no cubre el total, si sobra o si un medio se repite', () => {
    expect(errorPlan(10, [{ medio: 'YAPE', monto: '6' }])).toBe('Falta S/ 4.00 por asignar');
    expect(errorPlan(10, [{ medio: 'YAPE', monto: '12' }])).toBe('Sobra S/ 2.00: ajusta los montos');
    expect(errorPlan(10, [{ medio: 'YAPE', monto: '5' }, { medio: 'YAPE', monto: '5' }])).toBe('Cada medio solo puede ir una vez');
    expect(errorPlan(10, [{ medio: 'YAPE', monto: '10' }])).toBeNull();
  });

  it('suma exacta en céntimos y parte digital para el voucher', () => {
    const filas = [
      { medio: 'EFECTIVO' as const, monto: '4.10' },
      { medio: 'YAPE' as const, monto: '5.90' },
    ];
    expect(restantePlan(10, filas)).toBe(0);
    expect(aPlan(filas)).toEqual([
      { medio: 'EFECTIVO', monto: 4.1 },
      { medio: 'YAPE', monto: 5.9 },
    ]);
    expect(montoDigitalPlan(aPlan(filas))).toBe(5.9);
    expect(planInicial('EFECTIVO', 12.5)).toEqual([{ medio: 'EFECTIVO', monto: '12.50' }]);
  });
});

describe('PlanPagoEditor', () => {
  it('con efectivo muestra «¿Con cuánto paga?» y calcula el vuelto', () => {
    const onPagaCon = vi.fn();
    render(
      <PlanPagoEditor
        total={20}
        filas={[{ medio: 'EFECTIVO', monto: '20.00' }]}
        onChange={vi.fn()}
        pagaCon="50"
        onPagaCon={onPagaCon}
      />,
    );
    expect(screen.getByText('¿Con cuánto paga en efectivo?')).toBeInTheDocument();
    expect(screen.getByText('Vuelto S/ 30.00')).toBeInTheDocument();
  });

  it('dividido: muestra lo que falta y agrega un medio con el restante', () => {
    const onChange = vi.fn();
    render(
      <PlanPagoEditor
        total={20}
        filas={[{ medio: 'YAPE', monto: '15' }]}
        onChange={onChange}
        pagaCon=""
        onPagaCon={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Falta S/ 5.00 por asignar');

    fireEvent.click(screen.getByRole('button', { name: 'Agregar medio' }));
    expect(onChange).toHaveBeenCalledWith([
      { medio: 'YAPE', monto: '15' },
      { medio: 'EFECTIVO', monto: '5.00' },
    ]);
  });
});
