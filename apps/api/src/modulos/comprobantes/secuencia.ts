/** Correlativo atómico por clave (tabla secuencia_comprobante). Series de comprobantes y resúmenes RC/RA. */
export async function siguienteCorrelativo(db: any, clave: string): Promise<number> {
  let filas = await db.$queryRaw<{ ultimo_numero: number }[]>`
    UPDATE secuencia_comprobante
    SET ultimo_numero = ultimo_numero + 1
    WHERE serie = ${clave}
    RETURNING ultimo_numero;
  `;
  if (!filas || filas.length === 0) {
    filas = await db.$queryRaw<{ ultimo_numero: number }[]>`
      INSERT INTO secuencia_comprobante (serie, ultimo_numero)
      VALUES (${clave}, 1)
      ON CONFLICT (serie) DO UPDATE
      SET ultimo_numero = secuencia_comprobante.ultimo_numero + 1
      RETURNING ultimo_numero;
    `;
  }
  return Number(filas[0].ultimo_numero);
}
