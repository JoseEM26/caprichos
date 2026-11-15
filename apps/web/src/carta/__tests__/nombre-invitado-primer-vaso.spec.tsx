import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { ProductoCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';
import { leerNombreInvitado } from '../nombreInvitado';

const agregarLinea = vi.fn();
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const base = { descripcion: null, fotoUrl: null, tamanos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null };
const frappe = { ...base, id: '1', nombre: 'FRAPPE OREO', precio: 14, grupos: [] } as unknown as ProductoCarta;
const montar = (p: ProductoCarta, bebida = true) => render(<VentanaProductoCarta producto={p} esBebida={bebida} onCerrar={() => {}} />);
const preguntaAparte = () => screen.queryByLabelText('¿Cuál es tu nombre?');

describe('carta: el invitado escribe su nombre solo en el vaso', () => {
  beforeEach(() => {
    agregarLinea.mockClear();
    sessionStorage.clear();
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue({ cliente: null } as any);
  });

  it('no hay pregunta aparte; el nombre del primer vaso se recuerda para la siguiente bebida', () => {
    const a = montar(frappe);
    expect(preguntaAparte()).toBeNull();
    const vaso = document.getElementById('nombre-bebida-0') as HTMLInputElement;
    expect(vaso).not.toBeNull();
    fireEvent.change(vaso, { target: { value: 'Lucía' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }));
    expect(agregarLinea).toHaveBeenCalled();
    expect(leerNombreInvitado()).toBe('Lucía');
    a.unmount();
    montar(frappe);
    expect(preguntaAparte()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Usar el nombre del cliente' }));
    expect((document.getElementById('nombre-bebida-0') as HTMLInputElement).value).toBe('Lucía');
  });

  it('con sesión tampoco se pregunta aparte', () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue({ cliente: { nombre: 'Rosa' } } as any);
    montar(frappe);
    expect(preguntaAparte()).toBeNull();
    expect(screen.getByRole('button', { name: 'Usar el nombre del cliente' })).toBeInTheDocument();
  });
});
