import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CATEGORIAS_PLANTILLA } from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { DATOS_LOCAL_DEFAULT, DIAS_SEMANA_NOMBRES, formatearHora, mediosPagoPublicos } from '../local';

/** WhatsApp admite ~4096; se recomienda ≤1000 para que se lea cómodo en el celular. */
export const MAX_TEXTO_PLANTILLA = 1000;
export const MAX_TITULO_PLANTILLA = 60;

const error = (status: HttpStatus, codigo: string, mensaje: string) => new HttpException({ codigo, mensaje }, status);

/** Quita caracteres de control (menos el salto de línea), normaliza saltos y deja a lo más una línea en blanco seguida. */
export function limpiarTextoPlantilla(texto: unknown): string {
  return String(texto ?? '')
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex -- justamente se quitan los caracteres de control
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface EntradaPlantilla {
  titulo?: string;
  texto?: string;
  categoria?: string | null;
  activo?: boolean;
}

@Injectable()
export class PlantillasRespuestaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private fila(r: any) {
    return {
      id: r.id.toString(),
      titulo: r.titulo,
      texto: r.texto,
      categoria: r.categoria ?? 'OTROS',
      activo: r.activo,
      orden: r.orden,
      actualizadoEn: r.actualizado_en ?? null,
    };
  }

  /** Todas, también las pausadas (pantalla «Administrar plantillas»). */
  async listarTodas() {
    const filas = await this.prisma.respuestaRapida.findMany({ orderBy: [{ orden: 'asc' }, { id: 'asc' }] });
    return filas.map((r) => this.fila(r));
  }

  /**
   * Datos para reemplazar las variables que no dependen del chat. Salen de la misma configuración que usan la carta y el bot
   * (medios de pago, datos y horario del local): aquí no se guarda ningún número ni cuenta.
   */
  async contexto(usuario: UsuarioAutenticado) {
    const [parametros, horarios, party] = await Promise.all([
      this.prisma.parametro.findMany({
        where: { clave: { in: ['local_datos', 'local_pagos', 'voucher_titular_nombre', 'voucher_yape_numero', 'voucher_plin_numero'] } },
      }),
      this.prisma.horarioDia.findMany({ orderBy: { dia_semana: 'asc' } }),
      this.prisma.party.findUnique({ where: { id: usuario.partyId }, include: { persona: true } }).catch(() => null),
    ]);
    const datos = (parametros.find((p) => p.clave === 'local_datos')?.valor as any) ?? DATOS_LOCAL_DEFAULT;
    const medios = mediosPagoPublicos(parametros);

    const lineas = (c: Record<string, any> | undefined, campos: Array<[string, string]>) =>
      c ? campos.filter(([k]) => String(c[k] ?? '').trim()).map(([k, e]) => `• ${e}: ${String(c[k]).trim()}`).join('\n') : '';
    const yape = lineas(medios.yape, [['numero', 'Número'], ['titular', 'Titular']]);
    const plin = lineas(medios.plin, [['numero', 'Número'], ['titular', 'Titular']]);
    const transferencia = lineas(medios.transferencia, [['banco', 'Banco'], ['cuenta', 'Cuenta'], ['cci', 'CCI'], ['titular', 'Titular']]);
    const nombresMedio: Record<string, string> = { yape: 'Yape', plin: 'Plin', transferencia: 'Transferencia', tarjeta: 'Tarjeta', efectivo: 'Efectivo' };
    const mediosTexto = Object.keys(medios)
      .map((k) => {
        const detalle = k === 'yape' ? yape : k === 'plin' ? plin : k === 'transferencia' ? transferencia : '';
        return `${nombresMedio[k] ?? k}${detalle ? `\n${detalle}` : ''}`;
      })
      .join('\n');

    // Días seguidos con el mismo horario se juntan: «Lunes a Domingo: 14:00 - 22:00»
    const dias = horarios.map((h) => ({
      nombre: DIAS_SEMANA_NOMBRES[h.dia_semana] || `Día ${h.dia_semana}`,
      rango: h.cerrado ? 'Cerrado' : `${formatearHora(h.abre) ?? '?'} - ${formatearHora(h.cierra) ?? '?'}`,
    }));
    const grupos: Array<{ desde: string; hasta: string; rango: string }> = [];
    for (const d of dias) {
      const ult = grupos[grupos.length - 1];
      if (ult && ult.rango === d.rango) ult.hasta = d.nombre;
      else grupos.push({ desde: d.nombre, hasta: d.nombre, rango: d.rango });
    }
    const horario = grupos.map((g) => `• ${g.desde === g.hasta ? g.desde : `${g.desde} a ${g.hasta}`}: ${g.rango}`).join('\n');

    const nombres = String((party as any)?.persona?.nombres ?? '').trim().split(/\s+/)[0] ?? '';
    return {
      local: String(datos.nombre ?? '').trim(),
      direccion: String(datos.direccion ?? '').trim(),
      horario,
      medios_pago: mediosTexto,
      yape,
      plin,
      transferencia,
      mi_nombre: nombres,
    };
  }

  private validar(e: EntradaPlantilla, parcial: boolean) {
    const out: { titulo?: string; texto?: string; categoria?: string; activo?: boolean } = {};
    if (!parcial || e.titulo !== undefined) {
      const titulo = String(e.titulo ?? '').replace(/\s+/g, ' ').trim();
      if (titulo.length < 2) throw error(HttpStatus.BAD_REQUEST, 'TITULO_INVALIDO', 'Escribe un título de al menos 2 letras');
      if (titulo.length > MAX_TITULO_PLANTILLA) throw error(HttpStatus.BAD_REQUEST, 'TITULO_LARGO', `El título admite hasta ${MAX_TITULO_PLANTILLA} letras`);
      out.titulo = titulo;
    }
    if (!parcial || e.texto !== undefined) {
      const texto = limpiarTextoPlantilla(e.texto);
      if (!texto) throw error(HttpStatus.BAD_REQUEST, 'TEXTO_VACIO', 'Escribe el texto de la plantilla');
      if (texto.length > MAX_TEXTO_PLANTILLA) {
        throw error(HttpStatus.BAD_REQUEST, 'TEXTO_LARGO', `El texto admite hasta ${MAX_TEXTO_PLANTILLA} letras (tiene ${texto.length})`);
      }
      out.texto = texto;
    }
    if (!parcial || e.categoria !== undefined) {
      const c = String(e.categoria ?? 'OTROS').toUpperCase();
      if (!(CATEGORIAS_PLANTILLA as readonly string[]).includes(c)) throw error(HttpStatus.BAD_REQUEST, 'CATEGORIA_INVALIDA', 'Elige una categoría de la lista');
      out.categoria = c;
    }
    if (e.activo !== undefined) out.activo = !!e.activo;
    return out;
  }

  /** Título único sin importar mayúsculas ni tildes de más; `salvo` excluye a la propia plantilla al editar. */
  private async exigirTituloLibre(titulo: string, salvo?: bigint) {
    const otras = await this.prisma.respuestaRapida.findMany({
      where: { titulo: { equals: titulo, mode: 'insensitive' }, ...(salvo ? { NOT: { id: salvo } } : {}) },
      select: { id: true },
    });
    if (otras.length) throw error(HttpStatus.CONFLICT, 'TITULO_DUPLICADO', 'Ya existe una plantilla con ese título');
  }

  private async cargar(id: string) {
    let n: bigint;
    try {
      n = BigInt(id);
    } catch {
      throw error(HttpStatus.NOT_FOUND, 'PLANTILLA_NO_ENCONTRADA', 'La plantilla no existe');
    }
    const r = await this.prisma.respuestaRapida.findUnique({ where: { id: n } });
    if (!r) throw error(HttpStatus.NOT_FOUND, 'PLANTILLA_NO_ENCONTRADA', 'La plantilla no existe');
    return r;
  }

  private async auditar(usuario: UsuarioAutenticado, accion: string, id: bigint, antes: unknown, despues: unknown, ip?: string) {
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'mensajes', accion, entidad: 'respuesta_rapida', entidadId: id,
      partyId: usuario.partyId, antes, despues, ip,
    });
  }

  async crear(e: EntradaPlantilla, usuario: UsuarioAutenticado, ip?: string) {
    const v = this.validar(e, false);
    await this.exigirTituloLibre(v.titulo!);
    const ultima = await this.prisma.respuestaRapida.aggregate({ _max: { orden: true } });
    const r = await this.prisma.respuestaRapida.create({
      data: {
        titulo: v.titulo!, texto: v.texto!, categoria: v.categoria!, activo: v.activo ?? true,
        orden: (ultima?._max?.orden ?? 0) + 10, creado_por: usuario.partyId, actualizado_por: usuario.partyId,
      },
    });
    await this.auditar(usuario, 'PLANTILLA_CREAR', r.id, undefined, { titulo: r.titulo, categoria: r.categoria }, ip);
    return this.fila(r);
  }

  async editar(id: string, e: EntradaPlantilla, usuario: UsuarioAutenticado, ip?: string) {
    const antes = await this.cargar(id);
    const v = this.validar(e, true);
    if (v.titulo && v.titulo.toLowerCase() !== antes.titulo.toLowerCase()) await this.exigirTituloLibre(v.titulo, antes.id);
    const r = await this.prisma.respuestaRapida.update({
      where: { id: antes.id },
      data: { ...v, actualizado_por: usuario.partyId, actualizado_en: new Date() },
    });
    const accion = v.activo !== undefined && Object.keys(v).length === 1 ? (v.activo ? 'PLANTILLA_ACTIVAR' : 'PLANTILLA_PAUSAR') : 'PLANTILLA_EDITAR';
    await this.auditar(usuario, accion, r.id, { titulo: antes.titulo, texto: antes.texto, categoria: antes.categoria, activo: antes.activo }, { titulo: r.titulo, texto: r.texto, categoria: r.categoria, activo: r.activo }, ip);
    return this.fila(r);
  }

  async borrar(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const antes = await this.cargar(id);
    await this.prisma.respuestaRapida.delete({ where: { id: antes.id } });
    await this.auditar(usuario, 'PLANTILLA_BORRAR', antes.id, { titulo: antes.titulo, texto: antes.texto, categoria: antes.categoria }, undefined, ip);
    return { ok: true };
  }

  /** Copia con título «… (copia)» (y número si ya existe), pausada para que se revise antes de usarla. */
  async duplicar(id: string, usuario: UsuarioAutenticado, ip?: string) {
    const o = await this.cargar(id);
    const base = `${o.titulo.slice(0, MAX_TITULO_PLANTILLA - 12)} (copia)`;
    let titulo = base;
    for (let n = 2; n < 50; n++) {
      const hay = await this.prisma.respuestaRapida.findMany({ where: { titulo: { equals: titulo, mode: 'insensitive' } }, select: { id: true } });
      if (!hay.length) break;
      titulo = `${base} ${n}`;
    }
    const ultima = await this.prisma.respuestaRapida.aggregate({ _max: { orden: true } });
    const r = await this.prisma.respuestaRapida.create({
      data: {
        titulo, texto: o.texto, categoria: o.categoria, activo: false,
        orden: (ultima?._max?.orden ?? 0) + 10, creado_por: usuario.partyId, actualizado_por: usuario.partyId,
      },
    });
    await this.auditar(usuario, 'PLANTILLA_DUPLICAR', r.id, { origen: o.id.toString() }, { titulo: r.titulo }, ip);
    return this.fila(r);
  }

  /** Guarda el orden completo: `ids` en el orden deseado (los que falten quedan al final, en su orden). */
  async ordenar(ids: string[], usuario: UsuarioAutenticado, ip?: string) {
    const lista = Array.from(new Set((ids ?? []).map((i) => String(i))));
    const existentes = await this.prisma.respuestaRapida.findMany({ select: { id: true }, orderBy: [{ orden: 'asc' }, { id: 'asc' }] });
    const conocidos = new Set(existentes.map((x) => x.id.toString()));
    if (lista.some((i) => !conocidos.has(i))) throw error(HttpStatus.BAD_REQUEST, 'ORDEN_INVALIDO', 'La lista tiene plantillas que no existen');
    const resto = existentes.map((x) => x.id.toString()).filter((i) => !lista.includes(i));
    const final = [...lista, ...resto];
    await this.prisma.$transaction(final.map((i, k) => this.prisma.respuestaRapida.update({ where: { id: BigInt(i) }, data: { orden: (k + 1) * 10 } })));
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'mensajes', accion: 'PLANTILLA_ORDENAR', entidad: 'respuesta_rapida',
      partyId: usuario.partyId, despues: { total: final.length }, ip,
    });
    return { ok: true };
  }
}
