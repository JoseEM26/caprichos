import { useSyncExternalStore } from 'react';
import { ahoraServidorMs } from '../cocina/tiempoEnVivo';
import { ESTILO_ESPERA, nivelEspera } from './estadosCaja';

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
  cerrado: boolean;
  /** Para pruebas: instante en ms; si falta se usa el reloj compartido en vivo. */
  ahora?: number;
}

/** Pastilla semáforo de espera (verde < 35 min, óxido 35–49, rojo ≥ 50); neutra con la hora en pedidos cerrados. */
export function PastillaEspera({ creadoEn, cerrado, ahora }: Props) {
  const vivo = useAhora();
  if (!creadoEn) return null;
  const min = minutosDesde(creadoEn, ahora ?? vivo);
  const nivel = nivelEspera(min, cerrado);
  const color = ESTILO_ESPERA[nivel];
  const texto = cerrado ? horaLima(creadoEn) : textoMinutos(min ?? 0);
  const rotulo = ROTULO[nivel];
  const aria = cerrado
    ? `Pedido de las ${horaLima(creadoEn)}`
    : `Hace ${min === 1 ? '1 minuto' : `${min} minutos`}, ${rotulo.toLowerCase()}`;
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
