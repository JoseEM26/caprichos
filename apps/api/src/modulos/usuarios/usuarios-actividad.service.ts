import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ROLES } from '../acceso/permisos';

/** Tipos de la línea de tiempo (el filtro de la pantalla). */
export const TIPOS_ACTIVIDAD = [
  { id: 'datos', nombre: 'Datos' },
  { id: 'roles', nombre: 'Roles' },
  { id: 'horario', nombre: 'Horario y almuerzo' },
  { id: 'estado', nombre: 'Activación' },
  { id: 'clave', nombre: 'Contraseña' },
  { id: 'areas', nombre: 'Áreas de cocina' },
  { id: 'asistencia', nombre: 'Asistencia' },
  { id: 'acciones', nombre: 'Lo que hizo' },
] as const;

/** Tope por fuente: la línea de tiempo se arma en memoria. ponytail: paginar en SQL si una persona pasa de ~1000 eventos. */
const TOPE_FUENTE = 1000;

/** Acciones de auditoría que ya quedan en user_account_rol_historial: no se repiten en la línea de tiempo. */
const ACCIONES_EN_HISTORIAL_ROLES = ['OTORGAR_ROL', 'OTORGAR_ROL_TEMPORAL', 'QUITAR_ROL', 'ROL_VENCIDO'];

