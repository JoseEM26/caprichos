import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODULOS } from '../modulos';
import type { NotificacionAdmin } from '../useNotificaciones';

/** Tiempo que el aviso grande se queda arriba antes de irse hacia la campanita */
export const DURACION_AVISO_MS = 8000;
const SALIDA_MS = 500;

export const COLOR_PRIORIDAD: Record<NotificacionAdmin['prioridad'], string> = {
  ALTA: 'var(--cp-rust)',
  MEDIA: 'var(--cp-orange)',
  BAJA: '#8FA9B8',
};
export const TEXTO_PRIORIDAD: Record<NotificacionAdmin['prioridad'], string> = {
  ALTA: 'Urgente',
  MEDIA: 'Pendiente',
  BAJA: 'Cuando puedas',
};

/** Ruta a la que lleva un aviso: la suya, o la del módulo donde se resuelve. */
export function rutaDeAviso(n: NotificacionAdmin): string {
  if (n.ruta) return n.ruta;
  if (n.modulo === 'compras') return '/admin/compras?tab=pedir';
  return MODULOS.find((m) => m.clave === n.modulo)?.ruta ?? '/admin/notificaciones';
}

/** true si el usuario pide menos movimiento en pantalla (las animaciones CSS también lo respetan) */
export function reducirMovimiento(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

const ESTILOS = `
@keyframes cpAvisoEntra { from { opacity: 0; transform: translateY(-14px) scale(0.97); } to { opacity: 1; transform: none; } }
.cp-aviso-entra { animation: cpAvisoEntra 320ms ease-out; }
@media (prefers-reduced-motion: reduce) { .cp-aviso-entra { animation: none; } }
`;

interface AvisoGrandeProps {
  aviso: NotificacionAdmin;
  /** Cuántos más esperan en la cola */
  pendientes: number;
  duracionMs?: number;
  onVer: (aviso: NotificacionAdmin) => void;
  onMarcarLeida: (aviso: NotificacionAdmin) => void;
  /** Se llama cuando el aviso ya terminó de irse */
  onCerrar: () => void;
}

/** Aviso grande arriba al centro: se cierra solo a los pocos segundos y se va hacia la campanita. */
export function AvisoGrande({ aviso, pendientes, duracionMs = DURACION_AVISO_MS, onVer, onMarcarLeida, onCerrar }: AvisoGrandeProps) {
  const [saliendo, setSaliendo] = useState(false);
  const [vuelo, setVuelo] = useState({ x: 0, y: 0 });
  const tarjeta = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  const reducir = reducirMovimiento();

  useEffect(() => {
    const t = setTimeout(() => setSaliendo(true), duracionMs);
    return () => clearTimeout(t);
  }, [aviso.clave, duracionMs]);

  useEffect(() => {
    if (!saliendo) return;
    // hacia la campanita: se mide dónde está en el momento de irse
    const campana = document.querySelector<HTMLElement>('[data-campana-notificaciones]');
    const caja = tarjeta.current?.getBoundingClientRect();
    if (campana && caja && !reducir) {
      const destino = campana.getBoundingClientRect();
      setVuelo({
        x: destino.left + destino.width / 2 - (caja.left + caja.width / 2),
        y: destino.top + destino.height / 2 - (caja.top + caja.height / 2),
      });
    }
    const t = setTimeout(() => cerrarRef.current(), reducir ? 0 : SALIDA_MS);
    return () => clearTimeout(t);
  }, [saliendo, reducir]);

  const color = COLOR_PRIORIDAD[aviso.prioridad];
  return (
    <div
      style={{
        position: 'fixed',
        top: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(620px, calc(100vw - 32px))',
        zIndex: 60,
        pointerEvents: saliendo ? 'none' : 'auto',
      }}
    >
      <style>{ESTILOS}</style>
      <div
        ref={tarjeta}
        role="status"
        aria-live="assertive"
        className={reducir ? undefined : 'cp-aviso-entra'}
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderLeft: `10px solid ${color}`,
          borderRadius: 16,
          boxShadow: '0 18px 44px rgba(11,44,62,0.32)',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          color: 'var(--cp-navy)',
          opacity: saliendo ? 0 : 1,
          transform: saliendo && !reducir ? `translate(${vuelo.x}px, ${vuelo.y}px) scale(0.12)` : 'none',
          transition: reducir ? 'none' : `transform ${SALIDA_MS}ms ease-in, opacity ${SALIDA_MS}ms ease-in`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {TEXTO_PRIORIDAD[aviso.prioridad]}
          </span>
          {pendientes > 0 && <span style={{ fontSize: 13, color: 'var(--cp-soft)', fontWeight: 700 }}>+{pendientes} más en cola</span>}
        </div>
        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 22, lineHeight: '28px', overflowWrap: 'anywhere' }}>
          {aviso.titulo}
        </div>
        {aviso.detalle && <div style={{ fontSize: 15, lineHeight: '21px', color: 'var(--cp-soft)' }}>{aviso.detalle}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          <button
            type="button"
            onClick={() => onVer(aviso)}
            style={{ minHeight: 48, padding: '0 18px', border: 0, borderRadius: 10, background: 'var(--cp-navy)', color: 'var(--cp-cream)', fontWeight: 800, fontSize: 15 }}
          >
            Ver
          </button>
          <button
            type="button"
            onClick={() => onMarcarLeida(aviso)}
            style={{ minHeight: 48, padding: '0 18px', border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 15 }}
          >
            Marcar leída
          </button>
          <button
            type="button"
            onClick={() => setSaliendo(true)}
            aria-label="Cerrar aviso"
            style={{ minHeight: 48, padding: '0 14px', border: 0, borderRadius: 10, background: 'transparent', color: 'var(--cp-soft)', fontWeight: 700, fontSize: 14 }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

interface AvisosEmergentesProps {
  notificaciones: NotificacionAdmin[];
  /** true cuando ya llegó la primera carga: lo que había antes no salta en pantalla */
  listo: boolean;
  onMarcar: (clave: string, leida: boolean) => Promise<boolean>;
}

/**
 * Muestra en grande cada aviso no leído que esta sesión todavía no había mostrado.
 * Si llegan varios, van en cola: uno a la vez, ninguno se pierde (siguen en la campanita).
 */
export function AvisosEmergentes({ notificaciones, listo, onMarcar }: AvisosEmergentesProps) {
  const navigate = useNavigate();
  // null hasta la primera carga: en ese momento se registra lo que ya había como visto
  const vistas = useRef<Set<string> | null>(null);
  const [cola, setCola] = useState<string[]>([]);

  useEffect(() => {
    if (!listo) return;
    const noLeidas = notificaciones.filter((n) => !n.leida);
    if (vistas.current === null) {
      vistas.current = new Set(noLeidas.map((n) => n.clave));
      return;
    }
    const nuevas = noLeidas.filter((n) => !vistas.current?.has(n.clave));
    if (nuevas.length === 0) return;
    nuevas.forEach((n) => vistas.current?.add(n.clave));
    setCola((c) => [...c, ...nuevas.map((n) => n.clave).filter((k) => !c.includes(k))]);
  }, [notificaciones, listo]);

  const visibles = cola
    .map((k) => notificaciones.find((n) => n.clave === k))
    .filter((n): n is NotificacionAdmin => !!n && !n.leida);
  const actual = visibles[0];
  if (!actual) return null;

  const quitar = (clave: string) => setCola((c) => c.filter((k) => k !== clave));

  return (
    <AvisoGrande
      key={actual.clave}
      aviso={actual}
      pendientes={visibles.length - 1}
      onVer={(n) => {
        quitar(n.clave);
        navigate(rutaDeAviso(n));
      }}
      onMarcarLeida={(n) => {
        quitar(n.clave);
        void onMarcar(n.clave, true);
      }}
      onCerrar={() => quitar(actual.clave)}
    />
  );
}

/** Pone el número de no leídas delante del título de la pestaña: «(3) Panel…». */
export function useTituloContador(total: number): void {
  useEffect(() => {
    const limpio = document.title.replace(/^\(\d+\)\s/, '');
    document.title = total > 0 ? `(${total}) ${limpio}` : limpio;
  }, [total]);
}
