import { Coordenada } from './zonas.tipos';

/**
 * Algoritmo de ray casting (Jordan curve theorem) para determinar
 * si un punto (lat, lng) se encuentra dentro de un polígono 2D.
 */
export function puntoEnPoligono(lat: number, lng: number, poligonoRaw: Coordenada[]): boolean {
  if (!poligonoRaw || !Array.isArray(poligonoRaw) || poligonoRaw.length < 3) {
    return false;
  }

  // Si el polígono tiene el punto final duplicado al inicial, lo ignoramos para el cálculo
  let poligono = poligonoRaw;
  if (
    poligono.length > 3 &&
    poligono[0][0] === poligono[poligono.length - 1][0] &&
    poligono[0][1] === poligono[poligono.length - 1][1]
  ) {
    poligono = poligono.slice(0, -1);
  }

  const n = poligono.length;
  if (n < 3) return false;

  let dentro = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [latI, lngI] = poligono[i];
    const [latJ, lngJ] = poligono[j];

    const intersecta =
      latI > lat !== latJ > lat &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;

    if (intersecta) {
      dentro = !dentro;
    }
  }

  return dentro;
}

/**
 * Producto cruzado 2D para orientación de 3 puntos.
 */
function ccw(p1: Coordenada, p2: Coordenada, p3: Coordenada): number {
  return (p2[1] - p1[1]) * (p3[0] - p1[0]) - (p2[0] - p1[0]) * (p3[1] - p1[1]);
}

/**
 * Determina si dos segmentos p1-p2 y p3-p4 se intersecan estrictamente en sus interiores.
 */
function segmentosSeCruzan(p1: Coordenada, p2: Coordenada, p3: Coordenada, p4: Coordenada): boolean {
  const d1 = ccw(p3, p4, p1);
  const d2 = ccw(p3, p4, p2);
  const d3 = ccw(p1, p2, p3);
  const d4 = ccw(p1, p2, p4);

  // Signos opuestos indican cruce
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  return false;
}

/**
 * Comprueba si un polígono tiene autointersecciones entre aristas no adyacentes.
 */
export function tieneAutoIntersecciones(poligonoRaw: Coordenada[]): boolean {
  let poligono = poligonoRaw;
  if (
    poligono.length > 3 &&
    poligono[0][0] === poligono[poligono.length - 1][0] &&
    poligono[0][1] === poligono[poligono.length - 1][1]
  ) {
    poligono = poligono.slice(0, -1);
  }

  const n = poligono.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const p1 = poligono[i];
    const p2 = poligono[(i + 1) % n];

    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // Aristas adyacentes
      const p3 = poligono[j];
      const p4 = poligono[(j + 1) % n];

      if (segmentosSeCruzan(p1, p2, p3, p4)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Valida que un polígono cumpla:
 * 1) Sea un arreglo con al menos 3 puntos.
 * 2) Cada punto tenga latitud (-90..90) y longitud (-180..180) numéricas válidas.
 * 3) No presente autointersecciones.
 */
export function validarPoligono(poligono: any): { valido: boolean; motivo?: string } {
  if (!poligono || !Array.isArray(poligono)) {
    return { valido: false, motivo: 'El polígono debe ser un arreglo de coordenadas [lat, lng]' };
  }

  let puntos: Coordenada[] = poligono;
  if (
    puntos.length > 3 &&
    Array.isArray(puntos[0]) &&
    Array.isArray(puntos[puntos.length - 1]) &&
    puntos[0][0] === puntos[puntos.length - 1][0] &&
    puntos[0][1] === puntos[puntos.length - 1][1]
  ) {
    puntos = puntos.slice(0, -1);
  }

  if (puntos.length < 3) {
    return { valido: false, motivo: 'El polígono debe tener al menos 3 puntos distintos' };
  }

  for (let idx = 0; idx < puntos.length; idx++) {
    const pt = puntos[idx];
    if (!Array.isArray(pt) || pt.length < 2) {
      return { valido: false, motivo: `El punto en la posición ${idx} no es una coordenada válida [lat, lng]` };
    }

    const lat = Number(pt[0]);
    const lng = Number(pt[1]);

    if (isNaN(lat) || isNaN(lng)) {
      return { valido: false, motivo: `El punto en la posición ${idx} contiene valores numéricos inválidos` };
    }

    if (lat < -90 || lat > 90) {
      return { valido: false, motivo: `Latitud fuera de rango (-90 a 90) en la posición ${idx}` };
    }

    if (lng < -180 || lng > 180) {
      return { valido: false, motivo: `Longitud fuera de rango (-180 a 180) en la posición ${idx}` };
    }
  }

  if (tieneAutoIntersecciones(puntos)) {
    return { valido: false, motivo: 'El polígono no puede tener autointersecciones' };
  }

  return { valido: true };
}
