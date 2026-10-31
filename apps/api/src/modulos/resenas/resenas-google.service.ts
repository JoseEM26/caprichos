import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { adquirirCandado, liberarCandado } from '../../comun/redis/candado.util';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { obtenerFechaHoraLima } from '../local/local.util';

const BASE_API = 'https://api.openwebninja.com/local-business-data';
const COSTO_BUSQUEDA = 3; // máximo de negocios que puede devolver /search
const COSTO_PAGINA = 1; // una página de business-reviews = 1 unidad
const TOPE_POR_DEFECTO = 40;
const CARGA_MAX_POR_DEFECTO = 200;
const PAGINA = 20;
const CALIFICACION_MINIMA = 4;
const LARGO_MINIMO_TEXTO = 30;
const SEMANA_MS = 7 * 86400000;
const REVISION_MS = 3600000;
const PAUSA_PAGINAS_MS = 500;
const TIMEOUT_API_MS = 15000;

export type MotivoResenas =
  | 'SIN_CLAVE'
  | 'SIN_NEGOCIO'
  | 'NEGOCIO_YA_CONFIGURADO'
  | 'LIMITE_DIARIO'
  | 'TOPE_MENSUAL'
  | 'CARGA_YA_HECHA'
  | 'EN_CURSO'
  | 'NO_AUTORIZADO'
  | 'LIMITE_API'
  | 'ERROR_API'
  | 'ERROR_RED';

export interface Fallo {
  ok: false;
  motivo: MotivoResenas;
  mensaje: string;
}

export interface NegocioGuardado {
  businessId: string;
  nombre: string;
  enlaceLocal: string | null;
}

const MENSAJES: Record<MotivoResenas, string> = {
  SIN_CLAVE: 'Falta la clave de la API de reseñas en el servidor (OPENWEBNINJA_API_KEY).',
  SIN_NEGOCIO: 'Primero elige tu local en Google.',
  NEGOCIO_YA_CONFIGURADO: 'El local ya está configurado. No se cambia desde aquí.',
  LIMITE_DIARIO: 'La actualización a mano se usa una vez al día. Vuelve mañana.',
  TOPE_MENSUAL: 'Se llegó al tope mensual de consultas a la API. Se muestra lo guardado.',
  CARGA_YA_HECHA: 'La carga inicial ya se hizo. Para repetirla confirma «Repetir carga».',
  EN_CURSO: 'Ya hay una actualización en curso. Intenta en un momento.',
  NO_AUTORIZADO: 'La API de reseñas no autorizó la consulta (clave o plan). No se cambió nada.',
  LIMITE_API: 'La API de reseñas pidió esperar (límite de uso). No se cambió nada.',
  ERROR_API: 'La API de reseñas respondió con error. No se cambió nada.',
  ERROR_RED: 'No se pudo conectar con la API de reseñas. No se cambió nada.',
};

const fallo = (motivo: MotivoResenas): Fallo => ({ ok: false, motivo, mensaje: MENSAJES[motivo] });

const HOSTS_GOOGLE_EXACTOS = ['g.co', 'goo.gl', 'maps.app.goo.gl'];

