import { useEffect, useState } from 'react';
import { Insignia } from '../../comun/Insignia';
import { Cargando } from '../../comun/Cargando';
import { miPlanilla, type MiPlanilla } from './miCalendarioApi';
import { horasMin } from './tiposMarca';
import './miAsistencia.css';

const s = (n: number | null | undefined) => (n == null ? 'sin dato' : `S/ ${n.toFixed(2)}`);

/** «Mis pagos»: lo que se suma, lo que se descuenta, mis préstamos y el neto estimado. Solo lo propio. */
export function MisPagos() {
  const [p, setP] = useState<MiPlanilla | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    (async () => {
      try { setP(await miPlanilla()); } catch { setError(true); } finally { setCargando(false); }
    })();
  }, []);

  if (cargando) return <Cargando mensaje="Cargando tus pagos…" />;
  if (error || !p) return <section className="mp" aria-label="Mis pagos"><h3 className="as-sub">Mis pagos</h3><p role="alert" className="as-aviso as-aviso--alerta">No pudimos cargar tus pagos. Intenta otra vez.</p></section>;

  const pagado = p.estadoPago === 'PAGADO';
  const penal = p.penalidadTardanza;
  const descuentos = p.descuentos ?? [];
  const adelantos = p.adelantos ?? [];
  const extrasServ = (p.serviciosExtra ?? []).filter((x) => x.activo !== false);
  const prestamos = p.prestamos ?? [];
  const hayDescuentos = descuentos.length + adelantos.length + extrasServ.length > 0 || (penal?.total ?? 0) > 0;

  return (
    <section className="mp" aria-label="Mis pagos" data-testid="mis-pagos">
      <h3 className="as-sub">Mis pagos{p.periodo ? ` (${p.periodo.desde} a ${p.periodo.hasta})` : ''}</h3>

      <div className="mp-neto">
        <span>Neto estimado</span>
        <strong>{s(p.neto)}</strong>
        <Insignia variante={pagado ? 'exito' : 'aviso'}>{pagado ? 'Pagado' : 'Por pagar'}</Insignia>
      </div>
      {p.estadoPago === undefined && <p className="as-ayuda">Aún no hay información de pago de este período.</p>}
      {pagado && p.pagadoEn && <p className="as-ayuda">Pagado el {p.pagadoEn.slice(0, 10)}.</p>}

      <div className="mp-bloque mp-mas">
        <h4>Se te suma</h4>
        <div className="mp-fila"><span>Ganado por horas trabajadas{p.horas?.trabajadasMin != null ? ` (${horasMin(p.horas.trabajadasMin)})` : ''}</span><b>{s(p.ganado?.bruto)}</b></div>
        <div className="mp-fila">
          <span>Horas extra aprobadas{p.horas?.extraAprobadaMin != null ? ` (${horasMin(p.horas.extraAprobadaMin)})` : ''}</span><b>{s(p.ganado?.extras)}</b>
        </div>
        {(p.horas?.extraPendienteMin ?? 0) > 0 && <p className="as-ayuda">Extras pendientes de aprobar: {horasMin(p.horas?.extraPendienteMin)} (aún no se suman).</p>}
        {(p.horas?.extraRechazadaMin ?? 0) > 0 && <p className="as-ayuda">Extras rechazadas: {horasMin(p.horas?.extraRechazadaMin)}.</p>}
        {(p.ganado?.bonos ?? 0) > 0 && <div className="mp-fila"><span>Bonos</span><b>{s(p.ganado?.bonos)}</b></div>}
        <p className="as-ayuda">El tiempo de almuerzo se paga: cuenta como hora trabajada.</p>
      </div>

      <div className="mp-bloque mp-menos">
        <h4>Se te descuenta</h4>
        {!hayDescuentos && <p className="as-ayuda">No tienes descuentos en este período.</p>}
        {descuentos.map((d) => (
          <div key={d.id} className="mp-fila"><span>{d.etiqueta ?? 'Descuento'}{d.concepto ? `: ${d.concepto}` : ''}{d.fecha ? ` · ${d.fecha}` : ''}</span><b>- {s(d.monto)}</b></div>
        ))}
        {penal && penal.total > 0 && (
          <details className="mp-det">
            <summary><span>Penalidad por tardanza</span><b>- {s(penal.total)}</b></summary>
            <ul>{(penal.detalle ?? []).map((t) => <li key={t.fecha}>{t.fecha}: {t.minutos} min · {s(t.monto)}</li>)}</ul>
          </details>
        )}
        {adelantos.map((a) => (
          <div key={a.id} className="mp-fila"><span>Adelanto{a.motivo ? `: ${a.motivo}` : ''}{a.fecha ? ` · ${a.fecha}` : ''}</span><b>- {s(a.monto)}</b></div>
        ))}
        {extrasServ.map((x) => (
          <div key={x.nombre} className="mp-fila"><span>{x.nombre}{x.periodicidad ? ` (${x.periodicidad.toLowerCase()})` : ''}</span><b>- {s(x.monto)}</b></div>
        ))}
      </div>

      <div className="mp-bloque">
        <h4>Mis préstamos</h4>
        {prestamos.length === 0 && <p className="as-ayuda">No tienes préstamos.</p>}
        {prestamos.map((r) => (
          <div key={r.id} className="mp-prestamo">
            <div className="mp-fila"><span>Capital {s(r.capital)}{r.interesPctMensual ? ` · interés ${r.interesPctMensual} % mensual` : ' · sin interés'}</span><b>Saldo {s(r.saldo)}</b></div>
            <div className="as-ayuda">Cuota {s(r.cuota)} · pagadas {r.cuotasPagadas} de {r.cuotasTotales}</div>
            <progress max={r.cuotasTotales || 1} value={r.cuotasPagadas} aria-label={`Cuotas pagadas ${r.cuotasPagadas} de ${r.cuotasTotales}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
