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

/** Quita el vértice de cierre repetido, si lo hay. */
function sinCierre(poligono: Coordenada[]): Coordenada[] {
  if (
    poligono.length > 3 &&
    poligono[0][0] === poligono[poligono.length - 1][0] &&
    poligono[0][1] === poligono[poligono.length - 1][1]
  ) {
    return poligono.slice(0, -1);
  }
  return poligono;
}


/**
 * Profundidad mínima, en metros, para contar un solape. Los bordes dibujados a mano no coinciden al
 * centímetro: una franja de pocos decímetros entre zonas vecinas es ruido de trazo, no un solape real.
 */
export const TOLERANCIA_SOLAPE_M = 3;

/** Distancia en metros de un punto al borde del polígono (aproximación plana local). */
function distanciaAlBordeM(p: Coordenada, poligono: Coordenada[]): number {
  const lat0 = (p[0] * Math.PI) / 180;
  const kx = 111320 * Math.cos(lat0);
  const ky = 110574;
  let mejor = Infinity;
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % poligono.length];
    const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky;
    const bx = (b[1] - p[1]) * kx, by = (b[0] - p[0]) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const cx = ax + t * dx, cy = ay + t * dy;
    mejor = Math.min(mejor, Math.hypot(cx, cy));
  }
  return mejor;
}

/** true si ninguna arista del polígono queda a menos de TOLERANCIA_SOLAPE_M del punto (corta en cuanto encuentra una). */
function lejosDelBorde(p: Coordenada, poligono: Coordenada[]): boolean {
  const lat0 = (p[0] * Math.PI) / 180;
  const kx = 111320 * Math.cos(lat0);
  const ky = 110574;
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % poligono.length];
    const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky;
    const dx = (b[1] - p[1]) * kx - ax, dy = (b[0] - p[0]) * ky - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const cx = ax + t * dx, cy = ay + t * dy;
    if (cx * cx + cy * cy < TOLERANCIA_SOLAPE_M * TOLERANCIA_SOLAPE_M) return false;
  }
  return true;
}

/** Caja envolvente [minLat, minLng, maxLat, maxLng] de un polígono. */
function cajaDe(poligono: Coordenada[]): [number, number, number, number] {
  let [minLa, minLn, maxLa, maxLn] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [la, ln] of poligono) {
    minLa = Math.min(minLa, la);
    maxLa = Math.max(maxLa, la);
    minLn = Math.min(minLn, ln);
    maxLn = Math.max(maxLn, ln);
  }
  return [minLa, minLn, maxLa, maxLn];
}

/**
 * Dos polígonos (válidos) se solapan si existe un punto dentro de los dos a más de
 * TOLERANCIA_SOLAPE_M de cada borde. Se busca con una malla de 3 m dentro de la intersección de las
 * cajas envolventes. Zonas vecinas con borde compartido, o franjas de trazo menores a la tolerancia,
 * no cuentan como solape.
 */
export function poligonosSeSolapan(aRaw: Coordenada[], bRaw: Coordenada[]): boolean {
  const a = sinCierre(aRaw);
  const b = sinCierre(bRaw);
  const [aMinLa, aMinLn, aMaxLa, aMaxLn] = cajaDe(a);
  const [bMinLa, bMinLn, bMaxLa, bMaxLn] = cajaDe(b);
  const minLa = Math.max(aMinLa, bMinLa);
  const maxLa = Math.min(aMaxLa, bMaxLa);
  const minLn = Math.max(aMinLn, bMinLn);
  const maxLn = Math.min(aMaxLn, bMaxLn);
  if (minLa > maxLa || minLn > maxLn) return false;

  const paso = 3; // metros
  const pasoLat = paso / 110574;
  const pasoLng = (paso / (111320 * Math.cos(((minLa + maxLa) / 2) * Math.PI / 180)));
  for (let la = minLa; la <= maxLa; la += pasoLat) {
    for (let ln = minLn; ln <= maxLn; ln += pasoLng) {
      const p: Coordenada = [la, ln];
      if (!puntoEnPoligono(la, ln, a) || !puntoEnPoligono(la, ln, b)) continue;
      if (lejosDelBorde(p, a) && lejosDelBorde(p, b)) return true;
    }
  }
  return false;
}

export interface ZonaParaDiagnostico {
  codigo: string;
  activa: boolean;
  poligono: Coordenada[];
}

export interface DiagnosticoCobertura {
  solapes: { ganadora: string; perdedora: string }[];
  invalidas: { codigo: string; activa: boolean; motivo: string }[];
}

/**
 * Diagnóstico de cobertura: zonas activas que se solapan (gana la de menor código, como
 * ZonasService.detectar) y polígonos inválidos. Los huecos entre zonas no son error.
 */
export function diagnosticarCobertura(zonas: ZonaParaDiagnostico[]): DiagnosticoCobertura {
  const invalidas: DiagnosticoCobertura['invalidas'] = [];
  const validas: ZonaParaDiagnostico[] = [];
  for (const z of zonas) {
    const v = validarPoligono(z.poligono);
    if (v.valido) validas.push(z);
    else invalidas.push({ codigo: z.codigo, activa: z.activa, motivo: v.motivo || 'Polígono no válido' });
  }

  const activas = validas.filter((z) => z.activa).sort((x, y) => (x.codigo < y.codigo ? -1 : x.codigo > y.codigo ? 1 : 0));
  const solapes: DiagnosticoCobertura['solapes'] = [];
  for (let i = 0; i < activas.length; i++) {
    for (let j = i + 1; j < activas.length; j++) {
      if (poligonosSeSolapan(activas[i].poligono, activas[j].poligono)) {
        solapes.push({ ganadora: activas[i].codigo, perdedora: activas[j].codigo });
      }
    }
  }
  return { solapes, invalidas };
}
