import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { adquirirCandado } from '../../comun/redis/candado.util';
import { AvisosEquipoCorreoService } from '../correo';
import { obtenerFechaHoraLima } from '../local';
import { clasificarEquipos, agenteConectado, filaAConfig } from '../impresion';
import { enteroEnRango, horaLima, interruptorEncendido, inicioDiaLima, minutosEntre } from './avisos-programados.util';
import { leerParametro, reclamarMarca } from './marcas';

export const PC_MINUTOS_TRAS_ABRIR_DEFECTO = 20;
export const PC_RECORDATORIO_DEFECTO = 60;
const INTERVALO_MS = 60_000;
const CLAVE_CANDADO = 'lock:avisos:pc-impresion';

export type ResultadoRevisionPc =
  | { accion: 'apagado' | 'sin_caja' | 'sin_hora_apertura' | 'aun_no' | 'otra_instancia' | 'sin_recordatorio' | 'todo_en_linea' }
  | { accion: 'enviado'; numero: 0 | 1; enLinea: number; vinculados: number; faltan: string[] };

/**
 * Aviso «computadoras de impresión sin conectar»: N minutos después de abrir la caja del día revisa los equipos vinculados
 * y, si hay menos EN LÍNEA que vinculados, manda UN correo; repite UNA vez más pasado el recordatorio. «En línea» y
 * «vinculado» son exactamente los de la pantalla de impresión (latido de 60 s o menos; activa, no archivada ni antigua).
 */
