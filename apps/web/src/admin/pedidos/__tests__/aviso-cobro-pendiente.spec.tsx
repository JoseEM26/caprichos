import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useAccionesCaja } from '../accionesCaja';
import { pedidosApi, type Pedido } from '../pedidosApi';
import { ErrorApi } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';

const MENSAJE = 'Este pedido aún no está cobrado. Cóbralo en Caja antes de entregarlo.';
const pedido = { id: '10', codigo: 'CP-010', modalidad: 'LLEVAR', estado: 'LISTO', pago_estado: 'PAGADO', total: 20 } as unknown as Pedido; // la pantalla aún lo ve cobrado (dato viejo): el servidor manda

function sesion(rol: string, roles?: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Persona Prueba', rol, roles },
    permisos: [],
    autenticado: true,
    cargando: false,
    debeCambiar: false,
    tiene: () => true,
  } as any);
}

function Arnes({ alActualizar }: { alActualizar: () => void }) {
  const { accionDe, ejecutar, dialogos } = useAccionesCaja({ alActualizar, abrirDetalle: () => {} });
  const accion = accionDe(pedido)!;
  return (
    <div>
      <button onClick={() => ejecutar(pedido, accion)}>Probar acción</button>
      {dialogos}
    </div>
  );
}

const errorCobro = () =>
  new ErrorApi('COBRO_PENDIENTE', MENSAJE, 409, { codigo: 'COBRO_PENDIENTE', mensaje: MENSAJE, puedeForzar: false });

async function intentar() {
  fireEvent.click(screen.getByText('Probar acción'));
  fireEvent.click(await screen.findByText('Sí, continuar'));
}

describe('Aviso de cobro pendiente en Caja', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('cajero: ve el aviso claro con Cobrar y Entendido, sin «Entregar sin cobrar»', async () => {
    sesion('CAJERO');
    vi.spyOn(pedidosApi, 'cambiarEstado').mockRejectedValueOnce(errorCobro());
    render(<Arnes alActualizar={() => {}} />);
    await intentar();
    expect(await screen.findByText(MENSAJE)).toBeTruthy();
    expect(screen.getByText('Falta cobrar este pedido')).toBeTruthy();
    expect(screen.getByText('Cobrar', { selector: 'button' })).toBeTruthy();
    expect(screen.queryByText('Entregar sin cobrar')).toBeNull();
    expect(screen.queryByText(/No se pudo completar la acción/i)).toBeNull();
    fireEvent.click(screen.getByText('Entendido'));
    expect(screen.queryByText(MENSAJE)).toBeNull();
  });

  it('administrador: «Entregar sin cobrar» pide motivo (mínimo 10) y Sí/No, y envía forzarSinCobro', async () => {
    sesion('ADMIN');
    const alActualizar = vi.fn();
    const espia = vi.spyOn(pedidosApi, 'cambiarEstado').mockRejectedValueOnce(errorCobro());
    render(<Arnes alActualizar={alActualizar} />);
    await intentar();
    await screen.findByText(MENSAJE);
    fireEvent.click(screen.getByText('Entregar sin cobrar', { selector: 'button' }));

    const si = screen.getByText('Sí, entregar sin cobrar').closest('button') as HTMLButtonElement;
    expect(si.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'corto' } });
    expect(si.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Paga mañana, cliente conocido' } });
    expect(si.disabled).toBe(false);
    expect(screen.getByText('No')).toBeTruthy();

    espia.mockResolvedValueOnce({} as any);
    fireEvent.click(si);
    await waitFor(() =>
      expect(espia).toHaveBeenLastCalledWith('10', 'ENTREGADO', 'Paga mañana, cliente conocido', false, undefined, true),
    );
    await waitFor(() => expect(alActualizar).toHaveBeenCalled());
  });

  it('administrador: «No» vuelve sin enviar nada', async () => {
    sesion('ADMIN');
    const espia = vi.spyOn(pedidosApi, 'cambiarEstado').mockRejectedValueOnce(errorCobro());
    render(<Arnes alActualizar={() => {}} />);
    await intentar();
    await screen.findByText(MENSAJE);
    fireEvent.click(screen.getByText('Entregar sin cobrar', { selector: 'button' }));
    fireEvent.click(screen.getByText('No'));
    expect(espia).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Sí, entregar sin cobrar')).toBeNull();
  });

  it('otro error se sigue mostrando como error normal', async () => {
    sesion('CAJERO');
    vi.spyOn(pedidosApi, 'cambiarEstado').mockRejectedValueOnce(new ErrorApi('OTRO', 'Algo falló', 500, {}));
    render(<Arnes alActualizar={() => {}} />);
    await intentar();
    expect(await screen.findByText('Algo falló')).toBeTruthy();
    expect(screen.queryByText('Falta cobrar este pedido')).toBeNull();
  });
});
