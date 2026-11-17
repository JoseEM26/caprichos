import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { useEffect } from 'react';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { PantallaConfirmacion } from '../PantallaConfirmacion';
import type { EstadoSeguimiento, PedidoGuardado } from '../seguimiento';
import { api } from '../../comun/api';
import { culqiApi } from '../pagos/culqiApi';

// Datos sintéticos: nada real
const configCulqi = { activo: true, publicKey: null, modo: 'REAL' as const, medios: ['TARJETA', 'YAPE'] as any };

const pedidoSinId = (extra: Partial<PedidoGuardado> = {}): PedidoGuardado => ({
  codigo: 'CP-T100',
  token: 'a'.repeat(64),
  modalidad: 'RECOGER',
  nombre: '',
  creadoEn: new Date().toISOString(),
  ...extra,
});

const estadoEnLinea = (extra: Partial<EstadoSeguimiento> = {}): EstadoSeguimiento => ({
  codigo: 'CP-T100',
  estado: 'POR_PAGAR',
  estadoEtiqueta: 'Por pagar',
  modalidad: 'RECOGER',
  total: 29,
  terminado: false,
  anulado: false,
  pasos: [{ clave: 'RECIBIDO', etiqueta: 'Pedido recibido', hecho: true, actual: true, hora: null }],
  resumenPago: {
    pagado: 0,
    total: 29,
    pagos: [{ medio: 'CULQI', monto: 29, digital: false, estado: 'AL_RECIBIR', actualizadoEn: null }],
  },
  pagoEnLinea: { pedidoId: '77', creadoEn: new Date().toISOString() },
  ...extra,
} as EstadoSeguimiento);

/** Abre un pedido como lo hace el enlace del bot o «Mi pedido»: solo con lo que guarda el navegador (sin creación). */
function Abre({ pedido }: { pedido: PedidoGuardado }) {
  const { setSeguimientoAbierto } = useCarrito();
  useEffect(() => setSeguimientoAbierto(pedido), []);
  return <PantallaConfirmacion />;
}

function renderAbre(pedido: PedidoGuardado) {
  return render(
    <CarritoProvider>
      <Abre pedido={pedido} />
    </CarritoProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(culqiApi, 'config').mockResolvedValue(configCulqi);
  vi.spyOn(culqiApi, 'intento').mockResolvedValue({ intentoId: 'i1', montoCentimos: 2900, moneda: 'PEN', descripcion: 'x', publicKey: null, modo: 'REAL', medios: configCulqi.medios });
});

afterEach(() => cleanup());

describe('Seguimiento de un pedido en línea sin pagar (A, B)', () => {
  it('A: abierto desde el enlace (sin id guardado) el cliente sigue pudiendo pagar', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(estadoEnLinea());
    renderAbre(pedidoSinId());
    fireEvent.click(await screen.findByRole("tab", { name: /Pago/ }));
    expect(await screen.findByRole('button', { name: 'Pagar ahora' })).toBeTruthy();
    expect(screen.getByTestId('pagar-en-linea')).toBeTruthy();
  });

  it('B: muestra el contador de los 15 min mientras el pedido espera pago', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(estadoEnLinea());
    renderAbre(pedidoSinId());
    fireEvent.click(await screen.findByRole("tab", { name: /Pago/ }));
    expect((await screen.findByTestId('contador-pago')).textContent).toMatch(/Te quedan \d+ min para pagar/);
  });

  it('B: el rótulo no dice «Pagado» cuando todavía no hay pago', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(estadoEnLinea());
    renderAbre(pedidoSinId());
    fireEvent.click(await screen.findByRole("tab", { name: /Pago/ }));
    const fila = await screen.findByTestId('resumen-pagado');
    expect(fila.textContent).toMatch(/Pagado hasta ahora/);
    expect(fila.textContent).not.toMatch(/^Pagado\s*S\/ 0/);
  });

  it('B: pedido vencido (anulado con pago en línea pendiente): mensaje claro y sin formulario de pago', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(estadoEnLinea({ estado: 'ANULADO', estadoEtiqueta: 'Anulado', anulado: true, terminado: true }));
    renderAbre(pedidoSinId());
    fireEvent.click(await screen.findByRole("tab", { name: /Pago/ }));
    expect(await screen.findByText('Se venció el tiempo para pagar este pedido. Haz uno nuevo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pagar ahora' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Volver a la carta' })).toBeTruthy();
  });

  it('E1: el cliente cambia el medio de un pedido que espera Culqi (efectivo, Yape, Plin o transferencia)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(estadoEnLinea());
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true, estado: 'COLA', medio: 'YAPE', mensaje: 'Cambiaste el pago a Yape.' });
    renderAbre(pedidoSinId());
    fireEvent.click(await screen.findByRole("tab", { name: /Pago/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar medio de pago' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yape' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar el cambio' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/carta/pagos/culqi/cambiar-medio', expect.objectContaining({ pedidoId: '77', medio: 'YAPE', seguimientoToken: 'a'.repeat(64) })));
    expect(await screen.findByText('Cambiaste el pago a Yape.')).toBeTruthy();
  });
});
