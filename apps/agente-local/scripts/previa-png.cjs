// Vista previa PNG de cada sticker a partir del TSPL real que genera el agente (sin impresora).
// Uso: pnpm build && node scripts/previa-png.cjs <carpeta-salida> [horizontal|vertical]
// Interpreta SIZE, BOX, BAR, REVERSE, BITMAP (0 = negro) y TEXT; las fuentes 1-5 de la impresora se
// aproximan con una tipografia del sistema ajustada al ancho exacto de cada celda.
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..', '..', '..');
let sharp;
try { sharp = require('sharp'); } catch {
  const dir = fs.readdirSync(path.join(raiz, 'node_modules/.pnpm')).find((d) => d.startsWith('sharp@'));
  sharp = require(path.join(raiz, 'node_modules/.pnpm', dir, 'node_modules/sharp'));
}
const { generarTsplTrabajo } = require('../dist/tspl/generadorTspl');
const muestras = require('../dist/datosMuestra');
const FUENTE = { 1: [8, 12], 2: [12, 20], 3: [16, 24], 4: [24, 32], 5: [32, 48] };
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function render(script, escala = 2) {
  const mm = /SIZE ([\d.]+) mm,([\d.]+) mm/.exec(script);
  const W = Math.round(mm[1] * 8), H = Math.round(mm[2] * 8);
  const px = Buffer.alloc(W * H, 255);
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = v; };
  const rect = (x, y, w, h, v) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, v); };
  const dentroRR = (x, y, x1, y1, x2, y2, r) => {
    if (x < x1 || x > x2 || y < y1 || y > y2) return false;
    const cx = x < x1 + r ? x1 + r : x > x2 - r ? x2 - r : x, cy = y < y1 + r ? y1 + r : y > y2 - r ? y2 - r : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  let i = 0;
  const bin = script; // cadena: cada caracter del BITMAP es un byte (latin1)
  while (i < bin.length) {
    const cabBm = /^BITMAP (\d+),(\d+),(\d+),(\d+),0,/.exec(bin.slice(i, i + 40));
    if (cabBm) {
      const [x, y, wb, h] = cabBm.slice(1, 5).map(Number);
      const ini = i + cabBm[0].length;
      for (let j = 0; j < h; j++) for (let k = 0; k < wb * 8; k++)
        set(x + k, y + j, bin.charCodeAt(ini + j * wb + (k >> 3)) & (0x80 >> (k & 7)) ? 255 : 0);
      i = ini + wb * h + 2;
      continue;
    }
    let fin = bin.indexOf('\r\n', i); if (fin < 0) fin = bin.length;
    const linea = bin.slice(i, fin);
    i = fin + 2;
    let m;
    if ((m = /^BAR (\d+),(\d+),(\d+),(\d+)/.exec(linea))) rect(+m[1], +m[2], +m[3], +m[4], 0);
    else if ((m = /^BOX (\d+),(\d+),(\d+),(\d+),(\d+),?(\d*)/.exec(linea))) {
      const [x1, y1, x2, y2, t, r] = m.slice(1).map(Number);
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++)
        if (dentroRR(x, y, x1, y1, x2, y2, r) && !dentroRR(x, y, x1 + t, y1 + t, x2 - t, y2 - t, Math.max(0, r - t))) set(x, y, 0);
    } else if ((m = /^REVERSE (\d+),(\d+),(\d+),(\d+)/.exec(linea))) {
      const [x, y, w, h] = m.slice(1).map(Number);
      for (let j = y; j < y + h; j++) for (let k = x; k < x + w; k++) if (k < W && j < H) px[j * W + k] = 255 - px[j * W + k];
    } else if ((m = /^TEXT (\d+),(\d+),"(\d)",0,(\d+),(\d+),"(.*)"$/.exec(linea))) {
      const [x, y] = [+m[1], +m[2]]; const [cw, ch] = FUENTE[m[3]]; const xm = +m[4], ym = +m[5];
      const txt = m[6];
      const w = Math.max(1, txt.length * cw), h = ch;
      const fs_ = Math.min(cw / 0.6, ch * 0.95);
      const xs = [...txt].map((_, n) => n * cw).join(' ');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#fff"/>` +
        `<text x="${xs}" y="${h * 0.78}" font-family="DejaVu Sans Mono, monospace" font-weight="bold" font-size="${fs_}">${esc(txt)}</text></svg>`;
      const t = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer();
      for (let j = 0; j < h * ym; j++) for (let k = 0; k < w * xm; k++) if (t[((j / ym) | 0) * w + ((k / xm) | 0)] < 140) set(x + k, y + j, 0);
    }
  }
  return sharp(px, { raw: { width: W, height: H, channels: 1 } }).resize(W * escala / 2, H * escala / 2).png().toBuffer();
}

(async () => {
  const salida = process.argv[2] || '.';
  const orientacion = process.argv[3] || 'horizontal';
  fs.mkdirSync(salida, { recursive: true });
  for (const [tipo, datos, nombre] of [
    ['ETIQUETA_GENERAL', muestras.muestraEtiquetaGeneral, 'general'],
    ['ETIQUETA_AREA', muestras.muestraEtiquetaArea, 'area'],
    ['ETIQUETA_BEBIDA', muestras.muestraEtiquetaBebida, 'bebida'],
  ]) {
    const tspl = generarTsplTrabajo(tipo, datos, false, { orientacion });
    const ruta = path.join(salida, `previa-${orientacion}-${nombre}.png`);
    fs.writeFileSync(ruta, await render(tspl, 2));
    console.log(ruta);
  }
})();
