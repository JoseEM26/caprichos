import { Prisma } from '@prisma/client';

/**
 * Un combo se desglosa en varios productos, pero se pide desde un producto «anfitrión» (precio, tamaños, foto).
 * El dueño solo edita el combo en Ofertas › Combos: este helper crea y mantiene ese anfitrión por dentro.
 * Solo toca lo que llega en `campos`; nunca borra nada (los tamaños que ya no están en el combo se desactivan).
 */
export interface ComboAnfitrion {
  id: bigint;
  /** Producto anfitrión actual; null = el combo aún no tiene y se crea. */
  alcanceProductoId: bigint | null;
  nombre: string;
  descripcion: string | null;
  imagenArchivoId: bigint | null;
  /** Combo apagado = anfitrión oculto en la carta (su tarjeta de oferta sale como no disponible); undefined = no tocar. */
  oculto?: boolean;
}

export interface CamposAnfitrion {
  nombre?: boolean;
  descripcion?: boolean;
  foto?: boolean;
}

export const CATEGORIA_COMBOS = 'Combos';

export async function sincronizarAnfitrionCombo(
  tx: Prisma.TransactionClient,
  combo: ComboAnfitrion,
  precios?: { tamanoValorId: bigint; precio: number }[],
  campos: CamposAnfitrion = { nombre: true, descripcion: true, foto: true },
): Promise<bigint> {
  const base = precios && precios.length > 0 ? Math.min(...precios.map((p) => p.precio)) : undefined;
  let hostId = combo.alcanceProductoId;

  if (!hostId) {
    let cat = await tx.categoria.findFirst({ where: { nombre: { equals: CATEGORIA_COMBOS, mode: 'insensitive' } } });
    if (!cat) {
      const area = await tx.areaCocina.findFirst({ orderBy: { id: 'asc' } });
      // El anfitrión no va a cocina (sus partes sí, cada una en su área); la categoría solo exige un área.
      if (!area) throw new Error('No hay áreas de cocina para crear la categoría Combos');
      cat = await tx.categoria.create({ data: { nombre: CATEGORIA_COMBOS, area_id: area.id, lleva_opciones: false } });
    }
    const host = await tx.producto.create({
      data: {
        categoria_id: cat.id,
        nombre: combo.nombre,
        descripcion: combo.descripcion,
        foto_archivo_id: combo.imagenArchivoId,
        precio: new Prisma.Decimal(base ?? 0),
        oculto: combo.oculto ?? false,
      },
    });
    await tx.oferta.update({ where: { id: combo.id }, data: { producto: { connect: { id: host.id } } } });
    hostId = host.id;
  } else {
    const data: Prisma.ProductoUpdateInput = {};
    if (campos.nombre) {
      // Si otro producto ya usa ese nombre no se renombra (nombre único); el combo igual se guarda
      const otro = await tx.producto.findFirst({
        where: { nombre: { equals: combo.nombre, mode: 'insensitive' }, id: { not: hostId } },
        select: { id: true },
      });
      if (!otro) data.nombre = combo.nombre;
    }
    if (campos.descripcion && combo.descripcion) data.descripcion = combo.descripcion;
    if (campos.foto && combo.imagenArchivoId) data.foto_archivo = { connect: { id: combo.imagenArchivoId } };
    if (combo.oculto !== undefined) data.oculto = combo.oculto;
    if (base !== undefined) data.precio = new Prisma.Decimal(base);
    if (Object.keys(data).length > 0) await tx.producto.update({ where: { id: hostId }, data });
  }

  if (precios && precios.length > 0) {
    for (const p of precios) {
      await tx.productoTamano.upsert({
        where: { producto_id_tamano_valor_id: { producto_id: hostId, tamano_valor_id: p.tamanoValorId } },
        create: { producto_id: hostId, tamano_valor_id: p.tamanoValorId, precio: new Prisma.Decimal(p.precio), unidades: 1 },
        update: { precio: new Prisma.Decimal(p.precio), activo: true },
      });
    }
    await tx.productoTamano.updateMany({
      where: { producto_id: hostId, tamano_valor_id: { notIn: precios.map((p) => p.tamanoValorId) } },
      data: { activo: false },
    });
  }
  return hostId;
}
