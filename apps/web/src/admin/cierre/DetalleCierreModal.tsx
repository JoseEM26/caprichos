import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { lineasTicketCierre, type TicketCierreDatos } from '@caprichos/compartido';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { PapelTermico } from '../impresion/facil/PanelVistaPrevia';
import { cierreApi, DetalleCierreCompleto } from './cierreApi';
import { ListaCorrecciones } from './CorreccionesMedios';
import { PorQueNoCuadra } from './PorQueNoCuadra';
import './detalle-cierre.css';

const soles = (n: number) => `S/ ${n.toFixed(2)}`;
const conSigno = (n: number) => `${n > 0.004 ? '+' : n < -0.004 ? '−' : ''}S/ ${Math.abs(n).toFixed(2)}`;
const claseDif = (n: number) => (Math.abs(n) < 0.005 ? 'dc-ok' : 'dc-mal');

type Pestana = 'resumen' | 'efectivo' | 'medios' | 'movimientos' | 'porque';
const PESTANAS: Array<[Pestana, string]> = [
  ['resumen', 'Resumen'],
  ['efectivo', 'Efectivo'],
  ['medios', 'Medios de pago'],
  ['movimientos', 'Movimientos'],
  ['porque', '¿Por qué no cuadra?'],
];

const Fila = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="dc-fila"><dt>{k}</dt><dd>{v}</dd></div>
);

