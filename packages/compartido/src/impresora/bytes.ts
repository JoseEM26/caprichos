// Utilidades de bytes sin Buffer: el mismo código corre en el servidor, en el programa de impresión y en el navegador.

/** Texto con un carácter por byte (latin1) a bytes. */
export function latin1ABytes(s: string): Uint8Array {
  const r = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) r[i] = s.charCodeAt(i) & 0xff;
  return r;
}

export function concatBytes(partes: Uint8Array[]): Uint8Array {
  const r = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of partes) {
    r.set(p, o);
    o += p.length;
  }
  return r;
}

/** Bytes a base64 (por trozos: sin desbordar la pila con trabajos grandes). */
export function bytesABase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
