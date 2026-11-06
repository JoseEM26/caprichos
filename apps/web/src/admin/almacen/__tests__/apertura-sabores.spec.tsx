import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AperturaDiaView } from '../AperturaDiaView';
import { AvisoAperturaHoy } from '../AvisoAperturaHoy';
import { almacenApi, productoPendienteApertura } from '../almacenApi';
import * as sesionModulo from '../../../comun/sesion';

/** Dona con sabores: Chocolate ya contado (5), Vainilla pendiente (saldo 4). */
const DONA = {
  productoId: 'd1',
  nombre: 'DONA',
  areaNombre: 'Cocina',
  saldo: 9, quedaronAyer: 9, producidoHoy: 0,
  aperturaHoy: false,
  aperturaCantidad: null,
  sabores: [
    { saborId: 's1', nombre: 'Chocolate', saldo: 5, quedaronAyer: 5, producidoHoy: 0, aperturaHoy: true, aperturaCantidad: 5 },
    { saborId: 's2', nombre: 'Vainilla', saldo: 4, quedaronAyer: 4, producidoHoy: 0, aperturaHoy: false, aperturaCantidad: null },
  ],
};
const GALLETA = { productoId: 'g1', nombre: 'GALLETA AVENA', areaNombre: null, saldo: 6, quedaronAyer: 6, producidoHoy: 0, aperturaHoy: true, aperturaCantidad: 6 };
const TORTA = { productoId: 't1', nombre: 'TORTA', areaNombre: null, saldo: 3, quedaronAyer: 3, producidoHoy: 0, aperturaHoy: false, aperturaCantidad: null };

function sesionCon(permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Ana', rol: 'COCINA' },
    tiene: (p: string) => permisos.includes(p),
  } as any);
}

