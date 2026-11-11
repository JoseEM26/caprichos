import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CorreoService } from './correo.service';
import { INFO_TIPOS_AVISO, TIPOS_AVISO, TipoAviso, correoValido, enmascararCorreo, esTipoAviso } from './tipos-aviso';

export const MAX_CORREOS_EXTRA = 20;
export const PRUEBAS_POR_DIA = 10;
const PRUEBA_PAUSA_MS = 60_000;

export interface DatosCorreoExtra {
  correo?: string;
  etiqueta?: string | null;
  activo?: boolean;
  tipos?: string[];
}

interface Actor {
  partyId?: bigint | string | number;
}

const fila = (c: any) => ({
  id: String(c.id),
  correo: c.correo as string,
  etiqueta: (c.etiqueta ?? null) as string | null,
  activo: !!c.activo,
  tipos: (c.tipos ?? []) as string[],
});

/** Correos extra de aviso (sin usuario): se SUMAN a quienes ya reciben por la casilla de Usuarios y los turnos. */
@Injectable()
export class CorreosExtraService {
  private readonly logger = new Logger(CorreosExtraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly correo: CorreoService,
    private readonly config: ConfigService,
  ) {}

  /** Lo que ve el dueño: la lista editable, los tipos y, de solo lectura, quién recibe por su usuario. */
  async listar() {
    const [extras, cuentas] = await Promise.all([
      this.prisma.correoAvisoExtra.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.userAccount.findMany({
        where: { activo: true, avisos_correo: true },
        select: {
          rol: true,
          party: { select: { persona: { select: { nombres: true, apellidos: true, correo: true, horario_24_7: true } } } },
        },
      }),
    ]);
    return {
      maximo: MAX_CORREOS_EXTRA,
      correoConfigurado: !!this.config.get<string>('RESEND_API_KEY')?.trim(),
      tipos: TIPOS_AVISO.map((id) => ({ id, ...INFO_TIPOS_AVISO[id] })),
      correos: extras.map(fila),
      personasPorUsuario: cuentas.map((c) => {
        const p = c.party?.persona;
        const correo = p?.correo?.trim().toLowerCase();
        return {
          nombre: p ? `${p.nombres} ${p.apellidos ?? ''}`.trim() : 'Sin nombre',
          rol: c.rol,
          correo: correo ? enmascararCorreo(correo) : null,
          tipos: [...TIPOS_AVISO] as string[],
          soloSiDeTurno: !p?.horario_24_7,
        };
      }),
    };
  }

  private normalizar(datos: DatosCorreoExtra, creando: boolean) {
    const out: { correo?: string; etiqueta?: string | null; activo?: boolean; tipos?: TipoAviso[] } = {};
    if (creando || datos.correo !== undefined) {
      const correo = String(datos.correo ?? '').trim().toLowerCase();
      if (!correoValido(correo)) {
        throw new BadRequestException({ codigo: 'CORREO_INVALIDO', mensaje: 'Escribe un correo válido, por ejemplo nombre@dominio.com' });
      }
      out.correo = correo;
    }
    if (datos.etiqueta !== undefined) {
      const e = (datos.etiqueta ?? '').trim();
      if (e.length > 60) throw new BadRequestException({ codigo: 'ETIQUETA_LARGA', mensaje: 'El nombre puede tener hasta 60 letras' });
      out.etiqueta = e || null;
    }
    if (datos.activo !== undefined) out.activo = !!datos.activo;
    if (datos.tipos !== undefined || creando) {
      const crudos = datos.tipos ?? [];
      if (!Array.isArray(crudos) || crudos.some((t) => !esTipoAviso(t))) {
        throw new BadRequestException({ codigo: 'TIPO_INVALIDO', mensaje: 'Algún tipo de aviso no es válido' });
      }
      out.tipos = [...new Set(crudos)] as TipoAviso[];
    }
    return out;
  }

