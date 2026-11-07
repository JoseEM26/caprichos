jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ConfigService } from '@nestjs/config';
import { WhatsAppMetaAdaptador } from '../adaptadores/whatsapp-meta.adaptador';
import { OutboxWhatsappService } from '../servicios/outbox-whatsapp.service';
import { TEXTOS_BOT } from '../conversacion/textos-bot';
import { ofertasFueraDeWhatsapp } from '../utilidades/ofertas-canal.util';
import { codigoInternoDeMeta } from '../utilidades/meta-errores.util';
import { mapearErrorWhatsApp } from '../../mensajes/utilidades/error-whatsapp.util';

const errorMeta = (code: number, message: string) => JSON.stringify({ error: { code, message } });

describe('Revisión del chatbot: errores de Meta', () => {
  const adaptador = new WhatsAppMetaAdaptador(
    { get: (_k: string, d: unknown) => d } as unknown as ConfigService,
    {} as any,
  );

  it('código 100 con un destinatario normal es PARAMETRO_INVALIDO, no un BSUID', () => {
    const r = adaptador.clasificarErrorMeta(400, errorMeta(100, 'Invalid parameter'), false);
    expect(r.codigo).toBe('PARAMETRO_INVALIDO');
    expect(r.reintentable).toBe(false);
  });

  it('código 100 con BSUID real sigue pidiendo el número de celular', () => {
    expect(adaptador.clasificarErrorMeta(400, errorMeta(100, 'Invalid parameter'), true).codigo).toBe('BSUID_NO_PERMITIDO');
  });

  it('131030 («Recipient phone number not in allowed list») es DESTINATARIO_NO_VERIFICADO, no BSUID', () => {
    const r = adaptador.clasificarErrorMeta(400, errorMeta(131030, 'Recipient phone number not in allowed list'), false);
    expect(r.codigo).toBe('DESTINATARIO_NO_VERIFICADO');
  });

  it.each([131000, 131016])('%i (fallo pasajero de Meta) se reintenta', (code) => {
    const r = adaptador.clasificarErrorMeta(400, errorMeta(code, 'Something went wrong'), false);
    expect(r.reintentable).toBe(true);
  });

  it('131056 (demasiados mensajes al mismo número) se reintenta', () => {
    expect(adaptador.clasificarErrorMeta(400, errorMeta(131056, 'Pair rate limit hit'), false).reintentable).toBe(true);
  });

  it('el motivo en español de 131049 y PARAMETRO_INVALIDO no es genérico', () => {
    expect(mapearErrorWhatsApp('ERROR_META', '[131049] This message was not delivered to maintain healthy ecosystem engagement')).toMatch(/calidad/);
    expect(mapearErrorWhatsApp('PARAMETRO_INVALIDO', 'x')).toMatch(/dato del mensaje/);
    expect(mapearErrorWhatsApp('ERROR_META', '[131000] Something went wrong')).toMatch(/fallo pasajero/);
  });

  it('un número de pedido con «190» ya no se confunde con token vencido', () => {
    expect(mapearErrorWhatsApp('ERROR_META', 'Error con 51987190123')).not.toMatch(/vencio/);
  });

  it('codigoInternoDeMeta clasifica los códigos del webhook', () => {
    expect(codigoInternoDeMeta('131047')).toBe('FUERA_DE_VENTANA_24H');
    expect(codigoInternoDeMeta('131026')).toBe('NUMERO_INVALIDO');
    expect(codigoInternoDeMeta('132001', 'template does not exist')).toBe('PLANTILLA_NO_APROBADA');
    expect(codigoInternoDeMeta(null)).toBe('ERROR_META');
    expect(codigoInternoDeMeta('999999')).toBe('ERROR_META');
  });
});

