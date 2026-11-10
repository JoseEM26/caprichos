import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AyudaCapri, ID_SLOT_CAPRI } from '../AyudaCapri';

vi.mock('../ayudaApi', () => ({
  obtenerContextoAyuda: vi.fn().mockResolvedValue({ activo: true, modulo: 'caja', titulo: 'Caja', rolUsuario: 'Admin', sugerencias: [], enlaces: [] }),
  enviarPreguntaAyuda: vi.fn(),
}));

async function montar() {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/admin/caja']}>
        <div data-testid="barra"><span id={ID_SLOT_CAPRI} /></div>
        <AyudaCapri />
      </MemoryRouter>,
    );
  });
}
const abrirBarra = () => screen.getByRole('button', { name: 'Abrir ayuda de Capri' });

beforeEach(() => localStorage.clear());

describe('Capri minimizada en la barra superior', () => {
  it('minimizada aparece dentro de la barra y no flota', async () => {
    localStorage.setItem('capri_minimizada', '1');
    await montar();
    expect(abrirBarra().closest('[data-testid="barra"]')).not.toBeNull();
    expect(document.querySelector('.ayuda-mini-wrap')).toBeNull();
    expect(document.querySelector('.ayuda-fab-wrap')).toBeNull();
  });

  it('al tocarla abre la ayuda; «Dejar flotante» la maximiza y persiste', async () => {
    localStorage.setItem('capri_minimizada', '1');
    await montar();
    fireEvent.click(abrirBarra());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dejar flotante/i }));
    expect(localStorage.getItem('capri_minimizada')).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: /cerrar la ayuda/i }));
    expect(document.querySelector('.ayuda-fab-wrap')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Abrir ayuda de Capri' })).toBeNull();
  });

  it('«Ocultar por ahora» la manda a la barra y lo recuerda', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: /abrir la ayuda de capri/i }));
    fireEvent.click(screen.getByRole('button', { name: /ocultar por ahora/i }));
    expect(localStorage.getItem('capri_minimizada')).toBe('1');
    expect(abrirBarra().closest('[data-testid="barra"]')).not.toBeNull();
  });
});
