import type { ReactNode } from 'react';
import type { Escenario, FormaParticula, TemaCelebracion } from './temas';

/** Decorado del fondo: todo SVG/CSS dibujado aquí, sin imágenes externas. Se repite cada `P` unidades para que recortar el ancho no se note. */
const rango = (n: number) => Array.from({ length: n }, (_, i) => i);

const ARRIBA: Record<Escenario, () => ReactNode> = {
  clasico: () => (
    <>
      {rango(21).map((i) => <rect key={`r${i}`} x={i * 60 - 20} y="0" width="60" height="70" fill={i % 2 ? '#FFF4E1' : '#E67929'} />)}
      {rango(21).map((i) => <circle key={`c${i}`} cx={i * 60 + 10} cy="70" r="30" fill={i % 2 ? '#FFF4E1' : '#E67929'} />)}
      {rango(21).map((i) => <circle key={`d${i}`} cx={i * 60 + 10} cy="70" r="30" fill="none" stroke="#0B2C3E" strokeOpacity=".18" strokeWidth="3" />)}
    </>
  ),
  navidad: () => (
    <>
      <path d={`M-20 22 ${rango(21).map((i) => `Q${i * 60 + 10} 78 ${i * 60 + 40} 22`).join(' ')}`} fill="none" stroke="#0E5A31" strokeWidth="9" strokeLinecap="round" />
      <path d={`M-20 22 ${rango(21).map((i) => `Q${i * 60 + 10} 78 ${i * 60 + 40} 22`).join(' ')}`} fill="none" stroke="#2F9A57" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
      {rango(21).map((i) => <circle key={i} cx={i * 60 + 10} cy="52" r="11" fill={['#E5373D', '#F6C945', '#FFFFFF', '#46A6E8'][i % 4]} stroke="#00000030" strokeWidth="2" />)}
    </>
  ),
  halloween: () => (
    <>
      {[60, 210, 380, 520, 700, 880, 1040].map((x, i) => (
        <g key={x} transform={`translate(${x} ${30 + (i % 3) * 34}) scale(${1.5 + (i % 2) * 0.6})`} fill="#0D0618">
          <path d="M0 0 q-10 -14 -26 -10 q6 6 6 12 q-8 -2 -14 6 q10 2 14 10 q6 -8 20 -4 q4 4 6 8 q2 -4 6 -8 q14 -4 20 4 q4 -8 14 -10 q-6 -8 -14 -6 q0 -6 6 -12 q-16 -4 -26 10 z" />
        </g>
      ))}
    </>
  ),
  patrias: () => (
    <>
      <path d={`M-20 18 ${rango(11).map((i) => `Q${i * 120 + 40} 70 ${i * 120 + 100} 18`).join(' ')}`} fill="none" stroke="#FFFFFF" strokeWidth="4" />
      {rango(22).map((i) => <path key={i} d={`M${i * 60 - 30} ${24 + 24 * Math.sin((i % 2) * 3.14)} l24 0 l-12 52 z`} transform={`translate(${i * 0} ${(i % 2) * 6})`} fill={i % 2 ? '#FFFFFF' : '#8E0A20'} stroke="#00000022" strokeWidth="2" />)}
    </>
  ),
  corazones: () => (
    <>
      <path d={`M-20 20 ${rango(21).map((i) => `Q${i * 60 + 10} 60 ${i * 60 + 40} 20`).join(' ')}`} fill="none" stroke="#FFFFFF" strokeWidth="3" />
      {rango(20).map((i) => <path key={i} transform={`translate(${i * 60 + 10} ${50 + (i % 2) * 8}) scale(1.6)`} d="M0 14 C-18 0 -14 -14 0 -6 C14 -14 18 0 0 14 z" fill={i % 2 ? '#FFFFFF' : '#C2185B'} />)}
    </>
  ),
  fuegos: () => <rect width="1200" height="0" />,
  verano: () => (
    <>
      {[[160, 40, 1], [520, 70, 1.4], [900, 36, 0.9]].map(([x, y, s]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${s})`} fill="#FFFFFF" opacity=".85">
          <ellipse cx="0" cy="0" rx="70" ry="22" /><ellipse cx="-30" cy="-16" rx="34" ry="22" /><ellipse cx="22" cy="-22" rx="40" ry="26" />
        </g>
      ))}
    </>
  ),
  flores: () => (
    <>
      {rango(21).map((i) => <circle key={i} cx={i * 60 + 10} cy="0" r="34" fill={i % 2 ? '#FFFFFF' : '#FFC2DD'} opacity=".9" />)}
      {rango(21).map((i) => <circle key={`s${i}`} cx={i * 60 + 10} cy="0" r="34" fill="none" stroke="#C777A8" strokeOpacity=".35" strokeWidth="2" />)}
    </>
  ),
};

const pino = (x: number, h: number, key: string) => (
  <g key={key} transform={`translate(${x} 260)`}>
    <rect x="-7" y="-20" width="14" height="24" fill="#4B2E1B" />
    {[0, 1, 2].map((i) => <path key={i} d={`M0 ${-h + i * h * 0.26} l${40 - i * 5} ${h * 0.4} h${-(80 - i * 10)} z`} fill={i % 2 ? '#14703F' : '#0E5A31'} />)}
    <path d={`M0 ${-h - 2} l7 14 h-14 z`} fill="#FFFFFF" opacity=".9" />
  </g>
);

const calabaza = (x: number, y: number, s: number, key: string) => (
  <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 -34 q4 -14 12 -16" stroke="#3E7B2A" strokeWidth="7" fill="none" strokeLinecap="round" />
    <ellipse cx="-22" cy="0" rx="26" ry="32" fill="#E8680F" /><ellipse cx="22" cy="0" rx="26" ry="32" fill="#E8680F" />
    <ellipse cx="0" cy="0" rx="26" ry="35" fill="#FF8A1F" stroke="#B04A06" strokeWidth="2" />
    <path d="M-16 -8 l8 -10 l8 10 z M8 -8 l8 -10 l8 10 z M-18 12 q18 18 36 0 l-8 -4 l-6 6 l-6 -6 z" fill="#3A1A00" transform="scale(.9) translate(0 4)" />
  </g>
);

const ABAJO: Record<Escenario, () => ReactNode> = {
  clasico: () => (
    <>
      <path d="M0 150 Q150 90 300 150 T600 150 T900 150 T1200 150 V260 H0z" fill="#FFF4E1" opacity=".13" />
      <path d="M0 185 Q150 135 300 185 T600 185 T900 185 T1200 185 V260 H0z" fill="#E67929" opacity=".85" />
      <path d="M0 220 Q150 180 300 220 T600 220 T900 220 T1200 220 V260 H0z" fill="#F2C14E" />
      {rango(9).map((i) => (
        <g key={i} transform={`translate(${i * 150 + 40} ${232 - (i % 2) * 6})`}>
          <circle r="16" fill="#C9772B" /><circle r="16" fill="none" stroke="#FFF4E1" strokeWidth="5" strokeDasharray="3 7" /><circle r="5" fill="#F2C14E" />
        </g>
      ))}
    </>
  ),
  navidad: () => (
    <>
      {[60, 170, 380, 560, 800, 980, 1130].map((x, i) => pino(x, 120 + (i % 3) * 30, `p${x}`))}
      <path d="M0 215 Q200 170 400 215 T800 215 T1200 215 V260 H0z" fill="#FFFFFF" />
      <path d="M0 238 Q300 205 600 238 T1200 238 V260 H0z" fill="#DCEBF7" />
    </>
  ),
  halloween: () => (
    <>
      <path d="M0 150 Q200 80 420 150 T820 140 T1200 130 V260 H0z" fill="#2B1250" />
      <path d="M0 200 Q250 150 500 205 T1000 195 T1200 190 V260 H0z" fill="#1B0B38" />
      {calabaza(130, 215, 0.9, 'a')}{calabaza(330, 232, 0.55, 'b')}{calabaza(880, 218, 1, 'c')}{calabaza(1060, 236, 0.6, 'd')}
    </>
  ),
  patrias: () => (
    <>
      <path d="M0 170 Q150 120 300 170 T600 170 T900 170 T1200 170 V260 H0z" fill="#FFFFFF" opacity=".25" />
      <path d="M0 205 Q150 160 300 205 T600 205 T900 205 T1200 205 V260 H0z" fill="#FFFFFF" />
      <path d="M0 238 Q150 208 300 238 T600 238 T900 238 T1200 238 V260 H0z" fill="#8E0A20" />
    </>
  ),
  corazones: () => (
    <>
      <path d="M0 200 Q300 150 600 205 T1200 195 V260 H0z" fill="#FFD0E0" opacity=".7" />
      {rango(14).map((i) => <path key={i} transform={`translate(${i * 90 + 20} ${236 - (i % 3) * 10}) scale(${1.7 + (i % 3) * 0.5})`} d="M0 14 C-18 0 -14 -14 0 -6 C14 -14 18 0 0 14 z" fill={['#C2185B', '#FF5C8A', '#FFFFFF'][i % 3]} opacity=".92" />)}
    </>
  ),
  fuegos: () => (
    <>
      <path d={`M0 260 V200 ${rango(24).map((i) => `h25 v${[-30, 25, -18, 40, -35, 12][i % 6]} h25 v${[30, -25, 18, -40, 35, -12][i % 6]}`).join(' ')} V260z`} fill="#06061A" />
      {rango(40).map((i) => <rect key={i} x={(i * 53) % 1200} y={215 + ((i * 17) % 35)} width="5" height="6" fill="#F5C84B" opacity=".7" />)}
    </>
  ),
  verano: () => (
    <>
      <path d="M0 150 Q150 125 300 150 T600 150 T900 150 T1200 150 V260 H0z" fill="#1D96C8" />
      <path d="M0 180 Q150 150 300 180 T600 180 T900 180 T1200 180 V260 H0z" fill="#46B5DE" />
      <path d="M0 215 Q150 190 300 215 T600 215 T900 215 T1200 215 V260 H0z" fill="#F4D58D" />
      <path d="M0 238 Q200 222 400 238 T800 238 T1200 238 V260 H0z" fill="#E9BE6A" />
    </>
  ),
  flores: () => (
    <>
      <path d="M0 215 Q300 175 600 215 T1200 210 V260 H0z" fill="#8CC48A" opacity=".8" />
      {rango(13).map((i) => (
        <g key={i} transform={`translate(${i * 95 + 30} ${242 - (i % 3) * 8}) scale(${1 + (i % 3) * 0.3})`}>
          <path d="M0 0 v50" stroke="#3E8B4D" strokeWidth="5" />
          {rango(6).map((p) => <ellipse key={p} cx="0" cy="-17" rx="8" ry="15" fill={['#FFFFFF', '#FF8DB8', '#FFC2DD'][i % 3]} transform={`rotate(${p * 60})`} />)}
          <circle r="7" fill="#F5C84B" />
        </g>
      ))}
    </>
  ),
};

/** Centro del fondo, detrás del avatar: luna, sol, fuegos artificiales */
function Astro({ e }: { e: Escenario }) {
  if (e === 'halloween') return (
    <svg className="avc-astro avc-astro-der" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="92" fill="#FFB84D" opacity=".22" /><circle cx="100" cy="100" r="70" fill="#FFD27A" />
      <circle cx="78" cy="82" r="12" fill="#F0B24C" /><circle cx="120" cy="120" r="16" fill="#F0B24C" /><circle cx="116" cy="70" r="7" fill="#F0B24C" />
    </svg>
  );
  if (e === 'verano') return (
    <svg className="avc-astro avc-astro-der" viewBox="0 0 200 200" aria-hidden="true">
      <g stroke="#FFD24D" strokeWidth="8" strokeLinecap="round">{rango(12).map((i) => <path key={i} d="M100 8 v22" transform={`rotate(${i * 30} 100 100)`} />)}</g>
      <circle cx="100" cy="100" r="52" fill="#FFD24D" />
    </svg>
  );
  if (e === 'fuegos') return (
    <>
      {[[22, 20, 1], [76, 14, 1.2], [58, 40, 0.8]].map(([x, y, s], k) => (
        <svg key={k} className="avc-astro avc-fuego" style={{ left: `${x}%`, top: `${y}%`, width: `${22 * s}vmin`, animationDelay: `${k * 0.7}s` }} viewBox="-50 -50 100 100" aria-hidden="true">
          <g stroke={['#F5C84B', '#FF8A5B', '#9CD9FF'][k]} strokeWidth="2.6" strokeLinecap="round">{rango(16).map((i) => <path key={i} d="M12 0 h24" transform={`rotate(${i * 22.5})`} />)}</g>
          <circle r="3" fill="#FFFFFF" />
        </svg>
      ))}
    </>
  );
  return null;
}

function Particula({ forma, color }: { forma: FormaParticula; color: string }) {
  switch (forma) {
    case 'nieve': return <svg viewBox="0 0 10 10" width="100%" height="100%"><circle cx="5" cy="5" r="4.5" fill={color} /></svg>;
    case 'burbuja': return <svg viewBox="0 0 10 10" width="100%" height="100%"><circle cx="5" cy="5" r="4.2" fill={color} fillOpacity=".25" stroke={color} strokeWidth="1" /></svg>;
    case 'corazon': return <svg viewBox="-10 -10 20 20" width="100%" height="100%"><path d="M0 8 C-12 -1 -9 -9 0 -3 C9 -9 12 -1 0 8 z" fill={color} /></svg>;
    case 'estrella': return <svg viewBox="-10 -10 20 20" width="100%" height="100%"><path d="M0 -10 Q1.5 -1.5 10 0 Q1.5 1.5 0 10 Q-1.5 1.5 -10 0 Q-1.5 -1.5 0 -10z" fill={color} /></svg>;
    case 'hoja': return <svg viewBox="-10 -10 20 20" width="100%" height="100%"><path d="M0 -9 Q10 -2 0 9 Q-10 -2 0 -9z" fill={color} /></svg>;
    default: return <svg viewBox="0 0 10 16" width="100%" height="100%"><rect width="10" height="16" rx="2" fill={color} /></svg>;
  }
}

const ANIM: Record<FormaParticula, string> = { confeti: 'avc-cae', nieve: 'avc-nieve', hoja: 'avc-hoja', corazon: 'avc-sube', burbuja: 'avc-sube', estrella: 'avc-titila' };
const TAM: Record<FormaParticula, number> = { confeti: 9, nieve: 9, hoja: 16, corazon: 20, burbuja: 20, estrella: 18 };
// Reparto fijo (sin azar en el render)
const PARTICULAS = Array.from({ length: 26 }, (_, i) => ({ izq: (i * 37 + 7) % 97, top: (i * 29) % 80, dur: 4.5 + (i % 5) * 0.8, ret: (i % 8) * 0.45, k: i, t: 0.7 + (i % 4) * 0.25 }));

/** Fondo completo de la temática: color, rayos de luz, escenario arriba y abajo, astro y partículas. */
export function FondoCelebracion({ tema }: { tema: TemaCelebracion }) {
  const { forma, colores, sube } = tema.particulas;
  const anim = ANIM[forma];
  return (
    <div className={`avc-fondo avc-esc-${tema.escenario}`} style={{ background: tema.fondo }} aria-hidden="true" data-testid="fondo-celebracion" data-tema={tema.id}>
      <div className="avc-rayos" />
      <Astro e={tema.escenario} />
      <svg className="avc-borde avc-arriba" viewBox="0 0 1200 170" preserveAspectRatio="xMidYMin slice">{ARRIBA[tema.escenario]()}</svg>
      <svg className="avc-borde avc-abajo" viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax slice">{ABAJO[tema.escenario]()}</svg>
      {PARTICULAS.map((p) => (
        <i
          key={p.k}
          className={`avc-part ${anim}`}
          style={{
            left: `${p.izq}%`,
            top: anim === 'avc-titila' ? `${p.top}%` : sube ? undefined : 0,
            bottom: sube && anim !== 'avc-titila' ? 0 : undefined,
            width: TAM[forma] * p.t,
            height: (forma === 'confeti' ? 1.6 : 1) * TAM[forma] * p.t,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.ret}s`,
          }}
        >
          <Particula forma={forma} color={colores[p.k % colores.length]} />
        </i>
      ))}
    </div>
  );
}
