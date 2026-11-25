import { useEffect, useState } from 'react';
import { Insignia } from '../../comun/Insignia';
import { Cargando } from '../../comun/Cargando';
import { miPlanilla, type MiPlanilla } from './miCalendarioApi';
import { LineaPropinas } from './LineaPropinas';
import { horasMin } from './tiposMarca';
import { DIAS_SEMANA } from './planillaApi';
import { moverPeriodo, rangoDe } from './periodoVista';
import './miAsistencia.css';

type Modo = 'SEMANA' | 'MES';
type Descuento = NonNullable<MiPlanilla['descuentos']>[number];

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const PERIODICIDAD: Record<string, string> = { SEMANAL: 'semanal', MENSUAL: 'mensual', UNICA: 'única' };
const METODO: Record<string, string> = {
  DIAS_HORAS: 'Tu hora sale de tu sueldo mensual, dividido entre los días y las horas de trabajo del mes.',
  PROGRAMADAS: 'Tu sueldo se reparte entre las horas programadas del período.',
  TARIFA_HORA: 'Se te paga una tarifa fija por cada hora trabajada.',
};
const ETIQUETAS: Record<Modo, { actual: string; anterior: string; flechaAnterior: string; flechaSiguiente: string }> = {
  SEMANA: { actual: 'Esta semana (en curso)', anterior: 'Semana anterior', flechaAnterior: 'Ir a la semana anterior', flechaSiguiente: 'Ir a la semana siguiente' },
  MES: { actual: 'Este mes (en curso)', anterior: 'Mes anterior', flechaAnterior: 'Ir al mes anterior', flechaSiguiente: 'Ir al mes siguiente' },
};

const s = (n: number | null | undefined) => (n == null ? 'sin dato' : `S/ ${n.toFixed(2)}`);
const dia = (f: string) => String(+f.slice(8, 10));
const mesDe = (f: string) => +f.slice(5, 7) - 1;
const anioDe = (f: string) => f.slice(0, 4);

/** «15 de noviembre de 2026»: fecha legible para avisos. */
export function fechaLarga(f: string): string {
  return `${dia(f)} de ${MESES[mesDe(f)]} de ${anioDe(f)}`;
}

/** «9 al 15 nov 2026» · «26 oct al 1 nov 2026» · «Noviembre 2026» (mensual). */
export function tituloPeriodo(desde: string, hasta: string, modo: Modo): string {
  if (modo === 'MES') return `${MESES[mesDe(desde)][0].toUpperCase()}${MESES[mesDe(desde)].slice(1)} ${anioDe(desde)}`;
  if (desde.slice(0, 7) === hasta.slice(0, 7)) return `${dia(desde)} al ${dia(hasta)} ${MESES_CORTOS[mesDe(hasta)]} ${anioDe(hasta)}`;
  const anio = anioDe(desde) === anioDe(hasta) ? '' : ` ${anioDe(desde)}`;
  return `${dia(desde)} ${MESES_CORTOS[mesDe(desde)]}${anio} al ${dia(hasta)} ${MESES_CORTOS[mesDe(hasta)]} ${anioDe(hasta)}`;
}

const modoDe = (p: MiPlanilla): Modo => (p.periodo?.tipo === 'MENSUAL' ? 'MES' : 'SEMANA');

/** Nombre corto de un descuento: «Netflix (semanal)», «Consumo del personal», «Cuota 1 de 6 del préstamo»… */
function nombreDescuento(d: Descuento, plano = false): string {
  if (d.periodicidad) {
    const per = PERIODICIDAD[d.periodicidad] ?? d.periodicidad.toLowerCase();
    return plano ? `${d.concepto ?? 'Servicio'} ${per}` : `${d.concepto ?? 'Servicio'} (${per})`;
  }
  if (d.etiqueta === 'CONSUMO') return 'Consumo del personal';
  return d.concepto ?? d.etiqueta ?? 'Descuento';
}

function Fila({ titulo, detalle, monto, signo }: { titulo: string; detalle?: string; monto: string; signo?: '+' | '-' }) {
  return (
    <div className="mp-fila">
      <span>{titulo}{detalle && <small className="mp-detalle"> {detalle}</small>}</span>
      <b className="mp-monto">{signo ? `${signo} ` : ''}{monto}</b>
    </div>
  );
}

