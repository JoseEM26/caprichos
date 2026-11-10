import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { DetalleVentaModal } from '../DetalleVentaModal';
import { pedidosApi } from '../pedidosApi';
import { lineaTiempoApi, duracionSegLegible } from '../lineaTiempoApi';

const base: any = {
  id: '7', codigo: 'P-0007', canal: 'SALON', modalidad: 'MESA', estado: 'ENTREGADO', mesa_nombre: 'Mesa 4',
  cliente_nombre: 'Ana Prueba', cliente_telefono: '999111222', pago_estado: 'PAGADO', pago_metodo: 'EFECTIVO',
  subtotal: 40, descuento: 5, total: 35, propina: 3, comprobante_tipo: 'BOLETA', comprobante_numero: 'B001-12',
  creado_en: '2026-11-10T15:00:00Z',
  descuento_detalle: [{ nombre: 'Promo dona', montoDescontado: 5 }],
  lineas: [{ id: 'l1', nombre: 'Latte', tamano: 'Grande', cantidad: 2, precio_unit: 20, subtotal: 40, opciones: [{ opcion_nombre: 'Leche de avena' }] }],
  paga_con: 50,
};
const lt: any = {
  pedidoId: '7', atendidoPor: { partyId: '1', nombre: 'Luis Mozo', rol: 'MOZO', en: '2026-11-10T15:01:00Z' },
  canal: 'SALON', modalidad: 'MESA', mesa: 'Mesa 4', totalSeg: 1200, completo: true,
  etapas: [
    { codigo: 'TOMADO', etiqueta: 'Tomado', area: null, desde: '2026-11-10T15:00:00Z', hasta: '2026-11-10T15:01:00Z', duracionSeg: 60, estimada: false },
    { codigo: 'PREPARACION', etiqueta: 'Preparación', area: 'Barra', desde: null, hasta: null, duracionSeg: 750, estimada: true },
    { codigo: 'LISTO', etiqueta: 'Listo', area: null, desde: null, hasta: null, duracionSeg: null, estimada: false },
  ],
};

const abrir = () => render(<DetalleVentaModal pedidoId="7" alCerrar={vi.fn()} />);
const pestana = (n: string) => fireEvent.click(screen.getByRole('tab', { name: n }));

describe('DetalleVentaModal', () => {
  beforeEach(() => {
    vi.spyOn(pedidosApi, 'obtenerPorId').mockResolvedValue(base);
    vi.spyOn(lineaTiempoApi, 'obtener').mockResolvedValue(lt);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('formatea tiempos', () => {
    expect(duracionSegLegible(750)).toBe('12 min 30 s');
    expect(duracionSegLegible(null)).toBe('sin dato');
  });

  it('pestaña Venta con datos completos', async () => {
    abrir();
    expect(await screen.findByText('P-0007')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/2 x Latte/)).toBeTruthy();
    expect(screen.getByText('Leche de avena')).toBeTruthy();
    expect(screen.getByText(/Promo dona/)).toBeTruthy();
    expect(screen.getByText('Propina (referencial)')).toBeTruthy();
    expect(screen.getByText(/BOLETA B001-12/)).toBeTruthy();
  });

  it('pestaña Pagos con efectivo y vuelto', async () => {
    abrir();
    await screen.findByText('P-0007');
    pestana('Pagos');
    expect(screen.getByText('Verificado')).toBeTruthy();
    expect(screen.getByText('EFECTIVO')).toBeTruthy();
    expect(screen.getByText('Vuelto').nextSibling?.textContent).toBe('S/ 15.00');
  });

  it('Pagos de pedido cobrado por mozo', async () => {
    vi.spyOn(pedidosApi, 'obtenerPorId').mockResolvedValue({ ...base, pago_estado: 'PENDIENTE', cobroMozo: { en: '2026-11-10T16:00:00Z', medio: 'YAPE', mozo: 'Luis Mozo', faltaVoucher: true } });
    abrir();
    await screen.findByText('P-0007');
    pestana('Pagos');
    expect(screen.getByText('Pagado por mozo · por verificar')).toBeTruthy();
    expect(screen.getByText('Falta voucher')).toBeTruthy();
    expect(screen.getByText(/Luis Mozo a las 11:00/)).toBeTruthy();
  });

  it('Tiempos: mozo, aproximado y sin dato', async () => {
    abrir();
    await screen.findByText('P-0007');
    pestana('Tiempos');
    expect(await screen.findByText(/Luis Mozo a las 10:01/)).toBeTruthy();
    expect(screen.getByText('20 min')).toBeTruthy();
    expect(screen.getByText('≈ aproximado')).toBeTruthy();
    expect(screen.getByText('12 min 30 s')).toBeTruthy();
    expect(screen.getAllByText('sin dato').length).toBeGreaterThan(0);
  });

  it('delivery', async () => {
    vi.spyOn(pedidosApi, 'obtenerPorId').mockResolvedValue({ ...base, modalidad: 'DELIVERY', mesa_nombre: null, entrega_direccion: 'Av. Falsa 123', envio: 4 });
    vi.spyOn(lineaTiempoApi, 'obtener').mockResolvedValue({ ...lt, mesa: null, modalidad: 'DELIVERY', etapas: [{ codigo: 'EN_RUTA', etiqueta: 'En ruta', area: null, desde: null, hasta: null, duracionSeg: 600, estimada: false }] });
    abrir();
    expect(await screen.findByText('Av. Falsa 123')).toBeTruthy();
    expect(screen.getByText('Envío')).toBeTruthy();
    pestana('Tiempos');
    expect(await screen.findByText('En ruta')).toBeTruthy();
    expect(screen.getByText(/Atendió \(MOZO\)/)).toBeTruthy();
  });

  it('endpoint de tiempos falla: mensaje y el resto sigue', async () => {
    vi.spyOn(lineaTiempoApi, 'obtener').mockRejectedValue(new Error('404'));
    abrir();
    expect(await screen.findByText('P-0007')).toBeTruthy();
    pestana('Tiempos');
    expect(await screen.findByText('Aún no hay línea de tiempo para esta venta')).toBeTruthy();
    pestana('Venta');
    expect(screen.getByText(/2 x Latte/)).toBeTruthy();
  });

  it('error del pedido permite reintentar', async () => {
    const m = vi.spyOn(pedidosApi, 'obtenerPorId').mockRejectedValueOnce(new Error('caído')).mockResolvedValue(base);
    abrir();
    expect(await screen.findByText('caído')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(screen.getByText(/2 x Latte/)).toBeTruthy());
    expect(m).toHaveBeenCalledTimes(2);
  });

  it('Escape cierra', async () => {
    const alCerrar = vi.fn();
    render(<DetalleVentaModal pedidoId="7" alCerrar={alCerrar} />);
    await screen.findByText('P-0007');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(alCerrar).toHaveBeenCalled();
  });
});