  async crear(datos: DatosCorreoExtra, actor?: Actor, ip?: string) {
    const d = this.normalizar(datos, true);
    if ((await this.prisma.correoAvisoExtra.count()) >= MAX_CORREOS_EXTRA) {
      throw new BadRequestException({ codigo: 'LIMITE_CORREOS', mensaje: `Puedes tener hasta ${MAX_CORREOS_EXTRA} correos extra. Quita alguno que ya no uses.` });
    }
    let creado;
    try {
      creado = await this.prisma.correoAvisoExtra.create({
        data: {
          correo: d.correo!,
          etiqueta: d.etiqueta ?? null,
          activo: d.activo ?? true,
          tipos: d.tipos ?? [],
          creado_por: actor?.partyId != null ? BigInt(actor.partyId) : null,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException({ codigo: 'CORREO_DUPLICADO', mensaje: 'Ese correo ya está en la lista' });
      }
      throw err;
    }
    await this.auditar('AGREGAR_CORREO_AVISO', creado, undefined, fila(creado), actor, ip);
    return fila(creado);
  }

  async actualizar(id: string, datos: DatosCorreoExtra, actor?: Actor, ip?: string) {
    const antes = await this.buscar(id);
    const d = this.normalizar(datos, false);
    let nuevo;
    try {
      nuevo = await this.prisma.correoAvisoExtra.update({ where: { id: antes.id }, data: { ...d, actualizado_en: new Date() } });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException({ codigo: 'CORREO_DUPLICADO', mensaje: 'Ese correo ya está en la lista' });
      }
      throw err;
    }
    await this.auditar('CAMBIAR_CORREO_AVISO', nuevo, fila(antes), fila(nuevo), actor, ip);
    return fila(nuevo);
  }

  async eliminar(id: string, actor?: Actor, ip?: string) {
    const antes = await this.buscar(id);
    await this.prisma.correoAvisoExtra.delete({ where: { id: antes.id } });
    await this.auditar('QUITAR_CORREO_AVISO', antes, fila(antes), undefined, actor, ip);
    return { ok: true };
  }

  /**
   * Correo de prueba a uno de la lista. Límite: 1 por minuto por correo y 10 al día en total.
   * Las marcas viven en aviso_marca (clave única: dos instancias a la vez no duplican).
   */
  async probar(id: string, actor?: Actor, ip?: string, ahora = new Date()) {
    const c = await this.buscar(id);
    const minuto = Math.floor(ahora.getTime() / PRUEBA_PAUSA_MS);
    const hoy = new Date(ahora.getTime() - 24 * 3600_000);
    const hechasHoy = await this.prisma.avisoMarca.count({ where: { tipo: 'PRUEBA_CORREO', creado_en: { gte: hoy } } });
    if (hechasHoy >= PRUEBAS_POR_DIA) {
      throw new HttpException({ codigo: 'LIMITE_PRUEBAS', mensaje: `Hoy ya se enviaron ${PRUEBAS_POR_DIA} correos de prueba. Intenta mañana.` }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const esperar = () =>
      new HttpException({ codigo: 'ESPERA_PRUEBA', mensaje: 'Espera un minuto antes de enviar otra prueba a este correo.' }, HttpStatus.TOO_MANY_REQUESTS);
    const reciente = await this.prisma.avisoMarca.findFirst({
      where: { tipo: 'PRUEBA_CORREO', referencia: String(c.id), creado_en: { gt: new Date(ahora.getTime() - PRUEBA_PAUSA_MS) } },
      select: { id: true },
    });
    if (reciente) throw esperar();
    try {
      // la clave por minuto hace atómico el límite entre instancias
      await this.prisma.avisoMarca.create({ data: { clave: `prueba:${c.id}:${minuto}`, tipo: 'PRUEBA_CORREO', referencia: String(c.id), creado_en: ahora } });
    } catch (err: any) {
      if (err?.code === 'P2002') throw esperar();
      throw err;
    }
    const configurado = !!this.config.get<string>('RESEND_API_KEY')?.trim();
    const r = await this.correo.enviar({
      clave: `prueba-correo:${c.id}:${ahora.getTime()}`,
      origen: 'PRUEBA_AVISOS',
      asunto: 'Prueba de avisos de Caprichos',
      texto: 'Este es un correo de prueba. Si lo lees, este correo recibirá los avisos que tenga marcados en Configuración › Correos de aviso.',
      destinatarios: [c.correo],
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'correo',
      accion: 'PRUEBA_CORREO_AVISO',
      entidad: 'correo_aviso_extra',
      entidadId: c.id,
      partyId: actor?.partyId != null ? BigInt(actor.partyId) : undefined,
      despues: { correo: enmascararCorreo(c.correo), configurado },
      ip,
    });
    return { enviado: r.enviados > 0, simulado: r.simulados > 0, fallido: r.fallidos > 0, correoConfigurado: configurado };
  }

  /** Correos extra activos que reciben este tipo de aviso. */
  async extrasPara(tipo: TipoAviso): Promise<string[]> {
    const filas = await this.prisma.correoAvisoExtra.findMany({ where: { activo: true, tipos: { has: tipo } }, select: { correo: true } });
    return filas.map((f) => f.correo);
  }

  private async buscar(id: string) {
    let pk: bigint;
    try {
      pk = BigInt(id);
    } catch {
      throw new NotFoundException({ codigo: 'CORREO_NO_ENCONTRADO', mensaje: 'Ese correo ya no está en la lista' });
    }
    const c = await this.prisma.correoAvisoExtra.findUnique({ where: { id: pk } });
    if (!c) throw new NotFoundException({ codigo: 'CORREO_NO_ENCONTRADO', mensaje: 'Ese correo ya no está en la lista' });
    return c;
  }

  /** El correo va ENMASCARADO en la auditoría y en el log. */
  private async auditar(accion: string, c: any, antes: any, despues: any, actor?: Actor, ip?: string) {
    const mask = (f: any) => (f ? { ...f, correo: enmascararCorreo(f.correo) } : undefined);
    this.logger.log(JSON.stringify({ evento: 'correo_aviso_extra', accion, correo: enmascararCorreo(c.correo) }));
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'correo',
      accion,
      entidad: 'correo_aviso_extra',
      entidadId: c.id,
      partyId: actor?.partyId != null ? BigInt(actor.partyId) : undefined,
      antes: mask(antes),
      despues: mask(despues),
      ip,
    });
  }
}
