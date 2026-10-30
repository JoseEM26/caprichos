// Vista previa PNG de cada sticker a partir del TSPL real que genera el agente (sin impresora).
// Uso: pnpm build && node scripts/previa-png.cjs <carpeta-salida> [vertical-girado|horizontal|vertical] [90|270] [largos]
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
    } else if ((m = /^TEXT (\d+),(\d+),"(\d)",(\d+),(\d+),(\d+),"(.*)"$/.exec(linea))) {
      const [x, y] = [+m[1], +m[2]]; const [cw, ch] = FUENTE[m[3]]; const rot = +m[4], xm = +m[5], ym = +m[6];
      const txt = m[7];
      const w = Math.max(1, txt.length * cw), h = ch;
      const fs_ = Math.min(cw / 0.6, ch * 0.95);
      // un <text> por caracter: asi cada uno cae en su celda de la fuente (librsvg ignora la lista x de un solo <text>)
      const letras = [...txt].map((c, n) => `<text x="${n * cw}" y="${h * 0.78}" font-family="DejaVu Sans Mono, monospace" font-weight="bold" font-size="${fs_}">${esc(c)}</text>`).join('');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#fff"/>${letras}</svg>`;
      const t = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer();
      for (let j = 0; j < h * ym; j++) for (let k = 0; k < w * xm; k++) if (t[((j / ym) | 0) * w + ((k / xm) | 0)] < 140) {
        const a = k, b = j; // coordenadas locales del texto sin girar
        if (rot === 90) set(x - b, y + a, 0); else if (rot === 270) set(x + b, y - a, 0); else set(x + a, y + b, 0);
      }
    }
  }
  const base = sharp(px, { raw: { width: W, height: H, channels: 1 } });
  const giro = (/",(90|270),\d+,\d+,"/.exec(script) || [])[1];
  // "pegado": el sticker se gira para leerse parado (90 -> antihorario, 270 -> horario)
  const pegado = giro ? await sharp(await base.clone().png().toBuffer()).rotate(giro === '90' ? 270 : 90).resize(H * escala / 2, W * escala / 2).png().toBuffer() : null;
  return { fisico: await base.resize(W * escala / 2, H * escala / 2).png().toBuffer(), pegado };
}

const larga = 'ADMINISTRACION INTERNACIONAL DE EMPRESAS';
const L = {
  general: { ...muestras.muestraEtiquetaGeneral, who: 'MARIA ELENA GUADALUPE DEL CARMEN', cantidadProductos: 9, nota: larga + ' ' + larga,
    productos: Array.from({ length: 9 }, (_, i) => ({ cantidad: i + 1, nombre: `Producto ${i + 1} con nombre largo ${larga}`, tamano: '12oz' })) },
  area: { ...muestras.muestraEtiquetaArea, who: 'MARIA ELENA GUADALUPE DEL CARMEN', esCompacta: false, nota: larga + ' ' + larga,
    lineas: Array.from({ length: 6 }, (_, i) => ({ cantidad: 2, nombre: `Sandwich especial ${i} ${larga}`, tamano: 'Grande', opciones: ['Sin cebolla ni tomate', 'Con extra queso fundido', 'Salsa aparte'] })) },
  bebida: { ...muestras.muestraEtiquetaBebida, persona: 'MARIA ELENA GUADALUPE DEL CARMEN', bebidaNombre: 'CAPPUCCINO VAINILLA CARAMELO SALADO CON CREMA BATIDA Y CHISPAS',
    opciones: ['Leche de avena sin lactosa', 'Sin azucar', 'Extra canela en polvo', 'Doble shot espresso', 'Temperatura muy caliente', 'Vaso reutilizable grande'],
    contiene: 'Avena, canela, espresso doble, vainilla natural, caramelo salado, crema batida, chispas de chocolate, jarabe de arce, leche vegetal', who: 'Para: Juan Alberto Perez de la Cruz Quispe' },
};
(async () => {
  const salida = process.argv[2] || '.';
  const orientacion = process.argv[3] || 'vertical-girado';
  const giro = Number(process.argv[4]) === 270 ? 270 : 90;
  const largos = process.argv[5] === 'largos';
  fs.mkdirSync(salida, { recursive: true });
  // DATOS_JSON=<archivo> {general, area, bebida}: usa esos datos (p. ej. los del panel) en vez de las muestras
  const D = process.env.DATOS_JSON ? JSON.parse(fs.readFileSync(process.env.DATOS_JSON, 'utf8')) : null;
  for (const [tipo, datos, nombre] of [
    ['ETIQUETA_GENERAL', D ? D.general : largos ? L.general : muestras.muestraEtiquetaGeneral, 'general'],
    ['ETIQUETA_AREA', D ? D.area : largos ? L.area : muestras.muestraEtiquetaArea, 'area'],
    ['ETIQUETA_BEBIDA', D ? D.bebida : largos ? L.bebida : muestras.muestraEtiquetaBebida, 'bebida'],
  ]) {
    const tspl = generarTsplTrabajo(tipo, datos, false, { orientacion, giro });
    const r = await render(tspl, 2);
    const ruta = path.join(salida, `previa-${orientacion}-${nombre}.png`);
    fs.writeFileSync(ruta, r.fisico);
    console.log(ruta);
    if (r.pegado) {
      fs.writeFileSync(path.join(salida, `pegado-${orientacion}-${nombre}.png`), r.pegado);
      console.log(path.join(salida, `pegado-${orientacion}-${nombre}.png`));
    }
  }
})();
