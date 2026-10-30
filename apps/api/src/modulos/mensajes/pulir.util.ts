// «Pulir mensaje» (RN-CAP-111): mejora ortografía y tono con reglas locales. Nunca envía solo.
// Mismas reglas que el mockup; con IA real se cambiaría esta función (tiene costo, RNF-CAP-015).
const TYPOS: Record<string, string> = {
  xfa: 'por favor', xfavor: 'por favor', pls: 'por favor', plis: 'por favor', pf: 'por favor', q: 'que', k: 'que',
  pq: 'porque', porq: 'porque', xq: 'porque', x: 'por', d: 'de', ok: 'de acuerdo', oki: 'de acuerdo',
  tmb: 'también', tbn: 'también', tambn: 'también', tambien: 'también', ola: 'hola', hla: 'hola', kiero: 'quiero',
  kieres: 'quieres', grax: 'gracias', gracs: 'gracias', gracia: 'gracias', graxias: 'gracias', dnd: 'dónde',
  donde: 'dónde', cuando: 'cuándo', cuanto: 'cuánto', cuantos: 'cuántos', aqui: 'aquí', alli: 'allí', asi: 'así',
  mas: 'más', si: 'sí', ahi: 'ahí', esta: 'está', estan: 'están', bn: 'bien', ps: 'pues', pedio: 'pedido',
  pedid: 'pedido', pedidoo: 'pedido', listoo: 'listo', lsto: 'listo', sta: 'está', stamos: 'estamos',
  haver: 'haber', aver: 'a ver', direcion: 'dirección', direccion: 'dirección', ubicacion: 'ubicación',
  confirmacion: 'confirmación', atencion: 'atención', yapeo: 'yape', pagao: 'pagado', delibery: 'delivery',
  delivey: 'delivery', delibery2: 'delivery', minutoss: 'minutos', minuts: 'minutos', hr: 'hora', hrs: 'horas',
};
const INTRO =
  /^(que|qué|quien|quién|cual|cuál|cuanto|cuánto|cuantos|cuántos|donde|dónde|como|cómo|cuando|cuándo|por qué|porque|para qué|quieres|puedes|podrías|podrias|tienes|tiene|necesitas|me confirmas|me puedes|desea|desean|gustas|gusta)\b/i;
const PREG: Record<string, string> = { que: 'qué', quien: 'quién', cual: 'cuál', como: 'cómo' };

export function pulirMensaje(crudo: string, nombre: string): string {
  let x = String(crudo || '').replace(/\s+/g, ' ').trim();
  if (!x) return '';
  const letras = x.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  if (letras.length > 5 && letras === letras.toUpperCase()) x = x.toLowerCase();
  x = x
    .replace(/([a-záéíóúñ])\1{2,}/gi, '$1$1')
    .replace(/([!?.])\1+/g, '$1')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?=\S)/g, '$1 ');
  x = x.replace(/[A-Za-zÁÉÍÓÚÑáéíóúñ]+/g, (w) => {
    const k = w.toLowerCase();
    return Object.prototype.hasOwnProperty.call(TYPOS, k) ? TYPOS[k] : w;
  });
  x = x
    .replace(/\bno hay\b/gi, 'por el momento no tenemos')
    .replace(/\blisto ya$/i, 'listo en unos minutos')
    .replace(/\bya$/i, 'en unos minutos');
  const partes = x
    .split(/(?<=[.!?])\s+/)
    .map((s0) => {
      let s1 = s0.trim();
      if (!s1) return '';
      const sin = s1.replace(/[¿?]/g, '').replace(/[.!]+$/, '').trim();
      if (/\?$/.test(s1) || INTRO.test(sin)) {
        s1 = '¿' + sin.charAt(0).toLowerCase() + sin.slice(1) + '?';
        s1 = s1.replace(/^¿(que|quien|cual|cuanto|cuantos|donde|como|cuando)\b/i, (_m, w: string) => {
          const k = w.toLowerCase();
          return '¿' + (TYPOS[k] || PREG[k] || k);
        });
      } else if (!/[.!?]$/.test(s1)) {
        s1 += '.';
      }
      return s1.replace(/^(¿?)([a-záéíóúñ])/, (_m, a: string, b: string) => a + b.toUpperCase());
    })
    .filter(Boolean);
  x = partes
    .join(' ')
    .replace(/^(Hola|Buenas|Buenos días|Buenas tardes|Buenas noches)\s+(?=[A-Za-zÁÉÍÓÚÑáéíóúñ¿])/, (_m, g: string) => g + ', ')
    .replace(/^(Hola|Buenas|Buenos días|Buenas tardes|Buenas noches), ([A-ZÁÉÍÓÚÑ])(?=[a-záéíóúñ])/, (_m, g: string, l: string) => g + ', ' + l.toLowerCase())
    .replace(/\b(miraflores|surco|barranco|san isidro|lima|yape|plin|caprichos)\b/gi, (m) =>
      m.replace(/(^|\s)([a-z])/g, (_m1, s: string, l: string) => s + l.toUpperCase()),
    );
  const pn = String(nombre || '').split(' ')[0];
  if (!/^(hola|buen|claro|con gusto)/i.test(x)) x = 'Hola, ' + pn + '. ' + x;
  if (!/gracias|con gusto|atentos/i.test(x)) x += ' Quedamos atentos a lo que necesites. Gracias por escribirnos a Caprichos.';
  return x;
}
