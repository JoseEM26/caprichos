import type { ReactNode } from 'react';
import type { ClavePieza } from './flujo';

/** Íconos de trazo sencillos (24x24) para cada pieza y para las impresoras. Heredan el color del texto. */
function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      className="mapa-icono-svg"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconoPieza({ clave }: { clave: ClavePieza }) {
  if (clave === 'BEBIDA') {
    return (
      <Icono>
        <path d="M6 3h12l-1.6 17.2a1 1 0 0 1-1 .8H8.6a1 1 0 0 1-1-.8L6 3z" />
        <path d="M5.6 8h12.8" />
      </Icono>
    );
  }
  if (clave === 'COMANDA' || clave === 'COMANDA_AREA') {
    return (
      <Icono>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </Icono>
    );
  }
  if (clave === 'PAGO') {
    return (
      <Icono>
        <path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6z" />
        <path d="M15 7v10" strokeDasharray="2 2" />
      </Icono>
    );
  }
  // RESUMEN y AREA: etiquetas (stickers)
  return (
    <Icono>
      <path d="M3 12.6V4.5A1.5 1.5 0 0 1 4.5 3h8.1l8.4 8.4a1.5 1.5 0 0 1 0 2.1l-6.9 6.9a1.5 1.5 0 0 1-2.1 0L3 12.6z" />
      <circle cx="8" cy="8" r="1.5" />
    </Icono>
  );
}

export function IconoImpresora() {
  return (
    <Icono>
      <rect x="6" y="3" width="12" height="5" rx="1" />
      <rect x="3" y="8" width="18" height="9" rx="2" />
      <rect x="7" y="14" width="10" height="7" rx="1" />
    </Icono>
  );
}
