import { useMemo, useState } from 'react';
import {
  maquetarEtiqueta,
  lineasTicketPago,
  FUENTES_TSPL,
  LOGO_BASE64,
  LOGO_LADO,
} from '@caprichos/compartido';
import type { Maqueta, Primitiva, TicketPagoDatos } from '@caprichos/compartido';
import type { EtiquetaGeneralDatos, EtiquetaAreaDatos, EtiquetaBebidaDatos } from './etiquetasPedido';

/**
 * Vista previa de un sticker: dibuja en SVG las MISMAS primitivas que el programa de impresion convierte a TSPL
 * (maqueta de @caprichos/compartido), en el lienzo vertical 508 x 813 dots, blanco y negro como la termica.
 * Cada caracter ocupa exactamente la celda de la fuente interna de la impresora (1..5) por su multiplicador.
 */
const FUENTE_MONO = "'DejaVu Sans Mono','Liberation Mono',Menlo,Consolas,monospace";

/** Puntos negros del logo (bit 0 = negro) como un solo trazo. */
function trazoLogo(): string {
  const bin = atob(LOGO_BASE64);
  const fila = LOGO_LADO / 8;
  let d = '';
  for (let y = 0; y < LOGO_LADO; y++) {
    let x = 0;
    while (x < LOGO_LADO) {
      const negro = (i: number) => !(bin.charCodeAt(y * fila + (i >> 3)) & (0x80 >> (i & 7)));
      if (!negro(x)) { x++; continue; }
      const ini = x;
      while (x < LOGO_LADO && negro(x)) x++;
      d += `M${ini} ${y}h${x - ini}v1h${ini - x}z`;
    }
  }
  return d;
}
let trazoCache: string | null = null;

function PrimitivaSvg({ p }: { p: Primitiva }) {
  if (p.t === 'texto') {
    const f = FUENTES_TSPL[p.fuente];
    const cw = f.ancho * p.xm;
    const ch = f.alto * p.ym;
    const xs = Array.from(p.texto, (_, i) => p.x + i * cw).join(' ');
    return (
      <text
        x={xs}
        y={p.y + ch * 0.78}
        fontFamily={FUENTE_MONO}
        fontWeight={700}
        fontSize={Math.min(f.ancho / 0.6, f.alto * 0.95) * p.ym}
        fill={p.invertido ? '#fff' : '#000'}
        style={{ whiteSpace: 'pre' }}
        data-fuente={p.fuente}
      >
        {p.texto}
      </text>
    );
  }
  if (p.t === 'caja') {
    const g = p.grosor;
    return (
      <rect
        x={p.x1 + g / 2}
        y={p.y1 + g / 2}
        width={p.x2 - p.x1 - g}
        height={p.y2 - p.y1 - g}
        rx={Math.max(0, p.radio - g / 2)}
        fill="none"
        stroke="#000"
        strokeWidth={g}
      />
    );
  }
  if (p.t === 'barra') return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#000" />;
  if (p.t === 'logo') {
    trazoCache ??= trazoLogo();
    return (
      <path
        data-logo
        d={trazoCache}
        fill={p.invertido ? '#fff' : '#000'}
        transform={`translate(${p.x} ${p.y}) scale(${p.lado / LOGO_LADO})`}
      />
    );
  }
  return null; // 'inverso' se dibuja aparte, debajo de lo invertido
}

export function EtiquetaSvg({ maqueta, etiqueta, zoom = 1 }: { maqueta: Maqueta; etiqueta: string; zoom?: number }) {
  const { W, H, primitivas } = maqueta;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Vista previa de la etiqueta ${etiqueta}`}
      data-maqueta={`${W}x${H}`}
      style={{ display: 'block', width: '100%', maxWidth: (W / 2) * zoom, aspectRatio: `${W} / ${H}`, background: '#fff', border: '1px solid #d8d8d8' }}
    >
      <rect width={W} height={H} fill="#fff" />
      {primitivas.map((p, i) => p.t === 'inverso' && <rect key={`i${i}`} x={p.x} y={p.y} width={p.w} height={p.h} fill="#000" />)}
      {primitivas.map((p, i) => <PrimitivaSvg key={i} p={p} />)}
    </svg>
  );
}

/** Medida del sticker en mm (ancho x alto); sin ella, la de fábrica. */
export interface TamanoPrevia {
  anchoMm?: number;
  altoMm?: number;
  margenMm?: number;
}

export function EtiquetaGeneral({ datos, tamano }: { datos: EtiquetaGeneralDatos; tamano?: TamanoPrevia }) {
  const m = useMemo(() => maquetarEtiqueta('ETIQUETA_GENERAL', datos, tamano), [datos, tamano?.anchoMm, tamano?.altoMm, tamano?.margenMm]);
  return <EtiquetaSvg maqueta={m} etiqueta="general" />;
}

export function EtiquetaArea({ datos }: { datos: EtiquetaAreaDatos }) {
  const m = useMemo(() => maquetarEtiqueta('ETIQUETA_AREA', datos), [datos]);
  return <EtiquetaSvg maqueta={m} etiqueta={`del area ${datos.areaNombre}`} />;
}

export function EtiquetaBebida({ datos, tamano }: { datos: EtiquetaBebidaDatos; tamano?: TamanoPrevia }) {
  const m = useMemo(() => maquetarEtiqueta('ETIQUETA_BEBIDA', datos, tamano), [datos, tamano?.anchoMm, tamano?.altoMm, tamano?.margenMm]);
  return <EtiquetaSvg maqueta={m} etiqueta={`de bebida ${datos.bebidaIndex}`} />;
}

/** Ticket de pago tal como lo imprime la ticketera: bloque monoespaciado del ancho del papel (80 mm = 48 col, 58 mm = 32). */
export function TicketPagoPrevia({ datos, sinCabecera = false }: { datos: TicketPagoDatos; sinCabecera?: boolean }) {
  const [columnas, setColumnas] = useState<48 | 32>(48);
  const lineas = lineasTicketPago(datos, columnas);
  const boton = (c: 48 | 32, texto: string) => (
    <button
      type="button"
      aria-pressed={columnas === c}
      onClick={() => setColumnas(c)}
      style={{
        minHeight: 32,
        padding: '0 12px',
        borderRadius: 9999,
        border: '1.5px solid var(--cp-navy, #0B2C3E)',
        background: columnas === c ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
        color: columnas === c ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
        fontWeight: 700,
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {texto}
    </button>
  );
  return (
    <section aria-label="Ticket de pago" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!sinCabecera && (
        <>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14 }}>4. Ticket de pago</div>
          <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
            Sale en la ticketera al cobrar. Así se imprime, línea por línea.
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {boton(48, 'Papel 80 mm')}
        {boton(32, 'Papel 58 mm')}
      </div>
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <pre
          data-testid="ticket-pago"
          data-columnas={columnas}
          style={{
            margin: 0,
            display: 'inline-block',
            padding: '12px 10px',
            background: '#fff',
            color: '#000',
            border: '1px solid #d8d8d8',
            fontFamily: FUENTE_MONO,
            fontSize: 12,
            lineHeight: '16px',
            width: `${columnas}ch`,
            boxSizing: 'content-box',
          }}
        >
          {lineas.map((l, i) => {
            const pad = l.centrado ? ' '.repeat(Math.max(0, Math.floor((columnas - l.texto.length) / 2))) : '';
            return (
              <div key={i} style={{ fontWeight: l.negrita ? 800 : 400, whiteSpace: 'pre' }}>
                {pad + l.texto || ' '}
              </div>
            );
          })}
        </pre>
      </div>
    </section>
  );
}
