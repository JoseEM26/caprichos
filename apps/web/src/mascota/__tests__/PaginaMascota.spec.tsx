import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaginaMascota } from '../PaginaMascota';
import { ESTADOS_CAPRI } from '../animaciones';

describe('PaginaMascota.tsx', () => {
  it('renderiza la cabecera y el visor principal', () => {
    render(<PaginaMascota />);

    expect(screen.getByText('Capri - Mascota Oficial de Caprichos')).toBeInTheDocument();
    expect(screen.getByText(/Vista previa interna/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Capri, la asistente de Caprichos' })).toBeInTheDocument();
  });

  it('renderiza botones para todos los estados de animación y permite conmutar', () => {
    render(<PaginaMascota />);

    ESTADOS_CAPRI.forEach((estado) => {
      const boton = screen.getByRole('button', { name: new RegExp(estado, 'i') });
      expect(boton).toBeInTheDocument();

      fireEvent.click(boton);
      expect(screen.getByText(new RegExp(`Estado actual: ${estado}`, 'i'))).toBeInTheDocument();
    });
  });

  it('permite alternar el interruptor forzar 2D', () => {
    render(<PaginaMascota />);

    const botonToggle = screen.getByRole('button', { name: /Forzar Fallback 2D/i });
    expect(botonToggle).toBeInTheDocument();

    fireEvent.click(botonToggle);
    expect(screen.getByRole('button', { name: /Conmutar a 3D/i })).toBeInTheDocument();
  });

  it('no contiene ningún emoji en los textos, botones o descripciones', () => {
    const { container } = render(<PaginaMascota />);
    const textoCompleto = container.textContent || '';

    // Expresión regular que detecta caracteres de emojis
    const regexEmoji =
      /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

    const coincidencias = textoCompleto.match(regexEmoji);
    expect(coincidencias).toBeNull();
  });
});
