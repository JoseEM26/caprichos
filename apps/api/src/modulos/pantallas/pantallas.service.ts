import { HttpException, HttpStatus, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

const aFechaHoraLima = (d: Date | null): string => {
  if (!d) return 'Nunca';
  try {
    const ahora = new Date();
    const formatterDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });
    const formatterHora = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const hoyIso = formatterDia.format(ahora);
    const fechaIso = formatterDia.format(d);
    const hora = formatterHora.format(d);

    if (hoyIso === fechaIso) return `Hoy ${hora}`;

    const ayer = new Date(ahora.getTime() - 86400000);
    if (formatterDia.format(ayer) === fechaIso) return `Ayer ${hora}`;

    const formatterCorto = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
    });
    return `${formatterCorto.format(d)} ${hora}`;
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
};

const mapearEstacion = (area: { nombre: string } | null): string => {
  if (!area) return 'Cocina y barra';
  const nom = area.nombre.toLowerCase();
  if (nom.includes('barra') && nom.includes('cocina')) return 'Cocina y barra';
  if (nom.includes('barra')) return 'Solo barra';
  if (nom.includes('cocina')) return 'Solo cocina';
  return area.nombre;
};

const textoVista = (vista: string | null, area: { nombre: string } | null): string | null =>
  vista === 'SALON_VIVO' ? 'Salón en vivo' : vista === 'PANTALLA_LOCAL' ? 'Pedidos del local' : vista === 'COCINA' ? `Cocina · ${area ? area.nombre : 'todas las áreas'}` : null;

@Injectable()
export class PantallasService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditoria?: AuditoriaService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  async listar(q?: string, estacion?: string) {
    const dispositivos = await this.prisma.deviceKey.findMany({
      where: { tipo: 'TV' },
      include: { area: true },
      orderBy: { id: 'asc' },
    });

    const ahora = new Date();
    // Pendientes con el código vencido: ya no existen para el admin (se limpian al pedir otro código)
    const vigentes = dispositivos.filter((d) => !(d.codigo_vinculo && d.codigo_expira_en && d.codigo_expira_en < ahora));
    const items = vigentes.map((d) => {
      const est = mapearEstacion(d.area);
      const sufijoHash = d.llave_hash.slice(-4).toUpperCase();
      return {
        id: d.id.toString(),
        nombre: d.nombre,
        estacion: est,
        vista: textoVista(d.vista, d.area),
        areaId: d.area_id ? d.area_id.toString() : null,
        ultimaConexion: aFechaHoraLima(d.ultima_conexion),
        llave: `Termina en ...${sufijoHash}`,
        estado: d.activo ? 'Activa' : 'Inactiva',
        activo: d.activo,
        codigoVinculo: d.codigo_vinculo,
        creadoEn: d.creado_en.toISOString(),
      };
    });

    const termino = (q ?? '').toLowerCase().trim();
    const estFiltro = (estacion ?? '').trim();

    const filtrados = items.filter((it) => {
      if (estFiltro && estFiltro !== 'Todas' && it.estacion !== estFiltro) {
        return false;
      }
      if (termino) {
        const buscable = `${it.nombre} ${it.estacion} ${it.llave} ${it.estado}`.toLowerCase();
        if (!buscable.includes(termino)) return false;
      }
      return true;
    });

