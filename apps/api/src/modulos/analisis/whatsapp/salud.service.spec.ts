import { SaludBotAnalisisService, nivelDeUso } from './salud.service';
import { hashTelefono } from '../../chatbot/utilidades/enmascarar.util';

const AHORA = new Date('2026-11-11T20:00:00Z'); // 15:00 Lima

function servicio(respuestas: Record<string, any[]>, extra: { parametros?: any[]; entrantes?: any[]; auditoria?: any[] } = {}) {
  const prisma: any = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      const clave = Object.keys(respuestas).find((k) => sql.includes(k));
      return clave ? respuestas[clave] : [];
    }),
    parametro: { findMany: jest.fn(async () => extra.parametros ?? []) },
    whatsappMensaje: { groupBy: jest.fn(async () => extra.entrantes ?? []) },
    auditoria: { findMany: jest.fn(async () => extra.auditoria ?? []) },
  };
  return { s: new SaludBotAnalisisService(prisma), prisma };
}

describe('nivelDeUso', () => {
  it('70 % atención, 90 % crítico, sin tope no alerta', () => {
    expect(nivelDeUso(69.9)).toBe('ok');
    expect(nivelDeUso(70)).toBe('atencion');
    expect(nivelDeUso(90)).toBe('critico');
    expect(nivelDeUso(null)).toBe('ok');
  });
});

