import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MisPedidosView } from '../MisPedidosView';
import { salonApi } from '../api';
import { api } from '../../../comun/api';
import { listarPersonalActivo } from '../../creditos/creditosApi';

// Permisos del usuario de prueba: cada test cambia esta lista
let permisos: string[] = [];
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ tiene: (p: string) => permisos.includes(p) }),
}));
vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }),
}));
vi.mock('../api', () => ({
  salonApi: {
    misPedidos: vi.fn(),
    obtenerMesas: vi.fn(),
    obtenerPlano: vi.fn(),
    obtenerCarta: vi.fn(),
    abrirPedidoMesa: vi.fn(),
  },
}));
vi.mock('../../../comun/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../creditos/creditosApi', () => ({ listarPersonalActivo: vi.fn() }));
vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));

const respuestaVacia = { pedidos: [], resumen: { cantidad: 0, total: 0, enCurso: 0, entregados: 0 } };
const pisos = [{ id: '1', nombre: 'Piso 1', activo: true, mesas: [] }];

const abrirNuevo = () => fireEvent.click(screen.getByRole('button', { name: 'Nuevo pedido' }));

describe('Mis pedidos: Nuevo pedido se ve en Salón y en Lista', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permisos = ['mesas/ver', 'mesas/abrir', 'pedidos/crear', 'creditos/ver'];
    localStorage.clear();
    vi.mocked(salonApi.misPedidos).mockResolvedValue(respuestaVacia as any);
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos } as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue({ categorias: [] } as any);
    vi.mocked(api.get).mockResolvedValue({ items: [] } as any);
    vi.mocked(listarPersonalActivo).mockResolvedValue([]);
  });

  it('en modo Salón, Nuevo pedido abre el selector «¿Qué vas a hacer?»', async () => {
    render(<MisPedidosView />);
    await screen.findByRole('tab', { name: 'Salón' });
    abrirNuevo();
    const dialogo = await screen.findByRole('dialog', { name: /Nuevo pedido/ });
    expect(within(dialogo).getByText('Nuevo pedido · ¿Qué vas a hacer?')).toBeTruthy();
    expect(within(dialogo).getByText('En el local (mesa)')).toBeTruthy();
    expect(within(dialogo).getByText('Para llevar')).toBeTruthy();
    expect(within(dialogo).getByText('Delivery')).toBeTruthy();
    expect(within(dialogo).getByText('Pedido del personal')).toBeTruthy();
  });

  it('en modo Lista también abre el mismo selector', async () => {
    localStorage.setItem('caprichos.misPedidos.pestana', 'lista');
    render(<MisPedidosView />);
    await screen.findByRole('tab', { name: 'Lista' });
    abrirNuevo();
    expect(await screen.findByRole('dialog', { name: /Nuevo pedido/ })).toBeTruthy();
  });

  it('sin acceso a salón no ofrece «En el local (mesa)»', async () => {
    permisos = ['pedidos/crear', 'creditos/ver'];
    render(<MisPedidosView />);
    await screen.findByRole('tab', { name: 'Salón' });
    abrirNuevo();
    const dialogo = await screen.findByRole('dialog', { name: /Nuevo pedido/ });
    expect(within(dialogo).queryByText('En el local (mesa)')).toBeNull();
    expect(within(dialogo).getByText('Para llevar')).toBeTruthy();
  });

  it('quien puede crear pedidos (p. ej. el mozo) sí ve «Pedido del personal», sin necesitar créditos/ver', async () => {
    permisos = ['mesas/ver', 'mesas/abrir', 'pedidos/crear'];
    render(<MisPedidosView />);
    await screen.findByRole('tab', { name: 'Salón' });
    abrirNuevo();
    const dialogo = await screen.findByRole('dialog', { name: /Nuevo pedido/ });
    expect(within(dialogo).getByText('Pedido del personal')).toBeTruthy();
    expect(within(dialogo).getByText('En el local (mesa)')).toBeTruthy();
  });

  it('el selector tiene encabezados por grupo, nombre accesible y foco inicial en la primera opción', async () => {
    render(<MisPedidosView />);
    await screen.findByRole('tab', { name: 'Salón' });
    abrirNuevo();
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo pedido · ¿Qué vas a hacer?' });
    expect(within(dialogo).getByRole('heading', { name: 'Para un cliente' })).toBeTruthy();
    expect(within(dialogo).getByRole('heading', { name: 'Para el equipo' })).toBeTruthy();
    expect(document.activeElement).toBe(within(dialogo).getByRole('button', { name: /En el local \(mesa\)/ }));
  });

  it('Escape cierra el selector', async () => {
    render(<MisPedidosView />);
    await screen.findByRole('tab', { name: 'Salón' });
    abrirNuevo();
    const dialogo = await screen.findByRole('dialog', { name: /Nuevo pedido/ });
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Nuevo pedido/ })).toBeNull();
  });
});
