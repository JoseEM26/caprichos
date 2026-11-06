import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AREA_BEBIDAS, ReglasImpresion, RolImpresora, esAreaBebidas, rolDeTrabajo } from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { agenteConectado, estadoPorRol, rolesDeclarados } from './estado-impresion';
import { ContextoRuteo, destinoDeTrabajo, tiposDeRoles } from './ruteo-impresion';
import { CLAVES_REGLAS, leerReglasImpresion, valoresDesdeCambio } from './reglas-impresion';

const ROLES_IMPRESORA: RolImpresora[] = ['ETIQUETERA', 'TICKETERA'];

/** Equipo de impresión tal como lo lee el servicio (solo los campos que se usan). */
interface EquipoAgente {
  id: bigint;
  nombre: string;
  area_id: bigint | null;
  activo: boolean;
  tipo: string;
  latido_impresora?: string | null;
  latido_detalle?: string | null;
}

/** Tipos que se muestran en «qué sale dónde». El ruteo decide stickers y comanda por área; pago y comanda de salón van a Caja. */
const TIPOS_RUTEO = [
  'ETIQUETA_GENERAL',
  'ETIQUETA_AREA',
  'ETIQUETA_BEBIDA',
  'TICKET_COMANDA_SALON',
  'TICKET_COMANDA_AREA',
  'TICKET_PAGO',
] as const;

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
        /** Máquinas que declara el programa (lo mismo que usa el ruteo), aunque el programa esté caído. */
        maquinas: ROLES_IMPRESORA.filter((rol) => rolesDeclarados(e).includes(rol)),
        roles: ROLES_IMPRESORA.map((rol) => ({ rol, estado: estados[rol].estado })),
        ultimoLatido: e.ultimo_latido ? e.ultimo_latido.toISOString() : null,
        conectado: agenteConectado(e.ultimo_latido, ahora),
      };
    });

    const equipoDe = (id: bigint | null, rol: RolImpresora) =>
      equipos.find((e) => e.area_id === id && rolesDeclarados(e).includes(rol)) ?? null;
    const nombreArea = (id: bigint | null) => areas.find((a) => a.id === id)?.nombre ?? null;

    /** Por área, qué equipo declara cada máquina (la etiquetera y la ticketera de esa área). */
    const areasDto = areas.map((a) => ({
      id: a.id.toString(),
      nombre: a.nombre,
      equiposPorRol: {
        ETIQUETERA: equipoDe(a.id, 'ETIQUETERA')?.id.toString() ?? null,
        TICKETERA: equipoDe(a.id, 'TICKETERA')?.id.toString() ?? null,
      },
    }));

    /** Dónde sale cada tipo: el equipo de su área si lo tiene, o Caja (sin área). */
    const ruteoDe = (tipo: string, areaId: bigint | null) => {
      const destino = destinoDeTrabajo(tipo, areaId, ctx);
      const equipo = equipoDe(destino, rolDeTrabajo(tipo));
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
      // Bebidas no tiene sticker por área (sí comanda por área y sticker por vaso)
      if (tipo === 'ETIQUETA_AREA') return areas.filter((a) => !esAreaBebidas(a.nombre)).map((a) => ruteoDe(tipo, a.id));
      if (tipo === 'TICKET_COMANDA_AREA') return areas.map((a) => ruteoDe(tipo, a.id));
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
      duplicados: this.gruposDuplicados(equipos, areas),
      areas: areasDto,
      equipos: equiposDto,
      reglas: reglasDto(reglas),
      ruteo,
      colaPendientePorEquipo,
    };
  }

  /**
   * Equipos activos que chocan con un equipo que quiere estar en `area` con esas máquinas.
   * Caja (area null): cualquier otro equipo de Caja. Área: los que declaran una misma máquina.
   */
  private conflictosEn(area: bigint | null, roles: RolImpresora[], excluirId: bigint, todos: EquipoAgente[]): EquipoAgente[] {
    return todos.filter(
      (o) =>
        o.id !== excluirId &&
        o.area_id === area &&
        (area === null || rolesDeclarados(o).some((r) => roles.includes(r))),
    );
  }

  /** Un solo equipo por área y tipo de máquina, y uno en Caja: lo que el mapa debe avisar si no se cumple. */
  private gruposDuplicados(equipos: EquipoAgente[], areas: Array<{ id: bigint; nombre: string }>) {
    const grupos: Array<{ areaId: string | null; nombre: string; equipos: Array<{ deviceKeyId: string; nombre: string }> }> = [];
    const areaIds: Array<bigint | null> = [null, ...areas.map((a) => a.id)];
    for (const area of areaIds) {
      const delArea = equipos.filter((e) => e.area_id === area);
      const enChoque = delArea.filter((e) => {
        const otros = this.conflictosEn(area, rolesDeclarados(e), e.id, delArea);
        return otros.length > 0;
      });
      if (enChoque.length < 2) continue;
      grupos.push({
        areaId: area === null ? null : area.toString(),
        nombre: area === null ? 'Caja' : areas.find((a) => a.id === area)?.nombre ?? 'Área',
        equipos: enChoque.map((e) => ({ deviceKeyId: e.id.toString(), nombre: e.nombre })),
      });
    }
    return grupos;
  }

  /** Busca un equipo de impresión activo (AGENTE) por id; 404 si no. */
  private async equipoActivo(idInput: string | number, codigo = 'EQUIPO_NO_ENCONTRADO'): Promise<EquipoAgente> {
    let id: bigint;
    try {
      id = BigInt(idInput);
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Identificador no válido' });
    }
    const equipo = await this.prisma.deviceKey.findUnique({ where: { id } });
    if (!equipo || equipo.tipo !== 'AGENTE' || !equipo.activo) {
      throw new NotFoundException({ codigo, mensaje: 'Equipo de impresión no encontrado' });
    }
    return equipo;
  }

  /**
   * Desactiva los equipos que chocan y asigna el área al equipo nuevo, en una sola transacción.
   * Nada se borra: el equipo desactivado se puede volver a vincular.
   */
  private async reemplazarEnTransaccion(
    equipo: EquipoAgente,
    destino: bigint | null,
    desactivar: EquipoAgente[],
    usuario: UsuarioAutenticado | undefined,
    ip: string | undefined,
    accion: 'REEMPLAZAR_EQUIPO',
  ) {
    const ids = desactivar.map((d) => d.id);
    // Caja no puede quedarse sin equipo: si se desactiva uno de Caja, el nuevo tiene que quedar en Caja.
    if (destino !== null && desactivar.some((d) => d.area_id === null)) {
      throw new ConflictException({ codigo: 'CAJA_SIN_EQUIPO', mensaje: 'No se puede desactivar el único equipo de Caja sin dejar otro en Caja' });
    }
    await this.prisma.$transaction(async (tx) => {
      if (ids.length > 0) await tx.deviceKey.updateMany({ where: { id: { in: ids } }, data: { activo: false } });
      await tx.deviceKey.update({ where: { id: equipo.id }, data: { area_id: destino } });
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'impresion',
      accion,
      entidad: 'device_key',
      entidadId: equipo.id,
      partyId: usuario?.partyId,
      antes: { areaId: equipo.area_id ? equipo.area_id.toString() : null, anterioresIds: ids.map(String) },
      despues: { equipoNuevoId: equipo.id.toString(), areaId: destino ? destino.toString() : null, desactivadosIds: ids.map(String) },
      ip,
    });
    return ids.map(String);
  }

  /**
   * Asigna un área a un equipo de impresión (null = Caja). Un solo equipo por área y máquina, y uno en Caja:
   * si el destino ya tiene un equipo con esa máquina, responde 409 AREA_OCUPADA con quién la ocupa, salvo
   * `reemplazar`: entonces el equipo anterior se desactiva y este queda en el área.
   */
  async asignarArea(
    idInput: string | number,
    areaId: string | null,
    usuario?: UsuarioAutenticado,
    ip?: string,
    reemplazar = false,
  ) {
    const equipo = await this.equipoActivo(idInput);
    const id = equipo.id;
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

    if (equipo.area_id === nueva) return { ok: true, areaId: nueva ? nueva.toString() : null, avisos: [] as string[], reemplazados: [] as string[] };

    const roles = rolesDeclarados(equipo);
    const choques = this.conflictosEn(nueva, roles, id, await this.equiposActivos());
    if (choques.length > 0 && !reemplazar) {
      const otro = choques[0];
      const rol = nueva === null ? 'CAJA' : (rolesDeclarados(otro).find((r) => roles.includes(r)) ?? 'ETIQUETERA');
      throw new ConflictException({
        codigo: 'AREA_OCUPADA',
        mensaje: nueva === null
          ? 'Caja ya tiene un equipo. Puedes reemplazarlo.'
          : 'Esa área ya tiene un equipo para esa máquina. Puedes reemplazarlo.',
        rol,
        ocupadoPor: { deviceKeyId: otro.id.toString(), nombre: otro.nombre },
      });
    }

    if (choques.length > 0) {
      const reemplazados = await this.reemplazarEnTransaccion(equipo, nueva, choques, usuario, ip, 'REEMPLAZAR_EQUIPO');
      return { ok: true, areaId: nueva ? nueva.toString() : null, avisos: [] as string[], reemplazados };
    }

    await this.prisma.deviceKey.update({ where: { id }, data: { area_id: nueva } });
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
    return { ok: true, areaId: nueva ? nueva.toString() : null, avisos: [] as string[], reemplazados: [] as string[] };
  }

  /**
   * Atajo de reemplazo: el equipo `idInput` (el viejo) cede su área al equipo `porEquipoId` (el nuevo);
   * el viejo se desactiva. Los trabajos pendientes siguen su destino (el área o Caja) y los recoge el nuevo.
   */
  async reemplazarEquipo(idInput: string | number, porEquipoId: string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const viejo = await this.equipoActivo(idInput);
    const nuevo = await this.equipoActivo(porEquipoId);
    if (viejo.id === nuevo.id) {
      throw new BadRequestException({ codigo: 'MISMO_EQUIPO', mensaje: 'Elige otro equipo para reemplazarlo' });
    }
    const destino = viejo.area_id;
    const choques = this.conflictosEn(destino, rolesDeclarados(nuevo), nuevo.id, await this.equiposActivos());
    const desactivar = [viejo, ...choques.filter((c) => c.id !== viejo.id)];
    // El nuevo hereda el área del viejo: se desactivan también los que chocaban con él allí.
    const reemplazados = await this.reemplazarEnTransaccion(nuevo, destino, desactivar, usuario, ip, 'REEMPLAZAR_EQUIPO');
    return { ok: true, areaId: destino ? destino.toString() : null, reemplazados, porEquipoId: nuevo.id.toString() };
  }

  /** Deja un solo equipo en su área (o en Caja): desactiva los demás que chocan con él. */
  async quedarseCon(idInput: string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const equipo = await this.equipoActivo(idInput);
    const choques = this.conflictosEn(equipo.area_id, rolesDeclarados(equipo), equipo.id, await this.equiposActivos());
    if (choques.length === 0) return { ok: true, desactivados: [] as string[] };
    const desactivados = await this.reemplazarEnTransaccion(equipo, equipo.area_id, choques, usuario, ip, 'REEMPLAZAR_EQUIPO');
    return { ok: true, desactivados };
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

  /**
   * Vuelve las reglas a lo recomendado: borra sus filas de `parametro`, así `leerReglasImpresion` cae en
   * REGLAS_IMPRESION_DEFECTO del código (y cualquier cambio futuro de defecto aplica solo). Idempotente.
   */
  async restablecerReglas(usuario?: UsuarioAutenticado, ip?: string) {
    const antes = await leerReglasImpresion(this.prisma);
    await this.prisma.parametro.deleteMany({ where: { clave: { in: [...CLAVES_REGLAS] } } });
    const despues = await leerReglasImpresion(this.prisma);
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'impresion',
      accion: 'RESTABLECER_REGLAS_IMPRESION',
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
    comandaAreaActivo: r.comandaAreaActivo,
  };
}

function activoDelTipo(tipo: string, r: ReglasImpresion): boolean {
  switch (tipo) {
    case 'ETIQUETA_GENERAL': return r.generalModalidades.length > 0;
    case 'ETIQUETA_AREA': return r.areaActivo;
    case 'ETIQUETA_BEBIDA': return r.bebidaActivo;
    case 'TICKET_COMANDA_SALON': return r.comandaSalonActivo;
    case 'TICKET_COMANDA_AREA': return r.comandaAreaActivo;
    default: return true;
  }
}
