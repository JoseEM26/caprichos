import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let permisos: string[] = ['almacen/ver', 'almacen/emitir', 'almacen/ajustar'];
let rol = 'ALMACEN';
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ usuario: { rol }, tiene: (p: string) => permisos.includes(p) }),
}));

import { PendientesAlmacen, textoDeuda } from '../PendientesAlmacen';
import { almacenApi } from '../almacenApi';

const GRUPO = {
  insumoId: '5',
  nombre: 'Pan de molde',
  unidad: 'unidad',
  saldoPendiente: 10,
  stockCocina: -10,
  stockAlmacen: 4,
  pendientes: [{ id: '70', cantidad: 10, emitido: 0, ajustado: 0, saldo: 10, estado: 'PENDIENTE' as const, origen: 'Pedido CP-123', creadoEn: '2026-11-11T15:00:00Z' }],
};

describe('Pendientes de almacén', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    permisos = ['almacen/ver', 'almacen/emitir', 'almacen/ajustar'];
    rol = 'ALMACEN';
  });

  it('con el Control de almacén apagado no dibuja nada', async () => {
    const spy = vi.spyOn(almacenApi, 'listarPendientes').mockResolvedValue({ activo: false, grupos: [] });
    const { container } = render(<PendientesAlmacen />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('texto de deuda en rojo: «Debe a almacén: 10 unidad»', () => {
    expect(textoDeuda(-10, 'unidad')).toBe('Debe a almacén: 10 unidad');
    expect(textoDeuda(3, 'kg')).toBe('');
  });

  it('muestra la deuda y emite todo el insumo solo tras el Sí', async () => {
    vi.spyOn(almacenApi, 'listarPendientes').mockResolvedValue({ activo: true, grupos: [GRUPO] });
    const emitir = vi.spyOn(almacenApi, 'emitirPendientes').mockResolvedValue({
      ok: true,
      resultados: [{ insumoId: '5', nombre: 'Pan de molde', unidad: 'unidad', emitido: 4, faltaAlmacen: 6, parcial: true }],
    });
    render(<PendientesAlmacen />);
    expect(await screen.findByText('Debe a almacén: 10 unidad')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Emitir todo' }));
    expect(emitir).not.toHaveBeenCalled();
    expect(screen.getByText(/Almacén no alcanza: se emite lo que haya/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sí, emitir/ }));
    await waitFor(() => expect(emitir).toHaveBeenCalledWith({ ids: undefined, insumoId: '5' }));
    expect(await screen.findByText(/Almacén no alcanzó: faltan 6 unidad por emitir/)).toBeInTheDocument();
  });

  it('emite uno por uno por su id', async () => {
    vi.spyOn(almacenApi, 'listarPendientes').mockResolvedValue({ activo: true, grupos: [GRUPO] });
    const emitir = vi.spyOn(almacenApi, 'emitirPendientes').mockResolvedValue({ ok: true, resultados: [] });
    render(<PendientesAlmacen />);
    await screen.findByText('Pan de molde');
    fireEvent.click(screen.getByRole('button', { name: 'Emitir' }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, emitir/ }));
    await waitFor(() => expect(emitir).toHaveBeenCalledWith({ ids: ['70'], insumoId: undefined }));
  });

  it('Cocina ve la lista pero no puede emitir ni contar', async () => {
    permisos = ['almacen/ver'];
    rol = 'COCINA';
    vi.spyOn(almacenApi, 'listarPendientes').mockResolvedValue({ activo: true, grupos: [GRUPO] });
    render(<PendientesAlmacen />);
    await screen.findByText('Pan de molde');
    expect(screen.queryByRole('button', { name: 'Emitir todo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Emitir' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Recuento de insumos' })).toBeNull();
  });

  it('el recuento muestra la diferencia contra el sistema y pide Sí/No en el mismo modal', async () => {
    vi.spyOn(almacenApi, 'listarPendientes').mockResolvedValue({ activo: true, grupos: [GRUPO] });
    vi.spyOn(almacenApi, 'listarInsumosRecuento').mockResolvedValue([{ insumoId: '5', nombre: 'Pan de molde', unidad: 'unidad', sistema: -10, pendiente: 10 }]);
    const aplicar = vi.spyOn(almacenApi, 'aplicarRecuentoInsumos').mockResolvedValue({ ok: true });
    render(<PendientesAlmacen />);
    await screen.findByText('Pan de molde');
    fireEvent.click(screen.getByRole('button', { name: 'Recuento de insumos' }));
    const campo = await screen.findByLabelText('Contado de Pan de molde');
    fireEvent.change(campo, { target: { value: '0' } });
    expect(screen.getByText(/Diferencia: \+10 unidad/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar recuento' }));
    expect(aplicar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, ajustar' }));
    await waitFor(() => expect(aplicar).toHaveBeenCalledWith({ lugar: 'COCINA', filas: [{ insumoId: '5', contado: 0 }], motivo: undefined }));
  });
});
