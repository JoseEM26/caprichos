import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import {
  AREA_BEBIDAS,
  ConfigEquipoImpresion,
  aplicarOrientacion,
  tamanoPcValido,
} from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { agenteConectado, claveSeleccion, leerSeleccion, rolesDeclarados } from './estado-impresion';
import {
  CONFIG_EQUIPO_NUEVO,
  CONTEXTO_RUTEO_VACIO,
  ContextoRuteo,
  areasParaRuteo,
  destinoDeTrabajo,
  equipoAcepta,
} from './ruteo-impresion';
import { aplicarCambio, configAFila, configDesdeComportamientoActual, configDesdeGeneral, filaAConfig } from './equipo-config';
import { leerReglasImpresion } from './reglas-impresion';
import { FilaEquipo, IdentidadEquipo, clasificarEquipos, claveHost, reconocerEquipo } from './identidad-equipo';
import { construirEtiquetaBebidaPrueba, construirEtiquetaPrueba } from './constructor-etiquetas';

const ESPERA_PRUEBA_MS = 10 * 1000;
const claveIgual = (a: FilaEquipo, b: FilaEquipo) => claveHost(a.latido_hostname, a.latido_sistema) === claveHost(b.latido_hostname, b.latido_sistema);

/**
 * Configuración de impresión POR computadora: qué imprime cada PC (cada PC manda), su ruteo en vivo y los cambios
 * desde el panel. Una PC nueva llega apagada y sin configurar; las que ya imprimían se convierten solas (una vez) a su
 * configuración equivalente para que nada deje de salir.
 */
