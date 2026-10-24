import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api, ErrorApi } from '../../../comun/api';
import { SeccionRepartoConfig } from '../SeccionRepartoConfig';

describe('SeccionRepartoConfig (Configuración de Reparto)', () => {
  const configMock = {
    retrasadoMin: 20,
    tardeMin: 30,
    muyTardeMin: 45,
    velocidadKmh: 25,
    maxPedidos: 3,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Carga y muestra los 5 parámetros de reparto y sus tooltips de ayuda «?»', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(configMock);

    render(<SeccionRepartoConfig puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /Alerta Retrasado/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('spinbutton', { name: /Alerta Tarde/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Alerta Muy tarde/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Velocidad media de viaje/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Máximo de pedidos por repartidor/i })).toBeInTheDocument();

    // Comprobamos la ayuda «?» del campo Retrasado
    const botonAyuda = screen.getByRole('button', { name: /Explicación de Alerta Retrasado/i });
    expect(botonAyuda).toBeInTheDocument();
    fireEvent.click(botonAyuda);

    expect(
      screen.getByText(/Minutos desde que el cliente terminó el pedido para mostrar el marcador en amarillo/i),
    ).toBeInTheDocument();
  });

  it('2. Modo sólo lectura deshabilita inputs y muestra aviso cuando puedeEditar es false', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(configMock);

    render(<SeccionRepartoConfig puedeEditar={false} />);

    await waitFor(() => {
      expect(screen.getByText(/Modo sólo lectura/i)).toBeInTheDocument();
    });

    const inputRetrasado = screen.getByRole('spinbutton', { name: /Alerta Retrasado/i });
    expect(inputRetrasado).toBeDisabled();

    const botonGuardar = screen.getByRole('button', { name: /Guardar configuración de reparto/i });
    expect(botonGuardar).toBeDisabled();
  });

  it('3. Valida orden ascendente estricto de los umbrales de tiempo', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(configMock);

    render(<SeccionRepartoConfig puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /Alerta Retrasado/i })).toBeInTheDocument();
    });

    // Cambiamos retrasado a 35 (mayor que tarde=30)
    const inputRetrasado = screen.getByRole('spinbutton', { name: /Alerta Retrasado/i });
    fireEvent.change(inputRetrasado, { target: { value: '35' } });

    expect(
      screen.getByText(/Los umbrales deben estar en orden ascendente: Retrasado \(35 min\) < Tarde \(30 min\)/i),
    ).toBeInTheDocument();

    const botonGuardar = screen.getByRole('button', { name: /Guardar configuración de reparto/i });
    expect(botonGuardar).toBeDisabled();
  });

  it('4. Solicita confirmación obligatoria Sí/No antes de guardar', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(configMock);
    const putSpy = vi.spyOn(api, 'put').mockResolvedValueOnce({
      ...configMock,
      retrasadoMin: 22,
    });

    render(<SeccionRepartoConfig puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /Alerta Retrasado/i })).toBeInTheDocument();
    });

    // Modificamos a 22 (válido)
    const inputRetrasado = screen.getByRole('spinbutton', { name: /Alerta Retrasado/i });
    fireEvent.change(inputRetrasado, { target: { value: '22' } });

    const botonGuardar = screen.getByRole('button', { name: /Guardar configuración de reparto/i });
    expect(botonGuardar).not.toBeDisabled();
    fireEvent.click(botonGuardar);

    // Debe abrir el modal Confirmar
    expect(screen.getByText(/¿Guardar configuración de reparto\?/i)).toBeInTheDocument();
    expect(putSpy).not.toHaveBeenCalled();

    // Confirmar
    const botonSi = screen.getByRole('button', { name: /Sí, guardar/i });
    fireEvent.click(botonSi);

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith('/admin/repartos/config', {
        retrasadoMin: 22,
        tardeMin: 30,
        muyTardeMin: 45,
        velocidadKmh: 25,
        maxPedidos: 3,
      });
      expect(screen.getByText(/Configuración de reparto actualizada exitosamente/i)).toBeInTheDocument();
    });
  });

  it('5. Muestra error devuelto por la API al fallar la actualización', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(configMock);
    vi.spyOn(api, 'put').mockRejectedValueOnce(
      new ErrorApi('ORDEN_UMBRALES_INVALIDO', 'Los umbrales deben estar en orden ascendente', 400),
    );

    render(<SeccionRepartoConfig puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /Alerta Retrasado/i })).toBeInTheDocument();
    });

    const inputRetrasado = screen.getByRole('spinbutton', { name: /Alerta Retrasado/i });
    fireEvent.change(inputRetrasado, { target: { value: '24' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar configuración de reparto/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, guardar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Los umbrales deben estar en orden ascendente/i)).toBeInTheDocument();
    });
  });
});
