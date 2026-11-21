import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { prefiereMovimientoReducido, tieneSoporteWebGL } from '../../mascota/soporteWebGL';
import type { ResumenMesero } from './escena3d/director';
import type { Motor, ModoHora, VistaCamara } from './escena3d/motor';
import { PanelVivo, type PestanaPanel } from './PanelVivo';
import { useSalonVivo } from './useSalonVivo';
import './salon-vivo.css';

const Escena3D = lazy(() => import('./Escena3D'));

const CLAVE_TEMA = 'caprichos.salonVivo.tema';
const CLAVE_LIGERO = 'caprichos.salonVivo.ligero';
const leer = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: no pasa nada */ } };

const relojLima = () => new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(new Date());

const CAMARAS: Array<[VistaCamara, string]> = [['general', 'Todo el local'], ['cocina', 'Cocina'], ['salon', 'Salón'], ['capri', 'Seguir a Capri']];

/** Salón en vivo: el local de Caprichos en 3D, dibujado desde el plano real y animado con lo que pasa en el salón. Solo lectura. */
export function SalonVivoView() {
  const { datos, error, cargando, bitacora } = useSalonVivo();
  const [soporta3d] = useState(() => tieneSoporteWebGL());
  const [falla3d, setFalla3d] = useState<string | null>(null);
  const reducir = useMemo(() => prefiereMovimientoReducido(), []);
  const [ligero, setLigero] = useState(() => leer(CLAVE_LIGERO) === '1' || (typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 2));
  const [motor, setMotor] = useState<Motor | null>(null);
  const [meseros, setMeseros] = useState<ResumenMesero[]>([]);
  const [pisoId, setPisoId] = useState<string>('');
  const [interna, setInterna] = useState(true);
  const [pestana, setPestana] = useState<PestanaPanel>('pedidos');
  const [camara, setCamara] = useState<VistaCamara>('general');
  const [tema, setTema] = useState(() => leer(CLAVE_TEMA) ?? 'normal');
  const [hora, setHora] = useState<ModoHora>('auto');
  const [horaTxt, setHoraTxt] = useState('Automática');
  const [sonido, setSonido] = useState(false);
  const [voz, setVoz] = useState(false);
  const [reloj, setReloj] = useState(relojLima);
  const con3d = soporta3d && !falla3d;

  useEffect(() => { const id = setInterval(() => setReloj(relojLima()), 10000); return () => clearInterval(id); }, []);

  const pisos = datos?.pisos ?? [];
  const piso = useMemo(() => pisos.find((p) => p.id === pisoId) ?? pisos.find((p) => p.elementos.some((e) => e.tipo === 'MESA' && e.activo)) ?? pisos[0], [pisos, pisoId]);

  useEffect(() => { if (motor) { if (tema !== 'normal') motor.tema(tema); setHoraTxt(motor.hora(hora)); } }, [motor]);

  const cambiarTema = (k: string) => { setTema(k); guardar(CLAVE_TEMA, k); motor?.tema(k); };
  const cambiarHora = (h: ModoHora) => { setHora(h); if (motor) setHoraTxt(motor.hora(h)); };
  const cambiarCamara = (v: VistaCamara) => { setCamara(v); motor?.camara(v); };
  const alternarSonido = () => { const on = !sonido; if (motor?.sonido(on)) setSonido(on); };
  const alternarVoz = () => { const on = !voz; motor?.voz(on); setVoz(on); };
  const alternarLigero = () => { const on = !ligero; setLigero(on); guardar(CLAVE_LIGERO, on ? '1' : '0'); };
  const alMeseros = useCallback((m: ResumenMesero[]) => setMeseros((p) => (JSON.stringify(p) === JSON.stringify(m) ? p : m)), []);
  const alError = useCallback((e: Error) => setFalla3d(e.message), []);

  if (cargando && !datos) return <div className="sv-estado" role="status">Cargando el salón…</div>;
  if (!datos) return <div className="sv-estado" role="alert">{error ?? 'No se pudo cargar el salón en vivo.'}</div>;

  return (
    <div className="sv-raiz">
      <div className="sv-app">
        <section className="sv-escena" aria-label="Salón de Caprichos en 3D">
          {con3d && piso ? (
            <Suspense fallback={<div className="sv-sin3d" role="status">Preparando el salón en 3D…</div>}>
              <Escena3D piso={piso} datos={datos} reducir={reducir} ligero={ligero} onMotor={setMotor} alMeseros={alMeseros} onError={alError} />
            </Suspense>
          ) : (
            <div className="sv-sin3d" role="status">
              <p><b>Este equipo no puede mostrar el salón en 3D.</b></p>
              <p>El panel de la derecha sigue funcionando con los datos en vivo{falla3d ? '' : '.'}</p>
            </div>
          )}
          <div className="sv-cabeza">
            <span className="sv-logo">Caprichos<b>.</b></span>
            <span className="sv-vivo"><i />En vivo</span>
            {error && <span className="sv-aviso" role="alert">Sin conexión, mostrando lo último</span>}
            {pisos.length > 1 && (
              <select aria-label="Piso" value={piso?.id ?? ''} onChange={(e) => setPisoId(e.target.value)}>
                {pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            )}
          </div>
          {con3d && (
            <div className="sv-barra-cam" role="toolbar" aria-label="Cámara y Capri">
              {CAMARAS.map(([k, t]) => <button key={k} type="button" className="sv-btn" aria-pressed={camara === k} onClick={() => cambiarCamara(k)}>{t}</button>)}
              <span className="sv-sep" />
              <button type="button" className="sv-btn" onClick={() => motor?.saludar()}>Saludar</button>
              <button type="button" className="sv-btn" onClick={() => motor?.bailar()}>Bailar</button>
              <button type="button" className="sv-btn" aria-pressed={voz} onClick={alternarVoz}>Voz de Capri</button>
              <button type="button" className="sv-btn" aria-pressed={sonido} onClick={alternarSonido}>Sonido ambiente</button>
              <span className="sv-sep" />
              <button type="button" className="sv-btn" aria-pressed={ligero} onClick={alternarLigero} title="Menos efectos para equipos lentos">Modo ligero</button>
            </div>
          )}
        </section>
        <PanelVivo
          datos={datos} piso={piso} bitacora={bitacora} meseros={con3d ? meseros : []} reloj={reloj}
          interna={interna} onVista={setInterna} pestana={pestana} onPestana={setPestana}
          tema={tema} onTema={cambiarTema} hora={hora} horaTxt={horaTxt} onHora={cambiarHora} sin3d={!con3d}
        />
      </div>
    </div>
  );
}
