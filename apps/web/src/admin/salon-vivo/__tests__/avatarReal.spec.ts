import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MAX_AVATARES, personaDeAvatar, usaAvatarReal } from '../escena3d/avatarReal';
import { animarGente, type Persona } from '../escena3d/personas';
import type { Ctx } from '../escena3d/base';

const av = { url: '/archivos/a.png', config: { genero: 'mujer' } };

describe('¿avatar real o figura genérica?', () => {
  it('usa el avatar solo con configuración, sin modo ligero y con cupo', () => {
    expect(usaAvatarReal(av, false, 0)).toBe(true);
    expect(usaAvatarReal({ url: '/x.png', config: null }, false, 0)).toBe(false);
    expect(usaAvatarReal(null, false, 0)).toBe(false);
    expect(usaAvatarReal(undefined, false, 0)).toBe(false);
    expect(usaAvatarReal(av, true, 0)).toBe(false);
    expect(usaAvatarReal(av, false, MAX_AVATARES - 1)).toBe(true);
    expect(usaAvatarReal(av, false, MAX_AVATARES)).toBe(false);
  });
});

/** Partes mínimas con la forma del núcleo del avatar (sin piezas ni WebGL). */
const grupo = () => new THREE.Group();
function partes() {
  return {
    raiz: grupo(), cuerpo: grupo(), cabeza: grupo(), brazos: [grupo(), grupo()], codos: [grupo(), grupo()], piernas: [grupo(), grupo()],
    rodillas: [grupo(), grupo()], ojos: [grupo(), grupo()], boca: grupo(), animar: (() => undefined) as (t: number, dt: number) => void,
  };
}
const ctx = {
  M: (c: THREE.ColorRepresentation) => new THREE.MeshStandardMaterial({ color: c }),
  malla: (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, p?: THREE.Object3D) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p?.add(m); return m; },
} as unknown as Ctx;

describe('mascota del cliente en el salón', () => {
  it('se ve echada junto a la silla solo mientras el cliente está sentado', () => {
    const pa = partes() as ReturnType<typeof partes> & { mascota?: THREE.Group };
    const mascota = grupo();
    mascota.userData = { volador: true };
    pa.raiz.add(mascota);
    pa.mascota = mascota;
    let animadas = 0;
    pa.animar = () => { animadas++; };
    const gente = new Set<Persona>();
    const per = personaDeAvatar(ctx, gente, pa);
    new THREE.Scene().add(per.raiz);
    expect(mascota.userData.descanso).toBe(true);
    expect(mascota.userData.base).toBeLessThan(0.6); // las voladoras flotan bajito
    per.sentado = true;
    animarGente(gente, 1, 0.05, () => false);
    expect(mascota.visible).toBe(true);
    per.sentado = false;
    animarGente(gente, 2, 0.05, () => false);
    expect(mascota.visible).toBe(false);
    expect(animadas).toBe(2);
  });
});

describe('adaptador de animación del avatar', () => {
  it('queda como Persona escalada y el director la anima como a las genéricas (comiendo, mano arriba, caminando)', () => {
    const pa = partes();
    let llamadas = 0;
    pa.animar = () => { llamadas++; };
    const gente = new Set<Persona>();
    const per = personaDeAvatar(ctx, gente, pa);
    expect(gente.has(per)).toBe(true);
    expect(per.avatarReal).toBe(true);
    expect(per.raiz.scale.x).toBeCloseTo(0.86);
    expect(per.raiz.children).toContain(pa.raiz);
    expect(per.cola).toBeNull();
    new THREE.Scene().add(per.raiz);

    per.sentado = true; per.mesaId = 'm1';
    animarGente(gente, 1, 0.05, () => true);
    expect(pa.brazos[0].rotation.x).toBeLessThan(0);
    expect(llamadas).toBe(1);
    per.manoArriba = true;
    for (let i = 0; i < 40; i++) animarGente(gente, 1 + i * 0.05, 0.05, () => false);
    expect(pa.brazos[0].rotation.z).toBeLessThan(-1.5);

    per.sentado = false; per.manoArriba = false; per.ritmo = 1; per.paso = 1;
    animarGente(gente, 3, 0.05, () => false);
    expect(Math.abs(pa.piernas[0].rotation.x)).toBeGreaterThan(0.1);
    expect(per.tel.parent).toBe(pa.codos[0]);
  });

  it('sin boca en las partes no revienta', () => {
    const pa: any = partes();
    delete pa.boca;
    expect(personaDeAvatar(ctx, new Set(), pa).boca).toBeTruthy();
  });
});