@Injectable()
export class PcImpresionAvisoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PcImpresionAvisoService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly avisos: AvisosEquipoCorreoService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    // ponytail: un temporizador por instancia; la marca única en aviso_marca evita duplicados entre instancias
    this.timer = setInterval(() => {
      this.ciclo().catch((err) => this.logger.error(`Aviso de PC de impresión: ${err.message}`, err.stack));
    }, INTERVALO_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async ciclo(ahora = new Date()): Promise<ResultadoRevisionPc | null> {
    const candado = await adquirirCandado(this.redis.obtenerCliente(), CLAVE_CANDADO, INTERVALO_MS - 5000);
    if (!candado.adquirido) return null;
    return this.revisar(ahora);
  }

  async revisar(ahora: Date): Promise<ResultadoRevisionPc> {
    if (!interruptorEncendido(await leerParametro(this.prisma, 'aviso_pc_impresion_activo'))) return { accion: 'apagado' };
    const minutosTras = enteroEnRango(await leerParametro(this.prisma, 'aviso_pc_impresion_minutos_tras_abrir'), PC_MINUTOS_TRAS_ABRIR_DEFECTO, 5, 120);
    const recordatorio = enteroEnRango(await leerParametro(this.prisma, 'aviso_pc_impresion_recordatorio_min'), PC_RECORDATORIO_DEFECTO, 15, 240);

    const { fechaIso } = obtenerFechaHoraLima(ahora);
    // La jornada es la caja de HOY y sigue abierta: sin caja abierta no se avisa
    const caja = await this.prisma.caja.findUnique({ where: { fecha: new Date(`${fechaIso}T00:00:00.000Z`) }, select: { id: true, estado: true } });
    if (!caja || caja.estado !== 'ABIERTA') return { accion: 'sin_caja' };

    const apertura = await this.prisma.auditoria.findFirst({
      where: { modulo: 'caja', accion: 'ABRIR_CAJA', entidad: 'caja', entidad_id: caja.id },
      orderBy: { en: 'asc' },
      select: { en: true },
    });
    if (!apertura) return { accion: 'sin_hora_apertura' };
    if (ahora.getTime() < apertura.en.getTime() + minutosTras * 60_000) return { accion: 'aun_no' };

    const claveBase = `pc-impresion:${fechaIso}`;
    let numero: 0 | 1;
    const marca0 = await this.prisma.avisoMarca.findUnique({ where: { clave: `${claveBase}:0` } });
    if (!marca0) {
      if (!(await reclamarMarca(this.prisma, `${claveBase}:0`, 'PC_IMPRESION', 'REVISANDO', ahora))) return { accion: 'otra_instancia' };
      numero = 0;
    } else {
      // El recordatorio solo existe si la primera revisión mandó correo
      if (marca0.referencia !== 'ENVIADO') return { accion: 'sin_recordatorio' };
      if (ahora.getTime() < marca0.creado_en.getTime() + recordatorio * 60_000) return { accion: 'aun_no' };
      if (!(await reclamarMarca(this.prisma, `${claveBase}:1`, 'PC_IMPRESION', 'RECORDATORIO', ahora))) return { accion: 'otra_instancia' };
      numero = 1;
    }

    const { vinculados, faltan } = await this.estadoEquipos(ahora);
    if (faltan.length === 0) {
      if (numero === 0) await this.prisma.avisoMarca.update({ where: { clave: `${claveBase}:0` }, data: { referencia: 'OK' } });
      return { accion: 'todo_en_linea' };
    }

    const enLinea = vinculados - faltan.length;
    const lineas = faltan.map((f) => `- ${f.nombre} (${f.funcion}): ${f.desde}`);
    const espera = numero === 0 ? `Pasaron ${minutosTras} minutos desde que se abrió la caja de hoy` : `Hace ${recordatorio} minutos avisamos de esto y sigue igual`;
    await this.avisos.avisar({
      clave: `${claveBase}:${numero}`,
      origen: 'PC_IMPRESION',
      tipo: 'PC_IMPRESION',
      asunto: `${numero === 1 ? 'Recordatorio: ' : ''}${enLinea} de ${vinculados} computadoras de impresión en línea`,
      texto:
        `${espera} y hay ${enLinea} de ${vinculados} computadoras de impresión en línea.\n\n` +
        `Sin conexión:\n${lineas.join('\n')}\n\n` +
        'Qué hacer: abre el programa de impresión en esa computadora y deja la ventana abierta. ' +
        'Si no estás seguro de si está funcionando, en esa computadora escribe el comando "agente-impresion-windows.exe --estado" y mira la última conexión.\n\n' +
        'Ver el estado: /admin/mirest?tab=impresion',
      ahora,
    });
    if (numero === 0) await this.prisma.avisoMarca.update({ where: { clave: `${claveBase}:0` }, data: { referencia: 'ENVIADO' } });
    this.logger.log(JSON.stringify({ evento: 'aviso_pc_impresion', numero, enLinea, vinculados }));
    return { accion: 'enviado', numero, enLinea, vinculados, faltan: faltan.map((f) => f.nombre) };
  }

  /** Mismos equipos que la pantalla de impresión: activos, no archivados, no antiguos ni pausados a propósito. */
  private async estadoEquipos(ahora: Date) {
    const filas = (await this.prisma.deviceKey.findMany({
      where: { tipo: 'AGENTE', activo: true, archivada_en: null, codigo_vinculo: null },
      orderBy: { id: 'asc' },
      include: { area: { select: { nombre: true } }, configImpresion: true },
    } as any)) as any[];
    const clas = clasificarEquipos(filas, ahora.getTime());
    const vinculados = filas.filter((f) => !clas.get(f.id)?.antigua && !f.configImpresion?.pausado);
    const inicioHoy = inicioDiaLima(obtenerFechaHoraLima(ahora).fechaIso);
    const faltan = vinculados
      .filter((f) => !agenteConectado(f.ultimo_latido, ahora.getTime()))
      .map((f) => {
        const cfg = filaAConfig(f.configImpresion);
        const funcion = [cfg.etiquetera && 'etiquetera', cfg.ticketera && 'ticketera', f.area?.nombre && `área ${f.area.nombre}`]
          .filter(Boolean)
          .join(' y ') || 'sin función asignada';
        const ult: Date | null = f.ultimo_latido ? new Date(f.ultimo_latido) : null;
        const desde = !ult
          ? 'nunca dio señal'
          : ult >= inicioHoy
            ? `sin señal desde las ${horaLima(ult)} (hace ${minutosEntre(ult, ahora)} min)`
            : `sin señal desde antes de hoy (última vez ${new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit' }).format(ult)} ${horaLima(ult)})`;
        return { nombre: String(f.nombre), funcion, desde };
      });
    return { vinculados: vinculados.length, faltan };
  }
}
