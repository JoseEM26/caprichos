import { useId, useState } from 'react';
import { vouchersApi, type ItemHistorialVoucher } from '../vouchers/vouchersApi';
import { FotoAmpliable } from '../vouchers/FotoAmpliable';
import './historial-voucher.css';

export interface HistorialVoucherProps {
  pedidoId: string | number;
  /** Cuántos vouchers tiene el pedido (vigentes y reemplazados), si se conoce, para el rótulo. */
  total?: number;
  /** Texto del botón (por defecto «Historial del voucher»). */
  rotulo?: string;
  /** Solo los reemplazados y retirados, no el vigente. */
  soloAnteriores?: boolean;
}

const ETIQUETA_ESTADO: Record<ItemHistorialVoucher['estado'], string> = {
  VIGENTE: 'Vigente',
  REEMPLAZADO: 'Reemplazado',
  RETIRADO: 'Retirado',
};

const NOMBRE_MEDIO: Record<string, string> = { YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia' };

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Lima',
  });
}

/**
 * Historial plegado de los vouchers de un pedido. Nada se borra: los reemplazados aparecen marcados.
 * Carga perezosa: el endpoint solo se pide al desplegar. El mozo no recibe semáforo (el servidor no lo envía).
 */
export function HistorialVoucher({ pedidoId, total, rotulo = 'Historial del voucher', soloAnteriores = false }: HistorialVoucherProps) {
  const idLista = useId();
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<ItemHistorialVoucher[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  const alternar = () => {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (!siguiente || items !== null || cargando) return;
    setCargando(true);
    setError(false);
    vouchersApi
      .historialPedido(pedidoId)
      .then((r) => setItems((r.items ?? []).filter((i) => !soloAnteriores || i.estado !== 'VIGENTE')))
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  };

  return (
    <div className="hv">
      <button type="button" className="hv-boton" aria-expanded={abierto} aria-controls={idLista} onClick={alternar}>
        {rotulo}{total != null ? ` (${total})` : ''}
      </button>
      {abierto && (
        <div id={idLista} className="hv-lista">
          {cargando && <p className="hv-aviso">Cargando historial…</p>}
          {error && (
            <p role="alert" className="hv-aviso hv-aviso--error">
              No se pudo cargar el historial.
            </p>
          )}
          {items && items.length === 0 && <p className="hv-aviso">Este pedido no tiene vouchers.</p>}
          {items && items.length > 0 && (
            <ol className="hv-items">
              {items.map((it) => (
                <li key={it.id} className={`hv-item hv-item--${it.estado.toLowerCase()}`}>
                  {it.archivoId && <FotoAmpliable archivoId={it.archivoId} alt="Voucher del historial" alturaMaxima={96} />}
                  <div className="hv-cabeza">
                    <span>{fechaHora(it.subidoEn)}</span>
                    {it.subidoPor && <span>por {it.subidoPor}</span>}
                    {it.medio && <span>{NOMBRE_MEDIO[it.medio] ?? it.medio}</span>}
                    <span className="hv-estado">{ETIQUETA_ESTADO[it.estado]}</span>
                  </div>
                  {it.estado !== 'VIGENTE' && it.reemplazadoEn && (
                    <div className="hv-detalle">{ETIQUETA_ESTADO[it.estado]} el {fechaHora(it.reemplazadoEn)}</div>
                  )}
                  {it.motivoCambio && <div className="hv-detalle">Motivo: {it.motivoCambio}</div>}
                  <div className="hv-detalle">{it.legible ? 'Se lee bien' : 'No se lee'}</div>
                  {it.semaforo && <div className="hv-detalle">Semáforo: {it.semaforo}</div>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
