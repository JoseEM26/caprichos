import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CampoAyuda } from '../AyudaCampo';

describe('CampoAyuda', () => {
  const montar = () =>
    render(
      <CampoAyuda id="max-min" etiqueta="Mensajes por minuto" ayuda="Cuántos mensajes admite el bot." unidad="mensajes" rango="1 a 60" porDefecto="10" efecto="Al bajarlo se calla antes." ejemplo="Con 10 se calla al que mande 11.">
        <input type="number" />
      </CampoAyuda>,
    );

  it('muestra siempre la ayuda y la enlaza al input con aria-describedby', () => {
    montar();
    const input = screen.getByLabelText('Mensajes por minuto');
    expect(screen.getByText(/Cuántos mensajes admite/)).toBeVisible();
    expect(screen.getByText(/Unidad: mensajes · Rango: 1 a 60 · Por defecto: 10/)).toBeInTheDocument();
    expect(input.getAttribute('aria-describedby')).toContain('max-min-ayuda');
  });

  it('el botón ? despliega «Qué pasa si lo cambias»', () => {
    montar();
    const b = screen.getByRole('button', { name: /Qué pasa si cambias/ });
    expect(b).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Qué pasa si lo cambias')).not.toBeInTheDocument();
    fireEvent.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Qué pasa si lo cambias')).toBeInTheDocument();
    expect(screen.getByText(/Con 10 se calla/)).toBeInTheDocument();
    expect(screen.getByLabelText('Mensajes por minuto').getAttribute('aria-describedby')).toContain('max-min-efecto');
  });

  it('sin efecto ni ejemplo no pinta el botón y con cfgId marca el destino del buscador', () => {
    const { container } = render(
      <CampoAyuda id="x" etiqueta="X" ayuda="a" cfgId="chatbot-limite-spam"><input /></CampoAyuda>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('[data-cfg-id="chatbot-limite-spam"]')).not.toBeNull();
  });
});
