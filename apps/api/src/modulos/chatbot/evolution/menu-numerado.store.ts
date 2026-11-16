import { Injectable, Optional } from '@nestjs/common';
import { RedisService } from '../../../comun/redis/redis.service';
import type { MenuNumerado } from './menu-numerado.util';

/** 24 h: un «1» de «Volver al menú» respondido horas después sigue valiendo (nunca cae en la IA). */
const TTL_SEG = 24 * 60 * 60;

/**
 * Último menú numerado enviado a cada teléfono. Vive en Redis (con vencimiento) y, si Redis no responde, en memoria.
 * Un texto normal posterior borra el menú: así un «2» suelto (cantidad, edad...) no se confunde con una opción vieja.
 */
@Injectable()
export class MenuNumeradoStore {
  private memoria = new Map<string, { menu: MenuNumerado; vence: number }>();

  constructor(@Optional() private readonly redis?: RedisService) {}

  private clave = (tel: string) => `wa:menu:${tel.replace(/\D/g, '')}`;

  async guardar(tel: string, menu: MenuNumerado): Promise<void> {
    this.memoria.set(this.clave(tel), { menu, vence: Date.now() + TTL_SEG * 1000 });
    try {
      await this.redis?.obtenerCliente().set(this.clave(tel), JSON.stringify(menu), 'EX', TTL_SEG);
    } catch {
      /* queda en memoria */
    }
  }

  async obtener(tel: string): Promise<MenuNumerado | null> {
    try {
      const crudo = await this.redis?.obtenerCliente().get(this.clave(tel));
      if (crudo) return JSON.parse(crudo) as MenuNumerado;
    } catch {
      /* usa memoria */
    }
    const m = this.memoria.get(this.clave(tel));
    return m && m.vence > Date.now() ? m.menu : null;
  }

  async borrar(tel: string): Promise<void> {
    this.memoria.delete(this.clave(tel));
    try {
      await this.redis?.obtenerCliente().del(this.clave(tel));
    } catch {
      /* nada */
    }
  }
}
