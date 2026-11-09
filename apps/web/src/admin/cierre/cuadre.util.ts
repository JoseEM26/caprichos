import { calcularTotalEfectivo, DENOMINACIONES_LISTA } from './cierreApi';

/** Lógica pura del panel «Cuadre de caja»: totales, diferencias en vivo y borrador. Sin React. */

export type EstadoDif = 'cuadra' | 'sobra' | 'falta';
export type ModoEfectivo = 'denominaciones' | 'total';
export type ClaveMedio = 'efectivo' | 'yape' | 'plin' | 'transferencia' | 'tarjeta';

export const MEDIOS_DIGITALES_CUADRE: Array<{ clave: Exclude<ClaveMedio, 'efectivo'>; medio: 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'TARJETA'; etiqueta: string }> = [
  { clave: 'yape', medio: 'YAPE', etiqueta: 'Yape' },
  { clave: 'plin', medio: 'PLIN', etiqueta: 'Plin' },
  { clave: 'transferencia', medio: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
  { clave: 'tarjeta', medio: 'TARJETA', etiqueta: 'Tarjeta / POS' },
];

/** Redondeo a céntimos: los montos se comparan en céntimos, nunca como floats sueltos. */
export const redondear = (n: number) => Math.round(n * 100) / 100;

/** Monto en soles con dos decimales: «S/ 12.50». */
export const soles = (n: number) => `S/ ${Math.abs(redondear(n)).toFixed(2)}`;

/** Monto con signo explícito: «+S/ 12.50», «−S/ 12.50», «S/ 0.00». */
export const solesConSigno = (n: number) => {
  const r = redondear(n);
  if (Math.abs(r) < 0.005) return 'S/ 0.00';
  return `${r > 0 ? '+' : '−'}S/ ${Math.abs(r).toFixed(2)}`;
};

export function estadoDif(dif: number): EstadoDif {
  const r = redondear(dif);
  if (Math.abs(r) < 0.005) return 'cuadra';
  return r > 0 ? 'sobra' : 'falta';
}

/** Texto del semáforo (además del color): «Cuadra ✓», «Sobra +S/ 5.00», «Falta −S/ 5.00». */
export function textoDif(dif: number): string {
  const e = estadoDif(dif);
  if (e === 'cuadra') return 'Cuadra ✓';
  return `${e === 'sobra' ? 'Sobra' : 'Falta'} ${solesConSigno(dif)}`;
}

/** Leyenda de la diferencia total: «Hay S/ 12.50 de más en total». */
export function leyendaDifTotal(dif: number): string {
  const e = estadoDif(dif);
  if (e === 'cuadra') return 'Todo cuadra: no hay diferencia en total';
  return `Hay ${soles(dif)} de ${e === 'sobra' ? 'más' : 'menos'} en total`;
}

/** «12», «12.5» → número; vacío o inválido → null (sin ingresar). Admite coma decimal. */
export function parseMonto(texto: string | undefined | null): number | null {
  const t = (texto ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? redondear(n) : null;
}

/** Solo dígitos y un punto, máximo dos decimales. */
export const limpiarMontoTexto = (v: string) => v.replace(',', '.').replace(/[^\d.]/g, '').replace(/^(\d*\.?\d{0,2}).*$/, '$1');

/** Suma por denominación: cantidades como texto (lo que hay en los campos). */
export function sumaDenominaciones(cantidades: Record<string, string>): number {
  return calcularTotalEfectivo(cantidades);
}

export interface FilaCuadre {
  clave: ClaveMedio;
  etiqueta: string;
  sistema: number;
  /** null = todavía sin ingresar */
  visto: number | null;
}

/** Diferencia (visto − sistema) de cada fila ya ingresada, y su suma. Las filas sin ingresar no suman. */
export function difFila(f: FilaCuadre): number | null {
  return f.visto === null ? null : redondear(f.visto - f.sistema);
}

export function difTotal(filas: FilaCuadre[]): number {
  return redondear(filas.reduce((t, f) => t + (difFila(f) ?? 0), 0));
}

/** ¿Alguna fila ingresada no cuadra? (aunque la suma total dé cero: +10 y −10 siguen siendo NO_CUADRA). */
export const hayDiferencias = (filas: FilaCuadre[]) => filas.some((f) => {
  const d = difFila(f);
  return d !== null && estadoDif(d) !== 'cuadra';
});

// ---------- Borrador (memoria + sessionStorage) ----------

export interface BorradorCuadre {
  modo: ModoEfectivo;
  cantidades: Record<string, string>;
  totalDirecto: string;
  vistos: Record<string, string>;
  nota: string;
}

export const borradorVacio = (): BorradorCuadre => ({
  modo: 'denominaciones',
  cantidades: Object.fromEntries(DENOMINACIONES_LISTA.map((d) => [d.clave, ''])),
  totalDirecto: '',
  vistos: { yape: '', plin: '', transferencia: '', tarjeta: '' },
  nota: '',
});

const enMemoria = new Map<string, BorradorCuadre>();
const llave = (cajaId: number | string) => `cuadre-caja-borrador-${cajaId}`;

export function leerBorrador(cajaId: number | string): BorradorCuadre {
  const mem = enMemoria.get(llave(cajaId));
  if (mem) return mem;
  try {
    const crudo = sessionStorage.getItem(llave(cajaId));
    if (crudo) return { ...borradorVacio(), ...(JSON.parse(crudo) as Partial<BorradorCuadre>) };
  } catch {
    // sessionStorage bloqueado o roto: se empieza en blanco
  }
  return borradorVacio();
}

export function guardarBorrador(cajaId: number | string, b: BorradorCuadre) {
  enMemoria.set(llave(cajaId), b);
  try {
    sessionStorage.setItem(llave(cajaId), JSON.stringify(b));
  } catch {
    // sin sessionStorage: queda solo en memoria
  }
}

export function borrarBorrador(cajaId: number | string) {
  enMemoria.delete(llave(cajaId));
  try {
    sessionStorage.removeItem(llave(cajaId));
  } catch {
    // nada que borrar
  }
}

/** Solo para pruebas: olvida todos los borradores (memoria y sessionStorage). */
export function reiniciarBorradores() {
  enMemoria.clear();
  try {
    sessionStorage.clear();
  } catch {
    // nada
  }
}
