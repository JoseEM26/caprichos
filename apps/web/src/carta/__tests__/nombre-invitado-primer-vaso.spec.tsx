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
const dona = { ...base, id: '3', nombre: 'Dona', precio: 5, grupos: [] } as unknown as ProductoCarta;
const montar = (p: ProductoCarta, bebida = true) => render(<VentanaProductoCarta producto={p} esBebida={bebida} onCerrar={() => {}} />);
const pregunta = () => screen.queryByLabelText('¿Cuál es tu nombre?');

describe('carta: el invitado dice su nombre al primer vaso', () => {
  beforeEach(() => {
    agregarLinea.mockClear();
    sessionStorage.clear();
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue({ cliente: null } as any);
  });

  it('pide el nombre, el atajo rellena, se recuerda y la segunda bebida no lo vuelve a pedir', () => {
    const a = montar(frappe);
    expect(pregunta()).toBeRequired();
    expect(document.getElementById('nombre-bebida-0')).toBeNull();
    fireEvent.change(pregunta()!, { target: { value: 'L' } });
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    fireEvent.change(pregunta()!, { target: { value: 'Lucía' } });
    fireEvent.keyDown(pregunta()!, { key: 'Enter' });
    expect(pregunta()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Usar el nombre del cliente' }));
    expect((document.getElementById('nombre-bebida-0') as HTMLInputElement).value).toBe('Lucía');
    expect(leerNombreInvitado()).toBe('Lucía');
    a.unmount();
    montar(frappe);
    expect(pregunta()).toBeNull();
    expect(screen.getByRole('button', { name: 'Usar el nombre del cliente' })).toBeInTheDocument();
  });

  it('con sesión no se pide', () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue({ cliente: { nombre: 'Rosa' } } as any);
    montar(frappe);
    expect(pregunta()).toBeNull();
  });

  it('un producto sin nombre en el vaso no lo pide', () => {
    montar(dona, false);
    expect(pregunta()).toBeNull();
  });
});
