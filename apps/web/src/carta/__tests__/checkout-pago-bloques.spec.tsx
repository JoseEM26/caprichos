import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { FormularioCheckout } from '../FormularioCheckout';
import type { EstadoLocalCarta, DatosLocalCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';
import { api } from '../../comun/api';

const estado: EstadoLocalCarta = { abierta: true, motivo: 'OK', texto: 'Abierto', abre: '14:00', cierra: '22:00', pausaAltaDemanda: false, tiempoPrometidoMin: 25, altaDemandaMin: 0 };
const datosLocal = {
  invitadoPermitido: false, nombre: 'Caprichos', direccion: 'Av. 1', telefono: '999888777', whatsapp: '999888777', redes: {}, horario: [],
  mediosPago: { efectivo: { activo: true }, yape: { activo: true, numero: '999111222' } },
  envioGratisDesde: 70, pedidoMinimo: 0, propina: { carta: true, bot: false, tope: 50 },
} as unknown as DatosLocalCarta;

const ctx = (puntos: number) => ({
  cliente: { partyId: '100', nombre: 'Ana', telefono: '987000222', correo: null, cumpleanos: '14/03', puntos, fotoUrl: null },
  panelAbierto: false, abrirPanel: vi.fn(), cerrarPanel: vi.fn(), ingresar: vi.fn(), registrar: vi.fn(), salir: vi.fn(),
  refrescar: vi.fn(), actualizarPerfil: vi.fn(), subirFoto: vi.fn(), quitarFoto: vi.fn(),
});

function Pagina() {
  const { agregarLinea, abrirCheckout } = useCarrito();
  return (
    <div>
      <button onClick={() => { agregarLinea({ productoId: 'p1', nombre: 'Frappé', precioBase: 14.5, cantidad: 1, opciones: [], precioUnitario: 14.5, subtotal: 14.5 }); abrirCheckout(); }}>Abrir pedido</button>
      <FormularioCheckout estadoLocal={estado} datosLocal={datosLocal} />
    </div>
  );
}

async function irAPagar(cuenta: ReturnType<typeof ctx> | null, vista: unknown) {
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(cuenta);
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue(cuenta as any);
  vi.spyOn(api, 'post').mockResolvedValue(vista as any);
  vi.spyOn(api, 'get').mockResolvedValue({ direcciones: [] } as any);
  render(<CarritoProvider><Pagina /></CarritoProvider>);
  fireEvent.click(screen.getByText('Abrir pedido'));
  fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
  if (!cuenta) {
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
  }
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^Continuar$/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^Yape$/i }));
  await screen.findByText('Resumen');
}

const vistaOk = { descuentoTotal: 0, montoCanjeable: 14.5, puntosEstimados: 0.73, puntosPorcentaje: 5, detalles: [] };

describe('Paso 3 ▸ bloques de pago y puntos', () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('los bloques salen en orden: Cómo pagas, Descuentos, Propina, Comprobante, Resumen', async () => {
    await irAPagar(ctx(30), vistaOk);
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titulos.slice(titulos.indexOf('Cómo pagas'))).toEqual(['Cómo pagas', 'Pagar con Yape', 'Descuentos', 'Propina', 'Comprobante', 'Resumen']);
  });

  it('las ayudas plegables abren y cierran con aria-expanded', async () => {
    await irAPagar(ctx(30), vistaOk);
    const ayuda = screen.getByRole('button', { name: 'Ayuda: Propina' });
    expect(ayuda).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(ayuda);
    expect(ayuda).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/no entra en el comprobante/i)).toBeInTheDocument();
    fireEvent.click(ayuda);
    expect(screen.queryByText(/no entra en el comprobante/i)).toBeNull();
  });

  it('muestra saldo y valor en soles, y «Usar mis puntos» descuenta en el resumen', async () => {
    await irAPagar(ctx(30.5), vistaOk);
    expect(screen.getAllByTestId('puntos-saldo')[0]).toHaveTextContent('Tienes 30.50 puntos (= S/ 30.50)');
    fireEvent.click(screen.getByRole('button', { name: 'Usar mis puntos' }));
    expect(screen.getByText('Puntos usados')).toBeInTheDocument();
    expect(screen.getAllByText('−S/ 14.00').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/¿Cuántos puntos deseas usar\?/i)).toHaveValue('14');
    // 14.50 - 14 = 0.50 por pagar
    expect(screen.getAllByText('S/ 0.50').length).toBeGreaterThan(0);
    expect(screen.getByTestId('puntos-estimados')).toHaveTextContent(/sumas/);
  });

  it('con menos del mínimo explica cuántos puntos faltan', async () => {
    await irAPagar(ctx(0.68), vistaOk);
    expect(screen.getByTestId('puntos-motivo')).toHaveTextContent('Te faltan 0.32 puntos para usarlos (mínimo 1).');
    expect(screen.queryByRole('button', { name: 'Usar mis puntos' })).toBeNull();
  });

  it('con descuento del equipo dice que los puntos no aplican', async () => {
    await irAPagar(ctx(30), { descuentoTotal: 3.63, puntosEstimados: 0, montoCanjeable: 0, detalles: [{ tipo: 'PERSONAL', nombre: 'Equipo (25 %)', monto: 3.63 }] });
    expect(screen.getByTestId('puntos-motivo')).toHaveTextContent('Los puntos no aplican a productos con descuento del equipo o en promoción.');
  });

  it('sin cuenta pide iniciar sesión y con el enlace para hacerlo', async () => {
    await irAPagar(null, vistaOk);
    expect(screen.getByRole('button', { name: 'Inicia sesión' })).toBeInTheDocument();
    expect(screen.getByText(/para usar y sumar puntos/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usar mis puntos' })).toBeNull();
  });

  it('escribir los puntos a mano sigue descontando (el envío no se tocó)', async () => {
    await irAPagar(ctx(30), vistaOk);
    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByLabelText(/¿Cuántos puntos deseas usar\?/i), { target: { value: '5' } });
      act(() => vi.advanceTimersByTime(250));
    } finally {
      vi.useRealTimers();
    }
    expect(screen.getAllByText('S/ 9.50').length).toBeGreaterThan(0);
  });
});
