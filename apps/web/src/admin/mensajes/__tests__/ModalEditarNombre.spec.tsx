import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModalEditarNombre } from '../ModalEditarNombre';

describe('ModalEditarNombre', () => {
  const alCerrarMock = vi.fn();
  const alGuardarMock = vi.fn();
  const alRevertirMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renderiza el modal con el nombre actual y contador de caracteres', () => {
    render(
      <ModalEditarNombre
        abierto={true}
        conversacionId="1"
        nombreActual="Don Pepe"
        nombreEditado={false}
        alCerrar={alCerrarMock}
        alGuardar={alGuardarMock}
        alRevertir={alRevertirMock}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Editar nombre de contacto' })).toBeInTheDocument();
    const input = screen.getByLabelText(/Nombre o alias del contacto/i) as HTMLInputElement;
    expect(input.value).toBe('Don Pepe');
    expect(screen.getByText('8 / 60')).toBeInTheDocument();
  });

  it('2. Valida longitud mínima (2 caracteres) y no permite solo espacios', async () => {
    render(
      <ModalEditarNombre
        abierto={true}
        conversacionId="1"
        nombreActual="Don Pepe"
        nombreEditado={false}
        alCerrar={alCerrarMock}
        alGuardar={alGuardarMock}
        alRevertir={alRevertirMock}
      />,
    );

    const input = screen.getByLabelText(/Nombre o alias del contacto/i);
    const botonGuardar = screen.getByRole('button', { name: 'Guardar' });

    // Caso solo espacios
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(botonGuardar);
    expect(
      screen.getByText('El nombre no puede estar vacío ni consistir únicamente en espacios'),
    ).toBeInTheDocument();
    expect(alGuardarMock).not.toHaveBeenCalled();

    // Caso 1 caracter
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.click(botonGuardar);
    expect(screen.getByText('El nombre debe tener al menos 2 caracteres')).toBeInTheDocument();
    expect(alGuardarMock).not.toHaveBeenCalled();
  });

  it('3. Al pulsar Guardar con nombre válido abre Confirmar y al confirmar ejecuta alGuardar', async () => {
    alGuardarMock.mockResolvedValue(undefined);

    render(
      <ModalEditarNombre
        abierto={true}
        conversacionId="1"
        nombreActual="Don Pepe"
        nombreEditado={false}
        alCerrar={alCerrarMock}
        alGuardar={alGuardarMock}
        alRevertir={alRevertirMock}
      />,
    );

    const input = screen.getByLabelText(/Nombre o alias del contacto/i);
    fireEvent.change(input, { target: { value: 'Don Pepe Cafetería' } });

    const botonGuardar = screen.getByRole('button', { name: 'Guardar' });
    fireEvent.click(botonGuardar);

    // Diálogo de confirmación
    await waitFor(() => {
      expect(screen.getByText('¿Guardar nombre de contacto?')).toBeInTheDocument();
    });

    const botonSi = screen.getByRole('button', { name: 'Sí, guardar' });
    fireEvent.click(botonSi);

    await waitFor(() => {
      expect(alGuardarMock).toHaveBeenCalledWith('Don Pepe Cafetería');
      expect(alCerrarMock).toHaveBeenCalled();
    });
  });

  it('4. Muestra enlace Volver al nombre de WhatsApp si nombreEditado=true, pide Confirmar y llama alRevertir', async () => {
    alRevertirMock.mockResolvedValue(undefined);

    render(
      <ModalEditarNombre
        abierto={true}
        conversacionId="1"
        nombreActual="Don Pepe Editado"
        nombreEditado={true}
        nombrePerfilWa="Pepe Original"
        alCerrar={alCerrarMock}
        alGuardar={alGuardarMock}
        alRevertir={alRevertirMock}
      />,
    );

    const enlaceRevertir = screen.getByRole('button', { name: 'Volver al nombre de WhatsApp' });
    expect(enlaceRevertir).toBeInTheDocument();
    expect(screen.getByText(/Perfil original de WhatsApp:/)).toBeInTheDocument();

    fireEvent.click(enlaceRevertir);

    await waitFor(() => {
      expect(screen.getByText('¿Volver al nombre de WhatsApp?')).toBeInTheDocument();
    });

    const botonSiRevertir = screen.getByRole('button', { name: 'Sí, restablecer' });
    fireEvent.click(botonSiRevertir);

    await waitFor(() => {
      expect(alRevertirMock).toHaveBeenCalled();
      expect(alCerrarMock).toHaveBeenCalled();
    });
  });
});
