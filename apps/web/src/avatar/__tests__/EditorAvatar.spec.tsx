import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Sin WebGL en jsdom: la escena 3D y las miniaturas se reemplazan por espías
const escenas: { reconstruir: ReturnType<typeof vi.fn>; accion: ReturnType<typeof vi.fn>; irA: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[] = [];
vi.mock('../escena', () => ({
  EscenaAvatar: class {
    reconstruir = vi.fn();
    accion = vi.fn();
    irA = vi.fn();
    dispose = vi.fn();
    constructor() {
      escenas.push(this);
    }
  },
  liberar: vi.fn(),
  luces: vi.fn(),
}));
vi.mock('../miniaturas', () => ({
  crearMiniaturas: () => ({
    pedir: vi.fn(),
    cancelar: vi.fn(),
    retrato: vi.fn(() => 'data:image/png;base64,AAAA'),
    dispose: vi.fn(),
  }),
}));
vi.mock('../../mascota/soporteWebGL', () => ({ tieneSoporteWebGL: () => true, prefiereMovimientoReducido: () => false }));

import EditorAvatar from '../EditorAvatar';
import { cargarAvatar } from '../piezas';
import { normalizar, porDefecto } from '../config';
import type { ConfigAvatar } from '../tipos';

const ultima = () => escenas[escenas.length - 1];
const ultimaConfig = (): ConfigAvatar => ultima().reconstruir.mock.calls.at(-1)![0];

function montar(guardar = vi.fn().mockResolvedValue(undefined)) {
  const cerrar = vi.fn();
  render(<EditorAvatar inicial={null} nombreCuenta="Lucía Pérez" guardar={guardar} cerrar={cerrar} />);
  return { guardar, cerrar };
}

describe('EditorAvatar', () => {
  beforeEach(() => {
    escenas.length = 0;
  });

  it('muestra las pestañas como tablist accesible y cambia de pestaña', () => {
    montar();
    const lista = screen.getByRole('tablist', { name: 'Partes del avatar' });
    expect(lista).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(10);
    fireEvent.click(screen.getByRole('tab', { name: /Arriba/ }));
    expect(screen.getByRole('tab', { name: /Arriba/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('cambiar una pieza reconstruye el avatar y marca cambios sin guardar', () => {
    montar();
    fireEvent.click(screen.getByRole('tab', { name: /Arriba/ }));
    const otra = screen.getAllByRole('button', { pressed: false }).find((b) => b.classList.contains('av-item'))!;
    const antes = ultimaConfig().arriba.id;
    fireEvent.click(otra);
    expect(ultimaConfig().arriba.id).toBe(otra.getAttribute('data-id'));
    expect(ultimaConfig().arriba.id).not.toBe(antes);
    expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument();
  });

  it('el color libre cambia el color de la pieza elegida', () => {
    montar();
    fireEvent.click(screen.getByRole('tab', { name: /Arriba/ }));
    const libre = screen.getAllByLabelText(/otro color/i)[0];
    fireEvent.change(libre, { target: { value: '#123456' } });
    expect(ultimaConfig().arriba.colores.principal).toBe('#123456');
  });

  it('deshacer y rehacer vuelven a la configuración anterior', () => {
    montar();
    const deshacer = screen.getByRole('button', { name: 'Deshacer' });
    expect(deshacer).toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: /Cuerpo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Hombre/ }));
    expect(ultimaConfig().genero).toBe('hombre');
    fireEvent.click(deshacer);
    expect(ultimaConfig().genero).toBe('mujer');
    fireEvent.click(screen.getByRole('button', { name: 'Rehacer' }));
    expect(ultimaConfig().genero).toBe('hombre');
  });

  it('guardar llama a la API con la configuración y el retrato', async () => {
    const { guardar } = montar();
    fireEvent.click(screen.getByRole('tab', { name: /Cuerpo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sorpresa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar avatar' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    const [config, retrato] = guardar.mock.calls[0];
    expect(config.expresion).toBe('sorpresa');
    expect(config.nombre).toBe('Lucía Pérez'.slice(0, 18));
    expect(retrato).toBe('data:image/png;base64,AAAA');
    expect(await screen.findByText(/quedó guardado/)).toBeInTheDocument();
  });

  it('«Mostrar mi avatar al entrar» viene encendido y se guarda apagado si se desmarca', async () => {
    const { guardar } = montar();
    const caja = screen.getByLabelText('Mostrar mi avatar al entrar');
    expect(caja).toBeChecked();
    fireEvent.click(caja);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar avatar' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    expect(guardar.mock.calls[0][0].mostrarAlEntrar).toBe(false);
  });

  it('si guardar falla muestra el error y no pierde los cambios', async () => {
    montar(vi.fn().mockRejectedValue(new Error('Sin conexión')));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar avatar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    expect(screen.getByRole('button', { name: 'Guardar avatar' })).not.toBeDisabled();
  });
});

describe('mascota del avatar', () => {
  const abrirMascotas = () => fireEvent.click(screen.getByRole('tab', { name: /Mascota/ }));
  const tarjeta = (id: string) => document.querySelector(`.av-item[data-id="${id}"]`) as HTMLElement;

  it('por defecto no hay mascota; elegir una la pone en la config y muestra nombre y colores', () => {
    montar();
    expect(ultimaConfig().mascota.id).toBe('ninguno');
    abrirMascotas();
    expect(screen.queryByLabelText(/Nombre de tu mascota/)).not.toBeInTheDocument();
    fireEvent.click(tarjeta('perro_cachorro'));
    expect(ultimaConfig().mascota.id).toBe('perro_cachorro');
    expect(screen.getByLabelText(/Nombre de tu mascota/)).toBeInTheDocument();
    expect(screen.getByText(/Colores de «Cachorro»/)).toBeInTheDocument();
    expect(ultima().irA).toHaveBeenCalledWith('mascota');
  });

  it('cambia el color (paleta y libre) y el nombre, que se corta a 14 letras', () => {
    montar();
    abrirMascotas();
    fireEvent.click(tarjeta('gato'));
    fireEvent.click(screen.getAllByRole('button', { name: /Color principal #/ })[0]);
    expect(ultimaConfig().mascota.colores.principal).toMatch(/^#[0-9A-F]{6}$/i);
    fireEvent.change(screen.getAllByLabelText(/Detalles: otro color/i)[0], { target: { value: '#123456' } });
    expect(ultimaConfig().mascota.colores.acento).toBe('#123456');
    const nombre = screen.getByLabelText(/Nombre de tu mascota/) as HTMLInputElement;
    expect(nombre.maxLength).toBe(14);
    fireEvent.change(nombre, { target: { value: 'Michi' } });
    expect(ultimaConfig().mascota.nombre).toBe('Michi');
    expect(ultimaConfig().mascota.colores.acento).toBe('#123456');
  });

  it('cambiar de mascota conserva el nombre y «Sin mascota» la quita', () => {
    montar();
    abrirMascotas();
    fireEvent.click(tarjeta('gato'));
    fireEvent.change(screen.getByLabelText(/Nombre de tu mascota/), { target: { value: 'Luna' } });
    fireEvent.click(tarjeta('conejo'));
    expect(ultimaConfig().mascota).toMatchObject({ id: 'conejo', nombre: 'Luna' });
    fireEvent.click(tarjeta('ninguno'));
    expect(ultimaConfig().mascota.id).toBe('ninguno');
    expect(screen.queryByLabelText(/Nombre de tu mascota/)).not.toBeInTheDocument();
  });

  it('el interruptor «Usar mi avatar como foto de perfil» queda en la config que se guarda', async () => {
    const { guardar } = montar();
    const sw = screen.getByRole('switch', { name: /Usar mi avatar como foto de perfil/ });
    expect(sw).not.toBeChecked();
    fireEvent.click(sw);
    expect(ultimaConfig().usarComoFoto).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar avatar' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    expect(guardar.mock.calls[0][0].usarComoFoto).toBe(true);
  });
});

describe('construir con mascota', () => {
  const A = cargarAvatar();
  const base = () => normalizar(A, null, 'Ana');

  it('todas las mascotas del catálogo se construyen con su grupo, animan sin romper y miran a +z', () => {
    const ids = A.REG.mascota.filter((d) => d.id !== 'ninguno').map((d) => d.id);
    expect(ids.length).toBeGreaterThanOrEqual(16);
    for (const id of ids) {
      const p = A.construir({ ...base(), mascota: { id, colores: {}, nombre: 'Rex' } });
      expect(p.mascota, id).toBeDefined();
      expect(p.mascota!.children.length, id).toBeGreaterThan(3);
      expect(p.raiz.children).toContain(p.mascota);
      expect(p.mascota!.position.x, id).toBeGreaterThan(0.4);
      expect(() => { p.animar(1, 0.03); p.mascotaAlegrar?.(1); p.animar(1.5, 0.03); }, id).not.toThrow();
    }
  });

  it('las voladoras flotan a la altura del hombro y las de piso quedan en el piso', () => {
    const vuela = A.construir({ ...base(), mascota: { id: 'dragon', colores: {}, nombre: '' } });
    expect(vuela.mascota!.userData.volador).toBe(true);
    expect(vuela.mascota!.userData.base).toBeGreaterThan(0.8);
    const piso = A.construir({ ...base(), mascota: { id: 'perro_cachorro', colores: {}, nombre: '' } });
    expect(piso.mascota!.userData.base).toBe(0);
  });

  it('«ninguno», sin campo o con un id desconocido no agrega nada', () => {
    expect(A.construir({ ...base(), mascota: { id: 'ninguno', colores: {}, nombre: '' } }).mascota).toBeUndefined();
    const sin = { ...base() } as Partial<ConfigAvatar>;
    delete sin.mascota;
    expect(A.construir(sin).mascota).toBeUndefined();
    expect(A.construir({ ...base(), mascota: { id: 'no_existe', colores: {}, nombre: '' } }).mascota).toBeUndefined();
  });

  it('los colores elegidos se aplican a la mascota', () => {
    const p = A.construir({ ...base(), mascota: { id: 'conejo', colores: { principal: '#112233' }, nombre: '' } });
    const colores: string[] = [];
    p.mascota!.traverse((o) => { const m = (o as import('three').Mesh).material as import('three').MeshStandardMaterial | undefined; if (m?.color) colores.push(m.color.getHexString()); });
    expect(colores).toContain('112233');
  });
});

describe('normalizar: mascota y foto', () => {
  const A = cargarAvatar();
  it('un avatar guardado antes (sin mascota) queda sin mascota, y una mascota que ya no existe se descarta', () => {
    const viejo = { ...porDefecto(A, 'Ana') } as Partial<ConfigAvatar>;
    delete viejo.mascota;
    expect(normalizar(A, viejo, 'Ana').mascota).toEqual({ id: 'ninguno', colores: {}, nombre: '' });
    expect(normalizar(A, { ...viejo, mascota: { id: 'ya_no_esta', colores: {}, nombre: 'X' } }, 'Ana').mascota.id).toBe('ninguno');
  });
  it('conserva la mascota válida, corta el nombre a 14 y lee usarComoFoto', () => {
    const c = normalizar(A, { ...porDefecto(A, 'Ana'), mascota: { id: 'panda', colores: { acento: '#FF0000' }, nombre: 'Nombremuylargodeverdad' }, usarComoFoto: true }, 'Ana');
    expect(c.mascota).toEqual({ id: 'panda', colores: { acento: '#FF0000' }, nombre: 'Nombremuylargo' });
    expect(c.usarComoFoto).toBe(true);
  });
});

describe('catálogo de piezas', () => {
  it('todas las piezas y colores caben en lo que valida el servidor', () => {
    const A = cargarAvatar();
    for (const [cat, defs] of Object.entries(A.REG)) {
      for (const d of defs) {
        expect(d.id, `${cat}/${d.id}`).toMatch(/^[a-z0-9_]{1,40}$/);
        for (const slot of d.colores) expect(['principal', 'secundario', 'acento'], `${cat}/${d.id}`).toContain(slot);
        for (const v of Object.values(d.porDefecto ?? {})) if (typeof v === 'string' && v.startsWith('#')) expect(v).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
});
