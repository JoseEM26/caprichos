import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Ingresar } from '../admin/Ingresar';
import * as sesionModulo from '../comun/sesion';
import { ErrorApi } from '../comun/api';

describe('Formulario de ingreso (/admin/ingresar)', () => {
  it('valida DNI inválido (menos de 8 dígitos) y no llama a ingresar', async () => {
    const mockIngresar = vi.fn();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: null,
      permisos: [],
      debeCambiar: false,
      cargando: false,
      autenticado: false,
      ingresar: mockIngresar,
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Ingresar />
      </MemoryRouter>,
    );

    const inputDni = screen.getByLabelText(/^DNI$/i);
    const inputClave = screen.getByLabelText(/^Contraseña$/i);
    const botonIngresar = screen.getByRole('button', { name: /Iniciar sesión/i });

    // Ingresar solo 7 dígitos
    fireEvent.change(inputDni, { target: { value: '1234567' } });
    fireEvent.change(inputClave, { target: { value: 'clave123' } });
    fireEvent.click(botonIngresar);

    expect(
      screen.getByText(/El DNI debe tener 8 dígitos numéricos/i),
    ).toBeInTheDocument();
    expect(mockIngresar).not.toHaveBeenCalled();
  });

  it('muestra el mensaje de error correspondiente cuando la API rechaza credenciales', async () => {
    const mockIngresar = vi
      .fn()
      .mockRejectedValue(
        new ErrorApi('CREDENCIALES_INVALIDAS', 'Credenciales inválidas'),
      );

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: null,
      permisos: [],
      debeCambiar: false,
      cargando: false,
      autenticado: false,
      ingresar: mockIngresar,
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Ingresar />
      </MemoryRouter>,
    );

    const inputDni = screen.getByLabelText(/^DNI$/i);
    const inputClave = screen.getByLabelText(/^Contraseña$/i);
    const botonIngresar = screen.getByRole('button', { name: /Iniciar sesión/i });

    fireEvent.change(inputDni, { target: { value: '87654321' } });
    fireEvent.change(inputClave, { target: { value: 'errada' } });
    fireEvent.click(botonIngresar);

    await waitFor(() => {
      expect(
        screen.getByText(/Credenciales inválidas/i),
      ).toBeInTheDocument();
    });
    expect(mockIngresar).toHaveBeenCalledWith('87654321', 'errada');
  });

  it('muestra mensaje claro cuando el usuario está desactivado por la API', async () => {
    const mockIngresar = vi
      .fn()
      .mockRejectedValue(
        new ErrorApi(
          'USUARIO_DESACTIVADO',
          'El usuario se encuentra desactivado',
        ),
      );

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: null,
      permisos: [],
      debeCambiar: false,
      cargando: false,
      autenticado: false,
      ingresar: mockIngresar,
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Ingresar />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/^DNI$/i), {
      target: { value: '11223344' },
    });
    fireEvent.change(screen.getByLabelText(/^Contraseña$/i), {
      target: { value: 'clave123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Iniciar sesión/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/El usuario se encuentra desactivado/i),
      ).toBeInTheDocument();
    });
  });

  it('muestra mensaje de bloqueo cuando la cuenta está bloqueada tras 5 intentos', async () => {
    const mockIngresar = vi
      .fn()
      .mockRejectedValue(
        new ErrorApi(
          'CUENTA_BLOQUEADA',
          'Cuenta bloqueada temporalmente tras 5 intentos fallidos.',
        ),
      );

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: null,
      permisos: [],
      debeCambiar: false,
      cargando: false,
      autenticado: false,
      ingresar: mockIngresar,
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Ingresar />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/^DNI$/i), {
      target: { value: '11223344' },
    });
    fireEvent.change(screen.getByLabelText(/^Contraseña$/i), {
      target: { value: 'clave123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Iniciar sesión/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Cuenta bloqueada temporalmente/i),
      ).toBeInTheDocument();
    });
  });
});
