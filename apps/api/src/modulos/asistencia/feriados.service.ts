import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

const fechaDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fila = (f: any) => ({ id: Number(f.id), fecha: f.fecha.toISOString().slice(0, 10), nombre: f.nombre, recargo: Number(f.recargo), activo: f.activo });

/** Feriados: el ADMIN los crea, edita y desactiva (nunca se borran). Cada cambio queda en la auditoría. */
@Injectable()
export class FeriadosService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly auditoria?: AuditoriaService) {}

  async listar(anio?: number) {
    const where = anio ? { fecha: { gte: fechaDb(`${anio}-01-01`), lte: fechaDb(`${anio}-12-31`) } } : {};
    return (await this.prisma.feriado.findMany({ where, orderBy: { fecha: 'asc' } })).map(fila);
  }

  async crear(dto: { fecha: string; nombre: string; recargo?: number }, usuario: UsuarioAutenticado, ip?: string) {
    if (Number.isNaN(Date.parse(`${dto.fecha}T00:00:00Z`))) {
      throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'La fecha debe ser AAAA-MM-DD' });
    }
    if (await this.prisma.feriado.findUnique({ where: { fecha: fechaDb(dto.fecha) } })) {
      throw new ConflictException({ codigo: 'FERIADO_EXISTE', mensaje: 'Ya hay un feriado en esa fecha. Edítalo o reactívalo.' });
    }
    const f = await this.prisma.feriado.create({
      data: { fecha: fechaDb(dto.fecha), nombre: dto.nombre.trim(), recargo: dto.recargo ?? 2, actualizado_por: usuario.partyId },
    });
    await this.auditar('CREAR_FERIADO', usuario, ip, f.id, { despues: fila(f) });
    return fila(f);
  }

  async editar(id: number, dto: { nombre?: string; recargo?: number; activo?: boolean }, usuario: UsuarioAutenticado, ip?: string) {
    const antes = await this.prisma.feriado.findUnique({ where: { id: BigInt(id) } });
    if (!antes) throw new NotFoundException({ codigo: 'FERIADO_NO_ENCONTRADO', mensaje: 'Feriado no encontrado' });
    if (dto.nombre !== undefined && dto.nombre.trim().length < 2) throw new BadRequestException({ codigo: 'NOMBRE_REQUERIDO', mensaje: 'Escribe el nombre' });
    const f = await this.prisma.feriado.update({
      where: { id: antes.id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
        ...(dto.recargo !== undefined ? { recargo: dto.recargo } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        actualizado_en: new Date(),
        actualizado_por: usuario.partyId,
      },
    });
    const accion = dto.activo === false ? 'DESACTIVAR_FERIADO' : dto.activo === true && !antes.activo ? 'ACTIVAR_FERIADO' : 'EDITAR_FERIADO';
    await this.auditar(accion, usuario, ip, f.id, { antes: fila(antes), despues: fila(f) });
    return fila(f);
  }

  private async auditar(accion: string, usuario: UsuarioAutenticado, ip: string | undefined, id: bigint, despues: Record<string, unknown>) {
    await this.auditoria?.registrar(
      { categoria: 'CAMBIO', modulo: 'planilla', accion, resultado: 'OK', entidad: 'feriado', entidadId: Number(id), despues, partyId: usuario.partyId, ip } as any,
    );
  }
}
