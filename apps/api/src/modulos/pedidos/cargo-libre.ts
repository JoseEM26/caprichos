import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MATRIZ } from '../acceso/permisos';
import { rolesDelUsuario } from '../acceso/roles-usuario';

/** «Servicio o producto» libre: tope por cargo y largo de la descripción. */
export const CARGO_LIBRE_MAX = 500;
export const CARGO_LIBRE_DESC_MAX = 120;

export interface CargoLibreEntrada {
  descripcion: string;
  monto: number | string;
  /** Posición (en `lineas`) del producto al que acompaña; su comanda y sticker llevan el texto. */
  paraLineaIndex?: number;
}

export interface CargoLibreValido {
  descripcion: string;
  monto: number;
  paraLineaIndex: number | null;
}

/** Quién puede agregar cargos libres según la matriz (pedidos/cargo_libre): ADMIN, SUPERVISOR, Caja y Mozo. */
export function puedeCargoLibre(usuario: { rol: string; roles?: string[] } | undefined): boolean {
  return rolesDelUsuario(usuario).some((r) => (MATRIZ[r] ?? []).includes('pedidos/cargo_libre'));
}

/** Solo Caja y mozo (panel): la carta, WhatsApp y el bot nunca agregan cargos libres. */
export function exigirCanalPersonal(canal: string | undefined, hayUsuario: boolean) {
  if (!(canal === 'MOZO' || canal === 'CAJA') || !hayUsuario) {
    throw new ForbiddenException({ codigo: 'CARGO_LIBRE_NO_PERMITIDO', mensaje: 'Solo Caja y el mozo pueden agregar un servicio o producto libre' });
  }
}

/** Valida y normaliza los cargos libres: descripción 1..120, monto > 0 y ≤ S/ 500 con 2 decimales. Función pura. */
export function validarCargosLibres(cargos: CargoLibreEntrada[] | undefined, totalLineas: number): CargoLibreValido[] {
  return (cargos ?? []).map((c) => {
    const descripcion = String(c?.descripcion ?? '').replace(/\s+/g, ' ').trim();
    if (descripcion.length === 0 || descripcion.length > CARGO_LIBRE_DESC_MAX) {
      throw new BadRequestException({ codigo: 'CARGO_LIBRE_DESCRIPCION', mensaje: `Escribe la descripción (hasta ${CARGO_LIBRE_DESC_MAX} letras)` });
    }
    const monto = Number(c?.monto);
    const cents = Math.round(monto * 100);
    if (!Number.isFinite(monto) || cents <= 0 || Math.abs(cents - monto * 100) > 1e-6 || cents > CARGO_LIBRE_MAX * 100) {
      throw new BadRequestException({ codigo: 'CARGO_LIBRE_MONTO', mensaje: `El monto debe ser mayor a 0 y hasta S/ ${CARGO_LIBRE_MAX}, con 2 decimales como máximo` });
    }
    const idx = c.paraLineaIndex;
    if (idx != null && !(Number.isInteger(idx) && idx >= 0 && idx < totalLineas)) {
      throw new BadRequestException({ codigo: 'CARGO_LIBRE_PRODUCTO', mensaje: 'El producto elegido para el cargo no está en el pedido' });
    }
    return { descripcion, monto: cents / 100, paraLineaIndex: idx ?? null };
  });
}

/** Texto que acompaña al producto vinculado en cocina y sticker. */
export const textoCargoParaNota = (descripcion: string) => `+ ${descripcion}`;
