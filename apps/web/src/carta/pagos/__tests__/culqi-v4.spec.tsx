import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { culqiApi, opcionesCulqi, mensajeRechazo, URL_CULQI } from '../culqiApi';
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

describe('Culqi Checkout V4', () => {
  it('usa el script oficial', () => expect(URL_CULQI).toBe('https://checkout.culqi.com/js/v4'));
  it('apaga los medios que piden orden y usa los colores de Caprichos', () => {
    const o = opcionesCulqi(medios);
    expect(o.paymentMethods).toEqual({ tarjeta: true, yape: true, bancaMovil: false, agente: false, billetera: false, cuotealo: false });
    expect(o.style.bannerColor).toBe('#0B2C3E');
    expect(o.style.buttonBackground).toBe('#E67929');
    expect(o.style.buttonText).toBe('Pagar');
    expect(o.lang).toBe('auto');
  });
  it('mensajes simples por código', () => {
    expect(mensajeRechazo('insufficient_funds')).toBe('Tu banco rechazó el pago: fondos insuficientes.');
    for (const c of ['incorrect_cvv', 'stolen_card', 'lost_card', 'fraudulent', 'issuer_decline_operation', 'processing_error', 'invalid_card', 'contact_issuer'])
      expect(mensajeRechazo(c)).toMatch(/^Tu banco rechazó el pago: /);
    expect(mensajeRechazo('otro', 'Del servidor')).toBe('Del servidor');
  });
});

describe('3DS', () => {
  it('autentica y reenvía el cargo con autenticacion3ds', async () => {
    vi.spyOn(tres, 'autenticar3ds').mockResolvedValue({ eci: '05' });
    const cargo = vi.spyOn(culqiApi, 'cargo')
      .mockResolvedValueOnce({ estado: 'REQUIERE_3DS', mensaje: '', pedidoCodigo: 'A1' })
      .mockResolvedValueOnce({ estado: 'APROBADO', mensaje: '', pedidoCodigo: 'A1' });
    render(<PagarEnLinea pedidoId="p1" />);
    fireEvent.click(await screen.findByText('Probar tarjeta aprobada'));
    await screen.findByTestId('pago-aprobado');
    expect(cargo).toHaveBeenCalledTimes(2);
    expect(cargo.mock.calls[1][0]).toMatchObject({ autenticacion3ds: { eci: '05' } });
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