@Injectable()
export class EquipoConfigService {
  private readonly logger = new Logger(EquipoConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditoria?: AuditoriaService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  /** PC activas con su configuración (creada al vuelo: legado = lo que hacía hoy; nueva = apagada). Sin datos: todo en espera. */
  async contexto(): Promise<ContextoRuteo> {
    try {
      const [equipos, areas] = await Promise.all([
        this.prisma.deviceKey.findMany({
          where: { tipo: 'AGENTE', activo: true },
          orderBy: { id: 'asc' },
          include: { configImpresion: true },
        }),
        this.prisma.areaCocina.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { id: 'asc' } }),
      ]);
      const areaBebidasId = (areas ?? []).find((a) => a.nombre === AREA_BEBIDAS)?.id ?? null;
      const lista = equipos ?? [];
      const faltan = lista.filter((e) => !e.configImpresion);
      const reglas = faltan.length ? await leerReglasImpresion(this.prisma) : null;
      const legado = lista.map((e) => ({ id: e.id, areaId: e.area_id, roles: rolesDeclarados(e) }));
      const ahora = Date.now();
      const out = [];
      for (const e of lista) {
        let config: ConfigEquipoImpresion;
        if (e.configImpresion) {
          config = filaAConfig(e.configImpresion);
        } else {
          config = e.ultimo_latido
            ? configDesdeComportamientoActual(legado.find((l) => l.id === e.id)!, legado, areas ?? [], reglas!, areaBebidasId)
            : { ...CONFIG_EQUIPO_NUEVO };
          await this.prisma.equipoImpresionConfig
            .create({ data: { device_key_id: e.id, ...configAFila(config) } })
            .catch((err: any) => this.logger.debug(`Config ya creada para ${e.id}: ${err.message}`));
        }
        out.push({ id: e.id, areaId: e.area_id, conectado: agenteConectado(e.ultimo_latido, ahora), config });
      }
      return { equipos: out, areaBebidasId };
    } catch (err: any) {
      this.logger.warn(`No se pudo leer la configuración por PC, los trabajos esperan en cola: ${err.message}`);
      return CONTEXTO_RUTEO_VACIO;
    }
  }

  /** Configuración de una PC (la crea si falta). Una PC desconocida o inactiva queda como nueva: no imprime nada. */
  async configDe(deviceKeyId: bigint): Promise<ConfigEquipoImpresion> {
    try {
      const f = await this.prisma.equipoImpresionConfig.findUnique({ where: { device_key_id: deviceKeyId } });
      if (f) return filaAConfig(f);
    } catch {
      return { ...CONFIG_EQUIPO_NUEVO };
    }
    const ctx = await this.contexto();
    return ctx.equipos.find((e) => e.id === deviceKeyId)?.config ?? { ...CONFIG_EQUIPO_NUEVO };
  }

  private parseId(idInput: string | number): bigint {
    try {
      return BigInt(idInput);
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Identificador no válido' });
    }
  }

  private async equipo(idInput: string | number) {
    const id = this.parseId(idInput);
    const e = await this.prisma.deviceKey.findUnique({ where: { id } });
    if (!e || e.tipo !== 'AGENTE' || !e.activo) {
      throw new NotFoundException({ codigo: 'EQUIPO_NO_ENCONTRADO', mensaje: 'Esa computadora ya no está vinculada' });
    }
    return e;
  }

  private async areasActivas() {
    return this.prisma.areaCocina.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { id: 'asc' } });
  }

  /** Configuración de una PC con las áreas a elegir y lo que sugieren las reglas del local. */
  async obtener(idInput: string | number) {
    const e = await this.equipo(idInput);
    const [config, areas, reglas, sel] = await Promise.all([
      this.configDe(e.id),
      this.areasActivas(),
      leerReglasImpresion(this.prisma),
      this.prisma.parametro.findUnique({ where: { clave: claveSeleccion(e.id) } }).catch(() => null),
    ]);
    const bebidas = areas.find((a) => a.nombre === AREA_BEBIDAS)?.id ?? null;
    return {
      deviceKeyId: e.id.toString(),
      nombre: e.nombre,
      config,
      impresoras: leerSeleccion(sel?.valor),
      areas: areas.map((a) => ({ id: a.id.toString(), nombre: a.nombre })),
      general: configDesdeGeneral(reglas, areas, bebidas),
    };
  }

  /** Guarda un cambio (parcial) de la PC. Marca la PC como configurada, avisa en vivo y reubica lo que esperaba. */
  async guardar(idInput: string | number, cambio: Record<string, unknown>, usuario?: UsuarioAutenticado, ip?: string) {
    const e = await this.equipo(idInput);
    const [actual, areas] = await Promise.all([this.configDe(e.id), this.areasActivas()]);
    const nueva = aplicarCambio(actual, cambio, new Set(areas.map((a) => a.id.toString())));
    await this.persistir(e, actual, nueva, cambio, usuario, ip, 'CAMBIAR_CONFIG_EQUIPO_IMPRESION');
    return { ok: true, config: nueva };
  }

  /** «Usar lo general»: rellena la PC con las reglas del local (conserva pausa y tamaños propios). */
  async usarGeneral(idInput: string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const e = await this.equipo(idInput);
    const [actual, areas, reglas] = await Promise.all([this.configDe(e.id), this.areasActivas(), leerReglasImpresion(this.prisma)]);
    const base = configDesdeGeneral(reglas, areas, areas.find((a) => a.nombre === AREA_BEBIDAS)?.id ?? null);
    const nueva = { ...base, pausado: actual.pausado, tamanoGeneral: actual.tamanoGeneral, tamanoBebida: actual.tamanoBebida };
    await this.persistir(e, actual, nueva, {}, usuario, ip, 'USAR_LO_GENERAL_EQUIPO_IMPRESION');
    return { ok: true, config: nueva };
  }

  private async persistir(
    e: { id: bigint; nombre: string },
    actual: ConfigEquipoImpresion,
    nueva: ConfigEquipoImpresion,
    cambio: Record<string, unknown>,
    usuario: UsuarioAutenticado | undefined,
    ip: string | undefined,
    accion: string,
  ) {
    const fila = { ...configAFila(nueva), actualizado_en: new Date(), actualizado_por: usuario?.partyId ?? null };
    await this.prisma.equipoImpresionConfig.upsert({
      where: { device_key_id: e.id },
      create: { device_key_id: e.id, ...fila },
      update: fila,
    });
    let nombre = e.nombre;
    if (typeof cambio.nombre === 'string') {
      nombre = cambio.nombre.trim().slice(0, 60);
      if (!nombre) throw new BadRequestException({ codigo: 'NOMBRE_VACIO', mensaje: 'Ponle un nombre a la computadora' });
      if (nombre !== e.nombre) await this.prisma.deviceKey.update({ where: { id: e.id }, data: { nombre } });
    }
    const imp = cambio.impresoras as Record<string, unknown> | undefined;
    if (imp && typeof imp === 'object') {
      const previa = leerSeleccion((await this.prisma.parametro.findUnique({ where: { clave: claveSeleccion(e.id) } }).catch(() => null))?.valor);
      const valor: Record<string, string> = { ...previa };
      for (const rol of ['TICKETERA', 'ETIQUETERA'] as const) {
        if (imp[rol] === undefined) continue;
        if (imp[rol] === null || imp[rol] === '') delete valor[rol];
        else if (typeof imp[rol] === 'string' && (imp[rol] as string).length <= 300) valor[rol] = imp[rol] as string;
        else throw new BadRequestException({ codigo: 'IMPRESORA_INVALIDA', mensaje: 'Impresora no válida' });
      }
      await this.prisma.parametro.upsert({
        where: { clave: claveSeleccion(e.id) },
        create: { clave: claveSeleccion(e.id), valor: valor as any },
        update: { valor: valor as any },
      });
    }
    await this.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'impresion',
      accion,
      entidad: 'equipo_impresion_config',
      entidadId: e.id,
      partyId: usuario?.partyId,
      antes: { nombre: e.nombre, ...actual },
      despues: { nombre, ...nueva, ...(imp ? { impresoras: imp } : {}) },
      ip,
    });
    await this.reasignarPendientes().catch((err: any) => this.logger.warn(`No se pudo reubicar la cola: ${err.message}`));
    this.eventos?.emitirAdmin('impresion:estado', { equipoId: e.id.toString() });
  }

  /**
   * Reubica lo que espera en cola: lo que ninguna PC tenía asignada, y lo de una PC que ya no lo imprime (se cambió
   * su configuración, está en pausa o se desvinculó). Lo que sigue en una PC que lo acepta no se mueve. Devuelve cuántos.
   */
  async reasignarPendientes(): Promise<number> {
    const ctx = await this.contexto();
    const pend = await this.prisma.printJob.findMany({
      where: { estado: 'PENDIENTE', pedido_id: { not: null } },
      select: { id: true, tipo: true, area_id: true, payload: true, destino_equipo_id: true },
      take: 500,
    });
    let n = 0;
    for (const j of pend) {
      const areas = areasParaRuteo(j.tipo, j.area_id, ctx.areaBebidasId, (j.payload as any)?.areaId);
      const actual = j.destino_equipo_id !== null ? ctx.equipos.find((e) => e.id === j.destino_equipo_id) : undefined;
      if (actual && equipoAcepta(actual.config, j.tipo, areas)) continue;
      const nuevo = destinoDeTrabajo(j.tipo, areas, ctx);
      if ((nuevo?.id ?? null) === j.destino_equipo_id) continue;
      await this.prisma.printJob.update({
        where: { id: j.id },
        data: { destino_equipo_id: nuevo?.id ?? null, destino_area_id: nuevo?.areaId ?? null },
      });
      n += 1;
    }
    if (n > 0) this.eventos?.emitirAdmin('impresion:cola', { reubicados: n });
    return n;
  }


  // ───────────── Identidad de la PC: reutilizar su configuración al volver a vincularla ─────────────

  /**
   * Una llave nueva acaba de vincularse (canje o primer latido): si es una PC ya conocida (por uid o por nombre+sistema)
   * hereda su configuración y la llave vieja queda desactivada. PC realmente nueva o caso ambiguo: no toca nada (queda
   * «nueva, falta configurar» y el panel pregunta si es la misma).
   */
  async reconocerYReutilizar(nuevoId: bigint, ident: IdentidadEquipo): Promise<{ reutilizada: boolean; ambiguo: boolean; deId?: string }> {
    try {
      const nuevo = await this.prisma.deviceKey.findUnique({ where: { id: nuevoId }, include: { configImpresion: true } });
      if (!nuevo || nuevo.tipo !== 'AGENTE') return { reutilizada: false, ambiguo: false };
      const info: IdentidadEquipo = { ...ident, uid: ident.uid || nuevo.equipo_uid };
      if (ident.uid && ident.uid !== nuevo.equipo_uid) {
        await this.prisma.deviceKey.update({ where: { id: nuevoId }, data: { equipo_uid: ident.uid.slice(0, 80) } });
      }
      const candidatas = (await this.prisma.deviceKey.findMany({
        where: { tipo: 'AGENTE', id: { not: nuevoId }, codigo_vinculo: null, reemplazada_por: null, ultimo_latido: { not: null } },
        include: { configImpresion: true },
      })) as FilaEquipo[];
      const r = reconocerEquipo(info, candidatas);
      if (!r.base) return { reutilizada: false, ambiguo: r.ambiguo };
      // Ambigua: hereda la configuración pero NO se desactiva a la otra (podría ser una PC distinta encendida)
      await this.traspasar(r.base.id, nuevoId, r.otros.map((o) => o.id), `reconocida por ${r.por}${r.ambiguo ? ' (posible duplicado)' : ''}`, undefined, undefined, !r.ambiguo);
      return { reutilizada: true, ambiguo: r.ambiguo, deId: r.base.id.toString() };
    } catch (err: any) {
      this.logger.warn(`No se pudo reconocer la PC ${nuevoId}: ${err.message}`);
      return { reutilizada: false, ambiguo: false };
    }
  }

  /**
   * Pasa la configuración de la PC vieja (`desdeId`) a la llave nueva (`haciaId`) y archiva la vieja (y `otros`).
   * La nueva conserva la suya si ya estaba configurada. Reapunta lo que esperaba en cola. Todo en una transacción.
   */
  async traspasar(desdeId: bigint, haciaId: bigint, otros: bigint[], motivo: string, usuario?: UsuarioAutenticado, ip?: string, archivar = true) {
    const viejos = [desdeId, ...otros];
    const ahora = new Date();
    await this.prisma.$transaction(async (tx) => {
      const [desde, hacia] = await Promise.all([
        tx.deviceKey.findUnique({ where: { id: desdeId }, include: { configImpresion: true } }),
        tx.deviceKey.findUnique({ where: { id: haciaId }, include: { configImpresion: true } }),
      ]);
      if (!desde || !hacia) throw new NotFoundException({ codigo: 'EQUIPO_NO_ENCONTRADO', mensaje: 'Esa computadora ya no existe' });
      const datos: Record<string, unknown> = {};
      if (desde.configImpresion && !hacia.configImpresion?.configurado) {
        const { device_key_id: _omitir, ...cfg } = desde.configImpresion;
        await tx.equipoImpresionConfig.upsert({
          where: { device_key_id: haciaId },
          create: { device_key_id: haciaId, ...(cfg as any) },
          update: cfg as any,
        });
        const sel = await tx.parametro.findUnique({ where: { clave: claveSeleccion(desdeId) } });
        if (sel) {
          await tx.parametro.upsert({
            where: { clave: claveSeleccion(haciaId) },
            create: { clave: claveSeleccion(haciaId), valor: sel.valor as any },
            update: { valor: sel.valor as any },
          });
        }
        if (desde.nombre && desde.nombre !== 'Programa del local') datos.nombre = desde.nombre;
        if (desde.area_id) datos.area_id = desde.area_id;
      } else if (hacia.nombre === 'Programa del local' && desde.nombre !== 'Programa del local') {
        datos.nombre = desde.nombre;
      }
      if (!hacia.equipo_uid && desde.equipo_uid) datos.equipo_uid = desde.equipo_uid;
      if (Object.keys(datos).length) await tx.deviceKey.update({ where: { id: haciaId }, data: datos as any });
      if (!archivar) return;
      await tx.printJob.updateMany({
        where: { destino_equipo_id: { in: viejos }, estado: 'PENDIENTE' },
        data: { destino_equipo_id: haciaId, ...(desde.area_id ? { destino_area_id: desde.area_id } : {}) },
      });
      await tx.deviceKey.updateMany({
        where: { id: { in: viejos } },
        data: { activo: false, archivada_en: ahora, reemplazada_por: haciaId },
      });
    });
    if (!archivar) return;
    await this.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'impresion',
      accion: 'EQUIPO_IMPRESION_REEMPLAZADO',
      entidad: 'device_key',
      entidadId: haciaId,
      partyId: usuario?.partyId,
      despues: { reemplazadas: viejos.map(String), motivo: `reemplazada por nueva vinculación (${motivo})` },
      ip,
    });
    this.eventos?.emitirAdmin('impresion:estado', { equipoId: haciaId.toString() });
  }

  /**
   * «Eliminar PC»: soft-delete auditado. La PC y su llave quedan inactivas y archivadas (nada se borra), lo pendiente a
   * ella se descarta («PC eliminada») y su llave deja de entrar (401). Si la misma PC se vincula otra vez, se reconoce
   * y hereda su configuración. Solo ADMIN o CAJERO.
   */
  async eliminar(idInput: string | number, motivoInput: unknown, usuario?: UsuarioAutenticado, ip?: string) {
    const roles = (usuario?.roles ?? [usuario?.rol ?? '']).map((r) => String(r || '').toUpperCase());
    if (!roles.some((r) => r === 'ADMIN' || r === 'CAJERO')) {
      throw new ForbiddenException({ codigo: 'SIN_PERMISO_ELIMINAR_PC', mensaje: 'Solo Caja o un administrador pueden eliminar una PC' });
    }
    const id = this.parseId(idInput);
    const e = await this.prisma.deviceKey.findUnique({ where: { id } });
    if (!e || e.tipo !== 'AGENTE' || e.eliminada_en) {
      throw new NotFoundException({ codigo: 'EQUIPO_NO_ENCONTRADO', mensaje: 'Esa computadora ya no está en la lista' });
    }
    const motivo = typeof motivoInput === 'string' ? motivoInput.trim().slice(0, 200) : '';
    const ahora = new Date();
    const descartados = await this.prisma.$transaction(async (tx) => {
      await tx.deviceKey.update({ where: { id }, data: { activo: false, archivada_en: e.archivada_en ?? ahora, eliminada_en: ahora } });
      const r = await tx.printJob.updateMany({
        where: { destino_equipo_id: id, estado: { in: ['PENDIENTE', 'IMPRIMIENDO'] } },
        data: { estado: 'DESCARTADO', error: 'Descartada: PC eliminada' },
      });
      return r.count;
    });
    await this.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'impresion',
      accion: 'ELIMINAR_PC',
      entidad: 'device_key',
      entidadId: id,
      partyId: usuario?.partyId,
      motivo: motivo || undefined,
      antes: { nombre: e.nombre, hostname: e.latido_hostname, sistema: e.latido_sistema, ipLocal: e.latido_ip_local },
      despues: { eliminada: true, trabajosDescartados: descartados },
      ip,
    });
    // Lo que esperaba a una PC que sí sigue activa y lo acepta se reubica; el resto queda en espera
    await this.reasignarPendientes().catch(() => 0);
    this.eventos?.emitirAdmin('impresion:estado', {});
    return { ok: true, descartados };
  }

  /** «Sí, es la misma»: traspasa la configuración de `otraId` a esta PC y archiva la otra (auditado). */
  async fusionar(idInput: string | number, otraInput: unknown, usuario?: UsuarioAutenticado, ip?: string) {
    const id = this.parseId(idInput);
    const otra = this.parseId(otraInput as any);
    if (id === otra) throw new BadRequestException({ codigo: 'MISMA_PC', mensaje: 'Elige otra computadora' });
    await this.equipo(id.toString());
    const o = await this.prisma.deviceKey.findUnique({ where: { id: otra } });
    if (!o || o.tipo !== 'AGENTE') throw new NotFoundException({ codigo: 'EQUIPO_NO_ENCONTRADO', mensaje: 'Esa computadora ya no existe' });
    await this.traspasar(otra, id, [], 'confirmado por el dueño', usuario, ip);
    await this.reasignarPendientes().catch(() => 0);
    return { ok: true };
  }

  /** «No, es otra PC»: deja de preguntar por estas dos. */
  async noEsLaMisma(idInput: string | number, otraInput: unknown, usuario?: UsuarioAutenticado, ip?: string) {
    const ids = [this.parseId(idInput), this.parseId(otraInput as any)];
    await this.prisma.deviceKey.updateMany({ where: { id: { in: ids }, tipo: 'AGENTE' }, data: { distinta_confirmada: true } });
    await this.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'impresion',
      accion: 'EQUIPO_IMPRESION_CONFIRMADO_DISTINTO',
      entidad: 'device_key',
      entidadId: ids[0],
      partyId: usuario?.partyId,
      despues: { equipos: ids.map(String) },
      ip,
    });
    this.eventos?.emitirAdmin('impresion:estado', {});
    return { ok: true };
  }

  /**
   * «Limpiar PCs antiguas»: archiva (soft-delete: nada se borra) las PC apagadas con otra más nueva del mismo nombre y las
   * desactivadas. Si la más nueva aún no está configurada, hereda la configuración de la anterior. Exige motivo.
   */
  async limpiarAntiguas(motivoInput: unknown, usuario?: UsuarioAutenticado, ip?: string) {
    const motivo = typeof motivoInput === 'string' ? motivoInput.trim().slice(0, 200) : '';
    if (motivo.length < 3) throw new BadRequestException({ codigo: 'MOTIVO_OBLIGATORIO', mensaje: 'Escribe el motivo de la limpieza' });
    const filas = (await this.prisma.deviceKey.findMany({
      where: { tipo: 'AGENTE', archivada_en: null, codigo_vinculo: null },
      include: { configImpresion: true },
    })) as FilaEquipo[];
    const clas = clasificarEquipos(filas);
    const antiguas = filas.filter((f) => clas.get(f.id)?.antigua);
    const t = (f: FilaEquipo) => (f.ultimo_latido ? new Date(f.ultimo_latido).getTime() : 0);
    // Cada antigua activa se traspasa a la más nueva de su nombre (si esa aún no estaba configurada) y se archiva
    for (const a of antiguas.filter((x) => x.activo).sort((x, y) => t(y) - t(x))) {
      const actual = filas
        .filter((f) => f !== a && !clas.get(f.id)?.antigua && claveIgual(f, a))
        .sort((x, y) => t(y) - t(x))[0];
      if (actual) await this.traspasar(a.id, actual.id, [], `limpieza: ${motivo}`, usuario, ip);
    }
    const restantes = await this.prisma.deviceKey.updateMany({
      where: { id: { in: antiguas.map((a) => a.id) }, archivada_en: null },
      data: { activo: false, archivada_en: new Date() },
    });
    await this.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'impresion',
      accion: 'LIMPIAR_EQUIPOS_IMPRESION_ANTIGUOS',
      entidad: 'device_key',
      partyId: usuario?.partyId,
      despues: { archivadas: antiguas.map((a) => a.id.toString()), motivo, restantes: restantes.count },
      ip,
    });
    await this.reasignarPendientes().catch(() => 0);
    this.eventos?.emitirAdmin('impresion:estado', {});
    return { ok: true, archivadas: antiguas.length };
  }

  /** Trabajos reales esperando sin PC que los imprima (para el aviso «ningún equipo imprime esto»). */
  async contarSinReceptor(): Promise<number> {
    try {
      return await this.prisma.printJob.count({ where: { estado: 'PENDIENTE', pedido_id: { not: null }, destino_equipo_id: null } });
    } catch {
      return 0;
    }
  }

  /**
   * «Imprimir prueba con este tamaño»: un sticker de ejemplo (general o de bebida) a ESA PC, con el tamaño que se está
   * viendo en la vista previa (sin tamaño: el que tenga guardado o el general del local). No exige que la PC esté configurada.
   */
  async pruebaEtiqueta(
    idInput: string | number,
    tipo: 'general' | 'bebida',
    tamano: unknown,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const e = await this.equipo(idInput);
    if (tipo !== 'general' && tipo !== 'bebida') {
      throw new BadRequestException({ codigo: 'TIPO_INVALIDO', mensaje: 'El sticker de prueba es general o de bebida' });
    }
    const t = tamano === undefined || tamano === null ? null : tamanoPcValido(tamano);
    if (tamano !== undefined && tamano !== null && !t) {
      throw new BadRequestException({ codigo: 'TAMANO_INVALIDO', mensaje: 'El tamaño debe estar entre 30 y 200 mm' });
    }
    const reciente = await this.prisma.printJob.findFirst({
      where: { pedido_id: null, destino_equipo_id: e.id, en: { gt: new Date(Date.now() - ESPERA_PRUEBA_MS) } },
      select: { id: true },
    });
    if (reciente) {
      throw new HttpException({ codigo: 'PRUEBA_FRECUENTE', mensaje: 'Espera unos segundos antes de otra prueba' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const local = await this.prisma.parametro.findUnique({ where: { clave: 'local_datos' } }).catch(() => null);
    const datos = tipo === 'general' ? construirEtiquetaPrueba(local?.valor, 'prueba') : construirEtiquetaBebidaPrueba('prueba');
    const medida = t ? aplicarOrientacion(t) : null;
    const trabajo = await this.prisma.printJob.create({
      data: {
        pedido_id: null,
        tipo: tipo === 'general' ? 'ETIQUETA_GENERAL' : 'ETIQUETA_BEBIDA',
        payload: { ...datos, ...(medida ? { tamanoMm: { anchoMm: medida.anchoMm, altoMm: medida.altoMm, ...(medida.margenMm ? { margenMm: medida.margenMm } : {}) } } : {}) } as any,
        copia: false,
        estado: 'PENDIENTE',
        destino_equipo_id: e.id,
        destino_area_id: e.area_id,
      },
    });
    await this.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'impresion',
      accion: 'IMPRESION_PRUEBA_TAMANO',
      entidad: 'print_job',
      entidadId: trabajo.id,
      partyId: usuario?.partyId,
      despues: { equipo: e.nombre, tipo, ...(medida ? { tamano: medida } : {}) },
      ip,
    });
    this.eventos?.emitirAdmin('impresion:cola', { prueba: true });
    return { ok: true, trabajoId: trabajo.id.toString(), mensaje: `Sticker de prueba enviado a ${e.nombre}` };
  }
}
