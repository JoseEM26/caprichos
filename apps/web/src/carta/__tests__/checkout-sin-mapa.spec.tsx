import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { api } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { FormularioCheckout } from '../FormularioCheckout';
import { EstadoLocalCarta, DatosLocalCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';

vi.mock('../../comun/api', async () => {
  const real = await vi.importActual<typeof import('../../comun/api')>('../../comun/api');
  return { ...real, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

const estado: EstadoLocalCarta = {
  abierta: true, motivo: 'OK', texto: 'Abierto', abre: '14:00', cierra: '22:00',
  pausaAltaDemanda: false, tiempoPrometidoMin: 25, altaDemandaMin: 0,
};
const datos: DatosLocalCarta = {
  nombre: 'Caprichos', direccion: 'Av. Las Delicias 123', telefono: '999888777', whatsapp: '999888777', redes: {}, horario: [],
  mediosPago: { efectivo: { activo: true }, yape: { activo: true } }, envioGratisDesde: 70, pedidoMinimo: 0, invitadoPermitido: false,
};

function Pagina() {
  const { agregarLinea, abrirCheckout } = useCarrito();
  return (
    <div>
      <button
        onClick={() => {
          agregarLinea({ productoId: 'prod-1', nombre: 'Frappé Clásico', precioBase: 14.5, cantidad: 1, opciones: [], precioUnitario: 14.5, subtotal: 14.5 });
          abrirCheckout();
        }}
      >
        Abrir pedido
      </button>
      <FormularioCheckout estadoLocal={estado} datosLocal={datos} />
    </div>
  );
}

async function irAUbicacion() {
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
  render(<CarritoProvider><Pagina /></CarritoProvider>);
  fireEvent.click(screen.getByText('Abrir pedido'));
  fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
  fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
}

describe('Checkout delivery sin mapa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({});
    vi.mocked(api.post).mockResolvedValue({ existe: false });
  });

  it('no ofrece mapa ni ubicación actual y avisa «Envío por confirmar»', async () => {
    await irAUbicacion();
    expect(screen.queryByRole('button', { name: /Marcar en el mapa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Usar mi ubicación actual/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('aviso-envio-por-confirmar').textContent).toMatch(/Envío por confirmar: se calcula al recibir tu ubicación/);
  });

  it('dirección y referencia son obligatorias para seguir', async () => {
    await irAUbicacion();
    expect(document.getElementById('f-direccion')).toBeRequired();
    expect(document.getElementById('f-referencia')).toBeRequired();

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/escribe tu dirección/);

    fireEvent.change(document.getElementById('f-direccion') as HTMLInputElement, { target: { value: 'Av. Los Olivos 123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/referencia/);

    fireEvent.change(document.getElementById('f-referencia') as HTMLInputElement, { target: { value: 'Frente al parque' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByLabelText(/Paso 3/i)).toBeInTheDocument();
  });

  it('el resumen del pedido muestra «Envío por confirmar»', async () => {
    await irAUbicacion();
    fireEvent.change(document.getElementById('f-direccion') as HTMLInputElement, { target: { value: 'Av. Los Olivos 123' } });
    fireEvent.change(document.getElementById('f-referencia') as HTMLInputElement, { target: { value: 'Frente al parque' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    await screen.findByLabelText(/Paso 3/i);
    expect(screen.getAllByText(/Envío por confirmar: se calcula al recibir tu ubicación/).length).toBeGreaterThan(0);
  });
});
