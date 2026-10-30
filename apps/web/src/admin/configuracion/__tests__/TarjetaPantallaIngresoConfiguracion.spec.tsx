import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { TarjetaPantallaIngresoConfiguracion } from '../TarjetaPantallaIngresoConfiguracion';
import { pantallaIngresoApi } from '../pantallaIngresoApi';

const configDefecto = {
  imagenes: [{ tipo: 'defecto' as const, valor: 'fantasma-cafe.webp' }],
  frase: 'Hecho a mano, servido con cariño',
  fabrica: ['caprichos-de-octubre.webp', 'donuts-halloween.webp', 'fantasma-cafe.webp', 'hechizo-pumpkin.webp', 'caprichos-del-mes.webp'],
};

describe('TarjetaPantallaIngresoConfiguracion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra la imagen elegida por defecto y la frase guardada', async () => {
    vi.spyOn(pantallaIngresoApi, 'obtenerAdmin').mockResolvedValue(configDefecto);

    render(<TarjetaPantallaIngresoConfiguracion />);

    await waitFor(() => {
      expect(screen.getByTestId('tarjeta-pantalla-ingreso')).toBeInTheDocument();
    });
    expect(screen.getByText(/Imágenes elegidas \(1 de 5/)).toBeInTheDocument();
    expect((screen.getByLabelText('Fantasma con café') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Donuts de Halloween') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Frase de la pantalla') as HTMLInputElement).value).toBe(
      'Hecho a mano, servido con cariño',
    );
  });

  it('marca una imagen de fábrica y la agrega al final del orden', async () => {
    vi.spyOn(pantallaIngresoApi, 'obtenerAdmin').mockResolvedValue(configDefecto);

    render(<TarjetaPantallaIngresoConfiguracion />);
    await waitFor(() => expect(screen.getByLabelText('Donuts de Halloween')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Donuts de Halloween'));

    expect(screen.getByText(/Imágenes elegidas \(2 de 5/)).toBeInTheDocument();
    const elegidas = screen.getAllByTestId('imagen-ingreso-elegida');
    expect(elegidas).toHaveLength(2);
    expect(within(elegidas[1]).getByText('Donuts de Halloween')).toBeInTheDocument();
  });

  it('no permite elegir más de 5 imágenes', async () => {
    vi.spyOn(pantallaIngresoApi, 'obtenerAdmin').mockResolvedValue({
      ...configDefecto,
      imagenes: [
        { tipo: 'defecto', valor: 'caprichos-de-octubre.webp' },
        { tipo: 'defecto', valor: 'donuts-halloween.webp' },
        { tipo: 'defecto', valor: 'fantasma-cafe.webp' },
        { tipo: 'defecto', valor: 'hechizo-pumpkin.webp' },
        { tipo: 'archivo', valor: '/archivos/publico/2026/10/propia.webp' },
      ],
    });

    render(<TarjetaPantallaIngresoConfiguracion />);
    await waitFor(() => expect(screen.getByLabelText('Caprichos del mes')).toBeInTheDocument());

    expect(screen.getByText(/Imágenes elegidas \(5 de 5/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Caprichos del mes'));

    expect(screen.getByRole('alert')).toHaveTextContent(/Ya elegiste 5 imágenes/);
    expect(screen.getByText(/Imágenes elegidas \(5 de 5/)).toBeInTheDocument();
  });

  it('quitar una imagen la desactiva sin borrarla de la biblioteca', async () => {
    vi.spyOn(pantallaIngresoApi, 'obtenerAdmin').mockResolvedValue(configDefecto);

    render(<TarjetaPantallaIngresoConfiguracion />);
    await waitFor(() => expect(screen.getByTestId('imagen-ingreso-elegida')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Quitar la imagen 1/i }));

    expect(screen.queryAllByTestId('imagen-ingreso-elegida')).toHaveLength(0);
    expect((screen.getByLabelText('Fantasma con café') as HTMLInputElement).checked).toBe(false);
  });

  it('guarda solo después de confirmar con Sí, y envía las imágenes y la frase', async () => {
    vi.spyOn(pantallaIngresoApi, 'obtenerAdmin').mockResolvedValue(configDefecto);
    const guardar = vi.spyOn(pantallaIngresoApi, 'guardar').mockResolvedValue({
      ...configDefecto,
      frase: 'Bienvenida',
    });

    render(<TarjetaPantallaIngresoConfiguracion />);
    await waitFor(() => expect(screen.getByLabelText('Donuts de Halloween')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Frase de la pantalla'), { target: { value: '  Bienvenida  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar pantalla de ingreso/i }));

    expect(guardar).not.toHaveBeenCalled();
    expect(screen.getByText('¿Guardar la pantalla de ingreso?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sí, guardar/i }));

    await waitFor(() => {
      expect(guardar).toHaveBeenCalledWith({
        imagenes: [{ tipo: 'defecto', valor: 'fantasma-cafe.webp' }],
        frase: 'Bienvenida',
      });
    });
    expect(await screen.findByText(/Pantalla de ingreso actualizada/i)).toBeInTheDocument();
  });

  it('no guarda si no hay ninguna imagen elegida', async () => {
    vi.spyOn(pantallaIngresoApi, 'obtenerAdmin').mockResolvedValue({ ...configDefecto, imagenes: [] });

    render(<TarjetaPantallaIngresoConfiguracion />);
    await waitFor(() => expect(screen.getByTestId('tarjeta-pantalla-ingreso')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Guardar pantalla de ingreso/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Elige al menos una imagen/);
    expect(screen.queryByText('¿Guardar la pantalla de ingreso?')).not.toBeInTheDocument();
  });

  it('no permite una frase de más de 80 caracteres', async () => {
    vi.spyOn(pantallaIngresoApi, 'obtenerAdmin').mockResolvedValue(configDefecto);

    render(<TarjetaPantallaIngresoConfiguracion />);
    await waitFor(() => expect(screen.getByLabelText('Frase de la pantalla')).toBeInTheDocument());

    const campo = screen.getByLabelText('Frase de la pantalla');
    expect(campo).toHaveAttribute('maxLength', '80');
  });
});
