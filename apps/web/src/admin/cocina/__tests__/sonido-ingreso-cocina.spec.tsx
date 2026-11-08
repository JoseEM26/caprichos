import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import * as socketModulo from '../../../comun/socket';
import * as audioAlerta from '../audioAlerta';
import {
  BannerIngresoCocina,
  ControlSonidoCocina,
  useIngresoCocina,
  SEGUNDOS_AVISO,
} from '../AvisoIngresoCocina';
import {
  activarAudioCocina,
  crearDedupe,
  debeAvisar,
  estadoAudioCocina,
  guardarVolumen,
  leerVolumen,
  reiniciarAudioCocina,
  tocarTimbreCocina,
} from '../sonidoCocina';

vi.mock('../audioAlerta', () => ({
  estaSilenciado: vi.fn().mockReturnValue(false),
  setSilenciado: vi.fn(),
  reproducirCampanaCocina: vi.fn(),
}));

/** AudioContext simulado: cuenta osciladores y registra tipo, frecuencias y picos de ganancia. */
let creados: Array<{ tipo: string; freq: number[]; pico: number; inicio: number; fin: number }>;
let estadoInicial: 'suspended' | 'running';
let resumeLlamadas: number;
class FakeAudioContext {
  state: string = estadoInicial;
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {
    resumeLlamadas++;
    this.state = 'running';
  });
  createGain() {
    const g: any = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn((v: number) => (g.pico = v)), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
    return g;
  }
  createOscillator() {
    const o: any = { type: '', freq: [] as number[], frequency: { setValueAtTime: (f: number) => o.freq.push(f) }, connect: (g: any) => (o.g = g), start: (t: number) => (o.t0 = t), stop: (t: number) => (o.t1 = t) };
    creados.push(
      new Proxy({} as any, {
        get: (_t, k) => (k === 'tipo' ? o.type : k === 'freq' ? o.freq : k === 'pico' ? o.g?.pico : k === 'inicio' ? o.t0 : o.t1),
      }),
    );
    return o;
  }
}

beforeEach(() => {
  creados = [];
  resumeLlamadas = 0;
  estadoInicial = 'suspended';
  reiniciarAudioCocina();
  (window as any).AudioContext = FakeAudioContext;
  localStorage.clear();
  vi.mocked(audioAlerta.estaSilenciado).mockReturnValue(false);
});
afterEach(() => {
  delete (window as any).AudioContext;
  vi.restoreAllMocks();
});

describe('timbre de cocina (WebAudio)', () => {
  it('NUEVO: tres tonos ascendentes de onda cuadrada, ~1.2 s, sin pasar de 0.8', async () => {
    estadoInicial = 'running';
    expect(await tocarTimbreCocina('NUEVO', 'maximo')).toBe(true);
    expect(creados).toHaveLength(3);
    expect(creados.map((o) => o.tipo)).toEqual(['square', 'square', 'square']);
    const f = creados.map((o) => o.freq[0]);
    expect(f[0]).toBeLessThan(f[1]);
    expect(f[1]).toBeLessThan(f[2]);
    expect(Math.max(...creados.map((o) => o.pico))).toBeLessThanOrEqual(0.8);
    expect(creados[2].fin - creados[0].inicio).toBeGreaterThan(1.1);
    expect(creados[2].fin - creados[0].inicio).toBeLessThan(1.4);
  });

  it('EXTRA y DEVUELTO usan un patrón distinto y más corto (dos tonos)', async () => {
    estadoInicial = 'running';
    await tocarTimbreCocina('NUEVO');
    const nuevo = creados.map((o) => o.freq[0]);
    creados = [];
    await tocarTimbreCocina('EXTRA');
    expect(creados).toHaveLength(2);
    expect(creados.map((o) => o.freq[0])).not.toEqual(nuevo.slice(0, 2));
    expect(creados[1].fin).toBeLessThan(0.7);
  });

  it('el volumen cambia el pico: Bajo < Medio < Alto < Máximo', async () => {
    estadoInicial = 'running';
    const picos: number[] = [];
    for (const v of ['bajo', 'medio', 'alto', 'maximo'] as const) {
      creados = [];
      await tocarTimbreCocina('EXTRA', v);
      picos.push(creados[0].pico);
    }
    expect([...picos].sort((a, b) => a - b)).toEqual(picos);
    expect(new Set(picos).size).toBe(4);
  });

  it('autoplay: suspendido no suena hasta un gesto; activarAudioCocina hace resume y entonces suena', async () => {
    estadoInicial = 'suspended';
    // el resume del contexto simulado "falla" en silencio hasta el gesto
    expect(estadoAudioCocina()).toBe('bloqueado');
    expect(await activarAudioCocina()).toBe(true);
    expect(resumeLlamadas).toBe(1);
    expect(estadoAudioCocina()).toBe('listo');
    expect(await tocarTimbreCocina('NUEVO')).toBe(true);
  });

  it('un resume rechazado devuelve false sin lanzar', async () => {
    (window as any).AudioContext = class extends FakeAudioContext {
      resume = vi.fn(async () => {
        throw new Error('bloqueado');
      });
    };
    expect(await tocarTimbreCocina('NUEVO')).toBe(false);
    expect(await activarAudioCocina()).toBe(false);
  });

  it('sin WebAudio no revienta', async () => {
    delete (window as any).AudioContext;
    reiniciarAudioCocina();
    expect(estadoAudioCocina()).toBe('sin-soporte');
    expect(await tocarTimbreCocina('NUEVO')).toBe(false);
  });

  it('volumen: predeterminado Alto, se guarda y sobrevive a un localStorage que falla', () => {
    expect(leerVolumen()).toBe('alto');
    guardarVolumen('medio');
    expect(leerVolumen()).toBe('medio');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sin storage');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sin storage');
    });
    expect(leerVolumen()).toBe('alto');
    expect(() => guardarVolumen('bajo')).not.toThrow();
  });

  it('dedupe: misma clave dentro de 10 s no pasa; fuera de la ventana sí', () => {
    let t = 1000;
    const nuevo = crearDedupe(10_000, () => t);
    expect(nuevo('1:2:NUEVO')).toBe(true);
    expect(nuevo('1:2:NUEVO')).toBe(false);
    expect(nuevo('1:2:EXTRA')).toBe(true);
    t += 10_500;
    expect(nuevo('1:2:NUEVO')).toBe(true);
  });

  it('filtro por área: el área elegida solo avisa de la suya; «Todas» avisa de cualquiera', () => {
    expect(debeAvisar({ areaId: 1 }, '1')).toBe(true);
    expect(debeAvisar({ areaId: 2 }, '1')).toBe(false);
    expect(debeAvisar({ areaId: 2 }, '')).toBe(true);
  });
});

