import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecuadroPagoCulqi } from '../RecuadroPagoCulqi';
import { CapaPago } from '../CapaPago';
import { TablaCaja, totalesDeFilas } from '../TablaCaja';
import { enMedios, MEDIOS_FILTRO, pagadoPorCulqi } from '../mediosFila';
import { COLUMNAS_CAJA } from '../columnasCaja';
import type { Pedido, PagoOnlineResumen } from '../pedidosApi';
import { vouchersApi } from '../../vouchers/vouchersApi';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../../creditos/creditosApi', () => ({ listarPersonalActivo: vi.fn().mockResolvedValue([]), registrarConsumoCredito: vi.fn() }));

const pago = (extra: Partial<PagoOnlineResumen> = {}): PagoOnlineResumen => ({
  medio: 'YAPE', marca: null, ultimos4: null, cargoId: 'chr_live_abc123', monto: 25, aprobadoEn: '2026-11-10T15:30:00Z', devuelto: 0, estado: 'APROBADO', modo: 'REAL', ...extra,
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: () => true, usuario: { rol: 'ADMIN' } } as any);
  vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([]);
});

describe('Recuadro «Pagado en línea por Culqi»', () => {
  it('Yape: medio, monto, hora de Lima, nº de operación, estado y enlace al panel de Culqi', () => {
    render(<RecuadroPagoCulqi pago={pago()} />);
    const r = screen.getByTestId('recuadro-culqi');
    expect(within(r).getByText('Pagado en línea por Culqi ✓')).toBeTruthy();
    expect(within(r).getByText('Yape')).toBeTruthy();
    expect(within(r).getByText('S/ 25.00')).toBeTruthy();
    expect(within(r).getByText(/10\/11.*10:30/)).toBeTruthy(); // 15:30 UTC = 10:30 Lima
    expect(screen.getByTestId('operacion-culqi').textContent).toBe('chr_live_abc123');
    expect(screen.getByTestId('estado-culqi').textContent).toBe('Aprobado');
    const enlace = within(r).getByRole('link', { name: 'Ver en Culqi' }) as HTMLAnchorElement;
    expect(enlace.href).toBe('https://panel.culqi.com/');
    expect(enlace.target).toBe('_blank');
  });

  it('tarjeta devuelta en parte: «Visa ···1111» y «Devuelto parcial»', () => {
    render(<RecuadroPagoCulqi pago={pago({ medio: 'TARJETA', marca: 'Visa', ultimos4: '1111', devuelto: 10, estado: 'DEVUELTO_PARCIAL' })} />);
    expect(screen.getByText('Visa ···1111')).toBeTruthy();
    expect(screen.getByTestId('estado-culqi').textContent).toMatch(/Devuelto parcial/);
  });

  it('el botón Copiar deja el número de operación en el portapapeles', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<RecuadroPagoCulqi pago={pago()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar número de operación' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('chr_live_abc123'));
    expect(await screen.findByText('Copiado')).toBeTruthy();
  });
});

const pedido = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'p-1', codigo: 'CP-C1', canal: 'CARTA', modalidad: 'LLEVAR', estado: 'COLA', pago_estado: 'PAGADO', pago_metodo: 'YAPE',
    total: 25, subtotal: 25, descuento: 0, cliente_nombre: 'Luz', creado_en: '2026-11-10T15:00:00Z', lineas: [], mediosPago: ['YAPE'],
    ...extra,
  }) as unknown as Pedido;

describe('Detalle del pedido (capa Pago)', () => {
  const props = { esMesa: false, estaPagado: true, cambioCobroPendiente: false, alRechazarCobroMozo: vi.fn(), alExito: vi.fn(), alActualizar: vi.fn() };

  it('con pago Culqi: muestra el recuadro y no pide voucher ni dice «falta captura»', async () => {
    render(
      <MemoryRouter>
        <CapaPago {...props} pedido={pedido({ pagoOnline: pago(), mediosCulqi: ['YAPE'], planPago: [{ medio: 'YAPE', monto: 25 }] })} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('recuadro-culqi')).toBeTruthy();
    expect(screen.queryByText(/Falta captura/)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Capturas de pago' })).toBeNull();
    expect(screen.getByText('Pagado por Culqi')).toBeTruthy();
    expect(screen.getAllByText('Yape · Culqi').length).toBeGreaterThan(0);
  });

  it('Yape manual (sin Culqi): sigue con su sección de capturas y sin recuadro', async () => {
    render(
      <MemoryRouter>
        <CapaPago {...props} pedido={pedido({ planPago: [{ medio: 'YAPE', monto: 25 }] })} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('recuadro-culqi')).toBeNull();
    expect(await screen.findByRole('region', { name: 'Capturas de pago' })).toBeTruthy();
  });
});

describe('Caja: chip «Yape · Culqi», totales aparte y filtro «Pagado por Culqi»', () => {
  const culqi = pedido({ id: 'a', codigo: 'CP-A', mediosCulqi: ['YAPE'], pagoOnline: pago() });
  const manual = pedido({ id: 'b', codigo: 'CP-B' });

  it('el chip del medio distingue Yape por Culqi del Yape manual', () => {
    render(<TablaCaja filas={[culqi, manual]} todas={[culqi, manual]} columnas={['codigo', 'medios']} alVerDetalle={() => undefined} />);
    const filas = screen.getAllByTestId('fila-caja');
    expect(within(filas[0]).getByText('Yape · Culqi')).toBeTruthy();
    expect(within(filas[0]).getByTestId('icono-culqi')).toBeTruthy();
    expect(within(filas[1]).getByText('Yape')).toBeTruthy();
    expect(within(filas[1]).queryByTestId('icono-culqi')).toBeNull();
  });

  it('los totales al pie separan «Yape · Culqi» del Yape; el total del filtro no cambia', () => {
    const t = totalesDeFilas([culqi, manual]);
    expect(t.porMedio).toEqual({ YAPE_CULQI: 25, YAPE: 25 });
    expect(t.total).toBe(50);
    render(<TablaCaja filas={[culqi, manual]} todas={[culqi, manual]} columnas={['codigo']} alVerDetalle={() => undefined} />);
    expect(screen.getByTestId('total-medio-YAPE_CULQI').textContent).toMatch(/Yape · Culqi.*25\.00/);
    expect(screen.getByTestId('total-medio-YAPE').textContent).toMatch(/25\.00/);
  });

  it('el filtro «Pagado por Culqi» deja solo los pedidos pagados por la pasarela', () => {
    expect(MEDIOS_FILTRO.some((m) => m.id === 'CULQI' && m.n === 'Pagado por Culqi')).toBe(true);
    expect(enMedios(culqi, ['CULQI'])).toBe(true);
    expect(enMedios(manual, ['CULQI'])).toBe(false);
    expect(enMedios(manual, ['YAPE'])).toBe(true);
    expect(pagadoPorCulqi(manual)).toBe(false);
  });

  it('la columna de texto de medios también dice «Yape · Culqi»', () => {
    const col = COLUMNAS_CAJA.find((c) => c.id === 'medios')!;
    expect(col.texto(culqi)).toBe('Yape · Culqi');
    expect(col.texto(manual)).toBe('Yape');
  });
});