    return {
      total: filtrados.length,
      pantallas: filtrados,
      estaciones: ['Cocina y barra', 'Solo barra', 'Solo cocina'],
    };
  }

  async areas() {
    const areas = await this.prisma.areaCocina.findMany({
      orderBy: { id: 'asc' },
    });
    return areas.map((a) => ({
      id: a.id.toString(),
      nombre: a.nombre,
    }));
  }

  async vincular(
    dto: { codigo: string; nombre?: string; areaId?: string },
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const codigoLimpio = dto.codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (codigoLimpio.length < 6) {
      throw new HttpException(
        { codigo: 'CODIGO_INVALIDO', mensaje: 'Escribe el código completo que aparece en la TV (6 caracteres).' },
        HttpStatus.BAD_REQUEST,
      );
    }

    let areaIdBig: bigint | null = null;
    if (dto.areaId) {
      try {
        areaIdBig = BigInt(dto.areaId);
      } catch {
        areaIdBig = null;
      }
    }

    // Solo se vincula una TV que está mostrando ese código ahora (pendiente y sin vencer)
    const existente = await this.prisma.deviceKey.findFirst({
      where: { tipo: 'TV', codigo_vinculo: codigoLimpio, codigo_expira_en: { gt: new Date() } },
    });
    if (!existente) {
      throw new NotFoundException({ codigo: 'CODIGO_NO_ENCONTRADO', mensaje: 'No hay ninguna TV mostrando ese código' });
    }

    const actualizada = await this.prisma.deviceKey.update({
      where: { id: existente.id },
      data: {
        activo: true,
        nombre: dto.nombre?.trim() || existente.nombre,
        area_id: areaIdBig !== null ? areaIdBig : existente.area_id,
        codigo_vinculo: null,
        codigo_expira_en: null,
        ultima_conexion: new Date(),
      },
    });
    const pantallaId = actualizada.id;

    if (this.auditoria && usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'pantallas',
        accion: 'VINCULAR_PANTALLA',
        entidad: 'device_key',
        entidadId: pantallaId,
        partyId: usuario.partyId,
        despues: { codigo: codigoLimpio, nombre: dto.nombre },
        ip,
      });
    }

    this.eventos?.emitirAdmin('pantallas:actualizado', { id: pantallaId.toString() });

    return {
      ok: true,
      mensaje: `Pantalla vinculada con el código ${codigoLimpio}. El código ya no sirve; la TV entra sola en unos segundos.`,
    };
  }

  async cambiarEstado(id: string, activo: boolean, usuario?: UsuarioAutenticado, ip?: string) {
    let bigId: bigint;
    try {
      bigId = BigInt(id);
    } catch {
      throw new NotFoundException({ codigo: 'PANTALLA_NO_ENCONTRADA', mensaje: 'Pantalla no encontrada' });
    }

    const pantalla = await this.prisma.deviceKey.findUnique({ where: { id: bigId } });
    if (!pantalla || pantalla.tipo !== 'TV') {
      throw new NotFoundException({ codigo: 'PANTALLA_NO_ENCONTRADA', mensaje: 'Pantalla no encontrada' });
    }

    await this.prisma.deviceKey.update({
      where: { id: bigId },
      data: { activo },
    });

    if (this.auditoria && usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'pantallas',
        accion: activo ? 'ACTIVAR_PANTALLA' : 'DESACTIVAR_PANTALLA',
        entidad: 'device_key',
        entidadId: bigId,
        partyId: usuario.partyId,
        despues: { activo },
        ip,
      });
    }

    this.eventos?.emitirAdmin('pantallas:actualizado', { id });
    return { ok: true, activo };
  }

  async editar(id: string, data: { nombre?: string; areaId?: string }, usuario?: UsuarioAutenticado, ip?: string) {
    let bigId: bigint;
    try {
      bigId = BigInt(id);
    } catch {
      throw new NotFoundException({ codigo: 'PANTALLA_NO_ENCONTRADA', mensaje: 'Pantalla no encontrada' });
    }

    const pantalla = await this.prisma.deviceKey.findUnique({ where: { id: bigId } });
    if (!pantalla || pantalla.tipo !== 'TV') {
      throw new NotFoundException({ codigo: 'PANTALLA_NO_ENCONTRADA', mensaje: 'Pantalla no encontrada' });
    }

    const actualizacion: any = {};
    if (data.nombre !== undefined) {
      const nom = data.nombre.trim();
      if (!nom) throw new HttpException({ codigo: 'NOMBRE_REQUERIDO', mensaje: 'El nombre es obligatorio' }, HttpStatus.BAD_REQUEST);
      actualizacion.nombre = nom;
    }
    if (data.areaId !== undefined) {
      actualizacion.area_id = data.areaId ? BigInt(data.areaId) : null;
    }

    await this.prisma.deviceKey.update({
      where: { id: bigId },
      data: actualizacion,
    });

    if (this.auditoria && usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'pantallas',
        accion: 'EDITAR_PANTALLA',
        entidad: 'device_key',
        entidadId: bigId,
        partyId: usuario.partyId,
        despues: actualizacion,
        ip,
      });
    }

    this.eventos?.emitirAdmin('pantallas:actualizado', { id });
    return { ok: true };
  }
}
