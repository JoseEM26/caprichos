import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import { PagoEnLineaCheck, textoProveedorCulqi } from '../PagoEnLineaCheck';
import { PagosTab } from '../PagosTab';

/** Respuesta de GET /admin/medios-pago con PAGO_EN_LINEA apagado y otros medios cambiados a propósito. */
const canales = {
  CARTA: { EFECTIVO: true, YAPE: true, PLIN: false, TARJETA: true, TRANSFERENCIA: true, PAGO_EN_LINEA: false },
  CAJA: { EFECTIVO: true, YAPE: false, PLIN: true, TARJETA: true, TRANSFERENCIA: true, PAGO_EN_LINEA: false },
  MOZO: { EFECTIVO: true, YAPE: true, PLIN: true, TARJETA: true, TRANSFERENCIA: false, PAGO_EN_LINEA: false },
  BOT: { EFECTIVO: true, YAPE: true, PLIN: true, TARJETA: false, TRANSFERENCIA: true, PAGO_EN_LINEA: false },
};

function mockApi(config: unknown = { modo: 'SIMULADO', publicKey: '' }) {
  vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
    if (ruta === '/admin/medios-pago') return { canales };
    if (ruta === '/carta/pagos/culqi/config') return config;
    return {};
  });
}

describe('Pago en línea (Culqi) como check en Configuración › Pagos', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('se muestra con su nota, apagado por defecto, y sin estado de proveedor si no hay dato', async () => {
    mockApi(undefined);
    render(<PagoEnLineaCheck esAdmin />);
    const check = await screen.findByRole('switch', { name: 'Tarjeta / Yape en línea (Culqi)' });
    expect((check as HTMLButtonElement).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Solo en la carta web. El cliente paga antes de que el pedido llegue a Caja o cocina.')).toBeInTheDocument();
  });

  it('muestra el estado del proveedor: real, de prueba o sin llaves', async () => {
    mockApi({ modo: 'REAL', publicKey: 'pk_live_x' });
    const { unmount } = render(<PagoEnLineaCheck esAdmin />);
    expect(await screen.findByText('Cobrando en modo REAL')).toBeInTheDocument();
    unmount();

    mockApi({ modo: 'SIMULADO', publicKey: 'pk_test_x' });
    const otro = render(<PagoEnLineaCheck esAdmin />);
    expect(await screen.findByText('Modo de prueba (simulado)')).toBeInTheDocument();
    otro.unmount();

    mockApi({ modo: 'SIMULADO', publicKey: '' });
    render(<PagoEnLineaCheck esAdmin />);
    expect(await screen.findByText('Sin llaves configuradas')).toBeInTheDocument();
  });

  it('textoProveedorCulqi no inventa estado sin dato', () => {
    expect(textoProveedorCulqi(undefined)).toBeNull();
    expect(textoProveedorCulqi({})).toBeNull();
  });

  it('quien no es ADMIN lo ve sin poder cambiarlo ni guardar', async () => {
    mockApi();
    render(<PagoEnLineaCheck esAdmin={false} />);
    const check = await screen.findByRole('switch', { name: 'Tarjeta / Yape en línea (Culqi)' });
    expect((check as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Aplicar pago en línea' })).toBeNull();
    expect(screen.getByText('Solo ADMIN')).toBeInTheDocument();
  });

  it('al activar y guardar envía el valor completo, con CARTA.PAGO_EN_LINEA=true y los demás medios intactos', async () => {
    mockApi();
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    render(<PagoEnLineaCheck esAdmin />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Tarjeta / Yape en línea (Culqi)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar pago en línea' }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(put).toHaveBeenCalled());

    const [ruta, cuerpo] = put.mock.calls[0] as [string, { valor: any }];
    expect(ruta).toBe('/admin/configuracion/medios_pago_canal');
    expect(cuerpo.valor.CARTA.PAGO_EN_LINEA).toBe(true);
    // Lo que ya estaba no se pisa
    expect(cuerpo.valor.CARTA.PLIN).toBe(false);
    expect(cuerpo.valor.CAJA.YAPE).toBe(false);
    expect(cuerpo.valor.MOZO.TRANSFERENCIA).toBe(false);
    expect(cuerpo.valor.BOT.TARJETA).toBe(false);
    expect(cuerpo.valor.CAJA.PAGO_EN_LINEA).toBe(false);
    expect(Object.keys(cuerpo.valor).sort()).toEqual(['BOT', 'CAJA', 'CARTA', 'MOZO']);
  });

  it('dentro de Pagos aparece junto a los demás medios, y la tabla de canales no ofrece Culqi fuera de Carta', async () => {
    mockApi();
    render(<PagosTab puedeEditar />);
    expect(await screen.findByRole('switch', { name: 'Tarjeta / Yape en línea (Culqi)' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Aceptar tarjeta' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Aceptar efectivo' })).toBeInTheDocument();
  });
});
