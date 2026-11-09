import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icono } from '../../comun/Icono';
import type { NotificacionAdmin } from '../useNotificaciones';
import { CentinelaMas } from './CentinelaMas';
import { COLOR_PRIORIDAD, TEXTO_PRIORIDAD, rutaDeAviso } from './AvisosNotificaciones';
import './parpadeo-reservas.css';

interface CampanaNotificacionesProps {
  notificaciones: NotificacionAdmin[];
  sonidoSoportado: boolean;
  sonidoBloqueado: boolean;
  onMarcar: (clave: string, leida: boolean) => Promise<boolean>;
  onMarcarTodas: () => Promise<void>;
  /** Decisión del ADMIN: si está apagado, no aparece «Marcar todas leídas» (cada aviso se marca aparte) */
  marcarTodasActivo?: boolean;
  onActivarSonido: () => void;
}

const POR_TANDA = 10;

const esperaTexto = (desde: string | null): string => {
  if (!desde) return '';
  const min = Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 60000));
  if (min < 60) return `espera ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `espera ${h} h ${min % 60} min` : `espera ${Math.floor(h / 24)} d`;
};

/**
 * Campanita del panel: insignia con las no leídas, lista con lo urgente arriba y lo leído al final
 * (atenuado), con botón Leída / No leída por fila y Marcar todas leídas.
 */
export function CampanaNotificaciones({
  notificaciones,
  sonidoSoportado,
  sonidoBloqueado,
  onMarcar,
  onMarcarTodas,
  marcarTodasActivo = true,
  onActivarSonido,
}: CampanaNotificacionesProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [abierta, setAbierta] = useState(false);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  // La lista se pinta de 10 en 10 al bajar: con cientos de avisos no se dibujan todos de golpe
  const [mostrando, setMostrando] = useState(POR_TANDA);

  useEffect(() => {
    setAbierta(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!abierta) setMostrando(POR_TANDA);
  }, [abierta]);

  const noLeidas = notificaciones.filter((n) => !n.leida);
  const total = noLeidas.length;
  const mayorPrioridad = noLeidas.find((n) => n.prioridad === 'ALTA')
    ? 'ALTA'
    : noLeidas.find((n) => n.prioridad === 'MEDIA')
      ? 'MEDIA'
      : 'BAJA';

  const irA = (n: NotificacionAdmin) => {
    navigate(rutaDeAviso(n));
    setAbierta(false);
  };

  const marcarTodas = async () => {
    setMarcandoTodas(true);
    try {
      await onMarcarTodas();
    } finally {
      setMarcandoTodas(false);
    }
  };

  return (
    <>
      <button
        type="button"
        data-campana-notificaciones
        onClick={() => setAbierta((v) => !v)}
        aria-label={`Notificaciones: ${total} sin leer`}
        aria-expanded={abierta}
        style={{ position: 'relative', flex: 'none', width: 44, height: 44, padding: 0, border: '1.5px solid var(--cp-navy)', borderRadius: 22, background: 'var(--cp-white)', color: 'var(--cp-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icono nombre="notificaciones" tamano={22} />
        <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {total === 0 ? 'Sin notificaciones pendientes' : `${total} sin leer`}
        </span>
        {total > 0 && (
          <span aria-hidden="true" style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, boxSizing: 'border-box', borderRadius: 10, background: COLOR_PRIORIDAD[mayorPrioridad], color: 'var(--cp-white)', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {total}
          </span>
        )}
      </button>

      {abierta && (
        <>
          <div onClick={() => setAbierta(false)} style={{ position: 'fixed', inset: 0, zIndex: 36 }} />
          <div
            role="dialog"
            aria-label="Notificaciones"
            style={{ position: 'absolute', zIndex: 37, top: 'calc(100% + 6px)', right: 12, width: 'min(420px, calc(100% - 24px))', maxHeight: 'min(70vh, 560px)', overflowY: 'auto', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 16, boxShadow: '0 16px 40px rgba(11,44,62,0.28)', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--cp-sand)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 16 }}>Notificaciones</span>
              <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Lo más urgente primero. Lo que marcas como leído baja al final.</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {total > 0 && marcarTodasActivo && (
                  <button
                    type="button"
                    onClick={() => void marcarTodas()}
                    disabled={marcandoTodas}
                    style={{ minHeight: 44, padding: '0 14px', border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 13 }}
                  >
                    Marcar todas leídas
                  </button>
                )}
                {sonidoSoportado && sonidoBloqueado && (
                  <button
                    type="button"
                    onClick={onActivarSonido}
                    style={{ minHeight: 44, padding: '0 14px', border: 0, borderRadius: 10, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 13 }}
                  >
                    Activar sonido
                  </button>
                )}
              </div>
            </div>

            {total === 0 && <div style={{ padding: '18px 16px', textAlign: 'center', fontSize: 14, color: 'var(--cp-soft)' }}>Todo al día. No hay nada pendiente.</div>}

            {notificaciones.slice(0, mostrando).map((n) => (
              <div
                key={n.clave}
                className={n.id === 'reservas' && !n.leida ? 'cp-parpadea-fila' : undefined}
                style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--cp-sand)', opacity: n.leida ? 0.6 : 1 }}
              >
                <span style={{ flex: 'none', width: 6, borderRadius: 3, background: n.leida ? 'var(--cp-line)' : COLOR_PRIORIDAD[n.prioridad] }} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, lineHeight: '19px', overflowWrap: 'anywhere' }}>{n.titulo}</span>
                    {n.leida ? (
                      <span style={{ flex: 'none', fontSize: 12, fontWeight: 800, color: 'var(--cp-soft)', border: '1px solid var(--cp-line)', borderRadius: 9999, padding: '1px 8px', whiteSpace: 'nowrap' }}>Leída</span>
                    ) : (
                      <span style={{ flex: 'none', fontSize: 12, fontWeight: 800, color: 'var(--cp-white)', background: COLOR_PRIORIDAD[n.prioridad], borderRadius: 9999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                        {TEXTO_PRIORIDAD[n.prioridad]}
                      </span>
                    )}
                  </div>
                  {n.detalle && <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft)' }}>{n.detalle}</div>}
                  {!n.leida && n.desde && <div style={{ fontSize: 12, color: 'var(--cp-soft)', fontVariantNumeric: 'tabular-nums' }}>{esperaTexto(n.desde)}</div>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => irA(n)}
                      style={{ minHeight: 44, padding: '0 14px', border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 13 }}
                    >
                      {n.accion}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onMarcar(n.clave, !n.leida)}
                      style={{ minHeight: 44, padding: '0 14px', border: '1.5px solid var(--cp-soft)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-soft)', fontWeight: 700, fontSize: 13 }}
                    >
                      {n.leida ? 'No leída' : 'Leída'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {notificaciones.length > POR_TANDA && (
              <CentinelaMas
                hayMas={mostrando < notificaciones.length}
                cargando={false}
                onCargar={() => setMostrando((m) => m + POR_TANDA)}
              />
            )}

            <button
              type="button"
              onClick={() => {
                setAbierta(false);
                navigate('/admin/notificaciones');
              }}
              style={{ minHeight: 48, border: 0, background: 'var(--cp-cream)', color: 'var(--cp-navy)', fontWeight: 700, borderRadius: '0 0 16px 16px' }}
            >
              Ver todas las notificaciones
            </button>
          </div>
        </>
      )}
    </>
  );
}
