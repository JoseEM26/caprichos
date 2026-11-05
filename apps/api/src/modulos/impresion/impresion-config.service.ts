import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AREA_BEBIDAS, ReglasImpresion, RolImpresora } from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { agenteConectado, estadoPorRol, rolesDeclarados } from './estado-impresion';
import { ContextoRuteo, destinoDeTrabajo, tiposDeRoles } from './ruteo-impresion';
import { leerReglasImpresion, valoresDesdeCambio } from './reglas-impresion';

const ROLES_IMPRESORA: RolImpresora[] = ['ETIQUETERA', 'TICKETERA'];

/** Tipos que se muestran en «qué sale dónde». El ruteo solo decide stickers; pago y comanda van a Caja. */
const TIPOS_RUTEO = ['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA', 'TICKET_COMANDA_SALON', 'TICKET_PAGO'] as const;

/**
 * Configuración de impresión para la pantalla de etiqueteras: qué equipo atiende qué área, las reglas
 * de stickers y el ruteo ya resuelto. Sin ticketeras por área: la ticketera es una sola (Caja).
 */
@Injectable()
export class ImpresionConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async equiposActivos() {
    return this.prisma.deviceKey.findMany({
      where: { tipo: 'AGENTE', activo: true },
      orderBy: { id: 'asc' },
    });
  }

  private async contexto(equipos: Awaited<ReturnType<ImpresionConfigService['equiposActivos']>>): Promise<ContextoRuteo> {
    const bebidas = await this.prisma.areaCocina.findFirst({ where: { nombre: AREA_BEBIDAS, activo: true }, select: { id: true } });
    return {
      equipos: equipos
        .filter((e) => e.area_id !== null)
        .map((e) => ({ areaId: e.area_id as bigint, roles: rolesDeclarados(e) })),
      areaBebidasId: bebidas?.id ?? null,
    };
  }

  /** Mapa completo: áreas, equipos (con su estado por máquina), reglas, ruteo efectivo y cola por equipo. */
  async obtenerMapa() {
    const [areas, equipos, reglas] = await Promise.all([
      this.prisma.areaCocina.findMany({ where: { activo: true }, orderBy: { id: 'asc' }, select: { id: true, nombre: true } }),
      this.equiposActivos(),
      leerReglasImpresion(this.prisma),
    ]);
    const ctx = await this.contexto(equipos);
    const ahora = Date.now();

    const equiposDto = equipos.map((e) => {
      const estados = estadoPorRol(e, ahora);
      return {
        deviceKeyId: e.id.toString(),
        nombre: e.nombre,
        areaId: e.area_id ? e.area_id.toString() : null,
        roles: ROLES_IMPRESORA.map((rol) => ({ rol, estado: estados[rol].estado })),
        ultimoLatido: e.ultimo_latido ? e.ultimo_latido.toISOString() : null,
        conectado: agenteConectado(e.ultimo_latido, ahora),
      };
    });

    const equipoDe = (id: bigint | null, rol: RolImpresora) =>
      equipos.find((e) => e.area_id === id && rolesDeclarados(e).includes(rol)) ?? null;
    const nombreArea = (id: bigint | null) => areas.find((a) => a.id === id)?.nombre ?? null;

    /** Dónde sale cada tipo: el equipo de su área si lo tiene, o Caja (sin área). */
    const ruteoDe = (tipo: string, areaId: bigint | null) => {
      const destino = destinoDeTrabajo(tipo, areaId, ctx);
      const rol: RolImpresora = tipo === 'TICKET_PAGO' || tipo === 'TICKET_COMANDA_SALON' ? 'TICKETERA' : 'ETIQUETERA';
      const equipo = equipoDe(destino, rol);
      return {
        tipo,
        areaId: areaId ? areaId.toString() : null,
        destinoAreaId: destino ? destino.toString() : null,
        destinoEquipoId: equipo ? equipo.id.toString() : null,
        destinoNombre: destino !== null ? (equipo?.nombre ?? nombreArea(destino) ?? 'Área') : 'Caja',
        activo: activoDelTipo(tipo, reglas),
      };
    };
    const ruteo = TIPOS_RUTEO.flatMap((tipo) => {
      if (tipo === 'ETIQUETA_AREA') return areas.map((a) => ruteoDe(tipo, a.id));
      if (tipo === 'ETIQUETA_BEBIDA') return [ruteoDe(tipo, areas.find((a) => a.nombre === AREA_BEBIDAS)?.id ?? null)];
      return [ruteoDe(tipo, null)];
    });

    const colaPendientePorEquipo = await Promise.all(
      equipos.map(async (e) => {
        const tipos = tiposDeRoles(rolesDeclarados(e));
        const pendientes = tipos.length === 0
          ? 0
          : await this.prisma.printJob.count({
              where: { estado: 'PENDIENTE', destino_area_id: e.area_id, tipo: { in: tipos } },
            });
        return { deviceKeyId: e.id.toString(), pendientes };
      }),
    );

    return {
      areas: areas.map((a) => ({ id: a.id.toString(), nombre: a.nombre })),
      equipos: equiposDto,
      reglas: reglasDto(reglas),
      ruteo,
      colaPendientePorEquipo,
    };
  }

  /**
   * Asigna un área a un equipo de impresión (null = Caja). No deja de haber Caja: el equipo sin área es Caja.
   * Si ya hay otro equipo en esa área con la misma máquina, se permite y se avisa (se reparten los trabajos).
   */
  async asignarArea(idInput: string | number, areaId: string | null, usuario?: UsuarioAutenticado, ip?: string) {
    let id: bigint;
    try {
      id = BigInt(idInput);
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Identificador no válido' });
    }
    const equipo = await this.prisma.deviceKey.findUnique({ where: { id } });
    if (!equipo || equipo.tipo !== 'AGENTE' || !equipo.activo) {
      throw new NotFoundException({ codigo: 'EQUIPO_NO_ENCONTRADO', mensaje: 'Equipo de impresión no encontrado' });
    }
    let nueva: bigint | null = null;
    if (areaId !== null && areaId !== undefined && areaId !== '') {
      if (!/^\d+$/.test(String(areaId))) {
        throw new BadRequestException({ codigo: 'AREA_INVALIDA', mensaje: 'Área no válida' });
      }
      nueva = BigInt(areaId);
      const area = await this.prisma.areaCocina.findUnique({ where: { id: nueva } });
      if (!area || !area.activo) {
        throw new BadRequestException({ codigo: 'AREA_INVALIDA', mensaje: 'El área no existe o está inactiva' });
      }
    }

    await this.prisma.deviceKey.update({ where: { id }, data: { area_id: nueva } });

    const avisos: string[] = [];
    if (nueva !== null) {
      const otros = (await this.equiposActivos()).filter((o) => o.id !== id && o.area_id === nueva);
      const rolesYo = rolesDeclarados(equipo);
      const choca = otros.some((o) => rolesDeclarados(o).some((r) => rolesYo.includes(r)));
      if (choca) avisos.push('Ya hay otro equipo en esta área con la misma máquina: los trabajos se reparten entre ambos.');
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'impresion',
      accion: 'ASIGNAR_AREA_EQUIPO',
      entidad: 'device_key',
      entidadId: id,
      partyId: usuario?.partyId,
      antes: { areaId: equipo.area_id ? equipo.area_id.toString() : null },
      despues: { areaId: nueva ? nueva.toString() : null },
      ip,
    });
    return { ok: true, areaId: nueva ? nueva.toString() : null, avisos };
  }

  /** Cambia las reglas de stickers y comanda (solo las claves que lleguen). */
  async guardarReglas(cambio: Partial<ReglasImpresion>, usuario?: UsuarioAutenticado, ip?: string) {
    const antes = await leerReglasImpresion(this.prisma);
    const valores = valoresDesdeCambio(cambio);
    for (const [clave, valor] of Object.entries(valores)) {
      await this.prisma.parametro.upsert({
        where: { clave },
        create: { clave, valor: valor as any },
        update: { valor: valor as any },
      });
    }
    const despues = await leerReglasImpresion(this.prisma);
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'impresion',
      accion: 'CAMBIAR_REGLAS_IMPRESION',
      entidad: 'parametro',
      partyId: usuario?.partyId,
      antes: reglasDto(antes),
      despues: reglasDto(despues),
      ip,
    });
    return { ok: true, reglas: reglasDto(despues) };
  }
}

/** Reglas en el formato de la API (camelCase, sin la clave técnica). */
export function reglasDto(r: ReglasImpresion) {
  return {
    generalModalidades: r.generalModalidades,
    bebidaActivo: r.bebidaActivo,
    areaActivo: r.areaActivo,
    comandaSalonActivo: r.comandaSalonActivo,
  };
}

function activoDelTipo(tipo: string, r: ReglasImpresion): boolean {
  switch (tipo) {
    case 'ETIQUETA_GENERAL': return r.generalModalidades.length > 0;
    case 'ETIQUETA_AREA': return r.areaActivo;
    case 'ETIQUETA_BEBIDA': return r.bebidaActivo;
    case 'TICKET_COMANDA_SALON': return r.comandaSalonActivo;
    default: return true;
  }
}
