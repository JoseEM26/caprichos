jest.mock('../../chatbot', () => ({ ConsumoWhatsappService: class {}, enmascararTelefono: jest.requireActual('../../chatbot/utilidades/enmascarar.util').enmascararTelefono }));
import { BadRequestException } from '@nestjs/common';
import { WhatsappAnalisisService, MAX_RACHAS_WHATSAPP } from './whatsapp.service';

const AHORA = new Date('2026-11-11T20:00:00Z'); // 15:00 Lima
const min = (base: string, m: number) => new Date(new Date(base).getTime() + m * 60000);

function servicio(respuestas: Record<string, any[]>, extra: { personas?: any[] } = {}) {
  const prisma: any = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      const clave = Object.keys(respuestas).find((k) => sql.includes(k));
      return clave ? respuestas[clave] : [];
    }),
    person: { findMany: jest.fn(async () => extra.personas ?? []) },
    whatsappMensaje: { groupBy: jest.fn(async () => []) },
  };
  const consumo: any = {
    obtener: jest.fn(async () => ({ mes: '2026-11', total: 120, gratisMes: 1000, porcentaje: 12, proyeccionFinDeMes: 330, costoEstimadoPen: 0 })),
  };
  return { s: new WhatsappAnalisisService(prisma, consumo), prisma, consumo };
}

// 14:00 Lima = 19:00 UTC
const T0 = '2026-11-11T19:00:00Z';
const rachas = [
  { inicio: T0, autor: 'PERSONA', respuesta: min(T0, 4), persona: '7' },
  { inicio: min(T0, 10), autor: 'PERSONA', respuesta: min(T0, 30), persona: '7' },
  { inicio: min(T0, 20), autor: 'PERSONA', respuesta: min(T0, 22), persona: '8' },
  { inicio: min(T0, 30), autor: 'BOT', respuesta: min(T0, 31), persona: null },
  { inicio: min(T0, 40), autor: null, respuesta: null, persona: null },
];

