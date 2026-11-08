import type { ReactNode } from 'react';

export type ClaveModalidad = 'DELIVERY' | 'LLEVAR' | 'MESA' | 'LOCAL' | 'COMER_LOCAL';

/** Normaliza: RECOGER y LLEVAR (datos antiguos) son «para llevar»; lo desconocido es en el local. */
export function claveModalidad(m?: string | null): ClaveModalidad {
  const mu = String(m || '').toUpperCase();
  if (mu === 'DELIVERY') return 'DELIVERY';
  if (mu === 'LLEVAR' || mu === 'RECOGER') return 'LLEVAR';
  if (mu === 'MESA') return 'MESA';
  if (mu === 'COMER_LOCAL') return 'COMER_LOCAL';
  return 'LOCAL';
}

const ESTILO: Record<ClaveModalidad, { texto: string; bg: string; fg: string }> = {
  DELIVERY: { texto: 'DELIVERY', bg: '#E67929', fg: '#0B2C3E' },
  LLEVAR: { texto: 'PARA LLEVAR', bg: '#D99E39', fg: '#0B2C3E' },
  MESA: { texto: 'MESA', bg: '#0B2C3E', fg: '#FBF4EC' },
  LOCAL: { texto: 'EN EL LOCAL', bg: '#EDE1D1', fg: '#0B2C3E' },
  COMER_LOCAL: { texto: 'COMER EN EL LOCAL', bg: '#2F7A45', fg: '#FFFFFF' },
};

/** «MESA 4» aunque el nombre ya venga como «Mesa 4»; sin nombre, solo «MESA». */
export function textoMesa(nombre?: string | null): string {
  const n = String(nombre || '').trim();
  if (!n) return 'MESA';
  if (/^en espera/i.test(n)) return n.toUpperCase();
  return /^mesa/i.test(n) ? n.toUpperCase() : `MESA ${n.toUpperCase()}`;
}

const TRAZO = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Íconos SVG propios en trazo; decorativos (el texto siempre acompaña). */
export function IconoModalidad({ modalidad, tamano = 24 }: { modalidad: ClaveModalidad; tamano?: number }) {
  const trazos: Record<ClaveModalidad, ReactNode> = {
    // moto de reparto: dos ruedas, cuerpo, manubrio y caja trasera
    DELIVERY: (
      <>
        <circle cx="5.5" cy="17" r="3" />
        <circle cx="18.5" cy="17" r="3" />
        <path d="M8.5 17h5l2.5-6h-4M14 6h3l1.5 3.5M16 11l2.5 6" />
        <rect x="2" y="8" width="6" height="5" rx="1" />
      </>
    ),
    // bolsa
    LLEVAR: (
      <>
        <path d="M5 8h14l-1 12H6L5 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </>
    ),
    // mesa con patas
    MESA: (
      <>
        <path d="M4 7h16M6 7l-1 12M18 7l1 12M12 7v12" />
      </>
    ),
    // plato con cubiertos
    COMER_LOCAL: (
      <>
        <circle cx="12" cy="12" r="5" />
        <path d="M3 4v6M5.5 4v6M3 7h2.5M4.2 10v10M20 4c-2 1-2.5 4-2.5 7h2.5v9" />
      </>
    ),
    // tienda / mostrador
    LOCAL: (
      <>
        <path d="M4 10v10h16V10M3 10l2-6h14l2 6H3z" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
  };
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...TRAZO}>
      {trazos[modalidad]}
    </svg>
  );
}

export interface InsigniaModalidadProps {
  modalidad?: string | null;
  mesaNombre?: string | null;
  /** Ocupa todo el ancho (celular). */
  ancha?: boolean;
}

/** Insignia grande de modalidad: ícono + texto en mayúsculas, ≥44 px de alto. */
export function InsigniaModalidad({ modalidad, mesaNombre }: InsigniaModalidadProps) {
  const clave = claveModalidad(modalidad);
  const e = ESTILO[clave];
  const texto = clave === 'MESA' ? textoMesa(mesaNombre) : e.texto;
  return (
    <span className="cj-modalidad" data-modalidad={clave} style={{ background: e.bg, color: e.fg }}>
      <IconoModalidad modalidad={clave} />
      <span>{texto}</span>
    </span>
  );
}

const ICONO_CANAL: Record<string, ReactNode> = {
  WHATSAPP: <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20zM9 9c0 3 3 6 6 6l1-1.5-2-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-2L9 9z" />,
  WEB: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  MOZO: (
    <>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5 21c0-4 3-7 7-7s7 3 7 7" />
    </>
  ),
  CAJA: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M3 11h18M7 15h3" />
    </>
  ),
};

/** Canal normalizado a las claves del ícono (por defecto web). Los códigos CP-W son de WhatsApp. */
export function claveCanal(canal?: string | null, codigo?: string | null): string {
  const c = String(canal || '').toUpperCase();
  if (c === 'BOT' || c === 'WHATSAPP' || /^CP-W/i.test(codigo || '')) return 'WHATSAPP';
  if (c === 'MOZO') return 'MOZO';
  if (c === 'CAJA' || c === 'MOSTRADOR' || c === 'TELEFONO') return 'CAJA';
  return 'WEB';
}

export function IconoCanal({ clave, tamano = 14 }: { clave: string; tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...TRAZO}>
      {ICONO_CANAL[clave] ?? ICONO_CANAL.WEB}
    </svg>
  );
}
