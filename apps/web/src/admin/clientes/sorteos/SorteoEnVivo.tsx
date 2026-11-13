import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogoAccesible } from '../../../comun/useDialogoAccesible';
import { azarSeguro, barajar, eliminacion, elegir, gajosRuleta, nEsimo, topK, type Azar } from './sorteo.logica';
import './sorteo.css';

export interface ParticipanteSorteo {
  id: string;
  nombre: string;
  detalle: string;
}
type P = ParticipanteSorteo;
type Juego = 'ruleta' | 'tombola' | 'nesimo' | 'top' | 'eliminacion';
type Duracion = 'corto' | 'normal' | 'largo';

const JUEGOS: { id: Juego; icono: string; titulo: string; texto: string }[] = [
  { id: 'ruleta', icono: '🎡', titulo: 'Ruleta', texto: 'Gira la rueda con los nombres y se detiene en el ganador.' },
  { id: 'tombola', icono: '🎰', titulo: 'Tómbola', texto: 'Los nombres pasan rápido y van frenando hasta quedar uno.' },
  { id: 'nesimo', icono: '🔢', titulo: 'El N-ésimo gana', texto: 'Salen nombres uno a uno; gana el que salga en el lugar que elijas.' },
  { id: 'top', icono: '🏆', titulo: 'Varios ganadores', texto: 'Sortea un podio de 1 a 10 ganadores, del último al primero.' },
  { id: 'eliminacion', icono: '💥', titulo: 'Eliminación', texto: 'Se van eliminando nombres por rondas hasta que queda uno.' },
];
const BASE_MS: Record<Duracion, number> = { corto: 3000, normal: 6000, largo: 10000 };
const MEDALLA = ['🥇', '🥈', '🥉'];
const puesto = (i: number) => MEDALLA[i] ?? `${i + 1}.º`;

const reducido = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface Plan {
  juego: Juego;
  ms: number;
  ganadores: P[]; // en orden de puesto
  gajos?: P[];
  orden?: P[]; // orden en que se revelan (nesimo / top)
  n?: number;
  rondas?: P[][];
}
interface Ronda {
  juego: Juego;
  ganadores: P[];
  hora: string;
}

/* ---------- Piezas de animación ---------- */

/** Nombres que pasan y frenan hasta caer en `objetivo`. */
function Pasan({ pool, objetivo, ms, alFin }: { pool: P[]; objetivo: P; ms: number; alFin: () => void }) {
  const [actual, setActual] = useState<P>(pool[0] ?? objetivo);
  const [parado, setParado] = useState(false);
  const fin = useRef(alFin);
  fin.current = alFin;
  useEffect(() => {
    const mezcla = barajar(pool.filter((x) => x !== objetivo));
    let t = 0;
    let i = 0;
    let id: ReturnType<typeof setTimeout>;
    const paso = () => {
      const avance = t / ms;
      if (avance >= 1 || mezcla.length === 0) {
        setActual(objetivo);
        setParado(true);
        id = setTimeout(() => fin.current(), 900);
        return;
      }
      setActual(mezcla[i++ % mezcla.length]);
      const espera = 45 + avance * avance * 420;
      t += espera;
      id = setTimeout(paso, espera);
    };
    paso();
    return () => clearTimeout(id);
  }, [pool, objetivo, ms]);
  return (
    <div className={`so-pasan${parado ? ' so-parado' : ''}`} aria-live="polite">
      <div className="so-pasan-nombre">{actual.nombre}</div>
      <div className="so-pasan-detalle">{actual.detalle}</div>
    </div>
  );
}

