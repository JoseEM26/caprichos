import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  CrearPisoDto,
} from './dto/crear-piso.dto';
import {
  ActualizarPisoDto,
} from './dto/actualizar-piso.dto';
import {
  CrearElementoDto,
} from './dto/crear-elemento.dto';
import {
  ActualizarElementoDto,
} from './dto/actualizar-elemento.dto';
import {
  esTipoValido,
  normalizarTipoPlano,
  obtenerRangoHoyLima,
  verificarDentroDeCuadricula,
  verificarSuperposicion,
} from './plano.util';

export interface PisoConTotales {
  id: string;
  nombre: string;
  activo: boolean;
  cuadriculaAncho: number;
  cuadriculaAlto: number;
  mesas: number;
  asientosTotales: number;
  mesasActivas: number;
  totales: {
    mesas: number;
    asientosTotales: number;
    mesasActivas: number;
  };
  elementos: ElementoPlanoRespuesta[];
}

export interface ElementoPlanoRespuesta {
  id: string;
  pisoId: string;
  tipo: string;
  nombre: string | null;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  numero: number | null;
  asientos: number | null;
  activo: boolean;
}

export interface MesaActivaItem {
  id: string;
  numero: number;
  nombre: string | null;
  asientos: number;
  pisoId: string;
  pisoNombre: string;
  piso: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  activo: boolean;
}

export interface PlanoDisenoJson {
  floors: Array<{
    id: string;
    n: string;
    on?: boolean;
  }>;
  dims: Record<string, { w: number; h: number }>;
  plan: Record<
    string,
    Array<{
      id?: string;
      t: string;
      x: number;
      y: number;
      w: number;
      h: number;
      label?: string;
      seats?: number;
      asientos?: number;
      numero?: number;
      on?: boolean;
    }>
  >;
}

