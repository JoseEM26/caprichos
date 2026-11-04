import { reglaEnvioGratis } from '@caprichos/compartido';
import { leerReglaEnvioGratis } from './envio-gratis';
import { promoEnvioGratisVigente } from '../ofertas/envio-gratis-promo';
import { ajustarAVecinas, areaSolapeM2, areaM2, recortarSolape, separacionM, SNAP_M_DEFECTO, solapeEntre } from '@caprichos/compartido';
import type { ResumenAjuste, SolapeZonas } from '@caprichos/compartido';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  ConflictoZona,
  Coordenada,
  DecisionConflictoZona,
  RespuestaConsultaEnvio,
  ZonaAdminItem,
  ZonaDetectada,
} from './zonas.tipos';
import { diagnosticarCobertura, DiagnosticoCobertura, puntoEnPoligono, validarPoligono } from './zonas.util';
import { EditarTarifaDto } from './dto/editar-tarifa.dto';
import { EditarActivaDto } from './dto/editar-activa.dto';
import { EditarPoligonoDto } from './dto/editar-poligono.dto';
import { EditarTiempoDto } from './dto/editar-tiempo.dto';

interface ZonaCache {
  id: bigint;
  codigo: string;
  tarifa: number;
  minutos: { min: number; max: number } | null;
  poligono: Coordenada[];
}

/** Rango de minutos guardado en la zona; null si la zona aún no lo tiene. */
function rangoMinutos(z: { minutos_min: number | null; minutos_max: number | null }) {
  return z.minutos_min != null && z.minutos_max != null ? { min: z.minutos_min, max: z.minutos_max } : null;
}

const SIN_AJUSTE: ResumenAjuste = { verticesAjustados: 0, verticesInsertados: 0, huecosCerrados: 0, huecoMaxM: 0, areaRecortadaM2: 0 };

interface ZonaNormalizar {
  fila: { id: bigint };
  id: string;
  codigo: string;
  tarifa: number;
  original: Coordenada[];
  poligono: Coordenada[];
  /** m² recortados por las decisiones de conflicto (antes del pegado). */
  recortadoM2: number;
  /** Textos de las decisiones que tocaron la zona, para la auditoría. */
  textos: string[];
  resumen: ResumenAjuste;
}

export interface ResultadoNormalizarZona {
  codigo: string;
  cambia: boolean;
  resumen: ResumenAjuste;
  puntosAntes: number;
  puntosDespues: number;
  areaAntesM2: number;
  areaDespuesM2: number;
}

/** Anillos [lat, lng] -> GeoJSON MultiPolygon ([lng, lat], cada anillo cerrado). */
function aMultiPoligono(anillos: Coordenada[][]): ConflictoZona['poligonoSolape'] {
  return {
    type: 'MultiPolygon',
    coordinates: anillos.map((r) => {
      const c = r.map(([lat, lng]): number[] => [lng, lat]);
      return [[...c, c[0]]];
    }),
  };
}

export interface DiagnosticoHuecos {
  toleranciaM: number;
  /** Pares de zonas activas separadas por menos de la tolerancia (se arreglan pegándolas) o más (informativo). */
  huecos: { zonaA: string; zonaB: string; metros: number; fino: boolean }[];
}

@Injectable()
export class ZonasService {
  private cacheZonasActivas: ZonaCache[] | null = null;
  private cacheExpiracion: number = 0;
  private diagnosticoCache: { clave: string; valor: DiagnosticoCobertura & DiagnosticoHuecos } | null = null;
  private readonly TTL_CACHE_MS = 60 * 1000; // 60 segundos

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Invalida la caché en memoria cuando se modifica cualquier zona.
   */
  invalidarCache(): void {
    this.cacheZonasActivas = null;
    this.cacheExpiracion = 0;
  }