/** Elegir período: esta semana/mes, el anterior, una fecha (no futura) y flechas ‹ ›. */
function SelectorPeriodo({ p, modo, alIr, ocupado }: { p: MiPlanilla; modo: Modo; alIr: (fecha: string | undefined) => void; ocupado: boolean }) {
  const hoy = p.hoy as string;
  const desde = (p.periodo as { desde: string }).desde;
  const actualDesde = rangoDe(modo, hoy).desde;
  const anteriorDesde = rangoDe(modo, moverPeriodo(modo, hoy, -1)).desde;
  const opcion = desde === actualDesde ? 'actual' : desde === anteriorDesde ? 'anterior' : 'elegida';
  const siguienteOk = moverPeriodo(modo, desde, 1) <= hoy; // el siguiente período ya empezó
  const e = ETIQUETAS[modo];
  return (
    <div className="mp-selector" role="group" aria-label="Elegir período">
      <div className="mp-segmentos">
        <button type="button" aria-pressed={opcion === 'actual'} onClick={() => alIr(undefined)} disabled={ocupado}>{e.actual}</button>
        <button type="button" aria-pressed={opcion === 'anterior'} onClick={() => alIr(moverPeriodo(modo, hoy, -1))} disabled={ocupado}>{e.anterior}</button>
        <label className={`mp-fecha${opcion === 'elegida' ? ' mp-fecha--activa' : ''}`}>
          <span>Elegir fecha</span>
          <input type="date" value={desde} max={hoy} disabled={ocupado}
            onChange={(ev) => ev.target.value && alIr(ev.target.value)} />
        </label>
      </div>
      <div className="mp-flechas">
        <button type="button" aria-label={e.flechaAnterior} onClick={() => alIr(moverPeriodo(modo, desde, -1))} disabled={ocupado}>‹</button>
        <span className="as-ayuda">{opcion === 'actual' ? 'Período en curso' : opcion === 'anterior' ? 'Período anterior' : 'Período elegido'}</span>
        <button type="button" aria-label={e.flechaSiguiente} onClick={() => alIr(moverPeriodo(modo, desde, 1))} disabled={ocupado || !siguienteOk}>›</button>
      </div>
    </div>
  );
}

/** Reglas de descuento y pago con los valores reales de la configuración del servidor. */
function Reglas({ p }: { p: MiPlanilla }) {
  const r = p.reglas;
  if (!r) return null;
  const items: string[] = [];
  if (r.valorHora != null) items.push(`Cada hora trabajada se paga a ${s(r.valorHora)}.`);
  if (r.metodo && METODO[r.metodo]) items.push(METODO[r.metodo]);
  items.push('El tiempo de almuerzo (break) se paga: cuenta como hora trabajada.');
  if (r.tercerizado) {
    items.push('Contrato temporal: no hay penalidad por tardanza, ni vacaciones pagadas, ni recargo de feriados.');
  } else {
    items.push(`Tardanza: se tolera ${r.toleranciaMin ?? 0} min. Lo que llegues tarde después se descuenta al ${r.penalidadTardanzaPct ?? 0} % de su valor.`);
    items.push(`Horas extra: solo se pagan si el administrador las aprueba${r.multiplicadorExtra && r.multiplicadorExtra !== 1 ? `, a ${r.multiplicadorExtra} veces el valor hora` : ''}.`);
    items.push('Feriados: las horas trabajadas ese día se pagan con el recargo de cada feriado.');
  }
  for (const t of r.tarifasEspeciales ?? []) {
    items.push(`${DIAS_SEMANA[t.diaSemana]} desde las ${t.desdeHora}: cada hora se paga a ${s(t.tarifaHora)} (tarifa especial). Las horas antes de esa hora siguen a valor hora normal. Si el día es feriado se aplica solo esta tarifa.`);
  }
  items.push('Faltas: un día sin horas trabajadas no se paga.');
  items.push('Consumos del personal, adelantos, descuentos, cuotas de préstamo y servicios (como Netflix) se descuentan en el período en que se cobran.');
  items.push('Neto = Ganado + bonos − Descuentos − Penalidad por tardanza − Adelantos.');
  return (
    <details className="mp-det mp-reglas">
      <summary>Reglas de descuento y pago</summary>
      <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
    </details>
  );
}

