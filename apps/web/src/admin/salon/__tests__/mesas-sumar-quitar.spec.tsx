import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VistaPreviaMesa } from '../componentes/VistaPreviaMesa';
import { useSumarMesas } from '../componentes/CambioDeMesa';
import { salonApi } from '../api';
import type { MesaSalon } from '../tipos';

vi.mock('../api', () => ({
  salonApi: {
    agregarMesasPedido: vi.fn(),
    quitarMesaPedido: vi.fn(),
    liberarMesaManual: vi.fn(),
  },
}));

const pedido = {
  id: '900',
  codigo: 'CP-900',
  estado: 'PREPARANDO',
  mozo: 'Ana',
  cliente: null,
  total: 30,
  creadoEn: undefined,
  lineas: [],
};

const mesa = (id: string, numero: number, estado: 'LIBRE' | 'OCUPADA', extra: Partial<NonNullable<MesaSalon['pedido']>> = {}): MesaSalon => ({
  id,
  pisoId: '1',
  tipo: 'MESA',
  numero,
  nombre: null,
  asientos: 4,
  x: 1,
  y: 1,
  ancho: 2,
  alto: 2,
  activo: true,
  estado,
  pedido: estado === 'OCUPADA' ? ({ ...pedido, ...extra } as any) : null,
});

