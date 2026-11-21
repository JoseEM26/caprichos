import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../comun/api';
import { PantallaLocal } from '../PantallaLocal';
import { agrupar, nuevosListos, fusionarConSalida, textoGlobo, textoVoz, temaPantalla, type PedidoPantalla } from '../logica';

// La mascota real usa three/WebGL: aquí basta saber que se dibuja con su estado.
vi.mock('../../mascota/MascotaCapri', () => ({
  MascotaCapri: ({ estado }: { estado: string }) => <div data-testid="capri" data-estado={estado} />,
}));
vi.mock('../../mascota/useAspectoCapri', () => ({ useAspectoCapri: () => ({ tema: 'normal', aspecto: {}, escala: 1, cargando: false }) }));

const ped = (o: Partial<PedidoPantalla>): PedidoPantalla => ({
  codigo: 'CP-W945', estado: 'PREPARANDO', modalidad: 'COMER_LOCAL', minutos: 4, nombre: 'Lucía', avatarUrl: null, ...o,
});

describe('lógica de la pantalla', () => {
  it('agrupa por modalidad y estado', () => {
    const g = agrupar([ped({}), ped({ codigo: 'B', estado: 'LISTO' }), ped({ codigo: 'C', modalidad: 'LLEVAR' }), ped({ codigo: 'D', modalidad: 'LLEVAR', estado: 'LISTO' })]);
    expect(g.local.preparando.map((p) => p.codigo)).toEqual(['CP-W945']);
    expect(g.local.listos.map((p) => p.codigo)).toEqual(['B']);
    expect(g.llevar.preparando.map((p) => p.codigo)).toEqual(['C']);
    expect(g.llevar.listos.map((p) => p.codigo)).toEqual(['D']);
  });

  it('detecta solo los que pasan a listo y no anuncia en la primera lectura', () => {
    const antes = [ped({}), ped({ codigo: 'X', estado: 'LISTO' })];
    const ahora = [ped({ estado: 'LISTO' }), ped({ codigo: 'X', estado: 'LISTO' })];
    expect(nuevosListos(null, ahora)).toEqual([]);
    expect(nuevosListos(antes, ahora).map((p) => p.codigo)).toEqual(['CP-W945']);
  });

  it('marca como saliendo lo que ya no viene', () => {
    const r = fusionarConSalida([ped({}), ped({ codigo: 'Z' })], [ped({})]);
    expect(r.find((p) => p.codigo === 'Z')?.saliendo).toBe(true);
    expect(r.find((p) => p.codigo === 'CP-W945')?.saliendo).toBeUndefined();
  });

  it('textos del globo y la voz, con y sin nombre; temas conocidos', () => {
    expect(textoGlobo(ped({}))).toBe('¡Lucía! Tu pedido CP-W945 está listo');
    expect(textoGlobo(ped({ nombre: null }))).toBe('¡Pedido CP-W945 listo!');
    expect(textoVoz(ped({}))).toBe('Lucía, tu pedido C P W 9 4 5 está listo');
    expect(temaPantalla('navidad')).toBe('navidad');
    expect(temaPantalla('verano')).toBe('normal');
  });
});

describe('PantallaLocal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const montar = (url = '/pantalla-local') =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <PantallaLocal />
      </MemoryRouter>,
    );
  const avanzar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  it('muestra cada pedido en su columna y, al pasar a listo, anima y Capri avisa con el globo', async () => {
    const get = vi.spyOn(api, 'get');
    get.mockResolvedValueOnce({ pedidos: [ped({}), ped({ codigo: 'CP-L1', modalidad: 'LLEVAR', nombre: 'Marco' })], mostrarNombre: true, ahora: '' });
    montar();
    await avanzar(10);
    expect(screen.getByTestId('pedido-CP-W945')).toHaveClass('entra');
    expect(screen.getByTestId('pedido-CP-L1')).toBeInTheDocument();
    expect(screen.queryByTestId('globo-capri')).toBeNull();

    get.mockResolvedValue({ pedidos: [ped({ estado: 'LISTO' }), ped({ codigo: 'CP-L1', modalidad: 'LLEVAR', nombre: 'Marco' })], mostrarNombre: true, ahora: '' });
    await avanzar(5100);
    expect(screen.getByTestId('pedido-CP-W945')).toHaveClass('listo');
    expect(screen.getByTestId('globo-capri')).toHaveTextContent('¡Lucía! Tu pedido CP-W945 está listo');
    expect(screen.getByTestId('capri')).toHaveAttribute('data-estado', 'contento');
  });

  it('con el nombre apagado en el servidor no se ve ningún nombre', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ pedidos: [ped({ nombre: null })], mostrarNombre: false, ahora: '' });
    montar();
    await avanzar(10);
    expect(screen.getByTestId('pedido-CP-W945')).toBeInTheDocument();
    expect(screen.queryByText('Lucía')).toBeNull();
  });

  it('el parámetro ?tema= cambia la temática', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ pedidos: [], mostrarNombre: true, ahora: '' });
    montar('/pantalla-local?tema=halloween');
    await avanzar(10);
    expect(screen.getByTestId('pantalla-local')).toHaveAttribute('data-tema', 'halloween');
  });

  it('un pedido que desaparece sale con animación y luego se quita', async () => {
    const get = vi.spyOn(api, 'get');
    get.mockResolvedValueOnce({ pedidos: [ped({})], mostrarNombre: true, ahora: '' });
    montar();
    await avanzar(10);
    get.mockResolvedValue({ pedidos: [], mostrarNombre: true, ahora: '' });
    await avanzar(5000);
    expect(screen.getByTestId('pedido-CP-W945')).toHaveClass('sale');
    await avanzar(800);
    expect(screen.queryByTestId('pedido-CP-W945')).toBeNull();
  });
});
