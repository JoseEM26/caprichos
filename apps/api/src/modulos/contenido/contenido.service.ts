import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  ActualizarBorradorDisenoDto,
  ActualizarDestacadaDto,
  ActualizarNovedadDto,
  CrearDestacadaDto,
  CrearMensajeCartaDto,
  CrearNovedadDto,
  GuardarPaletaDto,
  TAMANOS_NOVEDAD,
} from './contenido.dto';

export const PAL_DEFAULT: Record<string, Record<string, string>> = {
  ninguno: {
    accent: '#E67929',
    on: '#0B2C3E',
    ink: '#0B2C3E',
    bg: '#FBF4EC',
    card: '#FFFFFF',
    price: '#B2500F',
    sec: '#D99E39',
    soft: '#2C4C5D',
    line: '#E3D6C6',
  },
  halloween: {
    accent: '#F2812A',
    on: '#2B1B3F',
    ink: '#2B1B3F',
    bg: '#F4ECF6',
    card: '#FCF8FD',
    price: '#A8460B',
    sec: '#9B6BD6',
    soft: '#4A3A66',
    line: '#DCCBE3',
  },
  navidad: {
    accent: '#C0392B',
    on: '#FFFFFF',
    ink: '#0F3D2B',
    bg: '#EEF6EE',
    card: '#FAFEF9',
    price: '#B22222',
    sec: '#2F7D4F',
    soft: '#2F5D45',
    line: '#C9DFCD',
  },
  anonuevo: {
    accent: '#F5C84B',
    on: '#14142B',
    ink: '#14142B',
    bg: '#FBF8EE',
    card: '#FFFEFA',
    price: '#8A5A00',
    sec: '#B58A1E',
    soft: '#4B4B6B',
    line: '#E8E1C8',
  },
  sanvalentin: {
    accent: '#D6336C',
    on: '#FFFFFF',
    ink: '#4A1020',
    bg: '#FFF0F3',
    card: '#FFFAFB',
    price: '#B3123F',
    sec: '#F2A1B5',
    soft: '#6B3A48',
    line: '#F0D0D8',
  },
  madre: {
    accent: '#C2417A',
    on: '#FFFFFF',
    ink: '#3B2A4A',
    bg: '#FFF2F7',
    card: '#FFFAFC',
    price: '#A93469',
    sec: '#C9A0DC',
    soft: '#5E4A70',
    line: '#EBD3E0',
  },
  padre: {
    accent: '#1F6FB5',
    on: '#FFFFFF',
    ink: '#0F2A44',
    bg: '#EEF4FA',
    card: '#FAFCFF',
    price: '#1C5FA3',
    sec: '#7FB3D5',
    soft: '#3A5570',
    line: '#D0DFEC',
  },
  patrias: {
    accent: '#C8102E',
    on: '#FFFFFF',
    ink: '#3A0A12',
    bg: '#FFF4F4',
    card: '#FFFFFF',
    price: '#B0122A',
    sec: '#E8A2AB',
    soft: '#6B3A41',
    line: '#F0D0D4',
  },
  ninos: {
    accent: '#FFC93C',
    on: '#1B3A5F',
    ink: '#1B3A5F',
    bg: '#FFF8E4',
    card: '#FFFDF5',
    price: '#B84F00',
    sec: '#7ED6A5',
    soft: '#3F5E80',
    line: '#F1E2B5',
  },
  aniversario: {
    accent: '#8E44AD',
    on: '#FFFFFF',
    ink: '#2E1A47',
    bg: '#F8F1FD',
    card: '#FEFBFF',
    price: '#7B2FA0',
    sec: '#D4A93C',
    soft: '#5B4678',
    line: '#E2D1EF',
  },
};

/** Ruta pública de un archivo guardado (misma regla que el catálogo: /archivos/<ruta>). */
function urlArchivo(ruta: string): string {
  if (/^(https?:|data:)/.test(ruta)) return ruta;
  if (ruta.startsWith('/archivos/')) return ruta;
  return `/archivos/${ruta.replace(/^\/+/, '')}`;
}

/** Tamaño del cuadro de una novedad; ausente o inválido cuenta como MEDIANO. */
function tamanoNovedad(valor?: string | null): string {
  return TAMANOS_NOVEDAD.includes(valor ?? '') ? (valor as string) : 'MEDIANO';
}

function extraerPieDeRuta(ruta?: string | null): string {
  if (!ruta) return '';
  const idx = ruta.indexOf('#');
  if (idx < 0) return '';
  const params = new URLSearchParams(ruta.slice(idx + 1));
  return params.get('pie') || '';
}

function extraerOffDeRuta(ruta?: string | null): boolean {
  if (!ruta) return false;
  const idx = ruta.indexOf('#');
  if (idx < 0) return false;
  const params = new URLSearchParams(ruta.slice(idx + 1));
  return params.get('off') === '1';
}

interface DestacadasMeta {
  activos: Record<string, boolean>;
  fotosMeta: Record<string, Array<{ id?: string; url: string; pie: string; orden: number }>>;
}

@Injectable()
export class ContenidoService {
  private readonly logger = new Logger(ContenidoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly eventosGateway: EventosGateway,
  ) {}

  // =========================================================================
  // CARTA PÚBLICA (GET /carta/contenido)
  // =========================================================================

