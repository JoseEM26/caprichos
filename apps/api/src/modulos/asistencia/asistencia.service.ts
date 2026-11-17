import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { TIPOS_DOCUMENTO, rolesDeCuenta } from '../acceso/roles-usuario';
import {
  CoberturaFila,
  HorarioFila,
  MarcaCalc,
  ReemplazoFila,
  ResultadoJornada,
  TipoMarca,
  aHoraTexto,
  diaSemana,
  distanciaMetros,
  evaluarJornada,
  jornadaDe,
  minutosDeHora,
  resolverTurno,
  sumarDias,
} from './asistencia.calculo';
import type { TipoMarca as TipoMarcaQr } from '@caprichos/compartido';
import { almuerzoMarcadoMin, rolEfectivo, siguienteSugerido } from './asistencia.interpretacion';
import {
  CLAVE_CONFIG_ASISTENCIA,
  ConfigAsistencia,
  leerConfigAsistencia,
} from './asistencia.config';
import {
  VENTANA_SEG,
  codigoCorto,
  payloadQr,
  secretoQr,
  slotDe,
  verificarCodigo,
  verificarPayload,
} from './asistencia.qr';
import { AjustarDiaDto, ConfigurarAsistenciaDto, CambiarHoraMarcaDto, CorregirMarcaDto, MarcarDto, ReasignarMarcaDto, ResolverMarcasDto, RevisarMarcaDto } from './dto/asistencia.dto';
import {
  CLAVE_ENLACE_PANTALLA,
  EnlacePantalla,
  generarTokenPantalla,
  hashToken,
  tokenCoincide,
} from './asistencia.pantalla';

/** Rechazo de negocio. `contar` = si suma a los intentos fallidos del límite. */
export class RechazoAsistencia extends Error {
  constructor(
    readonly codigo: string,
    readonly mensaje: string,
    readonly contar = true,
  ) {
    super(mensaje);
  }
}

export const MOTIVO_MARCA_MANUAL = 'Marcó manualmente sin QR (solo GPS)';
const MAX_SELFIE_BYTES = 200_000;
const VENTANA_FALLOS_MS = 10 * 60_000;
const BLOQUEO_MS = 5 * 60_000;
const LIMITE_FALLOS_USUARIO = 5;
// Varias personas comparten la red del local: el límite por IP es más alto.
const LIMITE_FALLOS_IP = 20;
const MAX_SALTO_KMH = 150;
const MAX_SALTO_M = 50;
/** Más allá de esta precisión (m) la ubicación no sirve ni para revisión. */
export const PRECISION_TOPE_M = 300;

export const VERSION_CONSENTIMIENTO = '2026-11';
export const TEXTO_CONSENTIMIENTO =
  'Para registrar tu asistencia se usan tu ubicación en el momento de marcar, una foto (selfie) y la hora del servidor. ' +
  'Los datos se usan solo para el control de asistencia del local (Ley 29733). Solo el administrador puede ver las fotos, ' +
  'y se borran automáticamente según el plazo de retención del local.';

const sha = (texto: string) => createHash('sha256').update(texto).digest('hex');

const huellaDe = (dispositivo: string) => sha(`asistencia-dispositivo|${dispositivo}`);

function decodificarSelfie(entrada: string): { bytes: Uint8Array<ArrayBuffer>; mime: string } {
  const limpio = entrada.replace(/^data:image\/[a-z+]+;base64,/i, '');
  if (!/^[A-Za-z0-9+/=\s]+$/.test(limpio)) {
    throw new RechazoAsistencia('SELFIE_INVALIDA', 'La foto no es válida. Vuelve a tomarla.');
  }
  const bytes = new Uint8Array(Buffer.from(limpio, 'base64')) as Uint8Array<ArrayBuffer>;
  if (bytes.length === 0 || bytes.length > MAX_SELFIE_BYTES) {
    throw new RechazoAsistencia('SELFIE_INVALIDA', 'La foto es muy grande o está vacía. Vuelve a tomarla.');
  }
  const esJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!esJpeg) throw new RechazoAsistencia('SELFIE_INVALIDA', 'La foto debe ser una imagen JPEG.');
  return { bytes, mime: 'image/jpeg' };
}

/** Alertas de ubicación simulada: precisión perfecta, cuatro marcas en el mismo punto exacto, salto imposible. */
function alertasDeUbicacion(
  actual: { lat: number; lng: number; precision: number; momento: Date },
  previas: Array<{ lat: number; lng: number; momento: Date }>,
): string[] {
  const alertas: string[] = [];
  if (actual.precision === 0) alertas.push('Precisión de GPS perfecta (0 m): posible ubicación simulada');
  const ultimas = previas.slice(0, 3);
  if (ultimas.length === 3 && ultimas.every((p) => p.lat === actual.lat && p.lng === actual.lng)) {
    alertas.push('Coordenadas idénticas repetidas en varias marcas');
  }
  const ultima = previas[0];
  if (ultima) {
    const metros = distanciaMetros(ultima.lat, ultima.lng, actual.lat, actual.lng);
    const horas = Math.max(1, actual.momento.getTime() - ultima.momento.getTime()) / 3_600_000;
    if (metros > MAX_SALTO_M && metros / 1000 / horas > MAX_SALTO_KMH) {
      alertas.push('Salto de ubicación imposible desde la marca anterior');
    }
  }
  return alertas;
}

const fechaDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class AsistenciaService {
  private readonly fallosUsuario = new Map<string, number[]>();
  private readonly bloqueos = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly auditoria?: AuditoriaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Configuración
  // ---------------------------------------------------------------------------

  async obtenerConfig(): Promise<ConfigAsistencia> {
    const fila = await this.prisma.parametro.findUnique({ where: { clave: CLAVE_CONFIG_ASISTENCIA } });
    return leerConfigAsistencia(fila?.valor);
  }

  async guardarConfig(dto: ConfigurarAsistenciaDto, usuario?: UsuarioAutenticado, ip?: string) {
    const antes = await this.obtenerConfig();
    const despues = leerConfigAsistencia({ ...antes, ...dto });
    await this.prisma.parametro.upsert({
      where: { clave: CLAVE_CONFIG_ASISTENCIA },
      create: { clave: CLAVE_CONFIG_ASISTENCIA, valor: despues as any },
      update: { valor: despues as any },
    });
    await this.auditar('CAMBIO', 'EDITAR_CONFIG', 'OK', { antes, despues }, usuario?.partyId, ip, 'parametro', null);
    return despues;
  }

  // ---------------------------------------------------------------------------
  // Enlace público de la pantalla del local (tablet sin cuenta)
  // ---------------------------------------------------------------------------

  private async enlacePantalla(): Promise<EnlacePantalla | null> {
    const fila = await this.prisma.parametro.findUnique({ where: { clave: CLAVE_ENLACE_PANTALLA } });
    const v = fila?.valor as Partial<EnlacePantalla> | null | undefined;
    return v && typeof v.tokenHash === 'string' && typeof v.generadoEn === 'string' ? (v as EnlacePantalla) : null;
  }

  async estadoEnlacePantalla(): Promise<{ activo: boolean; generadoEn: string | null }> {
    const e = await this.enlacePantalla();
    return { activo: e !== null, generadoEn: e?.generadoEn ?? null };
  }

  /** Genera o regenera el enlace (invalida el anterior). Devuelve la ruta con el token en claro: se muestra una sola vez. */
  async generarEnlacePantalla(usuario?: UsuarioAutenticado, ip?: string) {
    const token = generarTokenPantalla();
    const valor: EnlacePantalla = { tokenHash: hashToken(token), generadoEn: new Date().toISOString() };
    await this.prisma.parametro.upsert({
      where: { clave: CLAVE_ENLACE_PANTALLA },
      create: { clave: CLAVE_ENLACE_PANTALLA, valor: valor as any },
      update: { valor: valor as any },
    });
    await this.auditar('CAMBIO', 'GENERAR_ENLACE_PANTALLA', 'OK', { generadoEn: valor.generadoEn }, usuario?.partyId, ip, 'parametro', null);
    return { ruta: `/asistencia/pantalla/${token}`, generadoEn: valor.generadoEn };
  }

  async desactivarEnlacePantalla(usuario?: UsuarioAutenticado, ip?: string) {
    await this.prisma.parametro.deleteMany({ where: { clave: CLAVE_ENLACE_PANTALLA } });
    await this.auditar('CAMBIO', 'DESACTIVAR_ENLACE_PANTALLA', 'OK', {}, usuario?.partyId, ip, 'parametro', null);
    return { activo: false, generadoEn: null };
  }

  /** Mismo QR que la pantalla admin, pero solo con el enlace válido. Sin enlace o token malo: 404 idéntico. */
  async qrPantallaPublica(token: string, ahora = new Date()) {
    const e = await this.enlacePantalla();
    if (!e || !tokenCoincide(e.tokenHash, token)) throw new NotFoundException();
    return this.qrPantalla(ahora);
  }

  /** Manifest de la PWA «QR Asistencia» para ese enlace. Solo lleva la ruta del propio token: ningún dato del local. */
  async manifestPantallaPublica(token: string) {
    const e = await this.enlacePantalla();
    if (!e || !tokenCoincide(e.tokenHash, token)) throw new NotFoundException();
    const ruta = `/asistencia/pantalla/${token}`;
    return {
      name: 'QR Asistencia',
      short_name: 'QR Asistencia',
      lang: 'es',
      id: ruta,
      start_url: ruta,
      scope: ruta,
      display: 'fullscreen',
      display_override: ['fullscreen', 'standalone'],
      orientation: 'any',
      theme_color: '#0B2C3E',
      background_color: '#FBF4EC',
      icons: [
        { src: '/icons/qr-asistencia-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/qr-asistencia-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/qr-asistencia-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Pantalla del local
  // ---------------------------------------------------------------------------

  /** QR vigente de la pantalla: payload firmado, código corto, y cuándo cambia (ms desde epoch). */
  async qrPantalla(ahora = new Date()) {
    const secreto = this.secreto();
    const slot = slotDe(ahora.getTime());
    const payload = payloadQr(secreto, slot);
    const qr = await QRCode.toDataURL(payload, { margin: 1, width: 480, errorCorrectionLevel: 'M' });
    const codigo = codigoCorto(secreto, slot);
    return {
      slot,
      ahora: ahora.getTime(),
      cambiaEn: (slot + 1) * VENTANA_SEG * 1000,
      ventanaSeg: VENTANA_SEG,
      qr,
      codigo: `${codigo.slice(0, 3)} ${codigo.slice(3)}`,
    };
  }

  private secreto(): string {
    return secretoQr(this.config.get<string>('JWT_SECRET', 'secreto-dev-cambiar'));
  }

  // ---------------------------------------------------------------------------
  // Marcar (celular del trabajador)
  // ---------------------------------------------------------------------------

  async marcar(dto: MarcarDto, usuario: UsuarioAutenticado, ip?: string, ahora = new Date(), manual = false) {
    const clave = `u:${usuario.partyId}`;
    const claveIp = `ip:${ip ?? '-'}`;
    this.exigirNoBloqueado(clave, claveIp, ahora.getTime());
    try {
      const resultado = await this.marcarValidado(dto, usuario, ahora, manual);
      this.fallosUsuario.delete(clave);
      return resultado;
    } catch (e) {
      if (!(e instanceof RechazoAsistencia)) throw e;
      if (e.contar) this.registrarFallo(clave, claveIp, ahora.getTime());
      await this.auditar('ACCESO', 'MARCAR', 'RECHAZADO', { codigo: e.codigo }, usuario.partyId, ip, 'party', usuario.partyId, e.codigo);
      throw new BadRequestException({ codigo: e.codigo, mensaje: e.mensaje });
    }
  }

  /** `manual` = sin QR ni selfie ni vínculo de celular: solo GPS en el radio; la marca queda A_REVISAR con origen MANUAL. */
  private async marcarValidado(dto: MarcarDto, usuario: UsuarioAutenticado, ahora: Date, manual = false) {
    const partyId = usuario.partyId;
    if ([usuario.rol, ...(usuario.roles ?? [])].includes('ADMIN')) {
      throw new RechazoAsistencia('ADMIN_NO_MARCA', 'El administrador no marca asistencia.', false);
    }
    const cfg = await this.obtenerConfig();
    const huella = manual ? '' : huellaDe(dto.dispositivo);
    const dispositivo = manual ? null : await this.prisma.asistenciaDispositivo.findUnique({ where: { party_id: partyId } });
    if (dispositivo && dispositivo.huella_hash !== huella) {
      throw new RechazoAsistencia(
        'DISPOSITIVO_DISTINTO',
        'Tu asistencia está vinculada a otro celular. Pide al administrador que reinicie el vínculo.',
      );
    }

    // Decisión del dueño (10/11/2026): ya no se pide consentimiento para marcar; el aviso de datos no bloquea.

    // Sin límite de distancia: la ubicación del local ya no es requisito para marcar (solo sirve para ver la distancia)
    // Sin foto solo si la cámara no abrió (`sinSelfie`): se acepta pero queda A_REVISAR
    const sinFoto = !manual && !dto.selfie && dto.sinSelfie === true;
    if (!manual && !dto.selfie && !sinFoto) {
      throw new RechazoAsistencia('SELFIE_INVALIDA', 'Falta la foto. Si la cámara no abre, elige «Continuar sin foto».');
    }
    const selfie = manual || sinFoto ? null : decodificarSelfie(dto.selfie as string);

    const secreto = this.secreto();
    const slot = manual ? null
      : dto.qr !== undefined && dto.qr !== ''
        ? verificarPayload(secreto, dto.qr, ahora.getTime())
        : dto.codigo !== undefined
          ? verificarCodigo(secreto, dto.codigo, ahora.getTime())
          : null;
    if (!manual) {
      if (slot === null) {
        throw new RechazoAsistencia('QR_INVALIDO', 'El QR venció o no es válido. Escanea el de la pantalla actual.');
      }
      const usado = await this.prisma.asistenciaMarca.findFirst({ where: { party_id: partyId, qr_slot: BigInt(slot) } });
      if (usado) throw new RechazoAsistencia('QR_YA_USADO', 'Ese QR ya lo usaste. Espera al siguiente.');
    }

    const { jornada } = jornadaDe(ahora);
    // Marcas múltiples: no se rechaza por «ya marcaste»; el servidor interpreta cada marca por orden y pares.
    const declarado = declaradoDe(dto.tipo);
    const lectura = await this.leerNuevaMarca(partyId, jornada, ahora, cfg, declarado);
    const tipo = lectura.rol;
    // Coherencia (no bloquea a nadie): p. ej. regreso de almuerzo sin salida a almorzar queda A_REVISAR con motivo
    const incoherencia = declarado === 'ALMUERZO_VUELTA' && lectura.interp.alertas.some((a) => a.includes('sin salida a break'))
      ? ['Marcó el regreso del almuerzo sin haber marcado la salida a almorzar'] : [];

    // Decisión del dueño (16/11): sin límite de radio ni de precisión. El QR de la pantalla prueba que está en el local;
    // el GPS solo se guarda como referencia si es un punto válido (un celular que manda una latitud imposible no bloquea).
    const ubic = ubicacionValida(dto.lat, dto.lng, dto.precision);
    // Solo informativo (sin límite): distancia al punto del local si hay GPS válido y local configurado
    const metros = ubic && cfg.localLat != null && cfg.localLng != null ? distanciaMetros(cfg.localLat, cfg.localLng, ubic.lat, ubic.lng) : null;

    const previas = await this.prisma.asistenciaMarca.findMany({
      where: { party_id: partyId, origen: 'CELULAR' },
      orderBy: { momento: 'desc' },
      take: 3,
    });
    const alertas = ubic
      ? alertasDeUbicacion(
          { ...ubic, momento: ahora },
          previas.filter((p) => p.lat != null && p.lng != null).map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), momento: p.momento })),
        )
      : [];
    const avisos = [
      ...incoherencia,
      ...(sinFoto ? ['Sin selfie: la cámara del celular no abrió'] : []),
    ];
    const estado = manual || alertas.length || avisos.length ? 'A_REVISAR' : 'VALIDA';
    const motivos = [...(manual ? [MOTIVO_MARCA_MANUAL] : []), ...avisos, ...alertas];

    try {
      const marca = await this.prisma.$transaction(async (tx) => {
        const creada = await tx.asistenciaMarca.create({
          data: {
            party_id: partyId,
            jornada: fechaDb(jornada),
            tipo,
            tipo_marca: declarado,
            origen: manual ? 'MANUAL' : 'CELULAR',
            momento: ahora,
            estado,
            motivos_revision: motivos.length ? motivos.join('; ') : null,
            lat: ubic?.lat ?? null,
            lng: ubic?.lng ?? null,
            precision_m: ubic ? Math.min(ubic.precision, 999999) : null,
            distancia_m: metros === null ? null : Math.min(Math.round(metros * 100) / 100, 999999),
            qr_slot: slot === null ? null : BigInt(slot),
            dispositivo_hash: manual ? null : huella,
          },
        });
        if (selfie) {
          await tx.asistenciaSelfie.create({
            data: { marca_id: creada.id, contenido: selfie.bytes, mime: selfie.mime },
          });
        }
        if (manual) return creada;
        if (!dispositivo) {
          await tx.asistenciaDispositivo.create({ data: { party_id: partyId, huella_hash: huella, ultimo_uso_en: ahora } });
        } else {
          await tx.asistenciaDispositivo.update({ where: { party_id: partyId }, data: { ultimo_uso_en: ahora } });
        }
        return creada;
      });

      await this.auditar(
        'CAMBIO', manual ? 'MARCAR_MANUAL' : 'MARCAR', estado === 'A_REVISAR' ? 'REVISAR' : 'OK',
        { tipo, estado, distancia_m: metros, alertas, duplicada: lectura.duplicada },
        partyId, undefined, 'asistencia_marca', marca.id,
      );

      return {
        ok: true,
        marca: {
          id: Number(marca.id),
          tipo,
          momento: ahora.toISOString(),
          estado,
          distanciaM: metros === null ? null : Math.round(metros * 100) / 100,
          alertas,
        },
        mensaje: `${mensajeMarca(lectura, ahora, cfg.dobleMarcaMin, cfg.toleranciaMin)}${manual ? '. Queda pendiente de revisión del administrador.' : ''}`,
        interpretacion: { rol: tipo, duplicada: lectura.duplicada, alertas: lectura.interp.alertas },
      };
    } catch (e: any) {
      // Misma marca (mismo QR) reintentada: la unicidad por qr_slot sigue vigente
      if (e?.code === 'P2002') {
        throw new ConflictException({ codigo: 'YA_MARCADO', mensaje: 'Esa marca ya quedó registrada.' });
      }
      throw e;
    }
  }

  /** El admin aprueba (la marca cuenta) o anula (no cuenta) una marca; la fila se conserva con quién, cuándo y por qué. */
  async revisarMarca(id: number, accion: 'APROBAR' | 'ANULAR' | 'SEPARAR', dto: RevisarMarcaDto, usuario: UsuarioAutenticado, ip?: string) {
    // Eliminar (anular) una entrada o salida es solo del ADMIN; queda auditado con motivo y la fila se conserva
    if (accion === 'ANULAR' && ![usuario.rol, ...(usuario.roles ?? [])].includes('ADMIN')) {
      throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo el administrador puede eliminar una marca' });
    }
    const marca = await this.prisma.asistenciaMarca.findUnique({ where: { id: BigInt(id) } });
    if (!marca) throw new NotFoundException({ codigo: 'MARCA_NO_ENCONTRADA', mensaje: 'Marca no encontrada' });
    if (marca.estado === 'ANULADA') throw new ConflictException({ codigo: 'MARCA_ANULADA', mensaje: 'Esa marca ya está anulada' });
    // Un período pagado queda congelado: no se aprueba, separa ni anula nada (igual que las correcciones)
    const pagado = await this.prisma.planillaPeriodo.findFirst({
      where: { party_id: marca.party_id, estado: 'PAGADO', desde: { lte: marca.jornada }, hasta: { gte: marca.jornada } },
    });
    if (pagado) throw new ConflictException({ codigo: 'PERIODO_PAGADO', mensaje: 'Ese período ya está pagado. Reábrelo (con motivo) para cambiar esta marca.' });
    // «Separar» = el admin decide que una doble marca cuenta como marca propia (queda APROBADA y ya no se une a la anterior)
    if (accion === 'SEPARAR' && marca.estado !== 'VALIDA' && marca.estado !== 'A_REVISAR') {
      throw new ConflictException({ codigo: 'NO_SE_PUEDE_SEPARAR', mensaje: 'Esa marca ya está aprobada' });
    }
    if (accion === 'APROBAR' && marca.estado !== 'A_REVISAR') {
      throw new ConflictException({ codigo: 'NO_ESTA_POR_REVISAR', mensaje: 'Esa marca no está pendiente de revisión' });
    }
    const estado = accion === 'ANULAR' ? 'ANULADA' : 'APROBADA';
    const motivo = dto.motivo.trim();
    await this.prisma.asistenciaMarca.update({
      where: { id: marca.id },
      data: { estado, revisado_por: usuario.partyId, revisado_en: new Date(), revisado_motivo: motivo },
    });
    await this.auditar(
      'CAMBIO', accion === 'APROBAR' ? 'APROBAR_MARCA' : accion === 'SEPARAR' ? 'SEPARAR_MARCA' : 'ANULAR_MARCA', 'OK',
      { antes: marca.estado, despues: estado, tipo: marca.tipo, partyId: Number(marca.party_id) },
      usuario.partyId, ip, 'asistencia_marca', marca.id, motivo,
    );
    return { ok: true, estado };
  }

  /**
   * Jornadas de una persona en un rango, listas para la planilla: turno programado, marcas que cuentan y estado.
   * Servicio estable: lo usa PlanillaService.
   */
  async diasDePersona(partyId: bigint, desde: string, hasta: string, ahora = new Date()) {
    const ctx = await this.cargarContexto(desde, hasta, [partyId]);
    const cfg = await this.obtenerConfig();
    const dias = [];
    for (let j = desde; j <= hasta; j = sumarDias(j, 1)) {
      const d = this.evaluarDia(partyId, j, ctx, ahora, cfg);
      // marcas = las que cuentan, con su rol interpretado (una sola fuente de verdad para la planilla)
      dias.push({
        jornada: j, estado: d.resultado.estado, turno: d.turno, marcas: d.marcas,
        breakMin: d.interp.breakMin, interp: d.interp, turnoTexto: d.turnoTexto, alertas: d.resultado.alertas,
      });
    }
    return { dias, cfg };
  }

  // ---------------------------------------------------------------------------
  // Estado propio («Mi asistencia»)
  // ---------------------------------------------------------------------------

  async miHoy(partyId: bigint, ahora = new Date()) {
    const { jornada } = jornadaDe(ahora);
    const ctx = await this.cargarContexto(jornada, jornada, [partyId]);
    const cfg = await this.obtenerConfig();
    const dia = this.evaluarDia(partyId, jornada, ctx, ahora, cfg);
    const marcas = await this.prisma.asistenciaMarca.findMany({
      where: { party_id: partyId, jornada: fechaDb(jornada), estado: { not: 'ANULADA' } },
      orderBy: { momento: 'asc' },
    });
    const dispositivo = await this.prisma.asistenciaDispositivo.findUnique({ where: { party_id: partyId } });
    return {
      jornada,
      ahora: ahora.toISOString(),
      turno: dia.turnoTexto,
      estado: dia.resultado.estado,
      resumen: dia.resultado,
      // `tipo` = lo que declaró la persona (null en marcas antiguas); `rol` = lo que interpretó el servidor (vocabulario anterior)
      marcas: marcas.map((m) => {
        const c = dia.interp.marcas.find((x) => x.id === Number(m.id));
        return {
          id: Number(m.id),
          tipo: (m.tipo_marca as TipoMarcaQr | null) ?? null,
          hora: aHoraTexto(jornadaDe(m.momento).minutos),
          rol: c ? rolEfectivo(dia.interp, c) : (m.tipo as TipoMarca),
          momento: m.momento.toISOString(),
          estado: m.estado,
          duplicada: Boolean(c && c.duplicadaDe !== null),
        };
      }),
      siguienteSugerido: siguienteSugerido(dia.interp.marcas.filter((x) => x.duplicadaDe === null && x.rol).map((x) => x.rol!)),
      almuerzoMin: almuerzoMarcadoMin(dia.interp),
      interpretacion: { estado: dia.interp.estado, alertas: dia.interp.alertas, tramos: dia.interp.tramos },
      dobleMarcaMin: cfg.dobleMarcaMin,
      consentimientoAceptado: false,
      consentimientoAceptadoEn: null,
      textoConsentimiento: TEXTO_CONSENTIMIENTO,
      consentimiento: null,
      dispositivoVinculado: Boolean(dispositivo),
      /** Solo si hay punto configurado; nunca las coordenadas. */
      localConUbicacion: cfg.localLat !== null && cfg.localLng !== null,
    };
  }

  async miHistorial(partyId: bigint, dias = 14, ahora = new Date()) {
    const hoy = jornadaDe(ahora).jornada;
    const desde = sumarDias(hoy, -(dias - 1));
    const ctx = await this.cargarContexto(desde, hoy, [partyId]);
    const cfg = await this.obtenerConfig();
    const filas: Array<Record<string, unknown>> = [];
    for (let j = hoy; j >= desde; j = sumarDias(j, -1)) {
      const dia = this.evaluarDia(partyId, j, ctx, ahora, cfg);
      filas.push({ jornada: j, estado: dia.resultado.estado, trabajadaMin: dia.resultado.trabajadaMin, alertas: dia.resultado.alertas, turno: dia.turnoTexto, marcas: dia.interp.marcas.map((m) => ({ id: m.id, tipo: rolEfectivo(dia.interp, m), hora: aHoraTexto(m.minutos), estado: m.estado, duplicada: m.duplicadaDe !== null })) });
    }
    return filas;
  }

  // ---------------------------------------------------------------------------
  // Reportes (solo ADMIN)
  // ---------------------------------------------------------------------------

  async reporteHoy(ahora = new Date()) {
    const hoy = jornadaDe(ahora).jornada;
    const ctx = await this.cargarContexto(hoy, hoy);
    const cfg = await this.obtenerConfig();
    const personas = [...this.partesConActividad(ctx, hoy)];
    const cuentas = await this.cuentas(personas);
    const filas = personas
      .map((pid) => {
        const d = this.evaluarDia(pid, hoy, ctx, ahora, cfg);
        const entrada = d.marcas.find((m) => m.tipo === 'ENTRADA');
        const salida = d.marcas.find((m) => m.tipo === 'SALIDA');
        return {
          partyId: Number(pid),
          nombre: cuentas.get(pid)?.nombre ?? `Persona ${pid}`,
          turno: d.turnoTexto,
          estado: d.resultado.estado,
          alertas: d.resultado.alertas,
          entrada: entrada ? aHoraTexto(entrada.minutos) : null,
          salida: salida ? aHoraTexto(salida.minutos) : null,
          trabajadaMin: d.resultado.trabajadaMin,
          tardanzaMin: d.resultado.tardanzaMin,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    return { jornada: hoy, ahora: ahora.toISOString(), filas };
  }

  /** Reporte mensual por persona y día (JSON o CSV). */
  async reporteMes(anio: number, mes: number, formato: 'json' | 'csv' = 'json', ahora = new Date()) {
    const { filas, personas, dias } = await this.calcularMes(anio, mes, ahora);
    if (formato === 'csv') {
      const cab = ['persona', 'fecha', 'estado', 'programada_h', 'trabajada_h', 'tardanza_min', 'salio_antes_min', 'extra_min', 'alertas'];
      const lineas = [cab.join(',')];
      for (const f of filas) {
        lineas.push([f.nombre, f.jornada, f.estado, horas(f.programadaMin), horas(f.trabajadaMin), f.tardanzaMin, f.salioAntesMin, f.extraMin, f.alertas.join(' | ')].map(csv).join(','));
      }
      return { csv: lineas.join('\n') + '\n', nombre: `asistencia-${anio}-${String(mes).padStart(2, '0')}.csv` };
    }
    return { dias, personas, filas };
  }

  /**
   * Horas netas trabajadas por persona en el mes (servicio estable: lo usa el reparto de propinas).
   * Solo cuenta jornadas ya evaluables (no las que siguen en curso o futuras). Netas = descontado el almuerzo.
   */
  async horasTrabajadasDelMes(anio: number, mes: number, ahora = new Date()) {
    const { personas } = await this.calcularMes(anio, mes, ahora);
    return personas.map((p) => ({
      partyId: p.partyId,
      nombre: p.nombre,
      horasTrabajadas: p.trabajadasH,
      horasProgramadas: p.programadasH,
      diasTrabajados: p.diasTrabajados,
      jornadasIncompletas: p.jornadasIncompletas,
      jornadasARevisar: p.jornadasARevisar,
    }));
  }

  async listarMarcas(filtros: { desde?: string; hasta?: string; partyId?: number }) {
    const where: Record<string, unknown> = {};
    if (filtros.desde || filtros.hasta) {
      where.jornada = {
        ...(filtros.desde ? { gte: fechaDb(filtros.desde) } : {}),
        ...(filtros.hasta ? { lte: fechaDb(filtros.hasta) } : {}),
      };
    }
    if (filtros.partyId) where.party_id = BigInt(filtros.partyId);
    const marcas = await this.prisma.asistenciaMarca.findMany({
      where: where as any,
      orderBy: { momento: 'desc' },
      take: 500,
      include: { selfie: { select: { marca_id: true } } },
    });
    const cuentas = await this.cuentas([...new Set(marcas.map((m) => m.party_id))]);
    return marcas.map((m) => ({
      id: Number(m.id),
      partyId: Number(m.party_id),
      nombre: cuentas.get(m.party_id)?.nombre ?? `Persona ${m.party_id}`,
      jornada: isoDe(m.jornada),
      tipo: m.tipo,
      origen: m.origen,
      momento: m.momento.toISOString(),
      estado: m.estado,
      alertas: m.motivos_revision,
      lat: m.lat === null ? null : Number(m.lat),
      lng: m.lng === null ? null : Number(m.lng),
      precisionM: m.precision_m === null ? null : Number(m.precision_m),
      distanciaM: m.distancia_m === null ? null : Number(m.distancia_m),
      motivo: m.motivo,
      revisadoMotivo: m.revisado_motivo,
      tieneSelfie: Boolean(m.selfie),
    }));
  }

  async obtenerSelfie(marcaId: number, usuario?: UsuarioAutenticado, ip?: string) {
    const selfie = await this.prisma.asistenciaSelfie.findUnique({ where: { marca_id: BigInt(marcaId) } });
    if (!selfie) throw new NotFoundException({ codigo: 'SELFIE_NO_DISPONIBLE', mensaje: 'La foto ya no está disponible' });
    await this.auditar('LECTURA_SENSIBLE', 'VER_SELFIE', 'OK', { marcaId }, usuario?.partyId, ip, 'asistencia_marca', marcaId);
    return { contenido: Buffer.from(selfie.contenido), mime: selfie.mime };
  }

  /** Corrección del administrador: fila nueva con motivo; nunca edita ni borra una marca. */
  async corregir(dto: CorregirMarcaDto, usuario: UsuarioAutenticado, ip?: string) {
    const momento = new Date(dto.momento);
    if (Number.isNaN(momento.getTime())) {
      throw new BadRequestException({ codigo: 'MOMENTO_INVALIDO', mensaje: 'La hora de la corrección no es válida' });
    }
    if (jornadaDe(momento).jornada !== dto.jornada) {
      throw new BadRequestException({ codigo: 'JORNADA_NO_COINCIDE', mensaje: 'La hora no cae en la jornada indicada' });
    }
    const persona = await this.prisma.party.findUnique({ where: { id: BigInt(dto.partyId) } });
    if (!persona) throw new NotFoundException({ codigo: 'PERSONA_NO_ENCONTRADA', mensaje: 'Persona no encontrada' });
    const creada = await this.prisma.asistenciaMarca.create({
      data: {
        party_id: BigInt(dto.partyId),
        jornada: fechaDb(dto.jornada),
        tipo: dto.tipo,
        origen: 'CORRECCION',
        momento,
        estado: 'VALIDA',
        motivo: dto.motivo.trim(),
        por_party_id: usuario.partyId,
      },
    });
    await this.auditar('CAMBIO', 'CORREGIR_MARCA', 'OK', { tipo: dto.tipo, momento: momento.toISOString(), motivo: dto.motivo.trim() }, usuario.partyId, ip, 'asistencia_marca', creada.id);
    return { ok: true, id: Number(creada.id) };
  }

  /**
   * Reasignar el rol de una marca (p. ej. la «salida» era en realidad el regreso del break): append-only.
   * La original queda ANULADA con el motivo y se crea una CORRECCION a la misma hora con el rol elegido (fija).
   */
  async reasignarMarca(id: number, dto: ReasignarMarcaDto, usuario: UsuarioAutenticado, ip?: string) {
    const marca = await this.prisma.asistenciaMarca.findUnique({ where: { id: BigInt(id) } });
    if (!marca) throw new NotFoundException({ codigo: 'MARCA_NO_ENCONTRADA', mensaje: 'Marca no encontrada' });
    if (marca.estado === 'ANULADA') throw new ConflictException({ codigo: 'MARCA_ANULADA', mensaje: 'Esa marca ya está anulada' });
    const motivo = dto.motivo.trim();
    const nueva = await this.prisma.$transaction(async (tx) => {
      await tx.asistenciaMarca.update({
        where: { id: marca.id },
        data: { estado: 'ANULADA', revisado_por: usuario.partyId, revisado_en: new Date(), revisado_motivo: `Reasignada a ${dto.tipo}: ${motivo}` },
      });
      return tx.asistenciaMarca.create({
        data: {
          party_id: marca.party_id,
          jornada: marca.jornada,
          tipo: dto.tipo,
          origen: 'CORRECCION',
          momento: marca.momento,
          estado: 'VALIDA',
          motivo: `Rol reasignado de la marca #${marca.id}: ${motivo}`,
          por_party_id: usuario.partyId,
        },
      });
    });
    await this.auditar('CAMBIO', 'REASIGNAR_MARCA', 'OK', { de: marca.tipo, a: dto.tipo, marcaOriginal: Number(marca.id) }, usuario.partyId, ip, 'asistencia_marca', nueva.id, motivo);
    return { ok: true, id: Number(nueva.id) };
  }

  /**
   * Cambiar la hora de una marca (el admin corrige una hora mal registrada, p. ej. por una falla del sistema). Append-only:
   * la original queda ANULADA (no cuenta) con quién, cuándo y por qué, y se crea una CORRECCION con la hora nueva y el mismo rol.
   * Las horas, la tardanza y la penalidad se recalculan solas porque salen de las marcas que cuentan.
   */
  async cambiarHoraMarca(id: number, dto: CambiarHoraMarcaDto, usuario: UsuarioAutenticado, ip?: string) {
    const marca = await this.prisma.asistenciaMarca.findUnique({ where: { id: BigInt(id) } });
    if (!marca) throw new NotFoundException({ codigo: 'MARCA_NO_ENCONTRADA', mensaje: 'Marca no encontrada' });
    if (marca.estado === 'ANULADA') throw new ConflictException({ codigo: 'MARCA_ANULADA', mensaje: 'Esa marca ya está anulada' });
    const momento = new Date(dto.momento);
    if (Number.isNaN(momento.getTime())) throw new BadRequestException({ codigo: 'MOMENTO_INVALIDO', mensaje: 'La hora no es válida' });
    const jornada = marca.jornada.toISOString().slice(0, 10);
    if (jornadaDe(momento).jornada !== jornada) {
      throw new BadRequestException({ codigo: 'JORNADA_NO_COINCIDE', mensaje: 'La hora nueva debe caer en el mismo día laboral de la marca' });
    }
    const pagado = await this.prisma.planillaPeriodo.findFirst({
      where: { party_id: marca.party_id, estado: 'PAGADO', desde: { lte: marca.jornada }, hasta: { gte: marca.jornada } },
    });
    if (pagado) throw new ConflictException({ codigo: 'PERIODO_PAGADO', mensaje: 'Ese período ya está pagado. Reábrelo (con motivo) para cambiar la hora de esta marca.' });
    const motivo = dto.motivo.trim();
    const de = aHoraTexto(jornadaDe(marca.momento).minutos);
    const a = aHoraTexto(jornadaDe(momento).minutos);
    const quien = (await this.cuentas([usuario.partyId])).get(usuario.partyId)?.nombre ?? `usuario ${usuario.partyId}`;
    const nueva = await this.prisma.$transaction(async (tx) => {
      await tx.asistenciaMarca.update({
        where: { id: marca.id },
        data: { estado: 'ANULADA', revisado_por: usuario.partyId, revisado_en: new Date(), revisado_motivo: `Hora cambiada a ${a}: ${motivo}` },
      });
      return tx.asistenciaMarca.create({
        data: {
          party_id: marca.party_id, jornada: marca.jornada, tipo: dto.tipo ?? marca.tipo, origen: 'CORRECCION', momento, estado: 'VALIDA',
          motivo: `Hora corregida de ${de} a ${a} por ${quien} (marca #${marca.id}): ${motivo}`,
          por_party_id: usuario.partyId,
        },
      });
    });
    await this.auditar('CAMBIO', 'CAMBIAR_HORA_MARCA', 'OK', { de, a, marcaOriginal: Number(marca.id), tipo: nueva.tipo }, usuario.partyId, ip, 'asistencia_marca', nueva.id, motivo);
    return { ok: true, id: Number(nueva.id) };
  }

  /**
   * El admin fija ingreso y/o salida de un día aunque la persona no haya marcado (o haya marcado mal). Append-only: las marcas
   * vigentes de ese rol quedan ANULADAS con quién, cuándo y por qué, y se crea una CORRECCION con la hora nueva que dice la hora original.
   * Horas, tardanza, extras, penalidad y sueldo del período se recalculan solos porque salen de las marcas que cuentan.
   */
  async ajustarDia(dto: AjustarDiaDto, usuario: UsuarioAutenticado, ip?: string) {
    if (!dto.entrada && !dto.salida) throw new BadRequestException({ codigo: 'SIN_HORAS', mensaje: 'Indica la hora de ingreso, la de salida o ambas' });
    const persona = await this.prisma.party.findUnique({ where: { id: BigInt(dto.partyId) } });
    if (!persona) throw new NotFoundException({ codigo: 'PERSONA_NO_ENCONTRADA', mensaje: 'Persona no encontrada' });
    const pedidas: Array<{ tipo: 'ENTRADA' | 'SALIDA'; momento: Date }> = [];
    for (const [tipo, iso] of [['ENTRADA', dto.entrada], ['SALIDA', dto.salida]] as const) {
      if (!iso) continue;
      const momento = new Date(iso);
      if (Number.isNaN(momento.getTime())) throw new BadRequestException({ codigo: 'MOMENTO_INVALIDO', mensaje: 'La hora no es válida' });
      if (jornadaDe(momento).jornada !== dto.jornada) throw new BadRequestException({ codigo: 'JORNADA_NO_COINCIDE', mensaje: 'La hora no cae en el día laboral indicado' });
      pedidas.push({ tipo, momento });
    }
    if (dto.entrada && dto.salida && new Date(dto.salida).getTime() <= new Date(dto.entrada).getTime()) {
      throw new BadRequestException({ codigo: 'SALIDA_ANTES_DE_ENTRADA', mensaje: 'La salida debe ser posterior al ingreso' });
    }
    const jornada = fechaDb(dto.jornada);
    const pagado = await this.prisma.planillaPeriodo.findFirst({ where: { party_id: persona.id, estado: 'PAGADO', desde: { lte: jornada }, hasta: { gte: jornada } } });
    if (pagado) throw new ConflictException({ codigo: 'PERIODO_PAGADO', mensaje: 'Ese período ya está pagado. Reábrelo (con motivo) para cambiar las horas de este día.' });
    const motivo = dto.motivo.trim();
    const quien = (await this.cuentas([usuario.partyId])).get(usuario.partyId)?.nombre ?? `usuario ${usuario.partyId}`;
    const ids = await this.prisma.$transaction(async (tx) => {
      const creadas: number[] = [];
      for (const p of pedidas) {
        const vigentes = await tx.asistenciaMarca.findMany({ where: { party_id: persona.id, jornada, tipo: p.tipo, estado: { not: 'ANULADA' } }, orderBy: { momento: 'asc' } });
        const a = aHoraTexto(jornadaDe(p.momento).minutos);
        const original = vigentes.length ? vigentes.map((m) => aHoraTexto(jornadaDe(m.momento).minutos)).join(', ') : 'sin marca';
        const etiqueta = p.tipo === 'ENTRADA' ? 'Ingreso' : 'Salida';
        for (const m of vigentes) {
          await tx.asistenciaMarca.update({ where: { id: m.id }, data: { estado: 'ANULADA', revisado_por: usuario.partyId, revisado_en: new Date(), revisado_motivo: `${etiqueta} ajustado a ${a}: ${motivo}` } });
        }
        const nueva = await tx.asistenciaMarca.create({
          data: { party_id: persona.id, jornada, tipo: p.tipo, origen: 'CORRECCION', momento: p.momento, estado: 'VALIDA', motivo: `${etiqueta} ajustado de ${original} a ${a} por ${quien}: ${motivo}`, por_party_id: usuario.partyId },
        });
        creadas.push(Number(nueva.id));
        await this.auditar('CAMBIO', 'AJUSTAR_DIA', 'OK', { tipo: p.tipo, de: original, a, anuladas: vigentes.map((m) => Number(m.id)), jornada: dto.jornada }, usuario.partyId, ip, 'asistencia_marca', nueva.id, motivo);
      }
      return creadas;
    });
    return { ok: true, ids };
  }

  /**
   * El admin decide cuál marca del día es la ENTRADA y cuál la SALIDA, y qué hacer con las demás. Append-only: cada marca elegida
   * se anula y se crea una CORRECCION (rol fijo) a la misma hora; las demás quedan ANULADAS («No cuenta»). Con `otras: 'BREAK'`,
   * las dos marcas que quedan entre la entrada y la salida son salida a break y regreso. Cada marca tocada se audita.
   */
  async resolverMarcas(dto: ResolverMarcasDto, usuario: UsuarioAutenticado, ip?: string) {
    if (![usuario.rol, ...(usuario.roles ?? [])].includes('ADMIN')) {
      throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo el administrador puede resolver las marcas de un día.' });
    }
    if (dto.entradaMarcaId === dto.salidaMarcaId) {
      throw new BadRequestException({ codigo: 'MARCAS_IGUALES', mensaje: 'La entrada y la salida deben ser marcas distintas' });
    }
    const persona = await this.prisma.party.findUnique({ where: { id: BigInt(dto.partyId) } });
    if (!persona) throw new NotFoundException({ codigo: 'PERSONA_NO_ENCONTRADA', mensaje: 'Persona no encontrada' });
    const jornada = fechaDb(dto.jornada);
    const pagado = await this.prisma.planillaPeriodo.findFirst({ where: { party_id: persona.id, estado: 'PAGADO', desde: { lte: jornada }, hasta: { gte: jornada } } });
    if (pagado) throw new ConflictException({ codigo: 'PERIODO_PAGADO', mensaje: 'Ese período ya está pagado. Reábrelo (con motivo) para cambiar las marcas de este día.' });
    const vigentes = (await this.prisma.asistenciaMarca.findMany({ where: { party_id: persona.id, jornada, estado: { not: 'ANULADA' } } }))
      .sort((a, b) => a.momento.getTime() - b.momento.getTime());
    const buscar = (id: number, rol: string) => {
      const m = vigentes.find((x) => x.id === BigInt(id));
      if (!m) throw new NotFoundException({ codigo: 'MARCA_NO_ENCONTRADA', mensaje: `La marca elegida como ${rol} no está vigente en ese día` });
      return m;
    };
    const entrada = buscar(dto.entradaMarcaId, 'entrada');
    const salida = buscar(dto.salidaMarcaId, 'salida');
    if (salida.momento.getTime() <= entrada.momento.getTime()) {
      throw new BadRequestException({ codigo: 'SALIDA_ANTES_DE_ENTRADA', mensaje: 'La salida debe ser posterior a la entrada' });
    }
    const entre = vigentes.filter((m) => m.momento.getTime() > entrada.momento.getTime() && m.momento.getTime() < salida.momento.getTime());
    if (dto.otras === 'BREAK' && entre.length !== 2) {
      throw new BadRequestException({ codigo: 'BREAK_REQUIERE_DOS_MARCAS', mensaje: `Para usarlas como break debe haber exactamente 2 marcas entre la entrada y la salida (hay ${entre.length})` });
    }
    const roles = new Map<bigint, 'ENTRADA' | 'SALIDA' | 'SALIDA_ALMUERZO' | 'ENTRADA_ALMUERZO'>([[entrada.id, 'ENTRADA'], [salida.id, 'SALIDA']]);
    if (dto.otras === 'BREAK') {
      roles.set(entre[0].id, 'SALIDA_ALMUERZO');
      roles.set(entre[1].id, 'ENTRADA_ALMUERZO');
    }
    const motivo = dto.motivo.trim();
    const nuevas = await this.prisma.$transaction(async (tx) => {
      const creadas: Partial<Record<'ENTRADA' | 'SALIDA' | 'SALIDA_ALMUERZO' | 'ENTRADA_ALMUERZO', number>> = {};
      for (const m of vigentes) {
        const rol = roles.get(m.id) ?? null;
        await tx.asistenciaMarca.update({
          where: { id: m.id },
          data: {
            estado: 'ANULADA', revisado_por: usuario.partyId, revisado_en: new Date(),
            revisado_motivo: rol ? `Rol asignado a ${rol} por el administrador: ${motivo}` : `No cuenta: criterio del administrador: ${motivo}`,
          },
        });
        let nuevaId: number | null = null;
        if (rol) {
          const nueva = await tx.asistenciaMarca.create({
            data: {
              party_id: m.party_id, jornada, tipo: rol, origen: 'CORRECCION', momento: m.momento, estado: 'VALIDA',
              motivo: `Marca #${m.id} elegida como ${rol} por el administrador: ${motivo}`, por_party_id: usuario.partyId,
            },
          });
          nuevaId = Number(nueva.id);
          creadas[rol] = nuevaId;
        }
        await this.auditar('CAMBIO', 'RESOLVER_MARCA', 'OK', { marcaOriginal: Number(m.id), rol: rol ?? 'NO_CUENTA', criterio: dto.otras, jornada: dto.jornada, nueva: nuevaId }, usuario.partyId, ip, 'asistencia_marca', m.id, motivo);
      }
      return creadas;
    });
    return { ok: true, entrada: nuevas.ENTRADA ?? null, salida: nuevas.SALIDA ?? null };
  }

  async reiniciarDispositivo(partyId: number, usuario: UsuarioAutenticado, ip?: string) {
    const borrados = await this.prisma.asistenciaDispositivo.deleteMany({ where: { party_id: BigInt(partyId) } });
    await this.auditar('CAMBIO', 'REINICIAR_DISPOSITIVO', 'OK', { borrados: borrados.count }, usuario.partyId, ip, 'party', partyId);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Cálculo compartido
  // ---------------------------------------------------------------------------

  /**
   * Cómo quedaría la jornada con una marca nueva en `momento`: el rol que le toca (por orden y pares) y si es doble marca.
   * No guarda nada.
   */
  private async leerNuevaMarca(partyId: bigint, jornada: string, momento: Date, cfg: ConfigAsistencia, declarado: TipoMarcaQr | null = null) {
    const ctx = await this.cargarContexto(jornada, jornada, [partyId]);
    const nueva: MarcaCalc = { id: -1, tipo: 'ENTRADA', declarado, minutos: jornadaDe(momento).minutos, estado: 'VALIDA' };
    const { turno, motivoDescanso } = resolverTurno(partyId, jornada, ctx);
    const previas = ctx.marcas.get(`${partyId}|${jornada}`) ?? [];
    const { interp } = evaluarJornada({
      jornada, turno, marcas: [...previas, nueva], ahora: momento, tolerancia: cfg.toleranciaMin, motivoDescanso, dobleMarcaMin: cfg.dobleMarcaMin,
    });
    const m = interp.marcas.find((x) => x.id === -1)!;
    return { rol: (rolEfectivo(interp, m) ?? 'SALIDA') as TipoMarca, duplicada: m.duplicadaDe !== null, interp, turno };
  }

  async cargarContexto(desde: string, hasta: string, partyIds?: bigint[]) {
    const rango = { gte: fechaDb(desde), lte: fechaDb(hasta) };
    const [horarios, coberturas, reemplazos, marcas] = await Promise.all([
      this.prisma.horarioTrabajo.findMany({ where: { activo: true } }),
      this.prisma.coberturaTurno.findMany({ where: { fecha: rango } }),
      this.prisma.reemplazoDia.findMany({ where: { activo: true } }),
      this.prisma.asistenciaMarca.findMany({
        where: { jornada: rango, estado: { not: 'ANULADA' }, ...(partyIds ? { party_id: { in: partyIds } } : {}) },
        orderBy: { momento: 'asc' },
        include: { selfie: { select: { marca_id: true } } },
      }),
    ]);
    const horariosFila: HorarioFila[] = horarios.map((h) => ({
      partyId: h.party_id,
      dia: h.dia_semana,
      entrada: minutosDeHora(h.entrada),
      salida: minutosDeHora(h.salida),
      almuerzoIni: h.almuerzo_inicio ? minutosDeHora(h.almuerzo_inicio) : null,
      almuerzoFin: h.almuerzo_fin ? minutosDeHora(h.almuerzo_fin) : null,
    }));
    const coberturasFila: CoberturaFila[] = coberturas.map((c) => ({
      fecha: isoDe(c.fecha),
      cubreId: c.cubre_party_id,
      reemplazaId: c.reemplaza_party_id,
      desde: minutosDeHora(c.desde),
      hasta: minutosDeHora(c.hasta),
    }));
    const reemplazosFila: ReemplazoFila[] = reemplazos.map((r) => ({
      partyId: r.party_id,
      dia: r.dia_semana,
      reemplazaId: r.reemplaza_party_id,
    }));
    const porClave = new Map<string, MarcaCalc[]>();
    for (const m of marcas) {
      const clave = `${m.party_id}|${isoDe(m.jornada)}`;
      const lista = porClave.get(clave) ?? [];
      // APROBADA cuenta como válida. Solo la corrección del admin conserva su tipo (fijo): las demás se interpretan por orden y pares.
      lista.push({
        id: Number(m.id),
        tipo: m.tipo as TipoMarca,
        declarado: (m.tipo_marca as TipoMarcaQr | null) ?? null,
        minutos: jornadaDe(m.momento).minutos,
        estado: m.estado === 'A_REVISAR' ? 'A_REVISAR' : 'VALIDA',
        fijo: m.origen === 'CORRECCION',
        separada: m.estado === 'APROBADA' || m.origen === 'CORRECCION',
      });
      porClave.set(clave, lista);
    }
    return { horarios: horariosFila, coberturas: coberturasFila, reemplazos: reemplazosFila, marcas: porClave, filas: marcas };
  }

  partesConActividad(ctx: Awaited<ReturnType<AsistenciaService['cargarContexto']>>, jornada: string): Set<bigint> {
    const set = new Set<bigint>();
    const dia = diaSemana(jornada);
    for (const h of ctx.horarios) if (h.dia === dia) set.add(h.partyId);
    for (const c of ctx.coberturas) if (c.fecha === jornada) { set.add(c.cubreId); if (c.reemplazaId) set.add(c.reemplazaId); }
    for (const clave of ctx.marcas.keys()) {
      const [pid, j] = clave.split('|');
      if (j === jornada) set.add(BigInt(pid));
    }
    return set;
  }

  evaluarDia(partyId: bigint, jornada: string, ctx: Awaited<ReturnType<AsistenciaService['cargarContexto']>>, ahora: Date, cfg: ConfigAsistencia) {
    const { turno, motivoDescanso } = resolverTurno(partyId, jornada, ctx);
    const crudas = ctx.marcas.get(`${partyId}|${jornada}`) ?? [];
    const { resultado, interp } = evaluarJornada({
      jornada, turno, marcas: crudas, ahora, tolerancia: cfg.toleranciaMin, motivoDescanso, dobleMarcaMin: cfg.dobleMarcaMin,
    });
    // Las que cuentan, ya con su rol interpretado (las dobles marcas no cuentan)
    const marcas: MarcaCalc[] = interp.marcas.filter((m) => m.duplicadaDe === null && m.rol).map((m) => ({ ...m, tipo: m.rol! }));
    const turnoTexto = turno
      ? { entrada: aHoraTexto(turno.entrada), salida: aHoraTexto(turno.salida), almuerzo: turno.almuerzoIni !== undefined && turno.almuerzoFin !== undefined ? `${aHoraTexto(turno.almuerzoIni)}-${aHoraTexto(turno.almuerzoFin)}` : null }
      : null;
    return { turno, turnoTexto, marcas, resultado, interp };
  }

  private async calcularMes(anio: number, mes: number, ahora: Date) {
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const diasMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`;
    const ctx = await this.cargarContexto(desde, hasta);
    const cfg = await this.obtenerConfig();
    const dias: string[] = [];
    for (let i = 0; i < diasMes; i++) dias.push(sumarDias(desde, i));
    const personas = new Set<bigint>();
    for (const j of dias) for (const p of this.partesConActividad(ctx, j)) personas.add(p);
    const cuentas = await this.cuentas([...personas]);
    const filas: Array<ResultadoJornada & { partyId: number; nombre: string; jornada: string }> = [];
    const resumen = [];
    for (const pid of personas) {
      let programadasMin = 0;
      let trabajadasMin = 0;
      let diasTrabajados = 0;
      let jornadasIncompletas = 0;
      let jornadasARevisar = 0;
      const nombre = cuentas.get(pid)?.nombre ?? `Persona ${pid}`;
      for (const j of dias) {
        const d = this.evaluarDia(pid, j, ctx, ahora, cfg);
        filas.push({ ...d.resultado, partyId: Number(pid), nombre, jornada: j });
        if (['SIN_EVALUAR', 'POR_EMPEZAR', 'SIN_MARCAR_ENTRADA'].includes(d.resultado.estado)) continue; // en curso o futuro: no suma a los totales
        if (d.resultado.estado === 'INCOMPLETO' || d.resultado.estado === 'SIN_SALIDA') jornadasIncompletas++;
        if (d.resultado.estado === 'A_REVISAR') jornadasARevisar++;
        if (d.resultado.estado !== 'DESCANSO') programadasMin += d.resultado.programadaMin;
        trabajadasMin += d.resultado.trabajadaMin;
        if (d.resultado.trabajadaMin > 0) diasTrabajados++;
      }
      resumen.push({
        partyId: Number(pid),
        nombre,
        programadasH: horas(programadasMin),
        trabajadasH: horas(trabajadasMin),
        diasTrabajados,
        jornadasIncompletas,
        jornadasARevisar,
      });
    }
    return { filas, personas: resumen, dias };
  }

  async cuentas(ids: bigint[]): Promise<Map<bigint, { nombre: string }>> {
    const personas = await this.prisma.person.findMany({ where: { party_id: { in: ids } } });
    const mapa = new Map<bigint, { nombre: string }>();
    for (const p of personas) {
      mapa.set(p.party_id, { nombre: [p.nombres, p.apellidos].filter(Boolean).join(' ') });
    }
    return mapa;
  }

  // ---------------------------------------------------------------------------
  // Límites y auditoría
  // ---------------------------------------------------------------------------

  private exigirNoBloqueado(clave: string, claveIp: string, ahoraMs: number) {
    for (const k of [clave, claveIp]) {
      const hasta = this.bloqueos.get(k);
      if (hasta && hasta > ahoraMs) {
        throw new HttpException(
          { codigo: 'ASISTENCIA_BLOQUEADA', mensaje: 'Demasiados intentos. Espera unos minutos y vuelve a intentar.' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private registrarFallo(clave: string, claveIp: string, ahoraMs: number) {
    for (const [k, limite] of [[clave, LIMITE_FALLOS_USUARIO], [claveIp, LIMITE_FALLOS_IP]] as const) {
      const lista = (this.fallosUsuario.get(k) ?? []).filter((t) => t > ahoraMs - VENTANA_FALLOS_MS);
      lista.push(ahoraMs);
      this.fallosUsuario.set(k, lista);
      if (lista.length >= limite) {
        this.bloqueos.set(k, ahoraMs + BLOQUEO_MS);
        this.fallosUsuario.delete(k);
      }
    }
  }

  private async auditar(
    categoria: string,
    accion: string,
    resultado: string,
    despues: Record<string, unknown>,
    partyId: bigint | undefined,
    ip: string | undefined,
    entidad: string,
    entidadId: bigint | number | null,
    motivo?: string,
  ) {
    await this.auditoria?.registrar({
      categoria: categoria as any,
      modulo: 'asistencia',
      accion,
      resultado,
      entidad,
      entidadId: entidadId === null ? undefined : Number(entidadId),
      despues,
      partyId,
      ip,
      motivo,
    } as any);
  }
}

const ANTIGUO_A_NUEVO: Record<string, TipoMarcaQr> = { ENTRADA: 'ENTRADA', SALIDA: 'SALIDA', SALIDA_ALMUERZO: 'ALMUERZO_SALIDA', ENTRADA_ALMUERZO: 'ALMUERZO_VUELTA' };
const NUEVOS = new Set(['ENTRADA', 'SALIDA', 'ALMUERZO_SALIDA', 'ALMUERZO_VUELTA']);
/** Tipo declarado al marcar (acepta también los nombres antiguos); null si no vino. */
const declaradoDe = (t?: string): TipoMarcaQr | null => (!t ? null : NUEVOS.has(t) ? (t as TipoMarcaQr) : (ANTIGUO_A_NUEVO[t] ?? null));

const etiquetaTipo = (t: TipoMarca): string =>
  ({ ENTRADA: 'tu entrada', SALIDA_ALMUERZO: 'tu salida a break', ENTRADA_ALMUERZO: 'tu regreso del break', SALIDA: 'tu salida' })[t];

/** Lo que se le dice a la persona al marcar: qué interpretó el sistema y, en entrada y salida, cómo quedó frente a su turno. */
export const mensajeMarca = (
  l: { rol: TipoMarca; duplicada: boolean; turno?: { entrada: number; salida: number } | null }, ahora: Date, dobleMin: number, tolerancia = 0,
): string => {
  if (l.duplicada) return `Tu marca de las ${horaLima(ahora)} se unió a la anterior (menos de ${dobleMin} min): cuenta la primera`;
  const base = `Marcaste ${etiquetaTipo(l.rol)} a las ${horaLima(ahora)}`;
  if (l.rol !== 'ENTRADA' && l.rol !== 'SALIDA') return base;
  const min = jornadaDe(ahora).minutos;
  if (!l.turno) {
    return l.rol === 'ENTRADA'
      ? `${base}. Hoy no tienes turno programado, así que no se mide tardanza`
      : `${base}. Hoy no tienes turno programado, así que no se mide la hora de salida`;
  }
  if (l.rol === 'ENTRADA') {
    const dif = min - l.turno.entrada;
    const turno = `tu turno empieza a las ${aHoraTexto(l.turno.entrada)}`;
    if (dif > tolerancia) return `${base}. ⏰ Llegaste tarde: ${dif} min (${turno})`;
    if (dif < 0) return `${base}. 🌟 Llegaste temprano: ${-dif} min antes (${turno})`;
    return `${base}. ✅ Llegaste puntual (${turno})`;
  }
  const dif = min - l.turno.salida;
  const turno = `tu turno termina a las ${aHoraTexto(l.turno.salida)}`;
  if (dif < -tolerancia) return `${base}. Saliste ${-dif} min antes (${turno})`;
  if (dif > tolerancia) return `${base}. Saliste ${dif} min después (${turno})`;
  return `${base}. Saliste a tiempo (${turno})`;
};

const horaLima = (d: Date): string => aHoraTexto(jornadaDe(d).minutos);

const horas = (min: number): number => Math.round((min / 60) * 100) / 100;

const csv = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Punto del GPS solo si es real (latitud ±90, longitud ±180, precisión ≥ 0); si no, null y la marca sigue. */
export function ubicacionValida(lat?: number, lng?: number, precision?: number): { lat: number; lng: number; precision: number } | null {
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (!ok(lat) || !ok(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, precision: ok(precision) && precision >= 0 ? precision : 0 };
}