describe('SaludBotAnalisisService.resumen', () => {
  it('sin datos: ceros, un día, 24 horas y recomendación de que todo está en orden', async () => {
    const { s } = servicio({});
    const r = await s.resumen({ desde: '2026-11-11' }, AHORA);
    expect(r.topes).toEqual({ minuto: 3, hora: 60, dia: 350 });
    expect(r.proveedor).toBe('META');
    expect(r.porDia).toHaveLength(1);
    expect(r.porHoraDelDia).toHaveLength(24);
    expect(r.cola).toMatchObject({ enviados: 0, fallidos: 0, pctFallidos: null });
    expect(r.recomendaciones).toEqual([expect.objectContaining({ nivel: 'info' })]);
  });

  it('usa los topes de Configuración y alerta al pasar 70 % y 90 % del tope diario', async () => {
    const { s } = servicio(
      {
        "to_char(date_trunc('hour'": [
          { h: '2026-11-10T10', n: 40 },
          { h: '2026-11-10T11', n: 40 },
          { h: '2026-11-11T10', n: 20 },
        ],
        "GROUP BY date_trunc('minute'": [{ n: 4 }],
      },
      { parametros: [{ clave: 'evolution_limite_dia', valor: 100 }, { clave: 'whatsapp_proveedor', valor: 'evolution' }] },
    );
    const r = await s.resumen({ desde: '2026-11-10', hasta: '2026-11-11' }, AHORA);
    expect(r.proveedor).toBe('EVOLUTION');
    expect(r.topes.dia).toBe(100);
    expect(r.porDia).toEqual([
      { fecha: '2026-11-10', enviados: 80, pct: 80, nivel: 'atencion' },
      { fecha: '2026-11-11', enviados: 20, pct: 20, nivel: 'ok' },
    ]);
    expect(r.uso.dia).toMatchObject({ max: 80, fecha: '2026-11-10', nivel: 'atencion' });
    expect(r.uso.minuto).toMatchObject({ max: 4, tope: 3, nivel: 'critico' });
    expect(r.porHoraDelDia[10]).toMatchObject({ total: 60, pico: 40 });
    expect(r.recomendaciones.some((x) => x.nivel === 'alta' && /por minuto/.test(x.texto))).toBe(true);
    expect(r.recomendaciones.some((x) => x.nivel === 'media' && /diario/.test(x.texto))).toBe(true);
  });

  it('cola: estados y motivos de descarte', async () => {
    const { s } = servicio({
      'GROUP BY 1, 2': [
        { estado: 'ENVIADO', codigo: null, n: 70 },
        { estado: 'DESCARTADO', codigo: 'FUERA_DE_VENTANA_24H', n: 20 },
        { estado: 'DESCARTADO', codigo: 'SIN_CONTACTO_PREVIO', n: 5 },
        { estado: 'FALLIDO', codigo: 'NUMERO_INVALIDO', n: 5 },
        { estado: 'PENDIENTE', codigo: null, n: 3 },
      ],
    });
    const r = await s.resumen({}, AHORA);
    expect(r.cola).toMatchObject({ enviados: 70, descartados: 25, fallidos: 5, pendientes: 3, pctFallidos: 5 });
    expect(r.cola.motivosDescartados[0]).toEqual({ codigo: 'FUERA_DE_VENTANA_24H', n: 20 });
  });

  it('separa respuestas, pedidos del cliente, equipo e iniciados; cuenta números que nunca escribieron sin exponer celulares', async () => {
    const escribio = '51911111111';
    const nunca = '51922222222';
    const { s } = servicio(
      {
        'SELECT origen, COUNT': [
          { origen: 'AUTORESPUESTA', n: 10 },
          { origen: 'CODIGO_CUENTA', n: 2 },
          { origen: 'ALERTA_ADMIN', n: 3 },
          { origen: 'AVISO_PEDIDO', n: 15 },
        ],
        'MIN(enviado_en) AS primero': [
          { tel: escribio, primero: new Date('2026-11-11T15:00:00Z'), n: 10 },
          { tel: nunca, primero: new Date('2026-11-11T15:00:00Z'), n: 5 },
        ],
        'FROM mensaje_chat WHERE autor = \'CLIENTE\'': [{ n: 40 }],
      },
      { entrantes: [{ telefono_hash: hashTelefono(escribio), _min: { creado_en: new Date('2026-11-11T14:00:00Z') } }] },
    );
    const r = await s.resumen({}, AHORA);
    expect(r.proporcion).toMatchObject({ totalEnviados: 30, respuestas: 10, pedidosPorElCliente: 2, alEquipo: 3, iniciados: 15, pctIniciados: 50, entrantes: 40 });
    expect(r.proporcion.sinContactoPrevio).toMatchObject({ numeros: 1, mensajes: 5 });
    expect(JSON.stringify(r)).not.toContain(nunca);
    expect(r.recomendaciones.some((x) => /nunca escribieron/.test(x.texto))).toBe(true);
  });

  it('bot: IA, menú como resto, turnos por conversación, pausas desde la auditoría y encuesta', async () => {
    const { s } = servicio(
      {
        'AS aviso_pedido': [{ total: 100, cerrado: 10, bienvenida: 5, encuesta: 5, aviso_pedido: 20 }],
        'FROM ia_consumo': [{ turnos: 30, conversaciones: 10, maximo: 7, derivados: 2, errores: 1 }],
        'COUNT(DISTINCT conversacion_id)': [{ n: 4 }],
        'FROM encuesta_posventa': [{ enviadas: 20, respondidas: 8, promedio: '4.25' }],
      },
      { auditoria: [{ accion: 'pausa_automatica', en: new Date('2026-11-11T12:00:00Z'), despues: { motivo: 'FALLOS' } }, { accion: 'reconexion', en: new Date('2026-11-11T12:10:00Z'), despues: null }] },
    );
    const r = await s.resumen({}, AHORA);
    expect(r.bot).toMatchObject({ cerrado: 10, encuesta: 5, avisoPedido: 20, ia: 30, menu: 30, derivadasAPersona: 4 });
    expect(r.bot.turnosPorConversacion).toEqual({ conversaciones: 10, promedio: 3, maximo: 7 });
    expect(r.conexion).toMatchObject({ pausasAutomaticas: 1, reconexiones: 1 });
    expect(r.conexion.ultimos[1].motivo).toBeNull();
    expect(r.encuestas).toEqual({ enviadas: 20, respondidas: 8, tasaRespuesta: 40, promedio: 4.25 });
    expect(r.recomendaciones.some((x) => /se pausó solo/.test(x.texto))).toBe(true);
  });
});