function Ruleta({ plan, alFin }: { plan: Plan; alFin: () => void }) {
  const gajos = plan.gajos!;
  const ganador = plan.ganadores[0];
  const n = gajos.length;
  const seg = 360 / n;
  const idx = gajos.indexOf(ganador);
  const [girado, setGirado] = useState(false);
  const fin = useRef(alFin);
  fin.current = alFin;
  const vueltas = reducido() ? 1 : 6;
  const jitter = (azarSeguro(1000) / 1000 - 0.5) * seg * 0.6;
  const [angulo] = useState(() => 360 * vueltas - (idx + 0.5) * seg + jitter);
  useEffect(() => {
    const a = setTimeout(() => setGirado(true), 50);
    const b = setTimeout(() => fin.current(), plan.ms + 1200);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [plan.ms]);
  const r = 96;
  const punto = (grados: number, rad: number) => {
    const t = ((grados - 90) * Math.PI) / 180;
    return [Math.cos(t) * rad, Math.sin(t) * rad];
  };
  const colores = ['#E67929', '#0B2C3E', '#D99E39', '#2C4C5D'];
  return (
    <div className="so-ruleta">
      <div className="so-puntero" aria-hidden="true" />
      <svg
        viewBox="-100 -100 200 200"
        className="so-rueda"
        role="img"
        aria-label="Ruleta girando"
        style={{
          transform: `rotate(${girado ? angulo : 0}deg)`,
          transition: girado ? `transform ${plan.ms}ms cubic-bezier(.12,.6,.1,1)` : 'none',
        }}
      >
        {gajos.map((g, i) => {
          const [x1, y1] = punto(i * seg, r);
          const [x2, y2] = punto((i + 1) * seg, r);
          const medio = (i + 0.5) * seg;
          const [tx, ty] = punto(medio, r * 0.6);
          const corto = g.nombre.length > 14 ? g.nombre.slice(0, 13) + '…' : g.nombre;
          return (
            <g key={g.id}>
              <path
                d={n === 1 ? `M0 -${r} A${r} ${r} 0 1 1 -0.01 -${r}Z` : `M0 0L${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}Z`}
                fill={colores[i % colores.length]}
                stroke="#FBF4EC"
                strokeWidth="0.8"
              />
              <text
                x={tx}
                y={ty}
                transform={`rotate(${medio - 90} ${tx} ${ty})`}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={i % colores.length === 2 ? '#0B2C3E' : '#FBF4EC'}
                fontSize={n > 16 ? 5 : 7}
                fontWeight="700"
              >
                {corto}
              </text>
            </g>
          );
        })}
        <circle r="9" fill="#FBF4EC" stroke="#0B2C3E" strokeWidth="2" />
      </svg>
    </div>
  );
}

function Secuencia({ plan, alFin }: { plan: Plan; alFin: () => void }) {
  const orden = plan.orden!;
  const esTop = plan.juego === 'top';
  // top: del último puesto al 1.º; nesimo: en orden de salida
  const turnos = useMemo(() => (esTop ? [...orden].reverse() : orden), [orden, esTop]);
  const [i, setI] = useState(0);
  const [salieron, setSalieron] = useState<P[]>([]);
  const ms = esTop ? plan.ms * 0.6 : plan.ms * 0.45;
  const pool = useMemo(() => orden.concat(plan.gajos ?? []), [orden, plan.gajos]);
  const etiqueta = (k: number, lleno: boolean) => {
    if (esTop) return puesto(turnos.length - 1 - k);
    return lleno && k === turnos.length - 1 ? '🏆' : 'casi…';
  };
  return (
    <div className="so-secuencia">
      <div className="so-turno">
        {esTop ? `Puesto ${turnos.length - i}` : `Sale el ${i + 1}.º de ${turnos.length}`}
      </div>
      {i < turnos.length && (
        <Pasan
          key={i}
          pool={pool}
          objetivo={turnos[i]}
          ms={ms}
          alFin={() => {
            setSalieron((s) => [...s, turnos[i]]);
            if (i + 1 >= turnos.length) alFin();
            else setI(i + 1);
          }}
        />
      )}
      <ul className="so-salieron">
        {salieron.map((p, k) => (
          <li key={p.id}>
            <span>{etiqueta(k, true)}</span> {p.nombre}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Eliminacion({ plan, alFin }: { plan: Plan; alFin: () => void }) {
  const rondas = plan.rondas!;
  const [t, setT] = useState(0); // par: marcar ronda t/2; impar: quitarla
  const fin = useRef(alFin);
  fin.current = alFin;
  const paso = plan.ms / (rondas.length * 2 + 1);
  useEffect(() => {
    if (t >= rondas.length * 2) {
      const id = setTimeout(() => fin.current(), 700);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setT(t + 1), paso);
    return () => clearTimeout(id);
  }, [t, rondas.length, paso]);
  const quitadas = rondas.slice(0, Math.floor((t + 1) / 2)).flat();
  const marcadas = t % 2 === 1 ? new Set(rondas[(t - 1) / 2].map((p) => p.id)) : new Set<string>();
  const fuera = new Set(quitadas.map((p) => p.id));
  const base = useMemo(() => barajar([...plan.ganadores, ...rondas.flat()], azarSeguro), [plan, rondas]);
  const todos = base.filter((p) => !fuera.has(p.id));
  const VER = 60;
  return (
    <div className="so-elim">
      <div className="so-turno">Quedan {todos.length}</div>
      <div className="so-chips">
        {todos.slice(0, VER).map((p) => (
          <span key={p.id} className={`so-chip${marcadas.has(p.id) ? ' so-chip-fuera' : ''}`}>
            {p.nombre}
          </span>
        ))}
        {todos.length > VER && <span className="so-chip so-chip-mas">+{todos.length - VER} más</span>}
      </div>
    </div>
  );
}

function Confeti() {
  const colores = ['#E67929', '#D99E39', '#FBF4EC', '#2F7A45', '#B3412E'];
  return (
    <div className="so-confeti" aria-hidden="true">
      {Array.from({ length: 48 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colores[i % colores.length],
            animationDelay: `${(i % 8) * 0.18}s`,
            animationDuration: `${2.6 + (i % 5) * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- Pantalla principal ---------- */

export function SorteoEnVivo({
  participantes,
  filtrosTexto,
  alCerrar,
  azar = azarSeguro,
  factorTiempo = 1,
}: {
  participantes: ParticipanteSorteo[];
  filtrosTexto: string;
  alCerrar: () => void;
  /** Solo para pruebas */
  azar?: Azar;
  /** Solo para pruebas: multiplica las duraciones */
  factorTiempo?: number;
}) {
  const [juego, setJuego] = useState<Juego>('ruleta');
  const [duracion, setDuracion] = useState<Duracion>('normal');
  const [k, setK] = useState(3);
  const [n, setN] = useState(3);
  const [sinRepetir, setSinRepetir] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [historial, setHistorial] = useState<Ronda[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const ya = useMemo(() => new Set(historial.flatMap((h) => h.ganadores.map((g) => g.id))), [historial]);
  const pool = useMemo(
    () => (sinRepetir ? participantes.filter((p) => !ya.has(p.id)) : participantes),
    [participantes, sinRepetir, ya],
  );
  const maxGan = Math.min(10, pool.length);
  const resultado = !!plan && !corriendo;

  useEffect(() => {
    const cambio = () => setPantallaCompleta(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', cambio);
    try {
      void document.documentElement.requestFullscreen?.()?.catch(() => undefined);
    } catch {
      /* sin pantalla completa también funciona */
    }
    return () => {
      document.removeEventListener('fullscreenchange', cambio);
      if (document.fullscreenElement) void document.exitFullscreen?.()?.catch(() => undefined);
    };
  }, []);

  const alternarPantalla = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen?.()?.catch(() => undefined);
      else void document.documentElement.requestFullscreen?.()?.catch(() => undefined);
    } catch {
      /* ignorado */
    }
  };

  const pedirCerrar = () => {
    if (resultado || corriendo) setConfirmando(true);
    else alCerrar();
  };
  const onKeyDown = useDialogoAccesible(ref, pedirCerrar);

  const empezar = () => {
    if (pool.length === 0) return;
    const ms = BASE_MS[duracion] * (reducido() ? 0.35 : 1) * factorTiempo;
    let p: Plan;
    if (juego === 'ruleta') {
      const g = elegir(pool, azar);
      p = { juego, ms, ganadores: [g], gajos: gajosRuleta(pool, g, 24, azar) };
    } else if (juego === 'tombola') {
      p = { juego, ms, ganadores: [elegir(pool, azar)], gajos: pool };
    } else if (juego === 'nesimo') {
      const r = nEsimo(pool, n, azar);
      p = { juego, ms, ganadores: [r.ganador], orden: r.orden, n: r.orden.length, gajos: pool };
    } else if (juego === 'top') {
      const g = topK(pool, k, azar);
      p = { juego, ms, ganadores: g, orden: g, gajos: pool };
    } else {
      const r = eliminacion(pool, azar);
      p = { juego, ms, ganadores: [r.ganador], rondas: r.rondas };
    }
    setConfirmando(false);
    setPlan(p);
    setCorriendo(true);
  };

  const terminar = () => {
    if (!plan) return;
    setCorriendo(false);
    const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    setHistorial((h) => [...h, { juego: plan.juego, ganadores: plan.ganadores, hora }]);
  };

  const copiar = async () => {
    const txt = historial
      .flatMap((h) => h.ganadores)
      .map((g) => `${g.nombre} ${g.detalle}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(txt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin portapapeles */
    }
  };

  let cuerpo: ReactNode;
  if (plan && corriendo) {
    cuerpo = (
      <div className="so-escena">
        {plan.juego === 'ruleta' && <Ruleta key={plan.ms + plan.ganadores[0].id} plan={plan} alFin={terminar} />}
        {plan.juego === 'tombola' && (
          <Pasan pool={plan.gajos!} objetivo={plan.ganadores[0]} ms={plan.ms} alFin={terminar} />
        )}
        {(plan.juego === 'nesimo' || plan.juego === 'top') && <Secuencia plan={plan} alFin={terminar} />}
        {plan.juego === 'eliminacion' && <Eliminacion plan={plan} alFin={terminar} />}
      </div>
    );
  } else if (plan) {
    const varios = plan.ganadores.length > 1;
    cuerpo = (
      <div className="so-escena so-resultado">
        <Confeti />
        <h2 className="so-titulo">{varios ? '¡Tenemos ganadores!' : '¡Tenemos ganador!'}</h2>
        <ol className="so-podio">
          {plan.ganadores.map((g, i) => (
            <li key={g.id} className={varios ? 'so-podio-item' : 'so-podio-item so-solo'}>
              {varios && <span className="so-medalla">{puesto(i)}</span>}
              <span className="so-gan-nombre">{g.nombre}</span>
              <span className="so-gan-detalle">{g.detalle}</span>
            </li>
          ))}
        </ol>
        <div className="so-acciones">
          <button type="button" className="so-btn so-btn-primario" data-foco-inicial onClick={empezar} disabled={pool.length === 0}>
            Otra vez
          </button>
          <button type="button" className="so-btn" onClick={() => setPlan(null)}>
            Otro juego
          </button>
        </div>
        {pool.length === 0 && sinRepetir && <p className="so-nota">Ya salieron todos. Quita «sin repetir» para seguir.</p>}
      </div>
    );
  } else {
    cuerpo = (
      <div className="so-intro">
        <h2 className="so-titulo">Sorteo en vivo</h2>
        <p className="so-resumen">
          Participan <b>{participantes.length}</b> {participantes.length === 1 ? 'cliente' : 'clientes'}
          {filtrosTexto ? ` · ${filtrosTexto}` : ''}
          {sinRepetir && ya.size > 0 ? ` · quedan ${pool.length} sin ganar` : ''}
        </p>
        {participantes.length === 0 ? (
          <p className="so-vacio">Todavía no hay clientes para sortear. Cambia los filtros y vuelve a abrir el sorteo.</p>
        ) : (
          <>
            <div className="so-juegos" role="radiogroup" aria-label="Juego">
              {JUEGOS.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  role="radio"
                  aria-checked={juego === j.id}
                  className={`so-juego${juego === j.id ? ' so-sel' : ''}`}
                  onClick={() => setJuego(j.id)}
                >
                  <span className="so-juego-ico" aria-hidden="true">
                    {j.icono}
                  </span>
                  <b>{j.titulo}</b>
                  <small>{j.texto}</small>
                </button>
              ))}
            </div>
            <div className="so-ajustes">
              {juego === 'top' && (
                <label>
                  Ganadores
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, maxGan)}
                    value={k}
                    onChange={(e) => setK(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  />
                </label>
              )}
              {juego === 'nesimo' && (
                <label>
                  Gana el que salga en el lugar
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, pool.length)}
                    value={n}
                    onChange={(e) => setN(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                  />
                </label>
              )}
              <label>
                Duración
                <select value={duracion} onChange={(e) => setDuracion(e.target.value as Duracion)}>
                  <option value="corto">Corto</option>
                  <option value="normal">Normal</option>
                  <option value="largo">Largo</option>
                </select>
              </label>
              <label className="so-check">
                <input type="checkbox" checked={sinRepetir} onChange={(e) => setSinRepetir(e.target.checked)} />
                Sin repetir ganador
              </label>
            </div>
            <button type="button" className="so-btn so-btn-primario so-grande" data-foco-inicial onClick={empezar} disabled={pool.length === 0}>
              ¡Empezar sorteo!
            </button>
            {pool.length === 0 && <p className="so-nota">Ya salieron todos. Quita «sin repetir» para seguir.</p>}
          </>
        )}
      </div>
    );
  }

  return createPortal(
    <div
      ref={ref}
      className="so-raiz"
      role="dialog"
      aria-modal="true"
      aria-label="Sorteo en vivo"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <header className="so-barra">
        <img src="/logo.webp" alt="Caprichos" className="so-logo" />
        <div className="so-barra-btns">
          <button type="button" className="so-btn so-chico" onClick={alternarPantalla}>
            {pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
          </button>
          <button type="button" className="so-btn so-chico" onClick={pedirCerrar}>
            Cerrar
          </button>
        </div>
      </header>
      <main className="so-centro">{cuerpo}</main>
      {historial.length > 0 && (
        <aside className="so-historial" aria-label="Ganadores de esta sesión">
          <div className="so-hist-cab">
            <b>Ganadores de hoy</b>
            <button type="button" className="so-btn so-chico" onClick={copiar}>
              {copiado ? '¡Copiado!' : 'Copiar ganadores'}
            </button>
          </div>
          <ul>
            {historial.map((h, i) => (
              <li key={i}>
                <small>{h.hora}</small> {h.ganadores.map((g) => `${g.nombre} ${g.detalle}`).join(' · ')}
              </li>
            ))}
          </ul>
        </aside>
      )}
      {confirmando && (
        <div className="so-confirma" role="alertdialog" aria-label="Cerrar el sorteo">
          <div className="so-confirma-caja">
            <p>¿Cerrar el sorteo? Se pierde la lista de ganadores de esta pantalla.</p>
            <div className="so-acciones">
              <button type="button" className="so-btn so-btn-primario" onClick={alCerrar}>
                Sí
              </button>
              <button type="button" className="so-btn" autoFocus data-foco-inicial onClick={() => setConfirmando(false)}>
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