/** Enlace seguro a Google: solo https y dominios de Google (google.com y subdominios, g.co, goo.gl). Otro valor da null. */
export function enlaceGoogleSeguro(valor: unknown): string | null {
  if (typeof valor !== 'string' || valor.length > 500) return null;
  let u: URL;
  try {
    u = new URL(valor.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const esGoogle = host === 'google.com' || host.endsWith('.google.com') || HOSTS_GOOGLE_EXACTOS.includes(host);
  return u.protocol === 'https:' && !u.username && !u.password && esGoogle ? u.toString() : null;
}

/** Enlace del local desde /search: reviews_link o place_link; si no vienen, se arma con el place_id. */
function enlaceLocalDe(x: any): string | null {
  const placeId = typeof x.place_id === 'string' ? x.place_id : '';
  return (
    enlaceGoogleSeguro(x.reviews_link) ??
    enlaceGoogleSeguro(x.place_link) ??
    (placeId ? enlaceGoogleSeguro(`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`) : null)
  );
}

/**
 * Reseñas de Google Maps para la carta. La carta solo lee la base; la API externa se llama
 * desde: buscar el negocio (una vez, admin), carga inicial (admin, paginada), actualización
 * manual (admin, 1 al día) y actualización semanal (solo si RESENAS_ACTUALIZAR_AUTO='si').
 * Todas las llamadas cuentan en el contador mensual (parámetro resenas_consumo_AAAAMM).
 * ponytail: un solo proceso con la bandera enCurso; con varios contenedores el candado Redis
 * solo cubre la tarea semanal.
 */
@Injectable()
export class ResenasGoogleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ResenasGoogleService.name);
  private timer: NodeJS.Timeout | null = null;
  private enCurso = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly auditoria: AuditoriaService,
  ) {}

  onModuleInit() {
    if (!this.autoActiva()) return;
    this.timer = setInterval(() => {
      this.revisarSemanal().catch((e) => this.logger.error(`Reseñas semanal: ${e.message}`));
    }, REVISION_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---------- configuración y parámetros ----------

  autoActiva(): boolean {
    return this.config.get<string>('RESENAS_ACTUALIZAR_AUTO') === 'si';
  }

  private claveConfigurada(): boolean {
    return !!this.config.get<string>('OPENWEBNINJA_API_KEY');
  }

  private tope(): number {
    const v = this.config.get<string>('RESENAS_TOPE_MENSUAL');
    const n = Number(v);
    return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : TOPE_POR_DEFECTO;
  }

  private cargaMax(): number {
    const v = this.config.get<string>('RESENAS_CARGA_MAX');
    const n = Number(v);
    return v !== undefined && v !== '' && Number.isFinite(n) && n > 0 ? n : CARGA_MAX_POR_DEFECTO;
  }

  private async param(clave: string): Promise<any> {
    const p = await this.prisma.parametro.findUnique({ where: { clave } });
    return p?.valor ?? null;
  }

  private async guardarParam(clave: string, valor: any): Promise<void> {
    await this.prisma.parametro.upsert({ where: { clave }, update: { valor }, create: { clave, valor } });
  }

  private async negocio(): Promise<NegocioGuardado | null> {
    const v = await this.param('resenas_negocio');
    return v && typeof v.businessId === 'string' && v.businessId
      ? { businessId: v.businessId, nombre: String(v.nombre ?? ''), enlaceLocal: enlaceGoogleSeguro(v.enlaceLocal) }
      : null;
  }

  private async consumoMes(ahora: Date): Promise<number> {
    const n = Number(await this.param(`resenas_consumo_${this.mesLima(ahora)}`));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private mesLima(ahora: Date): string {
    return obtenerFechaHoraLima(ahora).fechaIso.slice(0, 7).replace('-', '');
  }

  private hoyLima(ahora: Date): string {
    return obtenerFechaHoraLima(ahora).fechaIso;
  }

  /** Antes de llamar: si el costo haría pasar el tope, no se llama a la API. */
  private async verificarCupo(costo: number, ahora: Date): Promise<Fallo | null> {
    const consumo = await this.consumoMes(ahora);
    return consumo + costo > this.tope() ? fallo('TOPE_MENSUAL') : null;
  }

  /** Suma al contador antes de salir a la red (cuenta también los intentos fallidos). */
  private async sumarCupo(costo: number, ahora: Date): Promise<void> {
    const clave = `resenas_consumo_${this.mesLima(ahora)}`;
    const actual = await this.consumoMes(ahora);
    await this.guardarParam(clave, actual + costo);
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ---------- llamada a la API externa ----------

  /** Nunca registra ni devuelve la clave: solo estado HTTP o tipo de error de red. */
  private async llamarApi(ruta: string, params: Record<string, string>): Promise<{ ok: true; body: any } | Fallo> {
    const clave = this.config.get<string>('OPENWEBNINJA_API_KEY');
    if (!clave) return fallo('SIN_CLAVE');
    const url = new URL(BASE_API + ruta);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    let res: Response;
    try {
      res = await fetch(url, { headers: { 'X-API-Key': clave }, signal: AbortSignal.timeout(TIMEOUT_API_MS) });
    } catch (e: any) {
      this.logger.warn(`Reseñas: error de red al llamar ${ruta} (${e?.name || 'Error'})`);
      return fallo('ERROR_RED');
    }
    const body: any = await res.json().catch(() => null);
    if (!res.ok || body?.status !== 'OK') {
      const motivo: MotivoResenas =
        res.status === 401 || res.status === 403 ? 'NO_AUTORIZADO' : res.status === 429 ? 'LIMITE_API' : 'ERROR_API';
      this.logger.warn(`Reseñas: la API respondió ${res.status} en ${ruta}`);
      return fallo(motivo);
    }
    return { ok: true, body };
  }

  // ---------- mapeo y guardado ----------

  private filtrar(x: any): boolean {
    return (
      typeof x?.review_id === 'string' &&
      Number(x.rating) >= CALIFICACION_MINIMA &&
      typeof x.review_text === 'string' &&
      x.review_text.trim().length >= LARGO_MINIMO_TEXTO
    );
  }

  /** Upsert por google_review_id. El update nunca toca `visible` (lo que el admin ocultó sigue oculto). */
  private async guardarResenas(data: any[]): Promise<{ guardadas: number; nuevas: number; actualizadas: number }> {
    let nuevas = 0;
    let actualizadas = 0;
    for (const x of data.filter((d) => this.filtrar(d))) {
      const datos = {
        google_review_id: x.review_id as string,
        autor_nombre: String(x.author_name || 'Cliente de Google'),
        autor_foto_url: x.author_photo_url || null,
        autor_enlace: x.author_link || null,
        calificacion: Math.round(Number(x.rating)),
        texto: (x.review_text as string).trim(),
        idioma: x.review_language || null,
        publicada_en: x.review_datetime_utc && !isNaN(new Date(x.review_datetime_utc).getTime()) ? new Date(x.review_datetime_utc) : null,
        enlace_resena: x.review_link || null,
      };
      const existe = await this.prisma.resenaGoogle.findUnique({ where: { google_review_id: datos.google_review_id }, select: { id: true } });
      await this.prisma.resenaGoogle.upsert({
        where: { google_review_id: datos.google_review_id },
        create: { ...datos, visible: true },
        update: datos,
      });
      if (existe) actualizadas++;
      else nuevas++;
    }
    return { guardadas: nuevas + actualizadas, nuevas, actualizadas };
  }

  // ---------- acciones públicas del servicio ----------

  /** Busca candidatos (máx. 3) sin guardar nada. Cuenta 3 unidades. */
  async buscarNegocio(consulta: string, ahora = new Date()): Promise<{ ok: true; candidatos: any[] } | Fallo> {
    if (!this.claveConfigurada()) return fallo('SIN_CLAVE');
    const pre = await this.verificarCupo(COSTO_BUSQUEDA, ahora);
    if (pre) return pre;
    await this.sumarCupo(COSTO_BUSQUEDA, ahora);
    const r = await this.llamarApi('/search', { query: consulta.trim(), limit: '3' });
    if (!r.ok) return r;
    const candidatos = (Array.isArray(r.body.data) ? r.body.data : [])
      .slice(0, 3)
      .map((x: any) => ({
        businessId: String(x.business_id ?? ''),
        nombre: String(x.name ?? ''),
        direccion: x.full_address ?? null,
        rating: x.rating ?? null,
        total: x.review_count ?? null,
        enlaceLocal: enlaceLocalDe(x),
      }))
      .filter((c: any) => c.businessId && c.nombre);
    return { ok: true, candidatos };
  }

  /** Guarda el negocio elegido. Una vez configurado no se cambia desde la app (evita mezclar reseñas de dos locales). */
  async guardarNegocio(businessId: string, nombre: string, usuario?: UsuarioAutenticado, ip?: string, rating?: number, total?: number, enlaceLocal?: string) {
    const actual = await this.negocio();
    if (actual && actual.businessId !== businessId) throw new ConflictException(fallo('NEGOCIO_YA_CONFIGURADO'));
    const nuevo = { businessId, nombre, enlaceLocal: enlaceGoogleSeguro(enlaceLocal) };
    await this.guardarParam('resenas_negocio', nuevo);
    // El resumen (4.8 · 778) sale de la búsqueda: business-reviews no lo trae de forma confiable
    if (Number.isFinite(rating) && Number.isFinite(total)) await this.guardarParam('resenas_resumen', { rating, total });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'resenas',
      accion: 'NEGOCIO_CONFIGURADO',
      antes: actual,
      despues: nuevo,
      partyId: usuario?.partyId,
      ip,
    });
    return nuevo;
  }

  /**
   * Actualización de una página (20) ordenada por lo más nuevo: solo suma reseñas nuevas buenas.
   * Manual: una vez al día. Semanal: la llama revisarSemanal.
   */
  async actualizar(opciones: { manual: boolean; usuario?: UsuarioAutenticado; ip?: string; ahora?: Date }): Promise<any> {
    const ahora = opciones.ahora ?? new Date();
    const negocio = await this.negocio();
    if (!negocio) return fallo('SIN_NEGOCIO');
    if (this.enCurso) return fallo('EN_CURSO');
    if (opciones.manual && (await this.param('resenas_ultima_manual')) === this.hoyLima(ahora)) return fallo('LIMITE_DIARIO');
    const pre = await this.verificarCupo(COSTO_PAGINA, ahora);
    if (pre) return pre;

    this.enCurso = true;
    try {
      if (opciones.manual) await this.guardarParam('resenas_ultima_manual', this.hoyLima(ahora));
      await this.sumarCupo(COSTO_PAGINA, ahora);
      const r = await this.llamarApi('/business-reviews', {
        business_id: negocio.businessId,
        limit: String(PAGINA),
        offset: '0',
        sort_by: 'newest',
        language: 'es',
      });
      if (!r.ok) return r;
      const data = Array.isArray(r.body.data) ? r.body.data : [];
      const res = await this.guardarResenas(data);
      const rating = Number(r.body.rating);
      const total = Number(r.body.review_count);
      if (Number.isFinite(rating) && Number.isFinite(total)) await this.guardarParam('resenas_resumen', { rating, total });
      await this.guardarParam('resenas_ultima_actualizacion', ahora.toISOString());
      if (opciones.manual) {
        await this.auditoria.registrar({
          categoria: 'CAMBIO',
          modulo: 'resenas',
          accion: 'ACTUALIZAR_MANUAL',
          despues: { recibidas: data.length, ...res },
          partyId: opciones.usuario?.partyId,
          ip: opciones.ip,
        });
      }
      return { ok: true, recibidas: data.length, ...res };
    } finally {
      this.enCurso = false;
    }
  }

  /**
   * Carga inicial: pagina business-reviews (sort_by=highest_ranking) de 20 en 20 hasta juntar
   * RESENAS_CARGA_MAX reseñas guardadas, una página vacía, el tope mensual o un error.
   * Lo ya traído se guarda aunque una página falle. Solo se repite si se confirma (repetir).
   */
  async cargaInicial(opciones: { repetir: boolean; usuario?: UsuarioAutenticado; ip?: string; ahora?: Date }): Promise<any> {
    const ahora = opciones.ahora ?? new Date();
    const negocio = await this.negocio();
    if (!negocio) return fallo('SIN_NEGOCIO');
    if (!this.claveConfigurada()) return fallo('SIN_CLAVE');
    const hecha = await this.param('resenas_carga_inicial');
    if (hecha && !opciones.repetir) return fallo('CARGA_YA_HECHA');
    if (this.enCurso) return fallo('EN_CURSO');

    this.enCurso = true;
    const max = this.cargaMax();
    let offset = 0;
    let paginas = 0;
    let recibidas = 0;
    let guardadas = 0;
    let nuevas = 0;
    let actualizadas = 0;
    let motivo: MotivoResenas | null = null;
    let mensaje: string | undefined;
    try {
      for (;;) {
        if ((await this.prisma.resenaGoogle.count()) >= max) break;
        const pre = await this.verificarCupo(COSTO_PAGINA, ahora);
        if (pre) {
          motivo = 'TOPE_MENSUAL';
          break;
        }
        await this.sumarCupo(COSTO_PAGINA, ahora);
        const r = await this.llamarApi('/business-reviews', {
          business_id: negocio.businessId,
          limit: String(PAGINA),
          offset: String(offset),
          sort_by: 'highest_ranking',
          language: 'es',
        });
        paginas++;
        if (!r.ok) {
          motivo = r.motivo;
          mensaje = r.mensaje;
          break;
        }
        const data = Array.isArray(r.body.data) ? r.body.data : [];
        if (data.length === 0) break;
        recibidas += data.length;
        const res = await this.guardarResenas(data);
        guardadas += res.guardadas;
        nuevas += res.nuevas;
        actualizadas += res.actualizadas;
        if (data.length < PAGINA) break;
        offset += PAGINA;
        await this.esperar(PAUSA_PAGINAS_MS);
      }

      const total = await this.prisma.resenaGoogle.count();
      if (paginas > 0) {
        await this.guardarParam('resenas_carga_inicial', { fecha: this.hoyLima(ahora), paginas, guardadas, total });
        if (guardadas > 0) await this.guardarParam('resenas_ultima_actualizacion', ahora.toISOString());
      }
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'resenas',
        accion: 'CARGA_INICIAL',
        resultado: motivo ? 'RECHAZADO' : 'OK',
        despues: { paginas, recibidas, guardadas, nuevas, actualizadas, total },
        motivo: motivo ?? undefined,
        partyId: opciones.usuario?.partyId,
        ip: opciones.ip,
      });
      return {
        ok: motivo === null,
        ...(motivo ? { motivo, mensaje } : {}),
        paginas,
        recibidas,
        guardadas,
        nuevas,
        actualizadas,
        totalGuardadas: total,
      };
    } finally {
      this.enCurso = false;
    }
  }

  /** Visible/oculta por reseña. Lo oculto nunca se borra. */
  async cambiarVisible(id: string, visible: boolean, usuario?: UsuarioAutenticado, ip?: string) {
    let idBig: bigint;
    try {
      idBig = BigInt(id);
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Reseña no válida' });
    }
    const antes = await this.prisma.resenaGoogle.findUnique({ where: { id: idBig } });
    if (!antes) throw new NotFoundException({ codigo: 'NO_ENCONTRADA', mensaje: 'La reseña no existe' });
    const despues = await this.prisma.resenaGoogle.update({ where: { id: idBig }, data: { visible } });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'resenas',
      accion: 'VISIBILIDAD',
      entidad: 'resena_google',
      entidadId: idBig,
      antes: { visible: antes.visible },
      despues: { visible: despues.visible },
      partyId: usuario?.partyId,
      ip,
    });
    return this.serializarAdmin(despues);
  }

  private serializarAdmin(r: any) {
    return {
      id: r.id.toString(),
      autor: r.autor_nombre,
      foto: r.autor_foto_url,
      estrellas: r.calificacion,
      texto: r.texto,
      fecha: r.publicada_en ? new Date(r.publicada_en).toISOString() : null,
      enlace: r.enlace_resena,
      visible: r.visible,
    };
  }

  async estado(ahora = new Date()) {
    const negocio = await this.negocio();
    const consumo = await this.consumoMes(ahora);
    const tope = this.tope();
    const ultimaManual = await this.param('resenas_ultima_manual');
    const hecha = await this.param('resenas_carga_inicial');
    const [visibles, ocultas] = await Promise.all([
      this.prisma.resenaGoogle.count({ where: { visible: true } }),
      this.prisma.resenaGoogle.count({ where: { visible: false } }),
    ]);
    const motivoManual: MotivoResenas | null = !this.claveConfigurada()
      ? 'SIN_CLAVE'
      : !negocio
        ? 'SIN_NEGOCIO'
        : ultimaManual === this.hoyLima(ahora)
          ? 'LIMITE_DIARIO'
          : consumo + COSTO_PAGINA > tope
            ? 'TOPE_MENSUAL'
            : null;
    return {
      negocio,
      claveConfigurada: this.claveConfigurada(),
      resumen: await this.param('resenas_resumen'),
      ultimaActualizacion: await this.param('resenas_ultima_actualizacion'),
      ultimaManual,
      cargaInicialHecha: !!hecha,
      mes: this.mesLima(ahora),
      consumo,
      tope,
      guardadas: visibles + ocultas,
      visibles,
      ocultas,
      actualizarAhora: { disponible: motivoManual === null, motivo: motivoManual },
      autoActiva: this.autoActiva(),
    };
  }

  async listarAdmin(ahora = new Date()) {
    const resenas = await this.prisma.resenaGoogle.findMany({ orderBy: [{ publicada_en: 'desc' }, { id: 'desc' }], take: 200 });
    return { estado: await this.estado(ahora), resenas: resenas.map((r) => this.serializarAdmin(r)) };
  }

  async listarPublico() {
    const [filas, resumen, negocio] = await Promise.all([
      this.prisma.resenaGoogle.findMany({
        where: { visible: true },
        orderBy: [{ publicada_en: 'desc' }, { id: 'desc' }],
        take: 30,
      }),
      this.param('resenas_resumen'),
      this.negocio(),
    ]);
    const enlaceLocal = negocio?.enlaceLocal ?? null;
    return {
      resenas: filas.map((r) => {
        const { id, autor, foto, estrellas, texto, fecha } = this.serializarAdmin(r);
        // La reseña enlaza a su propia página si el enlace es válido; si no, al local
        return { id, autor, foto, estrellas, texto, fecha, enlace: enlaceGoogleSeguro(r.enlace_resena) ?? enlaceLocal };
      }),
      resumen: resumen && typeof resumen.rating === 'number' && typeof resumen.total === 'number' ? { rating: resumen.rating, total: resumen.total } : null,
      enlaceLocal,
    };
  }

  /** Tarea semanal: con candado Redis (un solo contenedor) y solo si la última actualización tiene más de 7 días. */
  async revisarSemanal(ahora = new Date()): Promise<{ actualizado: boolean; motivo?: string }> {
    if (!this.autoActiva()) return { actualizado: false, motivo: 'DESACTIVADA' };
    const cliente = this.redis.obtenerCliente();
    const lockKey = 'lock:resenas:semanal';
    const candado = await adquirirCandado(cliente, lockKey, 300000);
    if (!candado.adquirido) return { actualizado: false, motivo: 'OTRO_CONTENEDOR' };
    try {
      if (!(await this.negocio())) return { actualizado: false, motivo: 'SIN_NEGOCIO' };
      const ult = await this.param('resenas_ultima_actualizacion');
      if (ult && ahora.getTime() - new Date(ult).getTime() < SEMANA_MS) return { actualizado: false, motivo: 'RECIENTE' };
      const r = await this.actualizar({ manual: false, ahora });
      return r.ok ? { actualizado: true } : { actualizado: false, motivo: r.motivo };
    } finally {
      await liberarCandado(cliente, lockKey, candado.token).catch(() => {});
    }
  }
}
