import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { PendientesCobroCierre, AvisoBloqueoCierre, resumenPendientes, FocoPendientes } from '../PendientesCobroCierre';
import { PendienteCobro } from '../cierreApi';
import { pedidosApi, Pedido } from '../../pedidos/pedidosApi';

const hoyIso = () => new Date().toISOString();
const hace2Dias = () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

function pendiente(i: number, o: Partial<PendienteCobro> = {}): PendienteCobro {
  return {
    id: i,
    codigo: `CP-${String(i).padStart(3, '0')}`,
    canal: 'CARTA',
    modalidad: 'RECOGER',
    estado: 'ENTREGADO',
    total: 10,
    fecha: hoyIso(),
    pagoEstado: 'PENDIENTE',
    clienteNombre: `Cliente ${i}`,
    ...o,
  };
}

function Host({
  esAdmin = true,
  inicial = [],
  errorLista = false,
  alReintentar = vi.fn(),
  foco = null,
  fechaCaja,
}: {
  esAdmin?: boolean;
  inicial?: PendienteCobro[];
  errorLista?: boolean;
  alReintentar?: () => void;
  foco?: FocoPendientes | null;
  fechaCaja?: string;
}) {
  const [lista, setLista] = useState<PendienteCobro[]>(inicial);
  return (
    <PendientesCobroCierre
      esAdmin={esAdmin}
      pendientes={lista}
      setPendientes={setLista}
      alCambiarTurno={vi.fn()}
      errorLista={errorLista}
      alReintentar={alReintentar}
      foco={foco}
      fechaCaja={fechaCaja}
    />
  );
}

