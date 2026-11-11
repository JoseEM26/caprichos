import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
let permisos: string[] = [];
let rol = 'CAJERO';
vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ tiene: (p: string) => permisos.includes(p), usuario: { rol } }) }));
vi.mock('../SeccionVouchersPedido', () => ({ SeccionVouchersPedido: () => <div data-testid="vouchers" /> }));
vi.mock('../../salon/componentes/clienteCuenta', () => ({ buscarCuentaPorTelefono: vi.fn() }));
vi.mock('../../mensajes/mensajesApi', () => ({ listarConversaciones: vi.fn() }));

import { DetalleVentaModal } from '../DetalleVentaModal';
import { comprobantesApi } from '../../comprobantes/comprobantesApi';
import { buscarCuentaPorTelefono } from '../../salon/componentes/clienteCuenta';
import { listarConversaciones } from '../../mensajes/mensajesApi';
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
    permisos = []; rol = 'CAJERO';
    vi.mocked(listarConversaciones).mockResolvedValue({ chats: [] } as any);
    vi.mocked(buscarCuentaPorTelefono).mockResolvedValue(null);
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
    expect(screen.getByText(/Latte \(Grande\)/)).toBeTruthy();
    expect(screen.getByText('Leche de avena')).toBeTruthy();
    expect(screen.getByText(/Promo dona/)).toBeTruthy();
    expect(screen.getByText('Propina (referencial)')).toBeTruthy();
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
    expect(screen.getByText(/Latte \(Grande\)/)).toBeTruthy();
  });

  it('error del pedido permite reintentar', async () => {
    const m = vi.spyOn(pedidosApi, 'obtenerPorId').mockRejectedValueOnce(new Error('caído')).mockResolvedValue(base);
    abrir();
    expect(await screen.findByText('caído')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(screen.getByText(/Latte \(Grande\)/)).toBeTruthy());
    expect(m).toHaveBeenCalledTimes(2);
  });

  it('Escape cierra', async () => {
    const alCerrar = vi.fn();
    render(<DetalleVentaModal pedidoId="7" alCerrar={alCerrar} />);
    await screen.findByText('P-0007');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(alCerrar).toHaveBeenCalled();
  });

  describe('Cliente y comprobantes', () => {
    const comp = (x: any) => ({
      id: '1', pedido_id: '7', codigo_pedido: 'P-0007', tipo: 'BOLETA', serie: 'B001', numero: 12, numero_texto: 'B001-12',
      documento: '12****78', razon_social: null, total: 35, fecha_lima: '10/11/2026 10:00', emision: 'EMITIDO',
      facturacion_estado: 'EMITIDO_SUNAT', simulado: false, baja_estado: null, baja_motivo: null, baja_en: null,
      anulado_en: null, anulado_motivo: null, tiene_xml: true, tiene_cdr: true, ...x,
    });
    const verCliente = async () => { abrir(); await screen.findByText('P-0007'); pestana('Cliente'); };

    it('boleta y factura con estado, documento enmascarado y descargas; la anulada va después', async () => {
      permisos = ['comprobantes/ver'];
      vi.spyOn(comprobantesApi, 'listarPorPedido').mockResolvedValue({ elementos: [
        comp({}),
        comp({ id: '2', tipo: 'FACTURA', serie: 'F001', numero_texto: 'F001-3', documento: '20****89', razon_social: 'Empresa Prueba SAC', pedido_id: '8', codigo_pedido: 'P-0008', facturacion_estado: 'PENDIENTE_ENVIO', tiene_cdr: false }),
        comp({ id: '3', numero_texto: 'B001-11', anulado_en: '2026-11-10T16:00:00Z', baja_estado: 'ACEPTADA', baja_motivo: 'Error de monto' }),
      ] } as any);
      await verCliente();
      expect(await screen.findByTestId('comprobante-B001-12')).toBeTruthy();
      expect(screen.getByText('Emitido SUNAT')).toBeTruthy();
      expect(screen.getByText('Pendiente de envío')).toBeTruthy();
      expect(screen.getByText('Anulado (baja aceptada)')).toBeTruthy();
      expect(screen.getByText(/Motivo: Error de monto/)).toBeTruthy();
      expect(screen.getByText('20****89')).toBeTruthy();
      expect(screen.getByText('Empresa Prueba SAC')).toBeTruthy();
      expect(screen.getByText('P-0008')).toBeTruthy();
      const orden = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));
      expect(orden).toEqual(['Boleta B001-12', 'Factura F001-3', 'Boleta B001-11']);
      expect(screen.getByRole('button', { name: 'Descargar XML firmado B001-12' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Descargar CDR de SUNAT B001-12' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Descargar CDR de SUNAT F001-3' })).toBeNull();
      expect(screen.getAllByRole('button', { name: /Ver PDF/ }).length).toBe(3);
    });

    it('sin comprobante electrónico: solo la nota de venta', async () => {
      permisos = ['comprobantes/ver'];
      vi.spyOn(comprobantesApi, 'listarPorPedido').mockResolvedValue({ elementos: [] });
      vi.spyOn(pedidosApi, 'obtenerPorId').mockResolvedValue({ ...base, comprobante_tipo: 'SIMPLE' });
      await verCliente();
      expect(await screen.findByTestId('comprobante-del-pedido')).toBeTruthy();
      expect(screen.getByText(/^Nota de venta/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Ver PDF/ })).toBeNull();
      expect(screen.getByRole('link', { name: 'Ver nota de venta térmica' }).getAttribute('href')).toContain('tab=nota&pedidoId=7');
    });

    it('sin permiso de Comprobantes no pide la lista ni muestra descargas', async () => {
      const m = vi.spyOn(comprobantesApi, 'listarPorPedido').mockResolvedValue({ elementos: [] });
      await verCliente();
      expect(await screen.findByTestId('comprobantes-pedido')).toBeTruthy();
      expect(m).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: /XML|CDR|PDF/ })).toBeNull();
      expect(screen.queryByRole('link', { name: /nota de venta térmica/ })).toBeNull();
    });

    it('error de la lista permite reintentar', async () => {
      permisos = ['comprobantes/ver'];
      const m = vi.spyOn(comprobantesApi, 'listarPorPedido').mockRejectedValueOnce(new Error('sin red')).mockResolvedValue({ elementos: [comp({})] } as any);
      await verCliente();
      expect(await screen.findByText('sin red')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
      expect(await screen.findByTestId('comprobante-B001-12')).toBeTruthy();
      expect(m).toHaveBeenCalledTimes(2);
    });

    it('RUC guardado enmascarado para el cajero y completo para el ADMIN', async () => {
      permisos = ['clientes/ver'];
      vi.mocked(buscarCuentaPorTelefono).mockResolvedValue({ party: '1', nombre: 'Ana', telefono: '999111222', puntos: 120, direcciones: [], facturacion: { ruc: '20123456789', razonSocial: 'Empresa Prueba SAC', direccion: null } });
      await verCliente();
      expect(await screen.findByText(/20\*\*\*\*89 · Empresa Prueba SAC/)).toBeTruthy();
      expect(screen.getByText('Con cuenta · 120 puntos')).toBeTruthy();
      cleanup();
      rol = 'ADMIN';
      await verCliente();
      expect(await screen.findByText(/20123456789 · Empresa Prueba SAC/)).toBeTruthy();
    });
  });

  describe('Botón de chat de WhatsApp', () => {
    const verCliente = async () => { abrir(); await screen.findByText('P-0007'); pestana('Cliente'); };

    it('con permiso de mensajes y chat existente abre la bandeja interna, sin mostrar el número', async () => {
      permisos = ['mensajes/ver'];
      vi.mocked(listarConversaciones).mockResolvedValue({ chats: [{ telefono: '51999111222' }] } as any);
      await verCliente();
      const a = await screen.findByRole('link', { name: 'Abrir chat de WhatsApp con Ana Prueba' });
      expect(a.getAttribute('href')).toBe('/admin/mensajes?telefono=999111222');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
      expect(a.textContent).toBe('Chat de WhatsApp');
    });

    it('sin permiso de mensajes o sin conversación abre wa.me en pestaña nueva', async () => {
      await verCliente();
      let a = await screen.findByRole('link', { name: 'Abrir chat de WhatsApp con Ana Prueba' });
      expect(a.getAttribute('href')).toBe('https://wa.me/51999111222');
      expect(a.getAttribute('target')).toBe('_blank');
      cleanup();
      permisos = ['mensajes/ver'];
      vi.mocked(listarConversaciones).mockResolvedValue({ chats: [] } as any);
      await verCliente();
      a = await screen.findByRole('link', { name: 'Abrir chat de WhatsApp con Ana Prueba' });
      expect(a.getAttribute('href')).toBe('https://wa.me/51999111222');
    });

    it('sin celular no hay botón', async () => {
      vi.spyOn(pedidosApi, 'obtenerPorId').mockResolvedValue({ ...base, cliente_telefono: null });
      await verCliente();
      expect(screen.getByText('Sin celular')).toBeTruthy();
      expect(screen.queryByRole('link', { name: /Abrir chat de WhatsApp/ })).toBeNull();
    });
  });

  describe('Pestañas y teclado', () => {
    it('cuatro pestañas con roles ARIA y flechas entre ellas', async () => {
      abrir();
      await screen.findByText('P-0007');
      const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
      expect(tabs).toEqual(['Venta', 'Cliente', 'Pagos', 'Tiempos']);
      expect(screen.getByRole('tablist')).toBeTruthy();
      expect(screen.getAllByRole('tabpanel', { hidden: true }).length).toBeGreaterThan(0);
      fireEvent.keyDown(screen.getByRole('tab', { name: 'Venta' }), { key: 'ArrowRight' });
      expect(screen.getByRole('tab', { name: 'Cliente' }).getAttribute('aria-selected')).toBe('true');
      fireEvent.keyDown(screen.getByRole('tab', { name: 'Cliente' }), { key: 'ArrowLeft' });
      expect(screen.getByRole('tab', { name: 'Venta' }).getAttribute('aria-selected')).toBe('true');
    });

    it('encabezado con estado y total, y botón Cerrar en el pie', async () => {
      const alCerrar = vi.fn();
      render(<DetalleVentaModal pedidoId="7" alCerrar={alCerrar} />);
      await screen.findByText('P-0007');
      expect(screen.getByText('Pagado')).toBeTruthy();
      expect(screen.getAllByText('S/ 35.00').length).toBeGreaterThan(0);
      fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' }).at(-1)!);
      expect(alCerrar).toHaveBeenCalled();
    });
  });
});
