import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CocinaAdminView, elegirAreaInicial } from '../CocinaAdminView';
import * as cocinaApi from '../cocinaApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import type { AreaCocina } from '../cocinaTipos';

vi.mock('../audioAlerta', () => ({
  reproducirCampanaCocina: vi.fn(),
  estaSilenciado: vi.fn().mockReturnValue(false),
  setSilenciado: vi.fn(),
}));

const LISTA: AreaCocina[] = [
  { id: '1', nombre: 'Cocina' },
  { id: '2', nombre: 'Bebidas' },
  { id: '3', nombre: 'Postres' },
];

describe('elegirAreaInicial (función pura)', () => {
  it('abre en el área recordada si sigue en la lista', () => {
    expect(elegirAreaInicial(LISTA, '2')).toBe('2');
  });

  it('si la recordada ya no existe, abre en la primera', () => {
    expect(elegirAreaInicial(LISTA, '9')).toBe('1');
  });

  it('sin recuerdo, abre en la primera', () => {
    expect(elegirAreaInicial(LISTA, null)).toBe('1');
  });

  it('sin áreas devuelve cadena vacía', () => {
    expect(elegirAreaInicial([], '2')).toBe('');
  });

  it('con áreas permitidas, la recordada solo cuenta si está permitida', () => {
    expect(elegirAreaInicial(LISTA, '2', ['2', '3'])).toBe('2');
    expect(elegirAreaInicial(LISTA, '1', ['2', '3'])).toBe('2');
  });

  it('con áreas permitidas y sin recuerdo, abre en la primera permitida', () => {
    expect(elegirAreaInicial(LISTA, null, ['3', '2'])).toBe('2');
  });

  it('con áreas permitidas que no existen en la lista, devuelve cadena vacía', () => {
    expect(elegirAreaInicial(LISTA, '2', ['9'])).toBe('');
  });

  it('con lista de áreas permitidas vacía, se consideran todas', () => {
    expect(elegirAreaInicial(LISTA, null, [])).toBe('1');
  });
});

describe('CocinaAdminView recuerda el área elegida', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Jefe de Cocina', rol: 'ADMIN' },
      permisos: ['*'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    } as any);

    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue(LISTA);
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({ activa: false, minutos: 0, pausa: false });
    vi.spyOn(cocinaApi, 'obtenerAjustesCocina').mockResolvedValue({ confirmarDespejar: true } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const montar = () =>
    render(
      <BrowserRouter>
        <CocinaAdminView />
      </BrowserRouter>,
    );

  it('elige Bebidas, se desmonta, se vuelve a montar y abre en Bebidas', async () => {
    const { unmount } = montar();
    await waitFor(() => expect(cocinaApi.listarComandasArea).toHaveBeenCalledWith('1'));

    fireEvent.click(screen.getByRole('button', { name: /^Área: / }));
    fireEvent.click(screen.getByRole('option', { name: 'Bebidas' }));
    await waitFor(() => expect(cocinaApi.listarComandasArea).toHaveBeenLastCalledWith('2'));
    expect(localStorage.getItem('caprichos.cocina.area.1')).toBe('2');

    unmount();
    vi.mocked(cocinaApi.listarComandasArea).mockClear();

    montar();
    await waitFor(() => expect(cocinaApi.listarComandasArea).toHaveBeenCalledWith('2'));
    expect(cocinaApi.listarComandasArea).not.toHaveBeenCalledWith('1');
    expect(screen.getByRole('button', { name: 'Área: Bebidas' })).toBeInTheDocument();
  });

  it('sin localStorage la pantalla funciona y abre en la primera área', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denegado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denegado');
    });

    montar();
    await waitFor(() => expect(cocinaApi.listarComandasArea).toHaveBeenCalledWith('1'));

    fireEvent.click(screen.getByRole('button', { name: /^Área: / }));
    fireEvent.click(screen.getByRole('option', { name: 'Bebidas' }));
    await waitFor(() => expect(cocinaApi.listarComandasArea).toHaveBeenLastCalledWith('2'));
  });
});