const TIPO_POR_ACCION: Record<string, string> = {
  EDITAR: 'datos',
  CREAR: 'datos',
  IMPORTAR_PERSONAL: 'datos',
  CAMBIAR_FOTO: 'datos',
  QUITAR_FOTO: 'datos',
  VER_DNI: 'datos',
  CAMBIAR_ROLES: 'roles',
  EDITAR_HORARIO: 'horario',
  PERIODO_EDITAR: 'horario',
  DESACTIVAR: 'estado',
  REACTIVAR: 'estado',
  CAMBIAR_CLAVE_ADMIN: 'clave',
  RESTABLECER_CLAVE: 'clave',
  CAMBIAR_AREAS_COCINA: 'areas',
  CORREGIR_MARCA: 'asistencia',
  REINICIAR_DISPOSITIVO: 'asistencia',
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «7 nov 18:00» en hora de Lima. */
export function fechaCorta(fecha: Date | string): string {
  const d = new Date(fecha);
  const p = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${Number(v('day'))} ${MESES[Number(v('month')) - 1]} ${v('hour')}:${v('minute')}`;
}

const nombreRol = (codigo: string) => ROLES.find((r) => r.codigo === codigo)?.nombre ?? codigo;
const humano = (accion: string) => accion.toLowerCase().replace(/_/g, ' ');
const listaRoles = (roles: unknown) => (Array.isArray(roles) && roles.length ? roles.map((r) => nombreRol(String(r))).join(', ') : 'ninguno');

interface Evento {
  id: string;
  en: Date;
  tipo: string;
  texto: string;
  quien: string | null;
  motivo: string | null;
}

@Injectable()
export class UsuariosActividadService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Línea de tiempo de una persona: cambios de su cuenta, roles, horario, asistencia y lo que ella hizo.
   * Solo ADMIN ve el historial de otros usuarios.
   */
  async listar(
    id: bigint | string | number,
    filtros: { tipo?: string; desde?: string; hasta?: string; pagina?: number; limite?: number },
    actor?: UsuarioAutenticado,
  ) {
    if (actor?.rol !== 'ADMIN') {
      throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo un administrador ve la actividad de otros usuarios' });
    }
    const cuenta = await this.prisma.userAccount.findUnique({ where: { id: BigInt(id) }, select: { id: true, party_id: true } });
    if (!cuenta) {
      throw new NotFoundException({ codigo: 'USUARIO_NO_ENCONTRADO', mensaje: 'Usuario no encontrado' });
    }
    const party = cuenta.party_id;

    const [periodos, correcciones] = await Promise.all([
      this.prisma.partyRole.findMany({ where: { party_id: party, rol: 'TRABAJADOR' }, select: { id: true } }),
      this.prisma.asistenciaMarca.findMany({ where: { party_id: party, origen: 'CORRECCION' }, select: { id: true }, take: TOPE_FUENTE }),
    ]);
    const [historial, auditados, hechos] = await Promise.all([
      this.prisma.userAccountRolHistorial.findMany({
        where: { user_account_id: cuenta.id },
        orderBy: { en: 'desc' },
        take: TOPE_FUENTE,
      }),
      this.prisma.auditoria.findMany({
        where: {
          OR: [
            { entidad: 'user_account', entidad_id: cuenta.id },
            { entidad: 'person', entidad_id: party },
            { entidad: 'party', entidad_id: party },
            { entidad: 'party_role', entidad_id: { in: periodos.map((p) => p.id) } },
            { entidad: 'asistencia_marca', entidad_id: { in: correcciones.map((c) => c.id) } },
          ],
          accion: { notIn: ACCIONES_EN_HISTORIAL_ROLES },
        },
        orderBy: { en: 'desc' },
        take: TOPE_FUENTE,
      }),
      // Lo que ella hizo: cambios que disparó y las aprobaciones que dio como supervisor
      this.prisma.auditoria.findMany({
        where: {
          OR: [
            { party_id: party, categoria: { in: ['CAMBIO', 'LECTURA_SENSIBLE'] } },
            { despues: { path: ['aprobadorPartyId'], equals: party.toString() } },
          ],
        },
        orderBy: { en: 'desc' },
        take: TOPE_FUENTE,
      }),
    ]);

    const idsAuditoria = new Set(auditados.map((a) => a.id.toString()));
    const todas = [...auditados, ...hechos.filter((h) => !idsAuditoria.has(h.id.toString()))];

    const partyIds = new Set<string>([party.toString()]);
    todas.forEach((a) => {
      if (a.party_id) partyIds.add(a.party_id.toString());
      const aprobador = (a.despues as any)?.aprobadorPartyId;
      if (aprobador) partyIds.add(String(aprobador));
    });
    historial.forEach((h) => h.quien_party_id && partyIds.add(h.quien_party_id.toString()));
    const personas = await this.prisma.person.findMany({
      where: { party_id: { in: [...partyIds].map((p) => BigInt(p)) } },
      select: { party_id: true, nombres: true, apellidos: true },
    });
    const nombres = new Map(personas.map((p) => [p.party_id.toString(), `${p.nombres} ${p.apellidos ?? ''}`.trim()]));
    const nombreDe = (pid: bigint | null | undefined) => (pid ? nombres.get(pid.toString()) ?? `Usuario ${pid}` : null);
    const nombreAfectado = nombres.get(party.toString()) ?? 'el usuario';

    const areaIds = new Set<string>();
    todas.forEach((a) => {
      if (a.accion === 'CAMBIAR_AREAS_COCINA') {
        for (const x of [...(((a.antes as any)?.areaIds ?? []) as string[]), ...(((a.despues as any)?.areaIds ?? []) as string[])]) areaIds.add(String(x));
      }
    });
    const areas = areaIds.size
      ? await this.prisma.areaCocina.findMany({ where: { id: { in: [...areaIds].map((x) => BigInt(x)) } }, select: { id: true, nombre: true } })
      : [];
    const nombreArea = new Map(areas.map((a) => [a.id.toString(), a.nombre]));
    const textoAreas = (ids: unknown) => {
      const lista = (Array.isArray(ids) ? ids : []).map((x) => nombreArea.get(String(x)) ?? String(x));
      return lista.length ? lista.join(', ') : 'sin áreas (ve todas)';
    };

    const eventos: Evento[] = [];

    for (const h of historial) {
      const quien = nombreDe(h.quien_party_id) ?? 'El sistema';
      const rol = nombreRol(h.rol);
      if (h.accion === 'OTORGADO') {
        const hasta = h.hasta ? ` hasta el ${fechaCorta(h.hasta)}` : ' (sin fecha de fin)';
        eventos.push({
          id: `h-${h.id}`,
          en: h.desde ?? h.en,
          tipo: 'roles',
          texto: `${quien} le dio el rol ${rol} a ${nombreAfectado}${hasta}`,
          quien,
          motivo: h.motivo,
        });
      } else if (h.accion === 'RETIRADO') {
        eventos.push({
          id: `h-${h.id}`,
          en: h.hasta ?? h.en,
          tipo: 'roles',
          texto: `${quien} le quitó el rol ${rol} a ${nombreAfectado}`,
          quien,
          motivo: h.motivo,
        });
      } else {
        eventos.push({
          id: `h-${h.id}`,
          en: h.hasta ?? h.en,
          tipo: 'roles',
          texto: `El rol ${rol} de ${nombreAfectado} venció${h.hasta ? ` el ${fechaCorta(h.hasta)}` : ''}`,
          quien: null,
          motivo: h.motivo,
        });
      }
    }

    for (const a of todas) {
      const quien = nombreDe(a.party_id) ?? (a.categoria === 'CAMBIO' && !a.party_id ? 'El sistema' : null);
      const esPropia = a.party_id?.toString() === party.toString();
      const d: any = a.despues ?? {};
      const an: any = a.antes ?? {};
      const actor = quien ?? 'Alguien';
      let tipo = TIPO_POR_ACCION[a.accion] ?? 'acciones';
      let texto: string;

      switch (a.accion) {
        case 'EDITAR': {
          const campos: string[] = [];
          if (an.nombres !== d.nombres || an.apellidos !== d.apellidos) campos.push('nombre');
          if (d.dniCambiado) campos.push('documento');
          if (d.correoCambiado) campos.push('correo');
          if (an.avisosCorreo !== d.avisosCorreo) campos.push('avisos por correo');
          if (an.horario24_7 !== d.horario24_7) campos.push('horario 24/7');
          texto = `${actor} editó ${esPropia ? 'sus datos' : `los datos de ${nombreAfectado}`}${campos.length ? ` (${campos.join(', ')})` : ''}`;
          break;
        }
        case 'CREAR':
          texto = `${actor} creó la cuenta de ${nombreAfectado}`;
          break;
        case 'IMPORTAR_PERSONAL':
          texto = `${actor} importó a ${nombreAfectado} desde el Excel del personal`;
          break;
        case 'CAMBIAR_ROLES':
          texto = `${actor} cambió los roles de ${nombreAfectado}: ${listaRoles(an.roles)} → ${listaRoles(d.roles)}`;
          break;
        case 'EDITAR_HORARIO':
          texto = `${actor} cambió el horario de trabajo y almuerzo de ${nombreAfectado}`;
          break;
        case 'PERIODO_EDITAR':
          texto = `${actor} corrigió las fechas de un periodo del historial laboral de ${nombreAfectado}`;
          break;
        case 'DESACTIVAR':
          texto = `${actor} desactivó a ${nombreAfectado}`;
          break;
        case 'REACTIVAR':
          texto = `${actor} reactivó a ${nombreAfectado}`;
          break;
        case 'CAMBIAR_CLAVE_ADMIN':
          texto = `${actor} cambió la contraseña de ${nombreAfectado}`;
          break;
        case 'RESTABLECER_CLAVE':
          texto = `${actor} restableció la contraseña de ${nombreAfectado} (debe cambiarla al entrar)`;
          break;
        case 'CAMBIAR_FOTO':
          texto = `${actor} cambió la foto de ${nombreAfectado}`;
          break;
        case 'QUITAR_FOTO':
          texto = `${actor} quitó la foto de ${nombreAfectado}`;
          break;
        case 'CAMBIAR_AREAS_COCINA':
          texto = `${actor} cambió las áreas de cocina de ${nombreAfectado}: ${textoAreas(d.areaIds)}`;
          break;
        case 'VER_DNI':
          texto = `${actor} vio el DNI de ${nombreAfectado}`;
          break;
        case 'CORREGIR_MARCA':
          texto = `${actor} corrigió una marca de asistencia de ${nombreAfectado}${d.tipo ? ` (${String(d.tipo).toLowerCase().replace(/_/g, ' ')})` : ''}`;
          break;
        case 'REINICIAR_DISPOSITIVO':
          texto = `${actor} reinició el celular vinculado a la asistencia de ${nombreAfectado}`;
          break;
        case 'AUTORIZACION_SUPERVISOR': {
          tipo = 'acciones';
          const aprobador = String((a.despues as any)?.aprobadorPartyId ?? '');
          if (aprobador === party.toString()) {
            texto = `${nombreAfectado} aprobó con su código de supervisor una acción`;
          } else {
            texto = `${actor} recibió una aprobación de supervisor${aprobador ? ` de ${nombres.get(aprobador) ?? 'otra persona'}` : ''}`;
          }
          break;
        }
        default:
          texto = esPropia
            ? `Realizó «${humano(a.accion)}» en ${a.modulo}`
            : `${actor} realizó «${humano(a.accion)}» en ${a.modulo}`;
      }

      eventos.push({
        id: `a-${a.id}`,
        en: a.en,
        tipo,
        texto,
        quien,
        motivo: a.motivo ?? null,
      });
    }

    const tipo = filtros.tipo && TIPOS_ACTIVIDAD.some((t) => t.id === filtros.tipo) ? filtros.tipo : null;
    const desde = filtros.desde ? new Date(filtros.desde) : null;
    const hasta = filtros.hasta ? new Date(filtros.hasta) : null;
    const filtrados = eventos
      .filter((e) => !tipo || e.tipo === tipo)
      .filter((e) => !desde || e.en >= desde)
      .filter((e) => !hasta || e.en <= hasta)
      .sort((x, y) => y.en.getTime() - x.en.getTime());

    const limite = Math.min(100, Math.max(1, Number(filtros.limite) || 20));
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const inicio = (pagina - 1) * limite;

    return {
      total: filtrados.length,
      pagina,
      limite,
      paginas: Math.max(1, Math.ceil(filtrados.length / limite)),
      tipos: TIPOS_ACTIVIDAD,
      datos: filtrados.slice(inicio, inicio + limite).map((e) => ({
        id: e.id,
        en: e.en,
        enTexto: fechaCorta(e.en),
        tipo: e.tipo,
        texto: e.texto,
        quien: e.quien,
        motivo: e.motivo,
      })),
    };
  }
}
