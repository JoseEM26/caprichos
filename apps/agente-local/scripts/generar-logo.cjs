// Convierte el logo de la marca a bitmap monocromo para TSPL (BITMAP, 1 bit por punto, 0 = negro).
// Uso (una sola vez, o si cambia el logo): node scripts/generar-logo.cjs
// Usa sharp solo aqui; el agente lleva el resultado ya convertido en src/tspl/logoBitmap.ts.
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..', '..', '..');
let sharp;
try { sharp = require('sharp'); } catch {
  const dir = fs.readdirSync(path.join(raiz, 'node_modules/.pnpm')).find((d) => d.startsWith('sharp@'));
  sharp = require(path.join(raiz, 'node_modules/.pnpm', dir, 'node_modules/sharp'));
}
const LADO = 64; // dots: 8 mm a 203 dpi
const UMBRAL = 110; // fondo azul oscuro -> negro; dibujo naranja y exterior -> blanco
sharp(path.join(raiz, 'apps/web/public/logo.webp'))
  .flatten({ background: '#ffffff' })
  .resize(LADO, LADO, { fit: 'cover' })
  .greyscale()
  .raw()
  .toBuffer()
  .then((px) => {
    const ancho = LADO / 8;
    const out = Buffer.alloc(ancho * LADO, 0xff);
    for (let y = 0; y < LADO; y++)
      for (let x = 0; x < LADO; x++)
        if (px[y * LADO + x] < UMBRAL) out[y * ancho + (x >> 3)] &= ~(0x80 >> (x & 7));
    // Rotados (el BITMAP de TSPL no rota): 90 = en sentido horario, 270 = antihorario
    const rotar = (cw) => {
      const r = Buffer.alloc(ancho * LADO, 0xff);
      for (let y = 0; y < LADO; y++)
        for (let x = 0; x < LADO; x++)
          if (!(out[y * ancho + (x >> 3)] & (0x80 >> (x & 7)))) {
            const [nx, ny] = cw ? [LADO - 1 - y, x] : [y, LADO - 1 - x];
            r[ny * ancho + (nx >> 3)] &= ~(0x80 >> (nx & 7));
          }
      return r;
    };
    const ts =
      `// Generado por scripts/generar-logo.cjs desde apps/web/public/logo.webp. No editar a mano.\n` +
      `export const LOGO_LADO = ${LADO};\n` +
      `/** Bitmap TSPL ${LADO}x${LADO}: 1 bit por punto, 0 = negro, filas de ${ancho} bytes. */\n` +
      `export const LOGO_BASE64 = '${out.toString('base64')}';\n` +
      `/** Mismo logo girado 90 grados en sentido horario (etiqueta vertical-girado, giro 90). */\n` +
      `export const LOGO_BASE64_90 = '${rotar(true).toString('base64')}';\n` +
      `/** Mismo logo girado 90 grados en sentido antihorario (giro 270). */\n` +
      `export const LOGO_BASE64_270 = '${rotar(false).toString('base64')}';\n`;
    fs.writeFileSync(path.join(__dirname, '..', 'src/tspl/logoBitmap.ts'), ts);
    console.log('logoBitmap.ts escrito', out.length, 'bytes');
  });
