import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../comun/api';
import { MascotaCapri } from '../mascota/MascotaCapri';
import { useAspectoCapri } from '../mascota/useAspectoCapri';
import { fusionarAspecto } from '../mascota/aspectoUtils';
import { ASPECTO_BASE_DEFECTO, TEMAS_PREDETERMINADOS } from '../mascota/tiposAspecto';
import type { EstadoCapri } from '../mascota/animaciones';
import {
  agrupar,
  fusionarConSalida,
  nuevosListos,
  porcentajeEspera,
  temaPantalla,
  textoGlobo,
  textoVoz,
  type PedidoPantalla,
  type PedidoVisible,
  type RespuestaPantalla,
} from './logica';
import './pantalla-local.css';

const SONDEO_MS = 5000;
const SALIDA_MS = 700;
const GLOBO_MS = 6500;
const CONTROLES_MS = 4000;

/** Dos notas cortas con WebAudio; no necesita archivos. El navegador solo lo permite después de un clic. */
function sonarAviso() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [660, 880].forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const gan = ctx.createGain();
      osc.frequency.value = hz;
      gan.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      gan.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.22 + 0.03);
      gan.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.2);
      osc.connect(gan).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.22);
    });
    setTimeout(() => ctx.close().catch(() => undefined), 900);
  } catch {
    // el sonido es opcional
  }
}

function hablar(texto: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    const voz = new SpeechSynthesisUtterance(texto);
    voz.lang = 'es-PE';
    voz.rate = 0.95;
    window.speechSynthesis.speak(voz);
  } catch {
    // la voz es opcional
  }
}

const formatoHora = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });

function Tarjeta({ p, minutos }: { p: PedidoVisible; minutos: number }) {
  const listo = p.estado === 'LISTO';
  const clase = `pedido ${listo ? 'listo nuevo' : 'entra'} ${p.saliendo ? 'sale' : ''}`;
  const [pref, ...resto] = p.codigo.split('-');
  const cod = (
    <span className="cod">
      {resto.length ? <small>{pref}-</small> : null}
      {resto.length ? resto.join('-') : p.codigo}
    </span>
  );
  const avatar = p.avatarUrl ? <img className="avatar" src={p.avatarUrl} alt="" width={36} height={36} /> : null;
  if (listo) {
    return (
      <div className={clase} data-testid={`pedido-${p.codigo}`}>
        {cod}
        <span className="aviso">
          {avatar}
          {p.nombre ?? ''}
        </span>
      </div>
    );
  }
  return (
    <div className={clase} data-testid={`pedido-${p.codigo}`}>
      {cod}
      <span className="nom">
        {avatar}
        {p.nombre ?? ''}
      </span>
      <span className="min">{minutos} min</span>
      <div className="barra" aria-hidden="true">
        <i style={{ width: `${Math.max(4, porcentajeEspera(minutos))}%` }} />
      </div>
    </div>
  );
}

