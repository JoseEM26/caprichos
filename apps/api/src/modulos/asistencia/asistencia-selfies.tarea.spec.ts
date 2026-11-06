import { AsistenciaSelfiesTarea } from './asistencia-selfies.tarea';

const DIA = 86_400_000;
// 06/11/2026 08:30 UTC = 03:30 en Lima (UTC-5, sin horario de verano)
const TRES_Y_MEDIA = new Date('2026-11-06T08:30:00Z');
const DOS_DE_LA_MANANA = new Date('2026-11-06T07:00:00Z');

function armar(opts: { retencionDias?: number; fotosVencidas?: bigint[][]; deleteFallaUnaVez?: boolean; redisOcupado?: boolean } = {}) {
  const store = new Map<string, string>();
  const cliente = {
    set: jest.fn(async (k: string, v: string, _px: string, _ttl: number, _nx: string) => {
      if (opts.redisOcupado || store.has(k)) return null;
      store.set(k, v);
      return 'OK';
    }),
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    eval: jest.fn(async (_s: string, _n: number, k: string, v: string) => {
      if (store.get(k) === v) { store.delete(k); return 1; }
      return 0;
    }),
    del: jest.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
  };
  const lotes = [...(opts.fotosVencidas ?? [])];
  let fallo = opts.deleteFallaUnaVez === true;
  const prisma = {
    asistenciaSelfie: {
      findMany: jest.fn(async () => (lotes.shift() ?? []).map((marca_id) => ({ marca_id }))),
      deleteMany: jest.fn(async ({ where }: any) => {
        if (fallo) {
          fallo = false;
          throw new Error('caída de base');
        }
        return { count: where.marca_id.in.length };
      }),
    },
    // Sin asistenciaMarca: si la tarea intentara borrar una marca, la prueba falla
  };
  const asistencia = { obtenerConfig: jest.fn(async () => ({ retencionDias: opts.retencionDias ?? 90 })) };
  const auditoria = { registrar: jest.fn(async () => undefined) };
  const redis = { obtenerCliente: () => cliente };
  const tarea = new AsistenciaSelfiesTarea(prisma as any, redis as any, asistencia as any, auditoria as any);
  return { tarea, prisma, asistencia, auditoria, cliente };
}

describe('AsistenciaSelfiesTarea (limpieza diaria de fotos)', () => {
  it('borra solo las fotos de marcas vencidas, en el corte de la retención, y nunca toca la marca', async () => {
    const { tarea, prisma } = armar({ retencionDias: 90, fotosVencidas: [[1n, 2n], []] });
    const r = await tarea.revisar(TRES_Y_MEDIA);
    expect(r).toEqual({ ejecutada: true, fotosBorradas: 2 });
    const corte = new Date(TRES_Y_MEDIA.getTime() - 90 * DIA);
    expect(prisma.asistenciaSelfie.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { marca: { momento: { lt: corte } } } }),
    );
    expect(prisma.asistenciaSelfie.deleteMany).toHaveBeenCalledWith({ where: { marca_id: { in: [1n, 2n] } } });
  });

  it('respeta la retención configurada por el ADMIN (30 días)', async () => {
    const { tarea, prisma } = armar({ retencionDias: 30, fotosVencidas: [[]] });
    await tarea.revisar(TRES_Y_MEDIA);
    const corte = new Date(TRES_Y_MEDIA.getTime() - 30 * DIA);
    expect(prisma.asistenciaSelfie.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { marca: { momento: { lt: corte } } } }),
    );
  });

  it('idempotente: una segunda revisión el mismo día no vuelve a borrar', async () => {
    const { tarea, prisma } = armar({ fotosVencidas: [[7n], []] });
    await tarea.revisar(TRES_Y_MEDIA);
    const r2 = await tarea.revisar(TRES_Y_MEDIA);
    expect(r2).toEqual({ ejecutada: false, motivo: 'YA_CORRIDA' });
    expect(prisma.asistenciaSelfie.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('candado: otra instancia con el candado tomado no borra nada', async () => {
    const { tarea, prisma } = armar({ redisOcupado: true, fotosVencidas: [[9n]] });
    const r = await tarea.revisar(TRES_Y_MEDIA);
    expect(r).toEqual({ ejecutada: false, motivo: 'YA_CORRIDA' });
    expect(prisma.asistenciaSelfie.findMany).not.toHaveBeenCalled();
  });

  it('antes de las 03:00 de Lima no corre', async () => {
    const { tarea, prisma } = armar({ fotosVencidas: [[3n]] });
    expect(await tarea.revisar(DOS_DE_LA_MANANA)).toEqual({ ejecutada: false, motivo: 'FUERA_DE_HORA' });
    expect(prisma.asistenciaSelfie.findMany).not.toHaveBeenCalled();
  });

  it('audita cada corrida con el número de fotos y sin datos personales', async () => {
    const { tarea, auditoria } = armar({ fotosVencidas: [[1n, 2n, 3n], []] });
    await tarea.revisar(TRES_Y_MEDIA);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
      modulo: 'asistencia', accion: 'LIMPIAR_SELFIES', entidad: 'asistencia_selfie',
      despues: { fotosBorradas: 3, fecha: '2026-11-06' },
    }));
    const enviado = (auditoria.registrar as jest.Mock).mock.calls[0][0];
    expect(JSON.stringify(enviado)).not.toMatch(/party|dni|telefono|lat|lng/i);
  });

  it('tolerante a fallos: si la base falla suelta el candado, no audita y la revisión siguiente reintenta', async () => {
    const { tarea, auditoria, prisma } = armar({ deleteFallaUnaVez: true, fotosVencidas: [[4n], [4n], []] });
    await expect(tarea.revisar(TRES_Y_MEDIA)).rejects.toThrow('caída de base');
    expect(auditoria.registrar).not.toHaveBeenCalled();
    const r2 = await tarea.revisar(TRES_Y_MEDIA);
    expect(r2).toEqual({ ejecutada: true, fotosBorradas: 1 });
    expect(prisma.asistenciaSelfie.deleteMany).toHaveBeenCalledTimes(2);
  });
});
