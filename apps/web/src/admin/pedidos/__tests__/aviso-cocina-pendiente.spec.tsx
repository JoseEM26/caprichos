import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useAccionesCaja } from '../accionesCaja';
import { pedidosApi, type Pedido } from '../pedidosApi';
import { ErrorApi } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';

const MENSAJE = 'Cocina aún no marcó como listo este pedido: faltan Cocina caliente y Bebidas. Pídele a Cocina que pulse “Listo”.';
const pedido = { id: '10', codigo: 'CP-010', modalidad: 'MESA', estado: 'PREPARANDO', pago_estado: 'PAGADO', total: 20 } as unknown as Pedido;

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

/** Mismo hook que usan Tarjetas, Tabla y Lista de Caja (PedidosAdminView). */
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

const errorCocina = () =>
  new ErrorApi('COCINA_PENDIENTE', MENSAJE, 409, { codigo: 'COCINA_PENDIENTE', mensaje: MENSAJE, areasPendientes: ['Cocina caliente', 'Bebidas'] });

async function intentar() {
  fireEvent.click(screen.getByText('Probar acción'));
  fireEvent.click(await screen.findByText('Sí, continuar'));
}

describe('Aviso de Cocina pendiente en Caja', () => {
  beforeEach(() => {
    vi.spyOn(pedidosApi, 'cambiarEstado').mockRejectedValueOnce(errorCocina());
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('cajero: ve el mensaje del servidor y las áreas, solo «Entendido», nunca el error genérico ni Forzar', async () => {
    sesion('CAJERO');
    render(<Arnes alActualizar={() => {}} />);
    await intentar();
    expect(await screen.findByText(MENSAJE)).toBeTruthy();
    expect(screen.getByLabelText('Áreas pendientes').textContent).toContain('Bebidas');
    expect(screen.queryByText('Forzar como administrador')).toBeNull();
    expect(screen.queryByText(/Error al procesar/i)).toBeNull();
    fireEvent.click(screen.getByText('Entendido'));
    expect(screen.queryByText(MENSAJE)).toBeNull();
  });

  it('roles combinados sin ADMIN (cajero + mozo): sin Forzar', async () => {
    sesion('CAJERO', ['CAJERO', 'MOZO']);
    render(<Arnes alActualizar={() => {}} />);
    await intentar();
    await screen.findByText(MENSAJE);
    expect(screen.queryByText('Forzar como administrador')).toBeNull();
  });

  it('administrador: Forzar pide motivo obligatorio y confirmación Sí/No, y envía forzar:true', async () => {
    sesion('ADMIN');
    const alActualizar = vi.fn();
    render(<Arnes alActualizar={alActualizar} />);
    await intentar();
    await screen.findByText(MENSAJE);
    fireEvent.click(screen.getByText('Forzar como administrador', { selector: 'button' }));

    const si = screen.getByText('Sí, forzar').closest('button') as HTMLButtonElement;
    expect(si.disabled).toBe(true); // sin motivo no se puede
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'corto' } });
    expect(si.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Cocina sin pantalla hoy' } });
    expect(si.disabled).toBe(false);
    expect(screen.getByText('No')).toBeTruthy();

    vi.mocked(pedidosApi.cambiarEstado).mockResolvedValueOnce({} as any);
    fireEvent.click(si);
    await waitFor(() => expect(pedidosApi.cambiarEstado).toHaveBeenLastCalledWith('10', 'LISTO', 'Cocina sin pantalla hoy', true));
    await waitFor(() => expect(alActualizar).toHaveBeenCalled());
  });

  it('administrador: un fallo al forzar se ve en el diálogo con el mensaje del servidor', async () => {
    sesion('ADMIN');
    render(<Arnes alActualizar={() => {}} />);
    await intentar();
    await screen.findByText(MENSAJE);
    fireEvent.click(screen.getByText('Forzar como administrador', { selector: 'button' }));
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Cocina sin pantalla hoy' } });
    vi.mocked(pedidosApi.cambiarEstado).mockRejectedValueOnce(new ErrorApi('MOTIVO_REQUERIDO', 'Escribe el motivo', 400));
    fireEvent.click(screen.getByText('Sí, forzar').closest('button')!);
    expect(await screen.findByText('Escribe el motivo')).toBeTruthy();
  });

  it('otros errores siguen con su aviso de siempre', async () => {
    sesion('CAJERO');
    vi.mocked(pedidosApi.cambiarEstado).mockReset().mockRejectedValueOnce(new ErrorApi('REPARTIDOR_REQUERIDO', 'Asigna un repartidor', 409));
    render(<Arnes alActualizar={() => {}} />);
    await intentar();
    expect(await screen.findByText('Asigna un repartidor')).toBeTruthy();
    expect(screen.queryByText('Entendido')).toBeNull();
  });
});
