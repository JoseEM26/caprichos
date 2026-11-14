import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import { TarjetaAvisosPorRol } from '../TarjetaAvisosPorRol';

const tabla = {
  roles: ['ADMIN', 'CAJERO', 'MOZO'],
  avisos: [
    { tipo: 'PEDIDO_NUEVO', nombre: 'Pedido nuevo', detalle: 'Entró un pedido.', roles: ['ADMIN', 'CAJERO'] },
    { tipo: 'MESA_LISTA', nombre: 'Mesa lista para llevar', detalle: 'Pedido de mesa listo.', roles: ['ADMIN', 'MOZO'] },
  ],
};

const montar = async () => {
  vi.spyOn(api, 'get').mockResolvedValue(tabla);
  render(<TarjetaAvisosPorRol />);
  await screen.findByLabelText('Pedido nuevo: Caja');
};

describe('Configuración › Avisos por rol', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('muestra una fila por aviso con sus casillas por defecto', async () => {
    await montar();
    expect((screen.getByLabelText('Pedido nuevo: Caja') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Pedido nuevo: Mozo') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Mesa lista para llevar: Mozo') as HTMLInputElement).checked).toBe(true);
  });

  it('el buscador filtra los avisos y «Todo» marca la columna solo en lo visible', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('Buscar aviso'), { target: { value: 'mesa' } });
    expect(screen.queryByLabelText('Pedido nuevo: Caja')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todo en Caja' }));
    expect((screen.getByLabelText('Mesa lista para llevar: Caja') as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByLabelText('Buscar aviso'), { target: { value: '' } });
    expect((screen.getByLabelText('Pedido nuevo: Mozo') as HTMLInputElement).checked).toBe(false);
  });

  it('guardar pide confirmación Sí/No y manda la tabla completa; No no guarda', async () => {
    await montar();
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    const boton = screen.getByRole('button', { name: 'Guardar avisos por rol' });
    expect((boton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Pedido nuevo: Mozo'));
    fireEvent.click(boton);
    fireEvent.click(screen.getByRole('button', { name: 'No, cancelar' }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar avisos por rol' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/notificaciones/avisos-por-rol', {
        matriz: { PEDIDO_NUEVO: ['ADMIN', 'CAJERO', 'MOZO'], MESA_LISTA: ['ADMIN', 'MOZO'] },
      }),
    );
  });
});