@Injectable()
export class PlanoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  private serializarElemento(elem: any): ElementoPlanoRespuesta {
    return {
      id: elem.id.toString(),
      pisoId: elem.piso_id.toString(),
      tipo: elem.tipo,
      nombre: elem.nombre ?? null,
      x: elem.x,
      y: elem.y,
      ancho: elem.ancho,
      alto: elem.alto,
      numero: elem.numero ?? null,
      asientos: elem.asientos ?? null,
      activo: elem.activo,
    };
  }

  private serializarPiso(p: any): PisoConTotales {
    const elementos = (p.elementos || []).map((e: any) => this.serializarElemento(e));
    const mesasElem = elementos.filter((e: any) => e.tipo === 'MESA');
    const mesas = mesasElem.length;
    const mesasActivas = mesasElem.filter((e: any) => e.activo).length;
    const asientosTotales = mesasElem.reduce(
      (acc: number, curr: any) => acc + (curr.asientos ?? 0),
      0,
    );

    return {
      id: p.id.toString(),
      nombre: p.nombre,
      activo: p.activo,
      cuadriculaAncho: p.cuadricula_ancho,
      cuadriculaAlto: p.cuadricula_alto,
      mesas,
      asientosTotales,
      mesasActivas,
      totales: {
        mesas,
        asientosTotales,
        mesasActivas,
      },
      elementos,
    };
  }

  // =========================================================================
  // 1) OBTENER PLANO Y MESAS ACTIVAS
  // =========================================================================

  async obtenerPlano(): Promise<PisoConTotales[]> {
    const pisos = await this.prisma.piso.findMany({
      orderBy: { id: 'asc' },
      include: {
        elementos: {
          orderBy: [{ numero: 'asc' }, { id: 'asc' }],
        },
      },
    });

    return pisos.map((p) => this.serializarPiso(p));
  }

  async obtenerMesasActivas(): Promise<MesaActivaItem[]> {
    const mesas = await this.prisma.elementoPlano.findMany({
      where: {
        tipo: 'MESA',
        activo: true,
      },
      include: {
        piso: true,
      },
      orderBy: [{ numero: 'asc' }, { id: 'asc' }],
    });

    return mesas.map((m) => ({
      id: m.id.toString(),
      numero: m.numero ?? 0,
      nombre: m.nombre ?? (m.numero ? `Mesa ${m.numero}` : null),
      asientos: m.asientos ?? 0,
      pisoId: m.piso_id.toString(),
      pisoNombre: m.piso?.nombre ?? '',
      piso: m.piso?.nombre ?? '',
      x: m.x,
      y: m.y,
      ancho: m.ancho,
      alto: m.alto,
      activo: m.activo,
    }));
  }

  // =========================================================================
  // 2) PISOS
  // =========================================================================

  async crearPiso(
    dto: CrearPisoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<PisoConTotales> {
    const cuadriculaAncho = dto.cuadriculaAncho ?? dto.cuadricula?.ancho ?? 20;
    const cuadriculaAlto = dto.cuadriculaAlto ?? dto.cuadricula?.alto ?? 12;

    const nuevo = await this.prisma.piso.create({
      data: {
        nombre: dto.nombre.trim(),
        activo: false, // creado desactivado por requerimiento
        cuadricula_ancho: cuadriculaAncho,
        cuadricula_alto: cuadriculaAlto,
      },
      include: {
        elementos: true,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'plano',
      accion: 'CREAR_PISO',
      resultado: 'OK',
      entidad: 'piso',
      entidadId: nuevo.id,
      despues: {
        id: nuevo.id.toString(),
        nombre: nuevo.nombre,
        activo: nuevo.activo,
        cuadriculaAncho: nuevo.cuadricula_ancho,
        cuadriculaAlto: nuevo.cuadricula_alto,
      },
      partyId: usuario?.partyId,
      ip,
    });

    try {
      this.eventosGateway?.emitirAdmin?.('plano:cambio', {
        tipo: 'PISO_CREADO',
        pisoId: nuevo.id.toString(),
      });
    } catch {
      // Notificaciones ws nunca bloquean
    }

    return this.serializarPiso(nuevo);
  }

  async actualizarPiso(
    id: string | number | bigint,
    dto: ActualizarPisoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<PisoConTotales> {
    const pisoId = BigInt(id);
    const piso = await this.prisma.piso.findUnique({
      where: { id: pisoId },
      include: {
        elementos: true,
      },
    });

    if (!piso) {
      throw new NotFoundException({
        codigo: 'PISO_NO_ENCONTRADO',
        mensaje: `No se encontró el piso con id ${id}`,
      });
    }

    // Regla: el piso 1 no se puede desactivar (409 PISO_PRINCIPAL)
    if (dto.activo === false) {
      const esPisoPrincipal =
        piso.id === 1n || piso.nombre.trim().toLowerCase() === 'piso 1';
      if (esPisoPrincipal) {
        throw new ConflictException({
          codigo: 'PISO_PRINCIPAL',
          mensaje: 'El piso 1 no se puede desactivar',
        });
      }
    }

    const nuevoAncho =
      dto.cuadriculaAncho ?? dto.cuadricula_ancho ?? piso.cuadricula_ancho;
    const nuevoAlto =
      dto.cuadriculaAlto ?? dto.cuadricula_alto ?? piso.cuadricula_alto;

    if (nuevoAncho < 1 || nuevoAlto < 1) {
      throw new BadRequestException({
        codigo: 'CUADRICULA_INVALIDA',
        mensaje: 'Las dimensiones de la cuadrícula deben ser mayores a 0',
      });
    }

    // Validar si algún elemento quedaría fuera de la nueva cuadrícula
    const elementosFuera = piso.elementos.filter(
      (e) => e.x + e.ancho > nuevoAncho || e.y + e.alto > nuevoAlto,
    );

    if (elementosFuera.length > 0) {
      throw new ConflictException({
        codigo: 'ELEMENTOS_FUERA',
        mensaje: 'Existen elementos que quedarían fuera del nuevo tamaño de cuadrícula',
        elementos: elementosFuera.map((e) => ({
          id: e.id.toString(),
          tipo: e.tipo,
          nombre: e.nombre,
          numero: e.numero,
          x: e.x,
          y: e.y,
          ancho: e.ancho,
          alto: e.alto,
        })),
      });
    }

    const anterior = {
      id: piso.id.toString(),
      nombre: piso.nombre,
      activo: piso.activo,
      cuadriculaAncho: piso.cuadricula_ancho,
      cuadriculaAlto: piso.cuadricula_alto,
    };

    const actualizado = await this.prisma.piso.update({
      where: { id: piso.id },
      data: {
        nombre: dto.nombre !== undefined ? dto.nombre.trim() : undefined,
        activo: dto.activo !== undefined ? dto.activo : undefined,
        cuadricula_ancho: nuevoAncho,
        cuadricula_alto: nuevoAlto,
      },
      include: {
        elementos: {
          orderBy: [{ numero: 'asc' }, { id: 'asc' }],
        },
      },
    });

    const despues = {
      id: actualizado.id.toString(),
      nombre: actualizado.nombre,
      activo: actualizado.activo,
      cuadriculaAncho: actualizado.cuadricula_ancho,
      cuadriculaAlto: actualizado.cuadricula_alto,
    };

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'plano',
      accion: 'ACTUALIZAR_PISO',
      resultado: 'OK',
      entidad: 'piso',
      entidadId: piso.id,
      antes: anterior,
      despues,
      partyId: usuario?.partyId,
      ip,
    });

    try {
      this.eventosGateway?.emitirAdmin?.('plano:cambio', {
        tipo: 'PISO_ACTUALIZADO',
        pisoId: actualizado.id.toString(),
      });
    } catch {
      // Ignorar fallo en websocket
    }

    return this.serializarPiso(actualizado);
  }

  // =========================================================================
  // 3) ELEMENTOS
  // =========================================================================

  async crearElemento(
    dto: CrearElementoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<ElementoPlanoRespuesta> {
    const pisoId = BigInt(dto.pisoId);
    const piso = await this.prisma.piso.findUnique({
      where: { id: pisoId },
    });

    if (!piso) {
      throw new NotFoundException({
        codigo: 'PISO_NO_ENCONTRADO',
        mensaje: `No se encontró el piso con id ${dto.pisoId}`,
      });
    }

    const tipoNorm = normalizarTipoPlano(dto.tipo);
    if (!esTipoValido(tipoNorm)) {
      throw new BadRequestException({
        codigo: 'TIPO_INVALIDO',
        mensaje: `Tipo de elemento inválido: ${dto.tipo}`,
      });
    }

    if (tipoNorm === 'MESA') {
      if (!dto.asientos || dto.asientos < 1) {
        throw new BadRequestException({
          codigo: 'ASIENTOS_REQUERIDOS',
          mensaje: 'Una mesa exige al menos 1 asiento',
        });
      }
    }

    const cabe = verificarDentroDeCuadricula(
      { x: dto.x, y: dto.y, ancho: dto.ancho, alto: dto.alto },
      { ancho: piso.cuadricula_ancho, alto: piso.cuadricula_alto },
    );

    if (!cabe) {
      throw new BadRequestException({
        codigo: 'FUERA_DE_CUADRICULA',
        mensaje: 'El elemento no cabe en la cuadrícula del piso',
      });
    }

    // Valida superposición con elementos ACTIVOS del piso (409 SUPERPUESTO)
    const activosPiso =
      (await this.prisma.elementoPlano.findMany({
        where: {
          piso_id: piso.id,
          activo: true,
        },
      })) ?? [];

    const superpuesto = activosPiso.find((otro) =>
      verificarSuperposicion(
        { x: dto.x, y: dto.y, ancho: dto.ancho, alto: dto.alto },
        otro,
      ),
    );

    if (superpuesto) {
      throw new ConflictException({
        codigo: 'SUPERPUESTO',
        mensaje: 'El elemento se superpone con otro elemento activo del piso',
      });
    }

    let numero: number | null = null;
    let asientos: number | null = null;
    let nombre: string | null = dto.nombre ? dto.nombre.trim() : null;

    if (tipoNorm === 'MESA') {
      asientos = dto.asientos ?? null;

      // Toma el número siguiente al mayor que exista entre todos los pisos
      const mayorMesa = await this.prisma.elementoPlano.findFirst({
        where: {
          tipo: 'MESA',
          numero: { not: null },
        },
        orderBy: { numero: 'desc' },
      });

      numero = (mayorMesa?.numero ?? 0) + 1;
      if (!nombre) {
        nombre = `Mesa ${numero}`;
      }
    } else {
      if (!nombre) {
        nombre = tipoNorm.charAt(0) + tipoNorm.slice(1).toLowerCase();
      }
    }

    const nuevo = await this.prisma.elementoPlano.create({
      data: {
        piso_id: piso.id,
        tipo: tipoNorm,
        nombre,
        x: dto.x,
        y: dto.y,
        ancho: dto.ancho,
        alto: dto.alto,
        numero,
        asientos,
        activo: true,
      },
    });

    const despues = this.serializarElemento(nuevo);

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'plano',
      accion: 'CREAR_ELEMENTO',
      resultado: 'OK',
      entidad: 'elemento_plano',
      entidadId: nuevo.id,
      despues,
      partyId: usuario?.partyId,
      ip,
    });

    try {
      this.eventosGateway?.emitirAdmin?.('plano:cambio', {
        tipo: 'ELEMENTO_CREADO',
        elementoId: nuevo.id.toString(),
        pisoId: piso.id.toString(),
      });
    } catch {
      // Ignorar fallo en websocket
    }

    return despues;
  }

  async actualizarElemento(
    id: string | number | bigint,
    dto: ActualizarElementoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<ElementoPlanoRespuesta> {
    const elemId = BigInt(id);
    const elem = await this.prisma.elementoPlano.findUnique({
      where: { id: elemId },
      include: { piso: true },
    });

    if (!elem) {
      throw new NotFoundException({
        codigo: 'ELEMENTO_NO_ENCONTRADO',
        mensaje: `No se encontró el elemento con id ${id}`,
      });
    }

    const nuevoX = dto.x !== undefined ? dto.x : elem.x;
    const nuevoY = dto.y !== undefined ? dto.y : elem.y;
    const nuevoAncho = dto.ancho !== undefined ? dto.ancho : elem.ancho;
    const nuevoAlto = dto.alto !== undefined ? dto.alto : elem.alto;
    const nuevoActivo = dto.activo !== undefined ? dto.activo : elem.activo;
    const nuevoNombre =
      dto.nombre !== undefined ? dto.nombre.trim() : elem.nombre;

    let nuevoAsientos = elem.asientos;
    if (elem.tipo === 'MESA') {
      if (dto.asientos !== undefined) {
        if (dto.asientos < 1) {
          throw new BadRequestException({
            codigo: 'ASIENTOS_REQUERIDOS',
            mensaje: 'Una mesa exige al menos 1 asiento',
          });
        }
        nuevoAsientos = dto.asientos;
      }
    }

    const cabe = verificarDentroDeCuadricula(
      { x: nuevoX, y: nuevoY, ancho: nuevoAncho, alto: nuevoAlto },
      { ancho: elem.piso.cuadricula_ancho, alto: elem.piso.cuadricula_alto },
    );

    if (!cabe) {
      throw new BadRequestException({
        codigo: 'FUERA_DE_CUADRICULA',
        mensaje: 'El elemento no cabe en la cuadrícula del piso',
      });
    }

    // Si el elemento queda activo, no puede superponerse con otro activo
    if (nuevoActivo) {
      const otrosActivos =
        (await this.prisma.elementoPlano.findMany({
          where: {
            piso_id: elem.piso_id,
            activo: true,
            id: { not: elem.id },
          },
        })) ?? [];

      const superpuesto = otrosActivos.find((otro) =>
        verificarSuperposicion(
          { x: nuevoX, y: nuevoY, ancho: nuevoAncho, alto: nuevoAlto },
          otro,
        ),
      );

      if (superpuesto) {
        throw new ConflictException({
          codigo: 'SUPERPUESTO',
          mensaje: 'El elemento se superpone con otro elemento activo del piso',
        });
      }
    }

    const antes = this.serializarElemento(elem);

    const actualizado = await this.prisma.elementoPlano.update({
      where: { id: elem.id },
      data: {
        x: nuevoX,
        y: nuevoY,
        ancho: nuevoAncho,
        alto: nuevoAlto,
        activo: nuevoActivo,
        nombre: nuevoNombre,
        asientos: nuevoAsientos,
      },
    });

    const despues = this.serializarElemento(actualizado);

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'plano',
      accion: 'ACTUALIZAR_ELEMENTO',
      resultado: 'OK',
      entidad: 'elemento_plano',
      entidadId: elem.id,
      antes,
      despues,
      partyId: usuario?.partyId,
      ip,
    });

    try {
      this.eventosGateway?.emitirAdmin?.('plano:cambio', {
        tipo: 'ELEMENTO_ACTUALIZADO',
        elementoId: elem.id.toString(),
        pisoId: elem.piso_id.toString(),
      });
    } catch {
      // Ignorar fallo en websocket
    }

    return despues;
  }

  async girarElemento(
    id: string | number | bigint,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<ElementoPlanoRespuesta> {
    const elemId = BigInt(id);
    const elem = await this.prisma.elementoPlano.findUnique({
      where: { id: elemId },
      include: { piso: true },
    });

    if (!elem) {
      throw new NotFoundException({
        codigo: 'ELEMENTO_NO_ENCONTRADO',
        mensaje: `No se encontró el elemento con id ${id}`,
      });
    }

    // Intercambia ancho y alto en el mismo lugar
    const nuevoAncho = elem.alto;
    const nuevoAlto = elem.ancho;

    const cabe = verificarDentroDeCuadricula(
      { x: elem.x, y: elem.y, ancho: nuevoAncho, alto: nuevoAlto },
      { ancho: elem.piso.cuadricula_ancho, alto: elem.piso.cuadricula_alto },
    );

    if (!cabe) {
      throw new ConflictException({
        codigo: 'NO_CABE',
        mensaje: 'El elemento no cabe en la cuadrícula al girar en su posición actual',
      });
    }

    if (elem.activo) {
      const otrosActivos =
        (await this.prisma.elementoPlano.findMany({
          where: {
            piso_id: elem.piso_id,
            activo: true,
            id: { not: elem.id },
          },
        })) ?? [];

      const superpuesto = otrosActivos.find((otro) =>
        verificarSuperposicion(
          { x: elem.x, y: elem.y, ancho: nuevoAncho, alto: nuevoAlto },
          otro,
        ),
      );

      if (superpuesto) {
        throw new ConflictException({
          codigo: 'NO_CABE',
          mensaje: 'El elemento no cabe al girar porque se superpone con otro elemento activo',
        });
      }
    }

    const antes = this.serializarElemento(elem);

    const actualizado = await this.prisma.elementoPlano.update({
      where: { id: elem.id },
      data: {
        ancho: nuevoAncho,
        alto: nuevoAlto,
      },
    });

    const despues = this.serializarElemento(actualizado);

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'plano',
      accion: 'GIRAR_ELEMENTO',
      resultado: 'OK',
      entidad: 'elemento_plano',
      entidadId: elem.id,
      antes,
      despues,
      partyId: usuario?.partyId,
      ip,
    });

    try {
      this.eventosGateway?.emitirAdmin?.('plano:cambio', {
        tipo: 'ELEMENTO_GIRADO',
        elementoId: elem.id.toString(),
        pisoId: elem.piso_id.toString(),
      });
    } catch {
      // Ignorar fallo en websocket
    }

    return despues;
  }

  async eliminarElemento(
    id: string | number | bigint,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<{ ok: boolean; eliminado: boolean; id: string }> {
    const elemId = BigInt(id);
    const elem = await this.prisma.elementoPlano.findUnique({
      where: { id: elemId },
    });

    if (!elem) {
      throw new NotFoundException({
        codigo: 'ELEMENTO_NO_ENCONTRADO',
        mensaje: `No se encontró el elemento con id ${id}`,
      });
    }

    // Si es MESA, validar que no tenga pedido abierto ni reserva activa hoy en America/Lima
    if (elem.tipo === 'MESA') {
      const pedidoAbierto = await this.prisma.pedidoMesa.findFirst({
        where: {
          mesa_id: elem.id,
          abierta: true,
        },
      });

      if (pedidoAbierto) {
        throw new ConflictException({
          codigo: 'MESA_EN_USO',
          mensaje: `La mesa ${elem.numero ?? ''} tiene un pedido abierto y no se puede eliminar. Puedes desactivarla en su lugar.`,
          motivo: 'PEDIDO_ABIERTO',
          sugerencia: 'desactivar',
        });
      }

      const { inicio, fin } = obtenerRangoHoyLima();
      const reservaActivaHoy = await this.prisma.reservaMesa.findFirst({
        where: {
          mesa_id: elem.id,
          reserva: {
            estado: 'ACTIVA',
            hora: {
              gte: inicio,
              lte: fin,
            },
          },
        },
      });

      if (reservaActivaHoy) {
        throw new ConflictException({
          codigo: 'MESA_EN_USO',
          mensaje: `La mesa ${elem.numero ?? ''} tiene una reserva activa para hoy y no se puede eliminar. Puedes desactivarla en su lugar.`,
          motivo: 'RESERVA_ACTIVA_HOY',
          sugerencia: 'desactivar',
        });
      }

      // Mesa ya usada: asegurar que pedidos y reservas cerrados conserven su nombre
      const mesaNombreRespaldo =
        elem.nombre || (elem.numero ? `Mesa ${elem.numero}` : 'Mesa');

      await this.prisma.pedidoMesa.updateMany({
        where: {
          mesa_id: elem.id,
          mesa_nombre: null,
        },
        data: {
          mesa_nombre: mesaNombreRespaldo,
        },
      });
    }

    const antes = this.serializarElemento(elem);

    // Borrado real (excepción RN-CAP-014)
    await this.prisma.elementoPlano.delete({
      where: { id: elem.id },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'plano',
      accion: 'ELIMINAR_ELEMENTO',
      resultado: 'OK',
      entidad: 'elemento_plano',
      entidadId: elem.id,
      antes,
      despues: null,
      partyId: usuario?.partyId,
      ip,
    });

    try {
      this.eventosGateway?.emitirAdmin?.('plano:cambio', {
        tipo: 'ELEMENTO_ELIMINADO',
        elementoId: elem.id.toString(),
        pisoId: elem.piso_id.toString(),
      });
    } catch {
      // Ignorar fallo en websocket
    }

    return {
      ok: true,
      eliminado: true,
      id: elem.id.toString(),
    };
  }

  // =========================================================================
  // 4) COPIAR Y PEGAR DISEÑO
  // =========================================================================

  async obtenerDiseno(): Promise<PlanoDisenoJson> {
    const pisos = await this.prisma.piso.findMany({
      orderBy: { id: 'asc' },
      include: {
        elementos: {
          orderBy: [{ numero: 'asc' }, { id: 'asc' }],
        },
      },
    });

    const floors = pisos.map((p) => ({
      id: `p${p.id}`,
      n: p.nombre,
      on: p.activo,
    }));

    const dims: Record<string, { w: number; h: number }> = {};
    const plan: Record<string, any[]> = {};

    for (const p of pisos) {
      const key = `p${p.id}`;
      dims[key] = {
        w: p.cuadricula_ancho,
        h: p.cuadricula_alto,
      };

      plan[key] = p.elementos.map((e) => {
        const t = e.tipo.toLowerCase();
        const idElem =
          e.tipo === 'MESA' && e.numero ? `m${e.numero}` : `e${e.id}`;
        return {
          id: idElem,
          t,
          x: e.x,
          y: e.y,
          w: e.ancho,
          h: e.alto,
          label:
            e.nombre ??
            (e.tipo === 'MESA' ? `Mesa ${e.numero}` : e.tipo.toLowerCase()),
          seats: e.asientos ?? undefined,
          on: e.activo,
        };
      });
    }

    return {
      floors,
      dims,
      plan,
    };
  }

  async aplicarDiseno(
    payload: any,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<{ ok: boolean; mensaje: string }> {
    let diseno: any = payload;

    if (typeof payload === 'string') {
      try {
        diseno = JSON.parse(payload);
      } catch {
        throw new BadRequestException({
          codigo: 'DISENO_INVALIDO',
          mensaje: 'El texto no es un JSON válido',
          detalle: ['Formato JSON malformado'],
        });
      }
    } else if (payload && typeof payload.diseno === 'string') {
      try {
        diseno = JSON.parse(payload.diseno);
      } catch {
        throw new BadRequestException({
          codigo: 'DISENO_INVALIDO',
          mensaje: 'El campo diseno no es un JSON válido',
          detalle: ['Formato JSON malformado'],
        });
      }
    } else if (payload && typeof payload.diseno === 'object') {
      diseno = payload.diseno;
    }

    if (!diseno || typeof diseno !== 'object') {
      throw new BadRequestException({
        codigo: 'DISENO_INVALIDO',
        mensaje: 'El contenido del diseño debe ser un objeto',
        detalle: ['El cuerpo no es un objeto válido'],
      });
    }

    if (!Array.isArray(diseno.floors) || diseno.floors.length === 0) {
      throw new BadRequestException({
        codigo: 'DISENO_INVALIDO',
        mensaje: 'El diseño debe incluir al menos un piso en "floors"',
        detalle: ['floors debe ser un arreglo no vacío'],
      });
    }

    if (!diseno.plan || typeof diseno.plan !== 'object') {
      throw new BadRequestException({
        codigo: 'DISENO_INVALIDO',
        mensaje: 'El diseño debe incluir la distribución en "plan"',
        detalle: ['plan debe ser un objeto'],
      });
    }

    // El piso 1 no se puede desactivar
    const primerPiso = diseno.floors[0];
    if (primerPiso && primerPiso.on === false) {
      throw new ConflictException({
        codigo: 'PISO_PRINCIPAL',
        mensaje: 'El piso 1 no se puede desactivar',
      });
    }

    const detalle: string[] = [];
    const numerosMesasEnDiseno = new Set<number>();

    interface ElementoProcesado {
      floorId: string;
      floorNombre: string;
      floorOn: boolean;
      gridW: number;
      gridH: number;
      tipo: string;
      nombre: string | null;
      x: number;
      y: number;
      ancho: number;
      alto: number;
      numero: number | null;
      asientos: number | null;
      activo: boolean;
    }

    const elementosAProcesar: ElementoProcesado[] = [];

    for (const floor of diseno.floors) {
      if (!floor.id || !floor.n) {
        detalle.push(`Piso sin id o nombre: ${JSON.stringify(floor)}`);
        continue;
      }

      const gridW = diseno.dims?.[floor.id]?.w ?? 20;
      const gridH = diseno.dims?.[floor.id]?.h ?? 12;

      const elems = diseno.plan[floor.id] || [];
      if (!Array.isArray(elems)) {
        detalle.push(`plan[${floor.id}] debe ser un arreglo de elementos`);
        continue;
      }

      const activosPiso: Array<{
        x: number;
        y: number;
        ancho: number;
        alto: number;
        label: string;
      }> = [];

      for (let i = 0; i < elems.length; i++) {
        const elem = elems[i];
        const tipoNorm = normalizarTipoPlano(elem.t);

        if (!esTipoValido(tipoNorm)) {
          detalle.push(
            `Elemento con tipo inválido "${elem.t}" en piso "${floor.n}"`,
          );
          continue;
        }

        const x = Number(elem.x);
        const y = Number(elem.y);
        const w = Number(elem.w);
        const h = Number(elem.h);

        if (
          !Number.isInteger(x) ||
          !Number.isInteger(y) ||
          !Number.isInteger(w) ||
          !Number.isInteger(h) ||
          x < 0 ||
          y < 0 ||
          w <= 0 ||
          h <= 0
        ) {
          detalle.push(
            `Dimensiones inválidas en elemento ${elem.id || elem.label || i} en piso "${floor.n}" (x:${x}, y:${y}, w:${w}, h:${h})`,
          );
          continue;
        }

        if (x + w > gridW || y + h > gridH) {
          detalle.push(
            `Elemento ${elem.id || elem.label || i} excede los límites (${gridW}x${gridH}) en piso "${floor.n}"`,
          );
          continue;
        }

        const activo = elem.on !== undefined ? Boolean(elem.on) : true;
        let numero: number | null = null;
        let asientos: number | null = null;

        if (tipoNorm === 'MESA') {
          // Extraer número de mesa
          if (elem.numero !== undefined && elem.numero !== null) {
            numero = Number(elem.numero);
          } else {
            const match =
              (elem.label || '').match(/\d+/) || (elem.id || '').match(/\d+/);
            numero = match ? parseInt(match[0], 10) : null;
          }

          if (!numero || numero <= 0) {
            detalle.push(
              `Mesa en piso "${floor.n}" no tiene un número positivo válido`,
            );
            continue;
          }

          if (numerosMesasEnDiseno.has(numero)) {
            detalle.push(
              `Número de mesa duplicado: ${numero} en piso "${floor.n}"`,
            );
            continue;
          }
          numerosMesasEnDiseno.add(numero);

          const rawSeats = elem.seats ?? elem.asientos;
          if (rawSeats === undefined || rawSeats === null || rawSeats < 1) {
            detalle.push(
              `Mesa ${numero} en piso "${floor.n}" requiere al menos 1 asiento`,
            );
            continue;
          }
          asientos = Number(rawSeats);
        }

        // Superposición entre activos del mismo piso
        if (activo) {
          const rect = { x, y, ancho: w, alto: h };
          for (const otro of activosPiso) {
            if (
              verificarSuperposicion(rect, {
                x: otro.x,
                y: otro.y,
                ancho: otro.ancho,
                alto: otro.alto,
              })
            ) {
              detalle.push(
                `Superposición en piso "${floor.n}" entre "${elem.label || elem.id}" y "${otro.label}"`,
              );
            }
          }
          activosPiso.push({
            x,
            y,
            ancho: w,
            alto: h,
            label: elem.label || elem.id || `elem_${i}`,
          });
        }

        elementosAProcesar.push({
          floorId: floor.id,
          floorNombre: floor.n,
          floorOn: floor.on !== undefined ? Boolean(floor.on) : true,
          gridW,
          gridH,
          tipo: tipoNorm,
          nombre: elem.label || (tipoNorm === 'MESA' ? `Mesa ${numero}` : null),
          x,
          y,
          ancho: w,
          alto: h,
          numero,
          asientos,
          activo,
        });
      }
    }

    if (detalle.length > 0) {
      throw new BadRequestException({
        codigo: 'DISENO_INVALIDO',
        mensaje: 'El diseño proporcionado contiene errores de validación',
        detalle,
      });
    }

    // Rechaza el reemplazo (409 MESA_EN_USO) si quitaría una mesa con pedido abierto o reserva activa hoy
    const mesasEnDb = await this.prisma.elementoPlano.findMany({
      where: {
        tipo: 'MESA',
        numero: { not: null },
      },
    });

    const { inicio, fin } = obtenerRangoHoyLima();

    for (const mesaDb of mesasEnDb) {
      if (mesaDb.numero && !numerosMesasEnDiseno.has(mesaDb.numero)) {
        // La mesa no existe en el nuevo diseño; verificar si está en uso
        const pedidoAbierto = await this.prisma.pedidoMesa.findFirst({
          where: {
            mesa_id: mesaDb.id,
            abierta: true,
          },
        });

        if (pedidoAbierto) {
          throw new ConflictException({
            codigo: 'MESA_EN_USO',
            mensaje: `El diseño eliminaría la mesa ${mesaDb.numero}, la cual tiene un pedido abierto`,
            motivo: 'PEDIDO_ABIERTO_EN_REEMPLAZO',
          });
        }

        const reservaActivaHoy = await this.prisma.reservaMesa.findFirst({
          where: {
            mesa_id: mesaDb.id,
            reserva: {
              estado: 'ACTIVA',
              hora: {
                gte: inicio,
                lte: fin,
              },
            },
          },
        });

        if (reservaActivaHoy) {
          throw new ConflictException({
            codigo: 'MESA_EN_USO',
            mensaje: `El diseño eliminaría la mesa ${mesaDb.numero}, la cual tiene una reserva activa para hoy`,
            motivo: 'RESERVA_ACTIVA_HOY_EN_REEMPLAZO',
          });
        }
      }
    }

    // Aplicar en una transacción
    await this.prisma.$transaction(async (tx) => {
      // 1. Mapear o crear pisos
      const pisosMap = new Map<string, any>();

      for (const floor of diseno.floors) {
        let piso = await tx.piso.findFirst({
          where: { nombre: floor.n },
        });

        const gridW = diseno.dims?.[floor.id]?.w ?? 20;
        const gridH = diseno.dims?.[floor.id]?.h ?? 12;
        const pisoActivo = floor.on !== undefined ? Boolean(floor.on) : true;

        if (!piso) {
          piso = await tx.piso.create({
            data: {
              nombre: floor.n,
              activo: pisoActivo,
              cuadricula_ancho: gridW,
              cuadricula_alto: gridH,
            },
          });
        } else {
          piso = await tx.piso.update({
            where: { id: piso.id },
            data: {
              activo: pisoActivo,
              cuadricula_ancho: gridW,
              cuadricula_alto: gridH,
            },
          });
        }
        pisosMap.set(floor.id, piso);
        pisosMap.set(floor.n, piso);
      }

      // 2. Mesas que ya no estarán: respaldar nombre en pedido_mesa y eliminar
      for (const mesaDb of mesasEnDb) {
        if (mesaDb.numero && !numerosMesasEnDiseno.has(mesaDb.numero)) {
          const nombreRespaldo =
            mesaDb.nombre || `Mesa ${mesaDb.numero}`;
          await tx.pedidoMesa.updateMany({
            where: { mesa_id: mesaDb.id, mesa_nombre: null },
            data: { mesa_nombre: nombreRespaldo },
          });
          await tx.elementoPlano.delete({
            where: { id: mesaDb.id },
          });
        }
      }

      // 3. Eliminar elementos no-mesa anteriores para recrear la distribución limpia
      await tx.elementoPlano.deleteMany({
        where: {
          tipo: { not: 'MESA' },
        },
      });

      // 4. Crear o actualizar elementos
      for (const item of elementosAProcesar) {
        const piso = pisosMap.get(item.floorId) || pisosMap.get(item.floorNombre);
        if (!piso) continue;

        if (item.tipo === 'MESA' && item.numero) {
          const mesaExistente = await tx.elementoPlano.findFirst({
            where: { tipo: 'MESA', numero: item.numero },
          });

          if (mesaExistente) {
            await tx.elementoPlano.update({
              where: { id: mesaExistente.id },
              data: {
                piso_id: piso.id,
                nombre: item.nombre,
                x: item.x,
                y: item.y,
                ancho: item.ancho,
                alto: item.alto,
                asientos: item.asientos,
                activo: item.activo,
              },
            });
          } else {
            await tx.elementoPlano.create({
              data: {
                piso_id: piso.id,
                tipo: 'MESA',
                nombre: item.nombre,
                x: item.x,
                y: item.y,
                ancho: item.ancho,
                alto: item.alto,
                numero: item.numero,
                asientos: item.asientos,
                activo: item.activo,
              },
            });
          }
        } else {
          // Elemento complementario (pared, cocina, etc.)
          await tx.elementoPlano.create({
            data: {
              piso_id: piso.id,
              tipo: item.tipo,
              nombre: item.nombre,
              x: item.x,
              y: item.y,
              ancho: item.ancho,
              alto: item.alto,
              numero: null,
              asientos: null,
              activo: item.activo,
            },
          });
        }
      }
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'plano',
      accion: 'APLICAR_DISENO',
      resultado: 'OK',
      despues: {
        totalPisos: diseno.floors.length,
        totalElementos: elementosAProcesar.length,
      },
      partyId: usuario?.partyId,
      ip,
    });

    try {
      this.eventosGateway?.emitirAdmin?.('plano:cambio', {
        tipo: 'DISENO_APLICADO',
      });
    } catch {
      // Ignorar fallo en websocket
    }

    return {
      ok: true,
      mensaje: 'Diseño aplicado correctamente',
    };
  }
}
