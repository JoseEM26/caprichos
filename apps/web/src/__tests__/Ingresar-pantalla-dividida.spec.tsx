import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Ingresar } from '../admin/Ingresar';
import * as sesionModulo from '../comun/sesion';
import { pantallaIngresoApi } from '../admin/configuracion/pantallaIngresoApi';

function ponerMatchMedia(opciones: { anchaPC?: boolean; movimientoReducido?: boolean }) {
  window.matchMedia = vi.fn().mockImplementation((consulta: string) => ({
    matches:
      (consulta.includes('min-width: 900px') && !!opciones.anchaPC) ||
      (consulta.includes('prefers-reduced-motion') && !!opciones.movimientoReducido),
    media: consulta,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as any;
}

function sesionSinUsuario() {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: null,
    permisos: [],
    debeCambiar: false,
    cargando: false,
    autenticado: false,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: vi.fn(),
  } as any);
}

const renderIngresar = () =>
  render(
    <MemoryRouter>
      <Ingresar />
    </MemoryRouter>,
  );

describe('Ingresar en pantalla dividida', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sesionSinUsuario();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).matchMedia;
  });

  it('en PC muestra el formulario y la imagen grande con la frase', async () => {
    ponerMatchMedia({ anchaPC: true });
    vi.spyOn(pantallaIngresoApi, 'obtenerPublica').mockResolvedValue({
      imagenes: ['/imagenes/caprichos/fantasma-cafe.webp'],
      frase: 'Hecho con cariño',
    });

    renderIngresar();

    expect(screen.getByLabelText(/^DNI$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar sesión/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('frase-ingreso')).toHaveTextContent('Hecho con cariño');
    });
    const imagen = screen.getByTestId('imagen-ingreso').querySelector('img');
    expect(imagen).toHaveAttribute('src', '/imagenes/caprichos/fantasma-cafe.webp');
    expect(imagen).toHaveAttribute('alt', '');
  });

  it('usa la imagen y frase por defecto si el endpoint falla', async () => {
    ponerMatchMedia({ anchaPC: false });
    vi.spyOn(pantallaIngresoApi, 'obtenerPublica').mockRejectedValue(new Error('sin red'));

    renderIngresar();

    expect(screen.getByTestId('frase-ingreso')).toHaveTextContent('Hecho a mano, servido con cariño');
    const imagen = screen.getByTestId('imagen-ingreso').querySelector('img');
    expect(imagen).toHaveAttribute('src', '/imagenes/caprichos/fantasma-cafe.webp');
    // El formulario sigue disponible
    expect(screen.getByLabelText(/^Contraseña$/i)).toBeInTheDocument();
  });

  it('rota las imágenes cada 6 segundos cuando hay varias', async () => {
    vi.useFakeTimers();
    ponerMatchMedia({ anchaPC: true });
    vi.spyOn(pantallaIngresoApi, 'obtenerPublica').mockResolvedValue({
      imagenes: ['/imagenes/caprichos/fantasma-cafe.webp', '/imagenes/caprichos/donuts-halloween.webp'],
      frase: 'Hola',
    });

    renderIngresar();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const imagenes = () => Array.from(screen.getByTestId('imagen-ingreso').querySelectorAll('img'));
    expect(imagenes()[0]).toHaveAttribute('data-activa', 'true');
    expect(imagenes()[1]).toHaveAttribute('data-activa', 'false');

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(imagenes()[0]).toHaveAttribute('data-activa', 'false');
    expect(imagenes()[1]).toHaveAttribute('data-activa', 'true');
  });

  it('no rota si el usuario pide movimiento reducido', async () => {
    vi.useFakeTimers();
    ponerMatchMedia({ anchaPC: true, movimientoReducido: true });
    vi.spyOn(pantallaIngresoApi, 'obtenerPublica').mockResolvedValue({
      imagenes: ['/imagenes/caprichos/fantasma-cafe.webp', '/imagenes/caprichos/donuts-halloween.webp'],
      frase: 'Hola',
    });

    renderIngresar();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(12000);
    });

    const imagenes = Array.from(screen.getByTestId('imagen-ingreso').querySelectorAll('img'));
    expect(imagenes[0]).toHaveAttribute('data-activa', 'true');
    expect(imagenes[1]).toHaveAttribute('data-activa', 'false');
  });
});
