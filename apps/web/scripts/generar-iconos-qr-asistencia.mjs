// Genera los PNG de la app «QR Asistencia» desde apps/web/public/icons/qr-asistencia.svg.
// Uso: node apps/web/scripts/generar-iconos-qr-asistencia.mjs (sharp viene de apps/api).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(path.join(aqui, '../../api/package.json'))('sharp');
const dir = path.join(aqui, '../public/icons');
const svg = readFileSync(path.join(dir, 'qr-asistencia.svg'));

// El motivo ocupa ~59 % centrado: cabe en la zona segura (80 %) del maskable.
for (const [nombre, tam] of [['qr-asistencia-192.png', 192], ['qr-asistencia-512.png', 512], ['qr-asistencia-maskable-512.png', 512]]) {
  await sharp(svg, { density: 300 }).resize(tam, tam).png({ compressionLevel: 9, palette: true }).toFile(path.join(dir, nombre));
}
