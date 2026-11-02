import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { PrismaService } from '../../comun/prisma/prisma.service';

export interface InsumoExistenciaCocinaDto {
  insumoId: string;
  nombre: string;
  unidad: string;
  stockCocina: number;
  stockMinimo: number;
  stockAlmacen: number;
}

@Controller('admin/cocina')
@UseGuards(AccesoGuard)
export class CocinaExistenciasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('existencias-para-pedir')
  @Permiso('cocina', 'ver')
  async obtenerExistenciasParaPedir(): Promise<InsumoExistenciaCocinaDto[]> {
    const lugares = await this.prisma.lugarStock.findMany({
      where: {
        OR: [
          { nombre: { contains: 'Salados', mode: 'insensitive' } },
          { nombre: { contains: 'Almacén', mode: 'insensitive' } },
          { tipo: 'ALMACEN' },
        ],
      },
    });

    const cocinaLugar = lugares.find((l) =>
      l.nombre.toLowerCase().includes('salados'),
    );
    const almacenLugar =
      lugares.find((l) => l.nombre.toLowerCase().includes('almacén')) ||
      lugares.find((l) => l.tipo === 'ALMACEN');

    const insumos = await this.prisma.insumo.findMany({
      where: { activo: true },
      include: {
        stocks: true,
      },
      orderBy: { nombre: 'asc' },
    });

    return insumos.map((ins) => {
      let stockCocina = 0;
      let stockAlmacen = 0;

      for (const st of ins.stocks) {
        const cant = Number(st.cantidad);
        if (cocinaLugar && st.lugar_id === cocinaLugar.id) {
          stockCocina += cant;
        }
        if (almacenLugar && st.lugar_id === almacenLugar.id) {
          stockAlmacen += cant;
        }
      }

      return {
        insumoId: ins.id.toString(),
        nombre: ins.nombre,
        unidad: ins.unidad_almacen,
        stockCocina: Math.max(0, Number(stockCocina.toFixed(3))),
        stockMinimo: Math.max(0, Number(Number(ins.minimo).toFixed(3))),
        stockAlmacen: Math.max(0, Number(stockAlmacen.toFixed(3))),
      };
    });
  }
}
