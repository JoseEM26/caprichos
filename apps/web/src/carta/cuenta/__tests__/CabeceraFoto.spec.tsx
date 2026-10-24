import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as cuentaModulo from '../CuentaContext';
import * as carritoModulo from '../../CarritoContext';
import { CabeceraCarta } from '../../CabeceraCarta';

const cuentaBase = {
  panelAbierto: false,
  abrirPanel: vi.fn(),
  cerrarPanel: vi.fn(),
  ingresar: vi.fn(),
  registrar: vi.fn(),
  actualizarPerfil: vi.fn(),
  subirFoto: vi.fn(),
  quitarFoto: vi.fn(),
  salir: vi.fn(),
  refrescar: vi.fn(),
};

const cliente = (fotoUrl: string | null) => ({
  partyId: '100',
  nombre: 'Ana Pérez',
  dniMascara: '4521****',
  correo: null,
  telefono: '912345678',
  fotoUrl,
  cumpleanos: null,
  puntos: 12,
});

const renderizar = (fotoUrl: string | null) => {
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({ ...cuentaBase, cliente: cliente(fotoUrl) } as any);
  vi.spyOn(carritoModulo, 'useCarrito').mockReturnValue({
    cantidadTotal: 0,
    subtotal: 0,
    abrirCajon: vi.fn(),
    setSeguimientoAbierto: vi.fn(),
  } as any);
  return render(
    <CabeceraCarta
      busqueda=""
      onCambioBusqueda={vi.fn()}
      estadoLocal={'abierto' as any}
      datosLocal={{} as any}
      pagina="carta"
      onPagina={vi.fn()}
      categorias={[]}
      categoriaActivaId={null as any}
      onCategoria={vi.fn()}
    />,
  );
};

describe('CabeceraCarta ▸ avatar de la cuenta', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('con foto muestra el avatar redondo en el botón de cuenta', () => {
    renderizar('/archivos/publico/2026/10/ana.webp');
    const boton = screen.getByRole('button', { name: 'Mi cuenta: 12 puntos' });
    const img = boton.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', '/archivos/publico/2026/10/ana.webp');
    expect(img).toHaveStyle({ width: '18px', height: '18px' });
  });

  it('sin foto conserva el icono de siempre', () => {
    renderizar(null);
    const boton = screen.getByRole('button', { name: 'Mi cuenta: 12 puntos' });
    expect(boton.querySelector('img')).toBeNull();
    expect(boton.querySelector('svg')).not.toBeNull();
  });
});