describe('Apertura del día por sabor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sesionCon(['almacen/apertura']);
  });

  function cargarCon(productos: any[]) {
    vi.spyOn(almacenApi, 'obtenerApertura').mockResolvedValue({ fecha: '2026-11-05', productos });
  }

  it('un producto con sabores se muestra como grupo con una fila por sabor, su apertura y el total', async () => {
    cargarCon([DONA, GALLETA]);
    render(<AperturaDiaView />);
    expect(await screen.findByText('DONA')).toBeInTheDocument();
    expect(screen.getByText('Se cuenta por sabor')).toBeInTheDocument();
    expect(screen.getAllByTestId('apertura-sabor')).toHaveLength(2);
    expect(screen.getByLabelText('Quedaron de ayer DONA · Chocolate')).toHaveValue(5);
    expect(screen.getByLabelText('Quedaron de ayer DONA · Vainilla')).toHaveValue(4);
    expect(screen.getByText('Apertura registrada hoy: 5')).toBeInTheDocument();
    expect(screen.getByText('Falta la apertura de hoy')).toBeInTheDocument();
    // el producto sin sabores sigue igual
    expect(screen.getByLabelText('Quedaron de ayer GALLETA AVENA')).toHaveValue(6);
    expect(screen.getByText(/faltan 1 de contar/)).toBeInTheDocument();
  });

  it('el total del producto es la suma de lo que hay ahora por sabor y se actualiza al editar', async () => {
    cargarCon([DONA]);
    render(<AperturaDiaView />);
    expect(await screen.findByText('Total ahora: 9')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Quedaron de ayer DONA · Chocolate'), { target: { value: '7' } });
    expect(screen.getByText('Total ahora: 11')).toBeInTheDocument();
  });

  it('los − y + de cada sabor ajustan solo ese sabor', async () => {
    cargarCon([DONA]);
    render(<AperturaDiaView />);
    await screen.findByText('Total ahora: 9');
    fireEvent.click(screen.getByRole('button', { name: 'Sumar uno a DONA · Vainilla' }));
    expect(screen.getByLabelText('Quedaron de ayer DONA · Vainilla')).toHaveValue(5);
    expect(screen.getByLabelText('Quedaron de ayer DONA · Chocolate')).toHaveValue(5);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar uno de DONA · Chocolate' }));
    expect(screen.getByLabelText('Quedaron de ayer DONA · Chocolate')).toHaveValue(4);
  });

  it('envía con saborId a los sabores y sin saborId a los demás, solo lo pendiente o cambiado', async () => {
    cargarCon([DONA, GALLETA, TORTA]);
    const registrar = vi.spyOn(almacenApi, 'registrarApertura').mockResolvedValue({ ok: true, registrados: 2 });
    render(<AperturaDiaView />);
    await screen.findByText('Total ahora: 9');

    // Chocolate ya está contado y no cambió: no viaja. Vainilla falta. La galleta ya está contada. La torta falta.
    fireEvent.click(screen.getByRole('button', { name: 'Guardar apertura (2)' }));
    await waitFor(() =>
      expect(registrar).toHaveBeenCalledWith([
        { productoId: 'd1', saborId: 's2', cantidad: 4, produccion: 0 },
        { productoId: 't1', cantidad: 3, produccion: 0 },
      ]),
    );
  });

  it('una diferencia grande en un sabor pide confirmación Sí/No con el nombre del sabor', async () => {
    cargarCon([DONA]);
    const registrar = vi.spyOn(almacenApi, 'registrarApertura').mockResolvedValue({ ok: true, registrados: 2 });
    render(<AperturaDiaView />);
    await screen.findByText('Total ahora: 9');
    fireEvent.change(screen.getByLabelText('Quedaron de ayer DONA · Chocolate'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar apertura (2)' }));

    expect(await screen.findByText(/DONA · Chocolate \(saldo 5, ahora 1\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No, revisar' }));
    expect(registrar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar apertura (2)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() =>
      expect(registrar).toHaveBeenCalledWith([
        { productoId: 'd1', saborId: 's1', cantidad: 1, produccion: 0 },
        { productoId: 'd1', saborId: 's2', cantidad: 4, produccion: 0 },
      ]),
    );
  });

  it('un número no válido en un sabor bloquea el guardado', async () => {
    cargarCon([DONA]);
    const registrar = vi.spyOn(almacenApi, 'registrarApertura');
    render(<AperturaDiaView />);
    await screen.findByText('Total ahora: 9');
    fireEvent.change(screen.getByLabelText('Quedaron de ayer DONA · Vainilla'), { target: { value: '' } });
    expect(screen.getByText('Escribe un número entero de 0 o más.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar apertura/ })).toBeDisabled();
    expect(registrar).not.toHaveBeenCalled();
  });

  it('un producto con la lista de sabores vacía se cuenta como producto normal', async () => {
    cargarCon([{ ...TORTA, sabores: [] }]);
    render(<AperturaDiaView />);
    expect(await screen.findByLabelText('Quedaron de ayer TORTA')).toHaveValue(3);
    expect(screen.queryByTestId('apertura-sabor')).toBeNull();
    expect(screen.queryByText('Se cuenta por sabor')).toBeNull();
  });

  it('el aviso del banner cuenta un producto con sabores si algún sabor no tiene apertura hoy', async () => {
    cargarCon([DONA, GALLETA]);
    render(
      <MemoryRouter>
        <AvisoAperturaHoy />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Falta el conteo de apertura de hoy (1 producto)')).toBeInTheDocument();
  });

  it('el banner no cuenta un producto con sabores si todos sus sabores ya están contados', async () => {
    cargarCon([{ ...DONA, aperturaHoy: false, sabores: DONA.sabores.map((s) => ({ ...s, aperturaHoy: true })) }]);
    render(
      <MemoryRouter>
        <AvisoAperturaHoy />
      </MemoryRouter>,
    );
    await waitFor(() => expect(almacenApi.obtenerApertura).toHaveBeenCalled());
    expect(screen.queryByTestId('aviso-apertura-hoy')).toBeNull();
  });

  it('productoPendienteApertura: con sabores decide por sabor; sin sabores, por el producto', () => {
    expect(productoPendienteApertura(DONA)).toBe(true);
    expect(productoPendienteApertura({ ...DONA, sabores: DONA.sabores.map((s) => ({ ...s, aperturaHoy: true })) })).toBe(false);
    expect(productoPendienteApertura(GALLETA)).toBe(false);
    expect(productoPendienteApertura(TORTA)).toBe(true);
  });
});
