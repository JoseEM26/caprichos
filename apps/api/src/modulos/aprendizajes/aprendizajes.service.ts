import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ConocimientoBotService } from '../chatbot';
import { AprendizajesNocheService, ResumenNoche } from './aprendizajes-noche.service';
import { AprendizajesHistoricoService } from './aprendizajes-historico.service';

export interface EdicionAprobar {
  pregunta?: string;
  respuesta?: string;
  frases?: string[];
}

const err = (codigo: string, mensaje: string) => new BadRequestException({ codigo, mensaje });
const nombreDe = (party: any): string | null => {
  const p = party?.persona;
  return p ? [p.nombres, p.apellidos].filter(Boolean).join(' ') : null;
};
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

@Injectable()
export class AprendizajesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly noche: AprendizajesNocheService,
    private readonly historico: AprendizajesHistoricoService,
    private readonly conocimiento: ConocimientoBotService,
  ) {}

  async listar(q: { estado?: string; pagina?: string | number; limite?: string | number }) {
    const estado = String(q.estado ?? 'PENDIENTE').toUpperCase();
    if (!['PENDIENTE', 'APROBADO', 'DESCARTADO'].includes(estado)) throw err('ESTADO_INVALIDO', 'El estado no es válido.');
    const pagina = Math.max(1, Math.floor(Number(q.pagina)) || 1);
    const limite = Math.min(100, Math.max(1, Math.floor(Number(q.limite)) || 20));
    const par = await this.noche.parametros();
    // Las PENDIENTE con menos repeticiones del mínimo están «en observación»: aún no se muestran
    const where = estado === 'PENDIENTE' ? { estado, repeticiones: { gte: par.minRepeticiones } } : { estado };
    const [filas, total] = await Promise.all([
      this.prisma.aprendizajePropuesto.findMany({
        where,
        orderBy: [{ repeticiones: 'desc' }, { creado_en: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
        include: { noche: { select: { fecha: true } }, decididoPor: { select: { persona: { select: { nombres: true, apellidos: true } } } } },
      }),
      this.prisma.aprendizajePropuesto.count({ where }),
    ]);
    return {
      items: filas.map((f) => ({
        id: f.id.toString(),
        tipo: f.tipo,
        intencion: f.intencion,
        pregunta: f.pregunta,
        respuesta: f.respuesta,
        frases: (f.frases as string[]) ?? [],
        repeticiones: f.repeticiones,
        evidencia: (f.evidencia as any[]) ?? [],
        estado: f.estado,
        noche: f.noche.fecha.toISOString().slice(0, 10),
        creadoEn: iso(f.creado_en),
        decididoPor: nombreDe(f.decididoPor),
        decididoEn: iso(f.decidido_en),
        motivo: f.motivo,
      })),
      total,
    };
  }

  private validarEdicion(e: EdicionAprobar) {
    const largo = (v: unknown, campo: string, max: number) => {
      if (v === undefined) return;
      if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw err('TEXTO_INVALIDO', `${campo} es obligatorio y llega hasta ${max} caracteres.`);
    };
    largo(e.pregunta, 'La pregunta', 300);
    // Una propuesta «Siempre a persona» (DERIVAR) no lleva respuesta: vacía se acepta aquí y se exige abajo según el tipo
    if (e.respuesta !== '') largo(e.respuesta, 'La respuesta', 1000);
    if (e.frases !== undefined) {
      if (!Array.isArray(e.frases) || e.frases.length > 8 || e.frases.some((f) => typeof f !== 'string' || !f.trim() || f.trim().length > 120)) {
        throw err('FRASES_INVALIDAS', 'Las frases son hasta 8, de hasta 120 caracteres cada una.');
      }
    }
  }

  async aprobar(id: string, edicion: EdicionAprobar | undefined, partyId: bigint, ip?: string) {
    const e = edicion ?? {};
    this.validarEdicion(e);
    const pid = this.id(id);
    const nuevo = await this.prisma.$transaction(async (tx) => {
      const p = await tx.aprendizajePropuesto.findUnique({ where: { id: pid } });
      if (!p) throw new NotFoundException({ codigo: 'PROPUESTA_NO_ENCONTRADA', mensaje: 'La propuesta no existe.' });
      if (p.estado !== 'PENDIENTE') throw new ConflictException({ codigo: 'PROPUESTA_YA_DECIDIDA', mensaje: 'Esta propuesta ya fue decidida.' });
      const respuesta = e.respuesta === undefined ? p.respuesta : e.respuesta.trim();
      if (p.tipo !== 'DERIVAR' && !String(respuesta ?? '').trim()) throw err('TEXTO_INVALIDO', 'La respuesta es obligatoria y llega hasta 1000 caracteres.');
      const datos = {
        pregunta: e.pregunta?.trim() ?? p.pregunta,
        respuesta,
        frases: (e.frases ? e.frases.map((f) => f.trim()) : p.frases) as any,
      };
      await tx.aprendizajePropuesto.update({ where: { id: pid }, data: { ...datos, estado: 'APROBADO', decidido_por: partyId, decidido_en: new Date() } });
      const max = await tx.conocimientoBot.aggregate({ _max: { version: true } });
      return tx.conocimientoBot.create({
        data: {
          version: (max._max.version ?? 0) + 1,
          tipo: p.tipo, intencion: p.intencion, ...datos,
          aprendizaje_id: pid, aprobado_por: partyId,
        },
      });
    });
    this.conocimiento.olvidarCache();
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'aprendizajes', accion: 'APRENDIZAJE_APROBAR', entidad: 'aprendizaje_propuesto', entidadId: pid,
      partyId, ip, despues: { conocimientoId: nuevo.id.toString(), version: nuevo.version, tipo: nuevo.tipo, intencion: nuevo.intencion },
    });
    return { id: pid.toString(), estado: 'APROBADO', conocimientoId: nuevo.id.toString(), version: nuevo.version };
  }

  private motivo(m: unknown): string {
    if (typeof m !== 'string' || m.trim().length < 5) throw err('MOTIVO_OBLIGATORIO', 'Escribe el motivo (mínimo 5 caracteres).');
    return m.trim().slice(0, 500);
  }

  async descartar(id: string, motivo: unknown, partyId: bigint, ip?: string) {
    const m = this.motivo(motivo);
    const pid = this.id(id);
    const p = await this.prisma.aprendizajePropuesto.findUnique({ where: { id: pid } });
    if (!p) throw new NotFoundException({ codigo: 'PROPUESTA_NO_ENCONTRADA', mensaje: 'La propuesta no existe.' });
    if (p.estado !== 'PENDIENTE') throw new ConflictException({ codigo: 'PROPUESTA_YA_DECIDIDA', mensaje: 'Esta propuesta ya fue decidida.' });
    await this.prisma.aprendizajePropuesto.update({ where: { id: pid }, data: { estado: 'DESCARTADO', motivo: m, decidido_por: partyId, decidido_en: new Date() } });
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'aprendizajes', accion: 'APRENDIZAJE_DESCARTAR', entidad: 'aprendizaje_propuesto', entidadId: pid,
      partyId, ip, motivo: m, despues: { intencion: p.intencion },
    });
    return { id: pid.toString(), estado: 'DESCARTADO' };
  }

  async conocimientoVigente() {
    const filas = await this.prisma.conocimientoBot.findMany({
      where: { estado: 'VIGENTE' },
      orderBy: { version: 'desc' },
      include: { aprobadoPor: { select: { persona: { select: { nombres: true, apellidos: true } } } } },
    });
    return {
      items: filas.map((c) => ({
        id: c.id.toString(), version: c.version, tipo: c.tipo, intencion: c.intencion, pregunta: c.pregunta, respuesta: c.respuesta,
        frases: (c.frases as string[]) ?? [], aprobadoPor: nombreDe(c.aprobadoPor), aprobadoEn: iso(c.aprobado_en),
      })),
    };
  }

  async retirar(id: string, motivo: unknown, partyId: bigint, ip?: string) {
    const m = this.motivo(motivo);
    const cid = this.id(id);
    const c = await this.prisma.conocimientoBot.findUnique({ where: { id: cid } });
    if (!c) throw new NotFoundException({ codigo: 'CONOCIMIENTO_NO_ENCONTRADO', mensaje: 'Ese conocimiento no existe.' });
    if (c.estado !== 'VIGENTE') throw new ConflictException({ codigo: 'CONOCIMIENTO_YA_RETIRADO', mensaje: 'Ya estaba retirado.' });
    await this.prisma.conocimientoBot.update({
      where: { id: cid }, data: { estado: 'RETIRADO', retirado_por: partyId, retirado_en: new Date(), motivo_retiro: m },
    });
    this.conocimiento.olvidarCache();
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'aprendizajes', accion: 'CONOCIMIENTO_RETIRAR', entidad: 'conocimiento_bot', entidadId: cid,
      partyId, ip, motivo: m, despues: { version: c.version, intencion: c.intencion },
    });
    return { id: cid.toString(), estado: 'RETIRADO' };
  }

  async resumen() {
    const par = await this.noche.parametros();
    const [pendientes, noches, historico] = await Promise.all([
      this.prisma.aprendizajePropuesto.count({ where: { estado: 'PENDIENTE', repeticiones: { gte: par.minRepeticiones } } }),
      this.prisma.aprendizajeNoche.findMany({ orderBy: { fecha: 'desc' }, take: 14 }),
      this.historico.resumen(),
    ]);
    const r = noches.map((n) => AprendizajesNocheService.resumir(n));
    return {
      pendientes,
      topeUsd: par.topeUsd,
      ultimaNoche: r[0] ?? null,
      noches: r.map((n) => ({ fecha: n.fecha, estado: n.estado, usd: n.usd, propuestas: n.propuestas })),
      historico,
    };
  }

  /** Corre la noche de AYER ahora (respeta la idempotencia; se repite si estaba en ERROR) y devuelve su resumen. */
  async ejecutarAhora(): Promise<ResumenNoche> {
    return this.noche.ejecutarNoche(this.noche.ayer());
  }

  ejecutarHistorico() {
    return this.historico.ejecutar();
  }

  private id(v: string): bigint {
    if (!/^\d{1,18}$/.test(String(v))) throw err('ID_INVALIDO', 'El identificador no es válido.');
    return BigInt(v);
  }
}
