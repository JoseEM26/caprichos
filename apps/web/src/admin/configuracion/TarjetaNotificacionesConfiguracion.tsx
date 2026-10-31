import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Boton } from '../../comun/Boton';
import { useNotificaciones } from '../useNotificaciones';
import {
  AJUSTES_NOTIFICACIONES_DEFECTO,
  type AjustesNotificaciones,
  type AlcanceSonido,
} from '../notificaciones/notificacionesTipos';

function useSesionSegura() {
  try {
    return useSesion();
  } catch {
    return null;
  }
}

const INTERVALO_MIN = 5;
const INTERVALO_MAX = 600;
const SUGERIDOS = [15, 30, 60];

const ALCANCES: { valor: AlcanceSonido; nombre: string; descripcion: string }[] = [
  {
    valor: 'TODOS_NO_LEIDOS',
    nombre: 'Todo lo no leído',
    descripcion: 'Suena por cualquier aviso sin leer, salvo los de prioridad baja.',
  },
  {
    valor: 'SOLO_URGENTES',
    nombre: 'Solo urgentes',
    descripcion: 'Suena solo por los avisos de prioridad alta (pedidos nuevos, reservas, alertas).',
  },
  {
    valor: 'SOLO_HOY',
    nombre: 'Solo los de hoy',
    descripcion: 'Suena por lo no leído creado hoy (hora de Lima), salvo los de prioridad baja.',
  },
];

const campo = { display: 'flex', flexDirection: 'column' as const, gap: 6, minWidth: 0 };
const etiqueta = { fontSize: 13, fontWeight: 700, color: 'var(--cp-navy)' };
const control = {
  minHeight: 44,
  padding: '0 12px',
  border: '1px solid var(--cp-line)',
  borderRadius: 10,
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  fontSize: 14,
  fontFamily: 'inherit',
};

/**
 * Configuración › Notificaciones: sonido de los avisos, cada cuánto suena, a qué avisos y si se puede
 * «Marcar todas leídas». Solo el ADMIN cambia; los demás ven los valores. Se guarda en la tabla parametro (auditado).
 */
