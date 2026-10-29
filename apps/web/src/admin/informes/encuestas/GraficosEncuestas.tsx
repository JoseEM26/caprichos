import { useState } from 'react';

export interface DistribucionPuntaje {
  puntaje: number;
  cantidad: number;
}

export interface PuntoTendencia {
  dia: string;
  promedio: number | null;
  respondidas: number;
}

export interface FilaModalidadStat {
  modalidad: string;
  promedio: number | null;
  respondidas: number;
}

/** Verde para lo alto, rojo para lo bajo. Mismo color en todas las vistas. */
export const COLOR_PUNTAJE: Record<number, string> = {
  1: '#E34948',
  2: '#E67929',
  3: '#D99E39',
  4: '#7DB355',
  5: '#2F7A45',
};

export const ETIQUETA_MODALIDAD: Record<string, string> = {
  MESA: 'En mesa',
  RECOGER: 'Para recoger',
  DELIVERY: 'Delivery',
};

const fechaCorta = (dia: string) => dia.split('-').reverse().slice(0, 2).join('/');

/** Barras verticales de la distribución 1 a 5. Escala fija 0 a máximo del periodo. */
export function GraficoDistribucion({ datos }: { datos: DistribucionPuntaje[] }) {
  const total = datos.reduce((s, d) => s + d.cantidad, 0);
  const max = Math.max(1, ...datos.map((d) => d.cantidad));
  const ancho = 360;
  const alto = 170;
  const base = 130;
  const areaUtil = base - 24;
  const paso = ancho / datos.length;
  const ancoBarra = paso * 0.56;
  const resumenTexto = datos
    .map((d) => `${d.puntaje} estrella${d.puntaje === 1 ? '' : 's'}: ${d.cantidad}`)
    .join(', ');

  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <svg
        role="img"
        aria-label={`Distribución de puntajes. ${resumenTexto}. Total ${total} respuestas.`}
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {datos.map((d, i) => {
          const h = total === 0 ? 0 : Math.max(d.cantidad > 0 ? 3 : 0, (d.cantidad / max) * areaUtil);
          const x = i * paso + (paso - ancoBarra) / 2;
          return (
            <g key={d.puntaje}>
              <title>{`${d.puntaje} estrella${d.puntaje === 1 ? '' : 's'}: ${d.cantidad} respuestas`}</title>
              <rect x={x} y={base - h} width={ancoBarra} height={h} rx={4} fill={COLOR_PUNTAJE[d.puntaje]} />
              <text x={x + ancoBarra / 2} y={base - h - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--cp-navy)">
                {d.cantidad}
              </text>
              <text x={x + ancoBarra / 2} y={base + 16} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--cp-soft)">
                {d.puntaje}
              </text>
            </g>
          );
        })}
        <line x1={0} x2={ancho} y1={base} y2={base} stroke="var(--cp-line)" strokeWidth={1} />
      </svg>
      <figcaption style={{ fontSize: 12, color: 'var(--cp-soft)' }}>{resumenTexto}</figcaption>
    </figure>
  );
}

/** Línea del promedio por día. Escala fija de 1 a 5 (no hay doble eje). Días sin respuestas quedan cortados. */
export function GraficoTendencia({ puntos }: { puntos: PuntoTendencia[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const ancho = 360;
  const alto = 180;
  const izq = 26;
  const der = 8;
  const arriba = 10;
  const abajo = 26;
  const anchoUtil = ancho - izq - der;
  const altoUtil = alto - arriba - abajo;
  const n = puntos.length;
  const xDe = (i: number) => izq + (n <= 1 ? anchoUtil / 2 : (i / (n - 1)) * anchoUtil);
  const yDe = (v: number) => arriba + ((5 - v) / 4) * altoUtil;

  // Segmentos continuos separados por días sin datos
  const segmentos: string[] = [];
  let actual: string[] = [];
  puntos.forEach((p, i) => {
    if (p.promedio == null) {
      if (actual.length) segmentos.push(actual.join(' '));
      actual = [];
    } else {
      actual.push(`${actual.length ? 'L' : 'M'}${xDe(i).toFixed(1)},${yDe(p.promedio).toFixed(1)}`);
    }
  });
  if (actual.length) segmentos.push(actual.join(' '));

  const conDatos = puntos.filter((p) => p.promedio != null).length;
  const etiquetas = n > 0 ? [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i) : [];
  const punto = activo != null ? puntos[activo] : null;

  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <svg
        role="img"
        aria-label={`Tendencia del promedio por día. ${conDatos} días con respuestas de ${n}.`}
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseLeave={() => setActivo(null)}
      >
        {[1, 3, 5].map((v) => (
          <g key={v}>
            <line x1={izq} x2={ancho - der} y1={yDe(v)} y2={yDe(v)} stroke="var(--cp-line)" strokeDasharray="3 3" />
            <text x={izq - 6} y={yDe(v) + 4} textAnchor="end" fontSize={10} fill="var(--cp-soft)">
              {v}
            </text>
          </g>
        ))}
        {segmentos.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--cp-orange)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {puntos.map((p, i) =>
          p.promedio == null ? null : (
            <g key={p.dia}>
              <title>{`${fechaCorta(p.dia)}: promedio ${p.promedio.toFixed(1)} (${p.respondidas} respuestas)`}</title>
              <circle
                cx={xDe(i)}
                cy={yDe(p.promedio)}
                r={activo === i ? 5 : 3.5}
                fill="var(--cp-orange)"
                stroke="var(--cp-white)"
                strokeWidth={1.5}
                onMouseEnter={() => setActivo(i)}
                onFocus={() => setActivo(i)}
              />
            </g>
          ),
        )}
        {etiquetas.map((i) => (
          <text key={i} x={xDe(i)} y={alto - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={10} fill="var(--cp-soft)">
            {fechaCorta(puntos[i].dia)}
          </text>
        ))}
      </svg>
      <figcaption style={{ fontSize: 12, color: 'var(--cp-soft)', minHeight: 16 }} aria-live="polite">
        {punto
          ? `${fechaCorta(punto.dia)}: promedio ${punto.promedio != null ? punto.promedio.toFixed(1) : 'sin dato'}, ${punto.respondidas} respuestas`
          : 'Pasa el cursor o toca un punto para ver el detalle del día.'}
      </figcaption>
    </figure>
  );
}

/** Barras horizontales del promedio por modalidad. */
export function BarrasModalidad({ filas }: { filas: FilaModalidadStat[] }) {
  if (filas.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Sin respuestas por modalidad en el período.</div>;
  }
  return (
    <ul
      aria-label="Promedio por modalidad"
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {filas.map((f) => {
        const pct = f.promedio != null ? (f.promedio / 5) * 100 : 0;
        const color = f.promedio != null ? COLOR_PUNTAJE[Math.min(5, Math.max(1, Math.round(f.promedio)))] : 'var(--cp-sand)';
        return (
          <li key={f.modalidad} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, auto) 1fr auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
            <span style={{ fontWeight: 700 }}>{ETIQUETA_MODALIDAD[f.modalidad] ?? f.modalidad}</span>
            <span
              role="presentation"
              style={{ height: 10, borderRadius: 5, background: 'var(--cp-sand)', overflow: 'hidden' }}
            >
              <span style={{ display: 'block', height: 10, width: `${pct}%`, background: color, borderRadius: 5 }} />
            </span>
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
              {f.promedio != null ? f.promedio.toFixed(1) : '-'} · {f.respondidas}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
