import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BotonCambiarFormaPago } from '../CambioCobroRepartidor';
import { cambioCobroApi } from '../cambioCobroApi';
import { propuestaUbicacionApi } from '../../pedidos/cambioUbicacionApi';

// El API devuelve null como 200 sin cuerpo y sin content-type: el cliente lo convierte en {}
const respuestaVacia = () => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

describe('Detalle del repartidor sin solicitud de cambio previa (pantalla en blanco)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('vigente() de cambio de cobro devuelve null cuando el servidor no manda nada', async () => {
    respuestaVacia();
    expect(await cambioCobroApi.vigente('7')).toBeNull();
  });

  it('vigente() de propuesta de ubicación devuelve null cuando el servidor no manda nada', async () => {
    respuestaVacia();
    expect(await propuestaUbicacionApi.vigente('7')).toBeNull();
  });

  it('un pedido en camino pinta aunque la solicitud llegue como {}', () => {
    render(
      <BotonCambiarFormaPago pedidoId="7" codigo="CP-7" estado="EN_CAMINO" totalCobrable={40} medioActual="EFECTIVO" solicitud={{} as any} alEnviado={() => {}} />,
    );
    expect(screen.getByTestId('btn-cambiar-pago')).toBeInTheDocument();
  });
});
