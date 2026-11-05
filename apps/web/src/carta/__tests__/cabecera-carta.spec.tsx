import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import * as cuentaModulo from '../cuenta/CuentaContext';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { CabeceraCarta } from '../CabeceraCarta';

const cuentaBase = {
  panelAbierto: false, abrirPanel: vi.fn(), cerrarPanel: vi.fn(), ingresar: vi.fn(), registrar: vi.fn(),
  actualizarPerfil: vi.fn(), subirFoto: vi.fn(), quitarFoto: vi.fn(), salir: vi.fn(), refrescar: vi.fn(),
};

function conCliente(puntos: number) {
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
    ...cuentaBase,
    cliente: { partyId: '1', nombre: 'José Pérez', correo: null, telefono: '987654321', fotoUrl: null, cumpleanos: null, puntos },
  } as any);
}

/** Pone `cantidad` unidades en el carrito al montarse (sin tocar la lógica del carrito). */
function Cargar({ cantidad }: { cantidad: number }) {
  const { agregarLinea } = useCarrito();
  useEffect(() => {
    if (cantidad > 0) {
      agregarLinea({ productoId: 'p1', nombre: 'Frappé', precioBase: 10, cantidad, opciones: [], precioUnitario: 10, subtotal: 10 * cantidad });
    }
  }, []);
  return null;
}

function cabecera(cantidad = 0) {
  return (
    <CarritoProvider>
      <Cargar cantidad={cantidad} />
      <CabeceraCarta
        busqueda=""
        onCambioBusqueda={() => {}}
        estadoLocal={{ abierta: true } as any}
        datosLocal={{ nombre: 'Caprichos' } as any}
        pagina="carta"
        onPagina={() => {}}
        categorias={[{ id: 'c1', nombre: 'Frappés' }]}
        categoriaActivaId="todo"
        onCategoria={() => {}}
      />
    </CarritoProvider>
  );
}

describe('Cabecera de la carta ▸ puntos', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('el chip muestra los puntos con 2 decimales («1.01 pts»)', () => {
    conCliente(1.01);
    render(cabecera());
    expect(screen.getByText('1.01 pts')).toBeInTheDocument();
  });

  it('un saldo entero también muestra 2 decimales («12.00 pts»)', () => {
    conCliente(12);
    render(cabecera());
    expect(screen.getByText('12.00 pts')).toBeInTheDocument();
  });

  it('el chip y «Mis pedidos» van en el mismo grupo, junto al carrito', () => {
    conCliente(1.01);
    render(cabecera());
    const chip = screen.getByRole('button', { name: /Mi cuenta/ });
    const carrito = screen.getByRole('button', { name: /Abrir el carrito/ });
    expect(chip.parentElement).toBe(carrito.parentElement);
    expect(carrito.parentElement?.style.flexShrink).toBe('0');
    expect(carrito.parentElement?.style.marginLeft).toBe('auto');
  });
});

describe('Cabecera de la carta ▸ carrito', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({ ...cuentaBase, cliente: null } as any);
  });

  it('sin productos no muestra insignia', () => {
    render(cabecera(0));
    const carrito = screen.getByRole('button', { name: /Abrir el carrito: 0 productos/ });
    expect(carrito).toBeInTheDocument();
    expect(carrito.querySelector('span')).toBeNull();
  });

  it('con 9 productos muestra el número completo', () => {
    render(cabecera(9));
    const carrito = screen.getByRole('button', { name: /Abrir el carrito: 9 productos/ });
    expect(carrito.querySelector('span')?.textContent).toBe('9');
  });

  it('a partir de 100 productos la insignia muestra 99+ y el nombre accesible conserva el total', () => {
    render(cabecera(120));
    const carrito = screen.getByRole('button', { name: /Abrir el carrito: 120 productos/ });
    expect(carrito.querySelector('span')?.textContent).toBe('99+');
  });

  it('el botón del carrito tiene objetivo táctil de al menos 44 px', () => {
    render(cabecera(3));
    const carrito = screen.getByRole('button', { name: /Abrir el carrito/ });
    expect(carrito.style.height).toBe('44px');
    expect(carrito.style.minHeight).toBe('44px');
    expect(carrito.style.flexShrink).toBe('0');
  });
});

describe('Cabecera de la carta ▸ nombre largo', () => {
  it('el nombre del local no empuja la cabecera: se corta con puntos suspensivos', () => {
    vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({ ...cuentaBase, cliente: null } as any);
    render(
      <CarritoProvider>
        <CabeceraCarta
          busqueda=""
          onCambioBusqueda={() => {}}
          estadoLocal={{ abierta: true } as any}
          datosLocal={{ nombre: 'Cafetería Artesanal Muy Larga Del Distrito De San Juan' } as any}
          pagina="carta"
          onPagina={() => {}}
          categorias={[]}
          categoriaActivaId="todo"
          onCategoria={() => {}}
        />
      </CarritoProvider>,
    );
    const nombre = screen.getByText('Cafetería Artesanal Muy Larga Del Distrito De San Juan');
    expect(nombre.style.whiteSpace).toBe('nowrap');
    expect(nombre.style.overflow).toBe('hidden');
    expect(nombre.style.textOverflow).toBe('ellipsis');
  });
});

describe('Cabecera de la carta ▸ instalar app', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({ ...cuentaBase, cliente: null } as any);
  });

  it('muestra «Instalar app» en el mismo grupo que el carrito, sin pedido y sin prompt', () => {
    render(cabecera(0));
    const instalar = screen.getByRole('button', { name: 'Instalar app' });
    const carrito = screen.getByRole('button', { name: /Abrir el carrito/ });
    expect(instalar.parentElement).toBe(carrito.parentElement);
    expect(instalar.style.minHeight).toBe('44px');
  });

  it('en la vista previa del diseñador (mostrarInstalar=false) no aparece', () => {
    render(
      <CarritoProvider>
        <CabeceraCarta
          busqueda=""
          onCambioBusqueda={() => {}}
          estadoLocal={{ abierta: true } as any}
          datosLocal={{ nombre: 'Caprichos' } as any}
          pagina="carta"
          onPagina={() => {}}
          categorias={[]}
          categoriaActivaId="todo"
          onCategoria={() => {}}
          mostrarInstalar={false}
        />
      </CarritoProvider>,
    );
    expect(screen.queryByRole('button', { name: /Instalar app/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Abrir el carrito/ })).toBeInTheDocument();
  });
});
