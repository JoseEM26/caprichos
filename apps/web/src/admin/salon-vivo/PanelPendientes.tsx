import { useEffect, useRef, useState } from 'react';
import type { PedidoVivo, SalonVivo } from './salonVivoApi';

/**
 * Panel de la derecha para la TV: SOLO los pedidos pendientes y en qué parte van, con una barra de avance grande.
 * Recibido/En caja → En cocina (avanza con cada área que termina) → Listo. Al despacharse (entregado o en reparto) desaparece.
 */
export type EtapaPendiente = 'CAJA' | 'COCINA' | 'LISTO';

export interface Pendiente {
  id: string;
  codigo: string;
  donde: string;
  cliente: string | null;
  etapa: EtapaPendiente;
  porcentaje: number;
  minutos: number;
  areas: PedidoVivo['areas'];
  avatarUrl: string | null;
  /** Primeros productos del pedido y cuántas unidades lleva en total. */
  items: string[];
  productos: number;
}

const ETIQUETA: Record<EtapaPendiente, string> = { CAJA: 'En caja', COCINA: 'En cocina', LISTO: '¡Listo!' };

function donde(p: PedidoVivo): string {
  if (p.modalidad === 'MESA') return p.mesas[0] || 'Mesa';
  if (p.modalidad === 'DELIVERY') return 'Delivery';
  return 'Para llevar';
}

/** Une caja, cocina y despacho en una sola lista de pendientes (un pedido una vez, en su etapa más avanzada). */
export function pendientesDe(d: SalonVivo): Pendiente[] {
  const porId = new Map<string, Pendiente>();
  const poner = (p: PedidoVivo, etapa: EtapaPendiente) => {
    const total = p.areas.length;
    const listas = p.areas.filter((a) => a.estado === 'LISTA').length;
    const porcentaje =
      etapa === 'LISTO' ? 100 : etapa === 'CAJA' ? 12 : Math.round(25 + (p.estado === 'PREPARANDO' ? 10 : 0) + (total ? (listas / total) * 55 : 0));
    const previo = porId.get(p.id);
    if (previo && previo.porcentaje >= porcentaje) return;
    porId.set(p.id, { id: p.id, codigo: p.codigo, donde: donde(p), cliente: p.cliente, etapa, porcentaje, minutos: p.minutos, areas: p.areas, avatarUrl: p.avatar?.url ?? null, items: p.items ?? [], productos: p.productos ?? 0 });
  };
  // En caja solo cuenta mientras aún no entra a cocina ni está listo (por cobrar antes de preparar)
  // Los pedidos de delivery no se muestran: a los clientes del local no les interesan
  const caja = d.caja.filter((p) => p.modalidad !== 'DELIVERY'), cocina = d.cocina.filter((p) => p.modalidad !== 'DELIVERY'), despacho = d.despacho.filter((p) => p.modalidad !== 'DELIVERY');
  for (const p of caja) if (p.estado === 'COLA' && p.areas.every((a) => a.estado === 'PENDIENTE')) poner(p, 'CAJA');
  for (const p of cocina) poner(p, 'COCINA');
  for (const p of despacho) poner(p, 'LISTO');
  // Listos primero (hay que entregarlos), luego los que más avanzaron, y a igual avance el que más espera
  return [...porId.values()].sort((a, b) => (b.etapa === 'LISTO' ? 1 : 0) - (a.etapa === 'LISTO' ? 1 : 0) || b.porcentaje - a.porcentaje || b.minutos - a.minutos);
}

/** Retrato circular del cliente; si la imagen falla, el círculo queda vacío y no se ve un icono roto. */
function Retrato({ url }: { url: string }) {
  const [falla, setFalla] = useState(false);
  if (falla) return <span className="sv-pend-retrato vacio" aria-hidden="true" />;
  return <img className="sv-pend-retrato" src={url} alt="" loading="lazy" onError={() => setFalla(true)} />;
}

/** Segundos que se ve cada tarjeta en el carrusel continuo, y ms entre páginas con movimiento reducido. */
export const SEGUNDOS_POR_TARJETA = 5;
export const INTERVALO_PAGINA_MS = 4000;

/**
 * Carrusel de la TV. Si las tarjetas no caben, `desborda` es verdadero: la vista duplica la lista y la desliza en bucle
 * continuo (sin salto, porque la copia empalma con el inicio). Si caben todas, no hay movimiento. Con movimiento
 * reducido no se anima: pasa de página en página cada 4 s con un corte, y vuelve al inicio al final.
 */
