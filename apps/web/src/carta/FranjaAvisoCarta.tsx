import { useState, useEffect, useMemo, useRef } from 'react';
import { OfertaItem } from '../admin/ofertas/ofertasApi';
import { CategoriaCarta } from './tipos';
import { calcularValorBeneficio } from './useBeneficiosCarta';

export interface FranjaAvisoCartaProps {
  ofertas: OfertaItem[];
  categorias?: CategoriaCarta[];
  onVerPromociones: () => void;
  storageKey?: string;
  intervaloMs?: number;
}

const DIAS_SEMANA_LIMA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

export function obtenerDiaSemanaLima(fechaReferencia: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      weekday: 'long',
    });
    return formatter.format(fechaReferencia).toLowerCase();
  } catch {
    return DIAS_SEMANA_LIMA[fechaReferencia.getDay()] || 'hoy';
  }
}

export function formatearTextoOferta(
  oferta: OfertaItem,
  categorias?: CategoriaCarta[],
): string {
  let objetivo = oferta.nombre;
  if (oferta.productoNombre) {
    objetivo = oferta.productoNombre;
  } else if (oferta.categoriaNombre) {
    objetivo = oferta.categoriaNombre;
  } else if (oferta.alcanceCategoriaId && categorias) {
    const cat = categorias.find((c) => String(c.id) === String(oferta.alcanceCategoriaId));
    if (cat) objetivo = cat.nombre;
  }

  if (oferta.tipo === 'LLEVA_PAGA') {
    const lleva = oferta.lleva || 2;
    const paga = oferta.paga || 1;
    const promo = lleva === 2 && paga === 1 ? '2x1' : `Lleva ${lleva} paga ${paga}`;
    return `${promo} en ${objetivo}`;
  }

  if (oferta.tipo === 'DESCUENTO') {
    if (oferta.descuentoTipo === 'PORCENTAJE') {
      return `${oferta.descuentoValor || 0} % de descuento en ${objetivo}`;
    }
    return `S/ ${oferta.descuentoValor || 0} de descuento en ${objetivo}`;
  }

  return oferta.nombre;
}

export function FranjaAvisoCarta({
  ofertas,
  categorias = [],
  onVerPromociones,
  storageKey = 'caprichos_franja_aviso_cerrada',
  intervaloMs = 6000,
}: FranjaAvisoCartaProps) {
  const [cerrada, setCerrada] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(storageKey) === 'true';
      }
    } catch {}
    return false;
  });

  const [indice, setIndice] = useState(0);
  const [enPausa, setEnPausa] = useState(false);
  const [prefiereReducido, setPrefiereReducido] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtrar ofertas vigentes hoy
  const ofertasVigentes = useMemo(() => {
    if (!Array.isArray(ofertas)) return [];
    return ofertas
      .filter((o) => o.activo !== false && o.vigenteAhora === true)
      .sort((a, b) => calcularValorBeneficio(b) - calcularValorBeneficio(a));
  }, [ofertas]);

  // Detección de prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefiereReducido(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setPrefiereReducido(e.matches);
    mediaQuery.addEventListener?.('change', listener);
    return () => mediaQuery.removeEventListener?.('change', listener);
  }, []);

  // Rotación suave cada 6s si hay varias ofertas
  useEffect(() => {
    if (ofertasVigentes.length <= 1 || enPausa) return;

    const timer = setInterval(() => {
      setIndice((prev) => (prev + 1) % ofertasVigentes.length);
    }, intervaloMs);

    return () => clearInterval(timer);
  }, [ofertasVigentes.length, enPausa, intervaloMs]);

  // Si el índice supera el largo disponible por cambios de ofertas
  useEffect(() => {
    if (indice >= ofertasVigentes.length) {
      setIndice(0);
    }
  }, [ofertasVigentes.length, indice]);

  if (cerrada || ofertasVigentes.length === 0) {
    return null;
  }

  const ofertaActual = ofertasVigentes[indice] || ofertasVigentes[0];
  const diaHoy = obtenerDiaSemanaLima();
  const textoPromo = formatearTextoOferta(ofertaActual, categorias);

  const handleCerrar = () => {
    setCerrada(true);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(storageKey, 'true');
      }
    } catch {}
  };

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      data-testid="franja-aviso-carta"
      onMouseEnter={() => setEnPausa(true)}
      onMouseLeave={() => setEnPausa(false)}
      onFocus={() => setEnPausa(true)}
      onBlur={() => setEnPausa(false)}
      style={{
        backgroundColor: 'var(--cp-navy)',
        color: 'var(--cp-cream)',
        width: '100%',
        boxSizing: 'border-box',
        borderBottom: '1px solid var(--cp-orange)',
        fontSize: '13px',
        lineHeight: '18px',
        fontFamily: 'Montserrat, sans-serif',
        zIndex: 1, // por debajo de la cabecera fija (zIndex 20) al hacer scroll
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 44px 8px 16px',
        minHeight: '38px',
        textAlign: 'center',
      }}
    >
      <div
        key={ofertaActual.id}
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          transition: prefiereReducido ? 'none' : 'opacity 0.3s ease, transform 0.3s ease',
          opacity: 1,
        }}
      >
        <span style={{ fontWeight: 700 }}>
          Hoy {diaHoy}: {textoPromo}.
        </span>
        <button
          type="button"
          data-testid="btn-ver-promociones-franja"
          onClick={onVerPromociones}
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            color: 'var(--cp-orange)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '13px',
            textDecoration: 'underline',
            cursor: 'pointer',
            display: 'inline-block',
          }}
        >
          Ver promociones
        </button>
      </div>

      <button
        type="button"
        data-testid="btn-cerrar-franja"
        onClick={handleCerrar}
        aria-label="Cerrar aviso"
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '32px',
          height: '32px',
          borderRadius: '16px',
          border: 0,
          background: 'transparent',
          color: 'var(--cp-cream)',
          fontSize: '20px',
          fontWeight: 700,
          lineHeight: '1',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ×
      </button>
    </div>
  );
}
