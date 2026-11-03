import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ComprobantesService } from './comprobantes.service';
import { CLAVE_BOLETA_DEFECTO, aplicaBoletaPorDefecto } from './comprobante-defecto';

/** Lee y guarda la marca «Boleta electrónica por defecto» y dice si hoy aplica (con SUNAT real). */
@Injectable()
export class ComprobanteDefectoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly comprobantes: ComprobantesService,
  ) {}

  /** Marca guardada. Sin valor o error de lectura: sí (defecto). */
  async leerActivo(db: any = this.prisma): Promise<boolean> {
    try {
      const p = await db.parametro.findUnique({ where: { clave: CLAVE_BOLETA_DEFECTO } });
      return p?.valor !== false;
    } catch {
      return true;
    }
  }

  /** ¿Un pedido sin tipo elegido sale como boleta ahora? (marca activa y proveedor efectivo SUNAT). */
  async aplica(db: any = this.prisma): Promise<boolean> {
    const cfg = await this.comprobantes.leerConfigFacturacion(db);
    return aplicaBoletaPorDefecto(this.comprobantes.proveedorEfectivo(cfg.proveedor), await this.leerActivo(db));
  }

  async estado() {
    const activo = await this.leerActivo();
    const cfg = await this.comprobantes.leerConfigFacturacion();
    const proveedorEfectivo = this.comprobantes.proveedorEfectivo(cfg.proveedor);
    return {
      activo,
      proveedor_efectivo: proveedorEfectivo,
      aplica: aplicaBoletaPorDefecto(proveedorEfectivo, activo),
    };
  }

  /** Guarda la marca (ADMIN, con Sí/No en la web). Audita el valor anterior y el nuevo. */
  async guardar(activo: boolean, usuario?: UsuarioAutenticado, ip?: string) {
    const antes = await this.leerActivo();
    await this.prisma.parametro.upsert({
      where: { clave: CLAVE_BOLETA_DEFECTO },
      update: { valor: activo },
      create: { clave: CLAVE_BOLETA_DEFECTO, valor: activo },
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: 'CONFIG_BOLETA_DEFECTO',
      resultado: 'OK',
      entidad: 'parametro',
      antes: { boleta_por_defecto: antes },
      despues: { boleta_por_defecto: activo },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });
    return this.estado();
  }
}
