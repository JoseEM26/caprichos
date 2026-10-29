/**
 * construirCapri.ts
 * Construcción procedural en Three.js del personaje Capri (Mascota oficial de Caprichos).
 * Sin modelos ni texturas externas: usa geometrías estándar y materiales con la paleta de marca,
 * admitiendo personalización completa de aspecto (piel, cabello, ojos, uniforme, gorro y accesorios).
 */

import * as THREE from 'three';
import type { PoseCapri } from './animaciones';
import type { AspectoCapri } from './tiposAspecto';
import { sanitizarAspecto } from './aspectoUtils';

export const COLORES_CAPRI = {
  azulMarino: 0x1C1C22, // negro suave del uniforme
  crema: 0xFBF4EC,      // --cp-cream
  naranja: 0xE67929,    // --cp-orange
  dorado: 0xD99E39,     // --cp-gold
  oxido: 0xB2500F,      // --cp-rust
  mejillas: 0xF78D74,   // rubor sonrojado suave
  blanco: 0xFFFFFF,
  sombra: 0x0B2C3E,
};

export interface PiezasCapri {
  raiz: THREE.Group;
  personaje: THREE.Group;
  cuerpo: THREE.Group;
  cabeza: THREE.Group;
  brazoIzquierdo: THREE.Group; // Brazo con manito tenedor
  brazoDerecho: THREE.Group;   // Brazo con manito cuchillo/espátula
  ojoIzquierdo: THREE.Group;
  ojoDerecho: THREE.Group;
  parpados: {
    izquierdo: THREE.Group;
    derecho: THREE.Group;
  };
  boca: THREE.Mesh;
  accesorioPensar: THREE.Group;
  accesorioBrillo: THREE.Group;
  sombraContacto: THREE.Mesh;
  materiales: THREE.Material[];
  geometrias: THREE.BufferGeometry[];
}

/**
 * Registra una geometría para su posterior disposición limpia.
 */
function registrarGeo<T extends THREE.BufferGeometry>(geo: T, coleccion: THREE.BufferGeometry[]): T {
  coleccion.push(geo);
  return geo;
}

/**
 * Registra un material para su posterior disposición limpia.
 */
function registrarMat<T extends THREE.Material>(mat: T, coleccion: THREE.Material[]): T {
  coleccion.push(mat);
  return mat;
}

/**
 * Convierte un color hex a número Three.js.
 */
function colorANumero(hex: string, defecto: number): number {
  try {
    return new THREE.Color(hex).getHex();
  } catch {
    return defecto;
  }
}

/**
 * Arma proceduralmente la jerarquía 3D de Capri y devuelve sus piezas animables.
 * Acepta un aspecto configurable con piel, cabello, ojos, uniforme, gorro y accesorios.
 */
