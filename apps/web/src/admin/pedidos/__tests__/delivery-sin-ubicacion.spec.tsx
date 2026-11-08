import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../comun/sesion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/sesion')>()),
  useSesion: () => ({ tiene: () => true, usuario: { rol: 'CAJERO' } }),
}));
vi.mock('../../../comun/mapa/MapaUbicacion', () => ({
  MapaUbicacion: ({ punto }: any) => <div data-testid="mapa">{punto ? `${punto.lat},${punto.lng}` : 'sin punto'}</div>,
}));
vi.mock('../../../comun/mapa/BuscadorDireccion', () => ({ BuscadorDireccion: () => null }));
vi.mock('../../../comun/mapa/sedeDefecto', () => ({ SEDE_DEFECTO: { lat: 0, lng: 0 }, cargarSede: () => Promise.resolve({ lat: 0, lng: 0 }) }));
vi.mock('../cambioUbicacionApi', async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    cambioUbicacionApi: {
      previsualizar: vi.fn(),
      cambiar: vi.fn(),
      historial: vi.fn(),
      liquidarAjuste: vi.fn(),
      pedirUbicacionWhatsapp: vi.fn(),
      propuestasPendientes: vi.fn().mockResolvedValue([]),
      aprobarPropuesta: vi.fn(),
      rechazarPropuesta: vi.fn(),
    },
    propuestaUbicacionApi: { vigente: vi.fn().mockResolvedValue(null), proponer: vi.fn(), cancelar: vi.fn() },
  };
});

import { ModalConfirmarPago } from '../ModalConfirmarPago';
import { ModalCobrar } from '../ModalCobrar';
import { SeccionUbicacionPedido } from '../SeccionUbicacionPedido';
import { AvisoDeliverySinUbicacion } from '../AvisoDeliverySinUbicacion';
import { deliverySinUbicacion, MENSAJE_DELIVERY_SIN_UBICACION } from '../ubicacionDelivery';
import { cambioUbicacionApi } from '../cambioUbicacionApi';
import type { Pedido } from '../pedidosApi';

const api = cambioUbicacionApi as any;

const delivery = (extra: Partial<Pedido> = {}): Pedido =>
  ({
    id: '31', codigo: 'CP-W031', canal: 'CARTA', modalidad: 'DELIVERY', estado: 'COLA', pago_estado: 'PENDIENTE',
    pago_metodo: null, pago_preferido: 'YAPE', total: '27.00', subtotal: '27.00', descuento: '0',
    creado_en: '2026-11-06T18:00:00Z', entrega_direccion: 'Av. Las Palmeras 123', entrega_lat: null, entrega_lng: null, zona: null,
    ...extra,
  }) as Pedido;

