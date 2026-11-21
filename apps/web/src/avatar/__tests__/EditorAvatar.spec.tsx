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
    expect(screen.getAllByRole('tab')).toHaveLength(9);
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
