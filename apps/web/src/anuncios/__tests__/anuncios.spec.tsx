import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModalAnuncio } from '../ModalAnuncio';
import { AnunciosEmergentes } from '../AnunciosEmergentes';
import { tocaPorFrecuencia } from '../tipos';
import type { AnuncioPublico } from '../tipos';
import { api } from '../../comun/api';
import { aInputLima, atajoVigencia, deInputLima } from '../../admin/anuncios/anunciosApi';

const anuncio = (o: Partial<AnuncioPublico> = {}): AnuncioPublico => ({
  id: '1', plantilla: 'NOVEDAD', titulo: 'Hola Caprichos', texto: 'Texto', imagen: null, botonTexto: null, botonEnlace: null, detalle: null,
  color: 'CREMA', frecuencia: 'UNA_VEZ', vecesPorDia: 1, cadaHoras: null, cierreSegundos: 0, puedeCerrar: true, ...o,
});

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); window.localStorage.clear(); window.sessionStorage.clear(); });

describe('ModalAnuncio', () => {
  it('es un diálogo accesible con su título', () => {
    render(<ModalAnuncio anuncio={anuncio()} alCerrar={() => undefined} />);
    const d = screen.getByRole('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-labelledby')).toBe('anu-titulo');
    expect(screen.getByText('Hola Caprichos')).toBeTruthy();
  });

  it('se cierra solo tras los segundos indicados y muestra la barra', () => {
    vi.useFakeTimers();
    const alCerrar = vi.fn();
    render(<ModalAnuncio anuncio={anuncio({ cierreSegundos: 3 })} alCerrar={alCerrar} />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(alCerrar).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(alCerrar).toHaveBeenCalledTimes(1);
    expect(alCerrar).toHaveBeenCalledWith('AUTO');
  });

  it('con 0 segundos no se cierra solo ni hay barra', () => {
    vi.useFakeTimers();
    const alCerrar = vi.fn();
    render(<ModalAnuncio anuncio={anuncio({ cierreSegundos: 0 })} alCerrar={alCerrar} />);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(alCerrar).not.toHaveBeenCalled();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('se cierra a mano con la X y con Esc', () => {
    const alCerrar = vi.fn();
    const { unmount } = render(<ModalAnuncio anuncio={anuncio()} alCerrar={alCerrar} />);
    fireEvent.click(screen.getByLabelText('Cerrar anuncio'));
    expect(alCerrar).toHaveBeenCalledWith('MANUAL');
    unmount();
    const alCerrar2 = vi.fn();
    render(<ModalAnuncio anuncio={anuncio()} alCerrar={alCerrar2} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(alCerrar2).toHaveBeenCalledWith('MANUAL');
  });

  it('un comunicado que exige «Entendido» no tiene X, ni Esc, ni fondo; solo Entendido', () => {
    const alCerrar = vi.fn();
    render(<ModalAnuncio anuncio={anuncio({ plantilla: 'COMUNICADO_INTERNO', puedeCerrar: false })} alCerrar={alCerrar} />);
    expect(screen.queryByLabelText('Cerrar anuncio')).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByTestId('anuncio-fondo'));
    expect(alCerrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Entendido'));
    expect(alCerrar).toHaveBeenCalledWith('ENTENDIDO');
  });

  it('el botón del anuncio avisa con su enlace interno', () => {
    const alClic = vi.fn();
    render(<ModalAnuncio anuncio={anuncio({ botonTexto: 'Ver carta', botonEnlace: '/carta' })} alCerrar={() => undefined} alClicBoton={alClic} />);
    fireEvent.click(screen.getByText('Ver carta'));
    expect(alClic).toHaveBeenCalledWith('/carta');
  });

  it('las plantillas muestran sus datos propios', () => {
    render(<ModalAnuncio anuncio={anuncio({ plantilla: 'PROMOCION', detalle: { precio: 'S/ 19.90', cupon: 'DONA10' } })} alCerrar={() => undefined} />);
    expect(screen.getByText('S/ 19.90')).toBeTruthy();
    expect(screen.getByText('DONA10')).toBeTruthy();
  });
});

describe('frecuencia en el navegador (espejo de la API)', () => {
  const ahora = new Date('2026-11-18T15:00:00Z').getTime(); // 10:00 en Lima
  const base = { frecuencia: 'UNA_VEZ', vecesPorDia: 1, cadaHoras: null as number | null };
  it('UNA_VEZ, CADA_INGRESO, VECES_POR_DIA y CADA_N_HORAS', () => {
    expect(tocaPorFrecuencia(base, [], ahora)).toBe(true);
    expect(tocaPorFrecuencia(base, [ahora - 1e9], ahora)).toBe(false);
    expect(tocaPorFrecuencia({ ...base, frecuencia: 'CADA_INGRESO' }, [ahora], ahora)).toBe(true);
    const dos = { ...base, frecuencia: 'VECES_POR_DIA', vecesPorDia: 2 };
    expect(tocaPorFrecuencia(dos, [ahora - 3_600_000], ahora)).toBe(true);
    expect(tocaPorFrecuencia(dos, [ahora - 3_600_000, ahora - 7_200_000], ahora)).toBe(false);
    // 23:00 de ayer en Lima cae en «hoy» UTC pero no en «hoy» Lima
    expect(tocaPorFrecuencia(dos, [new Date('2026-11-18T04:00:00Z').getTime(), new Date('2026-11-18T04:30:00Z').getTime()], ahora)).toBe(true);
    const horas = { ...base, frecuencia: 'CADA_N_HORAS', cadaHoras: 4 };
    expect(tocaPorFrecuencia(horas, [ahora - 3 * 3_600_000], ahora)).toBe(false);
    expect(tocaPorFrecuencia(horas, [ahora - 5 * 3_600_000], ahora)).toBe(true);
  });
});

describe('AnunciosEmergentes (carta)', () => {
  beforeEach(() => { vi.spyOn(api, 'post').mockResolvedValue({ ok: true }); });
  const montar = (lista: AnuncioPublico[]) => {
    vi.spyOn(api, 'get').mockResolvedValue(lista);
    return render(<MemoryRouter><AnunciosEmergentes origen="CARTA" /></MemoryRouter>);
  };

  it('muestra el anuncio, registra la vista y no lo repite si era UNA_VEZ', async () => {
    const { unmount } = montar([anuncio()]);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/carta/anuncios/1/evento', { tipo: 'VISTA' });
    fireEvent.click(screen.getByLabelText('Cerrar anuncio'));
    expect(api.post).toHaveBeenCalledWith('/carta/anuncios/1/evento', { tipo: 'CIERRE' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    unmount();
    montar([anuncio()]);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('muestra uno tras otro y como máximo 3', async () => {
    montar([1, 2, 3, 4, 5].map((n) => anuncio({ id: String(n), titulo: `A${n}` })));
    for (const n of [1, 2, 3]) {
      expect(await screen.findByText(`A${n}`)).toBeTruthy();
      fireEvent.click(screen.getByLabelText('Cerrar anuncio'));
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('A4')).toBeNull();
  });
});

describe('fechas de Lima del formulario', () => {
  it('ida y vuelta con UTC-5', () => {
    expect(deInputLima('2026-11-18T10:00')).toBe('2026-11-18T15:00:00.000Z');
    expect(aInputLima('2026-11-18T15:00:00.000Z')).toBe('2026-11-18T10:00');
    expect(deInputLima('')).toBeNull();
  });
  it('atajos de vigencia', () => {
    const ahora = new Date('2026-11-18T15:00:00Z'); // miércoles 10:00 Lima
    expect(atajoVigencia('HOY', 1, ahora)).toEqual({ desde: '2026-11-18T10:00', hasta: '2026-11-18T23:59' });
    expect(atajoVigencia('HORAS', 3, ahora)).toEqual({ desde: '2026-11-18T10:00', hasta: '2026-11-18T13:00' });
    expect(atajoVigencia('DIAS', 3, ahora).hasta).toBe('2026-11-20T23:59');
    expect(atajoVigencia('SEMANA', 1, ahora).hasta).toBe('2026-11-24T23:59');
    expect(atajoVigencia('SIEMPRE', 1, ahora).hasta).toBe('');
  });
});