  /**
   * Obtiene las zonas activas en memoria con TTL de 60 segundos.
   * Ordenadas por código ascendente para resolver superposiciones.
   */
  private async obtenerZonasActivas(): Promise<ZonaCache[]> {
    const ahora = Date.now();
    if (this.cacheZonasActivas && ahora < this.cacheExpiracion) {
      return this.cacheZonasActivas;
    }

    const zonas = await this.prisma.zonaReparto.findMany({
      where: { activa: true },
      orderBy: { codigo: 'asc' },
    });

    this.cacheZonasActivas = zonas.map((z) => ({
      id: z.id,
      codigo: z.codigo,
      tarifa: Number(z.tarifa),
      minutos: rangoMinutos(z),
      poligono: (z.poligono as unknown as Coordenada[]) || [],
    }));

    this.cacheExpiracion = ahora + this.TTL_CACHE_MS;
    return this.cacheZonasActivas;
  }

  /**
   * Detecta en qué zona de reparto activa cae el punto (lat, lng).
   * Si cae en varias zonas gana la de menor código.
   * Si cae fuera o la zona está inactiva devuelve null.
   */
  async detectar(lat: number, lng: number): Promise<ZonaDetectada | null> {
    const zonas = await this.obtenerZonasActivas();

    for (const zona of zonas) {
      if (puntoEnPoligono(lat, lng, zona.poligono)) {
        return {
          zonaId: zona.id,
          codigo: zona.codigo,
          tarifa: zona.tarifa,
          minutos: zona.minutos,
        };
      }
    }

    return null;
  }

  /**
   * Obtiene la tarifa actual de una zona por su ID.
   */
  async tarifaDe(zonaId: bigint | string | number): Promise<number> {
    const id = BigInt(zonaId);

    // Buscar en caché si está disponible
    if (this.cacheZonasActivas) {
      const enCache = this.cacheZonasActivas.find((z) => z.id === id);
      if (enCache) return enCache.tarifa;
    }

    const zona = await this.prisma.zonaReparto.findUnique({
      where: { id },
    });

    if (!zona) {
      throw new NotFoundException({
        codigo: 'ZONA_NO_ENCONTRADA',
        mensaje: 'La zona de reparto especificada no existe',
      });
    }

    return Number(zona.tarifa);
  }

  /**
   * Consulta pública de envío (GET /carta/envio?lat=&lng=).
   */
  async consultarEnvio(lat: number, lng: number): Promise<RespuestaConsultaEnvio> {
    if (
      lat === undefined ||
      lng === undefined ||
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new BadRequestException({
        codigo: 'PUNTO_INVALIDO',
        mensaje: 'La latitud o longitud no es válida o está fuera de rango',
      });
    }

    const zona = await this.detectar(lat, lng);

    let regla = reglaEnvioGratis(undefined, undefined);
    try {
      regla = await leerReglaEnvioGratis(this.prisma);
    } catch {
      // Sin parámetros legibles rige el valor por defecto (70, mas_de)
    }

    if (!zona) {
      return {
        cubierto: false,
        zona: null,
        minutos: null,
        tarifa: null,
        tarifaZona: null,
        gratisDesde: regla.monto,
        modoGratis: regla.modo,
        envioGratisPromo: null,
      };
    }

    // Promo ENVIO_GRATIS de la carta web (el pedido usa la misma regla); el monto mínimo lo compara el checkout
    const promo = await promoEnvioGratisVigente(this.prisma, 'CARTA');

    return {
      cubierto: true,
      zona: zona.codigo,
      minutos: zona.minutos,
      tarifa: zona.tarifa,
      tarifaZona: zona.tarifa,
      gratisDesde: regla.monto,
      modoGratis: regla.modo,
      envioGratisPromo: promo
        ? { nombre: promo.nombre, hasta: promo.hasta, compraMinima: promo.compraMinima }
        : null,
    };
  }

  // =========================================================================
  // ADMINISTRACIÓN (AccesoGuard + @Permiso zonas/ver y zonas/editar)
  // =========================================================================