function TablaDesglose({ desglose }: { desglose: NonNullable<TicketCierreDatos['efectivo']['desglose']> }) {
  return (
    <table className="dc-tabla" data-testid="desglose-efectivo">
      <thead><tr><th>Billete o moneda</th><th>Cant.</th><th>Subtotal</th></tr></thead>
      <tbody>
        {desglose.length === 0 && <tr><td colSpan={3}>Sin billetes ni monedas contados.</td></tr>}
        {desglose.map((d) => (
          <tr key={d.valor}>
            <td>{d.valor >= 10 ? 'Billete' : 'Moneda'} {soles(d.valor)}</td>
            <td>{d.cantidad} × {soles(d.valor)}</td>
            <td>{soles(d.subtotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SeccionResumen({ t }: { t: TicketCierreDatos }) {
  return (
    <dl className="dc-lista" data-testid="seccion-resumen">
      <Fila k="Fecha" v={t.fecha} />
      <Fila k="Abrió la caja" v={t.abiertoPor ?? 'Sin dato'} />
      <Fila k="Cerró la caja" v={`${t.cerradoPor ?? 'Sin dato'}${t.cerradoEn ? ` · ${t.cerradoEn}` : ''}`} />
      <Fila k="Apertura (monto inicial)" v={soles(t.apertura)} />
      <Fila
        k="Resultado"
        v={<b className={t.resultado === 'CUADRA' ? 'dc-ok' : 'dc-mal'} data-testid="resultado-cierre">
          {t.resultado === 'CUADRA' ? 'CUADRA' : 'NO CUADRA'} · diferencia {conSigno(t.diferencia)}
        </b>}
      />
      <Fila k="Aprobado por" v={t.aprobadoPor ?? 'No requirió aprobación'} />
      <Fila k="Nota" v={t.nota ?? 'Sin nota'} />
    </dl>
  );
}

function SeccionEfectivo({ t }: { t: TicketCierreDatos }) {
  const e = t.efectivo;
  return (
    <div className="dc-bloque" data-testid="seccion-efectivo">
      {e.desglose ? (
        <TablaDesglose desglose={e.desglose} />
      ) : (
        <p className="dc-aviso" data-testid="sin-desglose">Este cierre no guardó el detalle por billetes.</p>
      )}
      <dl className="dc-lista dc-totales">
        <Fila k="Total contado" v={soles(e.contado)} />
        <Fila k="Esperado por el sistema" v={soles(e.esperado)} />
        <Fila k="Diferencia" v={<b className={claseDif(e.diferencia)}>{conSigno(e.diferencia)}</b>} />
      </dl>
      {t.intentos.length > 0 && (
        <div data-testid="intentos-conteo">
          <h4>Intentos de conteo ({t.intentos.length})</h4>
          {t.intentos.map((i) => (
            <details key={i.n} className="dc-intento">
              <summary>
                Intento {i.n} · {i.hora}{i.por ? ` · ${i.por}` : ''} · {soles(i.total)} · {i.resultado === 'CUADRA' ? 'cuadró' : 'no cuadró'}
              </summary>
              {i.desglose ? <TablaDesglose desglose={i.desglose} /> : <p className="dc-aviso">Este intento no guardó el detalle por billetes.</p>}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function SeccionMedios({ t }: { t: TicketCierreDatos }) {
  return (
    <table className="dc-tabla" data-testid="detalle-medios">
      <thead><tr><th>Medio</th><th>Sistema</th><th>Visto</th><th>Dif.</th></tr></thead>
      <tbody>
        {t.medios.map((m) => (
          <tr key={m.medio}>
            <td>{m.medio}</td>
            <td>{soles(m.sistema)}</td>
            <td>{soles(m.visto)}</td>
            <td className={claseDif(m.diferencia)}>{Math.abs(m.diferencia) < 0.005 ? 'Cuadra' : conSigno(m.diferencia)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SeccionMovimientos({ t, detalle }: { t: TicketCierreDatos; detalle: DetalleCierreCompleto }) {
  const vacio = !t.movimientos.length && !t.correcciones.length && !t.liquidaciones.length && !t.anulaciones.length;
  return (
    <div className="dc-bloque" data-testid="seccion-movimientos">
      {vacio && <p className="dc-aviso">Ese día no hubo movimientos, correcciones, liquidaciones ni anulaciones.</p>}
      {t.movimientos.length > 0 && (
        <section>
          <h4>Ingresos y egresos de caja</h4>
          <ul className="dc-items">
            {t.movimientos.map((m, i) => (
              <li key={i}>
                <b>{m.tipo}</b> {soles(m.monto)}{m.anulado ? ' (anulado)' : ''} · {m.motivo}
              </li>
            ))}
          </ul>
        </section>
      )}
      {t.correcciones.length > 0 && <ListaCorrecciones ajustes={detalle.ajustesMedio ?? []} titulo="Correcciones de medios digitales" />}
      {t.liquidaciones.length > 0 && (
        <section>
          <h4>Liquidaciones de repartidores</h4>
          <ul className="dc-items">
            {t.liquidaciones.map((l, i) => (
              <li key={i}>{l.hora} · <b>{l.repartidor}</b> entregó {soles(l.entregado)} de {soles(l.esperado)}</li>
            ))}
          </ul>
        </section>
      )}
      {t.anulaciones.length > 0 && (
        <section>
          <h4>Cobros anulados</h4>
          <ul className="dc-items">
            {t.anulaciones.map((a, i) => (
              <li key={i}>{a.hora} · {a.pedido} · {soles(a.total)}{a.por ? ` · ${a.por}` : ''}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

interface Props {
  cajaId: number;
  detalle: DetalleCierreCompleto | null;
  cargando: boolean;
  error: string | null;
  /** Solo el administrador ve el desglose por medio (cierre ciego para el resto). */
  esAdmin: boolean;
  /** Permiso para mandar el ticket a la impresora de Caja. */
  puedeImprimir: boolean;
  alCerrar: () => void;
}

/** «Detalle del cierre»: resumen, efectivo por billetes, medios de pago y movimientos; vista de ticket 80 mm e impresión en Caja. */
export function DetalleCierreModal({ cajaId, detalle, cargando, error, esAdmin, puedeImprimir, alCerrar }: Props) {
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [verTicket, setVerTicket] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;

  // Foco atrapado dentro del diálogo, Esc cierra y el foco vuelve a quien lo abrió.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    raiz.current?.querySelector<HTMLElement>('[data-cerrar]')?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return cerrarRef.current();
      if (e.key !== 'Tab' || !raiz.current) return;
      const f = Array.from(raiz.current.querySelectorAll<HTMLElement>('button:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])'));
      if (!f.length) return;
      const primero = f[0];
      const ultimo = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === primero || !raiz.current.contains(document.activeElement))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      previo?.focus?.();
    };
  }, []);

  const t = detalle?.ticket;

  const imprimir = async () => {
    setImprimiendo(true);
    setAviso(null);
    try {
      const r = await cierreApi.imprimirCierre(cajaId);
      setAviso({ ok: true, texto: r.mensaje });
    } catch (e: any) {
      setAviso({ ok: false, texto: e?.message || 'No se pudo mandar el ticket a la impresora' });
    } finally {
      setImprimiendo(false);
    }
  };

  const contenido = () => {
    if (cargando) return <Cargando mensaje="Cargando el cierre..." />;
    if (error) return <EstadoError mensaje={error} />;
    if (!detalle) return null;
    if (!t) return <p className="dc-aviso">Este cierre no trae el detalle completo. Actualiza la página.</p>;
    if (verTicket) {
      return (
        <div className="dc-ticket" data-testid="vista-ticket">
          <PapelTermico lineas={lineasTicketCierre(t, 48)} columnas={48} zoom={1} etiqueta={`Vista previa del ticket de cierre ${t.codigo}`} />
        </div>
      );
    }
    return (
      <>
        <div className="dc-pestanas" role="tablist" aria-label="Secciones del cierre">
          {PESTANAS.filter(([id]) => id !== 'porque' || esAdmin).map(([id, texto]) => (
            <button key={id} type="button" role="tab" id={`dc-tab-${id}`} aria-selected={pestana === id} aria-controls="dc-panel" className="dc-tab" onClick={() => setPestana(id)}>
              {texto}
            </button>
          ))}
        </div>
        <div id="dc-panel" role="tabpanel" aria-labelledby={`dc-tab-${pestana}`} className="dc-panel">
          {pestana === 'resumen' && <SeccionResumen t={t} />}
          {pestana === 'efectivo' && <SeccionEfectivo t={t} />}
          {pestana === 'medios' && (esAdmin
            ? <SeccionMedios t={t} />
            : <p className="dc-aviso" data-testid="aviso-detalle-restringido">El desglose por medio de pago y las diferencias del sistema están reservados para el administrador (cierre ciego).</p>)}
          {pestana === 'movimientos' && <SeccionMovimientos t={t} detalle={detalle} />}
          {pestana === 'porque' && esAdmin && <PorQueNoCuadra cajaId={cajaId} />}
        </div>
      </>
    );
  };

  return createPortal(
    <div className="dc-fondo" onClick={alCerrar}>
      <div ref={raiz} role="dialog" aria-modal="true" aria-labelledby="dc-titulo" className="dc-dialogo" onClick={(e) => e.stopPropagation()}>
        <header className="dc-cabecera">
          <h2 id="dc-titulo">Detalle del cierre #{cajaId}</h2>
          <button type="button" data-cerrar className="dc-x" aria-label="Cerrar" onClick={alCerrar}>×</button>
        </header>
        <div className="dc-cuerpo">{contenido()}</div>
        <footer className="dc-pie">
          {aviso && <p role="status" className={aviso.ok ? 'dc-ok' : 'dc-mal'} data-testid="aviso-impresion">{aviso.texto}</p>}
          <div className="dc-acciones">
            {t && (
              <button type="button" className="dc-btn" aria-pressed={verTicket} data-testid="ver-ticket" onClick={() => setVerTicket((v) => !v)}>
                {verTicket ? 'Volver al detalle' : 'Ver como ticket'}
              </button>
            )}
            {t && puedeImprimir && (
              <button type="button" className="dc-btn dc-btn-fuerte" data-testid="imprimir-cierre" disabled={imprimiendo} onClick={imprimir}>
                {imprimiendo ? 'Enviando…' : 'Imprimir'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
