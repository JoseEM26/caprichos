jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ConsumoWhatsappService, mesLima } from '../configuracion/consumo-whatsapp.service';

function montar(filasPorEstado: { creado_en: Date; tipo: string; plantilla?: string; estado: string }[], params: Record<string, number> = {}) {
  const marcas = new Set<string>();
  const notificaciones: any[] = [];
  const prisma: any = {
    parametro: {
      findUnique: async ({ where }: any) => (where.clave in params ? { valor: params[where.clave] } : null),
      create: async ({ data }: any) => {
        if (marcas.has(data.clave)) throw new Error('P2002');
        marcas.add(data.clave);
      },
      upsert: async ({ where, create }: any) => { params[where.clave] = create.valor; },
    },
    whatsappMensaje: {
      groupBy: async ({ where }: any) => {
        const g: Record<string, any> = {};
        for (const f of filasPorEstado) {
          if (!where.estado.in.includes(f.estado) || f.creado_en < where.creado_en.gte || f.creado_en >= where.creado_en.lt) continue;
          const k = `${f.tipo}|${f.plantilla ?? ''}`;
          g[k] ??= { tipo: f.tipo, plantilla: f.plantilla ?? null, _count: { _all: 0 } };
          g[k]._count._all++;
        }
        return Object.values(g);
      },
    },
    notificacion: { create: async ({ data }: any) => { notificaciones.push(data); return { id: BigInt(notificaciones.length) }; } },
  };
  return { svc: new ConsumoWhatsappService(prisma), notificaciones };
}
const filas = (n: number, extra: any = {}, cuando = new Date('2026-10-10T15:00:00Z')) =>
  Array.from({ length: n }, () => ({ creado_en: cuando, tipo: 'TEXTO', estado: 'ENVIADO', ...extra }));

describe('consumo mensual de WhatsApp', () => {
  const ahora = new Date('2026-10-15T15:00:00Z');

  it('el mes es el calendario de Lima: 1 oct 00:00 Lima = 05:00 UTC', () => {
    expect(mesLima(new Date('2026-11-01T04:59:00Z')).mes).toBe('2026-10');
    expect(mesLima(new Date('2026-11-01T05:00:00Z')).mes).toBe('2026-11');
  });

  it('cuenta solo enviados reales del mes Lima; separa servicio y plantillas; excluye simulados y fallidos', async () => {
    const { svc } = montar([
      ...filas(3),
      ...filas(2, { estado: 'ENTREGADO' }),
      ...filas(4, { tipo: 'PLANTILLA', plantilla: 'aviso_pedido' }),
      ...filas(5, { estado: 'SIMULADO' }),
      ...filas(6, { estado: 'FALLIDO' }),
      ...filas(7, { estado: 'ENCOLADO' }),
      ...filas(8, {}, new Date('2026-10-01T04:00:00Z')), // 30 sep 23:00 Lima: mes anterior
      ...filas(9, {}, new Date('2026-11-01T05:00:00Z')), // mes siguiente
    ]);
    const c = await svc.obtener(ahora);
    expect(c).toMatchObject({ mes: '2026-10', servicio: 5, plantillas: 4, plantillasPorTipo: { aviso_pedido: 4 }, gratisMes: 1000, avisoPct: 80 });
    expect(c.proyeccionFinDeMes).toBeGreaterThan(9);
  });

  it('aviso al 80 % y al 100 %: una sola notificación ADMIN por umbral y mes', async () => {
    const todas = filas(800);
    const { svc, notificaciones } = montar(todas);
    expect(await svc.revisarAvisos(ahora)).toEqual(['AVISO']);
    expect(await svc.revisarAvisos(ahora)).toEqual([]);
    expect(notificaciones).toHaveLength(1);
    expect(notificaciones[0]).toMatchObject({ rol_destino: 'ADMIN', tipo: 'WHATSAPP_CONSUMO' });
    expect(notificaciones[0].mensaje).toContain('Ya se enviaron 800 de 1.000'.replace('1.000', (1000).toLocaleString('es-PE')));
    todas.push(...filas(200));
    expect(await svc.revisarAvisos(ahora)).toEqual(['TOPE']);
    expect(await svc.revisarAvisos(ahora)).toEqual([]);
    expect(notificaciones).toHaveLength(2);
    // mes siguiente con consumo propio: vuelve a avisar
    todas.push(...filas(800, {}, new Date('2026-11-03T15:00:00Z')));
    expect(await svc.revisarAvisos(new Date('2026-11-10T15:00:00Z'))).toEqual(['AVISO']);
  });

  it('el tope y el umbral son configurables', async () => {
    const { svc, notificaciones } = montar(filas(50), { wa_gratis_mes: 100, wa_aviso_pct: 50 });
    expect((await svc.obtener(ahora)).porcentaje).toBe(50);
    expect(await svc.revisarAvisos(ahora)).toEqual(['AVISO']);
    expect(notificaciones).toHaveLength(1);
  });
});