describe('WhatsappAnalisisService.resumen', () => {
  it('mide la espera humana (mediana y p90), separa bot y sin respuesta, y la agrupa por hora de Lima', async () => {
    const { s } = servicio({ 'LEFT JOIN LATERAL': rachas });
    const r = await s.resumen({ desde: '2026-11-11' }, false, AHORA);
    expect(r.respuesta).toMatchObject({ rachas: 5, atendidasPorPersona: 3, atendidasPorBot: 1, sinRespuesta: 1 });
    expect(r.respuesta.equipo).toMatchObject({ n: 3, mediana: 4, maximo: 20 });
    expect(r.respuesta.porHora).toHaveLength(24);
    expect(r.respuesta.porHora[14]).toMatchObject({ n: 3, mediana: 4 });
    expect(r.respuesta.porHora[3]).toMatchObject({ n: 0, mediana: null });
  });

  it('el supervisor no ve el desglose por persona; el ADMIN sí, con nombres', async () => {
    const { s: sup } = servicio({ 'LEFT JOIN LATERAL': rachas });
    expect((await sup.resumen({}, false, AHORA)).respuesta.personas).toBeNull();
    const { s, prisma } = servicio(
      { 'LEFT JOIN LATERAL': [...rachas, { inicio: T0, autor: 'PERSONA', respuesta: min(T0, 5), persona: null }] },
      { personas: [{ party_id: 7n, nombres: 'Ana', apellidos: 'Ruiz' }] },
    );
    const r = await s.resumen({}, true, AHORA);
    expect(prisma.person.findMany).toHaveBeenCalledTimes(1);
    expect(r.respuesta.personas).toEqual([
      expect.objectContaining({ id: '7', nombre: 'Ana Ruiz', n: 2 }),
      expect.objectContaining({ id: '8', nombre: 'Usuario', n: 1 }),
      expect.objectContaining({ id: 'sin', nombre: 'Sin identificar', n: 1 }),
    ]);
  });

  it('sin mensajes: ceros y medianas nulas, 24 horas en el volumen', async () => {
    const { s } = servicio({});
    const r = await s.resumen({}, true, AHORA);
    expect(r.respuesta).toMatchObject({ rachas: 0, equipo: { n: 0, mediana: null, p90: null }, personas: [] });
    expect(r.bot).toMatchObject({ chats: 0, pctSoloBot: null });
    expect(r.volumen).toHaveLength(24);
    expect(r.volumen.every((v) => v.cliente + v.bot + v.persona === 0)).toBe(true);
    expect(r.derivaciones).toEqual({ total: 0, motivos: [] });
    expect(r.salientes).toEqual({ total: 0, tipos: [], plantillas: [] });
  });

  it('bot vs persona: porcentajes sobre los chats con mensajes del cliente', async () => {
    const { s } = servicio({ 'bool_or(autor': [{ chats: 10, con_persona: 3, solo_bot: 6, sin_respuesta: 1 }] });
    const r = await s.resumen({}, false, AHORA);
    expect(r.bot).toEqual({ chats: 10, soloBot: 6, conPersona: 3, sinRespuesta: 1, pctSoloBot: 60, pctConPersona: 30, pctSinRespuesta: 10 });
  });

  it('derivaciones por motivo y volumen por hora', async () => {
    const { s } = servicio({
      nota_asesor: [
        { motivo: 'CONSULTA_IA_FALLIDA', n: 4, chats: 3 },
        { motivo: 'SIN_MOTIVO', n: 1, chats: 1 },
      ],
      'EXTRACT(HOUR FROM en': [{ hora: 14, cliente: 5, bot: 4, persona: 2 }],
    });
    const r = await s.resumen({}, false, AHORA);
    expect(r.derivaciones).toMatchObject({ total: 5, motivos: [{ motivo: 'CONSULTA_IA_FALLIDA', n: 4, chats: 3 }, expect.anything()] });
    expect(r.volumen[14]).toEqual({ hora: 14, cliente: 5, bot: 4, persona: 2 });
  });

  it('reutiliza el contador mensual de Meta', async () => {
    const { s, consumo } = servicio({});
    const r = await s.resumen({}, false, AHORA);
    expect(consumo.obtener).toHaveBeenCalledWith(AHORA);
    expect(r.consumoMes).toMatchObject({ mes: '2026-11', total: 120, gratisMes: 1000, porcentaje: 12 });
  });

  it('avisa si se pasa del tope de rachas', async () => {
    const muchas = Array.from({ length: MAX_RACHAS_WHATSAPP + 1 }, () => rachas[0]);
    const { s } = servicio({ 'LEFT JOIN LATERAL': muchas });
    const r = await s.resumen({}, false, AHORA);
    expect(r.respuesta.truncado).toBe(true);
    expect(r.respuesta.rachas).toBe(MAX_RACHAS_WHATSAPP);
  });

  it.each([{ desde: '2026-11-12' }, { desde: '2026-07-01', hasta: '2026-11-11' }, { desde: 'x' }])('rechaza el rango %j', async (f) => {
    const { s, prisma } = servicio({});
    await expect(s.resumen(f, false, AHORA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('WhatsappAnalisisService.sinRespuestaAhora', () => {
  it('enmascara el celular, calcula minutos y marca el motivo; sin nombres ni textos', async () => {
    const { s } = servicio({
      'FROM conversacion c': [
        { id: 1n, telefono: '51987654321', estado: 'ABIERTA', duenio: 'PERSONA', urgente: false, en: new Date(AHORA.getTime() - 30 * 60000) },
        { id: 2n, telefono: '51912345678', estado: 'VALIDAR_PAGO', duenio: 'PERSONA', urgente: true, en: new Date(AHORA.getTime() - 5 * 60000) },
      ],
    });
    const r = await s.sinRespuestaAhora(AHORA);
    expect(r.items).toEqual([
      { id: '1', celular: expect.any(String), minutos: 30, motivo: 'Con una persona', enlace: '/admin/mensajes' },
      { id: '2', celular: expect.any(String), minutos: 5, motivo: 'Validar pago', enlace: '/admin/mensajes' },
    ]);
    expect(JSON.stringify(r)).not.toContain('987654321');
    expect(r.hayMas).toBe(false);
  });

  it('lista vacía y tope con «hay más»', async () => {
    expect((await servicio({}).s.sinRespuestaAhora(AHORA)).items).toEqual([]);
    const filas = Array.from({ length: 51 }, (_, i) => ({ id: BigInt(i), telefono: '51987654321', estado: 'ABIERTA', duenio: 'PERSONA', urgente: true, en: AHORA }));
    const r = await servicio({ 'FROM conversacion c': filas }).s.sinRespuestaAhora(AHORA);
    expect(r.items).toHaveLength(50);
    expect(r.hayMas).toBe(true);
  });
});
