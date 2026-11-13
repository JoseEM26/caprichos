import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SorteoEnVivo, type ParticipanteSorteo } from './SorteoEnVivo';

const gente: ParticipanteSorteo[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  nombre: `Cliente ${i}`,
  detalle: `···${100 + i}`,
}));
const cero = () => 0; // rng determinista

afterEach(() => vi.useRealTimers());

// Las animaciones encadenan efectos: se avanza el reloj de a poco para que React los vaya armando.
function correr() {
  for (let i = 0; i < 300; i++) act(() => void vi.advanceTimersByTime(200));
}

function montar(extra: Partial<Parameters<typeof SorteoEnVivo>[0]> = {}) {
  const alCerrar = vi.fn();
  render(
    <SorteoEnVivo participantes={gente} filtrosTexto="compraron este mes" alCerrar={alCerrar} azar={cero} factorTiempo={0.05} {...extra} />,
  );
  return alCerrar;
}

describe('SorteoEnVivo', () => {
  it('intro: cuenta, filtros y 5 juegos', () => {
    montar();
    expect(screen.getByRole('dialog', { name: 'Sorteo en vivo' })).toBeTruthy();
    expect(screen.getByText(/compraron este mes/)).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('sin participantes: mensaje y sin botón de empezar', () => {
    montar({ participantes: [] });
    expect(screen.getByText(/Todavía no hay clientes/)).toBeTruthy();
    expect(screen.queryByText('¡Empezar sorteo!')).toBeNull();
  });

  it.each(['Tómbola', 'Ruleta', 'Eliminación', 'El N-ésimo gana', 'Varios ganadores'])('%s llega a un ganador', (juego) => {
    vi.useFakeTimers();
    montar();
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(juego) }));
    fireEvent.click(screen.getByText('¡Empezar sorteo!'));
    correr();
    expect(screen.getByText(/¡Tenemos ganador/)).toBeTruthy();
    expect(screen.getByText('Otra vez')).toBeTruthy();
    expect(screen.getByText('Ganadores de hoy')).toBeTruthy();
  });

  it('sin repetir: el siguiente sorteo no repite y Cerrar pide confirmación con resultado', () => {
    vi.useFakeTimers();
    const alCerrar = montar();
    fireEvent.click(screen.getByText('¡Empezar sorteo!'));
    correr();
    expect(screen.getAllByText('Cliente 0').length).toBeGreaterThan(0); // rng=0 elige el primero
    fireEvent.click(screen.getByText('Otra vez'));
    correr();
    expect(screen.getAllByText('Cliente 1').length).toBeGreaterThan(0); // el 0 ya salió
    fireEvent.click(screen.getByText('Cerrar'));
    expect(alCerrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sí'));
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it('Cerrar desde la intro cierra directo', () => {
    const alCerrar = montar();
    fireEvent.click(screen.getByText('Cerrar'));
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
});