describe('aviso de ingreso en pantalla', () => {
  let emitir: (ev: any) => void;
  function Arnes({ area = '', activo = true }: { area?: string; activo?: boolean }) {
    const { avisos, descartar } = useIngresoCocina(area, activo);
    return <BannerIngresoCocina avisos={avisos} onDescartar={descartar} />;
  }
  const ev = (o: any = {}) => ({ pedidoId: 1, codigo: 'CP-W113', areaId: 1, areaNombre: 'Bebidas', cliente: 'Ana', tipo: 'NUEVO', ...o });

  beforeEach(() => {
    vi.useFakeTimers();
    estadoInicial = 'running';
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(((evento: string, cb: any) => {
      if (evento === 'cocina:ingreso') emitir = cb;
    }) as any);
  });
  afterEach(() => vi.useRealTimers());

  it('muestra «NUEVO PEDIDO CP-W113 · BEBIDAS» con cliente, role=alert y aria-live assertive, y suena', async () => {
    render(<Arnes />);
    await act(async () => emitir(ev()));
    const region = screen.getByRole('alert');
    expect(region).toHaveAttribute('aria-live', 'assertive');
    expect(region.textContent).toContain('NUEVO PEDIDO CP-W113 · BEBIDAS');
    expect(region.textContent).toContain('Ana');
    expect(creados.length).toBe(3);
  });

  it('un pedido solo de Salados no avisa ni suena en la pantalla de Bebidas; sin área (Todas) sí', async () => {
    const { unmount } = render(<Arnes area="1" />);
    await act(async () => emitir(ev({ areaId: 2, areaNombre: 'Salados' })));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(creados.length).toBe(0);
    unmount();
    render(<Arnes area="" />);
    await act(async () => emitir(ev({ areaId: 2, areaNombre: 'Salados' })));
    expect(screen.getByRole('alert').textContent).toContain('SALADOS');
  });

  it('el mismo ingreso repetido en 10 s no duplica aviso ni sonido', async () => {
    render(<Arnes />);
    await act(async () => emitir(ev()));
    await act(async () => emitir(ev()));
    expect(screen.queryByText(/\+1 nuevos/)).toBeNull();
    expect(creados.length).toBe(3);
  });

  it('varios pedidos seguidos se apilan con contador «+2 nuevos» y no se pierde ninguno', async () => {
    render(<Arnes />);
    await act(async () => emitir(ev({ pedidoId: 1, codigo: 'CP-1' })));
    await act(async () => emitir(ev({ pedidoId: 2, codigo: 'CP-2' })));
    await act(async () => emitir(ev({ pedidoId: 3, codigo: 'CP-3' })));
    expect(screen.getByRole('alert').textContent).toContain('CP-1');
    expect(screen.getByText('+2 nuevos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /CP-1/ }));
    expect(screen.getByRole('alert').textContent).toContain('CP-2');
    expect(screen.getByText('+1 nuevos')).toBeInTheDocument();
  });

  it('desaparece solo a los 8 s', async () => {
    render(<Arnes />);
    await act(async () => emitir(ev()));
    expect(screen.getByRole('alert').textContent).not.toBe('');
    await act(async () => {
      vi.advanceTimersByTime(SEGUNDOS_AVISO * 1000 + 50);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('silenciado: avisa en pantalla pero no suena', async () => {
    vi.mocked(audioAlerta.estaSilenciado).mockReturnValue(true);
    render(<Arnes />);
    await act(async () => emitir(ev()));
    expect(screen.getByRole('alert').textContent).toContain('CP-W113');
    expect(creados.length).toBe(0);
  });

  it('activo=false (Despacho/Historial/otras pantallas): ni aviso ni sonido', async () => {
    render(<Arnes activo={false} />);
    await act(async () => emitir(ev()));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(creados.length).toBe(0);
  });

  it('EXTRA y DEVUELTO se rotulan distinto y suenan con el patrón corto', async () => {
    render(<Arnes />);
    await act(async () => emitir(ev({ tipo: 'DEVUELTO' })));
    expect(screen.getByRole('alert').textContent).toContain('DEVUELTO AL ÁREA');
    expect(creados.length).toBe(2);
  });
});

describe('control de sonido', () => {
  it('cambia el volumen (guardado), prueba el timbre y muestra «Activar sonido» si está bloqueado', async () => {
    estadoInicial = 'running';
    const onActivar = vi.fn();
    render(<ControlSonidoCocina bloqueado onActivar={onActivar} />);
    fireEvent.change(screen.getByLabelText(/Volumen del timbre/i), { target: { value: 'maximo' } });
    expect(leerVolumen()).toBe('maximo');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Probar timbre/i })));
    expect(creados.length).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: /Activar sonido/i }));
    expect(onActivar).toHaveBeenCalled();
  });
});
