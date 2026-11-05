import { Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PreferenciasUsuarioService } from '../preferencias/preferencias-usuario.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ComandasService } from './comandas.service';

/** Clave de la preferencia personal «Preguntar antes de despejar» (cada cocinero la fija para sí). */
export const CLAVE_PREF_CONFIRMAR_DESPEJAR = 'cocina.confirmar_despejar';

export interface AjustesCocinaPersonales {
  /** Valor efectivo para quien consulta: el personal si existe, si no el general. */
  confirmarDespejar: boolean;
  /** Valor general del local (parámetro cocina_confirmar_despejar, lo cambia el ADMIN). */
  confirmarDespejarGeneral: boolean;
  /** true si el usuario tiene su propia preferencia. */
  personalizado: boolean;
}

@Injectable()
export class AjustesPersonalesCocinaService {
  constructor(
    private readonly comandas: ComandasService,
    private readonly preferencias: PreferenciasUsuarioService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async obtener(partyId: bigint): Promise<AjustesCocinaPersonales> {
    const general = (await this.comandas.obtenerAjustes()).confirmarDespejar;
    const personal = await this.preferencias.obtener(partyId, CLAVE_PREF_CONFIRMAR_DESPEJAR);
    const personalizado = typeof personal === 'boolean';
    return {
      confirmarDespejar: personalizado ? (personal as boolean) : general,
      confirmarDespejarGeneral: general,
      personalizado,
    };
  }

  /** valor null quita la preferencia personal (vuelve al general). Solo toca la fila de quien llama. */
  async guardar(usuario: UsuarioAutenticado, valor: boolean | null, ip?: string): Promise<AjustesCocinaPersonales> {
    if (valor === null) {
      await this.preferencias.borrar(usuario.partyId, CLAVE_PREF_CONFIRMAR_DESPEJAR);
    } else {
      await this.preferencias.guardar(usuario.partyId, CLAVE_PREF_CONFIRMAR_DESPEJAR, valor);
    }
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cocina',
      accion: 'CAMBIAR_PREFERENCIA_PROPIA',
      resultado: 'OK',
      entidad: 'preferencia_usuario',
      despues: { clave: CLAVE_PREF_CONFIRMAR_DESPEJAR, valor },
      partyId: usuario.partyId,
      ip,
    });
    return this.obtener(usuario.partyId);
  }
}
