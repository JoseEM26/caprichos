import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { culqiApi, configCulqi, mensajeRechazo, URL_CULQI } from '../culqiApi';
import * as tres from '../culqi3ds';
import { PagarEnLinea } from '../PagarEnLinea';

const medios = ['TARJETA', 'YAPE'] as any;
const real = { activo: true, publicKey: 'pk_test_x', modo: 'SIMULADO' as const, medios };
const intento = { intentoId: 'i1', montoCentimos: 2500, moneda: 'PEN' as const, descripcion: 'x', publicKey: 'pk_test_x', modo: 'SIMULADO' as const, medios };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(culqiApi, 'config').mockResolvedValue(real);
  vi.spyOn(culqiApi, 'intento').mockResolvedValue(intento);
});
afterEach(() => vi.restoreAllMocks());

describe('Culqi Checkout Custom embebido', () => {
  it('usa el script oficial del Checkout Custom', () => expect(URL_CULQI).toBe('https://js.culqi.com/checkout-js'));
  it('va embebido en el contenedor, sin modal, con solo tarjeta y Yape y los colores de Caprichos', () => {
    const c = configCulqi({ moneda: 'PEN', montoCentimos: 2500, medios });
    expect(c.options.modal).toBe(false);
    expect(c.options.container).toBe('#culqi-container');
    expect(c.options.paymentMethods).toEqual({ tarjeta: true, yape: true, bancaMovil: false, agente: false, billetera: false, cuotealo: false });
    expect(c.options.paymentMethodsSort).toEqual(['tarjeta', 'yape']);
    expect(c.settings).toEqual({ title: 'Caprichos', currency: 'PEN', amount: 2500 });
    expect(c.appearance.defaultStyle.buttonBackground).toBe('#E67929');
    expect(c.appearance.defaultStyle.bannerColor).toBe('#0B2C3E');
    expect(c.appearance.variables.colorBackground).toBe('#FBF4EC');
  });
  it('mensajes simples por código', () => {
    expect(mensajeRechazo('insufficient_funds')).toBe('Tu banco rechazó el pago: fondos insuficientes.');
    for (const c of ['incorrect_cvv', 'stolen_card', 'lost_card', 'fraudulent', 'issuer_decline_operation', 'processing_error', 'invalid_card', 'contact_issuer'])
      expect(mensajeRechazo(c)).toMatch(/^Tu banco rechazó el pago: /);
    expect(mensajeRechazo('otro', 'Del servidor')).toBe('Del servidor');
  });
});

describe('3DS', () => {
  it('autenticar3ds entrega solo los campos de parameters3DS', async () => {
    const lib = { generateDevice: vi.fn().mockResolvedValue('dev_9'), initAuthentication: vi.fn(() =>
      window.dispatchEvent(new MessageEvent('message', { data: { parameters3DS: { cavv: 'c', eci: '05', xid: 'x', protocolVersion: '2', directoryServerTransactionId: 'd', otro: 'no' } } }))) };
    (window as any).Culqi3DS = lib;
    const s = document.createElement('script'); s.src = tres.URL_CULQI_3DS; document.head.appendChild(s);
    const p = tres.autenticar3ds('pk', 'tkn', { montoCentimos: 100 });
    s.dispatchEvent(new Event('load'));
    for (const el of Array.from(document.head.querySelectorAll('script'))) el.dispatchEvent(new Event('load'));
    expect(await p).toEqual({ cavv: 'c', eci: '05', xid: 'x', protocolVersion: '2', directoryServerTransactionId: 'd' });
    expect(await tres.obtenerDeviceId()).toBe('dev_9');
    delete (window as any).Culqi3DS;
  });
  it('autentica y reenvía el cargo con autenticacion3ds', async () => {
    vi.spyOn(tres, 'autenticar3ds').mockResolvedValue({ eci: '05' });
    vi.spyOn(tres, 'obtenerDeviceId').mockResolvedValue('dev_1');
    const cargo = vi.spyOn(culqiApi, 'cargo')
      .mockResolvedValueOnce({ estado: 'REQUIERE_3DS', mensaje: '', pedidoCodigo: 'A1', datos3ds: { montoCentimos: 2500, moneda: 'PEN', email: 'a@b.pe', publicKey: 'pk_test_x' } })
      .mockResolvedValueOnce({ estado: 'APROBADO', mensaje: '', pedidoCodigo: 'A1' });
    render(<PagarEnLinea pedidoId="p1" />);
    fireEvent.click(await screen.findByText('Probar tarjeta aprobada'));
    await screen.findByTestId('pago-aprobado');
    expect(cargo).toHaveBeenCalledTimes(2);
    expect(cargo.mock.calls[1][0]).toMatchObject({ autenticacion3ds: { eci: '05' }, deviceId: 'dev_1' });
  });
  it('si la verificación falla muestra el error y deja reintentar', async () => {
    vi.spyOn(tres, 'autenticar3ds').mockRejectedValue(new Error('Tu banco no pudo verificar la tarjeta.'));
    vi.spyOn(culqiApi, 'cargo').mockResolvedValue({ estado: 'REQUIERE_3DS', mensaje: '', pedidoCodigo: 'A1' });
    render(<PagarEnLinea pedidoId="p1" />);
    fireEvent.click(await screen.findByText('Probar tarjeta aprobada'));
    expect((await screen.findByTestId('pago-error')).textContent).toMatch(/no pudo verificar/);
  });
  it('rechazo con código muestra el mensaje simple', async () => {
    vi.spyOn(culqiApi, 'cargo').mockResolvedValue({ estado: 'RECHAZADO', mensaje: 'x', codigo: 'insufficient_funds', pedidoCodigo: 'A1' });
    render(<PagarEnLinea pedidoId="p1" />);
    fireEvent.click(await screen.findByText('Probar tarjeta rechazada'));
    expect((await screen.findByTestId('pago-rechazado')).textContent).toMatch(/fondos insuficientes/);
  });
});