  async obtenerContenidoPublicoCarta() {
    // 1. Versión publicada de la carta
    const versionPublicada = await this.prisma.versionCarta.findFirst({
      where: { estado: 'PUBLICADA' },
      orderBy: { id: 'desc' },
    });

    const decoracion = versionPublicada?.decoracion || 'NINGUNO';
    const organizacion = versionPublicada?.organizacion || 'SECCIONES';
    const contenidoConfig = (versionPublicada?.contenido as any) || {};

    // 2. Paleta activa
    const paramPaleta = await this.prisma.parametro.findUnique({
      where: { clave: 'carta_paleta_decoracion' },
    });
    const decoracionKey = decoracion.toLowerCase();
    const paletaBase = PAL_DEFAULT[decoracionKey] || PAL_DEFAULT.ninguno;
    const paletaGuardada = (paramPaleta?.valor as any)?.[decoracionKey] || (paramPaleta?.valor as any) || {};
    const paletaActiva = { ...paletaBase, ...paletaGuardada };

    // 3. Novedades activas y vigentes
    const hoy = new Date();
    const novedadesDb = await this.prisma.novedad.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      include: {
        fotos: {
          include: { archivo: true },
          orderBy: { orden: 'asc' },
        },
      },
    });

    const novedadesVigentes = novedadesDb.filter((n) => {
      if (n.desde && new Date(n.desde) > hoy) return false;
      if (n.hasta && new Date(n.hasta) < hoy) return false;
      return true;
    });

    const novedades = novedadesVigentes.map((n) => ({
      id: n.id.toString(),
      tipo: n.tipo,
      titulo: n.titulo,
      texto: n.texto,
      tema: n.tema,
      video_url: n.video_url,
      evento_fecha: n.evento_fecha,
      evento_lugar: n.evento_lugar,
      orden: n.orden,
      activo: n.activo,
      tamano: tamanoNovedad(n.tamano),
      fotos: n.fotos.map((f) => ({
        id: f.archivo.id.toString(),
        url: urlArchivo(f.archivo.ruta),
      })),
    }));

    // 4. Destacadas («Momentos Caprichos»)
    // Regla RN-CAP-064 / RQ-CON-03-08: Un círculo sin fotos o desactivado NO se ve en la carta
    const [destacadasDb, metaDestacadas] = await Promise.all([
      this.prisma.destacada.findMany({
        where: { archivada: false },
        orderBy: { orden: 'asc' },
        include: {
          fotos: {
            include: { archivo: true },
            orderBy: { orden: 'asc' },
          },
          portada_archivo: true,
        },
      }),
      this.leerMetaDestacadas(),
    ]);

    const destacadasConFotos = destacadasDb.filter((d) => {
      const idStr = d.id.toString();
      const activo =
        metaDestacadas.activos[idStr] !== undefined
          ? metaDestacadas.activos[idStr]
          : !extraerOffDeRuta(d.portada_archivo?.ruta);
      if (activo === false) return false;
      const fotosMeta = metaDestacadas.fotosMeta[idStr];
      const cantFotos = fotosMeta ? fotosMeta.length : d.fotos.length;
      return cantFotos > 0;
    });

    const destacadas = destacadasConFotos.map((d) => {
      const idStr = d.id.toString();
      const fotosMeta = metaDestacadas.fotosMeta[idStr];
      const fotos =
        fotosMeta && fotosMeta.length > 0
          ? fotosMeta.map((fm, idx) => ({
              id: fm.id || `${idStr}-${idx + 1}`,
              url: urlArchivo(fm.url),
              pie: fm.pie ?? extraerPieDeRuta(fm.url),
            }))
          : d.fotos.map((f) => ({
              id: f.archivo.id.toString(),
              url: urlArchivo(f.archivo.ruta),
              pie: extraerPieDeRuta(f.archivo.ruta),
            }));
      return {
        id: idStr,
        titulo: d.titulo,
        orden: d.orden,
        activo: true,
        portada_url: d.portada_archivo
          ? urlArchivo(d.portada_archivo.ruta)
          : fotos[0]?.url
          ? fotos[0].url
          : null,
        fotos,
      };
    });

    // 5. Ranking del mes actual (más vendidos con estrellas)
    // Regla RN-CAP-052 / RQ-CAR-03-01 / 03: tres estrellas al primero, una a los dos siguientes.
    // El administrador puede ocultar las estrellas.
    const paramEstrellas = await this.prisma.parametro.findUnique({
      where: { clave: 'carta_estrellas_visible' },
    });
    const estrellasVisibles = paramEstrellas ? (paramEstrellas.valor as any)?.visible !== false : true;

    const anioMesActual = new Date().toISOString().slice(0, 7);
    const rankingDb = await this.prisma.rankingMes.findMany({
      where: { anio_mes: anioMesActual },
      orderBy: { puesto: 'asc' },
      take: 3,
      include: { producto: true },
    });

    const rankingMes = rankingDb.map((r, index) => {
      const puesto = r.puesto ?? index + 1;
      return {
        productoId: r.producto_id.toString(),
        nombre: r.producto.nombre,
        unidades: r.unidades,
        puesto,
        estrellas: puesto === 1 ? 3 : 1,
        textoEstrellas: puesto === 1 ? '★★★ MÁS COMPRADO DEL MES' : '★ MÁS COMPRADO DEL MES',
      };
    });

    return {
      versionCarta: {
        id: versionPublicada?.id.toString() ?? '1',
        organizacion,
        decoracion,
        publicada_en: versionPublicada?.publicada_en ?? null,
        contenido: contenidoConfig,
      },
      decoracion,
      organizacion,
      paleta: paletaActiva,
      novedades,
      destacadas,
      rankingMes: estrellasVisibles ? rankingMes : [],
      estrellasVisibles,
      banner: contenidoConfig.banner ?? {
        activo: false,
        tag: '',
        title: '',
        sub: '',
      },
      promos: contenidoConfig.promos ?? [],
    };
  }

  // =========================================================================
  // COMENTARIO / BUZÓN DE LA CARTA (POST /carta/contenido/comentario)
  // =========================================================================

  async crearComentarioCarta(dto: CrearMensajeCartaDto) {
    const mensaje = await this.prisma.mensajeCarta.create({
      data: {
        tipo: dto.tipo,
        texto: dto.texto,
        nombre: dto.nombre || null,
        contacto: dto.contacto || null,
      },
    });

    // Regla RN-CAP-061 / RQ-CAR-03-07: una queja avisa al correo del dueño y genera notificación
    if (dto.tipo === 'QUEJA' || dto.tipo === 'RECLAMO') {
      try {
        await this.prisma.notificacion.create({
          data: {
            tipo: 'RECLAMO_CARTA',
            titulo: 'Nueva queja recibida en la carta',
            mensaje: `${dto.nombre || 'Cliente anónimo'}: ${dto.texto.slice(0, 120)}`,
            enlace: '/admin/mensajes',
          },
        });
      } catch (err) {
        this.logger.warn(`No se pudo crear notificación de queja: ${err}`);
      }
    }

    try {
      this.eventosGateway.emitirAdmin('carta:comentario', {
        id: mensaje.id.toString(),
        tipo: mensaje.tipo,
        nombre: mensaje.nombre,
      });
    } catch {
      // socket opcional
    }

    return {
      ok: true,
      id: mensaje.id.toString(),
      mensaje: '¡Gracias por escribirnos! Tu opinión nos ayuda a mejorar cada día.',
    };
  }

  // =========================================================================
  // ADMINISTRATIVO: DISEÑO DE LA CARTA (FT-CON-02)
  // =========================================================================

  async obtenerDisenoAdmin() {
    const [publicada, borrador, categoriasDb, productosDb] = await Promise.all([
      this.prisma.versionCarta.findFirst({
        where: { estado: 'PUBLICADA' },
        orderBy: { id: 'desc' },
      }),
      this.prisma.versionCarta.findFirst({
        where: { estado: 'BORRADOR' },
        orderBy: { id: 'desc' },
      }),
      this.prisma.categoria.findMany({
        orderBy: { orden: 'asc' },
      }),
      this.prisma.producto.findMany({
        orderBy: { orden: 'asc' },
        include: { foto_archivo: true },
      }),
    ]);

    const versionActiva = borrador || publicada;
    const tieneBorrador = !!borrador;

    // Listado de categorías y productos formateados
    const categorias = categoriasDb.map((c) => ({
      id: c.id.toString(),
      nombre: c.nombre,
      orden: c.orden,
      oculto: c.oculta,
    }));

    const productos = productosDb.map((p) => ({
      id: p.id.toString(),
      categoriaId: p.categoria_id.toString(),
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: Number(p.precio),
      orden: p.orden,
      oculto: p.oculto,
      fotoUrl: p.foto_archivo
        ? urlArchivo(p.foto_archivo.ruta)
        : null,
    }));

    return {
      publicada: publicada
        ? {
            id: publicada.id.toString(),
            estado: publicada.estado,
            organizacion: publicada.organizacion,
            decoracion: publicada.decoracion,
            contenido: publicada.contenido,
            publicada_en: publicada.publicada_en,
          }
        : null,
      borrador: borrador
        ? {
            id: borrador.id.toString(),
            estado: borrador.estado,
            organizacion: borrador.organizacion,
            decoracion: borrador.decoracion,
            contenido: borrador.contenido,
          }
        : null,
      tieneBorrador,
      organizacionActual: versionActiva?.organizacion || 'SECCIONES',
      decoracionActual: versionActiva?.decoracion || 'NINGUNO',
      contenidoActual: (versionActiva?.contenido as any) || {},
      categorias,
      productos,
    };
  }

  async guardarBorradorDiseno(dto: ActualizarBorradorDisenoDto, usuario?: UsuarioAutenticado) {
    const borradorExistente = await this.prisma.versionCarta.findFirst({
      where: { estado: 'BORRADOR' },
      orderBy: { id: 'desc' },
    });

    const publicada = await this.prisma.versionCarta.findFirst({
      where: { estado: 'PUBLICADA' },
      orderBy: { id: 'desc' },
    });

    const data = {
      estado: 'BORRADOR',
      organizacion: dto.organizacion || borradorExistente?.organizacion || publicada?.organizacion || 'SECCIONES',
      decoracion: dto.decoracion || borradorExistente?.decoracion || publicada?.decoracion || 'NINGUNO',
      contenido: dto.contenido || borradorExistente?.contenido || publicada?.contenido || {},
    };

    let guardado;
    if (borradorExistente) {
      guardado = await this.prisma.versionCarta.update({
        where: { id: borradorExistente.id },
        data,
      });
    } else {
      guardado = await this.prisma.versionCarta.create({
        data,
      });
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'carta_diseno',
      accion: 'GUARDAR_BORRADOR',
      resultado: 'OK',
      partyId: usuario?.partyId,
      despues: data,
    });

    return {
      ok: true,
      id: guardado.id.toString(),
      mensaje: 'Borrador guardado exitosamente',
    };
  }

  async publicarDiseno(usuario?: UsuarioAutenticado) {
    const borrador = await this.prisma.versionCarta.findFirst({
      where: { estado: 'BORRADOR' },
      orderBy: { id: 'desc' },
    });

    if (!borrador) {
      throw new BadRequestException('No hay cambios pendientes en borrador para publicar');
    }

    // Archivar versiones publicadas anteriores
    await this.prisma.versionCarta.updateMany({
      where: { estado: 'PUBLICADA' },
      data: { estado: 'ARCHIVADA' },
    });

    // Publicar el borrador
    const publicada = await this.prisma.versionCarta.update({
      where: { id: borrador.id },
      data: {
        estado: 'PUBLICADA',
        publicada_en: new Date(),
        publicada_por: usuario?.partyId ?? null,
      },
    });

    // Si el contenido trae reorden o actualizaciones de productos, aplicarlas
    const contenido = (borrador.contenido as any) || {};
    if (contenido.productosConfig && typeof contenido.productosConfig === 'object') {
      for (const [prodIdStr, conf] of Object.entries(contenido.productosConfig as Record<string, any>)) {
        try {
          const prodId = BigInt(prodIdStr);
          await this.prisma.producto.update({
            where: { id: prodId },
            data: {
              ...(conf.orden != null ? { orden: conf.orden } : {}),
              ...(conf.oculto != null ? { oculto: conf.oculto } : {}),
              ...(conf.precio != null ? { precio: conf.precio } : {}),
              ...(conf.nombre ? { nombre: conf.nombre } : {}),
              ...(conf.descripcion ? { descripcion: conf.descripcion } : {}),
            },
          });
        } catch {
          // Si el id no existe en base, continuar
        }
      }
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'carta_diseno',
      accion: 'PUBLICAR_CARTA',
      resultado: 'OK',
      partyId: usuario?.partyId,
      despues: { id: publicada.id.toString(), decoracion: publicada.decoracion },
    });

    try {
      this.eventosGateway.emitirAdmin('carta:actualizada', {
        id: publicada.id.toString(),
        decoracion: publicada.decoracion,
      });
    } catch {}

    return {
      ok: true,
      id: publicada.id.toString(),
      mensaje: 'Cambios de la carta publicados exitosamente',
    };
  }

  async descartarDiseno(usuario?: UsuarioAutenticado) {
    const borrador = await this.prisma.versionCarta.findFirst({
      where: { estado: 'BORRADOR' },
      orderBy: { id: 'desc' },
    });

    if (borrador) {
      await this.prisma.versionCarta.delete({
        where: { id: borrador.id },
      });
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'carta_diseno',
      accion: 'DESCARTAR_BORRADOR',
      resultado: 'OK',
      partyId: usuario?.partyId,
    });

    return {
      ok: true,
      mensaje: 'Cambios descartados. Se volvió a la versión publicada.',
    };
  }

  // =========================================================================
  // ADMINISTRATIVO: NOVEDADES Y PUBLICIDAD (FT-CON-03)
  // =========================================================================

  async listarNovedadesAdmin() {
    const novedades = await this.prisma.novedad.findMany({
      orderBy: { orden: 'asc' },
      include: {
        fotos: {
          include: { archivo: true },
          orderBy: { orden: 'asc' },
        },
      },
    });

    return novedades.map((n) => ({
      id: n.id.toString(),
      tipo: n.tipo,
      titulo: n.titulo,
      texto: n.texto,
      tema: n.tema,
      video_url: n.video_url,
      evento_fecha: n.evento_fecha,
      evento_lugar: n.evento_lugar,
      desde: n.desde,
      hasta: n.hasta,
      orden: n.orden,
      activo: n.activo,
      tamano: tamanoNovedad(n.tamano),
      fotos: n.fotos.map((f) => ({
        id: f.archivo.id.toString(),
        url: urlArchivo(f.archivo.ruta),
      })),
    }));
  }

  async crearNovedad(dto: CrearNovedadDto, usuario?: UsuarioAutenticado) {
    const maxOrden = await this.prisma.novedad.aggregate({ _max: { orden: true } });
    const nuevoOrden = dto.orden ?? (maxOrden._max.orden ?? 0) + 1;

    const creada = await this.prisma.novedad.create({
      data: {
        tipo: dto.tipo,
        titulo: dto.titulo,
        texto: dto.texto || null,
        tema: dto.tema || null,
        video_url: dto.video_url || null,
        evento_fecha: dto.evento_fecha ? new Date(dto.evento_fecha) : null,
        evento_lugar: dto.evento_lugar || null,
        desde: dto.desde ? new Date(dto.desde) : null,
        hasta: dto.hasta ? new Date(dto.hasta) : null,
        orden: nuevoOrden,
        activo: dto.activo ?? true,
        tamano: tamanoNovedad(dto.tamano),
      },
    });

    if (dto.fotos && dto.fotos.length > 0) {
      await this.asociarFotosNovedad(creada.id, dto.fotos);
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'novedades',
      accion: 'CREAR_NOVEDAD',
      resultado: 'OK',
      partyId: usuario?.partyId,
      despues: { id: creada.id.toString(), titulo: creada.titulo },
    });

    return {
      ok: true,
      id: creada.id.toString(),
      mensaje: 'Novedad creada exitosamente',
    };
  }

  async actualizarNovedad(id: string, dto: ActualizarNovedadDto, usuario?: UsuarioAutenticado) {
    const novedadId = BigInt(id);
    const existente = await this.prisma.novedad.findUnique({ where: { id: novedadId } });
    if (!existente) throw new NotFoundException('Novedad no encontrada');

    const data: any = {};
    if (dto.tipo !== undefined) data.tipo = dto.tipo;
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.texto !== undefined) data.texto = dto.texto;
    if (dto.tema !== undefined) data.tema = dto.tema;
    if (dto.video_url !== undefined) data.video_url = dto.video_url;
    if (dto.evento_fecha !== undefined) data.evento_fecha = dto.evento_fecha ? new Date(dto.evento_fecha) : null;
    if (dto.evento_lugar !== undefined) data.evento_lugar = dto.evento_lugar;
    if (dto.desde !== undefined) data.desde = dto.desde ? new Date(dto.desde) : null;
    if (dto.hasta !== undefined) data.hasta = dto.hasta ? new Date(dto.hasta) : null;
    if (dto.orden !== undefined) data.orden = dto.orden;
    if (dto.activo !== undefined) data.activo = dto.activo;
    if (dto.tamano !== undefined) data.tamano = tamanoNovedad(dto.tamano);

    await this.prisma.novedad.update({
      where: { id: novedadId },
      data,
    });

    if (dto.fotos !== undefined) {
      await this.prisma.novedadFoto.deleteMany({ where: { novedad_id: novedadId } });
      if (dto.fotos.length > 0) {
        await this.asociarFotosNovedad(novedadId, dto.fotos);
      }
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'novedades',
      accion: 'ACTUALIZAR_NOVEDAD',
      resultado: 'OK',
      partyId: usuario?.partyId,
      despues: { id, cambios: data },
    });

    return {
      ok: true,
      id,
      mensaje: 'Novedad actualizada exitosamente',
    };
  }

  async eliminarNovedad(id: string, usuario?: UsuarioAutenticado) {
    const novedadId = BigInt(id);
    const existente = await this.prisma.novedad.findUnique({ where: { id: novedadId } });
    if (!existente) throw new NotFoundException('Novedad no encontrada');

    // Las filas de novedad_foto se borran en cascada; los archivos se conservan.
    await this.prisma.novedad.delete({ where: { id: novedadId } });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'novedades',
      accion: 'ELIMINAR_NOVEDAD',
      resultado: 'OK',
      partyId: usuario?.partyId,
      antes: { id, titulo: existente.titulo, tipo: existente.tipo },
    });

    return { ok: true };
  }

  async publicarNovedades(usuario?: UsuarioAutenticado) {
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'novedades',
      accion: 'PUBLICAR_NOVEDADES',
      resultado: 'OK',
      partyId: usuario?.partyId,
    });

    try {
      this.eventosGateway.emitirAdmin('novedades:actualizadas', { timestamp: new Date() });
    } catch {}

    return {
      ok: true,
      mensaje: 'Novedades publicadas en la carta exitosamente',
    };
  }

  private async asociarFotosNovedad(novedadId: bigint, fotos: string[]) {
    let ord = 1;
    for (const f of fotos) {
      let archivo = await this.prisma.archivo.findFirst({ where: { ruta: f } });
      if (!archivo) {
        archivo = await this.prisma.archivo.create({
          data: {
            ruta: f,
            tipo_mime: 'image/webp',
            bytes: 1024,
            privado: false,
          },
        });
      }
      await this.prisma.novedadFoto.upsert({
        where: {
          novedad_id_archivo_id: {
            novedad_id: novedadId,
            archivo_id: archivo.id,
          },
        },
        update: { orden: ord },
        create: {
          novedad_id: novedadId,
          archivo_id: archivo.id,
          orden: ord,
        },
      });
      ord++;
    }
  }

  // =========================================================================
  // ADMINISTRATIVO: DESTACADAS DE LA CARTA (FT-CON-03)
  // =========================================================================

  private async leerMetaDestacadas(): Promise<DestacadasMeta> {
    const param = await this.prisma.parametro.findUnique({
      where: { clave: 'carta_destacadas_meta' },
    });
    const val = (param?.valor as any) || {};
    return {
      activos: val.activos && typeof val.activos === 'object' ? val.activos : {},
      fotosMeta: val.fotosMeta && typeof val.fotosMeta === 'object' ? val.fotosMeta : {},
    };
  }

  private async guardarMetaDestacadas(meta: DestacadasMeta): Promise<void> {
    await this.prisma.parametro.upsert({
      where: { clave: 'carta_destacadas_meta' },
      update: { valor: meta as any },
      create: { clave: 'carta_destacadas_meta', valor: meta as any },
    });
  }

  async listarDestacadasAdmin() {
    const [destacadas, meta] = await Promise.all([
      this.prisma.destacada.findMany({
        orderBy: { orden: 'asc' },
        include: {
          fotos: {
            include: { archivo: true },
            orderBy: { orden: 'asc' },
          },
          portada_archivo: true,
        },
      }),
      this.leerMetaDestacadas(),
    ]);

    return destacadas.map((d) => {
      const idStr = d.id.toString();
      const activo =
        meta.activos[idStr] !== undefined
          ? meta.activos[idStr]
          : !extraerOffDeRuta(d.portada_archivo?.ruta);
      const fotosMeta = meta.fotosMeta[idStr];
      const fotos =
        fotosMeta && fotosMeta.length > 0
          ? fotosMeta.map((fm, idx) => ({
              id: fm.id || `${idStr}-${idx + 1}`,
              url: urlArchivo(fm.url),
              pie: fm.pie ?? extraerPieDeRuta(fm.url),
            }))
          : d.fotos.map((f) => ({
              id: f.archivo.id.toString(),
              url: urlArchivo(f.archivo.ruta),
              pie: extraerPieDeRuta(f.archivo.ruta),
            }));
      return {
        id: idStr,
        titulo: d.titulo,
        orden: d.orden,
        activo,
        archivada: d.archivada,
        portada_url: d.portada_archivo
          ? urlArchivo(d.portada_archivo.ruta)
          : null,
        fotos,
      };
    });
  }

  async crearDestacada(dto: CrearDestacadaDto, usuario?: UsuarioAutenticado) {
    const maxOrden = await this.prisma.destacada.aggregate({ _max: { orden: true } });
    const nuevoOrden = dto.orden ?? (maxOrden._max.orden ?? 0) + 1;

    let portadaArchivoId: bigint | null = null;
    if (dto.portada_url) {
      let archivo = await this.prisma.archivo.findFirst({ where: { ruta: dto.portada_url } });
      if (!archivo) {
        archivo = await this.prisma.archivo.create({
          data: {
            ruta: dto.portada_url,
            tipo_mime: 'image/webp',
            bytes: 1024,
            privado: false,
          },
        });
      }
      portadaArchivoId = archivo.id;
    }

    const creada = await this.prisma.destacada.create({
      data: {
        titulo: dto.titulo,
        orden: nuevoOrden,
        portada_archivo_id: portadaArchivoId,
        archivada: false,
      },
    });

    if (dto.activo !== undefined) {
      const meta = await this.leerMetaDestacadas();
      meta.activos[creada.id.toString()] = dto.activo;
      await this.guardarMetaDestacadas(meta);
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'destacadas',
      accion: 'CREAR_DESTACADA',
      resultado: 'OK',
      partyId: usuario?.partyId,
      despues: { id: creada.id.toString(), titulo: creada.titulo },
    });

    return {
      ok: true,
      id: creada.id.toString(),
      mensaje: 'Destacada creada exitosamente',
    };
  }

  async actualizarDestacada(id: string, dto: ActualizarDestacadaDto, usuario?: UsuarioAutenticado) {
    const destacadaId = BigInt(id);
    const existente = await this.prisma.destacada.findUnique({ where: { id: destacadaId } });
    if (!existente) throw new NotFoundException('Destacada no encontrada');

    const data: any = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.orden !== undefined) data.orden = dto.orden;
    if (dto.archivada !== undefined) data.archivada = dto.archivada;

    if (dto.portada_url !== undefined) {
      if (dto.portada_url) {
        let archivo = await this.prisma.archivo.findFirst({ where: { ruta: dto.portada_url } });
        if (!archivo) {
          archivo = await this.prisma.archivo.create({
            data: { ruta: dto.portada_url, tipo_mime: 'image/webp', bytes: 1024, privado: false },
          });
        }
        data.portada_archivo_id = archivo.id;
      } else {
        data.portada_archivo_id = null;
      }
    }

    await this.prisma.destacada.update({
      where: { id: destacadaId },
      data,
    });

    let metaCambiada = false;
    const meta = await this.leerMetaDestacadas();
    if (dto.activo !== undefined) {
      meta.activos[id] = dto.activo;
      metaCambiada = true;
    }

    if (dto.fotos !== undefined) {
      await this.prisma.destacadaFoto.deleteMany({ where: { destacada_id: destacadaId } });
      let ord = 1;
      const vistos = new Set<string>();
      const fotosMetaList: Array<{ id?: string; url: string; pie: string; orden: number }> = [];
      for (const item of dto.fotos) {
        let archivo = await this.prisma.archivo.findFirst({ where: { ruta: item.url } });
        if (!archivo) {
          archivo = await this.prisma.archivo.create({
            data: { ruta: item.url, tipo_mime: 'image/webp', bytes: 1024, privado: false },
          });
        }
        const ordenItem = item.orden ?? ord++;
        fotosMetaList.push({
          id: archivo.id.toString(),
          url: item.url,
          pie: item.pie ?? extraerPieDeRuta(item.url),
          orden: ordenItem,
        });
        const keyArchivo = archivo.id.toString();
        if (!vistos.has(keyArchivo)) {
          vistos.add(keyArchivo);
          await this.prisma.destacadaFoto.create({
            data: {
              destacada_id: destacadaId,
              archivo_id: archivo.id,
              orden: ordenItem,
            },
          });
        }
      }
      meta.fotosMeta[id] = fotosMetaList;
      metaCambiada = true;
    }

    if (metaCambiada) {
      await this.guardarMetaDestacadas(meta);
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'destacadas',
      accion: 'ACTUALIZAR_DESTACADA',
      resultado: 'OK',
      partyId: usuario?.partyId,
      despues: { id, cambios: data },
    });

    return {
      ok: true,
      id,
      mensaje: 'Destacada actualizada exitosamente',
    };
  }

  async archivarDestacada(id: string, archivar = true, usuario?: UsuarioAutenticado) {
    const destacadaId = BigInt(id);
    await this.prisma.destacada.update({
      where: { id: destacadaId },
      data: { archivada: archivar },
    });

    if (!archivar) {
      const meta = await this.leerMetaDestacadas();
      meta.activos[id] = false;
      await this.guardarMetaDestacadas(meta);
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'destacadas',
      accion: archivar ? 'ARCHIVAR_DESTACADA' : 'RESTAURAR_DESTACADA',
      resultado: 'OK',
      partyId: usuario?.partyId,
      despues: { id, archivada: archivar },
    });

    return {
      ok: true,
      id,
      mensaje: archivar ? 'Destacada archivada' : 'Destacada restaurada',
    };
  }

  // DT-06: Excepción a la regla general: una destacada sí se puede eliminar físicamente
  async eliminarDestacada(id: string, usuario?: UsuarioAutenticado) {
    const destacadaId = BigInt(id);
    await this.prisma.destacada.delete({
      where: { id: destacadaId },
    });

    const meta = await this.leerMetaDestacadas();
    if (meta.activos[id] !== undefined || meta.fotosMeta[id] !== undefined) {
      delete meta.activos[id];
      delete meta.fotosMeta[id];
      await this.guardarMetaDestacadas(meta);
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'destacadas',
      accion: 'ELIMINAR_DESTACADA',
      resultado: 'OK',
      partyId: usuario?.partyId,
      despues: { id },
    });

    return {
      ok: true,
      mensaje: 'Destacada eliminada para siempre',
    };
  }

  async cargarFotosEjemplo(usuario?: UsuarioAutenticado) {
    const destacadas = await this.prisma.destacada.findMany({
      where: { archivada: false },
      orderBy: { orden: 'asc' },
    });

    const ejemplos = [
      ['publico/seed/americano.webp', 'publico/seed/canelatte_caramel.webp'],
      ['publico/seed/capriberry_vainilla.webp', 'publico/seed/chocolate_caliente.webp'],
      ['publico/seed/croissant_mantequilla.webp', 'publico/seed/dona_artesanal.webp'],
      ['publico/seed/frappe_cafe.webp', 'publico/seed/frappe_choco_lucuma.webp'],
      ['publico/seed/frappe_oreo.webp', 'publico/seed/latte_caramelo.webp'],
    ];

    let idx = 0;
    for (const d of destacadas) {
      const rutas = ejemplos[idx % ejemplos.length];
      idx++;
      let ord = 1;
      for (const r of rutas) {
        let archivo = await this.prisma.archivo.findFirst({ where: { ruta: r } });
        if (!archivo) {
          archivo = await this.prisma.archivo.create({
            data: { ruta: r, tipo_mime: 'image/webp', bytes: 2048, privado: false },
          });
        }
        await this.prisma.destacadaFoto.upsert({
          where: {
            destacada_id_archivo_id: {
              destacada_id: d.id,
              archivo_id: archivo.id,
            },
          },
          update: { orden: ord },
          create: {
            destacada_id: d.id,
            archivo_id: archivo.id,
            orden: ord,
          },
        });
        ord++;
      }
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'destacadas',
      accion: 'CARGAR_FOTOS_EJEMPLO',
      resultado: 'OK',
      partyId: usuario?.partyId,
    });

    return {
      ok: true,
      mensaje: 'Fotos de ejemplo cargadas en las destacadas',
    };
  }

  async publicarDestacadas(usuario?: UsuarioAutenticado) {
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'destacadas',
      accion: 'PUBLICAR_DESTACADAS',
      resultado: 'OK',
      partyId: usuario?.partyId,
    });

    try {
      this.eventosGateway.emitirAdmin('destacadas:actualizadas', { timestamp: new Date() });
    } catch {}

    return {
      ok: true,
      mensaje: 'Destacadas publicadas en la carta exitosamente',
    };
  }

  // =========================================================================
  // ADMINISTRATIVO: PALETA DE COLORES (FT-CON-02 / Paleta)
  // =========================================================================

  async obtenerPaletasAdmin() {
    const [publicada, borrador, paramPaleta, paramBorrador] = await Promise.all([
      this.prisma.versionCarta.findFirst({
        where: { estado: 'PUBLICADA' },
        orderBy: { id: 'desc' },
      }),
      this.prisma.versionCarta.findFirst({
        where: { estado: 'BORRADOR' },
        orderBy: { id: 'desc' },
      }),
      this.prisma.parametro.findUnique({
        where: { clave: 'carta_paleta_decoracion' },
      }),
      this.prisma.parametro.findUnique({
        where: { clave: 'carta_paleta_decoracion_borrador' },
      }),
    ]);

    const decoracionActiva = (borrador?.decoracion || publicada?.decoracion || 'NINGUNO').toLowerCase();
    const guardadas = (paramPaleta?.valor as any) || {};
    const borradorPaletas = (paramBorrador?.valor as any) || null;

    const tieneBorrador = !!paramBorrador;

    // Compilar los 10 temas
    const paletas: Record<string, Record<string, string>> = {};
    for (const [key, base] of Object.entries(PAL_DEFAULT)) {
      const g = borradorPaletas?.[key] || guardadas?.[key] || {};
      paletas[key] = { ...base, ...g };
    }

    let productoEjemplo: { categoria: string; nombre: string; sub: string; precio: string } | null = null;
    try {
      const prod = await this.prisma.producto?.findFirst?.({
        where: { nombre: 'FRAPPE OREO' },
        include: { categoria: true },
      });
      if (prod) {
        productoEjemplo = {
          categoria: prod.categoria?.nombre || 'Frappes',
          nombre: prod.nombre,
          sub: 'Disponible en 12, 16 y 21 oz',
          precio: `Desde s/ ${Number(prod.precio).toFixed(2)}`,
        };
      }
    } catch {
      // en tests sin mock de producto.findFirst
    }

    return {
      paletas,
      decoracionActiva,
      tieneBorrador,
      productoEjemplo,
    };
  }

  async guardarBorradorPaleta(dto: GuardarPaletaDto, usuario?: UsuarioAutenticado) {
    await this.prisma.parametro.upsert({
      where: { clave: 'carta_paleta_decoracion_borrador' },
      update: { valor: (dto.paletas as any) || {} },
      create: { clave: 'carta_paleta_decoracion_borrador', valor: (dto.paletas as any) || {} },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'paleta',
      accion: 'GUARDAR_BORRADOR_PALETA',
      resultado: 'OK',
      partyId: usuario?.partyId,
    });

    return {
      ok: true,
      mensaje: 'Borrador de colores guardado',
    };
  }

  async publicarPaleta(usuario?: UsuarioAutenticado) {
    const borrador = await this.prisma.parametro.findUnique({
      where: { clave: 'carta_paleta_decoracion_borrador' },
    });

    if (!borrador) {
      throw new BadRequestException('No hay cambios de paleta pendientes para publicar');
    }

    await this.prisma.parametro.upsert({
      where: { clave: 'carta_paleta_decoracion' },
      update: { valor: (borrador.valor as any) || {} },
      create: { clave: 'carta_paleta_decoracion', valor: (borrador.valor as any) || {} },
    });

    await this.prisma.parametro.delete({
      where: { clave: 'carta_paleta_decoracion_borrador' },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'paleta',
      accion: 'PUBLICAR_PALETA',
      resultado: 'OK',
      partyId: usuario?.partyId,
    });

    try {
      this.eventosGateway.emitirAdmin('paleta:actualizada', { timestamp: new Date() });
    } catch {}

    return {
      ok: true,
      mensaje: 'Colores publicados en la carta exitosamente',
    };
  }

  async descartarPaleta(usuario?: UsuarioAutenticado) {
    const borrador = await this.prisma.parametro.findUnique({
      where: { clave: 'carta_paleta_decoracion_borrador' },
    });

    if (borrador) {
      await this.prisma.parametro.delete({
        where: { clave: 'carta_paleta_decoracion_borrador' },
      });
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'paleta',
      accion: 'DESCARTAR_PALETA',
      resultado: 'OK',
      partyId: usuario?.partyId,
    });

    return {
      ok: true,
      mensaje: 'Cambios de colores descartados',
    };
  }

  // =========================================================================
  // ADMINISTRATIVO: MENSAJES Y BUZÓN DE OPINIONES (FT-CAR-03)
  // =========================================================================

  async listarMensajesAdmin() {
    const mensajes = await this.prisma.mensajeCarta.findMany({
      orderBy: { creado_en: 'desc' },
    });

    return mensajes.map((m) => ({
      id: m.id.toString(),
      tipo: m.tipo,
      texto: m.texto,
      nombre: m.nombre,
      contacto: m.contacto,
      creado_en: m.creado_en,
      atendido_en: m.atendido_en,
      atendido_por: m.atendido_por ? m.atendido_por.toString() : null,
      estado: m.atendido_en ? 'ATENDIDO' : 'NUEVO',
    }));
  }

  async atenderMensaje(id: string, usuario?: UsuarioAutenticado) {
    const mensajeId = BigInt(id);
    const mensaje = await this.prisma.mensajeCarta.findUnique({ where: { id: mensajeId } });
    if (!mensaje) throw new NotFoundException('Mensaje no encontrado');

    const actualizado = await this.prisma.mensajeCarta.update({
      where: { id: mensajeId },
      data: {
        atendido_en: new Date(),
        atendido_por: usuario?.partyId ?? null,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'mensajes_carta',
      accion: 'ATENDER_MENSAJE',
      resultado: 'OK',
      partyId: usuario?.partyId,
      despues: { id },
    });

    return {
      ok: true,
      id: actualizado.id.toString(),
      mensaje: 'Mensaje marcado como atendido',
    };
  }

  // =========================================================================
  // ADMINISTRATIVO: RANKING MENSUAL (FT-CAR-03)
  // =========================================================================

  async obtenerRankingAdmin() {
    const anioMesActual = new Date().toISOString().slice(0, 7);
    const rankings = await this.prisma.rankingMes.findMany({
      orderBy: [{ anio_mes: 'desc' }, { puesto: 'asc' }],
      include: { producto: true },
    });

    const paramEstrellas = await this.prisma.parametro.findUnique({
      where: { clave: 'carta_estrellas_visible' },
    });
    const estrellasVisibles = paramEstrellas ? (paramEstrellas.valor as any)?.visible !== false : true;

    return {
      anioMesActual,
      estrellasVisibles,
      ranking: rankings.map((r) => ({
        anio_mes: r.anio_mes,
        productoId: r.producto_id.toString(),
        nombre: r.producto.nombre,
        unidades: r.unidades,
        puesto: r.puesto,
      })),
    };
  }

  async toggleVisibilidadEstrellas(visible: boolean, usuario?: UsuarioAutenticado) {
    await this.prisma.parametro.upsert({
      where: { clave: 'carta_estrellas_visible' },
      update: { valor: { visible } },
      create: { clave: 'carta_estrellas_visible', valor: { visible } },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'carta_diseno',
      accion: 'TOGGLE_ESTRELLAS',
      resultado: 'OK',
      partyId: usuario?.partyId,
      despues: { visible },
    });

    return {
      ok: true,
      visible,
      mensaje: visible ? 'Estrellas activadas en la carta' : 'Estrellas ocultas en la carta',
    };
  }
}
