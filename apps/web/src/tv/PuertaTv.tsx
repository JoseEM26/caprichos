import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Cargando } from '../comun/Cargando';
import { useSesion } from '../comun/sesion';
import { borrarLlave, guardarLlave, leerLlave, llaveRevocada, tvApi, type VistaTv } from './tvApi';

/** Lo que recibe la vista de la TV: sin llave = hay sesión con permiso (funciona como siempre). */
export interface AccesoTv {
  llave: string | null;
  areaId: string | null;
  /** La API dijo que la pantalla se desactivó: vuelve a pedir código. */
  revocada: () => void;
}

const SIN_SESION: AccesoTv = { llave: null, areaId: null, revocada: () => undefined };
const CADA_MS = 4000;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const verCodigo = (c: string) => (c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

type Fase =
  | { tipo: 'comprobando' }
  | { tipo: 'codigo'; codigo: string; llave: string; vence: number }
  | { tipo: 'lista'; llave: string; areaId: string | null };

/**
 * Puerta de las TV del local: con sesión y permiso entra como siempre; sin sesión usa la llave
 * guardada en el navegador y, si no hay o fue revocada, muestra un código rotativo para vincularla
 * en Pantallas del administrativo.
 */
export function PuertaTv({ vista, permiso, children }: { vista: VistaTv; permiso: string; children: (acceso: AccesoTv) => ReactNode }) {
  const { usuario, cargando, tiene } = useSesion();
  if (cargando) return <Cargando mensaje="Preparando la pantalla..." pantallaCompleta />;
  if (usuario && tiene(permiso)) return <>{children(SIN_SESION)}</>;
  return <TvSinSesion vista={vista}>{children}</TvSinSesion>;
}

function TvSinSesion({ vista, children }: { vista: VistaTv; children: (acceso: AccesoTv) => ReactNode }) {
  const [fase, setFase] = useState<Fase>({ tipo: 'comprobando' });
  // cada vuelta pide un código nuevo (venció o la pantalla fue revocada); la primera prueba la llave guardada
  const [ronda, setRonda] = useState(0);
  const [restante, setRestante] = useState(0);
  const revocada = useCallback(() => {
    borrarLlave(vista);
    setRonda((r) => r + 1);
  }, [vista]);

  useEffect(() => {
    let vivo = true;
    setFase({ tipo: 'comprobando' });
    (async () => {
      const llave = ronda === 0 ? leerLlave(vista) : null;
      while (vivo && llave) {
        try {
          const e = await tvApi.estado(llave);
          if (e.vinculada && e.activa) {
            if (vivo) setFase({ tipo: 'lista', llave, areaId: e.areaId });
            return;
          }
          break;
        } catch (err) {
          if (llaveRevocada(err)) break;
          await esperar(CADA_MS); // sin red: reintenta
        }
      }
      borrarLlave(vista);
      while (vivo) {
        try {
          const c = await tvApi.pedirCodigo(vista);
          guardarLlave(vista, c.llave);
          if (vivo) setFase({ tipo: 'codigo', codigo: c.codigo, llave: c.llave, vence: new Date(c.expiraEn).getTime() });
          return;
        } catch {
          await esperar(CADA_MS);
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [vista, ronda]);

  // Con el código en pantalla: pregunta si ya lo vincularon y cuenta el tiempo; al vencer pide otro
  useEffect(() => {
    if (fase.tipo !== 'codigo') return;
    let vivo = true;
    const tic = () => {
      const s = Math.max(0, Math.ceil((fase.vence - Date.now()) / 1000));
      setRestante(s);
      if (s <= 0 && vivo) setRonda((r) => r + 1);
    };
    tic();
    const reloj = setInterval(tic, 1000);
    const sondeo = setInterval(async () => {
      try {
        const e = await tvApi.estado(fase.llave);
        if (vivo && e.vinculada && e.activa) setFase({ tipo: 'lista', llave: fase.llave, areaId: e.areaId });
      } catch (err) {
        if (vivo && llaveRevocada(err)) setRonda((r) => r + 1);
      }
    }, CADA_MS);
    return () => {
      vivo = false;
      clearInterval(reloj);
      clearInterval(sondeo);
    };
  }, [fase]);

  if (fase.tipo === 'lista') return <>{children({ llave: fase.llave, areaId: fase.areaId, revocada })}</>;
  if (fase.tipo === 'comprobando') return <Cargando mensaje="Preparando la pantalla..." pantallaCompleta />;

  return (
    <main
      aria-label="Vincular pantalla"
      style={{
        minHeight: '100vh',
        background: '#0B2C3E',
        color: '#FBF4EC',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <img
        src="/logo.webp"
        alt="Caprichos"
        style={{ width: 96, height: 96, borderRadius: 48, objectFit: 'cover' }}
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
      <h1 style={{ margin: 0, fontWeight: 800, fontSize: 34 }}>Vincula esta pantalla</h1>
      <p style={{ margin: 0, fontSize: 22, color: '#C9D6DD', maxWidth: 800, lineHeight: '30px' }}>
        Entra a <b style={{ color: '#FBF4EC' }}>caprichos.pe/admin/pantallas</b> y escribe este código:
      </p>
      <div
        aria-label="Código de vinculación"
        style={{
          fontWeight: 800,
          fontSize: 'clamp(56px, 12vw, 140px)',
          lineHeight: 1.1,
          letterSpacing: '0.14em',
          padding: '12px 40px',
          borderRadius: 20,
          background: '#FBF4EC',
          color: '#0B2C3E',
        }}
      >
        {verCodigo(fase.codigo)}
      </div>
      <p style={{ margin: 0, fontSize: 18, color: '#C9D6DD' }} role="timer">
        El código cambia solo en {mmss(restante)}. Esta pantalla solo mira: no cambia nada.
      </p>
    </main>
  );
}
