import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { prefiereMovimientoReducido, tieneSoporteWebGL } from '../../mascota/soporteWebGL';
import type { Motor, ModoHora, VistaCamara } from './escena3d/motor';
import { TEMAS } from './escena3d/temas';
import { PanelPendientes } from './PanelPendientes';
import { useSalonVivo } from './useSalonVivo';
import type { AccesoTv } from '../../tv/PuertaTv';
import './salon-vivo.css';

const Escena3D = lazy(() => import('./Escena3D'));

const CLAVE_TEMA = 'caprichos.salonVivo.tema';
const CLAVE_LIGERO = 'caprichos.salonVivo.ligero';
const leer = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: no pasa nada */ } };

const relojLima = () => new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(new Date());

const CAMARAS: Array<[VistaCamara, string]> = [['general', 'Todo el local'], ['cocina', 'Cocina'], ['salon', 'Salón'], ['capri', 'Seguir a Capri']];
const HORAS: Array<[ModoHora, string]> = [['auto', 'Hora real'], ['dia', 'Día'], ['tarde', 'Atardecer'], ['noche', 'Noche']];
const sinMeseros = () => undefined;

/** Está en pantalla completa (la TV ya la ven los clientes: no se muestran controles). */
function usePantallaCompletaActiva() {
  const [activa, setActiva] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));
  useEffect(() => {
    const f = () => setActiva(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  return activa;
}

/**
 * Salón en vivo: el local de Caprichos en 3D desde el plano real, animado con lo que pasa en el salón, y a la derecha
 * solo los pedidos pendientes. `tv`: la pantalla propia para la TV (/tv/salon-vivo), sin el panel del admin.
 * Los controles se ven antes de entrar a pantalla completa; en pantalla completa desaparecen.
 */
export function SalonVivoView({ tv = false, acceso }: { tv?: boolean; acceso?: AccesoTv }) {
  const { datos, error, cargando } = useSalonVivo(undefined, acceso);
  const [soporta3d] = useState(() => tieneSoporteWebGL());
  const [falla3d, setFalla3d] = useState<string | null>(null);
  const reducir = useMemo(() => prefiereMovimientoReducido(), []);
  const [ligero, setLigero] = useState(() => leer(CLAVE_LIGERO) === '1' || (typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 2));
  const [motor, setMotor] = useState<Motor | null>(null);
  const [pisoId, setPisoId] = useState<string>('');
  const [camara, setCamara] = useState<VistaCamara>('general');
  const [tema, setTema] = useState(() => leer(CLAVE_TEMA) ?? 'normal');
  const [hora, setHora] = useState<ModoHora>('auto');
  const [sonido, setSonido] = useState(false);
  const [voz, setVoz] = useState(false);
  const [reloj, setReloj] = useState(relojLima);
  const completa = usePantallaCompletaActiva();
  const con3d = soporta3d && !falla3d;

  useEffect(() => { const id = setInterval(() => setReloj(relojLima()), 10000); return () => clearInterval(id); }, []);

  const pisos = datos?.pisos ?? [];
  const piso = useMemo(() => pisos.find((p) => p.id === pisoId) ?? pisos.find((p) => p.elementos.some((e) => e.tipo === 'MESA' && e.activo)) ?? pisos[0], [pisos, pisoId]);

  useEffect(() => { if (motor) { if (tema !== 'normal') motor.tema(tema); motor.hora(hora); } }, [motor]);

  const cambiarTema = (k: string) => { setTema(k); guardar(CLAVE_TEMA, k); motor?.tema(k); };
  const cambiarHora = (h: ModoHora) => { setHora(h); motor?.hora(h); };
  const cambiarCamara = (v: VistaCamara) => { setCamara(v); motor?.camara(v); };
  const alternarSonido = () => { const on = !sonido; if (motor?.sonido(on)) setSonido(on); };
  const alternarVoz = () => { const on = !voz; motor?.voz(on); setVoz(on); };
  const alternarLigero = () => { const on = !ligero; setLigero(on); guardar(CLAVE_LIGERO, on ? '1' : '0'); };
  const entrarPantallaCompleta = () => { document.documentElement.requestFullscreen?.().catch(() => undefined); };
  const alError = useCallback((e: Error) => setFalla3d(e.message), []);

  if (cargando && !datos) return <div className="sv-estado" role="status">Cargando el salón…</div>;
  if (!datos) return <div className="sv-estado" role="alert">{error ?? 'No se pudo cargar el salón en vivo.'}</div>;

  return (
    <div className={`sv-raiz ${tv ? 'sv-tv' : ''} ${completa ? 'sv-completa' : ''}`}>
      <div className="sv-app">
        <section className="sv-escena" aria-label="Salón de Caprichos en 3D">
          {con3d && piso ? (
            <Suspense fallback={<div className="sv-sin3d" role="status">Preparando el salón en 3D…</div>}>
              <Escena3D piso={piso} datos={datos} reducir={reducir} ligero={ligero} onMotor={setMotor} alMeseros={sinMeseros} onError={alError} />
            </Suspense>
          ) : (
            <div className="sv-sin3d" role="status">
              <p><b>Este equipo no puede mostrar el salón en 3D.</b></p>
              <p>Los pedidos de la derecha siguen en vivo.</p>
            </div>
          )}
          <div className="sv-cabeza">
            <span className="sv-logo">Caprichos<b>.</b></span>
            <span className="sv-vivo"><i />En vivo</span>
            {error && <span className="sv-aviso" role="alert">Sin conexión, mostrando lo último</span>}
            {!completa && pisos.length > 1 && (
              <select aria-label="Piso" value={piso?.id ?? ''} onChange={(e) => setPisoId(e.target.value)}>
                {pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            )}
          </div>
          {!completa && (
            <div className="sv-barra-cam" role="toolbar" aria-label="Controles del salón">
              {con3d && CAMARAS.map(([k, t]) => <button key={k} type="button" className="sv-btn" aria-pressed={camara === k} onClick={() => cambiarCamara(k)}>{t}</button>)}
              {con3d && <span className="sv-sep" />}
              {con3d && <button type="button" className="sv-btn" onClick={() => motor?.saludar()}>Saludar</button>}
              {con3d && <button type="button" className="sv-btn" onClick={() => motor?.bailar()}>Bailar</button>}
              {con3d && <button type="button" className="sv-btn" aria-pressed={voz} onClick={alternarVoz}>Voz de Capri</button>}
              {con3d && <button type="button" className="sv-btn" aria-pressed={sonido} onClick={alternarSonido}>Sonido ambiente</button>}
              {con3d && <button type="button" className="sv-btn" aria-pressed={ligero} onClick={alternarLigero} title="Menos efectos para equipos lentos">Modo ligero</button>}
              {con3d && (
                <>
                  <label className="sv-sel">Temática
                    <select value={tema} onChange={(e) => cambiarTema(e.target.value)}>
                      {Object.entries(TEMAS).map(([k, t]) => <option key={k} value={k}>{t.nombre}</option>)}
                    </select>
                  </label>
                  <label className="sv-sel">Luz
                    <select value={hora} onChange={(e) => cambiarHora(e.target.value as ModoHora)}>
                      {HORAS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                    </select>
                  </label>
                </>
              )}
              <span className="sv-sep" />
              {tv ? (
                <button type="button" className="sv-btn sv-prim" onClick={entrarPantallaCompleta}>⛶ Pantalla completa</button>
              ) : (
                <a className="sv-btn sv-prim" href="/tv/salon-vivo" target="_blank" rel="noopener noreferrer">📺 Abrir en la TV</a>
              )}
            </div>
          )}
          {tv && !completa && <p className="sv-ayuda-tv">En pantalla completa los controles se esconden. Para salir, presiona Esc.</p>}
        </section>
        <PanelPendientes datos={datos} reloj={reloj} />
      </div>
    </div>
  );
}
