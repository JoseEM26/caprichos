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
  CategoriaCarta,
  ProductoCarta,
} from './catalogo.tipos';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { EditarProductoDto } from './dto/editar-producto.dto';
import { AgotarDto } from './dto/agotar.dto';
import { ActualizarCategoriaDto } from './dto/categoria.dto';
import { FiltrarProductosDto } from './dto/filtrar-productos.dto';

export function normalizarTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function estaDisponible(agotadoHasta: Date | string | null | undefined): boolean {
  if (!agotadoHasta) return true;
  if (typeof agotadoHasta === 'string' && agotadoHasta.toLowerCase() === 'infinity') {
    return false;
  }
  const fecha = new Date(agotadoHasta);
  if (isNaN(fecha.getTime())) return false;
  return fecha.getTime() <= Date.now();
}

export function obtenerFotoUrl(archivo?: { ruta: string } | null): string | null {
  if (!archivo?.ruta) return null;
  if (archivo.ruta.startsWith('http://') || archivo.ruta.startsWith('https://')) {
    return archivo.ruta;
  }
  const limpia = archivo.ruta.replace(/^\/+/, '');
  return `/archivos/${limpia}`;
}

@Injectable()
export class CatalogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private parsearId(id: bigint | string | number): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'El identificador no es válido',
      });
    }
  }

  // =========================================================================
  // 1. CARTA PÚBLICA (GET /carta)
  // =========================================================================

  async obtenerCarta(q?: string): Promise<CategoriaCarta[]> {
    const categorias = await this.prisma.categoria.findMany({
      where: { oculta: false },
      orderBy: { orden: 'asc' },
      include: {
        productos: {
          where: { oculto: false },
          orderBy: { orden: 'asc' },
          include: {
            foto_archivo: true,
            tamanos: {
              where: { activo: true },
              include: { tamano_valor: true },
              orderBy: { tamano_valor: { orden: 'asc' } },
            },
            grupos: {
              orderBy: { orden: 'asc' },
              include: {
                grupo: {
                  include: {
                    opciones: {
                      where: { activo: true },
                      include: { valor: true },
                      orderBy: { valor: { orden: 'asc' } },
                    },
                  },
                },
              },
            },
            sabores: {
              where: { activo: true },
              orderBy: { nombre: 'asc' },
            },
          },
        },
      },
    });

    const terminosBusqueda = q && q.trim() ? normalizarTexto(q).split(/\s+/).filter(Boolean) : [];

    const resultado: CategoriaCarta[] = [];

    for (const cat of categorias) {
      const productosCarta: ProductoCarta[] = [];

      for (const p of cat.productos) {
        // Filtro de búsqueda ?q= sin tildes ni mayúsculas por nombre o descripción (RQ-CAR-01-03)
        if (terminosBusqueda.length > 0) {
          const textoCompleto = normalizarTexto(`${p.nombre} ${p.descripcion || ''}`);
          const coincide = terminosBusqueda.every((termino) => textoCompleto.includes(termino));
          if (!coincide) {
            continue;
          }
        }

        const disponible = estaDisponible(p.agotado_hasta);
        const agotadoHasta =
          p.agotado_hasta && !disponible
            ? p.agotado_hasta.toISOString()
            : null;

        const tamanos = (p.tamanos || []).map((t) => ({
          id: t.id.toString(),
          nombre: t.tamano_valor?.nombre || '',
          precio: Number(Number(t.precio).toFixed(2)),
        }));

        const grupos = (p.grupos || [])
          .filter((pg) => pg.grupo && pg.grupo.activo)
          .map((pg) => ({
            id: pg.grupo.id.toString(),
            nombre: pg.grupo.nombre,
            obligatorio: pg.grupo.obligatorio,
            minimo: pg.grupo.minimo,
            maximo: pg.grupo.maximo,
            opciones: (pg.grupo.opciones || [])
              .filter((o) => o.activo)
              .map((o) => ({
                id: o.id.toString(),
                nombre: o.valor?.nombre || '',
                precioExtra: Number(Number(o.precio_extra).toFixed(2)),
                disponible: estaDisponible(o.agotado_hasta),
              })),
          }));

        const sabores = (p.sabores || [])
          .filter((s) => s.activo)
          .map((s) => ({
            id: s.id.toString(),
            nombre: s.nombre,
            disponible: estaDisponible(s.agotado_hasta),
          }));

        productosCarta.push({
          id: p.id.toString(),
          nombre: p.nombre,
          descripcion: p.descripcion,
          fotoUrl: obtenerFotoUrl(p.foto_archivo),
          precio: Number(Number(p.precio).toFixed(2)),
          tamanos,
          grupos,
          sabores,
          noSumaBeneficios: p.no_suma_beneficios,
          disponible,
          agotadoHasta,
        });
      }

      // Si hay búsqueda activa y la categoría no tiene productos coincidentes, se omite
      if (terminosBusqueda.length > 0 && productosCarta.length === 0) {
        continue;
      }

      resultado.push({
        id: cat.id.toString(),
        nombre: cat.nombre,
        orden: cat.orden,
        productos: productosCarta,
      });
    }

    return resultado;
  }

  // =========================================================================
  // 2. PRODUCTOS (ADMIN)
  // =========================================================================

  async listarProductosAdmin(filtros: FiltrarProductosDto) {
    const where: any = {};

    if (filtros.incluyeOcultos === false) {
      where.oculto = false;
    }

    if (filtros.categoria) {
      try {
        const catId = BigInt(filtros.categoria);
        where.categoria_id = catId;
      } catch {
        where.categoria = { nombre: { contains: filtros.categoria, mode: 'insensitive' } };
      }
    }

    const busqueda = filtros.busqueda || filtros.q;
    if (busqueda && busqueda.trim()) {
      where.OR = [
        { nombre: { contains: busqueda.trim(), mode: 'insensitive' } },
        { descripcion: { contains: busqueda.trim(), mode: 'insensitive' } },
      ];
    }

    const productos = await this.prisma.producto.findMany({
      where,
      orderBy: [{ categoria: { orden: 'asc' } }, { orden: 'asc' }],
      include: {
        categoria: true,
        foto_archivo: true,
        tamanos: {
          include: { tamano_valor: true },
          orderBy: { tamano_valor: { orden: 'asc' } },
        },
        grupos: {
          orderBy: { orden: 'asc' },
          include: {
            grupo: {
              include: {
                opciones: {
                  include: { valor: true },
                  orderBy: { valor: { orden: 'asc' } },
                },
              },
            },
          },
        },
        sabores: {
          orderBy: { nombre: 'asc' },
        },
      },
    });

    return productos.map((p) => ({
      id: p.id.toString(),
      categoriaId: p.categoria_id.toString(),
      categoria: {
        id: p.categoria.id.toString(),
        nombre: p.categoria.nombre,
      },
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: Number(Number(p.precio).toFixed(2)),
      orden: p.orden,
      oculto: p.oculto,
      disponible: estaDisponible(p.agotado_hasta),
      agotadoHasta: p.agotado_hasta ? p.agotado_hasta.toISOString() : null,
      noSumaBeneficios: p.no_suma_beneficios,
      fotoUrl: obtenerFotoUrl(p.foto_archivo),
      tamanos: (p.tamanos || []).map((t) => ({
        id: t.id.toString(),
        tamanoValorId: t.tamano_valor_id.toString(),
        nombre: t.tamano_valor?.nombre || '',
        precio: Number(Number(t.precio).toFixed(2)),
        activo: t.activo,
      })),
      grupos: (p.grupos || []).map((pg) => ({
        id: pg.grupo.id.toString(),
        nombre: pg.grupo.nombre,
        obligatorio: pg.grupo.obligatorio,
        minimo: pg.grupo.minimo,
        maximo: pg.grupo.maximo,
        orden: pg.orden,
        activo: pg.grupo.activo,
        opciones: (pg.grupo.opciones || []).map((o) => ({
          id: o.id.toString(),
          nombre: o.valor?.nombre || '',
          precioExtra: Number(Number(o.precio_extra).toFixed(2)),
          activo: o.activo,
          disponible: estaDisponible(o.agotado_hasta),
        })),
      })),
      sabores: (p.sabores || []).map((s) => ({
        id: s.id.toString(),
        nombre: s.nombre,
        activo: s.activo,
        disponible: estaDisponible(s.agotado_hasta),
      })),
    }));
  }

  async obtenerProductoPorId(id: bigint | string | number) {
    const pId = this.parsearId(id);
    const p = await this.prisma.producto.findUnique({
      where: { id: pId },
      include: {
        categoria: true,
        foto_archivo: true,
        tamanos: {
          include: { tamano_valor: true },
        },
        grupos: {
          include: {
            grupo: {
              include: {
                opciones: {
                  include: { valor: true },
                },
              },
            },
          },
        },
        sabores: true,
      },
    });

    if (!p) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    return {
      id: p.id.toString(),
      categoriaId: p.categoria_id.toString(),
      categoria: {
        id: p.categoria.id.toString(),
        nombre: p.categoria.nombre,
      },
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: Number(Number(p.precio).toFixed(2)),
      orden: p.orden,
      oculto: p.oculto,
      disponible: estaDisponible(p.agotado_hasta),
      agotadoHasta: p.agotado_hasta ? p.agotado_hasta.toISOString() : null,
      noSumaBeneficios: p.no_suma_beneficios,
      fotoUrl: obtenerFotoUrl(p.foto_archivo),
      tamanos: (p.tamanos || []).map((t) => ({
        id: t.id.toString(),
        tamanoValorId: t.tamano_valor_id.toString(),
        nombre: t.tamano_valor?.nombre || '',
        precio: Number(Number(t.precio).toFixed(2)),
        activo: t.activo,
      })),
      grupos: (p.grupos || []).map((pg) => ({
        id: pg.grupo.id.toString(),
        nombre: pg.grupo.nombre,
        obligatorio: pg.grupo.obligatorio,
        minimo: pg.grupo.minimo,
        maximo: pg.grupo.maximo,
        orden: pg.orden,
        opciones: (pg.grupo.opciones || []).map((o) => ({
          id: o.id.toString(),
          nombre: o.valor?.nombre || '',
          precioExtra: Number(Number(o.precio_extra).toFixed(2)),
          activo: o.activo,
          disponible: estaDisponible(o.agotado_hasta),
        })),
      })),
      sabores: (p.sabores || []).map((s) => ({
        id: s.id.toString(),
        nombre: s.nombre,
        activo: s.activo,
        disponible: estaDisponible(s.agotado_hasta),
      })),
    };
  }

  async crearProducto(dto: CrearProductoDto, usuario?: UsuarioAutenticado, ip?: string) {
    if (dto.precio < 0) {
      throw new BadRequestException({
        codigo: 'PRECIO_INVALIDO',
        mensaje: 'El precio del producto debe ser mayor o igual a 0',
      });
    }

    if (dto.tamanos) {
      for (const t of dto.tamanos) {
        if (t.precio < 0) {
          throw new BadRequestException({
            codigo: 'PRECIO_INVALIDO',
            mensaje: 'El precio de cada tamaño debe ser mayor o igual a 0',
          });
        }
      }
    }

    const nombreExistente = await this.prisma.producto.findUnique({
      where: { nombre: dto.nombre.trim() },
    });

    if (nombreExistente) {
      throw new ConflictException({
        codigo: 'NOMBRE_DUPLICADO',
        mensaje: 'Ya existe un producto con ese nombre',
      });
    }

    const categoriaId = this.parsearId(dto.categoriaId);
    const categoria = await this.prisma.categoria.findUnique({
      where: { id: categoriaId },
    });

    if (!categoria) {
      throw new NotFoundException({
        codigo: 'CATEGORIA_NO_ENCONTRADA',
        mensaje: 'La categoría especificada no existe',
      });
    }

    const fotoArchivoId = dto.fotoArchivoId ? this.parsearId(dto.fotoArchivoId) : null;

    const nuevoProducto = await this.prisma.$transaction(async (tx) => {
      const prod = await tx.producto.create({
        data: {
          nombre: dto.nombre.trim(),
          categoria_id: categoriaId,
          descripcion: dto.descripcion?.trim() || null,
          precio: dto.precio,
          foto_archivo_id: fotoArchivoId,
          orden: dto.orden ?? 0,
          no_suma_beneficios: dto.noSumaBeneficios ?? false,
          oculto: false,
        },
      });

      if (dto.tamanos && dto.tamanos.length > 0) {
        for (const t of dto.tamanos) {
          await tx.productoTamano.create({
            data: {
              producto_id: prod.id,
              tamano_valor_id: this.parsearId(t.tamanoValorId),
              precio: t.precio,
              activo: t.activo ?? true,
            },
          });
        }
      }

      if (dto.grupos && dto.grupos.length > 0) {
        for (let idx = 0; idx < dto.grupos.length; idx++) {
          const g = dto.grupos[idx];
          await tx.productoGrupo.create({
            data: {
              producto_id: prod.id,
              grupo_id: this.parsearId(g.grupoId),
              orden: g.orden ?? idx,
            },
          });
        }
      }

      if (dto.sabores && dto.sabores.length > 0) {
        for (const nombreSabor of dto.sabores) {
          if (nombreSabor && nombreSabor.trim()) {
            await tx.sabor.create({
              data: {
                producto_id: prod.id,
                nombre: nombreSabor.trim(),
                activo: true,
              },
            });
          }
        }
      }

      return prod;
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'CREAR_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: nuevoProducto.id,
      despues: {
        id: nuevoProducto.id.toString(),
        nombre: nuevoProducto.nombre,
        categoriaId: categoriaId.toString(),
        precio: dto.precio,
      },
      partyId: usuario?.partyId,
      ip,
    });

    return this.obtenerProductoPorId(nuevoProducto.id);
  }

  async editarProducto(
    id: bigint | string | number,
    dto: EditarProductoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = this.parsearId(id);
    const actual = await this.prisma.producto.findUnique({
      where: { id: pId },
      include: {
        tamanos: true,
        grupos: true,
        sabores: true,
      },
    });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    if (dto.precio !== undefined && dto.precio < 0) {
      throw new BadRequestException({
        codigo: 'PRECIO_INVALIDO',
        mensaje: 'El precio del producto debe ser mayor o igual a 0',
      });
    }

    if (dto.nombre && dto.nombre.trim() !== actual.nombre) {
      const duplicado = await this.prisma.producto.findUnique({
        where: { nombre: dto.nombre.trim() },
      });
      if (duplicado && duplicado.id !== pId) {
        throw new ConflictException({
          codigo: 'NOMBRE_DUPLICADO',
          mensaje: 'Ya existe otro producto con ese nombre',
        });
      }
    }

    let categoriaId = actual.categoria_id;
    if (dto.categoriaId !== undefined) {
      categoriaId = this.parsearId(dto.categoriaId);
      const catExiste = await this.prisma.categoria.findUnique({
        where: { id: categoriaId },
      });
      if (!catExiste) {
        throw new NotFoundException({
          codigo: 'CATEGORIA_NO_ENCONTRADA',
          mensaje: 'La categoría no existe',
        });
      }
    }

    const fotoArchivoId =
      dto.fotoArchivoId !== undefined
        ? dto.fotoArchivoId
          ? this.parsearId(dto.fotoArchivoId)
          : null
        : actual.foto_archivo_id;

    await this.prisma.$transaction(async (tx) => {
      await tx.producto.update({
        where: { id: pId },
        data: {
          nombre: dto.nombre ? dto.nombre.trim() : undefined,
          categoria_id: categoriaId,
          descripcion: dto.descripcion !== undefined ? dto.descripcion?.trim() || null : undefined,
          precio: dto.precio !== undefined ? dto.precio : undefined,
          orden: dto.orden !== undefined ? dto.orden : undefined,
          oculto: dto.oculto !== undefined ? dto.oculto : undefined,
          no_suma_beneficios:
            dto.noSumaBeneficios !== undefined ? dto.noSumaBeneficios : undefined,
          foto_archivo_id: fotoArchivoId,
        },
      });

      if (dto.tamanos) {
        for (const t of dto.tamanos) {
          if (t.precio < 0) {
            throw new BadRequestException({
              codigo: 'PRECIO_INVALIDO',
              mensaje: 'El precio de cada tamaño debe ser mayor o igual a 0',
            });
          }
          const tamanoValorId = this.parsearId(t.tamanoValorId);
          await tx.productoTamano.upsert({
            where: {
              producto_id_tamano_valor_id: {
                producto_id: pId,
                tamano_valor_id: tamanoValorId,
              },
            },
            update: {
              precio: t.precio,
              activo: t.activo ?? true,
            },
            create: {
              producto_id: pId,
              tamano_valor_id: tamanoValorId,
              precio: t.precio,
              activo: t.activo ?? true,
            },
          });
        }
      }

      if (dto.grupos) {
        for (let idx = 0; idx < dto.grupos.length; idx++) {
          const g = dto.grupos[idx];
          const grupoId = this.parsearId(g.grupoId);
          await tx.productoGrupo.upsert({
            where: {
              producto_id_grupo_id: {
                producto_id: pId,
                grupo_id: grupoId,
              },
            },
            update: {
              orden: g.orden ?? idx,
            },
            create: {
              producto_id: pId,
              grupo_id: grupoId,
              orden: g.orden ?? idx,
            },
          });
        }
      }

      if (dto.sabores) {
        for (const s of dto.sabores) {
          if (s.id) {
            await tx.sabor.update({
              where: { id: this.parsearId(s.id) },
              data: {
                nombre: s.nombre.trim(),
                activo: s.activo ?? true,
              },
            });
          } else {
            await tx.sabor.upsert({
              where: {
                producto_id_nombre: {
                  producto_id: pId,
                  nombre: s.nombre.trim(),
                },
              },
              update: {
                activo: s.activo ?? true,
              },
              create: {
                producto_id: pId,
                nombre: s.nombre.trim(),
                activo: s.activo ?? true,
              },
            });
          }
        }
      }
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'EDITAR_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: pId,
      antes: {
        nombre: actual.nombre,
        precio: Number(actual.precio),
        oculto: actual.oculto,
      },
      despues: {
        nombre: dto.nombre ?? actual.nombre,
        precio: dto.precio ?? Number(actual.precio),
        oculto: dto.oculto ?? actual.oculto,
      },
      partyId: usuario?.partyId,
      ip,
    });

    return this.obtenerProductoPorId(pId);
  }

  async agotarProducto(
    id: bigint | string | number,
    dto: AgotarDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = this.parsearId(id);
    const actual = await this.prisma.producto.findUnique({ where: { id: pId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    let fechaAgotado: Date;
    if (dto && dto.agotadoHasta) {
      if (dto.agotadoHasta === 'infinity') {
        fechaAgotado = new Date('9999-12-31T23:59:59Z');
      } else {
        fechaAgotado = new Date(dto.agotadoHasta);
        if (isNaN(fechaAgotado.getTime())) {
          fechaAgotado = new Date('9999-12-31T23:59:59Z');
        }
      }
    } else {
      fechaAgotado = new Date('9999-12-31T23:59:59Z');
    }

    await this.prisma.producto.update({
      where: { id: pId },
      data: { agotado_hasta: fechaAgotado },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'AGOTAR_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: pId,
      antes: { agotado_hasta: actual.agotado_hasta },
      despues: { agotado_hasta: fechaAgotado.toISOString() },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      ok: true,
      id: pId.toString(),
      disponible: false,
      agotadoHasta: fechaAgotado.toISOString(),
    };
  }

  async disponibilizarProducto(
    id: bigint | string | number,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = this.parsearId(id);
    const actual = await this.prisma.producto.findUnique({ where: { id: pId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    await this.prisma.producto.update({
      where: { id: pId },
      data: { agotado_hasta: null },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'DISPONIBILIZAR_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: pId,
      antes: { agotado_hasta: actual.agotado_hasta },
      despues: { agotado_hasta: null },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      ok: true,
      id: pId.toString(),
      disponible: true,
      agotadoHasta: null,
    };
  }

  async ocultarProducto(id: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const pId = this.parsearId(id);
    const actual = await this.prisma.producto.findUnique({ where: { id: pId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    await this.prisma.producto.update({
      where: { id: pId },
      data: { oculto: true },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'OCULTAR_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: pId,
      antes: { oculto: actual.oculto },
      despues: { oculto: true },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: pId.toString(), oculto: true };
  }

  async mostrarProducto(id: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const pId = this.parsearId(id);
    const actual = await this.prisma.producto.findUnique({ where: { id: pId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    await this.prisma.producto.update({
      where: { id: pId },
      data: { oculto: false },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'MOSTRAR_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: pId,
      antes: { oculto: actual.oculto },
      despues: { oculto: false },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: pId.toString(), oculto: false };
  }

  async asociarFotoProducto(
    id: bigint | string | number,
    fotoArchivoId: string | number | null,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = this.parsearId(id);
    const actual = await this.prisma.producto.findUnique({ where: { id: pId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: 'El producto no existe',
      });
    }

    const archivoId = fotoArchivoId ? this.parsearId(fotoArchivoId) : null;
    if (archivoId) {
      const archivoExiste = await this.prisma.archivo.findUnique({ where: { id: archivoId } });
      if (!archivoExiste) {
        throw new NotFoundException({
          codigo: 'ARCHIVO_NO_ENCONTRADO',
          mensaje: 'El archivo especificado no existe',
        });
      }
    }

    await this.prisma.producto.update({
      where: { id: pId },
      data: { foto_archivo_id: archivoId },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'ASOCIAR_FOTO_PRODUCTO',
      resultado: 'OK',
      entidad: 'producto',
      entidadId: pId,
      antes: { foto_archivo_id: actual.foto_archivo_id?.toString() },
      despues: { foto_archivo_id: archivoId?.toString() },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: pId.toString(), fotoArchivoId: archivoId?.toString() || null };
  }

  // =========================================================================
  // 3. OPCIONES (ADMIN)
  // =========================================================================

  async agotarOpcion(
    id: bigint | string | number,
    dto: AgotarDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const oId = this.parsearId(id);
    const actual = await this.prisma.opcion.findUnique({ where: { id: oId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'OPCION_NO_ENCONTRADA',
        mensaje: 'La opción no existe',
      });
    }

    let fechaAgotado: Date;
    if (dto && dto.agotadoHasta) {
      if (dto.agotadoHasta === 'infinity') {
        fechaAgotado = new Date('9999-12-31T23:59:59Z');
      } else {
        fechaAgotado = new Date(dto.agotadoHasta);
        if (isNaN(fechaAgotado.getTime())) {
          fechaAgotado = new Date('9999-12-31T23:59:59Z');
        }
      }
    } else {
      fechaAgotado = new Date('9999-12-31T23:59:59Z');
    }

    await this.prisma.opcion.update({
      where: { id: oId },
      data: { agotado_hasta: fechaAgotado },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'AGOTAR_OPCION',
      resultado: 'OK',
      entidad: 'opcion',
      entidadId: oId,
      antes: { agotado_hasta: actual.agotado_hasta },
      despues: { agotado_hasta: fechaAgotado.toISOString() },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      ok: true,
      id: oId.toString(),
      disponible: false,
      agotadoHasta: fechaAgotado.toISOString(),
    };
  }

  async disponibilizarOpcion(
    id: bigint | string | number,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const oId = this.parsearId(id);
    const actual = await this.prisma.opcion.findUnique({ where: { id: oId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'OPCION_NO_ENCONTRADA',
        mensaje: 'La opción no existe',
      });
    }

    await this.prisma.opcion.update({
      where: { id: oId },
      data: { agotado_hasta: null },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'DISPONIBILIZAR_OPCION',
      resultado: 'OK',
      entidad: 'opcion',
      entidadId: oId,
      antes: { agotado_hasta: actual.agotado_hasta },
      despues: { agotado_hasta: null },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      ok: true,
      id: oId.toString(),
      disponible: true,
      agotadoHasta: null,
    };
  }

  async ocultarOpcion(id: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const oId = this.parsearId(id);
    const actual = await this.prisma.opcion.findUnique({ where: { id: oId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'OPCION_NO_ENCONTRADA',
        mensaje: 'La opción no existe',
      });
    }

    await this.prisma.opcion.update({
      where: { id: oId },
      data: { activo: false },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'OCULTAR_OPCION',
      resultado: 'OK',
      entidad: 'opcion',
      entidadId: oId,
      antes: { activo: actual.activo },
      despues: { activo: false },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: oId.toString(), activo: false };
  }

  async mostrarOpcion(id: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const oId = this.parsearId(id);
    const actual = await this.prisma.opcion.findUnique({ where: { id: oId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'OPCION_NO_ENCONTRADA',
        mensaje: 'La opción no existe',
      });
    }

    await this.prisma.opcion.update({
      where: { id: oId },
      data: { activo: true },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'MOSTRAR_OPCION',
      resultado: 'OK',
      entidad: 'opcion',
      entidadId: oId,
      antes: { activo: actual.activo },
      despues: { activo: true },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: oId.toString(), activo: true };
  }

  // =========================================================================
  // 4. CATEGORÍAS (ADMIN)
  // =========================================================================

  async listarCategoriasAdmin() {
    const categorias = await this.prisma.categoria.findMany({
      orderBy: { orden: 'asc' },
      include: { area: true },
    });

    return categorias.map((c) => ({
      id: c.id.toString(),
      nombre: c.nombre,
      areaId: c.area_id.toString(),
      areaNombre: c.area?.nombre,
      orden: c.orden,
      oculta: c.oculta,
      llevaOpciones: c.lleva_opciones,
    }));
  }

  async actualizarCategoria(
    id: bigint | string | number,
    dto: ActualizarCategoriaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const cId = this.parsearId(id);
    const actual = await this.prisma.categoria.findUnique({ where: { id: cId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'CATEGORIA_NO_ENCONTRADA',
        mensaje: 'La categoría no existe',
      });
    }

    if (dto.nombre && dto.nombre.trim() !== actual.nombre) {
      const duplicado = await this.prisma.categoria.findUnique({
        where: { nombre: dto.nombre.trim() },
      });
      if (duplicado && duplicado.id !== cId) {
        throw new ConflictException({
          codigo: 'NOMBRE_DUPLICADO',
          mensaje: 'Ya existe otra categoría con ese nombre',
        });
      }
    }

    let areaId = actual.area_id;
    if (dto.areaId !== undefined) {
      areaId = this.parsearId(dto.areaId);
      const areaExiste = await this.prisma.areaCocina.findUnique({ where: { id: areaId } });
      if (!areaExiste) {
        throw new NotFoundException({
          codigo: 'AREA_NO_ENCONTRADA',
          mensaje: 'El área de cocina no existe',
        });
      }
    }

    const updated = await this.prisma.categoria.update({
      where: { id: cId },
      data: {
        nombre: dto.nombre ? dto.nombre.trim() : undefined,
        area_id: areaId,
        orden: dto.orden !== undefined ? dto.orden : undefined,
        oculta: dto.oculta !== undefined ? dto.oculta : undefined,
        lleva_opciones: dto.llevaOpciones !== undefined ? dto.llevaOpciones : undefined,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'EDITAR_CATEGORIA',
      resultado: 'OK',
      entidad: 'categoria',
      entidadId: cId,
      antes: {
        nombre: actual.nombre,
        orden: actual.orden,
        oculta: actual.oculta,
      },
      despues: {
        nombre: updated.nombre,
        orden: updated.orden,
        oculta: updated.oculta,
      },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      nombre: updated.nombre,
      areaId: updated.area_id.toString(),
      orden: updated.orden,
      oculta: updated.oculta,
      llevaOpciones: updated.lleva_opciones,
    };
  }

  async ocultarCategoria(id: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const cId = this.parsearId(id);
    const actual = await this.prisma.categoria.findUnique({ where: { id: cId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'CATEGORIA_NO_ENCONTRADA',
        mensaje: 'La categoría no existe',
      });
    }

    await this.prisma.categoria.update({
      where: { id: cId },
      data: { oculta: true },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'OCULTAR_CATEGORIA',
      resultado: 'OK',
      entidad: 'categoria',
      entidadId: cId,
      antes: { oculta: actual.oculta },
      despues: { oculta: true },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: cId.toString(), oculta: true };
  }

  async mostrarCategoria(id: bigint | string | number, usuario?: UsuarioAutenticado, ip?: string) {
    const cId = this.parsearId(id);
    const actual = await this.prisma.categoria.findUnique({ where: { id: cId } });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'CATEGORIA_NO_ENCONTRADA',
        mensaje: 'La categoría no existe',
      });
    }

    await this.prisma.categoria.update({
      where: { id: cId },
      data: { oculta: false },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'catalogo',
      accion: 'MOSTRAR_CATEGORIA',
      resultado: 'OK',
      entidad: 'categoria',
      entidadId: cId,
      antes: { oculta: actual.oculta },
      despues: { oculta: false },
      partyId: usuario?.partyId,
      ip,
    });

    return { ok: true, id: cId.toString(), oculta: false };
  }
}
