import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, ESQUEMA_FLUJO_VERSION } from '../tipos-conversacion';

const base: ContextoConversacion = {
  nombreCliente: 'Ana',
  telefonoCliente: '51987654321',
  cartaUrlPublica: 'https://carta.caprichos.pe',
  datosLocal: { abierta: true, abre: '17:00', cierra: '23:00', textoEstado: '', direccion: 'x', enlaceMapa: 'x', telefono: '1' } as any,
  categoriasCarta: [],
};

const promos = (ctx: Partial<ContextoConversacion>) => {
  const r = transicionarEstado({ esquemaVersion: ESQUEMA_FLUJO_VERSION, estado: 'MENU', repreguntasFallidas: 0 } as any, normalizarEntrada({ texto: 'promociones' }), { ...base, ...ctx });
  expect(r.nuevoEstado).toBe('MENU');
  return JSON.stringify(r.acciones);
};

describe('Promociones por canal en el flujo del bot', () => {
  it('«promociones» nombra la oferta solo web con el enlace de la carta y no la ofrece como botón de pedido', () => {
    const t = promos({
      ofertas: [],
      ofertasSoloWeb: [{ nombre: 'Combo Web', vigenteAhora: true, tambienLocal: false }],
    });
    expect(t).toContain('Solo en nuestra carta web');
    expect(t).toContain('Combo Web');
    expect(t).toContain('https://carta.caprichos.pe');
    expect(t).not.toContain('ped_prod');
  });

  it('con promos de WhatsApp, web y local las separa en bloques', () => {
    const t = promos({
      ofertas: [{ nombre: 'Dona gratis', vigenteAhora: true, tipo: 'DESCUENTO' }],
      ofertasSoloWeb: [{ nombre: 'Web 10%', vigenteAhora: true }],
      ofertasSoloLocal: [{ nombre: 'Menú local', vigenteAhora: true }],
    });
    expect(t).toContain('las pides por aquí');
    expect(t).toContain('Solo en nuestra carta web');
    expect(t).toContain('Solo en el local');
  });

  it('sin ninguna promoción responde que no hay activas', () => {
    expect(promos({ ofertas: [] })).toContain('no tenemos promociones activas');
  });
});
