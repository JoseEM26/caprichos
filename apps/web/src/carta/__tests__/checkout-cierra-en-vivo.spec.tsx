import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { api } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { FormularioCheckout } from '../FormularioCheckout';
import type { EstadoLocalCarta, DatosLocalCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';

vi.mock('../../comun/api', async () => {
  const real = await vi.importActual<typeof import('../../comun/api')>('../../comun/api');
  return { ...real, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

const abierto: EstadoLocalCarta = { abierta: true, motivo: 'OK', texto: 'Abierto', abre: '14:00', cierra: '22:00', pausaAltaDemanda: false, tiempoPrometidoMin: 25, altaDemandaMin: 0 };
const cerrado: EstadoLocalCarta = { ...abierto, abierta: false, motivo: 'HORARIO', texto: 'Cerrado por hoy' };
const datos = {
  nombre: 'Caprichos', direccion: 'x', telefono: '999888777', whatsapp: '999888777', redes: {}, horario: [],
  mediosPago: { efectivo: { activo: true } }, envioGratisDesde: 70, envioGratisModo: 'mas_de', pedidoMinimo: null, invitadoPermitido: true,
} as unknown as DatosLocalCarta;

function Pagina({ estado }: { estado: EstadoLocalCarta }) {
  const { agregarLinea, abrirCheckout } = useCarrito();
  return (
    <div>
      <button onClick={() => { agregarLinea({ productoId: 'p', nombre: 'Frappé', precioBase: 14.5, cantidad: 1, opciones: [], precioUnitario: 14.5, subtotal: 14.5 }); abrirCheckout(); }}>Abrir pedido</button>
      <FormularioCheckout estadoLocal={estado} datosLocal={datos} />
    </div>
  );
}

describe('Checkout abierto cuando la carta cierra', () => {
  it('muestra el aviso y no deja enviar', () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
    vi.mocked(api.get).mockRejectedValue(new Error('sin red'));
    vi.mocked(api.post).mockRejectedValue(new Error('sin red'));
    const arbol = (e: EstadoLocalCarta) => <CarritoProvider><Pagina estado={e} /></CarritoProvider>;
    const { rerender } = render(arbol(abierto));
    fireEvent.click(screen.getByText('Abrir pedido'));
    expect(screen.queryByTestId('aviso-local-cerrado')).toBeNull();

    // la carta se actualiza sola y llega «cerrado» con el checkout abierto
    rerender(arbol(cerrado));
    expect(screen.getByTestId('aviso-local-cerrado').textContent).toContain('Ya cerramos por hoy');
    expect(vi.mocked(api.post).mock.calls.filter((c) => c[0] === '/pedidos')).toHaveLength(0);
  });
});