describe('Vista previa de un pedido con varias mesas: agregar y quitar mesa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.quitarMesaPedido).mockResolvedValue({ ok: true, mesa: 'Mesa 2', mesas: [] } as any);
  });

  it('con permiso de mesas/abrir muestra «Agregar mesa» y «Quitar mesa»; sin permiso, ninguno', () => {
    const principal = mesa('m1', 1, 'OCUPADA', { esPrincipal: true, orden: 1 });
    const { unmount } = render(
      <VistaPreviaMesa mesa={principal} puedeForzar={false} alCerrar={vi.fn()} alCambiar={vi.fn()} puedeAbrirMesas alAgregarMesa={vi.fn()} mesasDelPedido={[principal]} />,
    );
    expect(screen.getByRole('button', { name: 'Agregar mesa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar mesa' })).toBeInTheDocument();
    unmount();

    render(<VistaPreviaMesa mesa={principal} puedeForzar={false} alCerrar={vi.fn()} alCambiar={vi.fn()} mesasDelPedido={[principal]} />);
    expect(screen.queryByRole('button', { name: 'Agregar mesa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quitar mesa' })).toBeNull();
  });

  it('«Agregar extra» aparece solo con el permiso (lo da el padre) y en pedido vigente; no hay anular ni cortesía', () => {
    const alExtra = vi.fn();
    const m = mesa('m1', 1, 'OCUPADA', { esPrincipal: true, orden: 1 });
    const { unmount } = render(<VistaPreviaMesa mesa={m} puedeForzar={false} alCerrar={vi.fn()} alCambiar={vi.fn()} alAgregarExtra={alExtra} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar extra' }));
    expect(alExtra).toHaveBeenCalledWith(m);
    expect(screen.queryByRole('button', { name: /anular|cortes/i })).toBeNull();
    unmount();
    const anulada = mesa('m1', 1, 'OCUPADA', { estado: 'ANULADO' });
    const r2 = render(<VistaPreviaMesa mesa={anulada} puedeForzar={false} alCerrar={vi.fn()} alCambiar={vi.fn()} alAgregarExtra={alExtra} />);
    expect(screen.queryByRole('button', { name: 'Agregar extra' })).toBeNull();
    r2.unmount();
    render(<VistaPreviaMesa mesa={m} puedeForzar={false} alCerrar={vi.fn()} alCambiar={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Agregar extra' })).toBeNull();
  });

  it('«Quitar mesa» con una sola mesa no deja quitarla', () => {
    const sola = mesa('m1', 1, 'OCUPADA', { esPrincipal: true, orden: 1 });
    render(<VistaPreviaMesa mesa={sola} puedeForzar={false} alCerrar={vi.fn()} alCambiar={vi.fn()} puedeAbrirMesas mesasDelPedido={[sola]} />);
    expect(screen.getByRole('button', { name: 'Quitar mesa' })).toBeDisabled();
  });

  it('quitar la principal pide cuál, avisa que la siguiente pasa a serlo y la quita', async () => {
    const alCambiar = vi.fn();
    const alCerrar = vi.fn();
    const principal = mesa('m1', 1, 'OCUPADA', { esPrincipal: true, orden: 1 });
    const otra = mesa('m2', 2, 'OCUPADA', { esPrincipal: false, orden: 2 });
    render(
      <VistaPreviaMesa mesa={principal} puedeForzar={false} alCerrar={alCerrar} alCambiar={alCambiar} puedeAbrirMesas mesasDelPedido={[otra, principal]} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quitar mesa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Mesa 1 (principal)' }));

    expect(screen.getByText('¿Quitar Mesa 1 del pedido?')).toBeInTheDocument();
    expect(screen.getByText(/Mesa 2 pasa a serlo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar mesa' }));

    await waitFor(() => expect(salonApi.quitarMesaPedido).toHaveBeenCalledWith('900', 'm1'));
    expect(alCambiar).toHaveBeenCalled();
    expect(alCerrar).toHaveBeenCalled();
  });

  it('quitar una mesa que no es la principal no menciona cambio de principal', async () => {
    const principal = mesa('m1', 1, 'OCUPADA', { esPrincipal: true, orden: 1 });
    const otra = mesa('m2', 2, 'OCUPADA', { esPrincipal: false, orden: 2 });
    render(<VistaPreviaMesa mesa={principal} puedeForzar={false} alCerrar={vi.fn()} alCambiar={vi.fn()} puedeAbrirMesas mesasDelPedido={[principal, otra]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar mesa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Mesa 2' }));
    expect(screen.queryByText(/pasa a serlo/)).toBeNull();
    expect(screen.getByText(/El pedido sigue en Mesa 1/)).toBeInTheDocument();
  });
});

/** Harness: el hook de sumar mesas con dos mesas libres y la ocupada del pedido. */
function Harness({ alCambiar }: { alCambiar: () => void }) {
  const ocupada = mesa('m1', 1, 'OCUPADA');
  const libre = mesa('m2', 2, 'LIBRE');
  const otra = mesa('m3', 3, 'OCUPADA');
  const s = useSumarMesas(alCambiar);
  return (
    <>
      <button onClick={() => s.iniciar({ pedidoId: '900', codigo: 'CP-900', mesa: ocupada, mesasEnPedido: 1 })}>iniciar</button>
      {[ocupada, libre, otra].map((m) => (
        <button key={m.id} onClick={() => s.tocarMesa(m)}>{`toca ${m.id}`}</button>
      ))}
      {s.ui}
    </>
  );
}

describe('Sumar mesas a un pedido abierto (croquis)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('elige una mesa libre (las ocupadas no), pide Sí/No y la suma al pedido', async () => {
    vi.mocked(salonApi.agregarMesasPedido).mockResolvedValue({ ok: true, mesa: 'Mesas 1 y 2', mesas: [] } as any);
    const alCambiar = vi.fn();
    render(<Harness alCambiar={alCambiar} />);

    fireEvent.click(screen.getByRole('button', { name: 'iniciar' }));
    fireEvent.click(screen.getByRole('button', { name: 'toca m3' })); // ocupada: no se elige
    expect(screen.getByRole('button', { name: 'Sumar mesa' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'toca m2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sumar 1 mesa' }));
    expect(screen.getByText('¿Sumar Mesa 2 al pedido de Mesa 1?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, sumar mesas' }));

    await waitFor(() => expect(salonApi.agregarMesasPedido).toHaveBeenCalledWith('900', ['m2']));
    expect(alCambiar).toHaveBeenCalled();
    expect(await screen.findByText('El pedido CP-900 ahora está en Mesas 1 y 2.')).toBeInTheDocument();
  });
});