/** Pantalla pública de TV del local: pedidos preparando y listos, con Capri que avisa. Ruta /pantalla-local. */
export function PantallaLocal() {
  const [params] = useSearchParams();
  const temaUrl = params.get('tema');
  const { tema: temaPublico } = useAspectoCapri();
  const tema = temaPantalla(temaUrl ?? temaPublico);
  // ?tema= solo sirve para probar: arma el aspecto de ese tema; sin él, Capri hereda el aspecto público del día.
  const aspectoPrueba = useMemo(() => {
    if (!temaUrl) return undefined;
    const t = TEMAS_PREDETERMINADOS.find((x) => x.clave === temaUrl);
    return fusionarAspecto(ASPECTO_BASE_DEFECTO, t?.aspecto);
  }, [temaUrl]);

  const [visibles, setVisibles] = useState<PedidoVisible[]>([]);
  const [recibidoEn, setRecibidoEn] = useState<number>(() => Date.now());
  const [ahora, setAhora] = useState<number>(() => Date.now());
  const [sinConexion, setSinConexion] = useState(false);
  const [estadoCapri, setEstadoCapri] = useState<EstadoCapri>('saludando');
  const [globo, setGlobo] = useState<string | null>(null);
  const [sonido, setSonido] = useState(false);
  const [controles, setControles] = useState(true);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  const previos = useRef<PedidoPantalla[] | null>(null);
  const cola = useRef<PedidoPantalla[]>([]);
  const ocupado = useRef(false);
  const sonidoRef = useRef(false);
  sonidoRef.current = sonido;

  // Capri atiende de a un aviso: salta, muestra el globo y, si hay sonido, suena y habla.
  const siguienteAviso = useCallback(() => {
    const p = cola.current.shift();
    if (!p) {
      ocupado.current = false;
      setGlobo(null);
      setEstadoCapri('reposo');
      return;
    }
    ocupado.current = true;
    setEstadoCapri('contento');
    setGlobo(textoGlobo(p));
    if (sonidoRef.current) {
      sonarAviso();
      hablar(textoVoz(p));
    }
    setTimeout(siguienteAviso, GLOBO_MS);
  }, []);

  const leer = useCallback(async () => {
    try {
      const r = await api.get<RespuestaPantalla>('/carta/pantalla/pedidos');
      const listos = nuevosListos(previos.current, r.pedidos);
      previos.current = r.pedidos;
      setRecibidoEn(Date.now());
      setSinConexion(false);
      setVisibles((v) => fusionarConSalida(v, r.pedidos));
      if (listos.length) {
        cola.current.push(...listos);
        if (!ocupado.current) siguienteAviso();
      }
    } catch {
      setSinConexion(true);
    }
  }, [siguienteAviso]);

  useEffect(() => {
    void leer();
    const id = setInterval(() => void leer(), SONDEO_MS);
    return () => clearInterval(id);
  }, [leer]);

  // Lo que salió de la lista se quita pasada la animación.
  useEffect(() => {
    if (!visibles.some((p) => p.saliendo)) return;
    const id = setTimeout(() => setVisibles((v) => v.filter((p) => !p.saliendo)), SALIDA_MS);
    return () => clearTimeout(id);
  }, [visibles]);

  // Saludo inicial y reloj
  useEffect(() => {
    const saludo = setTimeout(() => setEstadoCapri((e) => (e === 'saludando' ? 'reposo' : e)), 5000);
    const reloj = setInterval(() => setAhora(Date.now()), 15000);
    return () => {
      clearTimeout(saludo);
      clearInterval(reloj);
    };
  }, []);

  // Controles que se esconden solos
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const mostrar = () => {
      setControles(true);
      clearTimeout(id);
      id = setTimeout(() => setControles(false), CONTROLES_MS);
    };
    mostrar();
    const eventos = ['mousemove', 'touchstart', 'keydown', 'click'] as const;
    eventos.forEach((e) => window.addEventListener(e, mostrar));
    return () => {
      clearTimeout(id);
      eventos.forEach((e) => window.removeEventListener(e, mostrar));
    };
  }, []);

  useEffect(() => {
    const cambio = () => setPantallaCompleta(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', cambio);
    return () => document.removeEventListener('fullscreenchange', cambio);
  }, []);

  useEffect(() => {
    document.title = 'Caprichos - Pedidos del local';
  }, []);

  const alternarPantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.();
  };

  const minutosDe = (p: PedidoVisible) => p.minutos + Math.floor(Math.max(0, ahora - recibidoEn) / 60000);
  const { local, llevar } = agrupar(visibles);

  const mensajes = [
    ['Busca tu ', 'código', ' en tu ticket'],
    ['Cuando tu pedido pase a ', 'Listo', ', acércate a la barra'],
    ['Pide desde la carta en ', 'caprichos.pe', ''],
    ['Gracias por elegir ', 'Caprichos', ''],
  ];
  const cinta = [...mensajes, ...mensajes].map(([a, b, c], i) => (
    <span key={i}>
      {a}
      <b>{b}</b>
      {c}
    </span>
  ));
  const lista = (ps: PedidoVisible[], vacio: string, extra = '') => (
    <div className={`lista ${extra}`} data-vacio={vacio}>
      {ps.map((p) => (
        <Tarjeta key={`${p.codigo}-${p.estado}`} p={p} minutos={minutosDe(p)} />
      ))}
    </div>
  );
  const total = (c: typeof local) => c.preparando.filter((p) => !p.saliendo).length + c.listos.filter((p) => !p.saliendo).length;

  return (
    <div className={`pl-raiz ${controles ? '' : 'inactivo'}`} data-tema={tema} data-testid="pantalla-local">
      <div className="tv">
        <header className="cab">
          <div className="marca">
            <span className="logo">
              Caprichos<b>.</b>
            </span>
            <span className="sub">Pedidos en vivo</span>
          </div>
          <div className="estado">
            {sinConexion ? (
              <span className="sin-conexion">Sin conexión, reintentando</span>
            ) : (
              <span className="vivo">
                <i />
                En vivo
              </span>
            )}
            <time id="reloj" aria-label="Hora de Lima">
              {formatoHora.format(ahora)}
            </time>
          </div>
        </header>

        <main className="cuerpo">
          <section className="escenario" aria-label="Capri, la mascota de Caprichos">
            {globo ? (
              <div className="globo" role="status" data-testid="globo-capri">
                {globo}
              </div>
            ) : estadoCapri === 'saludando' ? (
              <div className="globo">¡Hola! Soy Capri. Busca tu código en la pantalla</div>
            ) : null}
            <div className="capri-centro">
              <MascotaCapri estado={estadoCapri} tamano={360} aspecto={aspectoPrueba} />
            </div>
          </section>

          <section className="tablero local" aria-label="Pedidos para comer en el local">
            <h2>
              <span>Comer en el local</span>
              <em>{total(local) ? `${total(local)} pedidos` : ''}</em>
            </h2>
            <div className="cols">
              <div className="col">
                <h3>Preparando</h3>
                {lista(local.preparando, 'Sin pedidos en cocina')}
              </div>
              <div className="col">
                <h3 className="verde">¡Listo! Acércate a la barra</h3>
                {lista(local.listos, 'Aún no hay pedidos listos', 'rejilla')}
              </div>
            </div>
          </section>

          <section className="tablero llevar" aria-label="Pedidos para llevar">
            <h2>
              <span>Para llevar</span>
              <em>{total(llevar) ? `${total(llevar)} pedidos` : ''}</em>
            </h2>
            <h3 className="verde">Listo para recoger</h3>
            {lista(llevar.listos, 'Nada por recoger')}
            <h3>Preparando</h3>
            {lista(llevar.preparando, 'Sin pedidos en cocina', 'prep')}
          </section>
        </main>

        <footer className="pie" aria-hidden="true">
          <div className="cinta">{cinta}</div>
        </footer>
      </div>

      <div className={`controles ${controles ? 'ver' : ''}`} role="toolbar" aria-label="Controles de la pantalla">
        <button type="button" className="ctl" aria-pressed={sonido} onClick={() => setSonido((x) => !x)}>
          {sonido ? 'Sonido y voz: activados' : 'Activar sonido y voz'}
        </button>
        <button type="button" className="ctl" onClick={alternarPantallaCompleta}>
          {pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
        </button>
      </div>
    </div>
  );
}

export default PantallaLocal;
