import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useEventos } from '../../comun/socket';
import { estaSilenciado } from './audioAlerta';
import {
  VOLUMENES,
  activarAudioCocina,
  crearDedupe,
  debeAvisar,
  estadoAudioCocina,
  guardarVolumen,
  leerVolumen,
  tocarTimbreCocina,
  type IngresoCocina,
  type Volumen,
} from './sonidoCocina';

export const SEGUNDOS_AVISO = 8;
const MIN_ENTRE_TIMBRES_MS = 1500;

export interface AvisoIngreso extends IngresoCocina {
  clave: string;
  hora: string;
}

const TEXTO_TIPO: Record<IngresoCocina['tipo'], string> = {
  NUEVO: '🔔 NUEVO PEDIDO',
  EXTRA: '➕ PEDIDO EXTRA',
  DEVUELTO: '↩ DEVUELTO AL ÁREA',
};

/**
 * Escucha `cocina:ingreso` (el servidor lo emite solo cuando un pedido entra de verdad a un área: nuevo, extra
 * o devuelto). Filtra por el área de la pantalla, quita duplicados (10 s), apila los avisos y hace sonar el timbre.
 * `activo=false` (otras vistas, como Despacho o Historial) ni suena ni avisa.
 */
export function useIngresoCocina(areaSeleccionada: string, activo = true) {
  const [avisos, setAvisos] = useState<AvisoIngreso[]>([]);
  const dedupe = useRef(crearDedupe()).current;
  const ultimoTimbre = useRef(0);
  const [bloqueado, setBloqueado] = useState<boolean>(() => estadoAudioCocina() === 'bloqueado');

  // El navegador exige un toque para dejar sonar: el primero, en cualquier parte de la pantalla, lo activa.
  useEffect(() => {
    if (estadoAudioCocina() !== 'bloqueado') return;
    const quitar = () => {
      document.removeEventListener('pointerdown', alToque, true);
      document.removeEventListener('keydown', alToque, true);
    };
    const alToque = () => {
      void activarAudioCocina().then((ok) => {
        if (ok) {
          setBloqueado(false);
          quitar();
        }
      });
    };
    document.addEventListener('pointerdown', alToque, true);
    document.addEventListener('keydown', alToque, true);
    return quitar;
  }, []);

  const activar = useCallback(async () => {
    setBloqueado(!(await activarAudioCocina()));
  }, []);

  const alIngreso = (ev: IngresoCocina) => {
    if (!activo || !ev || ev.areaId == null || !debeAvisar(ev, areaSeleccionada)) return;
    const clave = `${ev.pedidoId}:${ev.areaId}:${ev.tipo}`;
    if (!dedupe(clave)) return;
    const ahora = Date.now();
    setAvisos((prev) => [
      ...prev,
      { ...ev, clave, hora: new Date(ahora).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) },
    ]);
    // Un pedido con varias áreas llega en ráfaga: suena una vez (el aviso visual sí lista cada área)
    if (!estaSilenciado() && ahora - ultimoTimbre.current > MIN_ENTRE_TIMBRES_MS) {
      ultimoTimbre.current = ahora;
      void tocarTimbreCocina(ev.tipo).then((ok) => setBloqueado(!ok && estadoAudioCocina() === 'bloqueado'));
    }
  };
  useEventos<IngresoCocina>('cocina:ingreso', alIngreso);

  const descartar = useCallback((clave: string) => setAvisos((p) => p.filter((a) => a.clave !== clave)), []);

  return { avisos, descartar, bloqueado, activar };
}

