/**
 * construirCapri.ts
 * Construcción procedural en Three.js del personaje Capri (Mascota oficial de Caprichos).
 * Sin modelos ni texturas externas: usa geometrías estándar y materiales con la paleta de marca.
 */

import * as THREE from 'three';
import type { PoseCapri } from './animaciones';

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
 * Arma proceduralmente la jerarquía 3D de Capri y devuelve sus piezas animables.
 */
export function construirCapri(): PiezasCapri {
  const geometrias: THREE.BufferGeometry[] = [];
  const materiales: THREE.Material[] = [];

  // ==========================================
  // MATERIALES BASE (Estilo vinilo Pixar suave)
  // ==========================================
  const matNaranja = registrarMat(
    new THREE.MeshStandardMaterial({
      color: COLORES_CAPRI.naranja,
      roughness: 0.5,
      metalness: 0.05,
    }),
    materiales
  );

  const matAzulMarino = registrarMat(
    new THREE.MeshStandardMaterial({
      color: COLORES_CAPRI.azulMarino,
      roughness: 0.35,
      metalness: 0.08,
    }),
    materiales
  );

  const matDorado = registrarMat(
    new THREE.MeshStandardMaterial({
      color: COLORES_CAPRI.dorado,
      roughness: 0.22,
      metalness: 0.45,
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
      color: 0x14141A,
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
      color: COLORES_CAPRI.dorado,
      emissive: COLORES_CAPRI.dorado,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.3,
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
  // CUERPO: CAMPANA NARANJA (el cono del logo, con hombros suaves) + DELANTAL
  // ==========================================
  const cuerpo = new THREE.Group();
  cuerpo.name = 'capri-cuerpo';
  personaje.add(cuerpo);

  // Perfil de revolución suave: cuello, hombros redondeados, falda que se abre y base curva
  const perfilCuerpo = [
    [0.0, 0.1], [0.3, 0.1], [0.4, 0.0], [0.45, -0.14], [0.52, -0.38],
    [0.62, -0.66], [0.72, -0.9], [0.73, -1.0], [0.62, -1.08], [0.3, -1.12], [0.0, -1.12],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geoCuerpo = registrarGeo(new THREE.LatheGeometry(perfilCuerpo, 48), geometrias);
  const mallaCuerpo = new THREE.Mesh(geoCuerpo, matNaranja);
  cuerpo.add(mallaCuerpo);

  // Delantal azul marino: mismo perfil, apenas más grande, solo el frente (sin borde rasgado)
  const perfilDelantal = perfilCuerpo
    .filter((p) => p.y <= -0.14 && p.y >= -0.9)
    .map((p) => new THREE.Vector2(p.x + 0.014, p.y));
  const geoDelantal = registrarGeo(
    new THREE.LatheGeometry(perfilDelantal, 32, -0.62, 1.24),
    geometrias
  );
  const matDelantal = registrarMat(
    new THREE.MeshStandardMaterial({
      color: COLORES_CAPRI.azulMarino,
      roughness: 0.4,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    materiales
  );
  const mallaDelantal = new THREE.Mesh(geoDelantal, matDelantal);
  cuerpo.add(mallaDelantal);

  // Ribete dorado del delantal (borde superior curvo)
  const geoRibeteDelantal = registrarGeo(
    new THREE.TorusGeometry(0.455, 0.016, 12, 32, 1.24),
    geometrias
  );
  const ribeteDelantal = new THREE.Mesh(geoRibeteDelantal, matDorado);
  ribeteDelantal.rotation.x = Math.PI / 2;
  ribeteDelantal.rotation.z = Math.PI / 2 - 0.62;
  ribeteDelantal.position.y = -0.14;
  cuerpo.add(ribeteDelantal);

  // Ribete dorado inferior del delantal (dobladillo)
  const geoDobladillo = registrarGeo(new THREE.TorusGeometry(0.735, 0.017, 12, 32, 1.24), geometrias);
  const dobladillo = new THREE.Mesh(geoDobladillo, matDorado);
  dobladillo.rotation.x = Math.PI / 2;
  dobladillo.rotation.z = Math.PI / 2 - 0.62;
  dobladillo.position.y = -0.9;
  cuerpo.add(dobladillo);

  // Botones dorados del delantal
  const geoBoton = registrarGeo(new THREE.SphereGeometry(0.04, 16, 16), geometrias);
  const boton1 = new THREE.Mesh(geoBoton, matDorado);
  boton1.position.set(0, -0.3, 0.5);
  cuerpo.add(boton1);

  const boton2 = new THREE.Mesh(geoBoton, matDorado);
  boton2.position.set(0, -0.5, 0.57);
  cuerpo.add(boton2);

  // Bolsillo del delantal con una cucharita asomando
  const geoBolsillo = registrarGeo(new THREE.CapsuleGeometry(0.1, 0.1, 6, 16), geometrias);
  const bolsillo = new THREE.Mesh(geoBolsillo, matNaranja);
  bolsillo.rotation.z = Math.PI / 2;
  bolsillo.scale.set(1, 1, 0.35);
  bolsillo.position.set(0.17, -0.68, 0.64);
  cuerpo.add(bolsillo);

  const geoCuchara = registrarGeo(new THREE.CapsuleGeometry(0.014, 0.12, 4, 10), geometrias);
  const cuchara = new THREE.Mesh(geoCuchara, matDorado);
  cuchara.position.set(0.2, -0.56, 0.62);
  cuchara.rotation.z = -0.25;
  cuerpo.add(cuchara);
  const geoCucharaPunta = registrarGeo(new THREE.SphereGeometry(0.032, 12, 12), geometrias);
  const cucharaPunta = new THREE.Mesh(geoCucharaPunta, matDorado);
  cucharaPunta.scale.set(1, 1.3, 0.5);
  cucharaPunta.position.set(0.212, -0.485, 0.62);
  cuerpo.add(cucharaPunta);

  // Pañuelo / cuello dorado que une la cabeza con el cuerpo
  const geoRibete = registrarGeo(new THREE.TorusGeometry(0.31, 0.055, 16, 36), geometrias);
  const ribeteCuello = new THREE.Mesh(geoRibete, matDorado);
  ribeteCuello.rotation.x = Math.PI / 2;
  ribeteCuello.position.y = 0.1;
  cuerpo.add(ribeteCuello);

  // Lazo azul marino en el frente del pañuelo
  const geoLazo = registrarGeo(new THREE.SphereGeometry(0.07, 16, 16), geometrias);
  const lazoIzq = new THREE.Mesh(geoLazo, matAzulMarino);
  lazoIzq.scale.set(1.2, 0.8, 0.7);
  lazoIzq.position.set(-0.075, 0.07, 0.34);
  cuerpo.add(lazoIzq);
  const lazoDer = new THREE.Mesh(geoLazo, matAzulMarino);
  lazoDer.scale.set(1.2, 0.8, 0.7);
  lazoDer.position.set(0.075, 0.07, 0.34);
  cuerpo.add(lazoDer);
  const nudoLazo = new THREE.Mesh(geoBoton, matAzulMarino);
  nudoLazo.scale.setScalar(1.3);
  nudoLazo.position.set(0, 0.07, 0.36);
  cuerpo.add(nudoLazo);

  // Zapatitos azul marino que asoman al frente de la falda
  const geoPiecito = registrarGeo(new THREE.SphereGeometry(0.17, 20, 16), geometrias);
  const pieIzq = new THREE.Mesh(geoPiecito, matAzulMarino);
  pieIzq.scale.set(1.0, 0.62, 1.45);
  pieIzq.position.set(-0.27, -1.04, 0.5);
  cuerpo.add(pieIzq);

  const pieDer = new THREE.Mesh(geoPiecito, matAzulMarino);
  pieDer.scale.set(1.0, 0.62, 1.45);
  pieDer.position.set(0.27, -1.04, 0.5);
  cuerpo.add(pieDer);

  // ==========================================
  // CABEZA: GORRO DE CHEF ESPONJOSO + CARITA
  // ==========================================
  const cabeza = new THREE.Group();
  cabeza.name = 'capri-cabeza';
  cabeza.position.y = 0.4;
  personaje.add(cabeza);

  // Carita redonda color piel (así el gorro se lee como gorro y no como la cabeza)
  const matPiel = registrarMat(
    new THREE.MeshStandardMaterial({ color: 0xFFD9B5, roughness: 0.5, metalness: 0 }),
    materiales
  );
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

  // Gorro de chef: banda crema con cinta marino y dorado, y copa esponjosa encima
  const matTela = registrarMat(
    new THREE.MeshStandardMaterial({ color: COLORES_CAPRI.crema, roughness: 0.95, metalness: 0 }),
    materiales
  );
  const gorro = new THREE.Group();
  gorro.name = 'capri-gorro';
  gorro.position.y = 0.53;
  cabeza.add(gorro);

  const geoBandaGorro = registrarGeo(new THREE.CylinderGeometry(0.43, 0.41, 0.26, 36), geometrias);
  const bandaGorro = new THREE.Mesh(geoBandaGorro, matTela);
  gorro.add(bandaGorro);

  const geoCintaGorro = registrarGeo(new THREE.TorusGeometry(0.42, 0.022, 12, 36), geometrias);
  const cintaGorro = new THREE.Mesh(geoCintaGorro, matAzulMarino);
  cintaGorro.rotation.x = Math.PI / 2;
  cintaGorro.position.y = -0.08;
  gorro.add(cintaGorro);
  const cintaDorada = new THREE.Mesh(geoCintaGorro, matDorado);
  cintaDorada.rotation.x = Math.PI / 2;
  cintaDorada.position.y = -0.12;
  cintaDorada.scale.setScalar(0.99);
  gorro.add(cintaDorada);

  const geoDomoCentro = registrarGeo(new THREE.SphereGeometry(0.4, 32, 24), geometrias);
  const domoCentro = new THREE.Mesh(geoDomoCentro, matTela);
  domoCentro.position.y = 0.42;
  gorro.add(domoCentro);

  const geoLobulo = registrarGeo(new THREE.SphereGeometry(0.26, 20, 20), geometrias);
  for (let i = 0; i < 6; i++) {
    const angulo = (i / 6) * Math.PI * 2;
    const lobulo = new THREE.Mesh(geoLobulo, matTela);
    lobulo.position.set(Math.cos(angulo) * 0.3, 0.3, Math.sin(angulo) * 0.3);
    gorro.add(lobulo);
  }

  // OJOS (Grandes, brillantes y expresivos)
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
  parpadoIzqGroup.scale.set(1, 1, 0.001); // abierto: cúpula plana dentro del ojo
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

  // MEJILLAS SUAVES (Rubor rosado pastel)
  const geoMejilla = registrarGeo(new THREE.SphereGeometry(0.068, 16, 16), geometrias);
  const mejillaIzq = new THREE.Mesh(geoMejilla, matMejilla);
  mejillaIzq.scale.set(1, 0.6, 0.35);
  mejillaIzq.position.set(-0.32, -0.1, 0.42);
  cabeza.add(mejillaIzq);

  const mejillaDer = new THREE.Mesh(geoMejilla, matMejilla);
  mejillaDer.scale.set(1, 0.6, 0.35);
  mejillaDer.position.set(0.32, -0.1, 0.42);
  cabeza.add(mejillaDer);

  // SONRISA AMABLE
  const geoBoca = registrarGeo(
    new THREE.TorusGeometry(0.09, 0.018, 12, 24, Math.PI * 0.85),
    geometrias
  );
  const boca = new THREE.Mesh(geoBoca, matAzulMarino);
  boca.name = 'capri-boca';
  boca.rotation.z = Math.PI * 1.07;
  boca.position.set(0, -0.14, 0.52);
  cabeza.add(boca);

  // ACCESORIO PENSAR (Signo / bombilla luminosa dorada que flota al pensar)
  const accesorioPensar = new THREE.Group();
  accesorioPensar.name = 'accesorio-pensar';
  accesorioPensar.position.set(0.75, 1.3, 0.1);
  accesorioPensar.scale.setScalar(0); // invisible en reposo

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

  // ACCESORIO BRILLO (Estrellitas de destello para estado contento)
  const accesorioBrillo = new THREE.Group();
  accesorioBrillo.name = 'accesorio-brillo';
  accesorioBrillo.position.set(0, 1.55, 0);
  accesorioBrillo.scale.setScalar(0); // invisible en reposo

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
  // BRAZO IZQUIERDO: MANITO TENEDOR (Estilo logo V)
  // ==========================================
  const brazoIzquierdo = new THREE.Group();
  brazoIzquierdo.name = 'brazo-izquierdo';
  brazoIzquierdo.position.set(-0.43, -0.04, 0);
  cuerpo.add(brazoIzquierdo);

  const geoBrazo = registrarGeo(new THREE.CapsuleGeometry(0.068, 0.34, 6, 16), geometrias);
  const geoHombro = registrarGeo(new THREE.SphereGeometry(0.095, 20, 16), geometrias);
  brazoIzquierdo.add(new THREE.Mesh(geoHombro, matNaranja));
  const mallaBrazoIzq = new THREE.Mesh(geoBrazo, matNaranja);
  mallaBrazoIzq.position.y = -0.2;
  brazoIzquierdo.add(mallaBrazoIzq);

  // Puño dorado
  const geoPuno = registrarGeo(new THREE.TorusGeometry(0.07, 0.02, 16, 20), geometrias);
  const punoIzq = new THREE.Mesh(geoPuno, matDorado);
  punoIzq.rotation.x = Math.PI / 2;
  punoIzq.position.y = -0.4;
  brazoIzquierdo.add(punoIzq);

  // Manito Tenedor (redondeada, juguetona, sin filos ni puntas agresivas)
  const tenedorGroup = new THREE.Group();
  tenedorGroup.position.y = -0.44;

  const geoPalmaTenedor = registrarGeo(new THREE.SphereGeometry(0.088, 16, 16), geometrias);
  const palmaTenedor = new THREE.Mesh(geoPalmaTenedor, matDorado);
  palmaTenedor.scale.set(1, 0.7, 0.4);
  tenedorGroup.add(palmaTenedor);

  // 3 Dientes amigables redondeados
  const geoDiente = registrarGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.14, 12), geometrias);
  const geoPuntaDiente = registrarGeo(new THREE.SphereGeometry(0.016, 12, 12), geometrias);

  const posicionesDientes = [-0.05, 0, 0.05];
  posicionesDientes.forEach((posX) => {
    const diente = new THREE.Mesh(geoDiente, matDorado);
    diente.position.set(posX, -0.11, 0);
    tenedorGroup.add(diente);

    const punta = new THREE.Mesh(geoPuntaDiente, matDorado);
    punta.position.set(posX, -0.18, 0);
    tenedorGroup.add(punta);
  });

  brazoIzquierdo.add(tenedorGroup);

  // ==========================================
  // BRAZO DERECHO: MANITO CUCHILLO / ESPÁTULA (Estilo logo V)
  // ==========================================
  const brazoDerecho = new THREE.Group();
  brazoDerecho.name = 'brazo-derecho';
  brazoDerecho.position.set(0.43, -0.04, 0);
  cuerpo.add(brazoDerecho);

  const mallaBrazoDer = new THREE.Mesh(geoBrazo, matNaranja);
  mallaBrazoDer.position.y = -0.2;
  brazoDerecho.add(mallaBrazoDer);
  brazoDerecho.add(new THREE.Mesh(geoHombro, matNaranja));

  // Puño dorado
  const punoDer = new THREE.Mesh(geoPuno, matDorado);
  punoDer.rotation.x = Math.PI / 2;
  punoDer.position.y = -0.4;
  brazoDerecho.add(punoDer);

  // Cuchillo pastelero / espátula redondeada y amable
  const cuchilloGroup = new THREE.Group();
  cuchilloGroup.position.y = -0.44;

  const geoHojaCuchillo = registrarGeo(new THREE.BoxGeometry(0.09, 0.22, 0.024), geometrias);
  const hojaCuchillo = new THREE.Mesh(geoHojaCuchillo, matDorado);
  hojaCuchillo.position.set(0, -0.1, 0);
  cuchilloGroup.add(hojaCuchillo);

  // Punta curva y suave de la espátula
  const geoPuntaCuchillo = registrarGeo(
    new THREE.CylinderGeometry(0.045, 0.045, 0.024, 16),
    geometrias
  );
  const puntaCuchillo = new THREE.Mesh(geoPuntaCuchillo, matDorado);
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
  // Balanceo y rebote vertical del personaje completo
  piezas.personaje.position.y = pose.cuerpoY + pose.reboteY;
  piezas.personaje.rotation.z = pose.cuerpoRotZ;
  piezas.personaje.rotation.x = pose.cuerpoRotX;

  // Inclinación y rotación de cabeza (incluye mirada al puntero)
  piezas.cabeza.rotation.x = pose.cabezaRotX;
  piezas.cabeza.rotation.y = pose.cabezaRotY;
  piezas.cabeza.rotation.z = pose.cabezaRotZ;

  // Brazos
  piezas.brazoIzquierdo.rotation.z = -pose.brazoIzqRotZ;
  piezas.brazoIzquierdo.rotation.x = pose.brazoIzqRotX;

  piezas.brazoDerecho.rotation.z = -pose.brazoDerRotZ;
  piezas.brazoDerecho.rotation.x = pose.brazoDerRotX;

  // Párpados: cúpula frontal que crece de plana (abierto) a cubrir el ojo (cerrado)
  const grosorParpado = Math.max(0.001, pose.parpadoSuperior);
  piezas.parpados.izquierdo.scale.set(1, 1, grosorParpado);
  piezas.parpados.derecho.scale.set(1, 1, grosorParpado);

  // Apertura de boca
  const escalaBocaY = 1 + pose.bocaApertura * 1.5;
  piezas.boca.scale.set(1, escalaBocaY, 1);

  // Accesorios flotantes
  piezas.accesorioPensar.scale.setScalar(pose.escalaPensar);
  piezas.accesorioBrillo.scale.setScalar(pose.escalaBrillo);

  // Sombra de contacto que se atenúa suavemente si salta
  const factorSombra = Math.max(0.4, 1 - pose.reboteY * 0.8);
  piezas.sombraContacto.scale.set(factorSombra, factorSombra, factorSombra);
  const matSombra = piezas.sombraContacto.material as THREE.MeshBasicMaterial;
  matSombra.opacity = Math.max(0.06, 0.22 - pose.reboteY * 0.2);
}

/**
 * Libera de memoria todas las geometrías y materiales asociados a Capri.
 */
export function liberarCapri(piezas: PiezasCapri): void {
  piezas.geometrias.forEach((geo) => geo.dispose());
  piezas.materiales.forEach((mat) => mat.dispose());
}
