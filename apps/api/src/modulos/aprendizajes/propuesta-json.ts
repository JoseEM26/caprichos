/** Validación (sin dependencias) de lo que devuelve la IA. Lo inválido se descarta y se cuenta. */
export type TipoAprendizaje = 'FAQ' | 'FRASES' | 'DERIVAR';

export interface PropuestaIa {
  tipo: TipoAprendizaje;
  intencion: string;
  pregunta: string;
  respuesta: string;
  frases: string[];
  /** Índices de los chats del lote que sirven de prueba. */
  evidencia: number[];
}

const texto = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;

/** Normaliza la intención para comparar: minúsculas, sin tildes ni símbolos. */
export const claveIntencion = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);

export function validarPropuesta(x: any, totalChats: number): PropuestaIa | null {
  if (!x || typeof x !== 'object') return null;
  if (x.tipo !== 'FAQ' && x.tipo !== 'FRASES' && x.tipo !== 'DERIVAR') return null;
  const intencion = texto(x.intencion, 80);
  const pregunta = texto(x.pregunta, 300);
  const respuesta = texto(x.respuesta, 1000);
  if (!intencion || !pregunta || !respuesta || !claveIntencion(intencion)) return null;
  const frases = Array.isArray(x.frases) ? x.frases.map((f: unknown) => texto(f, 120)).filter((f: string | null): f is string => !!f).slice(0, 8) : [];
  if (x.tipo === 'FRASES' && frases.length === 0) return null;
  const evidencia = Array.isArray(x.evidencia)
    ? [...new Set(x.evidencia.filter((i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < totalChats))] as number[]
    : [];
  if (evidencia.length === 0) return null;
  return { tipo: x.tipo, intencion, pregunta, respuesta, frases, evidencia };
}

/** Parsea el JSON de la IA y devuelve las propuestas válidas y cuántas se descartaron. */
export function leerPropuestas(crudo: string, totalChats: number): { validas: PropuestaIa[]; invalidas: number } {
  let j: any;
  try {
    j = JSON.parse(crudo);
  } catch {
    return { validas: [], invalidas: 1 };
  }
  const lista: unknown[] = Array.isArray(j?.propuestas) ? j.propuestas : [];
  const validas: PropuestaIa[] = [];
  let invalidas = Array.isArray(j?.propuestas) ? 0 : 1;
  for (const x of lista) {
    const p = validarPropuesta(x, totalChats);
    if (p) validas.push(p);
    else invalidas++;
  }
  return { validas, invalidas };
}

/** Temas del paso 1: {"temas":[{"i":0,"tema":"VENTA"}]}. Devuelve el tema por índice; lo que falta o es inválido queda FUERA. */
export function leerTemas(crudo: string, total: number): Array<'VENTA' | 'ATENCION' | 'FUERA'> {
  const res: Array<'VENTA' | 'ATENCION' | 'FUERA'> = Array(total).fill('FUERA');
  try {
    const j = JSON.parse(crudo);
    for (const t of Array.isArray(j?.temas) ? j.temas : []) {
      if (Number.isInteger(t?.i) && t.i >= 0 && t.i < total && (t.tema === 'VENTA' || t.tema === 'ATENCION')) res[t.i] = t.tema;
    }
  } catch {
    /* todo queda FUERA */
  }
  return res;
}
