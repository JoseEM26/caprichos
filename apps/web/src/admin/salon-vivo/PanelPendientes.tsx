import { useState } from 'react';
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
    porId.set(p.id, { id: p.id, codigo: p.codigo, donde: donde(p), cliente: p.cliente, etapa, porcentaje, minutos: p.minutos, areas: p.areas, avatarUrl: p.avatar?.url ?? null });
  };
  // En caja solo cuenta mientras aún no entra a cocina ni está listo (por cobrar antes de preparar)
  for (const p of d.caja) if (p.estado === 'COLA' && p.areas.every((a) => a.estado === 'PENDIENTE')) poner(p, 'CAJA');
  for (const p of d.cocina) poner(p, 'COCINA');
  for (const p of d.despacho) poner(p, 'LISTO');
  // Listos primero (hay que entregarlos), luego los que más avanzaron, y a igual avance el que más espera
  return [...porId.values()].sort((a, b) => (b.etapa === 'LISTO' ? 1 : 0) - (a.etapa === 'LISTO' ? 1 : 0) || b.porcentaje - a.porcentaje || b.minutos - a.minutos);
}

/** Retrato circular del cliente; si la imagen falla, el círculo queda vacío y no se ve un icono roto. */
function Retrato({ url }: { url: string }) {
  const [falla, setFalla] = useState(false);
  if (falla) return <span className="sv-pend-retrato vacio" aria-hidden="true" />;
  return <img className="sv-pend-retrato" src={url} alt="" loading="lazy" onError={() => setFalla(true)} />;
}

const nombreArea = (n: string) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();

export function PanelPendientes({ datos, reloj }: { datos: SalonVivo; reloj: string }) {
  const lista = pendientesDe(datos);
  const cuenta = (e: EtapaPendiente) => lista.filter((p) => p.etapa === e).length;
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
        {lista.map((p) => (
          <li key={p.id} className={`sv-pend-item ${p.etapa.toLowerCase()} ${p.minutos >= 15 && p.etapa !== 'LISTO' ? 'tarde' : ''}`}>
            <div className="sv-pend-fila">
              {p.avatarUrl && <Retrato url={p.avatarUrl} />}
              <span className="sv-pend-cod"><small>{p.codigo.slice(0, 3)}</small>{p.codigo.slice(3)}</span>
              <span className="sv-pend-donde">{p.donde}{p.cliente ? ` · ${p.cliente}` : ''}</span>
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
            {p.etapa === 'COCINA' && p.areas.length > 0 && (
              <div className="sv-pend-areas">
                {p.areas.map((a) => <span key={a.nombre} className={a.estado === 'LISTA' ? 'ok' : 'prep'}>{a.estado === 'LISTA' ? '✓' : '●'} {nombreArea(a.nombre)}</span>)}
                <em className="sv-pend-min">⏱ {p.minutos} min</em>
              </div>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}
