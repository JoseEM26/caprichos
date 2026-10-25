import { useState, useEffect, useMemo, useRef } from 'react';
import { OfertaItem } from '../admin/ofertas/ofertasApi';
import { CategoriaCarta, EstadoLocalCarta } from './tipos';
import { useCarrito } from './CarritoContext';
import { calcularValorBeneficio } from './useBeneficiosCarta';
import { formatearTextoOferta, obtenerDiaSemanaLima } from './FranjaAvisoCarta';

export interface ModalAvisoEntradaProps {
  ofertas: OfertaItem[];
  categorias?: CategoriaCarta[];
  estadoLocal: EstadoLocalCarta | null;
  onVerPromocion: () => void;
  storageKey?: string;
}

export function yaVistoHoyStorage(storageKey: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    const fecha = window.localStorage.getItem(storageKey);
    const hoy = new Date().toISOString().slice(0, 10);
    return fecha === hoy;
  } catch {
    return false;
  }
}

export function marcarVistoHoyStorage(storageKey: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const hoy = new Date().toISOString().slice(0, 10);
      window.localStorage.setItem(storageKey, hoy);
    }
  } catch {}
}

export function ModalAvisoEntrada({
  ofertas,
  categorias = [],
  estadoLocal,
  onVerPromocion,
  storageKey = 'caprichos_aviso_entrada_fecha',
}: ModalAvisoEntradaProps) {
  const { checkoutAbierto } = useCarrito();
  const [abierto, setAbierto] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const btnAccionRef = useRef<HTMLButtonElement>(null);

  // Filtrar ofertas vigentes hoy y elegir la de mayor beneficio
  const mejorOferta = useMemo(() => {
    if (!Array.isArray(ofertas)) return null;
    const vigentes = ofertas
      .filter((o) => o.activo !== false && o.vigenteAhora === true)
      .sort((a, b) => calcularValorBeneficio(b) - calcularValorBeneficio(a));
    return vigentes[0] || null;
  }, [ofertas]);

  useEffect(() => {
    // 1. Debe estar activado por configuración (carta_aviso_entrada)
    if (!estadoLocal?.cartaAvisoEntrada) {
      setAbierto(false);
      return;
    }

    // 2. No debe mostrarse si la carta está cerrada o en pausa por alta demanda
    if (!estadoLocal.abierta || estadoLocal.pausaAltaDemanda) {
      setAbierto(false);
      return;
    }

    // 3. Jamás durante el checkout
    if (checkoutAbierto) {
      setAbierto(false);
      return;
    }

    // 4. Debe haber al menos una oferta vigente hoy
    if (!mejorOferta) {
      setAbierto(false);
      return;
    }

    // 5. Máximo una vez por día por dispositivo
    if (yaVistoHoyStorage(storageKey)) {
      setAbierto(false);
      return;
    }

    // Cumple todas las condiciones
    setAbierto(true);
  }, [estadoLocal, checkoutAbierto, mejorOferta, storageKey]);

  // Manejo de foco atrapado y Escape para cerrar
  useEffect(() => {
    if (!abierto) return;

    // Foco inicial
    setTimeout(() => {
      btnAccionRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrarModal();
        return;
      }

      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abierto]);

  const cerrarModal = () => {
    marcarVistoHoyStorage(storageKey);
    setAbierto(false);
  };

  const handleIrAPromocion = () => {
    marcarVistoHoyStorage(storageKey);
    setAbierto(false);
    onVerPromocion();
  };

  if (!abierto || !mejorOferta) {
    return null;
  }

  const diaHoy = obtenerDiaSemanaLima();
  const textoPromo = formatearTextoOferta(mejorOferta, categorias);

  return (
    <div
      data-testid="modal-aviso-entrada"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(11, 44, 62, 0.65)',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Fondo clickeable para cerrar */}
      <div
        onClick={cerrarModal}
        style={{
          position: 'absolute',
          inset: 0,
        }}
      />

      {/* Ventana modal corta */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-aviso-entrada"
        style={{
          position: 'relative',
          width: 'min(420px, 100%)',
          backgroundColor: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          border: '1.5px solid var(--cp-line)',
          padding: '24px 20px 20px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '12px',
          zIndex: 1,
        }}
      >
        {/* Botón cerrar X superior */}
        <button
          type="button"
          data-testid="btn-cerrar-modal-x"
          onClick={cerrarModal}
          aria-label="Cerrar ventana de promoción"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '36px',
            height: '36px',
            borderRadius: '18px',
            border: '1.5px solid var(--cp-navy)',
            backgroundColor: 'transparent',
            color: 'var(--cp-navy)',
            fontSize: '18px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>

        {/* Insignia dorada del día */}
        <span
          style={{
            backgroundColor: 'var(--cp-navy)',
            color: 'var(--cp-cream)',
            fontSize: '11px',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            letterSpacing: '0.06em',
            borderRadius: '9999px',
            padding: '3px 12px',
            textTransform: 'uppercase',
          }}
        >
          Hoy {diaHoy}
        </span>

        {/* Título de la promoción */}
        <h2
          id="titulo-aviso-entrada"
          style={{
            margin: 0,
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: '22px',
            lineHeight: '28px',
            color: 'var(--cp-navy)',
          }}
        >
          {textoPromo}
        </h2>

        {/* Descripción si la tiene */}
        {mejorOferta.descripcion && (
          <div
            style={{
              fontSize: '13px',
              lineHeight: '18px',
              color: 'var(--cp-soft)',
              fontFamily: 'Montserrat, sans-serif',
            }}
          >
            {mejorOferta.descripcion}
          </div>
        )}

        {/* Botones de acción */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            gap: '8px',
            marginTop: '8px',
          }}
        >
          <button
            ref={btnAccionRef}
            type="button"
            data-testid="btn-ver-promocion-modal"
            onClick={handleIrAPromocion}
            style={{
              width: '100%',
              minHeight: '46px',
              borderRadius: '12px',
              border: 0,
              backgroundColor: 'var(--cp-orange)',
              color: '#FFFFFF',
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            Ver promoción
          </button>

          <button
            type="button"
            onClick={cerrarModal}
            style={{
              width: '100%',
              minHeight: '40px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-navy)',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
