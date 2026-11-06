import { useEffect, useRef, useState } from 'react';

export interface EnlaceBanner {
  tipo: 'CARTA' | 'CATEGORIA' | 'PRODUCTO' | 'URL';
  valor?: string;
}
export interface BannerImagen {
  id: string;
  url: string;
  urlCelular?: string;
  alt: string;
  enlace?: EnlaceBanner;
  activo: boolean;
  /** Fechas AAAA-MM-DD (hora de Lima): desde 00:00 del primer día hasta 23:59 del último. */
  desde?: string;
  hasta?: string;
}

/** Hoy en Lima como AAAA-MM-DD. */
export const hoyLima = (ahora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
export const fechaLegible = (f: string) => f.split('-').reverse().join('/');
export const vigenteHoy = (b: { desde?: string; hasta?: string }, hoy = hoyLima()) => (!b.desde || hoy >= b.desde) && (!b.hasta || hoy <= b.hasta);
/** Estado que ve Kevin en el diseñador. */
export function estadoBanner(b: BannerImagen, hoy = hoyLima()): { id: 'ACTIVO' | 'PROGRAMADO' | 'VENCIDO' | 'OCULTO'; texto: string } {
  if (b.activo === false) return { id: 'OCULTO', texto: 'Oculto' };
  if (b.desde && hoy < b.desde) return { id: 'PROGRAMADO', texto: `Programado (empieza el ${fechaLegible(b.desde)})` };
  if (b.hasta && hoy > b.hasta) return { id: 'VENCIDO', texto: `Vencido (terminó el ${fechaLegible(b.hasta)})` };
  return { id: 'ACTIVO', texto: 'Activo' };
}

/** Proporción del espacio del banner: 16:5 en PC (1600×500) y 4:3 en celular. */
export const PROPORCION_BANNER = { pc: '16 / 5', movil: '4 / 3' } as const;

const reducirMovimiento = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
  imagenes: BannerImagen[];
  intervaloSeg: number;
  movil: boolean;
  /** En edición no avanza solo ni abre enlaces. */
  edicion?: boolean;
  onEnlace?: (e: EnlaceBanner) => void;
}

/** Carrusel de banners propios: ocupa todo el espacio del banner del mes. Con una sola imagen no hay controles ni temporizador. */
export function CarruselBanners({ imagenes, intervaloSeg, movil, edicion, onEnlace }: Props) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const inicioX = useRef<number | null>(null);
  const n = imagenes.length;
  const actual = n ? Math.min(i, n - 1) : 0;
  const varios = n > 1;
  const url = (b: BannerImagen) => (movil && b.urlCelular ? b.urlCelular : b.url);

  const ir = (d: number) => setI((x) => (Math.min(x, n - 1) + d + n) % n);

  useEffect(() => {
    if (!varios || pausa || edicion || reducirMovimiento()) return;
    const t = setTimeout(() => setI((x) => (Math.min(x, n - 1) + 1) % n), intervaloSeg * 1000);
    return () => clearTimeout(t);
  }, [varios, pausa, edicion, actual, n, intervaloSeg]);

  // precarga de la siguiente imagen
  useEffect(() => {
    if (varios && typeof Image !== 'undefined') new Image().src = url(imagenes[(actual + 1) % n]);
  }, [actual, varios]);

  if (!n) return null;
  const b = imagenes[actual];
  const img = (
    <img
      src={url(b)}
      alt={b.alt}
      {...(actual === 0 ? { fetchPriority: 'high' as const } : {})}
      loading={actual === 0 ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
  const caja = { display: 'block', width: '100%', height: '100%', padding: 0, border: 0, background: 'none', cursor: 'pointer' } as const;
  const e = !edicion ? b.enlace : undefined;
  const contenido = !e ? img : e.tipo === 'URL' ? (
    <a href={e.valor} target="_blank" rel="noopener noreferrer" style={caja}>{img}</a>
  ) : (
    <button type="button" aria-label={b.alt || 'Ver banner'} onClick={() => onEnlace?.(e)} style={caja}>{img}</button>
  );
  const flecha = (lado: 'izq' | 'der') => (
    <button
      type="button"
      aria-label={lado === 'izq' ? 'Banner anterior' : 'Banner siguiente'}
      onClick={() => ir(lado === 'izq' ? -1 : 1)}
      style={{ position: 'absolute', top: '50%', [lado === 'izq' ? 'left' : 'right']: 8, transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 0, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 20, cursor: 'pointer' }}
    >
      {lado === 'izq' ? '‹' : '›'}
    </button>
  );

  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label="Banners"
      data-carrusel-banners
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      onFocus={() => setPausa(true)}
      onBlur={() => setPausa(false)}
      onTouchStart={(ev) => { setPausa(true); inicioX.current = ev.touches[0]?.clientX ?? null; }}
      onTouchEnd={(ev) => {
        const x0 = inicioX.current;
        inicioX.current = null;
        setPausa(false);
        const dx = x0 === null ? 0 : (ev.changedTouches[0]?.clientX ?? x0) - x0;
        if (varios && Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
      }}
      style={{ position: 'relative', overflow: 'hidden', width: '100%', aspectRatio: movil ? PROPORCION_BANNER.movil : PROPORCION_BANNER.pc, borderRadius: movil ? 22 : 28, background: 'var(--cp-navy)' }}
    >
      <div aria-live={pausa || !varios ? 'polite' : 'off'} style={{ width: '100%', height: '100%' }}>{contenido}</div>
      {varios && flecha('izq')}
      {varios && flecha('der')}
      {varios && (
        <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {imagenes.map((x, k) => (
            <button
              key={x.id}
              type="button"
              aria-label={`Ir al banner ${k + 1}`}
              aria-current={k === actual ? 'true' : undefined}
              onClick={() => setI(k)}
              style={{ width: 10, height: 10, padding: 0, borderRadius: '50%', border: '1px solid #fff', background: k === actual ? '#fff' : 'rgba(0,0,0,0.35)', cursor: 'pointer' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