export function TarjetaNotificacionesConfiguracion({ esAdmin: esAdminProp }: { esAdmin?: boolean } = {}) {
  const sesion = useSesionSegura();
  const esAdmin = esAdminProp !== undefined ? esAdminProp : (sesion?.usuario?.rol || '').toUpperCase() === 'ADMIN';
  const resumen = useNotificaciones();
  const llegado: AjustesNotificaciones = { ...AJUSTES_NOTIFICACIONES_DEFECTO, ...(resumen.ajustes ?? {}) };
  const firma = JSON.stringify(llegado);

  const [sonidoActivo, setSonidoActivo] = useState(llegado.sonidoActivo);
  const [intervalo, setIntervalo] = useState(String(llegado.sonidoIntervaloSeg));
  const [alcance, setAlcance] = useState<AlcanceSonido>(llegado.sonidoAlcance);
  const [marcarTodas, setMarcarTodas] = useState(llegado.marcarTodasActivo);
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Cuando llega un valor nuevo del servidor (tras guardar o con el resumen), el formulario lo toma
  useEffect(() => {
    const v: AjustesNotificaciones = JSON.parse(firma);
    setSonidoActivo(v.sonidoActivo);
    setIntervalo(String(v.sonidoIntervaloSeg));
    setAlcance(v.sonidoAlcance);
    setMarcarTodas(v.marcarTodasActivo);
  }, [firma]);

  const numero = Number(intervalo);
  const intervaloValido = Number.isInteger(numero) && numero >= INTERVALO_MIN && numero <= INTERVALO_MAX;
  const cambios: Record<string, boolean | number | string> = {};
  if (sonidoActivo !== llegado.sonidoActivo) cambios.notif_sonido_activo = sonidoActivo;
  if (intervaloValido && numero !== llegado.sonidoIntervaloSeg) cambios.notif_sonido_intervalo_seg = numero;
  if (alcance !== llegado.sonidoAlcance) cambios.notif_sonido_alcance = alcance;
  if (marcarTodas !== llegado.marcarTodasActivo) cambios.notif_marcar_todas_activo = marcarTodas;
  const hayCambios = Object.keys(cambios).length > 0;

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      for (const [clave, valor] of Object.entries(cambios)) {
        await api.put(`/admin/configuracion/${clave}`, { valor });
      }
      setConfirmar(false);
      setExito('Notificaciones guardadas. Se aplican de inmediato en todas las pantallas.');
      await resumen.refrescar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudieron guardar las notificaciones');
      setConfirmar(false);
    } finally {
      setGuardando(false);
    }
  };

  const descripcionAlcance = ALCANCES.find((a) => a.valor === alcance)?.descripcion ?? '';

  return (
    <section
      data-testid="tarjeta-notificaciones"
      aria-labelledby="notif-conf-titulo"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '18px 20px',
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: 16,
        marginBottom: 8,
      }}
    >
      <div>
        <div id="notif-conf-titulo" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)' }}>
          Notificaciones
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--cp-soft)', marginTop: 2, maxWidth: 620 }}>
          Sonido de los avisos para todo el equipo y si se pueden marcar todos como leídos de una vez.
          {!esAdmin && ' Solo el administrador cambia estos ajustes.'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div style={campo}>
          <label htmlFor="notif-sonido-activo" style={etiqueta}>Sonido de los avisos</label>
          <select
            id="notif-sonido-activo"
            style={control}
            disabled={!esAdmin}
            value={sonidoActivo ? 'si' : 'no'}
            onChange={(e) => setSonidoActivo(e.target.value === 'si')}
          >
            <option value="si">Sí, suena</option>
            <option value="no">No, en silencio</option>
          </select>
        </div>

        <div style={campo}>
          <label htmlFor="notif-intervalo" style={etiqueta}>Cada cuántos segundos suena</label>
          <input
            id="notif-intervalo"
            type="number"
            inputMode="numeric"
            min={INTERVALO_MIN}
            max={INTERVALO_MAX}
            step={1}
            style={control}
            disabled={!esAdmin}
            value={intervalo}
            onChange={(e) => setIntervalo(e.target.value)}
            aria-invalid={!intervaloValido}
            aria-describedby="notif-intervalo-ayuda"
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SUGERIDOS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!esAdmin}
                onClick={() => setIntervalo(String(s))}
                aria-pressed={numero === s}
                style={{
                  minHeight: 44,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid var(--cp-navy)',
                  background: numero === s ? 'var(--cp-navy)' : 'transparent',
                  color: numero === s ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontFamily: 'inherit',
                }}
              >
                {s} s
              </button>
            ))}
          </div>
          <div id="notif-intervalo-ayuda" style={{ fontSize: 12, color: intervaloValido ? 'var(--cp-soft)' : 'var(--cp-red, #b3261e)' }}>
            {intervaloValido
              ? `Entre ${INTERVALO_MIN} y ${INTERVALO_MAX} segundos.`
              : `El intervalo debe ser un número entero entre ${INTERVALO_MIN} y ${INTERVALO_MAX} segundos.`}
          </div>
        </div>

        <div style={campo}>
          <label htmlFor="notif-alcance" style={etiqueta}>Qué avisos hacen sonar</label>
          <select
            id="notif-alcance"
            style={control}
            disabled={!esAdmin}
            value={alcance}
            onChange={(e) => setAlcance(e.target.value as AlcanceSonido)}
            aria-describedby="notif-alcance-ayuda"
          >
            {ALCANCES.map((a) => (
              <option key={a.valor} value={a.valor}>
                {a.nombre}
              </option>
            ))}
          </select>
          <div id="notif-alcance-ayuda" style={{ fontSize: 12, color: 'var(--cp-soft)' }}>{descripcionAlcance}</div>
        </div>

        <div style={campo}>
          <label htmlFor="notif-marcar-todas" style={etiqueta}>Botón «Marcar todas leídas»</label>
          <select
            id="notif-marcar-todas"
            style={control}
            disabled={!esAdmin}
            value={marcarTodas ? 'si' : 'no'}
            onChange={(e) => setMarcarTodas(e.target.value === 'si')}
            aria-describedby="notif-marcar-ayuda"
          >
            <option value="si">Sí, mostrar el botón</option>
            <option value="no">No, marcar cada aviso aparte</option>
          </select>
          <div id="notif-marcar-ayuda" style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
            Apagado, el botón desaparece de la campanita y de Notificaciones.
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>
          {error}
        </div>
      )}
      {exito && (
        <div role="status" style={{ fontSize: 13, color: 'var(--cp-navy)' }}>
          {exito}
        </div>
      )}

      {esAdmin && (
        <div>
          <Boton variante="primario" disabled={!hayCambios || !intervaloValido} onClick={() => setConfirmar(true)}>
            Guardar notificaciones
          </Boton>
        </div>
      )}

      <Confirmar
        abierto={confirmar}
        titulo="Guardar los cambios de notificaciones"
        mensaje="Cambia el sonido y los avisos para todo el equipo, desde ahora. ¿Guardar?"
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={guardar}
        alCancelar={() => setConfirmar(false)}
      />
    </section>
  );
}
