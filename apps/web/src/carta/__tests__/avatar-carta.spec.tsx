import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

// Estado de la cuenta y del carrito que cada prueba ajusta
const cuenta: { cliente: unknown; cargarAvatar: ReturnType<typeof vi.fn>; guardarAvatar: ReturnType<typeof vi.fn> } = {
  cliente: null,
  cargarAvatar: vi.fn(),
  guardarAvatar: vi.fn(),
};
const carrito: { pedidoConfirmado: unknown } = { pedidoConfirmado: null };
vi.mock('../cuenta/CuentaContext', () => ({ useCuentaOpcional: () => cuenta }));
vi.mock('../CarritoContext', () => ({ useCarrito: () => carrito }));
vi.mock('../../avatar/AvatarEditorPerezoso', () => ({ AvatarEditorPerezoso: () => <div data-testid="editor-avatar" /> }));
// WebGL "disponible" pero la escena y three se reemplazan: contamos cuántas veces se baja el chunk 3D
const montajes3d = vi.fn();
vi.mock('../../avatar/AvatarVivo', () => ({ default: () => { montajes3d(); return <canvas data-testid="avatar-3d" />; } }));
let webgl = true;
vi.mock('../../mascota/soporteWebGL', () => ({ tieneSoporteWebGL: () => webgl, prefiereMovimientoReducido: () => false }));

import { SaludoAvatar } from '../SaludoAvatar';
import { CelebracionPedido } from '../CelebracionPedido';

const CLIENTE = { partyId: '1', nombre: 'Lucía Pérez', avatarUrl: '/archivos/a.png' };

describe('avatar en la carta', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    webgl = true;
    montajes3d.mockClear();
    cuenta.cliente = CLIENTE;
    cuenta.cargarAvatar = vi.fn().mockResolvedValue({ nombre: 'Lu' });
    carrito.pedidoConfirmado = null;
  });
  afterEach(() => vi.useRealTimers());

  const montar = async (ui: JSX.Element) => {
    const r = render(ui);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    return r;
  };

  it('saluda con el apodo, se esconde solo y no vuelve el mismo día', async () => {
    const { unmount } = await montar(<SaludoAvatar />);
    expect(screen.getByText('¡Hola, Lu! 👋')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.getByTestId('avatar-3d')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(screen.queryByTestId('saludo-avatar')).toBeNull();
    unmount();
    await montar(<SaludoAvatar />);
    expect(screen.queryByTestId('saludo-avatar')).toBeNull();
    expect(cuenta.cargarAvatar).toHaveBeenCalledTimes(1);
  });

  it('con «Mostrar mi avatar al entrar» apagado no sale', async () => {
    cuenta.cargarAvatar = vi.fn().mockResolvedValue({ nombre: 'Lu', mostrarAlEntrar: false });
    await montar(<SaludoAvatar />);
    expect(screen.queryByTestId('saludo-avatar')).toBeNull();
  });

  it('sin avatar no consulta, no muestra nada y no baja three', async () => {
    cuenta.cliente = { partyId: '1', nombre: 'Ana', avatarUrl: null };
    await montar(<SaludoAvatar />);
    expect(screen.queryByTestId('saludo-avatar')).toBeNull();
    expect(cuenta.cargarAvatar).not.toHaveBeenCalled();
    expect(montajes3d).not.toHaveBeenCalled();
  });

  it('sin WebGL usa el retrato y tocarlo abre Mi avatar', async () => {
    webgl = false;
    await montar(<SaludoAvatar />);
    expect(screen.getByTestId('retrato-avatar')).toBeInTheDocument();
    expect(montajes3d).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('saludo-avatar'));
    expect(screen.getByTestId('editor-avatar')).toBeInTheDocument();
  });

  it('si localStorage falla igual saluda', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    await montar(<SaludoAvatar />);
    expect(screen.getByTestId('saludo-avatar')).toBeInTheDocument();
    get.mockRestore();
    set.mockRestore();
  });

  describe('celebración del pedido', () => {
    const conPedido = () => { carrito.pedidoConfirmado = { codigo: 'A12' }; };

    it('sale a pantalla completa con el apodo y el código, y se cierra con Saltar', async () => {
      conPedido();
      await montar(<CelebracionPedido />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('¡Gracias por tu compra, Lu! 🎉')).toBeInTheDocument();
      expect(screen.getByText('Pedido #A12')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Saltar' }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('se cierra con Esc y también sola a los 5 s', async () => {
      conPedido();
      const { unmount } = await montar(<CelebracionPedido />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      unmount();
      carrito.pedidoConfirmado = { codigo: 'B7' };
      await montar(<CelebracionPedido />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('sin avatar no se monta y no baja three', async () => {
      cuenta.cliente = { partyId: '1', nombre: 'Ana', avatarUrl: null };
      conPedido();
      await montar(<CelebracionPedido />);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(montajes3d).not.toHaveBeenCalled();
    });
  });
});