export function useCarrusel(vista: React.RefObject<HTMLElement | null>, lista: React.RefObject<HTMLElement | null>, activo: boolean, reducir: boolean, total: number): boolean {
  const [desborda, setDesborda] = useState(false);
  useEffect(() => {
    const v = vista.current, l = lista.current;
    if (!activo || !v || !l) { setDesborda(false); return; }
    const medir = () => setDesborda(l.scrollWidth > v.clientWidth + 4);
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [vista, lista, activo, total]);
  useEffect(() => {
    const v = vista.current;
    if (!activo || !reducir || !desborda || !v) return;
    const id = setInterval(() => {
      const alFinal = v.scrollLeft + v.clientWidth >= v.scrollWidth - 4;
      v.scrollTo({ left: alFinal ? 0 : v.scrollLeft + v.clientWidth, behavior: 'auto' });
    }, INTERVALO_PAGINA_MS);
    return () => clearInterval(id);
  }, [vista, activo, reducir, desborda]);
  return desborda;
}

const nombreArea = (n: string) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();

function Tarjeta({ p }: { p: Pendiente }) {
  return (
    <li className={`sv-pend-item ${p.etapa.toLowerCase()} ${p.minutos >= 15 && p.etapa !== 'LISTO' ? 'tarde' : ''}`}>
      <div className="sv-pend-fila">
        {p.avatarUrl && <Retrato url={p.avatarUrl} />}
        {p.cliente
          ? <span className="sv-pend-cod con-nombre"><b className="sv-pend-nom" title={p.cliente}>{p.cliente}</b><small className="sv-pend-cp">{p.codigo}</small></span>
          : <span className="sv-pend-cod"><small>{p.codigo.slice(0, 3)}</small>{p.codigo.slice(3)}</span>}
        <span className="sv-pend-donde">{p.donde}</span>
        <span className="sv-pend-etapa">{ETIQUETA[p.etapa]}</span>
      </div>
      <div className="sv-pend-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.porcentaje} aria-label={`${p.codigo}: ${ETIQUETA[p.etapa]}, ${p.porcentaje}%`}>
        <i style={{ width: `${p.porcentaje}%` }} />
        <span>{p.porcentaje}%</span>
      </div>
      <div className="sv-pend-pasos" aria-hidden="true">
        <span className={p.porcentaje >= 12 ? 'hecho' : ''}>Caja</span>
        <span className={p.etapa !== 'CAJA' ? 'hecho' : ''}>Cocina</span>
        <span className={p.etapa === 'LISTO' ? 'hecho' : ''}>Listo</span>
      </div>
      {p.items.length > 0 && (
        <div className="sv-pend-items">
          {p.items.map((it, i) => <span key={i} className={/^y \d+ más$/.test(it) ? 'mas' : undefined}>{it}</span>)}
        </div>
      )}
      {p.etapa === 'COCINA' && p.areas.length > 0 && (
        <div className="sv-pend-areas">
          {p.areas.map((a) => <span key={a.nombre} className={a.estado === 'LISTA' ? 'ok' : 'prep'}>{a.estado === 'LISTA' ? '✓' : '●'} {nombreArea(a.nombre)}</span>)}
          <em className="sv-pend-min">⏱ {p.minutos} min</em>
        </div>
      )}
    </li>
  );
}

/**
 * `tv`: la franja de abajo de la pantalla de la TV: solo la hora y el carrusel de pedidos (en bucle continuo si no caben).
 * Sin `tv`: el panel del admin, con el resumen y la lista vertical.
 */
export function PanelPendientes({ datos, reloj, tv = false, reducir = false }: { datos: SalonVivo; reloj: string; tv?: boolean; reducir?: boolean }) {
  const lista = pendientesDe(datos);
  const cuenta = (e: EtapaPendiente) => lista.filter((p) => p.etapa === e).length;
  const vistaRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLOListElement>(null);
  const desborda = useCarrusel(vistaRef, listaRef, tv, reducir, lista.length);
  if (tv) {
    const anima = desborda && !reducir;
    return (
      <aside className="sv-panel sv-pend sv-pend-tv" aria-label="Pedidos pendientes">
        <time className="sv-reloj-tv">{reloj}</time>
        <div ref={vistaRef} className={`sv-carrusel ${reducir ? 'paginas' : ''}`}>
          <div className={`sv-pista ${anima ? 'anima' : ''}`} style={anima ? { animationDuration: `${Math.max(12, lista.length * SEGUNDOS_POR_TARJETA)}s` } : undefined}>
            <ol ref={listaRef} className="sv-pend-lista" aria-live="polite">
              {lista.length === 0 && <li className="sv-pend-vacio">No hay pedidos pendientes 🎉</li>}
              {lista.map((p) => <Tarjeta key={p.id} p={p} />)}
            </ol>
            {anima && (
              <ol className="sv-pend-lista" aria-hidden="true">
                {lista.map((p) => <Tarjeta key={p.id} p={p} />)}
              </ol>
            )}
          </div>
        </div>
      </aside>
    );
  }
  return (
    <aside className="sv-panel sv-pend" aria-label="Pedidos pendientes">
      <div className="sv-pend-cab">
        <h1>Pedidos en curso</h1>
        <time className="sv-reloj">{reloj}</time>
      </div>
      <div className="sv-pend-resumen" aria-label="Resumen">
        <span className="sv-pend-chip caja"><b>{cuenta('CAJA')}</b> En caja</span>
        <span className="sv-pend-chip cocina"><b>{cuenta('COCINA')}</b> En cocina</span>
        <span className="sv-pend-chip listo"><b>{cuenta('LISTO')}</b> Listos</span>
      </div>
      <ol className="sv-pend-lista" aria-live="polite">
        {lista.length === 0 && <li className="sv-pend-vacio">No hay pedidos pendientes 🎉</li>}
        {lista.map((p) => <Tarjeta key={p.id} p={p} />)}
      </ol>
    </aside>
  );
}