describe('delivery sin ubicación (Caja)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('regla: sin punto o sin zona es «sin ubicación»; un dato que el listado no trae no cuenta', () => {
    expect(deliverySinUbicacion(delivery())).toBe(true);
    expect(deliverySinUbicacion(delivery({ entrega_lat: -12, entrega_lng: -77, zona: null, zona_id: null }))).toBe(true);
    expect(deliverySinUbicacion(delivery({ entrega_lat: -12, entrega_lng: -77, zona: { id: '1', nombre: 'Z1', precio: 5 } }))).toBe(false);
    expect(deliverySinUbicacion(delivery({ entrega_lat: -12, entrega_lng: -77, zona: undefined, zona_id: '3' }))).toBe(false);
    expect(deliverySinUbicacion({ modalidad: 'MESA', entrega_lat: null })).toBe(false);
    expect(deliverySinUbicacion({ modalidad: 'DELIVERY' })).toBe(false);
  });

  it('el aviso dice que falta la ubicación y «Pedir ubicación por WhatsApp» la reenvía', async () => {
    api.pedirUbicacionWhatsapp.mockResolvedValue({ enviado: true });
    render(<AvisoDeliverySinUbicacion pedidoId="31" codigo="CP-W031" direccion="Av. X" alActualizar={() => {}} />);
    expect(screen.getByText('Falta la ubicación: el cliente debe enviarla por WhatsApp')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ubicar en el mapa' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir ubicación por WhatsApp' }));
    await waitFor(() => expect(api.pedirUbicacionWhatsapp).toHaveBeenCalledWith('31'));
    expect(await screen.findByText(/Le pedimos la ubicación por WhatsApp/)).toBeTruthy();
  });

  it('si WhatsApp no deja escribirle (ventana cerrada) muestra el motivo', async () => {
    api.pedirUbicacionWhatsapp.mockRejectedValue(new Error('Pasaron más de 24 h desde el último mensaje del cliente'));
    render(<AvisoDeliverySinUbicacion pedidoId="31" codigo="CP-W031" alActualizar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pedir ubicación por WhatsApp' }));
    expect(await screen.findByText(/Pasaron más de 24 h/)).toBeTruthy();
  });

  it('«Confirmar pedido y pago»: con el delivery sin ubicación el botón final está deshabilitado y el mensaje se ve', () => {
    render(<ModalConfirmarPago pedido={delivery()} alCerrar={vi.fn()} alConfirmarExitoso={vi.fn()} />);
    expect(screen.getAllByText(MENSAJE_DELIVERY_SIN_UBICACION).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Ubicar en el mapa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pedir ubicación por WhatsApp' })).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ya hablé con el cliente/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    const boton = screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    expect(boton.title).toBe(MENSAJE_DELIVERY_SIN_UBICACION);
  });

  it('con punto y zona no hay aviso y el botón queda habilitado', () => {
    const ubicado = delivery({ pago_preferido: 'EFECTIVO', entrega_lat: -12.05, entrega_lng: -77.04, zona: { id: '1', nombre: 'Z1', precio: 5 } });
    render(<ModalConfirmarPago pedido={ubicado} alCerrar={vi.fn()} alConfirmarExitoso={vi.fn()} />);
    expect(screen.queryByText(MENSAJE_DELIVERY_SIN_UBICACION)).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ya hablé con el cliente/ }));
    // delivery en efectivo: sin paso de pago, Cliente -> Revisar
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect((screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('delivery en efectivo sin ubicación: sigue bloqueado aunque no haya paso de pago', () => {
    render(<ModalConfirmarPago pedido={delivery({ pago_preferido: 'EFECTIVO' })} alCerrar={vi.fn()} alConfirmarExitoso={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Ya hablé con el cliente/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect((screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('«Cobrar»: delivery sin ubicación no se cobra desde la ventana', () => {
    render(<ModalCobrar pedido={delivery({ estado: 'LISTO' })} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} />);
    expect(screen.getAllByText(MENSAJE_DELIVERY_SIN_UBICACION).length).toBeGreaterThan(0);
    const botones = screen.getAllByRole('button').filter((b) => /^Cobrar$/.test(b.textContent ?? '') || /Registrar cobro|Cobrar S\//.test(b.textContent ?? ''));
    expect(botones.length === 0 || botones.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });
});

describe('propuestas de ubicación en la tarjeta del pedido de Caja', () => {
  beforeEach(() => vi.clearAllMocks());

  const cambio = (extra: any = {}) => ({
    id: '9', origen: 'REPARTIDOR', estado: 'PROPUESTA', propuestoPorNombre: 'Luis', propuestoEn: '2026-11-06T19:00:00Z',
    resueltoPorNombre: null, resueltoEn: null, nota: null, motivo: null,
    anterior: { lat: -12.05, lng: -77.04, direccion: null, referencia: null, zona: 'Z1' },
    nueva: { lat: -12.051, lng: -77.04, direccion: null, referencia: null, zona: 'Z2' },
    envioAnterior: 4, envioNuevo: 7, totalAnterior: 31, totalNuevo: 34, diferencia: 3, ajuste: null, avisoCliente: null,
    ...extra,
  });

  it('propuesta del repartidor: distancia al punto actual, diferencia de envío y Aprobar/Rechazar', async () => {
    api.historial.mockResolvedValue({ editada: false, cambios: [cambio()] });
    render(<SeccionUbicacionPedido pedidoId="31" codigo="CP-W031" estado="EN_CAMINO" lat={-12.05} lng={-77.04} direccion="Av. X" alActualizar={() => {}} />);
    expect(await screen.findByText(/Cambio de ubicación propuesto por Luis/)).toBeTruthy();
    expect(screen.getByText(/A 111 m del punto actual/)).toBeTruthy();
    expect(screen.getAllByText(/\+S\/ 3\.00/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeTruthy();
  });

  it('ubicación del cliente por WhatsApp con otra ya guardada: «¿usarla?» con Usar y Descartar', async () => {
    api.historial.mockResolvedValue({ editada: false, cambios: [cambio({ origen: 'WHATSAPP_CLIENTE', propuestoPorNombre: null })] });
    api.aprobarPropuesta.mockResolvedValue({});
    render(<SeccionUbicacionPedido pedidoId="31" codigo="CP-W031" estado="COLA" lat={-12.05} lng={-77.04} alActualizar={() => {}} />);
    expect(await screen.findByText('El cliente envió otra ubicación: ¿usarla?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
    await waitFor(() => expect(api.aprobarPropuesta).toHaveBeenCalledWith('31', '9'));
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeTruthy();
  });

  it('fuera de zona: se marca y solo se puede descartar', async () => {
    api.historial.mockResolvedValue({
      editada: false,
      cambios: [cambio({ origen: 'WHATSAPP_CLIENTE', fueraDeZona: true, envioNuevo: null, totalNuevo: null, diferencia: null, anterior: { lat: null, lng: null, direccion: null, referencia: null, zona: null } })],
    });
    render(<SeccionUbicacionPedido pedidoId="31" codigo="CP-W031" estado="COLA" direccion="Av. X" alActualizar={() => {}} />);
    expect(await screen.findByText(/Fuera de zona/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Usar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeTruthy();
  });
});
