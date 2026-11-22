import { Body, Controller, ForbiddenException, Get, Optional, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ContadorSalientesService } from './contador-salientes.service';
import { EvolutionApiCliente } from './evolution-api.cliente';
import { CLAVES_LIMITES, EvolutionConfigService } from './evolution-config.service';

export class CambiarProveedorDto {
  @IsIn(['META', 'EVOLUTION'])
  proveedor!: 'META' | 'EVOLUTION';
}

export class PausarDto {
  @IsBoolean()
  pausado!: boolean;
}

const esAdmin = (req: any): boolean =>
  (req?.usuario?.roles ?? [req?.usuario?.rol ?? '']).map((r: unknown) => String(r || '').toUpperCase()).includes('ADMIN');

/** Configuración › WhatsApp: proveedor activo (Meta o Evolution), conexión, QR y límites anti-bloqueo. Cambiar lo importante es solo del ADMIN. */
@Controller(['admin/whatsapp/evolution', 'api/admin/whatsapp/evolution'])
@UseGuards(AccesoGuard)
export class EvolutionAdminController {
  constructor(
    private readonly config: EvolutionConfigService,
    private readonly api: EvolutionApiCliente,
    private readonly env: ConfigService,
    @Optional() private readonly auditoria?: AuditoriaService,
    @Optional() private readonly contador?: ContadorSalientesService,
  ) {}

  private soloAdmin(req: any) {
    if (!esAdmin(req)) throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo un administrador puede hacer este cambio' });
  }

  @Get()
  @Permiso('configuracion', 'ver')
  async estado() {
    const cfg = await this.config.obtener();
    const guardado = await this.config.estadoConexion();
    const enVivo = await this.api.estado();
    const limites = Object.fromEntries(CLAVES_LIMITES.map((k) => [k, cfg[k]]));
    return {
      proveedor: cfg.whatsapp_proveedor,
      configurado: this.api.configurado(),
      webhookConTokenConfigurado: !!(this.env.get<string>('EVOLUTION_WEBHOOK_TOKEN') || '').trim(),
      pausado: String(cfg.evolution_pausado).toLowerCase() === 'si',
      conexion: { ...guardado, enVivo: enVivo ?? null },
      limites,
      envios: (await this.contador?.resumen().catch(() => null)) ?? null,
    };
  }

  /** QR para vincular el número. Solo si Evolution está configurado y la API lo entrega. */
  @Get('qr')
  @Permiso('configuracion', 'ver')
  async qr(@Req() req: any) {
    this.soloAdmin(req);
    const qr = await this.api.qr();
    return { disponible: !!qr?.base64, base64: qr?.base64 ?? null, codigo: qr?.codigo ?? null };
  }

  /**
   * Para la pantalla Mensajes (permiso de ver mensajes): solo dice si el número está vinculado. Sin claves ni URL.
   * vinculado: true/false cuando Evolution lo confirma; null si no aplica (Meta/simulado) o no se pudo consultar.
   */
  @Get('mensajes/estado')
  @Permiso('mensajes', 'ver')
  async estadoMensajes() {
    const proveedor = await this.config.proveedor();
    // Con Evolution instalado se informa su estado aunque el proveedor en uso sea Meta: así se puede vincular antes de cambiar
    if (!this.api.configurado()) return { proveedor, vinculado: null, estado: null };
    const enVivo = await this.api.estado();
    return { proveedor, vinculado: enVivo ? enVivo === 'open' : null, estado: enVivo };
  }

  /** Genera un QR nuevo para re-vincular el número desde Mensajes. Queda auditado quién lo pidió. */
  @Post('mensajes/qr')
  @Permiso('mensajes', 'ver')
  async qrMensajes(@Req() req: any) {
    if (!this.api.configurado()) return { disponible: false, base64: null };
    const qr = await this.api.qr();
    await this.auditoria?.registrar({
      categoria: 'ACCESO',
      modulo: 'whatsapp_proveedor',
      accion: 'pedir_qr',
      entidad: 'parametro',
      despues: { disponible: !!qr?.base64 },
      partyId: req?.usuario?.partyId != null ? BigInt(req.usuario.partyId) : undefined,
    });
    return { disponible: !!qr?.base64, base64: qr?.base64 ?? null };
  }

  @Put('proveedor')
  @Permiso('configuracion', 'editar')
  async cambiarProveedor(@Body() dto: CambiarProveedorDto, @Req() req: any) {
    this.soloAdmin(req);
    return { proveedor: await this.config.conmutarProveedor(dto.proveedor, req.usuario) };
  }

  @Put('limites')
  @Permiso('configuracion', 'editar')
  async limites(@Body() cuerpo: Record<string, unknown>, @Req() req: any) {
    this.soloAdmin(req);
    const cfg = await this.config.actualizarLimites(cuerpo ?? {}, req.usuario);
    return { limites: Object.fromEntries(CLAVES_LIMITES.map((k) => [k, cfg[k]])) };
  }

  @Post('pausa')
  @Permiso('configuracion', 'editar')
  async pausa(@Body() dto: PausarDto, @Req() req: any) {
    this.soloAdmin(req);
    await this.config.fijarPausa(dto.pausado, req.usuario);
    return { pausado: dto.pausado };
  }
}
