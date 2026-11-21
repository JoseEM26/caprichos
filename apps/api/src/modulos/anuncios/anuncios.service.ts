import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { GuardarAnuncioDto } from './dto/anuncio.dto';
import { estadoAnuncio, MAX_POR_INGRESO, seMuestraAhora, vigenteAhora } from './anuncios.regla';

const CLAVES_DETALLE = ['precio', 'cupon', 'fecha', 'lugar', 'icono'] as const;
/** Tope de eventos por IP y minuto en la carta pública (sin cuenta). */
const TOPE_CARTA_POR_MINUTO = 60;

/** Lo que ve quien recibe el anuncio: nada de auditoría ni de públicos internos. */
const aPublico = (a: any) => ({
  id: String(a.id),
  plantilla: a.plantilla,
  titulo: a.titulo,
  texto: a.texto,
  imagen: a.imagen_url,
  botonTexto: a.boton_texto,
  botonEnlace: a.boton_enlace,
  detalle: a.detalle ?? null,
  color: a.color,
  frecuencia: a.frecuencia,
  vecesPorDia: a.veces_por_dia,
  cadaHoras: a.cada_horas,
  cierreSegundos: a.cierre_segundos,
  puedeCerrar: a.puede_cerrar,
});

@Injectable()
export class AnunciosService {
  // ponytail: límite en memoria por réplica; con varias réplicas el tope real es N veces mayor.
  private readonly golpes = new Map<string, { n: number; hasta: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ---------------------------------------------------------------- admin

  async listar(filtros: { estado?: string; publico?: string } = {}) {
    const ahora = new Date();
    const filas: any[] = await this.prisma.anuncio.findMany({
      where: filtros.publico ? { publico: filtros.publico } : {},
      orderBy: [{ prioridad: 'desc' }, { creado_en: 'desc' }],
    });
    const cuentas = await this.prisma.anuncioVista.groupBy({
      by: ['anuncio_id', 'tipo'],
      where: { anuncio_id: { in: filas.map((f) => f.id) } },
      _count: { _all: true },
    });
    const items = filas.map((f) => ({
      ...this.aAdmin(f),
      estado: estadoAnuncio(f, ahora),
      estadisticas: this.armarEstadisticas(cuentas.filter((c: any) => c.anuncio_id === f.id)),
    }));
    return filtros.estado ? items.filter((i) => i.estado === filtros.estado) : items;
  }

  async obtener(id: string) {
    const f = await this.buscar(id);
    return { ...this.aAdmin(f), estado: estadoAnuncio(f) };
  }

  async crear(dto: GuardarAnuncioDto, usuario?: UsuarioAutenticado, ip?: string) {
    const data = this.armarDatos(dto);
    const f: any = await this.prisma.anuncio.create({
      data: { ...data, creado_por: usuario?.partyId, actualizado_por: usuario?.partyId },
    });
    await this.auditar('CREAR', f.id, null, data, usuario, ip);
    return this.obtener(String(f.id));
  }

  async actualizar(id: string, dto: GuardarAnuncioDto, usuario?: UsuarioAutenticado, ip?: string) {
    const antes = await this.buscar(id);
    const data = this.armarDatos(dto);
    await this.prisma.anuncio.update({ where: { id: antes.id }, data: { ...data, actualizado_por: usuario?.partyId } });
    await this.auditar('ACTUALIZAR', antes.id, this.aAdmin(antes), data, usuario, ip);
    return this.obtener(id);
  }

  async activar(id: string, activo: boolean, usuario?: UsuarioAutenticado, ip?: string) {
    const antes = await this.buscar(id);
    await this.prisma.anuncio.update({ where: { id: antes.id }, data: { activo, actualizado_por: usuario?.partyId } });
    await this.auditar(activo ? 'ENCENDER' : 'APAGAR', antes.id, { activo: antes.activo }, { activo }, usuario, ip);
    return this.obtener(id);
  }

  /** Copia apagada y con «(copia)» en el título, para editarla antes de ponerla al aire. */
  async duplicar(id: string, usuario?: UsuarioAutenticado, ip?: string) {
    const o: any = await this.buscar(id);
    const resto = { ...o };
    for (const k of ['id', 'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por']) delete resto[k];
    const f: any = await this.prisma.anuncio.create({
      data: {
        ...resto,
        detalle: resto.detalle ?? Prisma.DbNull,
        titulo: `${o.titulo} (copia)`.slice(0, 120),
        activo: false,
        creado_por: usuario?.partyId,
        actualizado_por: usuario?.partyId,
      },
    });
    await this.auditar('DUPLICAR', f.id, { origen: String(o.id) }, null, usuario, ip);
    return this.obtener(String(f.id));
  }

  async eliminar(id: string, usuario?: UsuarioAutenticado, ip?: string) {
    const antes = await this.buscar(id);
    await this.prisma.anuncio.delete({ where: { id: antes.id } });
    await this.auditar('ELIMINAR', antes.id, this.aAdmin(antes), null, usuario, ip);
    return { ok: true };
  }

  /** Vista previa real: el mismo formato que recibe quien lo ve, sin mirar vigencia ni frecuencia. */
  async vistaPrevia(id: string) {
    return aPublico(await this.buscar(id));
  }

  // ---------------------------------------------------------------- carta

  /** Vigentes para la carta (sin datos personales). La frecuencia la resuelve el navegador. */
  async vigentesCarta(ahora: Date = new Date()) {
    const filas: any[] = await this.prisma.anuncio.findMany({
      where: { activo: true, publico: { in: ['CARTA', 'AMBOS'] } },
      orderBy: [{ prioridad: 'desc' }, { creado_en: 'desc' }],
    });
    return filas.filter((f) => vigenteAhora(f, ahora)).slice(0, 10).map(aPublico);
  }

  async eventoCarta(id: string, tipo: string, ip = 'sin-ip') {
    this.limitarCarta(ip);
    const a: any = await this.prisma.anuncio.findFirst({ where: { id: this.aId(id), publico: { in: ['CARTA', 'AMBOS'] } }, select: { id: true } });
    if (!a) throw new NotFoundException({ codigo: 'ANUNCIO_NO_ENCONTRADO', mensaje: 'No se encontró el anuncio' });
    await this.prisma.anuncioVista.create({ data: { anuncio_id: a.id, tipo, origen: 'CARTA' } });
    return { ok: true };
  }

  // ------------------------------------------------------------- personal

  /** Vigentes para este usuario según su rol y lo que ya vio. Máximo 3 por ingreso. */
  async vigentesPersonal(usuario: UsuarioAutenticado, ahora: Date = new Date()) {
    const misRoles = usuario.roles?.length ? usuario.roles : [usuario.rol];
    const filas: any[] = await this.prisma.anuncio.findMany({
      where: { activo: true, publico: { in: ['PERSONAL', 'AMBOS'] } },
      orderBy: [{ prioridad: 'desc' }, { creado_en: 'desc' }],
    });
    const candidatos = filas.filter((f) => vigenteAhora(f, ahora) && (!f.roles?.length || f.roles.some((r: string) => misRoles.includes(r))));
    if (!candidatos.length) return [];
    const vistas: any[] = await this.prisma.anuncioVista.findMany({
      where: { party_id: usuario.partyId, tipo: 'VISTA', anuncio_id: { in: candidatos.map((c) => c.id) } },
      select: { anuncio_id: true, creado_en: true },
    });
    return candidatos
      .filter((c) => seMuestraAhora(c, vistas.filter((v) => v.anuncio_id === c.id).map((v) => v.creado_en), ahora))
      .slice(0, MAX_POR_INGRESO)
      .map(aPublico);
  }

  async eventoPersonal(id: string, tipo: string, usuario: UsuarioAutenticado) {
    const a: any = await this.prisma.anuncio.findFirst({ where: { id: this.aId(id), publico: { in: ['PERSONAL', 'AMBOS'] } }, select: { id: true } });
    if (!a) throw new NotFoundException({ codigo: 'ANUNCIO_NO_ENCONTRADO', mensaje: 'No se encontró el anuncio' });
    await this.prisma.anuncioVista.create({ data: { anuncio_id: a.id, tipo, origen: 'PERSONAL', party_id: usuario.partyId } });
    return { ok: true };
  }

  // -------------------------------------------------------------- ayudas

  private aId(id: string): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({ codigo: 'ANUNCIO_ID_INVALIDO', mensaje: 'Identificador de anuncio inválido' });
    }
  }

  private async buscar(id: string): Promise<any> {
    const f = await this.prisma.anuncio.findUnique({ where: { id: this.aId(id) } });
    if (!f) throw new NotFoundException({ codigo: 'ANUNCIO_NO_ENCONTRADO', mensaje: 'No se encontró el anuncio' });
    return f;
  }

  private limitarCarta(ip: string, ahora = Date.now()) {
    const g = this.golpes.get(ip);
    if (!g || g.hasta < ahora) {
      if (this.golpes.size > 5000) this.golpes.clear();
      this.golpes.set(ip, { n: 1, hasta: ahora + 60_000 });
      return;
    }
    if (++g.n > TOPE_CARTA_POR_MINUTO) {
      throw new BadRequestException({ codigo: 'DEMASIADOS_EVENTOS', mensaje: 'Demasiadas solicitudes, intenta en un minuto' });
    }
  }

  private armarEstadisticas(filas: Array<{ tipo: string; _count: { _all: number } }>) {
    const n = (t: string) => filas.find((f) => f.tipo === t)?._count._all ?? 0;
    return { vistas: n('VISTA'), cierres: n('CIERRE'), clics: n('CLIC'), entendidos: n('ENTENDIDO') };
  }

  private aAdmin(f: any) {
    return {
      id: String(f.id),
      publico: f.publico,
      roles: f.roles ?? [],
      plantilla: f.plantilla,
      titulo: f.titulo,
      texto: f.texto,
      imagen_url: f.imagen_url,
      boton_texto: f.boton_texto,
      boton_enlace: f.boton_enlace,
      detalle: f.detalle ?? null,
      color: f.color,
      desde: f.desde,
      hasta: f.hasta,
      franja_desde: f.franja_desde,
      franja_hasta: f.franja_hasta,
      dias_semana: f.dias_semana ?? [],
      frecuencia: f.frecuencia,
      veces_por_dia: f.veces_por_dia,
      cada_horas: f.cada_horas,
      cierre_segundos: f.cierre_segundos,
      puede_cerrar: f.puede_cerrar,
      prioridad: f.prioridad,
      activo: f.activo,
      creado_por: f.creado_por != null ? String(f.creado_por) : null,
      actualizado_por: f.actualizado_por != null ? String(f.actualizado_por) : null,
      creado_en: f.creado_en,
      actualizado_en: f.actualizado_en,
    };
  }

  /** Valida las reglas cruzadas del formulario y devuelve los datos listos para guardar. */
  armarDatos(dto: GuardarAnuncioDto) {
    const mal = (codigo: string, mensaje: string) => new BadRequestException({ codigo, mensaje });
    const vacio = (v?: string | null) => (v == null || String(v).trim() === '' ? null : String(v).trim());
    const fecha = (v: string | null | undefined, que: string): Date | null => {
      if (!vacio(v)) return null;
      const d = new Date(v as string);
      if (isNaN(d.getTime())) throw mal('ANUNCIO_FECHA_INVALIDA', `La fecha «${que}» no es válida`);
      return d;
    };
    const desde = fecha(dto.desde, 'desde');
    const hasta = fecha(dto.hasta, 'hasta');
    if (desde && hasta && hasta <= desde) throw mal('ANUNCIO_VIGENCIA_INVALIDA', 'La fecha «hasta» debe ser posterior a «desde»');

    const franjaD = vacio(dto.franja_desde);
    const franjaH = vacio(dto.franja_hasta);
    if (!!franjaD !== !!franjaH) throw mal('ANUNCIO_FRANJA_INVALIDA', 'La franja horaria necesita hora de inicio y de fin');
    if (franjaD && franjaD === franjaH) throw mal('ANUNCIO_FRANJA_INVALIDA', 'La franja horaria no puede empezar y terminar a la misma hora');

    const frecuencia = dto.frecuencia ?? 'UNA_VEZ';
    if (frecuencia === 'CADA_N_HORAS' && !dto.cada_horas) throw mal('ANUNCIO_FRECUENCIA_INVALIDA', 'Indica cada cuántas horas se repite');

    const botonTexto = vacio(dto.boton_texto);
    const botonEnlace = vacio(dto.boton_enlace);
    if (!!botonTexto !== !!botonEnlace) throw mal('ANUNCIO_BOTON_INVALIDO', 'El botón necesita texto y enlace');
    if (dto.plantilla === 'SOLO_IMAGEN' && !vacio(dto.imagen_url)) throw mal('ANUNCIO_IMAGEN_REQUERIDA', 'La plantilla «Solo imagen» necesita una imagen');

    const roles = [...new Set(dto.publico === 'CARTA' ? [] : dto.roles ?? [])];
    // Los clientes siempre pueden cerrar; solo el personal puede obligar a pulsar «Entendido».
    const puedeCerrar = dto.publico === 'PERSONAL' ? dto.puede_cerrar ?? true : true;
    const cierre = dto.cierre_segundos ?? 0;
    if (!puedeCerrar && cierre > 0) throw mal('ANUNCIO_CIERRE_INVALIDO', 'Si debe pulsar «Entendido», no puede cerrarse solo');

    const detalle: Record<string, string> = {};
    for (const k of CLAVES_DETALLE) {
      const v = dto.detalle?.[k];
      if (typeof v === 'string' && v.trim()) detalle[k] = v.trim().slice(0, 80);
    }

    return {
      publico: dto.publico,
      roles,
      plantilla: dto.plantilla,
      titulo: dto.titulo.trim(),
      texto: vacio(dto.texto),
      imagen_url: vacio(dto.imagen_url),
      boton_texto: botonTexto,
      boton_enlace: botonEnlace,
      detalle: Object.keys(detalle).length ? detalle : Prisma.DbNull,
      color: dto.color ?? 'CREMA',
      desde,
      hasta,
      franja_desde: franjaD,
      franja_hasta: franjaH,
      dias_semana: [...new Set(dto.dias_semana ?? [])].sort(),
      frecuencia,
      veces_por_dia: dto.veces_por_dia ?? 1,
      cada_horas: frecuencia === 'CADA_N_HORAS' ? dto.cada_horas ?? null : null,
      cierre_segundos: cierre,
      puede_cerrar: puedeCerrar,
      prioridad: dto.prioridad ?? 0,
      activo: dto.activo ?? true,
    };
  }

  private async auditar(accion: string, id: bigint, antes: unknown, despues: unknown, usuario?: UsuarioAutenticado, ip?: string) {
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'anuncios',
      accion,
      resultado: 'OK',
      entidad: 'anuncio',
      entidadId: id as any,
      antes: antes as any,
      despues: despues as any,
      partyId: usuario?.partyId,
      ip,
    });
  }
}
