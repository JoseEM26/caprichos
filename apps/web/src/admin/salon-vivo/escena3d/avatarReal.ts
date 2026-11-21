import * as THREE from 'three';
import type { Ctx } from './base';
import type { Persona } from './personas';
import type { AvatarVivo } from '../salonVivoApi';
import type { Avatar3D, PartesAvatar } from '../../../avatar/tipos';

/**
 * Cliente con su avatar real. Las piezas del avatar (el chunk pesado) se bajan con import() diferido, solo cuando
 * algún pedido trae avatar; sin avatares nunca se descargan.
 */
export const MAX_AVATARES = 12;
/** El avatar mide ~1.75 y las figuras genéricas del salón ~1.5. */
const ESCALA = 0.86;

export interface MotorAvatar { A: Avatar3D; normalizar: (A: Avatar3D, guardada: unknown, nombre?: string) => unknown }

/** ¿Este cliente se dibuja con su avatar real? Con modo ligero, sin configuración o con el tope lleno: figura genérica. */
export function usaAvatarReal(avatar: AvatarVivo | null | undefined, ligero: boolean, enUso: number, tope = MAX_AVATARES): boolean {
  return !ligero && !!avatar?.config && typeof avatar.config === 'object' && enUso < tope;
}

let carga: Promise<MotorAvatar> | null = null;
/** Baja (una sola vez) el núcleo, las piezas y el normalizador del avatar. */
export function cargarMotorAvatar(): Promise<MotorAvatar> {
  const p = (carga ??= Promise.all([import('../../../avatar/piezas'), import('../../../avatar/config')]).then(([m, c]) => ({ A: m.cargarAvatar(), normalizar: c.normalizar })));
  p.catch(() => { carga = null; });
  return p;
}

/**
 * Convierte las partes del avatar en una Persona del salón: mismos grupos (cuerpo, cabeza, brazos, codos, piernas, rodillas)
 * que usan caminar, sentarse, comer y levantar la mano; los ojos y la boca se animan igual aunque sean grupos.
 * La raíz es un envoltorio escalado: el director mueve y gira ESE grupo.
 */
export function personaDeAvatar(ctx: Ctx, gente: Set<Persona>, partes: PartesAvatar & { boca?: THREE.Object3D }): Persona {
  const raiz = new THREE.Group();
  raiz.scale.setScalar(ESCALA);
  raiz.add(partes.raiz);
  const tel = ctx.malla(new THREE.BoxGeometry(0.06, 0.11, 0.012), ctx.M('#14141A', { emissive: 0x3BB4E7, emissiveIntensity: 0.25 }), 0, -0.2, 0.05, partes.codos[0]);
  tel.rotation.x = -0.6; tel.visible = false;
  // Mascota: solo se ve mientras el cliente está sentado; echada junto a la silla (de lado y un poco atrás, fuera del paso
  // hacia la mesa). Al caminar se oculta, así no estorba los caminos. Las voladoras flotan bajito.
  const m = partes.mascota;
  let animar = partes.animar;
  if (m) {
    m.userData.descanso = true;
    m.userData.base = m.userData.volador ? 0.45 : 0;
    m.scale.setScalar(1);
    m.position.set(0.58, m.userData.base, -0.32);
    m.rotation.y = -0.7;
    m.visible = false;
    animar = (t, dt) => { m.visible = !!per.sentado; partes.animar(t, dt); };
  }
  const per: Persona = {
    raiz, cuerpo: partes.cuerpo, piernas: partes.piernas, rodillas: partes.rodillas, brazos: partes.brazos, codos: partes.codos,
    cabeza: partes.cabeza, ojos: partes.ojos as unknown as THREE.Mesh[], boca: (partes.boca ?? new THREE.Group()) as unknown as THREE.Mesh,
    cola: null, tel, rol: 'cliente', semilla: Math.random() * 10, usaCel: Math.random() < 0.35, ritmo: 0, paso: 0,
    avatarReal: true, animarExtra: animar,
  };
  gente.add(per);
  return per;
}

/** Intenta construir el avatar; si la configuración está rota devuelve null y el director usa la figura genérica. */
export function construirPersonaAvatar(ctx: Ctx, gente: Set<Persona>, motor: MotorAvatar, config: unknown): Persona | null {
  try {
    return personaDeAvatar(ctx, gente, motor.A.construir(motor.normalizar(motor.A, config)));
  } catch {
    return null;
  }
}