describe('Revisión del chatbot: falla asíncrona de un saliente', () => {
  const armar = (fila: any) => {
    const prisma: any = {
      salienteWhatsapp: {
        findFirst: jest.fn(async () => fila),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      parametro: { findUnique: jest.fn(async () => ({ valor: 'si' })) },
      notificacion: { create: jest.fn(async () => ({ id: BigInt(1) })) },
    };
    return { prisma, servicio: new OutboxWhatsappService(prisma, {} as any, {} as any) };
  };
  const fila = { id: BigInt(4), origen: 'AVISO_PEDIDO', telefono_destino: '51999111222', carga: { pedidoCodigo: 'CP-0001' } };

  it('un ENVIADO que Meta después no entregó pasa a FALLIDO con su motivo y avisa a Caja y Admin', async () => {
    const { prisma, servicio } = armar(fila);
    expect(await servicio.marcarFalloAsincrono('wamid.1', '131047', 'Re-engagement message')).toBe(true);
    const data = prisma.salienteWhatsapp.updateMany.mock.calls[0][0].data;
    expect(data.estado).toBe('FALLIDO');
    expect(data.ultimo_error).toBe('[FUERA_DE_VENTANA_24H] [131047] Re-engagement message');
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(2);
  });

  it('si el mensaje no es del outbox no hace nada', async () => {
    const { prisma, servicio } = armar(null);
    expect(await servicio.marcarFalloAsincrono('wamid.2', '131047', 'x')).toBe(false);
    expect(prisma.salienteWhatsapp.updateMany).not.toHaveBeenCalled();
  });
});

describe('Promociones por canal en el bot', () => {
  const oferta = (nombre: string, canales: string[], extra: Record<string, unknown> = {}) => ({
    nombre,
    tipo: 'DESCUENTO',
    activo: true,
    vigenteAhora: true,
    canales,
    descripcion: null,
    ...extra,
  });
  const CARTA = 'https://caprichos.pe/carta';
  const texto = (todas: any[], porWhatsapp: any[] = todas.filter((o) => o.canales.includes('BOT'))) =>
    TEXTOS_BOT.promocionesHoy(porWhatsapp as any, { ...ofertasFueraDeWhatsapp(todas), cartaUrl: CARTA } as any);

  it('una oferta solo de la carta web se dice «solo en nuestra carta web» con el enlace y no entra en las de WhatsApp', () => {
    const t = texto([oferta('2x1 Web', ['CARTA'])]);
    expect(t).toContain('Solo en nuestra carta web');
    expect(t).toContain('2x1 Web');
    expect(t).toContain(`👉 ${CARTA}`);
    expect(t).not.toContain('Vigentes hoy');
    expect(t).not.toContain('Solo en el local');
  });

  it('una oferta solo del local sale en su sección y no menciona la carta web', () => {
    const t = texto([oferta('Menú del día', ['ADMIN'])]);
    expect(t).toContain('Solo en el local');
    expect(t).toContain('Menú del día');
    expect(t).not.toContain('carta web');
  });

  it('una oferta de WhatsApp se lista como «las pides por aquí» y nunca como solo web', () => {
    const t = texto([oferta('Dona gratis', ['CARTA', 'ADMIN', 'BOT'])]);
    expect(t).toContain('las pides por aquí');
    expect(t).toContain('Dona gratis');
    expect(t).not.toContain('Solo en nuestra carta web');
  });

  it('mixtas: cada una en su bloque y la web+local lo indica', () => {
    const t = texto([
      oferta('Con bot', ['BOT', 'CARTA']),
      oferta('Web', ['CARTA']),
      oferta('Web y local', ['CARTA', 'ADMIN']),
      oferta('Local', ['ADMIN']),
    ]);
    expect(t.indexOf('Con bot')).toBeLessThan(t.indexOf('Web'));
    expect(t).toMatch(/\*Web y local\*.*\(y en el local\)/);
    expect(t.match(/Con bot/g)).toHaveLength(1);
    expect(t.indexOf('Solo en el local')).toBeGreaterThan(t.indexOf('Solo en nuestra carta web'));
  });

  it('el envío gratis solo web también se nombra', () => {
    const t = texto([oferta('Envío gratis web', ['CARTA'], { tipo: 'ENVIO_GRATIS' })]);
    expect(t).toContain('Envío gratis web');
    expect(t).toContain('Solo en nuestra carta web');
  });

  it('sin ofertas no hay promociones activas', () => {
    expect(texto([], [])).toMatch(/no tenemos promociones activas/);
  });

  it('vencidas o desactivadas no aparecen como solo web ni solo local', () => {
    const fuera = ofertasFueraDeWhatsapp([
      oferta('Vencida', ['CARTA'], { vigenteAhora: false }),
      oferta('Apagada', ['CARTA'], { activo: false }),
      oferta('Combo agotado', ['CARTA'], { tipo: 'COMBO', disponible: false }),
    ]);
    expect(fuera.soloWeb).toHaveLength(0);
    expect(fuera.soloLocal).toHaveLength(0);
    expect(texto([oferta('Vencida', ['CARTA'], { vigenteAhora: false })], [])).toMatch(/no tenemos promociones activas/);
  });

  it('una oferta vencida de WhatsApp va en «hoy no aplican» sin repetir el motivo', () => {
    const t = texto([oferta('Martes', ['BOT'], { vigenteAhora: false, diasTexto: 'Martes' })]);
    expect(t).toContain('hoy no aplican');
    expect(t).toContain('(aplica: Martes)');
    expect(t).not.toMatch(/Hoy no aplica \(Hoy no aplica\)/);
  });

  it('nunca pasa de 1024 caracteres, conserva el enlace de la carta y avisa que hay más', () => {
    const muchas = Array.from({ length: 40 }, (_, i) => oferta(`Promo web número ${i}`, ['CARTA'], { descripcion: 'Descuento especial por tiempo limitado' }));
    const t = texto(muchas);
    expect(t.length).toBeLessThanOrEqual(1024);
    expect(t).toContain(CARTA);
    expect(t).toContain('…y más promociones');
    expect(t).toContain('Promo web número 0');
  });
});