/** «Mis pagos»: lo que se suma, lo que se descuenta, mis préstamos y el neto estimado. Solo lo propio. */
export function MisPagos() {
  const [p, setP] = useState<MiPlanilla | null>(null);
  const [ref, setRef] = useState<string | undefined>(undefined); // fecha dentro del período pedido; undefined = el actual
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(false);
    (async () => {
      try { const d = await miPlanilla(ref); if (vigente) setP(d ?? null); } catch { if (vigente) setError(true); } finally { if (vigente) setCargando(false); }
    })();
    return () => { vigente = false; };
  }, [ref, intento]);

  if (!p && !error) return <Cargando mensaje="Cargando tus pagos…" />;
  if (error || !p) return <section className="mp" aria-label="Mis pagos"><h3 className="as-sub">Mis pagos</h3><p role="alert" className="as-aviso as-aviso--alerta">No pudimos cargar tus pagos. Intenta otra vez.</p><button type="button" className="mc-atajo-corr" onClick={() => setIntento((n) => n + 1)}>Reintentar</button></section>;

  if (p.conSueldo === false) {
    return (
      <section className="mp" aria-label="Mis pagos" data-testid="mis-pagos">
        <h3 className="as-sub">Mis pagos</h3>
        <div className="mp-bloque">
          <p className="as-ayuda">{p.sinVinculo
            ? 'Tu cuenta todavía no está vinculada a una ficha de personal. Consulta con el administrador.'
            : 'Aún no tienes sueldo configurado; consulta con el administrador.'}</p>
        </div>
      </section>
    );
  }

  const modo = modoDe(p);
  const per = p.periodo;
  const pagado = p.estadoPago === 'PAGADO';
  const enCurso = !pagado && p.enCurso === true;
  const penal = p.penalidadTardanza;
  const descuentos = p.descuentos ?? [];
  const consumos = p.consumos ?? [];
  const consumosCobrados = consumos.filter((c) => c.cobrar);
  const consumosAnteriores = consumos.filter((c) => c.anterior && !c.cobrar);
  const descManuales = descuentos.filter((d) => !d.periodicidad && d.etiqueta !== 'CONSUMO' && d.etiqueta !== 'PRESTAMO');
  const cuotas = descuentos.filter((d) => d.etiqueta === 'PRESTAMO');
  const recurrentes = descuentos.filter((d) => d.periodicidad);
  const adelantos = p.adelantos ?? [];
  const hayPenalidad = (penal?.total ?? 0) > 0;
  const hayDescuentos = descManuales.length + cuotas.length + recurrentes.length + adelantos.length + consumosCobrados.length > 0 || hayPenalidad;
  const prestamos = p.prestamos ?? [];
  const bonosManuales = p.bonosManuales ?? [];

  const neto = p.neto ?? null;
  const negativo = neto != null && neto < 0;
  const suma = p.resumen?.seSuma ?? (p.ganado?.bruto ?? 0) + (p.ganado?.bonos ?? 0);
  const descontado = p.resumen?.seDescuenta ?? Math.round((suma - (neto ?? 0)) * 100) / 100;
  const nombres = [...new Set(descuentos.map((d) => nombreDescuento(d, true)))];
  const lista = nombres.length ? ` (${nombres.slice(0, 3).join(', ')})` : '';
  const sinHoras = (p.horas?.trabajadasMin ?? 0) === 0;
  const explicaNegativo = sinHoras
    ? `Aún no tienes horas registradas este período, y ya hay ${s(descontado)} por descontar${lista}. Se descontará de lo que ganes.`
    : `Lo que ganas en el período (${s(suma)}) no alcanza para cubrir los descuentos (${s(descontado)})${lista}. Se descontará de lo que ganes.`;
  const trabajado = (p.ganado?.bruto ?? 0) - (p.ganado?.extras ?? 0);
  const detalleConsumo = (c: { fecha: string; productos: string[] }) => `· ${c.fecha}${c.productos.length ? ` · ${c.productos.join(', ')}` : ''}`;

  return (
    <section className="mp" aria-label="Mis pagos" data-testid="mis-pagos">
      <h3 className="as-sub">Mis pagos{per ? ` · ${tituloPeriodo(per.desde, per.hasta, modo)}` : ''}</h3>

      {per && p.hoy && <SelectorPeriodo p={p} modo={modo} alIr={setRef} ocupado={cargando} />}
      {cargando && <Cargando mensaje="Cargando ese período…" />}

      {!cargando && (
        <>
          <div className="mp-neto">
            <div>
              <span>Neto estimado</span>
              <strong>{negativo ? s(0) : s(neto)}</strong>
              {negativo && <small className="mp-por-descontar">Por descontar: {s(-(neto as number))}</small>}
            </div>
            {pagado
              ? <Insignia variante="exito">{p.pagadoEn ? `Pagado el ${fechaLarga(p.pagadoEn.slice(0, 10))}` : 'Pagado'}</Insignia>
              : enCurso
                ? <Insignia variante="aviso">En curso — aún no termina, el monto puede cambiar</Insignia>
                : <Insignia variante="aviso">{per ? 'Cerrado — por pagar' : 'Por pagar'}</Insignia>}
          </div>
          {enCurso && per && <p className="mp-aviso-curso" role="note">Este período termina el {fechaLarga(per.hasta)}. Lo que ves es un avance, no el reporte final.</p>}
          {negativo && <p className="mp-explica" role="note">{explicaNegativo}</p>}
          {p.estadoPago === undefined && <p className="as-ayuda">Aún no hay información de pago de este período.</p>}

          <details className="mp-det mp-calculo">
            <summary>Cómo se calcula</summary>
            <p>Se te suma {s(suma)} − Se te descuenta {s(descontado)} = {negativo ? `−${s(-(neto as number))}` : s(neto)}</p>
            <p className="as-ayuda">Neto = Ganado + bonos − Descuentos − Penalidad por tardanza − Adelantos.</p>
          </details>

          <div className="mp-bloque mp-mas">
            <h4>Se te suma</h4>
            <Fila titulo="Horas trabajadas" detalle={p.horas?.trabajadasMin != null ? `(${horasMin(p.horas.trabajadasMin)})` : undefined} monto={s(trabajado)} signo="+" />
            <Fila titulo="Horas extra aprobadas" detalle={p.horas?.extraAprobadaMin != null ? `(${horasMin(p.horas.extraAprobadaMin)})` : undefined} monto={s(p.ganado?.extras)} signo="+" />
            {(p.horas?.extraPendienteMin ?? 0) > 0 && <p className="as-ayuda">Extras pendientes de aprobar: {horasMin(p.horas?.extraPendienteMin)} (aún no se suman).</p>}
            {(p.horas?.extraRechazadaMin ?? 0) > 0 && <p className="as-ayuda">Extras rechazadas: {horasMin(p.horas?.extraRechazadaMin)}.</p>}
            {(p.ganado?.bonos ?? 0) > 0 && (
              <>
                <Fila titulo="Bonos" monto={s(p.ganado?.bonos)} signo="+" />
                {bonosManuales.map((b) => <Fila key={`b-${b.id}`} titulo={`Bono${b.motivo ? `: ${b.motivo}` : ''}`} detalle={`· ${b.fecha}`} monto={s(b.monto)} signo="+" />)}
              </>
            )}
            <LineaPropinas total={p.propinas?.total ?? 0} lineas={p.propinas?.lineas ?? []} />
            <p className="as-ayuda">El tiempo de almuerzo se paga: cuenta como hora trabajada.</p>
          </div>

          <div className="mp-bloque mp-menos">
            <h4>Se te descuenta</h4>
            {!hayDescuentos && <p className="as-ayuda">No tienes descuentos en este período.</p>}
            {consumosCobrados.length > 0 && (
              <>
                <p className="mp-subtitulo">Consumos del personal</p>
                {consumosCobrados.map((c) => <Fila key={`c-${c.fecha}-${c.pedido}`} titulo={c.pedido} detalle={detalleConsumo(c)} monto={s(c.monto)} signo="-" />)}
              </>
            )}
            {descManuales.length + cuotas.length + recurrentes.length > 0 && <p className="mp-subtitulo">Descuentos</p>}
            {descManuales.map((d) => (
              <Fila key={String(d.id)} titulo={`${d.etiqueta && d.etiqueta !== 'OTRO' ? d.etiqueta.toLowerCase() : 'descuento'}${d.concepto ? `: ${d.concepto}` : ''}`} detalle={d.fecha ? `· ${d.fecha}` : undefined} monto={s(d.monto)} signo="-" />
            ))}
            {cuotas.map((d) => <Fila key={String(d.id)} titulo={nombreDescuento(d)} monto={s(d.monto)} signo="-" />)}
            {recurrentes.map((d) => <Fila key={String(d.id)} titulo={nombreDescuento(d)} monto={s(d.monto)} signo="-" />)}
            {hayPenalidad && (
              <details className="mp-det">
                <summary><span>Penalidad por tardanza</span><b className="mp-monto">- {s(penal?.total)}</b></summary>
                <ul>{(penal?.detalle ?? []).map((t) => <li key={t.fecha}>{t.fecha}: {t.minutos} min · {s(t.monto)}</li>)}</ul>
              </details>
            )}
            {adelantos.length > 0 && <p className="mp-subtitulo">Adelantos</p>}
            {adelantos.map((a) => <Fila key={`a-${a.id}`} titulo={`Adelanto${a.motivo ? `: ${a.motivo}` : ''}`} detalle={a.fecha ? `· ${a.fecha}` : undefined} monto={s(a.monto)} signo="-" />)}
            {consumosAnteriores.length > 0 && (
              <div className="mp-pendiente">
                <p className="mp-subtitulo">Consumos de períodos anteriores aún sin cobrar</p>
                <p className="as-ayuda">No se descuentan en este período. Suman {s(consumosAnteriores.reduce((a, c) => a + c.monto, 0))}.</p>
                {consumosAnteriores.map((c) => <Fila key={`ap-${c.fecha}-${c.pedido}`} titulo={c.pedido} detalle={detalleConsumo(c)} monto={s(c.monto)} />)}
              </div>
            )}
          </div>

          <Reglas p={p} />

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
        </>
      )}
    </section>
  );
}