  /**
   * Lista todas las zonas de reparto registradas.
   */
  async listarZonasAdmin(): Promise<ZonaAdminItem[]> {
    const zonas = await this.prisma.zonaReparto.findMany({
      orderBy: { codigo: 'asc' },
    });

    return zonas.map((z) => ({
      id: z.id.toString(),
      codigo: z.codigo,
      tarifa: Number(z.tarifa),
      minutosMin: z.minutos_min,
      minutosMax: z.minutos_max,
      activa: z.activa,
      puntos: Array.isArray(z.poligono) ? z.poligono.length : 0,
      poligono: z.poligono as unknown as Coordenada[],
    }));
  }

  /**
   * Edita los minutos típicos de entrega de una zona (enteros, 5 a 120, mínimo <= máximo).
   * Invalida la caché y deja la auditoría EDITAR_TIEMPO con antes y después.
   */
  async editarTiempo(
    codigo: string,
    dto: EditarTiempoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<ZonaAdminItem> {
    if (dto.minutosMin > dto.minutosMax) {
      throw new BadRequestException({
        codigo: 'TIEMPO_INVALIDO',
        mensaje: 'El tiempo mínimo no puede ser mayor que el máximo',
      });
    }

    const zona = await this.prisma.zonaReparto.findUnique({ where: { codigo } });
    if (!zona) {
      throw new NotFoundException({
        codigo: 'ZONA_NO_ENCONTRADA',
        mensaje: `No existe la zona de reparto con código ${codigo}`,
      });
    }

    const antes = { codigo, minutosMin: zona.minutos_min, minutosMax: zona.minutos_max };
    const updated = await this.prisma.zonaReparto.update({
      where: { codigo },
      data: { minutos_min: dto.minutosMin, minutos_max: dto.minutosMax },
    });

    this.invalidarCache();

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'zonas',
      accion: 'EDITAR_TIEMPO',
      resultado: 'OK',
      entidad: 'zona_reparto',
      entidadId: zona.id,
      antes,
      despues: { codigo, minutosMin: dto.minutosMin, minutosMax: dto.minutosMax },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      codigo: updated.codigo,
      tarifa: Number(updated.tarifa),
      minutosMin: updated.minutos_min,
      minutosMax: updated.minutos_max,
      activa: updated.activa,
      puntos: Array.isArray(updated.poligono) ? updated.poligono.length : 0,
      poligono: updated.poligono as unknown as Coordenada[],
    };
  }

  /**
   * Actualiza la tarifa de una zona de reparto.
   */
  async editarTarifa(
    codigo: string,
    dto: EditarTarifaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<ZonaAdminItem> {
    if (dto.tarifa === undefined || dto.tarifa < 0) {
      throw new BadRequestException({
        codigo: 'TARIFA_INVALIDA',
        mensaje: 'La tarifa debe ser un número mayor o igual a 0',
      });
    }

    const zona = await this.prisma.zonaReparto.findUnique({
      where: { codigo },
    });

    if (!zona) {
      throw new NotFoundException({
        codigo: 'ZONA_NO_ENCONTRADA',
        mensaje: `No existe la zona de reparto con código ${codigo}`,
      });
    }

    const tarifaAnterior = Number(zona.tarifa);
    const updated = await this.prisma.zonaReparto.update({
      where: { codigo },
      data: { tarifa: dto.tarifa },
    });

    this.invalidarCache();

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'zonas',
      accion: 'EDITAR_TARIFA',
      resultado: 'OK',
      entidad: 'zona_reparto',
      entidadId: zona.id,
      antes: { codigo, tarifa: tarifaAnterior },
      despues: { codigo, tarifa: dto.tarifa },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      codigo: updated.codigo,
      tarifa: Number(updated.tarifa),
      activa: updated.activa,
      puntos: Array.isArray(updated.poligono) ? updated.poligono.length : 0,
      poligono: updated.poligono as unknown as Coordenada[],
    };
  }

