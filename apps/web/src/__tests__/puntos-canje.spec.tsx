import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as cuentaModulo from '../carta/cuenta/CuentaContext';
import { PuntosCanje } from '../carta/cuenta/PuntosCanje';

const mockCuenta = (puntos: number) =>
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
    cliente: {
      partyId: '100',
      nombre: 'Ana',
      telefono: '912345678',
      correo: 'ana@ejemplo.com',
      cumpleanos: '14/03',
      puntos,
      fotoUrl: null,
    },
    panelAbierto: false,
    abrirPanel: vi.fn(),
    cerrarPanel: vi.fn(),
    ingresar: vi.fn(),
    registrar: vi.fn(),
    salir: vi.fn(),
    refrescar: vi.fn(),
    actualizarPerfil: vi.fn(),
    subirFoto: vi.fn(),
    quitarFoto: vi.fn(),
  });

const texto = () => document.body.textContent ?? '';

describe('PuntosCanje (puntos en números enteros)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('con saldo 0 muestra la tarjeta informativa con el porcentaje del servidor, sin canje', () => {
    mockCuenta(0);
    render(<PuntosCanje totalPedido={50} puntosAplicados={0} alAplicar={vi.fn()} porcentaje={7} />);

    expect(texto()).toContain('Tienes 0 puntos. Ganas 7 % de lo que pagas en productos sin promoción; se suman cuando Caja cobra tu pedido.');
    expect(screen.queryByRole('button', { name: 'Aplicar' })).toBeNull();
  });

  it('con saldo mayor a 0 sigue mostrando el canje', () => {
    mockCuenta(12);
    render(<PuntosCanje totalPedido={50} puntosAplicados={0} alAplicar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeInTheDocument();
  });

  it('con saldo menor a 1 solo muestra la línea informativa, sin campo ni botón', () => {
    mockCuenta(0.5);
    render(<PuntosCanje totalPedido={50} puntosAplicados={0} alAplicar={vi.fn()} />);

    expect(texto()).toContain(
      'Tienes 0.50 puntos. Se pueden usar desde 1 punto, en productos sin promoción ni descuento.',
    );
    expect(screen.queryByLabelText(/¿Cuántos puntos deseas usar\?/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aplicar' })).toBeNull();
  });

  it('el campo solo acepta dígitos y pide teclado numérico', () => {
    mockCuenta(30);
    render(<PuntosCanje totalPedido={25} puntosAplicados={0} alAplicar={vi.fn()} />);

    const input = screen.getByLabelText(/¿Cuántos puntos deseas usar\?/i) as HTMLInputElement;
    expect(input).toHaveAttribute('inputMode', 'numeric');

    fireEvent.change(input, { target: { value: '1a2.5' } });
    expect(input.value).toBe('125');
  });

  it('un entero válido aplica los puntos con alAplicar(n)', () => {
    mockCuenta(30);
    const alAplicar = vi.fn();
    render(<PuntosCanje totalPedido={25} puntosAplicados={0} alAplicar={alAplicar} />);

    fireEvent.change(screen.getByLabelText(/¿Cuántos puntos deseas usar\?/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(alAplicar).toHaveBeenCalledWith(20);
  });

  it('más puntos que el saldo da error con el saldo a dos decimales', () => {
    mockCuenta(30.5);
    const alAplicar = vi.fn();
    render(<PuntosCanje totalPedido={100} puntosAplicados={0} alAplicar={alAplicar} />);

    fireEvent.change(screen.getByLabelText(/¿Cuántos puntos deseas usar\?/i), { target: { value: '31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(alAplicar).not.toHaveBeenCalled();
    expect(screen.getByText('Solo tienes 30.50 puntos.')).toBeInTheDocument();
  });

  it('más puntos que el máximo usable da error con el mensaje de productos sin promoción', () => {
    mockCuenta(30);
    const alAplicar = vi.fn();
    render(<PuntosCanje totalPedido={12} puntosAplicados={0} alAplicar={alAplicar} />);

    fireEvent.change(screen.getByLabelText(/¿Cuántos puntos deseas usar\?/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(alAplicar).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Solo puedes usar hasta 12 puntos en este pedido: se aplican a productos sin promoción ni descuento.',
      ),
    ).toBeInTheDocument();
  });

  it('quitar deja los puntos en 0', () => {
    mockCuenta(30);
    const alAplicar = vi.fn();
    render(<PuntosCanje totalPedido={25} puntosAplicados={20} alAplicar={alAplicar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(alAplicar).toHaveBeenCalledWith(0);
  });

  it('la fracción del saldo se muestra con dos decimales y queda en el saldo', () => {
    mockCuenta(30.5);
    render(<PuntosCanje totalPedido={100} puntosAplicados={0} alAplicar={vi.fn()} />);

    expect(texto()).toContain('Tienes 30.50 puntos. Puedes usar hasta 30, en números enteros.');

    fireEvent.change(screen.getByLabelText(/¿Cuántos puntos deseas usar\?/i), { target: { value: '10' } });

    expect(texto()).toContain('Te quedan 20.50 puntos.');
  });
});
