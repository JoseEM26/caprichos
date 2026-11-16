jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { IaHerramientasService } from '../ia-herramientas.service';
import { mediosActivos, listaMediosTexto } from '../../conversacion/flujos/pedido/pago-bot.util';
import { normalizarMediosPagoCanal } from '@caprichos/compartido';

/** El bot nunca menciona ni ofrece la pasarela (Culqi / pago en línea), aunque el interruptor esté encendido. */
const canal = normalizarMediosPagoCanal({
  BOT: { EFECTIVO: true, YAPE: true, TRANSFERENCIA: true, PLIN: false, TARJETA: false, PAGO_EN_LINEA: true },
  CARTA: { PAGO_EN_LINEA: true },
});

describe('Bot sin pasarela', () => {
  it('mediosActivos no incluye la pasarela ni los medios apagados del bot', () => {
    const m = mediosActivos({ mediosPagoCanal: canal });
    expect(m).toEqual(['EFECTIVO', 'YAPE', 'TRANSFERENCIA']);
    expect(listaMediosTexto(m)).not.toMatch(/l[ií]nea|culqi|pasarela/i);
  });

  it('la herramienta mediosDePago de la IA ofrece solo lo encendido en el bot, sin pasarela', async () => {
    const prisma: any = { parametro: { findUnique: jest.fn().mockResolvedValue(null) } };
    const local: any = { obtenerDatosPublicosLocal: jest.fn().mockResolvedValue({ mediosPagoCanal: canal, mediosPagoVisibles: {} }) };
    const r = await new IaHerramientasService(prisma, undefined, undefined, local).mediosDePago();
    const texto = JSON.stringify(r);
    expect(r.mediosDisponibles.map((x: any) => x.metodo)).toEqual(['Yape', 'Transferencia BCP', 'Efectivo contra entrega']);
    expect(texto).not.toMatch(/l[ií]nea|culqi|pasarela|plin|POS/i);
  });
});