/** Banner fijo arriba: muestra el aviso más antiguo sin ver y «+N nuevos» con el resto. Se cierra al tocarlo o a los 8 s. */
export function BannerIngresoCocina({ avisos, onDescartar }: { avisos: AvisoIngreso[]; onDescartar: (clave: string) => void }) {
  const actual = avisos[0];
  const clave = actual?.clave;
  useEffect(() => {
    if (!clave) return;
    const t = setTimeout(() => onDescartar(clave), SEGUNDOS_AVISO * 1000);
    return () => clearTimeout(t);
  }, [clave, onDescartar]);

  if (!actual) return null;
  return (
    <div role="alert" aria-live="assertive" aria-atomic="true" data-testid="banner-ingreso-cocina">
      {actual && (
        <button
          type="button"
          onClick={() => onDescartar(actual.clave)}
          aria-label={`${TEXTO_TIPO[actual.tipo]} ${actual.codigo} ${actual.areaNombre}. Tocar para cerrar`}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            width: '100%',
            minHeight: '56px',
            padding: '8px 14px',
            border: '2px solid #fff',
            borderRadius: '12px',
            background: actual.tipo === 'NUEVO' ? '#B45309' : '#1D4ED8',
            color: '#fff',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            font: 'inherit',
            fontWeight: 800,
            fontSize: '16px',
            boxShadow: '0 4px 14px rgba(0,0,0,.35)',
            marginBottom: '8px',
          }}
        >
          <span>
            {TEXTO_TIPO[actual.tipo]} {actual.codigo} · {actual.areaNombre.toUpperCase()}
          </span>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            {actual.cliente ? `${actual.cliente} · ` : ''}
            {actual.hora}
          </span>
          {avisos.length > 1 && (
            <span style={{ marginLeft: 'auto', background: '#fff', color: '#7C2D12', borderRadius: '999px', padding: '2px 10px' }}>
              +{avisos.length - 1} nuevos
            </span>
          )}
        </button>
      )}
    </div>
  );
}

/** Marco que resalta (parpadeo suave + borde grueso) la tarjeta de un pedido recién llegado. */
export function MarcoNuevo({ activo, children }: { activo: boolean; children: ReactNode }) {
  if (!activo) return <>{children}</>;
  return (
    <div
      data-testid="tarjeta-nueva"
      className="cocina-tarjeta-nueva"
      style={{ outline: '4px solid #B45309', outlineOffset: '2px', borderRadius: '14px' }}
    >
      <style>{`@keyframes cocinaParpadeo{0%,100%{outline-color:#B45309}50%{outline-color:#FDE68A}}
.cocina-tarjeta-nueva{animation:cocinaParpadeo 1s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.cocina-tarjeta-nueva{animation:none}}`}</style>
      {children}
    </div>
  );
}

/** «Volumen ▾ · Probar» + aviso «Activar sonido» si el navegador lo tiene bloqueado. El silencio es el switch «Sonido» de al lado. */
export function ControlSonidoCocina({ bloqueado, onActivar }: { bloqueado: boolean; onActivar: () => void }) {
  const [volumen, setVolumen] = useState<Volumen>(() => leerVolumen());
  const base = { minHeight: '44px', borderRadius: '12px', border: '1.5px solid var(--cp-navy)', fontWeight: 800, fontSize: '13px', color: 'var(--cp-navy)' } as const;
  return (
    <>
      <label style={{ ...base, display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 10px', background: 'transparent' }}>
        <span>🔔 Volumen</span>
        <select
          aria-label="Volumen del timbre de cocina"
          value={volumen}
          onChange={(e) => {
            const v = e.target.value as Volumen;
            setVolumen(v);
            guardarVolumen(v);
          }}
          style={{ minHeight: '36px', font: 'inherit', background: 'transparent', color: 'inherit', border: 0 }}
        >
          {VOLUMENES.map((v) => (
            <option key={v.valor} value={v.valor}>
              {v.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        aria-label="Probar timbre de cocina"
        onClick={() => void tocarTimbreCocina('NUEVO', volumen)}
        style={{ ...base, padding: '0 14px', background: 'transparent', cursor: 'pointer' }}
      >
        Probar
      </button>
      {bloqueado && (
        <button
          type="button"
          onClick={onActivar}
          style={{ ...base, padding: '0 14px', background: '#FEF3C7', borderColor: '#B45309', color: '#7C2D12', cursor: 'pointer' }}
        >
          🔇 Activar sonido (toca aquí)
        </button>
      )}
    </>
  );
}