describe('Cierre: panel de pedidos pendientes escalable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('el resumen cuenta por cobrar, en cola, coordinados y el total con sus montos', () => {
    const lista = [
      pendiente(1, { total: 100 }),
      pendiente(2, { total: 240 }),
      pendiente(3, { estado: 'COLA', total: 20 }),
      pendiente(4, { pagoEstado: 'COORDINADO', total: 30 }),
      pendiente(5, { estado: 'PREPARANDO', pagoEstado: 'COORDINADO', total: 50 }),
    ];
    const r = resumenPendientes(lista, '2026-10-29');
    expect(r.cobrar).toEqual({ n: 3, monto: 360 });
    expect(r.coordinados).toEqual({ n: 2, monto: 80 });
    expect(r.cola.n).toBe(2);
    expect(r.total).toEqual({ n: 5, monto: 440 });

    render(<Host inicial={lista} />);
    expect(screen.getByText('Por cobrar:', { exact: false })).toHaveTextContent('Por cobrar: 3');
    expect(screen.getByText('Coordinados sin liquidar:', { exact: false })).toHaveTextContent('Coordinados sin liquidar: 2');
    expect(screen.getByText('Total que bloquea el cierre:', { exact: false })).toHaveTextContent('Total que bloquea el cierre: 5');
    expect(screen.getByText('S/ 440.00')).toBeInTheDocument();
  });

  it('los grupos son plegables: solo el primero con elementos viene abierto', () => {
    render(
      <Host
        inicial={[pendiente(1), pendiente(2, { pagoEstado: 'COORDINADO' })]}
      />,
    );
    const cobrar = screen.getByRole('button', { name: /Por cobrar · 1/ });
    const coord = screen.getByRole('button', { name: /Coordinados sin liquidar · 1/ });
    expect(cobrar).toHaveAttribute('aria-expanded', 'true');
    expect(coord).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('CP-002')).not.toBeInTheDocument();

    fireEvent.click(coord);
    expect(coord).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('CP-002')).toBeInTheDocument();
  });

  it('filtros en chips y buscador por código o nombre', () => {
    render(
      <Host
        inicial={[
          pendiente(1, { clienteNombre: 'María Quispe' }),
          pendiente(2, { estado: 'COLA', clienteNombre: 'Luis Ramos' }),
          pendiente(3, { pagoEstado: 'COORDINADO', clienteNombre: 'Ana Quispe' }),
        ]}
      />,
    );

    // Combo «Filtrar»: la opción «En cola» deja solo el pedido en cola
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar: Todos' }));
    fireEvent.click(screen.getByRole('option', { name: /En cola/ }));
    expect(screen.getByText('CP-002')).toBeInTheDocument();
    expect(screen.queryByText('CP-001')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar: En cola' }));
    fireEvent.click(screen.getByRole('option', { name: /Todos/ }));
    // Buscar por nombre sin acentos
    fireEvent.change(screen.getByLabelText(/Buscar pedido/i), { target: { value: 'quispe' } });
    expect(screen.getByText('CP-001')).toBeInTheDocument();
    expect(screen.queryByText('CP-002')).not.toBeInTheDocument();

    // Buscar por código
    fireEvent.change(screen.getByLabelText(/Buscar pedido/i), { target: { value: 'cp-002' } });
    expect(screen.getByText('CP-002')).toBeInTheDocument();
    expect(screen.queryByText('CP-001')).not.toBeInTheDocument();
  });

  it('muestra el nombre junto al código y «Sin nombre» cuando no hay', () => {
    render(<Host inicial={[pendiente(1, { clienteNombre: 'Rosa Pérez' }), pendiente(2, { clienteNombre: null })]} />);
    expect(screen.getByText('Rosa Pérez')).toBeInTheDocument();
    expect(screen.getByText('Sin nombre')).toBeInTheDocument();
  });

  it('marca en ámbar los pedidos de días anteriores', () => {
    render(<Host inicial={[pendiente(1, { fecha: hace2Dias() }), pendiente(2)]} />);
    expect(screen.getAllByText(/día anterior/)).toHaveLength(1);
    expect(screen.getByText(/día anterior/)).toHaveClass('pdc-antiguo');
  });

  it('separa los pedidos de otros días de los de la caja que se cierra y lo dice en el resumen', () => {
    // Caja de un día fijo: el de hoy (ahora) es «de otro día» y el de hace 2 días también
    const { unmount } = render(<Host fechaCaja="2099-01-01" inicial={[pendiente(1), pendiente(2, { fecha: hace2Dias() })]} />);
    expect(screen.getByText(/de días anteriores/)).toHaveTextContent('2 de días anteriores');
    unmount();

    // Caja de hoy: solo el de hace 2 días es de otro día; el resumen lo cuenta y la fila muestra su fecha
    render(<Host inicial={[pendiente(1), pendiente(2, { fecha: hace2Dias() })]} />);
    expect(screen.getByText(/de días anteriores/)).toHaveTextContent('1 de días anteriores');
    expect(screen.getAllByText(/día anterior/)).toHaveLength(1);
  });

  it('sin pedidos de otros días no muestra el resumen de días anteriores', () => {
    render(<Host inicial={[pendiente(1)]} />);
    expect(screen.queryByText(/de días anteriores/)).not.toBeInTheDocument();
  });

  it('cada pedido es una tarjeta con sus acciones y el panel no usa clases de la precuenta', () => {
    render(<Host inicial={[pendiente(1), pendiente(2), pendiente(3)]} />);
    expect(document.querySelectorAll('.pdc-fila')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Cobrar ahora' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Anular con motivo' })).toHaveLength(3);
    expect(document.querySelector('[class~="pc-panel"], [class~="pc-fila"]')).toBeNull();
  });

  it('por tandas: muestra 30 y «Ver más» trae el resto', () => {
    const muchos = Array.from({ length: 45 }, (_, i) => pendiente(i + 1));
    render(<Host inicial={muchos} />);
    const filas = document.querySelectorAll('.pdc-fila');
    expect(filas).toHaveLength(30);

    fireEvent.click(screen.getByRole('button', { name: /Ver más \(15 restantes\)/ }));
    expect(document.querySelectorAll('.pdc-fila')).toHaveLength(45);
    expect(screen.queryByRole('button', { name: /Ver más/ })).not.toBeInTheDocument();
  });

  it('«Anular con motivo» abre el diálogo ordenado con el resumen y exige motivo y código', async () => {
    vi.spyOn(pedidosApi, 'obtenerPorId').mockResolvedValue({
      id: '1',
      codigo: 'CP-LIVE-01',
      canal: 'CARTA',
      modalidad: 'DELIVERY',
      estado: 'COLA',
      cliente_nombre: 'Rosa Pérez',
      pago_estado: 'PENDIENTE',
      total: '48.50',
      subtotal: '48.50',
      descuento: '0',
      creado_en: hoyIso(),
      lineas: [{ id: 'l1', nombre: 'Lomo saltado', cantidad: 2, precio_unit: '24.25', subtotal: '48.50' }],
    } as Pedido);
    render(<Host inicial={[pendiente(1, { codigo: 'CP-LIVE-01', clienteNombre: 'Rosa Pérez', estado: 'COLA', total: 48.5 })]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Anular con motivo' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Anular pedido' });
    expect(within(dialogo).getByText('Anular pedido CP-LIVE-01')).toBeInTheDocument();
    expect(within(dialogo).getByText('Rosa Pérez')).toBeInTheDocument();
    expect(dialogo.querySelector('.ad-resumen')).toHaveTextContent('S/ 48.50');
    expect(within(dialogo).getByText(/Líneas del pedido \(1\)/)).toBeInTheDocument();

    const confirmar = within(dialogo).getByRole('button', { name: 'Confirmar anulación' });
    expect(confirmar).toBeDisabled();
    fireEvent.change(within(dialogo).getByLabelText(/Motivo detallado/i), { target: { value: 'Cliente no contesta' } });
    expect(confirmar).toBeDisabled();
    fireEvent.change(within(dialogo).getByLabelText(/Código del supervisor/i), { target: { value: '123456' } });
    expect(confirmar).toBeEnabled();
  });

  it('error al cargar: muestra Reintentar y lo ejecuta', () => {
    const alReintentar = vi.fn();
    render(<Host errorLista alReintentar={alReintentar} />);
    expect(screen.getByText('No se pudieron cargar los pedidos pendientes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(alReintentar).toHaveBeenCalledTimes(1);
  });

  it('sin pedidos: estado «Todo al día»', () => {
    render(<Host inicial={[]} />);
    expect(screen.getByText('Todo al día: no hay pedidos pendientes.')).toBeInTheDocument();
  });

  it('el cajero sin código no ve la lista (regresión)', () => {
    render(<Host esAdmin={false} inicial={[pendiente(1)]} />);
    expect(screen.queryByText('CP-001')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver pedidos' })).toBeInTheDocument();
  });

  it('un foco pedido desde el aviso abre el grupo indicado y enfoca el panel', async () => {
    const lista = [pendiente(1), pendiente(2, { pagoEstado: 'COORDINADO' })];
    const { rerender } = render(<Host inicial={lista} />);
    const coord = screen.getByRole('button', { name: /Coordinados sin liquidar · 1/ });
    expect(coord).toHaveAttribute('aria-expanded', 'false');

    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    rerender(<Host inicial={lista} foco={{ grupo: 'coordinados', n: 1 }} />);
    await waitFor(() => expect(coord).toHaveAttribute('aria-expanded', 'true'));
    expect(scroll).toHaveBeenCalled();
    expect(document.getElementById('pendientes-cierre')).toHaveFocus();
  });

  it('el aviso del cierre muestra el conteo y cada motivo lleva a su grupo', () => {
    const alVerGrupo = vi.fn();
    const lista = [pendiente(1), pendiente(2), pendiente(3, { pagoEstado: 'COORDINADO' })];
    render(<AvisoBloqueoCierre pedidos={lista} alVerGrupo={alVerGrupo} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver 3 pedidos sin resolver' }));
    expect(alVerGrupo).toHaveBeenLastCalledWith('cobrar');

    fireEvent.click(screen.getByRole('button', { name: 'Coordinados por confirmar: 1' }));
    expect(alVerGrupo).toHaveBeenLastCalledWith('coordinados');
    fireEvent.click(screen.getByRole('button', { name: 'Por cobrar: 2' }));
    expect(alVerGrupo).toHaveBeenLastCalledWith('cobrar');
  });
});

