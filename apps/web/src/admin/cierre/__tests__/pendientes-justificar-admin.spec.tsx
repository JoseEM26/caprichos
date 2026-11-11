import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PendientesCobroCierre } from '../PendientesCobroCierre';
import type { PendienteCobro } from '../cierreApi';

const pendiente = (i: number, estado = 'ENTREGADO'): PendienteCobro => ({
  id: i,
  codigo: `CP-${i}`,
  canal: 'CARTA',
  modalidad: 'LLEVAR',
  estado,
  total: 10,
  fecha: new Date().toISOString(),
  pagoEstado: 'PENDIENTE',
  clienteNombre: null,
});

function montar(lista: PendienteCobro[], o: { esAdmin?: boolean; motivoSinCobro?: string; alJustificar?: (m: string) => void } = {}) {
  return render(
    <PendientesCobroCierre pendientes={lista} setPendientes={() => {}} alCambiarTurno={() => {}} {...o} />,
  );
}

describe('Cierre: justificar entregados sin cobrar (solo ADMIN)', () => {
  afterEach(cleanup);

  it('el cajero no ve la justificación', () => {
    montar([pendiente(1)], { esAdmin: false, alJustificar: vi.fn() });
    expect(screen.queryByLabelText('Justificar entregados sin cobrar')).toBeNull();
  });

  it('administrador: pide motivo de 10 letras y entrega el texto al padre', () => {
    const alJustificar = vi.fn();
    montar([pendiente(1), pendiente(2)], { esAdmin: true, alJustificar });
    const boton = screen.getByText('Justificar y permitir el cierre') as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Cerrar sin cobrarlos/), { target: { value: 'corto' } });
    expect(boton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Cerrar sin cobrarlos/), { target: { value: '  Se cobra mañana al cliente  ' } });
    expect(boton.disabled).toBe(false);
    fireEvent.click(boton);
    expect(alJustificar).toHaveBeenCalledWith('Se cobra mañana al cliente');
  });

  it('con justificación puesta se puede quitar', () => {
    const alJustificar = vi.fn();
    montar([pendiente(1)], { esAdmin: true, motivoSinCobro: 'Se cobra mañana', alJustificar });
    expect(screen.getByText('Se cobra mañana')).toBeTruthy();
    fireEvent.click(screen.getByText('Quitar justificación'));
    expect(alJustificar).toHaveBeenCalledWith('');
  });

  it('si queda un pedido aún en curso (no entregado) no se ofrece justificar', () => {
    montar([pendiente(1), pendiente(2, 'PREPARANDO')], { esAdmin: true, alJustificar: vi.fn() });
    expect(screen.queryByLabelText('Justificar entregados sin cobrar')).toBeNull();
  });
});