  /**
   * Activa o desactiva una zona de reparto.
   */
  async editarActiva(
    codigo: string,
    dto: EditarActivaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<ZonaAdminItem> {
    const zona = await this.prisma.zonaReparto.findUnique({
      where: { codigo },
    });

    if (!zona) {
      throw new NotFoundException({
        codigo: 'ZONA_NO_ENCONTRADA',
        mensaje: `No existe la zona de reparto con código ${codigo}`,
      });
    }

    const activaAnterior = zona.activa;
    const updated = await this.prisma.zonaReparto.update({
      where: { codigo },
      data: { activa: dto.activa },
    });

    this.invalidarCache();

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'zonas',
      accion: 'EDITAR_ESTADO',
      resultado: 'OK',
      entidad: 'zona_reparto',
      entidadId: zona.id,
      antes: { codigo, activa: activaAnterior },
      despues: { codigo, activa: dto.activa },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      codigo: updated.codigo,
      tarifa: Number(updated.tarifa),
      activa: updated.activa,
      puntos: Array.isArray(updated.poligono) ? updated.poligono.length : 0,
      poligono: updated.poligono as unknown as Coordenada[],
    };
  }

  /**
   * Actualiza el polígono de una zona de reparto con validación estricta.
   * Si no es válido, mantiene el polígono original y lanza 400 POLIGONO_INVALIDO.
   */
  async editarPoligono(
    codigo: string,
    dto: EditarPoligonoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<ZonaAdminItem & { avisos?: string[]; ajuste?: ResumenAjuste | null }> {
    const validacion = validarPoligono(dto.poligono);
    if (!validacion.valido) {
      throw new BadRequestException({
        codigo: 'POLIGONO_INVALIDO',
        mensaje: validacion.motivo || 'El polígono no es válido',
      });
    }

    const zona = await this.prisma.zonaReparto.findUnique({
      where: { codigo },
    });

    if (!zona) {
      throw new NotFoundException({
        codigo: 'ZONA_NO_ENCONTRADA',
        mensaje: `No existe la zona de reparto con código ${codigo}`,
      });
    }

    // Solo las zonas activas participan: una inactiva se guarda tal cual.
    let poligono = dto.poligono;
    let ajuste: ResumenAjuste | null = null;
    if (zona.activa) {
      const tol = await this.toleranciaSnapM();
      const vecinas = await this.vecinasActivas(codigo);
      // 1) pegado de vértices y lados, sin recortar; 2) si aún solapa más que la tolerancia, se rechaza
      const pegado = ajustarAVecinas(dto.poligono, vecinas.map((v) => v.poligono), tol, { recortar: false });
      const conflictos = this.solapesCon(pegado.poligono, vecinas);
      if (conflictos.length > 0) {
        throw new ConflictException({
          codigo: 'ZONA_SOLAPADA',
          mensaje: `El área se solapa con ${conflictos.map((c) => `la zona ${c.nombre}`).join(', ')}. Ajusta el borde o usa «Pegar a zonas vecinas».`,
          detalle: conflictos,
        });
      }
      // 3) lo que quede por debajo de la tolerancia se recorta: cero solape
      const final = ajustarAVecinas(pegado.poligono, vecinas.map((v) => v.poligono), tol);
      poligono = final.poligono;
      ajuste = {
        ...final.resumen,
        verticesAjustados: pegado.resumen.verticesAjustados,
        verticesInsertados: pegado.resumen.verticesInsertados,
        huecosCerrados: pegado.resumen.huecosCerrados,
        huecoMaxM: pegado.resumen.huecoMaxM,
      };
    }

    return this.guardarPoligono(zona, poligono, ajuste, dto.motivo, usuario, ip);
  }

  private async guardarPoligono(
    zona: { id: bigint; codigo: string; poligono: unknown },
    poligono: Coordenada[],
    ajuste: ResumenAjuste | null,
    motivo: string | undefined,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<ZonaAdminItem & { avisos?: string[]; ajuste?: ResumenAjuste | null }> {
    const puntosAnteriores = Array.isArray(zona.poligono) ? zona.poligono.length : 0;
    const updated = await this.prisma.zonaReparto.update({
      where: { codigo: zona.codigo },
      data: { poligono: poligono as any },
    });

    this.invalidarCache();

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'zonas',
      accion: 'EDITAR_POLIGONO',
      resultado: 'OK',
      entidad: 'zona_reparto',
      entidadId: zona.id,
      antes: { codigo: zona.codigo, puntos: puntosAnteriores },
      despues: { codigo: zona.codigo, puntos: poligono.length, ...(motivo ? { motivo } : {}), ...(ajuste ? { ajuste } : {}) },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      codigo: updated.codigo,
      tarifa: Number(updated.tarifa),
      activa: updated.activa,
      puntos: poligono.length,
      poligono: updated.poligono as unknown as Coordenada[],
      avisos: [],
      ajuste,
    };
  }

  /** Metros de pegado entre zonas (parámetro zonas_snap_m, 15 por defecto). */
  async toleranciaSnapM(): Promise<number> {
    try {
      const p = await this.prisma.parametro.findUnique({ where: { clave: 'zonas_snap_m' } });
      const n = Number(p?.valor);
      return Number.isFinite(n) && n > 0 ? n : SNAP_M_DEFECTO;
    } catch {
      return SNAP_M_DEFECTO;
    }
  }

  private async vecinasActivas(excluirCodigo: string) {
    const filas = (await this.prisma.zonaReparto.findMany({ where: { activa: true }, orderBy: { id: 'asc' } })) || [];
    return filas
      .filter((z) => z.codigo !== excluirCodigo && Array.isArray(z.poligono) && z.poligono.length >= 3)
      .map((z) => ({ id: z.id.toString(), nombre: z.codigo, poligono: z.poligono as unknown as Coordenada[] }));
  }

  /** Zonas con las que el polígono se solapa más que la tolerancia (1 m² o 0,01 % del área menor). */
  private solapesCon(poligono: Coordenada[], vecinas: { id: string; nombre: string; poligono: Coordenada[] }[]) {
    const out: { zonaId: string; nombre: string; areaM2: number }[] = [];
    for (const v of vecinas) {
      const a = areaSolapeM2(poligono, v.poligono);
      const tolerancia = Math.max(1, 0.0001 * Math.min(areaM2(poligono), areaM2(v.poligono)));
      if (a > tolerancia) out.push({ zonaId: v.id, nombre: v.nombre, areaM2: Math.round(a * 10) / 10 });
    }
    return out;
  }

  /**
   * Pegado automático a todas las zonas activas. Primero resuelve los conflictos (zonas que ya se solapan):
   * `decisiones` dice qué zona se queda el área compartida; con `confirmar` cada conflicto debe tener una.
   * Después pega como siempre, en orden de id. Con `confirmar` falso solo calcula (vista previa). Todo se
   * guarda en una transacción y cada zona cambiada queda auditada con motivo «Pegado automático».
   */
  async normalizarZonas(confirmar: boolean, usuario?: UsuarioAutenticado, ip?: string, decisiones: DecisionConflictoZona[] = []) {
    const tol = await this.toleranciaSnapM();
    const filas = (await this.prisma.zonaReparto.findMany({ where: { activa: true }, orderBy: { id: 'asc' } })) || [];
    const zonas: ZonaNormalizar[] = filas
      .filter((z) => Array.isArray(z.poligono) && z.poligono.length >= 3)
      .map((z) => {
        const original = z.poligono as unknown as Coordenada[];
        return { fila: z, id: z.id.toString(), codigo: z.codigo, tarifa: Number(z.tarifa), original, poligono: original, recortadoM2: 0, textos: [], resumen: SIN_AJUSTE };
      });

    // Conflictos sobre la geometría actual: pares que solapan más que la tolerancia (1 m² o 0,01 % del área menor)
    const conflictos: { a: ZonaNormalizar; b: ZonaNormalizar; solape: SolapeZonas }[] = [];
    for (let i = 0; i < zonas.length; i++)
      for (let j = i + 1; j < zonas.length; j++) {
        const solape = solapeEntre(zonas[i].poligono, zonas[j].poligono);
        const tolerancia = Math.max(1, 0.0001 * Math.min(areaM2(zonas[i].poligono), areaM2(zonas[j].poligono)));
        if (solape.areaM2 > tolerancia) conflictos.push({ a: zonas[i], b: zonas[j], solape });
      }

    const decisionDe = (c: { a: ZonaNormalizar; b: ZonaNormalizar }) =>
      decisiones.find(
        (d) => (d.zonaAId === c.a.id && d.zonaBId === c.b.id) || (d.zonaAId === c.b.id && d.zonaBId === c.a.id),
      );
    for (const c of conflictos) {
      const d = decisionDe(c);
      if (d && d.conserva !== c.a.id && d.conserva !== c.b.id) {
        throw new BadRequestException({
          codigo: 'DECISION_INVALIDA',
          mensaje: `La zona que se queda el área entre ${c.a.codigo} y ${c.b.codigo} debe ser una de las dos.`,
        });
      }
    }
    const pendientes = conflictos.filter((c) => !decisionDe(c));
    if (confirmar && pendientes.length > 0) {
      throw new BadRequestException({
        codigo: 'DECISION_REQUERIDA',
        mensaje: `Falta decidir qué zona se queda el área compartida en ${pendientes.length} ${pendientes.length === 1 ? 'conflicto' : 'conflictos'}.`,
        pendientes: pendientes.map((c) => ({ zonaAId: c.a.id, zonaBId: c.b.id, nombreA: c.a.codigo, nombreB: c.b.codigo })),
      });
    }

    // Recorte de los conflictos decididos: la zona que no se queda pierde el área compartida
    for (const c of conflictos) {
      const d = decisionDe(c);
      if (!d) continue;
      const ganadora = d.conserva === c.a.id ? c.a : c.b;
      const perdedora = ganadora === c.a ? c.b : c.a;
      const nuevo = recortarSolape(perdedora.poligono, ganadora.poligono);
      if (!nuevo) {
        throw new ConflictException({
          codigo: 'ZONA_NO_RECORTABLE',
          mensaje: `No se puede recortar ${perdedora.codigo} sin dejar un hueco: ${ganadora.codigo} queda dentro de ella. Ajusta las zonas a mano.`,
        });
      }
      const texto = `conserva ${ganadora.codigo} el área compartida con ${perdedora.codigo}, S/ ${ganadora.tarifa.toFixed(2)} frente a S/ ${perdedora.tarifa.toFixed(2)}`;
      perdedora.poligono = nuevo;
      perdedora.recortadoM2 += c.solape.areaM2;
      perdedora.textos.push(texto);
      ganadora.textos.push(texto);
    }

    // Pegado de siempre; las siguientes zonas se ajustan contra la geometría ya normalizada
    const resultado: ResultadoNormalizarZona[] = [];
    for (const z of zonas) {
      const otras = zonas.filter((o) => o !== z).map((o) => o.poligono);
      const r = ajustarAVecinas(z.poligono, otras, tol);
      if (r.cambio) z.poligono = r.poligono;
      z.resumen = {
        ...(r.cambio ? r.resumen : SIN_AJUSTE),
        areaRecortadaM2: Math.round((z.recortadoM2 + (r.cambio ? r.resumen.areaRecortadaM2 : 0)) * 10) / 10,
      };
      resultado.push({
        codigo: z.codigo,
        cambia: JSON.stringify(z.poligono) !== JSON.stringify(z.original),
        resumen: z.resumen,
        puntosAntes: z.original.length,
        puntosDespues: z.poligono.length,
        areaAntesM2: Math.round(areaM2(z.original) * 10) / 10,
        areaDespuesM2: Math.round(areaM2(z.poligono) * 10) / 10,
      });
    }

    if (confirmar) {
      const cambios = zonas.filter((z) => JSON.stringify(z.poligono) !== JSON.stringify(z.original));
      if (cambios.length > 0) {
        await this.prisma.$transaction(async (tx) => {
          for (const z of cambios) {
            await tx.zonaReparto.update({ where: { codigo: z.codigo }, data: { poligono: z.poligono as any } });
          }
        });
        this.invalidarCache();
        for (const z of cambios) {
          await this.auditoria.registrar({
            categoria: 'CAMBIO',
            modulo: 'zonas',
            accion: 'EDITAR_POLIGONO',
            resultado: 'OK',
            entidad: 'zona_reparto',
            entidadId: z.fila.id,
            antes: { codigo: z.codigo, puntos: z.original.length },
            despues: {
              codigo: z.codigo,
              puntos: z.poligono.length,
              motivo: 'Pegado automático',
              ajuste: z.resumen,
              ...(z.textos.length > 0 ? { decisiones: z.textos } : {}),
            },
            partyId: usuario?.partyId,
            ip,
          });
        }
      }
    }

    return {
      aplicado: confirmar,
      toleranciaM: tol,
      zonas: resultado,
      conflictos: conflictos.map((c) => ({
        zonaAId: c.a.id,
        zonaBId: c.b.id,
        nombreA: c.a.codigo,
        nombreB: c.b.codigo,
        areaM2: Math.round(c.solape.areaM2 * 10) / 10,
        tarifaA: c.a.tarifa,
        tarifaB: c.b.tarifa,
        poligonoSolape: aMultiPoligono(c.solape.anillos),
      })),
    };
  }

  /**
   * Diagnóstico de cobertura: solapes entre zonas activas (gana la de menor código) y polígonos inválidos.
   */
  async diagnosticoCobertura(): Promise<DiagnosticoCobertura & DiagnosticoHuecos> {
    const zonas = await this.prisma.zonaReparto.findMany({ orderBy: { codigo: 'asc' } });
    const entrada = zonas.map((z) => ({
      codigo: z.codigo,
      activa: z.activa,
      poligono: (Array.isArray(z.poligono) ? z.poligono : []) as unknown as Coordenada[],
    }));
    // ponytail: el cálculo de solapes es costoso (malla de 3 m por par). Se recalcula solo si cambia
    // algún polígono o estado; si crecen las zonas, pasar a recorte de polígonos.
    const clave = JSON.stringify(entrada);
    if (this.diagnosticoCache?.clave === clave) return this.diagnosticoCache.valor;
    const base = diagnosticarCobertura(entrada);
    const valor = { ...base, ...(await this.huecosEntreZonas(entrada)) };
    this.diagnosticoCache = { clave, valor };
    return valor;
  }

  private async huecosEntreZonas(zonas: { codigo: string; activa: boolean; poligono: Coordenada[] }[]): Promise<DiagnosticoHuecos> {
    const toleranciaM = await this.toleranciaSnapM();
    const activas = zonas.filter((z) => z.activa && validarPoligono(z.poligono).valido);
    const huecos: DiagnosticoHuecos['huecos'] = [];
    for (let i = 0; i < activas.length; i++)
      for (let j = i + 1; j < activas.length; j++) {
        const m = separacionM(activas[i].poligono, activas[j].poligono);
        // 0,02 m o menos es borde compartido; hasta 100 m se informa (los más lejanos no son vecinas)
        if (m > 0.02 && m <= 100) {
          huecos.push({ zonaA: activas[i].codigo, zonaB: activas[j].codigo, metros: Math.round(m * 10) / 10, fino: m <= toleranciaM });
        }
      }
    return { toleranciaM, huecos };
  }

  /**
   * Cambios de una zona (tarifa, estado y polígono) leídos de la auditoría, del más reciente al más antiguo.
   */
  async historialZona(codigo: string) {
    const zona = await this.prisma.zonaReparto.findUnique({ where: { codigo } });
    if (!zona) {
      throw new NotFoundException({
        codigo: 'ZONA_NO_ENCONTRADA',
        mensaje: `No existe la zona de reparto con código ${codigo}`,
      });
    }

    const filas = await this.prisma.auditoria.findMany({
      where: { modulo: 'zonas', entidad: 'zona_reparto', entidad_id: zona.id },
      orderBy: { en: 'desc' },
      take: 50,
      select: { id: true, accion: true, en: true, party_id: true, antes: true, despues: true },
    });

    return filas.map((f) => ({
      id: f.id.toString(),
      accion: f.accion,
      en: f.en.toISOString(),
      partyId: f.party_id !== null ? f.party_id.toString() : null,
      antes: f.antes,
      despues: f.despues,
    }));
  }
}
