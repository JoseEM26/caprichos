import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccionesComerLocal, esComerLocalPorAsignar } from '../componentes/AccionesComerLocal';
import { salonApi } from '../api';

vi.mock('../api', () => ({
  salonApi: { obtenerMesas: vi.fn(), obtenerPlano: vi.fn(), asignarComerLocal: vi.fn(), comerLocalAEspera: vi.fn() },
}));
let permisos = ['mesas/abrir'];
vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ tiene: (p: string) => permisos.includes(p) }) }));

const pisos = [
  {
    id: '1', nombre: 'Piso 1', activo: true, cuadriculaAncho: 20, cuadriculaAlto: 12,
    mesas: [
      { id: 'm4', pisoId: '1', tipo: 'MESA', numero: 4, nombre: null, asientos: 4, x: 1, y: 1, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' },
      { id: 'm5', pisoId: '1', tipo: 'MESA', numero: 5, nombre: null, asientos: 4, x: 5, y: 1, ancho: 2, alto: 2, activo: true, estado: 'OCUPADA', pedido: { id: '9', codigo: 'CP-9', cliente: 'Luis' } },
    ],
  },
] as any;
const cl = { id: 5, codigo: 'CP-5', modalidad: 'COMER_LOCAL', estado: 'COLA', pago_estado: 'PENDIENTE', cliente_nombre: 'Rosa' };

describe('Acciones de Caja para «Comer en el local»', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permisos = ['mesas/abrir'];
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos } as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue(null as any);
  });

  it('solo aparece para COMER_LOCAL vivo y sin cobrar, con permiso', () => {
    expect(esComerLocalPorAsignar(cl)).toBe(true);
    for (const otro of [{ modalidad: 'MESA' }, { modalidad: 'DELIVERY' }, { estado: 'ANULADO' }, { estado: 'ENTREGADO' }, { pago_estado: 'PAGADO' }]) {
      const { container, unmount } = render(<AccionesComerLocal pedido={{ ...cl, ...otro }} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
    permisos = [];
    const { container } = render(<AccionesComerLocal pedido={cl} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra el chip y los dos botones', () => {
    render(<AccionesComerLocal pedido={cl} />);
    expect(screen.getByText('Autogestión · decide Caja')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Asignar mesa a Rosa CP-5/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lista de espera/ })).toBeInTheDocument();
  });

  it('A lista de espera: pide Sí/No y manda la acción', async () => {
    vi.mocked(salonApi.comerLocalAEspera).mockResolvedValue({ ok: true } as any);
    const alCambio = vi.fn();
    render(<AccionesComerLocal pedido={cl} alCambio={alCambio} />);
    fireEvent.click(screen.getByRole('button', { name: /lista de espera/ }));
    expect(salonApi.comerLocalAEspera).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, a la lista' }));
    await waitFor(() => expect(salonApi.comerLocalAEspera).toHaveBeenCalledWith('5'));
    await waitFor(() => expect(alCambio).toHaveBeenCalled());
  });

  it('Asignar mesa libre: selector, Continuar, Sí', async () => {
    vi.mocked(salonApi.asignarComerLocal).mockResolvedValue({ ok: true } as any);
    render(<AccionesComerLocal pedido={cl} />);
    fireEvent.click(screen.getByRole('button', { name: /Asignar mesa a Rosa/ }));
    expect(await screen.findByRole('dialog', { name: /Elige la mesa para Rosa/ })).toBeInTheDocument();
    const continuar = screen.getByRole('button', { name: 'Continuar' });
    expect(continuar).toBeDisabled();
    fireEvent.click(await screen.findByTestId('elemento-plano-m4'));
    fireEvent.click(continuar);
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, asignar' }));
    await waitFor(() => expect(salonApi.asignarComerLocal).toHaveBeenCalledWith('5', 'm4'));
  });

  it('mesa ocupada: confirmación fuerte y forzarOcupada', async () => {
    vi.mocked(salonApi.asignarComerLocal).mockResolvedValue({ ok: true } as any);
    render(<AccionesComerLocal pedido={cl} />);
    fireEvent.click(screen.getByRole('button', { name: /Asignar mesa a Rosa/ }));
    fireEvent.click(await screen.findByTestId('elemento-plano-m5'));
    expect(await screen.findByTestId('acl-confirmar-ocupada')).toHaveTextContent('LISTA DE ESPERA');
    expect(salonApi.asignarComerLocal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sí, mover a la lista de espera y asignar/ }));
    await waitFor(() => expect(salonApi.asignarComerLocal).toHaveBeenCalledWith('5', 'm5', true));
  });
});
