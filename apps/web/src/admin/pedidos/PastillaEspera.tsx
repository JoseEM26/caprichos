import { useSyncExternalStore } from 'react';
import { ahoraServidorMs } from '../cocina/tiempoEnVivo';
import { ESTILO_ESPERA, nivelEspera } from './estadosCaja';
import { textoFaltan } from './programado';

const PERIODO_MS = 30000;

// Un solo temporizador para todas las tarjetas y el detalle: avisa cada 30 s y se apaga sin suscriptores.
const suscriptores = new Set<() => void>();
let intervalo: ReturnType<typeof setInterval> | null = null;
let ultimo = 0;

function suscribir(aviso: () => void): () => void {
  suscriptores.add(aviso);
  if (intervalo === null) {
    intervalo = setInterval(() => {
      ultimo = ahoraServidorMs();
      suscriptores.forEach((f) => f());
    }, PERIODO_MS);
  }
  return () => {
    suscriptores.delete(aviso);
    if (suscriptores.size === 0 && intervalo !== null) {
      clearInterval(intervalo);
      intervalo = null;
      ultimo = 0;
    }
  };
}

// El snapshot solo cambia con el tic (no en cada lectura): sin tic previo se fija al montar.
const instante = () => (ultimo = ultimo || ahoraServidorMs());

/** Hora actual (ms) que se refresca sola cada 30 s, compartida por todos los componentes. */
export function useAhora(): number {
  return useSyncExternalStore(suscribir, instante, instante);
}

const ROTULO = { verde: 'En tiempo', oxido: 'Atención', rojo: 'Tarde', neutro: '' } as const;

export function minutosDesde(creadoEn: string | null | undefined, ahora: number): number | null {
  if (!creadoEn) return null;
  return Math.max(0, Math.floor((ahora - new Date(creadoEn).getTime()) / 60000));
}

/** «12 min», «1 h 05», «ayer» pasado un día. */
export function textoMinutos(min: number): string {
  if (min >= 1440) return 'ayer';
  if (min >= 60) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
  return `${min} min`;
}

const horaLima = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

interface Props {
  creadoEn?: string | null;
  /** Hora pactada de un programado: la espera se cuenta desde ahí (faltan antes, retraso después). */
  programadoPara?: string | null;
  cerrado: boolean;
  /** Para pruebas: instante en ms; si falta se usa el reloj compartido en vivo. */
  ahora?: number;
}

/**
 * Pastilla semáforo de espera (verde < 35 min, óxido 35–49, rojo ≥ 50); neutra con la hora en pedidos cerrados.
 * Programado (con hora pactada, abierto): antes de la hora dice «faltan N min» en verde; después «+N min» de
 * retraso desde esa hora, con los mismos umbrales. Sin programado_para no cambia.
 */
export function PastillaEspera({ creadoEn, programadoPara, cerrado, ahora }: Props) {
  const vivo = useAhora();
  const t = ahora ?? vivo;
  const pactada = programadoPara ? new Date(programadoPara).getTime() : NaN;
  const conPactada = !cerrado && !Number.isNaN(pactada);
  if (!creadoEn && !conPactada) return null;

  let nivel: ReturnType<typeof nivelEspera>;
  let texto: string;
  let aria: string;
  if (conPactada && pactada > t) {
    // Aún no es la hora pactada: en tiempo, con lo que falta
    nivel = 'verde';
    texto = textoFaltan(new Date(pactada), new Date(t));
    aria = `${texto}, en tiempo`;
  } else if (conPactada) {
    const tarde = Math.floor((t - pactada) / 60000);
    nivel = nivelEspera(tarde, false);
    texto = `+${textoMinutos(tarde)}`;
    aria = `${tarde === 0 ? 'En la hora pactada' : `${tarde} ${tarde === 1 ? 'minuto' : 'minutos'} de retraso`}, ${ROTULO[nivel].toLowerCase()}`;
  } else {
    const min = minutosDesde(creadoEn, t);
    nivel = nivelEspera(min, cerrado);
    texto = cerrado ? horaLima(creadoEn as string) : textoMinutos(min ?? 0);
    aria = cerrado
      ? `Pedido de las ${horaLima(creadoEn as string)}`
      : `Hace ${min === 1 ? '1 minuto' : `${min} minutos`}, ${ROTULO[nivel].toLowerCase()}`;
  }
  const color = ESTILO_ESPERA[nivel];
  const rotulo = ROTULO[nivel];
  return (
    <span className="cj2-espera" data-nivel={nivel} role="timer" aria-label={aria} style={{ background: color.bg, color: color.fg }}>
      <span className="cj2-espera-hora">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        {texto}
      </span>
      {rotulo && <span className="cj2-espera-rotulo">{rotulo}</span>}
    </span>
  );
}
