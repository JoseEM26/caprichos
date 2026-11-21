/**
 * Registro de piezas del avatar 3D. Este archivo (y todo lo que importa) vive en un chunk aparte: la carta solo lo baja
 * cuando el cliente abre «Mi avatar» (import() diferido en AvatarEditorPerezoso).
 */
import { AVATAR } from './nucleo';
import { registrarCabello } from './cabello';
import { registrarRopa } from './ropa';
import { registrarDisfraces } from './disfraces';
import type { Avatar3D } from './tipos';

let listo = false;

/** Registra cabello, ropa y disfraces una sola vez y devuelve el núcleo del avatar. */
export function cargarAvatar(): Avatar3D {
  if (!listo) {
    registrarCabello();
    registrarRopa();
    registrarDisfraces();
    listo = true;
  }
  return AVATAR as unknown as Avatar3D;
}