export function construirCapri(aspectoProp?: AspectoCapri): PiezasCapri {
  const asp = sanitizarAspecto(aspectoProp);
  const geometrias: THREE.BufferGeometry[] = [];
  const materiales: THREE.Material[] = [];

  const hexPrincipal = colorANumero(asp.uniforme.principal, COLORES_CAPRI.naranja);
  const hexDelantal = colorANumero(asp.uniforme.delantal, COLORES_CAPRI.azulMarino);
  const hexRibete = colorANumero(asp.uniforme.ribete, COLORES_CAPRI.dorado);
  const hexPiel = colorANumero(asp.piel, 0xFFD9B5);
  const hexPelo = colorANumero(asp.cabello.color, 0x4A2C1D);
  const hexOjos = colorANumero(asp.ojos, 0x14141A);
  const hexGorro = colorANumero(asp.gorro.color, COLORES_CAPRI.crema);

  // ==========================================
  // MATERIALES BASE (Estilo vinilo Pixar suave)
  // ==========================================
  const matPrincipal = registrarMat(
    new THREE.MeshStandardMaterial({
      color: hexPrincipal,
      roughness: 0.5,
      metalness: 0.05,
    }),
    materiales
  );

  const matDelantal = registrarMat(
    new THREE.MeshStandardMaterial({
      color: hexDelantal,
      roughness: 0.4,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    materiales
  );

  const matRibete = registrarMat(
    new THREE.MeshStandardMaterial({
      color: hexRibete,
      roughness: 0.22,
      metalness: 0.45,
    }),
    materiales
  );

  const matPiel = registrarMat(
    new THREE.MeshStandardMaterial({
      color: hexPiel,
      roughness: 0.5,
      metalness: 0,
    }),
    materiales
  );

  const matPelo = registrarMat(
    new THREE.MeshStandardMaterial({
      color: hexPelo,
      roughness: 0.55,
      metalness: 0,
    }),
    materiales
  );

  const matMejilla = registrarMat(
    new THREE.MeshStandardMaterial({
      color: COLORES_CAPRI.mejillas,
      roughness: 0.5,
      metalness: 0,
    }),
    materiales
  );

  const matPupila = registrarMat(
    new THREE.MeshStandardMaterial({
      color: hexOjos,
      roughness: 0.45,
      metalness: 0,
    }),
    materiales
  );

  const matBrilloOjo = registrarMat(
    new THREE.MeshBasicMaterial({
      color: COLORES_CAPRI.blanco,
    }),
    materiales
  );

  const matSombra = registrarMat(
    new THREE.MeshBasicMaterial({
      color: COLORES_CAPRI.sombra,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
    materiales
  );

  const matPensar = registrarMat(
    new THREE.MeshStandardMaterial({
      color: hexRibete,
      emissive: hexRibete,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.3,
    }),
    materiales
  );

  const matGorro = registrarMat(
    new THREE.MeshStandardMaterial({
      color: hexGorro,
      roughness: 0.9,
      metalness: 0,
    }),
    materiales
  );

  const matBlanco = registrarMat(
    new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.8,
      metalness: 0,
    }),
    materiales
  );

  const matRojo = registrarMat(
    new THREE.MeshStandardMaterial({
      color: 0xC5221F,
      roughness: 0.5,
      metalness: 0.1,
    }),
    materiales
  );

  const matNegro = registrarMat(
    new THREE.MeshStandardMaterial({
      color: 0x1C1C22,
      roughness: 0.4,
      metalness: 0.1,
    }),
    materiales
  );

  // ==========================================
  // GRUPO RAÍZ Y SOMBRA DE CONTACTO
  // ==========================================
  const raiz = new THREE.Group();
  raiz.name = 'capri-raiz';

  const geoSombra = registrarGeo(new THREE.CircleGeometry(0.75, 32), geometrias);
  const sombraContacto = new THREE.Mesh(geoSombra, matSombra);
  sombraContacto.name = 'sombra-contacto';
  sombraContacto.rotation.x = -Math.PI / 2;
  sombraContacto.position.y = -1.15;
  raiz.add(sombraContacto);

  const personaje = new THREE.Group();
  personaje.name = 'capri-personaje';
  personaje.position.y = 0;
  raiz.add(personaje);

  // ==========================================
  // CUERPO: CAMPANA NARANJA (el cono del logo) + DELANTAL
  // ==========================================
  const cuerpo = new THREE.Group();
  cuerpo.name = 'capri-cuerpo';
  personaje.add(cuerpo);

  const perfilCuerpo = [
    [0.0, 0.1], [0.3, 0.1], [0.4, 0.0], [0.45, -0.14], [0.52, -0.38],
    [0.62, -0.66], [0.72, -0.9], [0.73, -1.0], [0.62, -1.08], [0.3, -1.12], [0.0, -1.12],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geoCuerpo = registrarGeo(new THREE.LatheGeometry(perfilCuerpo, 48), geometrias);
  const mallaCuerpo = new THREE.Mesh(geoCuerpo, matPrincipal);
  cuerpo.add(mallaCuerpo);

  // Prenda del uniforme: chaqueta (delantal con bolsillo), mandil, pechera o polo
  const prenda = asp.uniforme.prenda ?? 'chaqueta';
  const geoBoton = registrarGeo(new THREE.SphereGeometry(0.04, 16, 16), geometrias);

  if (prenda === 'chaqueta' || prenda === 'mandil') {
    // Delantal
    const perfilDelantal = perfilCuerpo
      .filter((p) => p.y <= -0.14 && p.y >= -0.9)
      .map((p) => new THREE.Vector2(p.x + 0.014, p.y));
    const geoDelantal = registrarGeo(
      new THREE.LatheGeometry(perfilDelantal, 32, -0.62, 1.24),
      geometrias
    );
    const mallaDelantal = new THREE.Mesh(geoDelantal, matDelantal);
    cuerpo.add(mallaDelantal);

    // Ribete superior del delantal
    const geoRibeteDelantal = registrarGeo(
      new THREE.TorusGeometry(0.455, 0.016, 12, 32, 1.24),
      geometrias
    );
    const ribeteDelantal = new THREE.Mesh(geoRibeteDelantal, matRibete);
    ribeteDelantal.rotation.x = Math.PI / 2;
    ribeteDelantal.rotation.z = Math.PI / 2 - 0.62;
    ribeteDelantal.position.y = -0.14;
    cuerpo.add(ribeteDelantal);

    // Ribete inferior del delantal (dobladillo)
    const geoDobladillo = registrarGeo(new THREE.TorusGeometry(0.735, 0.017, 12, 32, 1.24), geometrias);
    const dobladillo = new THREE.Mesh(geoDobladillo, matRibete);
    dobladillo.rotation.x = Math.PI / 2;
    dobladillo.rotation.z = Math.PI / 2 - 0.62;
    dobladillo.position.y = -0.9;
    cuerpo.add(dobladillo);
  }

  if (prenda === 'chaqueta') {
    // Botones
    const boton1 = new THREE.Mesh(geoBoton, matRibete);
    boton1.position.set(0, -0.3, 0.5);
    cuerpo.add(boton1);

    const boton2 = new THREE.Mesh(geoBoton, matRibete);
    boton2.position.set(0, -0.5, 0.57);
    cuerpo.add(boton2);

    // Bolsillo con cucharita
    const geoBolsillo = registrarGeo(new THREE.CapsuleGeometry(0.1, 0.1, 6, 16), geometrias);
    const bolsillo = new THREE.Mesh(geoBolsillo, matPrincipal);
    bolsillo.rotation.z = Math.PI / 2;
    bolsillo.scale.set(1, 1, 0.35);
    bolsillo.position.set(0.17, -0.68, 0.64);
    cuerpo.add(bolsillo);

    const geoCuchara = registrarGeo(new THREE.CapsuleGeometry(0.014, 0.12, 4, 10), geometrias);
    const cuchara = new THREE.Mesh(geoCuchara, matRibete);
    cuchara.position.set(0.2, -0.56, 0.62);
    cuchara.rotation.z = -0.25;
    cuerpo.add(cuchara);
    const geoCucharaPunta = registrarGeo(new THREE.SphereGeometry(0.032, 12, 12), geometrias);
    const cucharaPunta = new THREE.Mesh(geoCucharaPunta, matRibete);
    cucharaPunta.scale.set(1, 1.3, 0.5);
    cucharaPunta.position.set(0.212, -0.485, 0.62);
    cuerpo.add(cucharaPunta);
  }

  if (prenda === 'pechera') {
    const geoPechera = registrarGeo(new THREE.BoxGeometry(0.34, 0.3, 0.03), geometrias);
    const pechera = new THREE.Mesh(geoPechera, matDelantal);
    pechera.position.set(0, -0.32, 0.5);
    cuerpo.add(pechera);

    const geoTirante = registrarGeo(new THREE.BoxGeometry(0.03, 0.22, 0.03), geometrias);
    for (const lado of [-1, 1]) {
      const tirante = new THREE.Mesh(geoTirante, matDelantal);
      tirante.position.set(lado * 0.12, -0.02, 0.46);
      tirante.rotation.z = lado * -0.25;
      cuerpo.add(tirante);
    }
  }

  if (prenda === 'polo') {
    // Polo: sin delantal, con bolsillo del pecho en color de ribete
    const geoBolsilloPolo = registrarGeo(new THREE.BoxGeometry(0.12, 0.1, 0.03), geometrias);
    const bolsilloPolo = new THREE.Mesh(geoBolsilloPolo, matRibete);
    bolsilloPolo.position.set(0.2, -0.28, 0.5);
    cuerpo.add(bolsilloPolo);
  }

  // Cuello que une cabeza con cuerpo
  const geoRibete = registrarGeo(new THREE.TorusGeometry(0.31, 0.055, 16, 36), geometrias);
  const ribeteCuello = new THREE.Mesh(geoRibete, matRibete);
  ribeteCuello.rotation.x = Math.PI / 2;
  ribeteCuello.position.y = 0.1;
  cuerpo.add(ribeteCuello);

  // Zapatitos que asoman al frente de la falda
  const geoPiecito = registrarGeo(new THREE.SphereGeometry(0.17, 20, 16), geometrias);
  const pieIzq = new THREE.Mesh(geoPiecito, matNegro);
  pieIzq.scale.set(1.0, 0.62, 1.45);
  pieIzq.position.set(-0.27, -1.04, 0.5);
  cuerpo.add(pieIzq);

  const pieDer = new THREE.Mesh(geoPiecito, matNegro);
  pieDer.scale.set(1.0, 0.62, 1.45);
  pieDer.position.set(0.27, -1.04, 0.5);
  cuerpo.add(pieDer);

  // ==========================================
  // ACCESORIOS EN EL CUERPO (3D)
  // ==========================================
  if (asp.accesorios.includes('mochila')) {
    const matMochila = registrarMat(new THREE.MeshStandardMaterial({ color: 0x2F7A45, roughness: 0.6 }), materiales);
    const geoMochila = registrarGeo(new THREE.BoxGeometry(0.86, 0.7, 0.2), geometrias);
    const mochila = new THREE.Mesh(geoMochila, matMochila);
    mochila.position.set(0, -0.5, -0.74);
    mochila.name = 'capri-acc-mochila';
    cuerpo.add(mochila);
  }

  if (asp.accesorios.includes('banda')) {
    const geoBanda = registrarGeo(new THREE.BoxGeometry(0.1, 1.05, 0.03), geometrias);
    const banda = new THREE.Mesh(geoBanda, matRojo);
    banda.position.set(0.02, -0.5, 0.56);
    banda.rotation.z = -0.8;
    banda.name = 'capri-acc-banda';
    cuerpo.add(banda);
  }

  if (asp.accesorios.includes('medalla')) {
    const geoCintaMedalla = registrarGeo(new THREE.BoxGeometry(0.03, 0.2, 0.01), geometrias);
    for (const lado of [-1, 1]) {
      const cinta = new THREE.Mesh(geoCintaMedalla, matRojo);
      cinta.position.set(lado * 0.05, 0.0, 0.42);
      cinta.rotation.z = lado * -0.25;
      cuerpo.add(cinta);
    }
    const geoMedalla = registrarGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 24), geometrias);
    const medalla = new THREE.Mesh(geoMedalla, matRibete);
    medalla.rotation.x = Math.PI / 2;
    medalla.position.set(0, -0.12, 0.46);
    medalla.name = 'capri-acc-medalla';
    cuerpo.add(medalla);
  }

  if (asp.accesorios.includes('bufanda')) {
    const geoBufandaCuello = registrarGeo(new THREE.TorusGeometry(0.35, 0.08, 16, 36), geometrias);
    const bufandaCuello = new THREE.Mesh(geoBufandaCuello, matRojo);
    bufandaCuello.rotation.x = Math.PI / 2;
    bufandaCuello.position.set(0, 0.12, 0);
    cuerpo.add(bufandaCuello);

    const geoBufandaCola = registrarGeo(new THREE.BoxGeometry(0.12, 0.42, 0.04), geometrias);
    const bufandaCola = new THREE.Mesh(geoBufandaCola, matRojo);
    bufandaCola.position.set(0.14, -0.22, 0.42);
    bufandaCola.rotation.z = 0.12;
    cuerpo.add(bufandaCola);
  }

  if (asp.accesorios.includes('calabaza')) {
    const geoCalabaza = registrarGeo(new THREE.SphereGeometry(0.12, 16, 16), geometrias);
    const calabazaMesh = new THREE.Mesh(geoCalabaza, matPrincipal);
    calabazaMesh.scale.set(1.1, 0.9, 0.8);
    calabazaMesh.position.set(0.18, -0.36, 0.54);
    cuerpo.add(calabazaMesh);

    const geoTallo = registrarGeo(new THREE.CylinderGeometry(0.016, 0.02, 0.06, 8), geometrias);
    const matVerde = registrarMat(
      new THREE.MeshStandardMaterial({ color: 0x2F7A45 }),
      materiales
    );
    const tallo = new THREE.Mesh(geoTallo, matVerde);
    tallo.position.set(0.18, -0.28, 0.54);
    cuerpo.add(tallo);
  }

  if (asp.accesorios.includes('corazon')) {
    const geoCorazon = registrarGeo(new THREE.SphereGeometry(0.06, 16, 16), geometrias);
    const matRosa = registrarMat(new THREE.MeshStandardMaterial({ color: 0xE84A7F }), materiales);
    const corA = new THREE.Mesh(geoCorazon, matRosa);
    corA.position.set(-0.16, -0.34, 0.52);
    const corB = new THREE.Mesh(geoCorazon, matRosa);
    corB.position.set(-0.10, -0.34, 0.52);
    cuerpo.add(corA);
    cuerpo.add(corB);
  }

  if (asp.accesorios.includes('bandera')) {
    const geoBandera = registrarGeo(new THREE.BoxGeometry(0.04, 0.14, 0.02), geometrias);
    const fRojo1 = new THREE.Mesh(geoBandera, matRojo);
    fRojo1.position.set(-0.18, -0.34, 0.52);
    const fBlanco = new THREE.Mesh(geoBandera, matBlanco);
    fBlanco.position.set(-0.14, -0.34, 0.52);
    const fRojo2 = new THREE.Mesh(geoBandera, matRojo);
    fRojo2.position.set(-0.10, -0.34, 0.52);
    cuerpo.add(fRojo1);
    cuerpo.add(fBlanco);
    cuerpo.add(fRojo2);
  }

  if (asp.accesorios.includes('lazo')) {
    const geoLazo = registrarGeo(new THREE.SphereGeometry(0.07, 16, 16), geometrias);
    const lazoIzq = new THREE.Mesh(geoLazo, matDelantal);
    lazoIzq.scale.set(1.2, 0.8, 0.7);
    lazoIzq.position.set(-0.075, 0.07, 0.34);
    cuerpo.add(lazoIzq);
    const lazoDer = new THREE.Mesh(geoLazo, matDelantal);
    lazoDer.scale.set(1.2, 0.8, 0.7);
    lazoDer.position.set(0.075, 0.07, 0.34);
    cuerpo.add(lazoDer);
    const nudoLazo = new THREE.Mesh(geoBoton, matRibete);
    nudoLazo.scale.setScalar(1.1);
    nudoLazo.position.set(0, 0.07, 0.36);
    cuerpo.add(nudoLazo);
  }

  // ==========================================
  // CABEZA: CARITA, CABELLO Y GORRO
  // ==========================================
  const cabeza = new THREE.Group();
  cabeza.name = 'capri-cabeza';
  cabeza.position.y = 0.4;
  personaje.add(cabeza);

  // Carita redonda color piel
  const geoCara = registrarGeo(new THREE.SphereGeometry(0.54, 48, 36), geometrias);
  const cara = new THREE.Mesh(geoCara, matPiel);
  cabeza.add(cara);

  // Orejitas
  const geoOreja = registrarGeo(new THREE.SphereGeometry(0.09, 16, 16), geometrias);
  for (const lado of [-1, 1]) {
    const oreja = new THREE.Mesh(geoOreja, matPiel);
    oreja.scale.set(0.6, 1, 0.8);
    oreja.position.set(lado * 0.54, -0.02, 0);
    cabeza.add(oreja);
  }

  // Cabello: casquete atrás y flequillo frontal
  const geoCasquete = registrarGeo(new THREE.SphereGeometry(0.58, 40, 30), geometrias);
  const casquete = new THREE.Mesh(geoCasquete, matPelo);
  casquete.position.set(0, 0.03, -0.07);
  cabeza.add(casquete);

  const geoFlequillo = registrarGeo(new THREE.SphereGeometry(0.15, 20, 20), geometrias);
  [[-0.3, 0.3, 0.33, 0.9], [-0.1, 0.34, 0.37, 1], [0.1, 0.34, 0.37, 1], [0.3, 0.3, 0.33, 0.9]].forEach(([x, y, z, k]) => {
    const m = new THREE.Mesh(geoFlequillo, matPelo);
    m.scale.set(k, 0.8, 0.7);
    m.position.set(x, y, z);
    cabeza.add(m);
  });

  // Estilos de Cabello
  const geoMechon = registrarGeo(new THREE.CapsuleGeometry(0.08, 0.24, 6, 14), geometrias);
  const geoColita = registrarGeo(new THREE.CapsuleGeometry(0.085, 0.22, 8, 16), geometrias);
  const geoMonito = registrarGeo(new THREE.SphereGeometry(0.075, 14, 14), geometrias);

  if (asp.cabello.estilo === 'colitas') {
    for (const lado of [-1, 1]) {
      const mechon = new THREE.Mesh(geoMechon, matPelo);
      mechon.position.set(lado * 0.5, -0.02, 0.12);
      mechon.rotation.z = lado * 0.12;
      cabeza.add(mechon);

      const colita = new THREE.Mesh(geoColita, matPelo);
      colita.position.set(lado * 0.66, -0.13, -0.05);
      colita.rotation.z = lado * 0.55;
      cabeza.add(colita);

      const monoA = new THREE.Mesh(geoMonito, matPrincipal);
      monoA.scale.set(1.4, 0.9, 0.8);
      monoA.position.set(lado * 0.6, 0.0, 0.0);
      cabeza.add(monoA);
      const monoB = new THREE.Mesh(geoMonito, matRibete);
      monoB.position.set(lado * 0.6, 0.0, 0.05);
      cabeza.add(monoB);
    }
  } else if (asp.cabello.estilo === 'suelto') {
    const geoPeloSuelto = registrarGeo(new THREE.CapsuleGeometry(0.11, 0.48, 8, 16), geometrias);
    for (const lado of [-1, 1]) {
      const mechonLargo = new THREE.Mesh(geoPeloSuelto, matPelo);
      mechonLargo.position.set(lado * 0.52, -0.16, 0.08);
      mechonLargo.rotation.z = lado * 0.08;
      cabeza.add(mechonLargo);
    }
  } else if (asp.cabello.estilo === 'trenza') {
    const geoSegTrenza = registrarGeo(new THREE.SphereGeometry(0.075, 12, 12), geometrias);
    for (const lado of [-1, 1]) {
      for (let s = 0; s < 4; s++) {
        const seg = new THREE.Mesh(geoSegTrenza, matPelo);
        seg.position.set(lado * (0.52 + s * 0.02), -0.06 - s * 0.12, 0.04);
        cabeza.add(seg);
      }
      const atadura = new THREE.Mesh(geoBoton, matRibete);
      atadura.position.set(lado * 0.58, -0.46, 0.04);
      cabeza.add(atadura);
    }
  } else if (asp.cabello.estilo === 'mono') {
    const geoMonoAlto = registrarGeo(new THREE.SphereGeometry(0.24, 24, 20), geometrias);
    const monoAlto = new THREE.Mesh(geoMonoAlto, matPelo);
    monoAlto.position.set(0, 0.52, -0.12);
    cabeza.add(monoAlto);

    const geoCintaMono = registrarGeo(new THREE.TorusGeometry(0.2, 0.025, 12, 24), geometrias);
    const cintaMono = new THREE.Mesh(geoCintaMono, matRibete);
    cintaMono.rotation.x = Math.PI / 2;
    cintaMono.position.set(0, 0.44, -0.12);
    cabeza.add(cintaMono);
  } else if (asp.cabello.estilo === 'corto') {
    for (const lado of [-1, 1]) {
      const patilla = new THREE.Mesh(geoMechon, matPelo);
      patilla.scale.set(0.7, 0.8, 0.7);
      patilla.position.set(lado * 0.5, 0.12, 0.1);
      cabeza.add(patilla);
    }
  } else if (asp.cabello.estilo === 'rizado') {
    const geoRizo = registrarGeo(new THREE.SphereGeometry(0.1, 14, 14), geometrias);
    const posRizos: [number, number, number][] = [
      [-0.5, 0.28, 0.02], [-0.56, 0.1, 0.05], [-0.5, -0.08, 0.1],
      [0.5, 0.28, 0.02], [0.56, 0.1, 0.05], [0.5, -0.08, 0.1],
      [-0.25, 0.5, 0.0], [0.0, 0.54, -0.02], [0.25, 0.5, 0.0],
    ];
    for (const [x, y, z] of posRizos) {
      const rizo = new THREE.Mesh(geoRizo, matPelo);
      rizo.position.set(x, y, z);
      cabeza.add(rizo);
    }
  } else if (asp.cabello.estilo === 'melena') {
    const geoMelena = registrarGeo(new THREE.CapsuleGeometry(0.12, 0.42, 8, 16), geometrias);
    for (const lado of [-1, 1]) {
      const melena = new THREE.Mesh(geoMelena, matPelo);
      melena.position.set(lado * 0.5, -0.2, -0.02);
      melena.rotation.z = lado * 0.1;
      cabeza.add(melena);
    }
  } else if (asp.cabello.estilo === 'coleta') {
    const geoColeta = registrarGeo(new THREE.CapsuleGeometry(0.09, 0.36, 8, 16), geometrias);
    const coleta = new THREE.Mesh(geoColeta, matPelo);
    coleta.position.set(0.56, 0.12, -0.15);
    coleta.rotation.z = -0.5;
    cabeza.add(coleta);
    const cintaColeta = new THREE.Mesh(geoBoton, matRibete);
    cintaColeta.position.set(0.5, 0.26, 0.0);
    cabeza.add(cintaColeta);
  }

  // ==========================================
  // GORRO (Configurable por tipo)
  // ==========================================
  const gorro = new THREE.Group();
  gorro.name = 'capri-gorro';
  gorro.position.y = 0.53;
  cabeza.add(gorro);

  if (asp.gorro.tipo === 'chef') {
    const geoBandaGorro = registrarGeo(new THREE.CylinderGeometry(0.43, 0.41, 0.26, 36), geometrias);
    const bandaGorro = new THREE.Mesh(geoBandaGorro, matGorro);
    gorro.add(bandaGorro);

    const geoCintaGorro = registrarGeo(new THREE.TorusGeometry(0.42, 0.022, 12, 36), geometrias);
    const cintaGorro = new THREE.Mesh(geoCintaGorro, matDelantal);
    cintaGorro.rotation.x = Math.PI / 2;
    cintaGorro.position.y = -0.08;
    gorro.add(cintaGorro);
    const cintaDorada = new THREE.Mesh(geoCintaGorro, matRibete);
    cintaDorada.rotation.x = Math.PI / 2;
    cintaDorada.position.y = -0.12;
    cintaDorada.scale.setScalar(0.99);
    gorro.add(cintaDorada);

    const geoDomoCentro = registrarGeo(new THREE.SphereGeometry(0.4, 32, 24), geometrias);
    const domoCentro = new THREE.Mesh(geoDomoCentro, matGorro);
    domoCentro.position.y = 0.42;
    gorro.add(domoCentro);

    const geoLobulo = registrarGeo(new THREE.SphereGeometry(0.26, 20, 20), geometrias);
    for (let i = 0; i < 6; i++) {
      const angulo = (i / 6) * Math.PI * 2;
      const lobulo = new THREE.Mesh(geoLobulo, matGorro);
      lobulo.position.set(Math.cos(angulo) * 0.3, 0.3, Math.sin(angulo) * 0.3);
      gorro.add(lobulo);
    }
  } else if (asp.gorro.tipo === 'bruja') {
    const geoAlaBruja = registrarGeo(new THREE.CylinderGeometry(0.72, 0.72, 0.04, 36), geometrias);
    const alaBruja = new THREE.Mesh(geoAlaBruja, matGorro);
    alaBruja.position.y = -0.06;
    gorro.add(alaBruja);

    const geoConoBruja = registrarGeo(new THREE.ConeGeometry(0.44, 0.95, 36), geometrias);
    const conoBruja = new THREE.Mesh(geoConoBruja, matGorro);
    conoBruja.position.set(0, 0.42, -0.06);
    conoBruja.rotation.x = -0.15;
    gorro.add(conoBruja);

    const geoCintaBruja = registrarGeo(new THREE.TorusGeometry(0.44, 0.03, 12, 36), geometrias);
    const cintaBruja = new THREE.Mesh(geoCintaBruja, matRibete);
    cintaBruja.rotation.x = Math.PI / 2;
    cintaBruja.position.y = -0.02;
    gorro.add(cintaBruja);
  } else if (asp.gorro.tipo === 'navideno') {
    const geoBandaNavid = registrarGeo(new THREE.CylinderGeometry(0.46, 0.44, 0.16, 36), geometrias);
    const bandaNavid = new THREE.Mesh(geoBandaNavid, matBlanco);
    gorro.add(bandaNavid);

    const geoConoNavid = registrarGeo(new THREE.ConeGeometry(0.43, 0.82, 36), geometrias);
    const conoNavid = new THREE.Mesh(geoConoNavid, matGorro);
    conoNavid.position.set(0.12, 0.36, -0.08);
    conoNavid.rotation.z = -0.32;
    gorro.add(conoNavid);

    const geoPompon = registrarGeo(new THREE.SphereGeometry(0.13, 16, 16), geometrias);
    const pompon = new THREE.Mesh(geoPompon, matBlanco);
    pompon.position.set(0.38, 0.58, -0.08);
    gorro.add(pompon);
  } else if (asp.gorro.tipo === 'corona') {
    const geoAroCorona = registrarGeo(new THREE.TorusGeometry(0.38, 0.03, 12, 36), geometrias);
    const aroCorona = new THREE.Mesh(geoAroCorona, matRibete);
    aroCorona.rotation.x = Math.PI / 2;
    gorro.add(aroCorona);

    const geoPico = registrarGeo(new THREE.ConeGeometry(0.07, 0.22, 12), geometrias);
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const pico = new THREE.Mesh(geoPico, matRibete);
      pico.position.set(Math.cos(ang) * 0.38, 0.12, Math.sin(ang) * 0.38);
      gorro.add(pico);
    }
  } else if (asp.gorro.tipo === 'sombrero') {
    const geoAlaSomb = registrarGeo(new THREE.CylinderGeometry(0.68, 0.68, 0.03, 36), geometrias);
    const alaSomb = new THREE.Mesh(geoAlaSomb, matGorro);
    alaSomb.position.y = -0.04;
    gorro.add(alaSomb);

    const geoCopaSomb = registrarGeo(new THREE.CylinderGeometry(0.38, 0.42, 0.34, 36), geometrias);
    const copaSomb = new THREE.Mesh(geoCopaSomb, matGorro);
    copaSomb.position.y = 0.13;
    gorro.add(copaSomb);

    const geoCintaSomb = registrarGeo(new THREE.TorusGeometry(0.41, 0.02, 12, 36), geometrias);
    const cintaSomb = new THREE.Mesh(geoCintaSomb, matRibete);
    cintaSomb.rotation.x = Math.PI / 2;
    cintaSomb.position.y = 0.0;
    gorro.add(cintaSomb);
  } else if (asp.gorro.tipo === 'gorra') {
    const geoDomoGorra = registrarGeo(
      new THREE.SphereGeometry(0.5, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      geometrias
    );
    const domoGorra = new THREE.Mesh(geoDomoGorra, matGorro);
    domoGorra.scale.set(1, 0.7, 1);
    domoGorra.position.y = 0.04;
    gorro.add(domoGorra);

    const geoVisera = registrarGeo(new THREE.BoxGeometry(0.5, 0.03, 0.3), geometrias);
    const visera = new THREE.Mesh(geoVisera, matGorro);
    visera.position.set(0, 0.02, 0.38);
    visera.rotation.x = -0.12;
    gorro.add(visera);

    const botonGorra = new THREE.Mesh(geoBoton, matRibete);
    botonGorra.position.set(0, 0.3, 0);
    gorro.add(botonGorra);
  } else if (asp.gorro.tipo === 'boina') {
    const geoBoina = registrarGeo(new THREE.SphereGeometry(0.5, 32, 16), geometrias);
    const boina = new THREE.Mesh(geoBoina, matGorro);
    boina.scale.set(1.1, 0.22, 1.05);
    boina.position.set(0.04, 0.1, -0.02);
    boina.rotation.z = -0.12;
    gorro.add(boina);

    const tallo = new THREE.Mesh(geoBoton, matDelantal);
    tallo.scale.setScalar(0.7);
    tallo.position.set(0.08, 0.26, 0.0);
    gorro.add(tallo);
  } else if (asp.gorro.tipo === 'beanie') {
    const geoBeanie = registrarGeo(
      new THREE.SphereGeometry(0.5, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      geometrias
    );
    const beanie = new THREE.Mesh(geoBeanie, matGorro);
    beanie.scale.set(1, 0.85, 1);
    gorro.add(beanie);

    const geoPuno = registrarGeo(new THREE.TorusGeometry(0.47, 0.06, 12, 36), geometrias);
    const puno = new THREE.Mesh(geoPuno, matPrincipal);
    puno.rotation.x = Math.PI / 2;
    puno.position.y = 0.0;
    gorro.add(puno);

    const pomponBeanie = new THREE.Mesh(geoBoton, matPrincipal);
    pomponBeanie.scale.setScalar(2.2);
    pomponBeanie.position.set(0, 0.44, 0);
    gorro.add(pomponBeanie);
  } else if (asp.gorro.tipo === 'diadema') {
    const geoDiadema = registrarGeo(new THREE.TorusGeometry(0.6, 0.03, 10, 48), geometrias);
    const diadema = new THREE.Mesh(geoDiadema, matRibete);
    diadema.rotation.x = Math.PI / 2;
    diadema.position.y = -0.31;
    gorro.add(diadema);
  }

  // Pestañas
  const geoPestana = registrarGeo(new THREE.TorusGeometry(0.14, 0.012, 8, 20, Math.PI * 0.75), geometrias);
  const geoRayita = registrarGeo(new THREE.CapsuleGeometry(0.008, 0.06, 4, 8), geometrias);
  for (const lado of [-1, 1]) {
    const arco = new THREE.Mesh(geoPestana, matNegro);
    arco.position.set(lado * 0.2, 0.03, 0.52);
    arco.rotation.z = Math.PI * 0.125;
    cabeza.add(arco);
    for (const [dx, dy, rz] of [[0.14, 0.1, -0.9], [0.17, 0.04, -1.3]]) {
      const r = new THREE.Mesh(geoRayita, matNegro);
      r.position.set(lado * (0.2 + dx), 0.03 + dy, 0.5);
      r.rotation.z = lado * rz;
      cabeza.add(r);
    }
  }

  // OJOS
  const geoOjo = registrarGeo(new THREE.SphereGeometry(0.125, 28, 28), geometrias);
  const geoBrilloGrande = registrarGeo(new THREE.SphereGeometry(0.045, 16, 16), geometrias);
  const geoBrilloPequeno = registrarGeo(new THREE.SphereGeometry(0.024, 16, 16), geometrias);

  // Ojo Izquierdo
  const ojoIzquierdo = new THREE.Group();
  ojoIzquierdo.name = 'ojo-izquierdo';
  ojoIzquierdo.position.set(-0.2, 0.03, 0.47);

  const pupilaIzq = new THREE.Mesh(geoOjo, matPupila);
  pupilaIzq.scale.set(1, 1.15, 0.85);
  ojoIzquierdo.add(pupilaIzq);

  const brilloIzq1 = new THREE.Mesh(geoBrilloGrande, matBrilloOjo);
  brilloIzq1.position.set(0.035, 0.05, 0.095);
  ojoIzquierdo.add(brilloIzq1);

  const brilloIzq2 = new THREE.Mesh(geoBrilloPequeno, matBrilloOjo);
  brilloIzq2.position.set(-0.036, -0.036, 0.095);
  ojoIzquierdo.add(brilloIzq2);
  cabeza.add(ojoIzquierdo);

  // Párpado Izquierdo
  const parpadoIzqGroup = new THREE.Group();
  parpadoIzqGroup.position.set(-0.2, 0.03, 0.47);
  const geoParpado = registrarGeo(
    new THREE.SphereGeometry(0.136, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    geometrias
  );
  const parpadoIzqMalla = new THREE.Mesh(geoParpado, matPiel);
  parpadoIzqMalla.rotation.x = Math.PI / 2;
  parpadoIzqGroup.add(parpadoIzqMalla);
  parpadoIzqGroup.scale.set(1, 1, 0.001);
  cabeza.add(parpadoIzqGroup);

  // Ojo Derecho
  const ojoDerecho = new THREE.Group();
  ojoDerecho.name = 'ojo-derecho';
  ojoDerecho.position.set(0.2, 0.03, 0.47);

  const pupilaDer = new THREE.Mesh(geoOjo, matPupila);
  pupilaDer.scale.set(1, 1.15, 0.85);
  ojoDerecho.add(pupilaDer);

  const brilloDer1 = new THREE.Mesh(geoBrilloGrande, matBrilloOjo);
  brilloDer1.position.set(0.035, 0.05, 0.095);
  ojoDerecho.add(brilloDer1);

  const brilloDer2 = new THREE.Mesh(geoBrilloPequeno, matBrilloOjo);
  brilloDer2.position.set(-0.036, -0.036, 0.095);
  ojoDerecho.add(brilloDer2);
  cabeza.add(ojoDerecho);

  // Párpado Derecho
  const parpadoDerGroup = new THREE.Group();
  parpadoDerGroup.position.set(0.2, 0.03, 0.47);
  const parpadoDerMalla = new THREE.Mesh(geoParpado, matPiel);
  parpadoDerMalla.rotation.x = Math.PI / 2;
  parpadoDerGroup.add(parpadoDerMalla);
  parpadoDerGroup.scale.set(1, 1, 0.001);
  cabeza.add(parpadoDerGroup);

  // Accesorios faciales (antifaz, bigote)
  if (asp.accesorios.includes('antifaz')) {
    const geoAntifaz = registrarGeo(new THREE.BoxGeometry(0.68, 0.16, 0.08), geometrias);
    const antifaz = new THREE.Mesh(geoAntifaz, matNegro);
    antifaz.position.set(0, 0.03, 0.54);
    cabeza.add(antifaz);
  }

  if (asp.accesorios.includes('lentes')) {
    const geoLente = registrarGeo(new THREE.TorusGeometry(0.17, 0.02, 10, 32), geometrias);
    for (const lado of [-1, 1]) {
      const lente = new THREE.Mesh(geoLente, matNegro);
      lente.position.set(lado * 0.2, 0.03, 0.52);
      cabeza.add(lente);
    }
    const geoPuente = registrarGeo(new THREE.CapsuleGeometry(0.012, 0.1, 4, 8), geometrias);
    const puente = new THREE.Mesh(geoPuente, matNegro);
    puente.rotation.z = Math.PI / 2;
    puente.position.set(0, 0.05, 0.52);
    cabeza.add(puente);
  }

  if (asp.accesorios.includes('aretes')) {
    const geoArete = registrarGeo(new THREE.SphereGeometry(0.035, 12, 12), geometrias);
    for (const lado of [-1, 1]) {
      const arete = new THREE.Mesh(geoArete, matRibete);
      arete.position.set(lado * 0.56, -0.12, 0.02);
      cabeza.add(arete);
    }
  }

  if (asp.accesorios.includes('flor')) {
    const geoPetalo = registrarGeo(new THREE.SphereGeometry(0.06, 12, 12), geometrias);
    const matFlor = registrarMat(new THREE.MeshStandardMaterial({ color: 0xE84A7F, roughness: 0.4 }), materiales);
    const flor = new THREE.Group();
    flor.name = 'capri-acc-flor';
    flor.position.set(-0.46, 0.4, 0.2);
    cabeza.add(flor);
    for (let i = 0; i < 5; i++) {
      const angulo = (i / 5) * Math.PI * 2;
      const petalo = new THREE.Mesh(geoPetalo, matFlor);
      petalo.position.set(Math.cos(angulo) * 0.07, Math.sin(angulo) * 0.07, 0);
      flor.add(petalo);
    }
    const centroFlor = new THREE.Mesh(geoBoton, matRibete);
    centroFlor.scale.setScalar(1.2);
    flor.add(centroFlor);
  }

  if (asp.accesorios.includes('confeti')) {
    const geoConfeti = registrarGeo(new THREE.BoxGeometry(0.04, 0.04, 0.01), geometrias);
    const coloresConfeti = [0x3BB4E7, 0xE84A7F, 0xD99E39, 0x2F7A45];
    const puntos: [number, number, number][] = [
      [-0.85, 0.5, 0.1], [0.85, 0.6, -0.1], [-0.8, -0.2, 0.3], [0.8, 0.0, 0.2], [0.0, 0.95, 0.1],
    ];
    puntos.forEach(([x, y, z], i) => {
      const matConfeti = registrarMat(
        new THREE.MeshStandardMaterial({ color: coloresConfeti[i % coloresConfeti.length] }),
        materiales
      );
      const pieza = new THREE.Mesh(geoConfeti, matConfeti);
      pieza.position.set(x, y, z);
      pieza.rotation.set(0.4 * i, 0.3 * i, 0.2 * i);
      personaje.add(pieza);
    });
  }

  if (asp.accesorios.includes('bigote')) {
    const geoBigote = registrarGeo(new THREE.CapsuleGeometry(0.03, 0.14, 4, 10), geometrias);
    for (const lado of [-1, 1]) {
      const b = new THREE.Mesh(geoBigote, matPelo);
      b.rotation.z = lado * 0.45;
      b.position.set(lado * 0.08, -0.08, 0.53);
      cabeza.add(b);
    }
  }

  // Mejillas
  const geoMejilla = registrarGeo(new THREE.SphereGeometry(0.068, 16, 16), geometrias);
  const mejillaIzq = new THREE.Mesh(geoMejilla, matMejilla);
  mejillaIzq.scale.set(1.35, 0.8, 0.35);
  mejillaIzq.position.set(-0.32, -0.1, 0.42);
  cabeza.add(mejillaIzq);

  const mejillaDer = new THREE.Mesh(geoMejilla, matMejilla);
  mejillaDer.scale.set(1.35, 0.8, 0.35);
  mejillaDer.position.set(0.32, -0.1, 0.42);
  cabeza.add(mejillaDer);

  // Boca
  const geoBoca = registrarGeo(
    new THREE.TorusGeometry(0.09, 0.018, 12, 24, Math.PI * 0.85),
    geometrias
  );
  const boca = new THREE.Mesh(geoBoca, matNegro);
  boca.name = 'capri-boca';
  boca.rotation.z = Math.PI * 1.07;
  boca.position.set(0, -0.14, 0.52);
  cabeza.add(boca);

  // ACCESORIO PENSAR
  const accesorioPensar = new THREE.Group();
  accesorioPensar.name = 'accesorio-pensar';
  accesorioPensar.position.set(0.75, 1.3, 0.1);
  accesorioPensar.scale.setScalar(0);

  const geoArcoInterrogacion = registrarGeo(
    new THREE.TorusGeometry(0.11, 0.028, 16, 24, Math.PI * 1.4),
    geometrias
  );
  const arcoInterrogacion = new THREE.Mesh(geoArcoInterrogacion, matPensar);
  arcoInterrogacion.rotation.z = -Math.PI * 0.2;
  accesorioPensar.add(arcoInterrogacion);

  const geoPuntoInterrogacion = registrarGeo(new THREE.SphereGeometry(0.035, 16, 16), geometrias);
  const puntoInterrogacion = new THREE.Mesh(geoPuntoInterrogacion, matPensar);
  puntoInterrogacion.position.set(0, -0.22, 0);
  accesorioPensar.add(puntoInterrogacion);
  cabeza.add(accesorioPensar);

  // ACCESORIO BRILLO
  const accesorioBrillo = new THREE.Group();
  accesorioBrillo.name = 'accesorio-brillo';
  accesorioBrillo.position.set(0, 1.55, 0);
  accesorioBrillo.scale.setScalar(0);

  const geoEstrella = registrarGeo(new THREE.OctahedronGeometry(0.09, 0), geometrias);
  const estrella1 = new THREE.Mesh(geoEstrella, matPensar);
  estrella1.position.set(-0.55, 0.1, 0.1);
  accesorioBrillo.add(estrella1);

  const estrella2 = new THREE.Mesh(geoEstrella, matPensar);
  estrella2.position.set(0.55, 0.15, 0.1);
  estrella2.scale.setScalar(0.85);
  accesorioBrillo.add(estrella2);

  const estrella3 = new THREE.Mesh(geoEstrella, matPensar);
  estrella3.position.set(0.0, 0.45, -0.1);
  estrella3.scale.setScalar(1.1);
  accesorioBrillo.add(estrella3);
  cabeza.add(accesorioBrillo);

  // ==========================================
  // BRAZO IZQUIERDO: MANITO TENEDOR
  // ==========================================
  const brazoIzquierdo = new THREE.Group();
  brazoIzquierdo.name = 'brazo-izquierdo';
  brazoIzquierdo.position.set(-0.43, -0.04, 0);
  cuerpo.add(brazoIzquierdo);

  const geoBrazo = registrarGeo(new THREE.CapsuleGeometry(0.068, 0.34, 6, 16), geometrias);
  const geoHombro = registrarGeo(new THREE.SphereGeometry(0.095, 20, 16), geometrias);
  brazoIzquierdo.add(new THREE.Mesh(geoHombro, matPrincipal));
  const mallaBrazoIzq = new THREE.Mesh(geoBrazo, matPrincipal);
  mallaBrazoIzq.position.y = -0.2;
  brazoIzquierdo.add(mallaBrazoIzq);

  const geoPuno = registrarGeo(new THREE.TorusGeometry(0.07, 0.02, 16, 20), geometrias);
  const punoIzq = new THREE.Mesh(geoPuno, matRibete);
  punoIzq.rotation.x = Math.PI / 2;
  punoIzq.position.y = -0.4;
  brazoIzquierdo.add(punoIzq);

  const tenedorGroup = new THREE.Group();
  tenedorGroup.position.y = -0.44;

  const geoPalmaTenedor = registrarGeo(new THREE.SphereGeometry(0.088, 16, 16), geometrias);
  const palmaTenedor = new THREE.Mesh(geoPalmaTenedor, matRibete);
  palmaTenedor.scale.set(1, 0.7, 0.4);
  tenedorGroup.add(palmaTenedor);

  const geoDiente = registrarGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.14, 12), geometrias);
  const geoPuntaDiente = registrarGeo(new THREE.SphereGeometry(0.016, 12, 12), geometrias);

  [-0.05, 0, 0.05].forEach((posX) => {
    const diente = new THREE.Mesh(geoDiente, matRibete);
    diente.position.set(posX, -0.11, 0);
    tenedorGroup.add(diente);

    const punta = new THREE.Mesh(geoPuntaDiente, matRibete);
    punta.position.set(posX, -0.18, 0);
    tenedorGroup.add(punta);
  });

  brazoIzquierdo.add(tenedorGroup);

  // ==========================================
  // BRAZO DERECHO: MANITO CUCHILLO / ESPÁTULA
  // ==========================================
  const brazoDerecho = new THREE.Group();
  brazoDerecho.name = 'brazo-derecho';
  brazoDerecho.position.set(0.43, -0.04, 0);
  cuerpo.add(brazoDerecho);

  const mallaBrazoDer = new THREE.Mesh(geoBrazo, matPrincipal);
  mallaBrazoDer.position.y = -0.2;
  brazoDerecho.add(mallaBrazoDer);
  brazoDerecho.add(new THREE.Mesh(geoHombro, matPrincipal));

  const punoDer = new THREE.Mesh(geoPuno, matRibete);
  punoDer.rotation.x = Math.PI / 2;
  punoDer.position.y = -0.4;
  brazoDerecho.add(punoDer);

  const cuchilloGroup = new THREE.Group();
  cuchilloGroup.position.y = -0.44;

  const geoHojaCuchillo = registrarGeo(new THREE.BoxGeometry(0.09, 0.22, 0.024), geometrias);
  const hojaCuchillo = new THREE.Mesh(geoHojaCuchillo, matRibete);
  hojaCuchillo.position.set(0, -0.1, 0);
  cuchilloGroup.add(hojaCuchillo);

  const geoPuntaCuchillo = registrarGeo(
    new THREE.CylinderGeometry(0.045, 0.045, 0.024, 16),
    geometrias
  );
  const puntaCuchillo = new THREE.Mesh(geoPuntaCuchillo, matRibete);
  puntaCuchillo.rotation.x = Math.PI / 2;
  puntaCuchillo.position.set(0, -0.21, 0);
  cuchilloGroup.add(puntaCuchillo);

  brazoDerecho.add(cuchilloGroup);

  return {
    raiz,
    personaje,
    cuerpo,
    cabeza,
    brazoIzquierdo,
    brazoDerecho,
    ojoIzquierdo,
    ojoDerecho,
    parpados: {
      izquierdo: parpadoIzqGroup,
      derecho: parpadoDerGroup,
    },
    boca,
    accesorioPensar,
    accesorioBrillo,
    sombraContacto,
    materiales,
    geometrias,
  };
}

/**
 * Aplica una PoseCapri a las piezas animables del personaje 3D.
 */
export function aplicarPoseCapri(piezas: PiezasCapri, pose: PoseCapri): void {
  piezas.personaje.position.y = pose.cuerpoY + pose.reboteY;
  piezas.personaje.rotation.z = pose.cuerpoRotZ;
  piezas.personaje.rotation.x = pose.cuerpoRotX;

  piezas.cabeza.rotation.x = pose.cabezaRotX;
  piezas.cabeza.rotation.y = pose.cabezaRotY;
  piezas.cabeza.rotation.z = pose.cabezaRotZ;

  piezas.brazoIzquierdo.rotation.z = -pose.brazoIzqRotZ;
  piezas.brazoIzquierdo.rotation.x = pose.brazoIzqRotX;

  piezas.brazoDerecho.rotation.z = -pose.brazoDerRotZ;
  piezas.brazoDerecho.rotation.x = pose.brazoDerRotX;

  const grosorParpado = Math.max(0.001, pose.parpadoSuperior);
  piezas.parpados.izquierdo.scale.set(1, 1, grosorParpado);
  piezas.parpados.derecho.scale.set(1, 1, grosorParpado);

  const escalaBocaY = 1 + pose.bocaApertura * 1.5;
  piezas.boca.scale.set(1, escalaBocaY, 1);

  piezas.accesorioPensar.scale.setScalar(pose.escalaPensar);
  piezas.accesorioBrillo.scale.setScalar(pose.escalaBrillo);

  const factorSombra = Math.max(0.4, 1 - pose.reboteY * 0.8);
  piezas.sombraContacto.scale.set(factorSombra, factorSombra, factorSombra);
  const matSombra = piezas.sombraContacto.material as THREE.MeshBasicMaterial;
  if (matSombra && 'opacity' in matSombra) {
    matSombra.opacity = Math.max(0.06, 0.22 - pose.reboteY * 0.2);
  }
}

/**
 * Libera de memoria todas las geometrías y materiales asociados a Capri.
 */
export function liberarCapri(piezas: PiezasCapri): void {
  piezas.geometrias.forEach((geo) => geo.dispose());
  piezas.materiales.forEach((mat) => mat.dispose());
}
