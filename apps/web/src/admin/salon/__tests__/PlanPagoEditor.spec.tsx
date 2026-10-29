import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PlanPagoEditor } from '../componentes/PlanPagoEditor';
import {
  ajustarPlan,
  errorPlan,
  aPlan,
  montoDigitalPlan,
  restantePlan,
  planInicial,
} from '../../pedidos/planPago';

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

  it('un medio paga el total; con varios, la primera fila es el resto del total', () => {
    expect(ajustarPlan(32, [{ medio: 'YAPE', monto: '' }])).toEqual([{ medio: 'YAPE', monto: '32.00' }]);
    expect(
      ajustarPlan(32, [
        { medio: 'EFECTIVO', monto: '' },
        { medio: 'YAPE', monto: '12' },
      ]),
    ).toEqual([
      { medio: 'EFECTIVO', monto: '20.00' },
      { medio: 'YAPE', monto: '12' },
    ]);
  });

  it('ajustarPlan devuelve la misma lista si ya cuadra (no provoca bucles)', () => {
    const filas = [{ medio: 'EFECTIVO' as const, monto: '32.00' }];
    expect(ajustarPlan(32, filas)).toBe(filas);
  });
});

describe('PlanPagoEditor', () => {
  const sinCambios = { onChange: vi.fn(), onPagaCon: vi.fn() };

  it('un medio: no muestra campo de monto, solo el medio; con efectivo ofrece «¿Con cuánto paga?» y el vuelto', () => {
    render(<PlanPagoEditor total={20} filas={[{ medio: 'EFECTIVO', monto: '20.00' }]} {...sinCambios} pagaCon="50" />);

    expect(screen.queryByLabelText(/Monto en/)).toBeNull();
    expect(screen.queryByText(/Agregar|Quitar/)).not.toBeNull(); // «Agregar otro medio de pago» sí aparece
    expect(screen.getByText(/¿Con cuánto paga\?/)).toBeInTheDocument();
    expect(screen.getByText('Vuelto S/ 30.00')).toBeInTheDocument();
  });

  it('un medio que no es efectivo: sin campo de monto ni «¿Con cuánto paga?»', () => {
    render(<PlanPagoEditor total={20} filas={[{ medio: 'YAPE', monto: '20.00' }]} {...sinCambios} pagaCon="" />);
    expect(screen.queryByText(/¿Con cuánto paga\?/)).toBeNull();
    expect(screen.queryByLabelText(/Monto en/)).toBeNull();
  });

  it('un medio con monto desfasado: el padre recibe el total completo (se sincroniza)', () => {
    const onChange = vi.fn();
    render(<PlanPagoEditor total={20} filas={[{ medio: 'YAPE', monto: '15' }]} onChange={onChange} pagaCon="" onPagaCon={vi.fn()} />);
    expect(onChange).toHaveBeenCalledWith([{ medio: 'YAPE', monto: '20.00' }]);
  });

  it('al agregar otro medio aparecen los montos; el nuevo arranca vacío y la primera fila queda con el resto', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PlanPagoEditor total={20} filas={[{ medio: 'EFECTIVO', monto: '20.00' }]} onChange={onChange} pagaCon="" onPagaCon={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Agregar otro medio de pago' }));
    expect(onChange).toHaveBeenCalledWith([
      { medio: 'EFECTIVO', monto: '20.00' },
      { medio: 'YAPE', monto: '' },
    ]);

    rerender(
      <PlanPagoEditor
        total={20}
        filas={[
          { medio: 'EFECTIVO', monto: '20.00' },
          { medio: 'YAPE', monto: '' },
        ]}
        onChange={onChange}
        pagaCon=""
        onPagaCon={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Monto en Yape')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar Yape' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Indica el monto de cada medio');
  });

  it('al escribir el monto del segundo medio, la primera fila se ajusta sola y aparece el resumen', () => {
    const onChange = vi.fn();
    render(
      <PlanPagoEditor
        total={32}
        filas={[
          { medio: 'EFECTIVO', monto: '' },
          { medio: 'YAPE', monto: '12' },
        ]}
        onChange={onChange}
        pagaCon=""
        onPagaCon={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Monto en Efectivo')).toHaveTextContent('S/ 20.00');
    expect(screen.getByLabelText('Resumen del pago')).toHaveTextContent('Efectivo S/ 20.00 · Yape S/ 12.00');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('si el segundo medio supera el total, avisa lo que sobra y no marca el plan como válido', () => {
    render(
      <PlanPagoEditor
        total={32}
        filas={[
          { medio: 'EFECTIVO', monto: '' },
          { medio: 'YAPE', monto: '40' },
        ]}
        onChange={vi.fn()}
        pagaCon=""
        onPagaCon={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Sobra S/ 8.00: baja los montos de los otros medios');
  });

  it('quitar un medio y quedar con uno solo oculta de nuevo los montos', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PlanPagoEditor
        total={32}
        filas={[
          { medio: 'EFECTIVO', monto: '' },
          { medio: 'YAPE', monto: '12' },
        ]}
        onChange={onChange}
        pagaCon=""
        onPagaCon={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quitar Yape' }));
    expect(onChange).toHaveBeenCalledWith([{ medio: 'EFECTIVO', monto: '32.00' }]);

    rerender(<PlanPagoEditor total={32} filas={[{ medio: 'EFECTIVO', monto: '32.00' }]} onChange={onChange} pagaCon="" onPagaCon={vi.fn()} />);
    expect(screen.queryByLabelText(/Monto en/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Quitar/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cuatro medios: no duplica (los ya usados quedan deshabilitados en las demás filas), no ofrece más y tiene scroll propio', () => {
    render(
      <PlanPagoEditor
        total={40}
        filas={[
          { medio: 'EFECTIVO', monto: '' },
          { medio: 'YAPE', monto: '10' },
          { medio: 'PLIN', monto: '10' },
          { medio: 'TRANSFERENCIA', monto: '10' },
        ]}
        onChange={vi.fn()}
        pagaCon=""
        onPagaCon={vi.fn()}
      />,
    );

    const editor = screen.getByTestId('plan-pago-editor');
    expect(editor.style.maxHeight).toBe('40vh');
    expect(editor.style.overflowY).toBe('auto');

    expect(screen.queryByRole('button', { name: 'Agregar otro medio de pago' })).toBeNull();
    const filas = screen.getAllByRole('group').filter((g) => g.getAttribute('aria-label')?.startsWith('Medio') || g.getAttribute('aria-label') === '¿Cómo paga?');
    expect(filas).toHaveLength(4);
    // En cada fila, el medio elegido está activo y los de las otras filas no se pueden repetir
    const primera = within(filas[0]);
    expect(primera.getByRole('button', { name: 'Yape' })).toBeDisabled();
    expect(primera.getByRole('button', { name: 'Efectivo' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(filas[1]).getByRole('button', { name: 'Yape' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('el medio se puede cambiar por otro libre (no por uno ya usado)', () => {
    const onChange = vi.fn();
    render(
      <PlanPagoEditor
        total={20}
        filas={[
          { medio: 'EFECTIVO', monto: '' },
          { medio: 'YAPE', monto: '5' },
        ]}
        onChange={onChange}
        pagaCon=""
        onPagaCon={vi.fn()}
      />,
    );
    fireEvent.click(within(screen.getByRole('group', { name: 'Medio 2 del pago' })).getByRole('button', { name: 'Plin' }));
    expect(onChange).toHaveBeenCalledWith([
      { medio: 'EFECTIVO', monto: '15.00' },
      { medio: 'PLIN', monto: '5' },
    ]);
  });
});
